/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Override the API base (defaults to same-origin /api, proxied in dev). */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** package.json version + git hash, injected by vite.config.ts `define`. */
declare const __APP_VERSION__: string
