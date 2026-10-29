import { useState } from 'react'
import { aiApi, type GenerateInput } from '../api/ai'
import { ApiError } from '../api/client'
import type {
  AiProviderDto,
  GenerateEffort,
  GeneratePlatform,
  GenerateResult,
  GeneratedTextDto,
  Platform,
  PostContent,
} from '../api/types'
import { useApiQuery } from '../hooks/useApiQuery'
import {
  rememberModel,
  rememberProviderId,
  rememberedModel,
  rememberedProviderId,
} from '../lib/aiPrefs'
import { PLATFORMS, PLATFORM_LIST } from '../lib/platform'
import { Icon } from './Icon'
import { PostPreview, type PreviewTab } from './PostPreview'
import { ValuePicker, type Suggestion } from './ValuePicker'
import {
  Callout,
  CopyButton,
  InlineError,
  Loading,
  PlatformChip,
  SectionHead,
  Spinner,
} from './ui'

/** Which part of a generation result an editor apply targets. */
export type ApplyTarget = 'all' | 'GENERIC' | Platform

/** A generation result handed to the post editor (the /ai → editor flow). */
export interface AiDraftSeed {
  title: string
  text: string
  overrides: Partial<Record<Platform, GeneratedTextDto>>
}

const EFFORTS: GenerateEffort[] = ['LOW', 'MEDIUM', 'HIGH', 'XHIGH', 'MAX']
const EFFORT_LABELS: Record<GenerateEffort, string> = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  XHIGH: 'extra high',
  MAX: 'max',
}
const TONE_PRESETS = ['casual', 'professional', 'playful']
const GENERATE_PLATFORMS: GeneratePlatform[] = ['GENERIC', ...PLATFORM_LIST]

function GenericChip() {
  return (
    <span className="chan">
      <span className="g g-generic">G</span>
      Generic
    </span>
  )
}

function seedFrom(r: GenerateResult): AiDraftSeed {
  return { title: r.content?.title ?? '', text: r.content?.text ?? '', overrides: r.overrides }
}

/** One generated variant: chip + copy/apply affordances + the shared preview. */
function VariantBlock({
  tab,
  content,
  onApply,
}: {
  tab: PreviewTab
  content: GeneratedTextDto
  onApply?: () => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {tab === 'GENERIC' ? <GenericChip /> : <PlatformChip platform={tab} />}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <CopyButton value={content.text} />
          {onApply && (
            <button className="btn" style={{ padding: '4px 10px', fontSize: 11 }} onClick={onApply}>
              Apply
            </button>
          )}
        </span>
      </div>
      <PostPreview
        tab={tab}
        contentFor={() => ({ title: content.title ?? '', text: content.text, link: '' })}
        placeholder="The model returned no text."
      />
    </div>
  )
}

/**
 * The single generate UI, a tab on the /ai page and on the post editor page.
 * All form state lives here, so the parent can keep the panel mounted and
 * switch to it without losing anything. Passing `onApply` (editor) turns the
 * result actions into Apply buttons; otherwise (the /ai tab) the result is
 * handed over via `onOpenInEditor`. `draft` (editor), when non-null, adds the
 * "Show draft to AI" consent toggle and sends editorState with the request.
 */
export function GeneratePanel({
  providers,
  loading,
  refreshProviders,
  draft = null,
  onApply,
  onOpenInEditor,
  onGoToProviders,
}: {
  providers: AiProviderDto[]
  loading: boolean
  refreshProviders: () => void
  /**
   * Current draft content (null when there's nothing to show) — with the
   * user's consent it rides along so the AI edits instead of drafting from
   * scratch.
   */
  draft?: Partial<Record<GeneratePlatform, PostContent>> | null
  onApply?: (result: GenerateResult, which: ApplyTarget) => void
  onOpenInEditor?: (seed: AiDraftSeed) => void
  onGoToProviders?: () => void
}) {
  const [prompt, setPrompt] = useState('')
  const [tone, setTone] = useState('')
  const [maxLength, setMaxLength] = useState('')
  const [effort, setEffort] = useState<GenerateEffort>('LOW')
  const [platforms, setPlatforms] = useState<Set<GeneratePlatform>>(() => new Set(['GENERIC']))
  const [chosenId, setChosenId] = useState<number | ''>(() => rememberedProviderId() ?? '')
  const [model, setModel] = useState(rememberedModel)
  const [showDraft, setShowDraft] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [result, setResult] = useState<GenerateResult | null>(null)

  const multiple = providers.length > 1
  // A remembered provider that no longer exists (deleted elsewhere) is ignored;
  // the next explicit choice overwrites the stale stored key.
  const providerId =
    multiple && chosenId !== '' && !providers.some((p) => p.id === chosenId) ? '' : chosenId

  const selected =
    providers.length === 1 ? providers[0] : providers.find((p) => p.id === providerId)

  // Suggestion lists for the pickers: the selected provider's live models and
  // the effort enum. Both degrade gracefully when unreachable.
  const modelsQuery = useApiQuery(
    () => (selected ? aiApi.models(selected.id) : Promise.resolve([] as string[])),
    ['ai-models', selected?.id ?? null],
  )
  const modelSuggestions: Suggestion[] = (modelsQuery.data ?? []).map((m) => ({
    value: m,
    label: m,
  }))
  const effortQuery = useApiQuery(() => aiApi.effortLevels(), ['ai-effort-levels'])
  const effortLevels = effortQuery.data ?? EFFORTS

  if (loading) return <Loading />

  if (!providers.length) {
    return (
      <div className="card pad">
        <div className="empty">
          No AI providers yet — add an API key to start generating.
          <div style={{ marginTop: 10 }}>
            <button className="btn primary" onClick={onGoToProviders}>
              <Icon name="plus" /> Add a provider
            </button>
          </div>
        </div>
      </div>
    )
  }

  const togglePlatform = (p: GeneratePlatform) => {
    setPlatforms((ps) => {
      if (!ps.has(p)) return new Set(ps).add(p)
      if (ps.size === 1) return ps // never empty — the backend rejects an empty set
      const next = new Set(ps)
      next.delete(p)
      return next
    })
  }

  const generateDisabled =
    busy || !prompt.trim() || platforms.size === 0 || (multiple && providerId === '')

  const doGenerate = async () => {
    setError(null)
    setBusy(true)
    try {
      // Omitted when unset; an unparsable max length counts as unset.
      const parsed = Number.parseInt(maxLength, 10)
      const maxLen = Number.isFinite(parsed) && parsed > 0 ? parsed : null
      const input: GenerateInput = {
        prompt: prompt.trim(),
        platforms: [...platforms],
        ...(tone || maxLen
          ? {
              constraints: {
                ...(tone ? { tone } : {}),
                ...(maxLen ? { maxLength: maxLen } : {}),
              },
            }
          : {}),
        ...(showDraft && draft ? { editorState: draft } : {}),
        // Exactly one provider: let the backend infer it.
        ...(multiple && providerId !== '' ? { providerId } : {}),
        ...(model.trim() ? { model: model.trim() } : {}),
        effort,
      }
      setResult(await aiApi.generate(input))
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        // The chosen provider vanished (deleted elsewhere) — forget it, reload.
        rememberProviderId(null)
        setChosenId('')
        refreshProviders()
        setError('That provider no longer exists — pick another one.')
      } else {
        setError(e)
      }
    } finally {
      setBusy(false)
    }
  }

  /* --- Field chunks --------------------------------------------------------- */

  // Consent to sharing the current draft with the AI — only offered when
  // there is something to show (editor with content).
  const draftToggle = draft != null && (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        marginBottom: 12,
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={showDraft}
        disabled={busy}
        onChange={(e) => setShowDraft(e.target.checked)}
      />
      <span style={{ fontSize: 12.5 }}>
        <b>Show draft to AI</b> — the model refines the text already in the editor instead of
        writing from scratch
      </span>
    </label>
  )

  const promptField = (
    <label className="field">
      <span className="lab">What should the post say? (prompt)</span>
      <textarea
        rows={4}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g. Post about releasing v2 of our CLI tool"
      />
      <span className="hint" style={{ display: 'block', marginTop: 4 }}>
        The model has no memory — every generation starts from scratch, so don't refer to previous
        prompts; repeat whatever it needs to know.
      </span>
    </label>
  )

  const constraintsRow = (
    <div className="grid cols-2">
      <label className="field">
        <span className="lab">Tone (optional)</span>
        <select value={tone} onChange={(e) => setTone(e.target.value)}>
          <option value="">any tone</option>
          {TONE_PRESETS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="lab">Max length (optional)</span>
        <input
          type="number"
          min={1}
          value={maxLength}
          onChange={(e) => setMaxLength(e.target.value)}
          placeholder="platform default"
        />
      </label>
    </div>
  )

  const providerField =
    providers.length === 1 ? (
      <div className="field">
        <span className="lab">Provider</span>
        <div style={{ fontSize: 12.5 }}>
          <b>{providers[0].name}</b>{' '}
          <span className="hint">— the only one configured, used automatically</span>
        </div>
      </div>
    ) : (
      <label className="field">
        <span className="lab">Provider</span>
        <select
          value={providerId}
          onChange={(e) => {
            const v = e.target.value === '' ? '' : Number(e.target.value)
            setChosenId(v)
            rememberProviderId(v === '' ? null : v)
          }}
        >
          <option value="">choose a provider…</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
    )

  const modelField = (
    <label className="field">
      <span className="lab">Model (optional)</span>
      <ValuePicker
        value={model}
        onChange={(v) => {
          setModel(v)
          rememberModel(v)
        }}
        suggestions={modelSuggestions}
        placeholder={selected?.defaultModel ?? 'type a model id'}
        emptyLabel={
          selected?.defaultModel ? `provider default (${selected.defaultModel})` : 'provider default'
        }
      />
      <span className="hint" style={{ display: 'block', marginTop: 4 }}>
        {modelsQuery.error
          ? 'Couldn’t list this provider’s models — type the id manually.'
          : 'From the provider’s model list, or custom. Empty uses the provider’s default.'}
      </span>
    </label>
  )

  // Effort is an Anthropic-only knob for now — kept visible but inert for
  // OpenAI-compatible providers so the field doesn't silently appear/disappear.
  const effortInert = selected?.type === 'OPENAI_COMPATIBLE'
  const effortField = (
    <label className="field">
      <span className="lab">Reasoning effort</span>
      <select
        value={effort}
        disabled={effortInert}
        onChange={(e) => setEffort(e.target.value as GenerateEffort)}
      >
        {effortLevels.map((lvl) => (
          <option key={lvl} value={lvl}>
            {EFFORT_LABELS[lvl] ?? lvl}
          </option>
        ))}
      </select>
      <span className="hint" style={{ display: 'block', marginTop: 4 }}>
        {effortInert
          ? 'Anthropic-only for now — not sent to OpenAI-compatible providers.'
          : 'How hard the model thinks it over — higher is slower and more thorough.'}
      </span>
    </label>
  )

  const platformsBlock = (
    <div className="field">
      <span className="lab">Variants</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {GENERATE_PLATFORMS.map((p) => {
          const on = platforms.has(p)
          return (
            <button
              key={p}
              type="button"
              className="btn ghost"
              style={{
                padding: '5px 10px',
                fontSize: 11.5,
                borderColor: on ? 'var(--gold-line)' : undefined,
                color: on ? 'var(--text)' : undefined,
              }}
              title={
                p === 'GENERIC'
                  ? 'the shared text platforms fall back to'
                  : `${PLATFORMS[p].label} gets its own variant`
              }
              onClick={() => togglePlatform(p)}
            >
              {p === 'GENERIC' ? <GenericChip /> : <PlatformChip platform={p} />}
            </button>
          )
        })}
      </div>
      <span className="hint" style={{ display: 'block', marginTop: 6 }}>
        Every checked entry gets its own variant — Generic is the text the others fall back to.
        {platforms.has('REDDIT') && ' Reddit also gets a title (required there).'}
      </span>
    </div>
  )

  const actionsRow = (
    <div className="btn-row" style={{ marginTop: 12 }}>
      <button className="btn primary" onClick={() => void doGenerate()} disabled={generateDisabled}>
        {busy ? <Spinner /> : <Icon name="ai" />}
        {busy ? 'Generating…' : 'Generate'}
      </button>
      {busy && (
        <span className="hint" style={{ alignSelf: 'center' }}>
          can take up to a minute at higher reasoning effort
        </span>
      )}
    </div>
  )

  const errorBlock = error != null && <InlineError error={error} />

  const variants: Array<{ tab: PreviewTab; content: GeneratedTextDto }> = []
  if (result?.content) variants.push({ tab: 'GENERIC', content: result.content })
  for (const p of PLATFORM_LIST) {
    const g = result?.overrides[p]
    if (g) variants.push({ tab: p, content: g })
  }

  const resultsCard = result && (
    <div className="card pad">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <b>Generated</b>
        <span className="meta mono" style={{ color: 'var(--text-mute)', fontSize: 11 }}>
          via {result.provider} · {result.model} ·{' '}
          {result.usage.inputTokens.toLocaleString('en-US')} in /{' '}
          {result.usage.outputTokens.toLocaleString('en-US')} out tokens
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {onApply ? (
            <button className="btn primary" onClick={() => onApply(result, 'all')}>
              Apply all
            </button>
          ) : (
            <button className="btn primary" onClick={() => onOpenInEditor?.(seedFrom(result))}>
              <Icon name="edit" /> Open in post editor
            </button>
          )}
        </span>
      </div>
      <p className="hint" style={{ margin: '6px 0 12px' }}>
        {onApply
          ? 'Applied straight into the draft — nothing is posted automatically.'
          : 'Not saved anywhere yet — it becomes a draft once you open it in the editor.'}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {variants.map(({ tab, content }) => (
          <VariantBlock
            key={tab}
            tab={tab}
            content={content}
            onApply={onApply ? () => onApply(result, tab) : undefined}
          />
        ))}
      </div>
    </div>
  )

  return (
    <>
      <SectionHead
        title="Generate post text"
        hint="AI only generates text — images stay manual for now"
      />
      {draftToggle}
      <div className="composer-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card pad">
            {promptField}
            {constraintsRow}
            {actionsRow}
            {errorBlock}
          </div>
          {result?.note && (
            <Callout tone="warn">
              <b>Note from the model:</b> {result.note}
            </Callout>
          )}
        </div>
        <div className="card pad">
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Provider &amp; model
          </div>
          {providerField}
          {modelField}
          {effortField}
          <div style={{ height: 8 }} />
          {platformsBlock}
        </div>
        {resultsCard && <div style={{ gridColumn: '1 / -1' }}>{resultsCard}</div>}
      </div>
    </>
  )
}
