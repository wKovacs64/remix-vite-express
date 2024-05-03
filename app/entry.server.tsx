/**
 * By default, Remix will handle generating the HTTP Response for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.server
 */
import fs from 'node:fs';
import path from 'node:path';
import http2 from 'node:http2';
import { PassThrough } from 'node:stream'
import type { AppLoadContext, EntryContext, Session } from '@remix-run/node'
import { createReadableStreamFromReadable } from '@remix-run/node'
import { RemixServer } from '@remix-run/react'
import { isbot } from 'isbot'
import { renderToPipeableStream } from 'react-dom/server'
import { createExpressApp } from 'remix-create-express-app'
import http2Express from 'http2-express-bridge';
import express from 'express';
// import compression from 'compression';
import morgan from 'morgan'
import { sayHello } from '#app/hello.server'
import { type SessionData, type SessionFlashData } from '#app/session.server'

const ABORT_DELAY = 5_000

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
  // This is ignored so we can keep it in the template for visibility.  Feel
  // free to delete this parameter in your app if you're not using it!
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  loadContext: AppLoadContext,
) {
  return isbot(request.headers.get('user-agent') || '')
    ? handleBotRequest(
        request,
        responseStatusCode,
        responseHeaders,
        remixContext,
      )
    : handleBrowserRequest(
        request,
        responseStatusCode,
        responseHeaders,
        remixContext,
      )
}

function handleBotRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false
    const { pipe, abort } = renderToPipeableStream(
      <RemixServer
        context={remixContext}
        url={request.url}
        abortDelay={ABORT_DELAY}
      />,
      {
        onAllReady() {
          shellRendered = true
          const body = new PassThrough()
          const stream = createReadableStreamFromReadable(body)

          responseHeaders.set('Content-Type', 'text/html')

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          )

          pipe(body)
        },
        onShellError(error: unknown) {
          reject(error)
        },
        onError(error: unknown) {
          responseStatusCode = 500
          // Log streaming rendering errors from inside the shell.  Don't log
          // errors encountered during initial shell rendering since they'll
          // reject and get logged in handleDocumentRequest.
          if (shellRendered) {
            console.error(error)
          }
        },
      },
    )

    setTimeout(abort, ABORT_DELAY)
  })
}

function handleBrowserRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false
    const { pipe, abort } = renderToPipeableStream(
      <RemixServer
        context={remixContext}
        url={request.url}
        abortDelay={ABORT_DELAY}
      />,
      {
        onShellReady() {
          shellRendered = true
          const body = new PassThrough()
          const stream = createReadableStreamFromReadable(body)

          responseHeaders.set('Content-Type', 'text/html')

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          )

          pipe(body)
        },
        onShellError(error: unknown) {
          reject(error)
        },
        onError(error: unknown) {
          responseStatusCode = 500
          // Log streaming rendering errors from inside the shell.  Don't log
          // errors encountered during initial shell rendering since they'll
          // reject and get logged in handleDocumentRequest.
          if (shellRendered) {
            console.error(error)
          }
        },
      },
    )

    setTimeout(abort, ABORT_DELAY)
  })
}

declare module '@remix-run/server-runtime' {
  export interface AppLoadContext {
    sayHello: () => string
    session: Session<SessionData, SessionFlashData>
  }
}

// export const app = createExpressApp({
//   configure: app => {
//     // customize your express app with additional middleware
//     app.use(morgan('tiny'))
//   },
//   getLoadContext: () => {
//     // return the AppLoadContext
//     return { sayHello } as AppLoadContext
//   },
//   unstable_middleware: true,
// })

export const app = createExpressApp({
  configure: expressApp => {
    console.log('Configuring custom Express app')
    expressApp.disable('x-powered-by')
    // expressApp.use(compression())
    expressApp.use(
      morgan('tiny', {
        skip: req =>
          req.url === '/healthcheck' ||
          Boolean(req.headers['x-from-healthcheck']),
      }),
    )
  },
  getExpress: () => {
    console.log('Getting Express with http2-express-bridge')
    return http2Express(express)
  },
  getLoadContext: () => {
    console.log('Getting load context')
    return { sayHello } as AppLoadContext
  },
  createServer: expressApp => {
    console.log('Creating custom HTTP/2 server')
    return http2.createSecureServer(
      {
        key: fs.readFileSync(
          path.resolve(path.join(process.cwd(), 'other/localhost-key.pem')),
        ),
        cert: fs.readFileSync(
          path.resolve(path.join(process.cwd(), 'other/localhost-cert.pem')),
        ),
        allowHTTP1: true,
      },
      expressApp,
    )
  },
  unstable_middleware: true,
})
