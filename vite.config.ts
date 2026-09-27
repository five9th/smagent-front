import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The SPA calls same-origin /api and Vite's dev server forwards it to the
// Spring Boot backend. Override the target with SMAGENT_BACKEND_URL when it
// doesn't run on localhost:8080.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.SMAGENT_BACKEND_URL ?? 'http://localhost:8080',
        changeOrigin: true,
        // Chrome sends `Origin: http://localhost:<vite-port>` even on same-origin
        // POSTs; Spring's CORS filter 403s any origin outside its allowlist
        // (default: :5173). Drop it so any dev port works through the proxy.
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('Origin'))
        },
      },
    },
  },
})
