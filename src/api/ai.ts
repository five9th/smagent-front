import { api } from './client'
import type {
  AiProviderDto,
  AiProviderType,
  AiProviderVerifyResult,
  GenerateEffort,
  GeneratePlatform,
  GenerateResult,
} from './types'

export interface CreateAiProviderInput {
  name: string
  type: AiProviderType
  apiKey: string
  baseUrl?: string
  defaultModel?: string
}

/**
 * Every field optional; absent or blank `apiKey` keeps the stored key.
 * `baseUrl`/`defaultModel`: omitted (or null) keeps the stored value, an empty
 * string clears it back to the official API / built-in fallback. The provider
 * type is immutable (no field for it backend-side).
 */
export interface UpdateAiProviderInput {
  name?: string
  apiKey?: string
  baseUrl?: string | null
  defaultModel?: string | null
}

export interface GenerateInput {
  prompt: string
  /** Variants to produce; omitted = ["GENERIC"] backend-side, empty → 400. */
  platforms?: GeneratePlatform[]
  constraints?: {
    maxLength?: number
    tone?: string
  }
  /** Required when several providers exist; inferred when exactly one does. */
  providerId?: number
  /** Falls back to provider.defaultModel, then the built-in constant. */
  model?: string
  effort?: GenerateEffort
}

export const aiApi = {
  /** Newest first; API keys masked. */
  list: () => api<AiProviderDto[]>('GET', '/ai-providers'),

  /** Creating an OPENAI_COMPATIBLE provider returns 501 for now. */
  create: (input: CreateAiProviderInput) => api<AiProviderDto>('POST', '/ai-providers', input),

  update: (id: number, input: UpdateAiProviderInput) =>
    api<AiProviderDto>('PUT', `/ai-providers/${id}`, input),

  /** Hard delete — nothing references a provider yet. */
  remove: (id: number) => api<void>('DELETE', `/ai-providers/${id}`),

  /** Cheap authenticated call (a models listing); always 200 with ok/message. */
  verify: (id: number) => api<AiProviderVerifyResult>('POST', `/ai-providers/${id}/verify`),

  /** One-shot generation; a single call can take up to a minute at high effort. */
  generate: (input: GenerateInput) => api<GenerateResult>('POST', '/ai/generate', input),
}
