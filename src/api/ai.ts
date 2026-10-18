import { api } from './client'
import type {
  AiProviderDto,
  AiProviderType,
  AiProviderVerifyResult,
  GenerateEffort,
  GeneratePlatform,
  GenerateResult,
  PostContent,
} from './types'

export interface CreateAiProviderInput {
  name: string
  type: AiProviderType
  apiKey: string
  /** Required — model names are provider-specific, there's no built-in fallback. */
  defaultModel: string
  baseUrl?: string
}

/**
 * Every field optional; absent or blank `apiKey` keeps the stored key.
 * `baseUrl`: omitted (or null) keeps the stored value, an empty string clears
 * it back to the type's default. `defaultModel` can only be replaced — never
 * send '' (the backend rejects clearing it). Type is immutable.
 */
export interface UpdateAiProviderInput {
  name?: string
  apiKey?: string
  baseUrl?: string | null
  defaultModel?: string
}

export interface GenerateInput {
  prompt: string
  /** Variants to produce; omitted = ["GENERIC"] backend-side, empty → 400. */
  platforms?: GeneratePlatform[]
  constraints?: {
    maxLength?: number
    tone?: string
  }
  /**
   * Current editor content per platform (GENERIC = the post's own content) —
   * when set, the model edits the draft instead of writing from scratch.
   * Blank-text entries are ignored; keys outside `platforms` are context only.
   */
  editorState?: Partial<Record<GeneratePlatform, PostContent>>
  /** Required when several providers exist; inferred when exactly one does. */
  providerId?: number
  /** Falls back to the provider's (required) defaultModel. */
  model?: string
  effort?: GenerateEffort
}

export const aiApi = {
  /** Newest first; API keys masked. */
  list: () => api<AiProviderDto[]>('GET', '/ai-providers'),

  create: (input: CreateAiProviderInput) => api<AiProviderDto>('POST', '/ai-providers', input),

  update: (id: number, input: UpdateAiProviderInput) =>
    api<AiProviderDto>('PUT', `/ai-providers/${id}`, input),

  /** Hard delete — nothing references a provider yet. */
  remove: (id: number) => api<void>('DELETE', `/ai-providers/${id}`),

  /** Cheap authenticated call (a models listing); always 200 with ok/message. */
  verify: (id: number) => api<AiProviderVerifyResult>('POST', `/ai-providers/${id}/verify`),

  /** Live model ids the key can use — the pickers' suggestion list. */
  models: (id: number) => api<string[]>('GET', `/ai-providers/${id}/models`),

  /** Well-known API roots per provider type — baseUrl suggestions. */
  baseUrls: (type: AiProviderType) =>
    api<Record<string, string>>('GET', `/ai-providers/baseurls/${type}`),

  /** Effort enum for the picker (stub — may become per-model later). */
  effortLevels: () => api<GenerateEffort[]>('GET', '/ai/effort-levels'),

  /** One-shot generation; a single call can take up to a minute at high effort. */
  generate: (input: GenerateInput) => api<GenerateResult>('POST', '/ai/generate', input),
}
