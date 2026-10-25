import { useState } from 'react'
import {
  adminApi,
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
 * The whole set is replaced on save — leave a field blank to clear that
 * override back to the config value; actual values are never returned,
 * only per-field "set" flags.
 */
export function AdminSettingsModal({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const { data, error, loading, refetch } = useApiQuery(() => adminApi.status(), ['admin-settings'])
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<unknown>(null)

  const set = (provider: OAuthProviderKey, field: FieldKey, value: string) =>
    setValues((v) => ({ ...v, [`${provider}.${field}`]: value }))

  const save = async () => {
    setFormError(null)
    // Whole-blob replace: only non-empty inputs become overrides; everything
    // else (including previously stored ones) clears back to config values.
    const overrides: Parameters<typeof adminApi.putSettings>[0] = {}
    for (const p of PROVIDERS) {
      const clientId = (values[`${p.key}.clientId`] ?? '').trim()
      const clientSecret = (values[`${p.key}.clientSecret`] ?? '').trim()
      if (clientId || clientSecret) {
        overrides[p.key] = {
          ...(clientId ? { clientId } : {}),
          ...(clientSecret ? { clientSecret } : {}),
        }
      }
    }
    setSaving(true)
    try {
      await adminApi.putSettings(overrides)
      const count = Object.values(overrides).reduce(
        (n, o) => n + (o?.clientId ? 1 : 0) + (o?.clientSecret ? 1 : 0),
        0,
      )
      toast(
        count
          ? `Saved — ${count} override${count === 1 ? '' : 's'} stored, the rest use config values`
          : 'Saved — all overrides cleared, using config values',
      )
      setValues({})
      refetch()
    } catch (e) {
      setFormError(e)
      toast(describeError(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  const statusOf = (status: AdminSettingsStatus, provider: OAuthProviderKey, field: FieldKey) =>
    status[provider][field === 'clientId' ? 'clientIdSet' : 'clientSecretSet']

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
          <button className="btn primary" onClick={() => void save()} disabled={saving || loading}>
            {saving ? <Spinner /> : 'Save'}
          </button>
        </>
      }
    >
      <Callout>
        A stored override wins over the yaml/env value. <b>Saving replaces the whole set</b> — a
        field left blank clears its override back to the config value. Saved values are encrypted
        and never shown again.
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
                  const isSet = statusOf(data, p.key, field)
                  return (
                    <label className="field" key={field}>
                      <span className="lab" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ flex: 1 }}>{FIELD_LABELS[field]}</span>
                        <Pill value={isSet ? 'SUCCESS' : 'DRAFT'} label={isSet ? 'override set' : 'from config'} />
                      </span>
                      <input
                        type={field === 'clientSecret' ? 'password' : 'text'}
                        value={values[`${p.key}.${field}`] ?? ''}
                        autoComplete="off"
                        onChange={(e) => set(p.key, field, e.target.value)}
                        placeholder={
                          isSet
                            ? 'override stored — type to replace, leave blank to clear'
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
