/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Override the API base (defaults to same-origin /api, proxied in dev). */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
