import { useState } from 'react'
import { aiApi } from '../api/ai'
import type { GeneratePlatform } from '../api/types'
import { useApiQuery } from '../hooks/useApiQuery'
import { useToast } from '../hooks/useToast'
import { Callout, ErrorBlock, InlineError, Loading, SectionHead, Spinner } from './ui'
import { PLATFORMS, PLATFORM_LIST } from '../lib/platform'

const SETTINGS_PLATFORMS: GeneratePlatform[] = ['GENERIC', ...PLATFORM_LIST]

/**
 * Per-platform AI style rules — the Settings tab on the /ai page and the
 * "AI Settings" tab on the post editor. Full replace on save; a blank value
 * resets that platform to its built-in default.
 */
export function GenerationSettingsPanel() {
  const toast = useToast()
  const { data, error, loading, refetch } = useApiQuery(
    () => aiApi.generationSettings(),
    ['ai-generation-settings'],
  )
  /** Local edits layered over the effective rules; untouched platforms absent. */
  const [edits, setEdits] = useState<Partial<Record<GeneratePlatform, string>>>({})
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<unknown>(null)

  if (loading && !data) return <Loading />
  if (error && !data) return <ErrorBlock error={error} onRetry={refetch} />

  const effective = (p: GeneratePlatform) => edits[p] ?? data!.platformRules[p] ?? ''
  const isDefault = (p: GeneratePlatform) => effective(p) === (data!.defaults[p] ?? '')
  const dirty = SETTINGS_PLATFORMS.some(
    (p) => p in edits && edits[p] !== (data!.platformRules[p] ?? ''),
  )

  const save = async () => {
    setFormError(null)
    setBusy(true)
    try {
      // Full replace; a blank value resets that platform to its built-in default.
      await aiApi.updateGenerationSettings(
        Object.fromEntries(
          SETTINGS_PLATFORMS.map((p) => [p, effective(p).trim() || null]),
        ) as Record<GeneratePlatform, string | null>,
      )
      toast('Style rules saved')
      setEdits({})
      refetch()
    } catch (e) {
      setFormError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <SectionHead
        title="Generation settings"
        hint="the style half of each platform's rule in the AI's system prompt"
        actions={
          <button className="btn primary" onClick={() => void save()} disabled={busy || !dirty}>
            {busy ? <Spinner /> : 'Save rules'}
          </button>
        }
      />
      <div className="card pad">
        {SETTINGS_PLATFORMS.map((p) => (
          <label className="field" key={p}>
            <span className="lab" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1 }}>
                {p === 'GENERIC' ? 'Generic' : PLATFORMS[p].label} style
                {!isDefault(p) && (
                  <span className="pill p-scheduled" style={{ marginLeft: 6 }}>
                    <i />
                    custom
                  </span>
                )}
              </span>
              {!isDefault(p) && (
                <button
                  type="button"
                  className="btn ghost"
                  style={{ padding: '2px 8px', fontSize: 11 }}
                  onClick={(e) => {
                    e.preventDefault()
                    setEdits((ed) => ({ ...ed, [p]: data!.defaults[p] ?? '' }))
                  }}
                >
                  reset
                </button>
              )}
            </span>
            <textarea
              rows={2}
              maxLength={1000}
              value={effective(p)}
              onChange={(e) => setEdits((ed) => ({ ...ed, [p]: e.target.value }))}
            />
            <span className="hint" style={{ display: 'block', marginTop: 4 }}>
              {isDefault(p) ? 'the built-in default' : 'custom — reset to restore the default'}
            </span>
          </label>
        ))}
        {formError != null && <InlineError error={formError} />}
      </div>
      <div style={{ height: 14 }} />
      <Callout>
        <b>These are style rules, not limits.</b> The AI shapes every generated variant by them,
        but nothing is enforced — a style that exceeds a platform's real limits (like X's 280
        characters) simply produces posts the platform may reject at publish time.
      </Callout>
    </>
  )
}
