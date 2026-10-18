import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { aiApi, type CreateAiProviderInput, type UpdateAiProviderInput } from '../api/ai'
import type { AiProviderDto, AiProviderType } from '../api/types'
import { GeneratePanel, type AiDraftSeed } from '../components/GeneratePanel'
import { Icon } from '../components/Icon'
import { ValuePicker, type Suggestion } from '../components/ValuePicker'
import {
  Callout,
  ConfirmModal,
  ErrorBlock,
  InlineError,
  Loading,
  Modal,
  SectionHead,
  Spinner,
} from '../components/ui'
import { useApiQuery } from '../hooks/useApiQuery'
import { useToast } from '../hooks/useToast'
import { describeError } from '../lib/errors'
import { fmtDate } from '../lib/format'

const AI_TYPE_LABELS: Record<AiProviderType, string> = {
  ANTHROPIC: 'Anthropic',
  OPENAI_COMPATIBLE: 'OpenAI-compatible',
}

/**
 * Placeholder that satisfies creation's required defaultModel until the user
 * picks a real one from the auto-opened edit dialog's models listing.
 */
const PLACEHOLDER_MODEL = 'not-chosen'

/* --- Add / edit modal ------------------------------------------------------ */

function ProviderFormModal({
  provider,
  onClose,
  onSaved,
}: {
  provider: AiProviderDto | null // null → create
  onClose: () => void
  /**
   * Called after a successful save. Carries the created provider when its
   * defaultModel was a placeholder — the parent then reopens the dialog in
   * edit mode so the real default gets picked from the models listing.
   */
  onSaved: (created?: AiProviderDto) => void
}) {
  const toast = useToast()
  const editing = provider !== null
  const [name, setName] = useState(provider?.name ?? '')
  const [type, setType] = useState<AiProviderType>(provider?.type ?? 'ANTHROPIC')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? '')
  // Still on the creation placeholder → start empty so the models dropdown
  // (not an input pre-filled with "nomodel") is what greets the user.
  const [defaultModel, setDefaultModel] = useState(
    provider?.defaultModel === PLACEHOLDER_MODEL ? '' : provider?.defaultModel ?? '',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  // Suggestion lists for the pickers: well-known API roots for the chosen
  // type, and (when editing) the provider's live model ids — the two-step
  // defaultModel flow: create with a placeholder, then Edit and pick.
  const baseUrlsQuery = useApiQuery(() => aiApi.baseUrls(type), ['ai-baseurls', type])
  const baseUrlSuggestions: Suggestion[] = Object.entries(baseUrlsQuery.data ?? {}).map(
    ([label, url]) => ({ value: url, label: `${label} (${url})` }),
  )
  const modelsQuery = useApiQuery(
    () => (editing ? aiApi.models(provider.id) : Promise.resolve([] as string[])),
    ['ai-models', editing ? provider.id : null],
  )
  const modelSuggestions: Suggestion[] = (modelsQuery.data ?? []).map((m) => ({
    value: m,
    label: m,
  }))

  const submit = async () => {
    setError(null)
    if (!name.trim() || (!editing && !apiKey.trim())) {
      setError('Name and API key are required.')
      return
    }
    // Backend rule: defaultModel can be replaced but never cleared.
    if (editing && !defaultModel.trim()) {
      setError('Pick a default model — it can only be replaced, never cleared.')
      return
    }
    setBusy(true)
    try {
      let reopen: AiProviderDto | undefined
      if (editing) {
        // Absent = keep; a blank key keeps the stored one; baseUrl/defaultModel
        // are only sent when they changed (baseUrl "" clears; defaultModel can
        // only be replaced — the required check above keeps it non-blank).
        const input: UpdateAiProviderInput = {
          ...(name.trim() !== provider.name ? { name: name.trim() } : {}),
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          ...(baseUrl.trim() !== (provider.baseUrl ?? '')
            ? { baseUrl: baseUrl.trim() }
            : {}),
          ...(defaultModel.trim() !== (provider.defaultModel ?? '')
            ? { defaultModel: defaultModel.trim() }
            : {}),
        }
        await aiApi.update(provider.id, input)
        toast('Provider updated')
      } else {
        const placeholderModel = !defaultModel.trim()
        const input: CreateAiProviderInput = {
          name: name.trim(),
          type,
          apiKey: apiKey.trim(),
          // Required backend-side — a placeholder passes creation; the
          // auto-opened edit step replaces it with the picked model.
          defaultModel: defaultModel.trim() || PLACEHOLDER_MODEL,
          ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
        }
        const created = await aiApi.create(input)
        if (placeholderModel) reopen = created
        toast(
          placeholderModel
            ? 'Provider added — now pick its default model from the list'
            : 'Provider added — verify the key to confirm it works',
        )
      }
      onSaved(reopen)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={editing ? `Edit ${provider.name}` : 'Add AI provider'}
      sub={editing ? `provider #${provider.id}` : 'the key is stored encrypted and only ever shown partially'}
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => void submit()} disabled={busy}>
            {busy ? <Spinner /> : editing ? 'Save' : 'Add provider'}
          </button>
        </>
      }
    >
      <label className="field">
        <span className="lab">Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Anthropic main"
        />
      </label>
      <label className="field">
        <span className="lab">Type</span>
        <select
          value={type}
          disabled={editing}
          onChange={(e) => {
            const next = e.target.value as AiProviderType
            setType(next)
            // The URL convention differs per type — don't carry a value over.
            if (!editing) setBaseUrl('')
          }}
        >
          {(Object.keys(AI_TYPE_LABELS) as AiProviderType[]).map((t) => (
            <option key={t} value={t}>
              {AI_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        {editing && (
          <span className="hint" style={{ display: 'block', marginTop: 4 }}>
            The provider type can’t be changed after creation.
          </span>
        )}
      </label>
      <label className="field">
        <span className="lab">API key{editing ? ' — leave blank to keep the current one' : ''}</span>
        <input
          type="password"
          value={apiKey}
          autoComplete="off"
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={editing ? `unchanged (${provider.apiKeyMasked})` : 'sk-ant-… / sk-or-…'}
        />
      </label>
      <label className="field">
        <span className="lab">Default model — used when a request doesn’t name one</span>
        {editing ? (
          <>
            <ValuePicker
              value={defaultModel}
              onChange={setDefaultModel}
              suggestions={modelSuggestions}
              placeholder="model id"
              emptyLabel="pick a model…"
            />
            {modelsQuery.error != null && (
              <span className="hint" style={{ display: 'block', marginTop: 4 }}>
                Couldn’t list this provider’s models — type the id manually.
              </span>
            )}
          </>
        ) : (
          <>
            <input
              type="text"
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              placeholder="e.g. claude-sonnet-5"
            />
            <span className="hint" style={{ display: 'block', marginTop: 4 }}>
              Leave blank to choose from available models on the next step.
            </span>
          </>
        )}
      </label>
      <label className="field">
        <span className="lab">Base URL (optional)</span>
        <ValuePicker
          value={baseUrl}
          onChange={setBaseUrl}
          suggestions={baseUrlSuggestions}
          placeholder={type === 'ANTHROPIC' ? 'https://your-anthropic-mirror' : 'https://host/v1'}
          emptyLabel="the type’s default endpoint"
        />
        <span className="hint" style={{ display: 'block', marginTop: 4 }}>
          {type === 'ANTHROPIC'
            ? 'Origin only — the /v1/… path is appended automatically.'
            : 'Full API root including the version path, e.g. https://api.openai.com/v1.'}
        </span>
      </label>
      {error != null && <InlineError error={error} />}
    </Modal>
  )
}

/* --- Main view ------------------------------------------------------------- */

export default function AiView() {
  const nav = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState<'providers' | 'generate'>('providers')
  const { data, error, loading, refetch } = useApiQuery(() => aiApi.list(), ['ai-providers'])
  const providers = data ?? []
  const [formOpen, setFormOpen] = useState<AiProviderDto | null | 'new'>(null)
  const [verifying, setVerifying] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<AiProviderDto | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const verify = async (provider: AiProviderDto) => {
    setVerifying(provider.id)
    try {
      const res = await aiApi.verify(provider.id)
      if (res.ok) toast(res.message)
      else toast({ title: 'Verification failed', detail: res.message }, 'error')
    } catch (e) {
      toast(describeError(e), 'error')
    } finally {
      setVerifying(null)
    }
  }

  const doDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await aiApi.remove(deleting.id)
      toast('Provider deleted')
      setDeleting(null)
    } catch (e) {
      toast(describeError(e), 'error')
    } finally {
      setDeleteBusy(false)
      refetch()
    }
  }

  return (
    <>
      <SectionHead title="AI Assistant" hint="draft post text with your own AI provider" />
      <div className="tabs">
        <button className={tab === 'providers' ? 'active' : ''} onClick={() => setTab('providers')}>
          Providers
        </button>
        <button className={tab === 'generate' ? 'active' : ''} onClick={() => setTab('generate')}>
          Generate
        </button>
      </div>

      {tab === 'providers' ? (
        loading && !data ? (
          <Loading />
        ) : error && !data ? (
          <ErrorBlock error={error} onRetry={refetch} />
        ) : (
          <>
            <SectionHead
              title="AI providers"
              hint="keys are stored encrypted and never shown in full"
              actions={
                <button className="btn primary" onClick={() => setFormOpen('new')}>
                  <Icon name="plus" />
                  Add provider
                </button>
              }
            />
            <div className="grid cols-2">
              {providers.map((p) => (
                <div className="card pad" key={p.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span className="avatar">{p.name.charAt(0).toUpperCase()}</span>
                    <div style={{ minWidth: 0 }}>
                      <b>{p.name}</b>
                      <div className="meta mono" style={{ color: 'var(--text-mute)', fontSize: 11 }}>
                        {AI_TYPE_LABELS[p.type]} · added {fmtDate(p.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="kv">
                    <span className="k">API key</span>
                    <span className="v mono" style={{ fontSize: 11 }}>
                      {p.apiKeyMasked}
                    </span>
                    <span className="k">Base URL</span>
                    <span className="v mono" style={{ fontSize: 11 }}>
                      {p.baseUrl ?? 'official API'}
                    </span>
                    <span className="k">Default model</span>
                    <span className="v mono" style={{ fontSize: 11 }}>
                      {p.defaultModel ?? 'not set'}
                    </span>
                  </div>
                  <div className="btn-row" style={{ marginTop: 12 }}>
                    <button className="btn" onClick={() => void verify(p)} disabled={verifying === p.id}>
                      {verifying === p.id ? <Spinner /> : <Icon name="refresh" />}
                      Verify
                    </button>
                    <button className="btn ghost" onClick={() => setFormOpen(p)}>
                      <Icon name="edit" />
                      Edit
                    </button>
                    <button className="btn danger" onClick={() => setDeleting(p)}>
                      <Icon name="trash" />
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              {!providers.length && (
                <div className="card pad" style={{ gridColumn: '1 / -1' }}>
                  <div className="empty">
                    No AI providers yet. Add an Anthropic API key to start generating — the Generate
                    tab does the rest.
                  </div>
                </div>
              )}
            </div>
            <div style={{ height: 14 }} />
            <Callout>
              <b>What “Verify” does:</b> a cheap authenticated call against the provider (a models
              listing) — nothing is stored. Generation works regardless; verify is just a quick way
              to catch a mistyped key.
            </Callout>
          </>
        )
      ) : (
        <GeneratePanel
          providers={providers}
          loading={loading && !data}
          refreshProviders={refetch}
          onGoToProviders={() => setTab('providers')}
          onOpenInEditor={(seed: AiDraftSeed) => nav('/posts/new', { state: { aiDraft: seed } })}
        />
      )}

      {formOpen !== null && (
        <ProviderFormModal
          // The key forces a remount when the dialog reopens for a just-created
          // provider (new → edit) so the form state re-initializes from it.
          key={formOpen === 'new' ? 'new' : formOpen.id}
          provider={formOpen === 'new' ? null : formOpen}
          onClose={() => setFormOpen(null)}
          onSaved={(created) => {
            // Placeholder-defaultModel flow: hand the dialog over to the new
            // provider so the models listing can be picked from right away.
            setFormOpen(created ?? null)
            refetch()
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Remove provider"
          message={
            <>
              Remove <b>{deleting.name}</b>? The provider and its stored API key are deleted for
              good — nothing references a provider yet, so this can’t break anything else.
            </>
          }
          confirmLabel="Remove"
          danger
          busy={deleteBusy}
          onConfirm={() => void doDelete()}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  )
}
