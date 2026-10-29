import { useState } from 'react'
import {
  adminApi,
  type AdminSettingsOverride,
  type AdminSettingsStatus,
  type OAuthProviderKey,
} from '../api/admin'
import { useApiQuery } from '../hooks/useApiQuery'
import { useToast } from '../hooks/useToast'
import { describeError } from '../lib/errors'
import { Callout, InlineError, Loading, Modal, Pill, Spinner } from './ui'

/** OAuth providers with overridable app credentials, in display order. */
const PROVIDERS: Array<{ key: OAuthProviderKey; label: string }> = [
  { key: 'facebook', label: 'Facebook' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'x', label: 'X' },
]

type FieldKey = 'clientId' | 'clientSecret'

const FIELD_LABELS: Record<FieldKey, string> = {
  clientId: 'Client ID',
  clientSecret: 'Client secret',
}

/**
 * Runtime overrides for the OAuth app credentials (/api/admin/settings).
 * Per-field patch semantics: a non-empty value sets/replaces the override,
 * an explicit "" clears it back to the config value, and an omitted field is
 * left untouched. Actual values are never returned, only per-field "set" flags.
 */
export function AdminSettingsModal({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const { data, error, loading, refetch } = useApiQuery(() => adminApi.status(), ['admin-settings'])
  const [values, setValues] = useState<Record<string, string>>({})
  const [clears, setClears] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<unknown>(null)

  const fieldKey = (provider: OAuthProviderKey, field: FieldKey) => `${provider}.${field}`

  const set = (provider: OAuthProviderKey, field: FieldKey, value: string) => {
    const key = fieldKey(provider, field)
    setValues((v) => ({ ...v, [key]: value }))
    // Typing means "replace", so a pending clear mark is moot.
    setClears((c) => {
      if (!c.has(key)) return c
      const next = new Set(c)
      next.delete(key)
      return next
    })
  }

  const toggleClear = (provider: OAuthProviderKey, field: FieldKey) =>
    setClears((c) => {
      const next = new Set(c)
      const key = fieldKey(provider, field)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const dirty = PROVIDERS.some((p) =>
    (['clientId', 'clientSecret'] as const).some((f) => {
      const key = fieldKey(p.key, f)
      return (values[key] ?? '').trim() !== '' || clears.has(key)
    }),
  )

  const save = async () => {
    setFormError(null)
    // Per-field patch: a non-empty input sets/replaces, a marked field sends
    // "" to clear, anything else is omitted and left untouched by the backend.
    const overrides: Parameters<typeof adminApi.putSettings>[0] = {}
    let stored = 0
    let cleared = 0
    for (const p of PROVIDERS) {
      const entry: AdminSettingsOverride = {}
      for (const field of ['clientId', 'clientSecret'] as const) {
        const key = fieldKey(p.key, field)
        const value = (values[key] ?? '').trim()
        if (value) {
          entry[field] = value
          stored++
        } else if (clears.has(key)) {
          entry[field] = ''
          cleared++
        }
      }
      if (entry.clientId !== undefined || entry.clientSecret !== undefined) {
        overrides[p.key] = entry
      }
    }
    setSaving(true)
    try {
      await adminApi.putSettings(overrides)
      toast(
        stored && cleared
          ? `Saved — ${stored} override${stored === 1 ? '' : 's'} stored, ${cleared} cleared`
          : stored
            ? `Saved — ${stored} override${stored === 1 ? '' : 's'} stored`
            : `Saved — ${cleared} override${cleared === 1 ? '' : 's'} cleared`,
      )
      setValues({})
      setClears(new Set())
      refetch()
    } catch (e) {
      setFormError(e)
      toast(describeError(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  const statusOf = (status: AdminSettingsStatus, provider: OAuthProviderKey, field: FieldKey) =>
    status[provider][field === 'clientId' ? 'clientIdOverridden' : 'clientSecretOverridden']

  return (
    <Modal
      title="Admin settings"
      sub="OAuth app credentials — runtime overrides"
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={() => void save()}
            disabled={saving || loading || !dirty}
          >
            {saving ? <Spinner /> : 'Save'}
          </button>
        </>
      }
    >
      <Callout>
        These values can also be set in a config file by server admin. However, the values set here
        override those set by the admin.
        <br/><br/>
        Saved values are encrypted and never shown again.
      </Callout>

      {loading && !data ? (
        <div style={{ marginTop: 14 }}>
          <Loading />
        </div>
      ) : error && !data ? (
        <div style={{ marginTop: 14 }}>
          <InlineError error={error} />
        </div>
      ) : (
        data && (
          <div style={{ marginTop: 14 }}>
            {PROVIDERS.map((p) => (
              <div key={p.key} style={{ marginBottom: 14 }}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>
                  {p.label}
                </div>
                {(['clientId', 'clientSecret'] as const).map((field) => {
                  const key = fieldKey(p.key, field)
                  const isSet = statusOf(data, p.key, field)
                  const willClear = clears.has(key)
                  return (
                    <label className="field" key={field}>
                      <span className="lab" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ flex: 1 }}>{FIELD_LABELS[field]}</span>
                        <Pill
                          value={isSet && !willClear ? 'SUCCESS' : 'DRAFT'}
                          label={willClear ? 'clears on save' : isSet ? 'override set' : 'from config'}
                        />
                        {isSet && (
                          <button
                            type="button"
                            className="btn ghost"
                            style={{ padding: '4px 10px', fontSize: 11, flex: 'none' }}
                            onClick={() => toggleClear(p.key, field)}
                            disabled={saving || loading}
                          >
                            {willClear ? 'keep' : 'clear'}
                          </button>
                        )}
                      </span>
                      <input
                        type={field === 'clientSecret' ? 'password' : 'text'}
                        value={values[key] ?? ''}
                        autoComplete="off"
                        onChange={(e) => set(p.key, field, e.target.value)}
                        placeholder={
                          willClear
                            ? 'marked to clear on Save'
                            : isSet
                              ? 'override stored — type to replace it'
                              : 'not set — type to override the config value'
                        }
                      />
                    </label>
                  )
                })}
              </div>
            ))}
          </div>
        )
      )}

      {formError != null && (
        <div style={{ marginTop: 12 }}>
          <InlineError error={formError} />
        </div>
      )}
    </Modal>
  )
}
