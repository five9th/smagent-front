import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The SPA calls same-origin /api and Vite's dev server forwards it to the
// Spring Boot backend. Override the target with SMAGENT_BACKEND_URL when it
// doesn't run on localhost:8080.
// Public deployment path (e.g. SMAGENT_BASE_PATH=/smagent/ for nginx under a
// sub-path). Must have leading and trailing slashes. Dev default is '/'.
const basePath = process.env.SMAGENT_BASE_PATH ?? '/'

// The SPA calls same-origin /api and Vite's dev server forwards it to the
// Spring Boot backend. Override the target with SMAGENT_BACKEND_URL when it
// doesn't run on localhost:8080.
const proxyCommon = {
  target: process.env.SMAGENT_BACKEND_URL ?? 'http://localhost:8080',
  changeOrigin: true,
  // Chrome sends `Origin: http://localhost:<vite-port>` even on same-origin
  // POSTs; Spring's CORS filter 403s any origin outside its allowlist
  // (default: :5173). Drop it so any dev port works through the proxy.
  configure: (proxy: { on: (event: string, cb: (req: { removeHeader: (h: string) => void }) => void) => void }) => {
    proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('Origin'))
  },
}

export default defineConfig({
  base: basePath,
  plugins: [react()],
  server: {
    proxy: {
      // When running with a base path the SPA requests `${basePath}api`;
      // strip the prefix so the backend still sees its normal /api routes.
      ...(basePath === '/'
        ? {}
        : { [`${basePath}api`]: { ...proxyCommon, rewrite: (p: string) => p.slice(basePath.length - 1) } }),
      '/api': proxyCommon,
    },
  },
})
