import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Frontend build version: package.json version + git commit, baked in at
// dev-server start / build time and displayed in the app (see AppShell).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))
const gitHash = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev' // not a git checkout (e.g. exported tarball)
  }
})()

// The SPA calls same-origin /api and Vite's dev server forwards it to the
// Spring Boot backend. Override the target with SMAGENT_BACKEND_URL when it
// doesn't run on localhost:8080.
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(`${pkg.version}+${gitHash}`),
  },
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
      // Backend build info (/actuator/info, public) for the version display.
      '/actuator': {
        target: process.env.SMAGENT_BACKEND_URL ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
