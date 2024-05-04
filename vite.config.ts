import { vitePlugin as remix } from '@remix-run/dev'
import { installGlobals } from '@remix-run/node'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { expressDevServer } from 'remix-express-dev-server'
import envOnly from 'vite-env-only'
import fs from 'fs'
import path from 'path'

installGlobals({ nativeFetch: true })

export default defineConfig({
  build: {
    target: 'esnext',
  },
  server: {
    https: {
      key: fs.readFileSync(
        path.resolve(path.join(process.cwd(), 'other/localhost-key.pem')),
      ),
      cert: fs.readFileSync(
        path.resolve(path.join(process.cwd(), 'other/localhost-cert.pem')),
      ),
    },
  },
  plugins: [
    expressDevServer(),
    envOnly(),
    remix({
      future: { unstable_singleFetch: true },
    }),
    tsconfigPaths(),
  ],
})
