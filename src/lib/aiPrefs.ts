// Remembered AI provider/model for generation requests — there is no
// server-side default provider, so the SPA carries the choice (API.md: /ai/generate).

const PROVIDER_KEY = 'smagent-ai-provider'
const MODEL_KEY = 'smagent-ai-model'

/** Stored provider id, or null when nothing (usable) is remembered. */
export function rememberedProviderId(): number | null {
  try {
    const id = Number(localStorage.getItem(PROVIDER_KEY))
    return Number.isInteger(id) ? id : null
  } catch {
    return null // private mode — just don't remember
  }
}

export function rememberProviderId(id: number | null): void {
  try {
    if (id === null) localStorage.removeItem(PROVIDER_KEY)
    else localStorage.setItem(PROVIDER_KEY, String(id))
  } catch {
    /* private mode */
  }
}

export function rememberedModel(): string {
  try {
    return localStorage.getItem(MODEL_KEY) ?? ''
  } catch {
    return ''
  }
}

export function rememberModel(model: string): void {
  try {
    if (model.trim()) localStorage.setItem(MODEL_KEY, model)
    else localStorage.removeItem(MODEL_KEY)
  } catch {
    /* private mode */
  }
}
