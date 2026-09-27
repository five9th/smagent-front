import { useState } from 'react'
import { accountsApi, type AccountInput } from '../api/accounts'
import type { AccountDto, Platform } from '../api/types'
import { Icon } from '../components/Icon'
import {
  Callout,
  ConfirmModal,
  ErrorBlock,
  Loading,
  Modal,
  Pill,
  PlatformChip,
  SectionHead,
  Spinner,
} from '../components/ui'
import { useApiQuery } from '../hooks/useApiQuery'
import { useToast } from '../hooks/useToast'
import { fmtDate } from '../lib/format'
import { PLATFORMS, PLATFORM_LIST } from '../lib/platform'

/* --- Add / edit modal ------------------------------------------------------ */

function AccountFormModal({
  account,
  onClose,
  onSaved,
}: {
  account: AccountDto | null // null → create
  onClose: () => void
  onSaved: (created: boolean) => void
}) {
  const toast = useToast()
  const [platform, setPlatform] = useState<Platform>(account?.platform ?? 'FACEBOOK')
  const [displayName, setDisplayName] = useState(account?.displayName ?? '')
  const [creds, setCreds] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fields = PLATFORMS[platform].credentialFields
  const editing = account !== null

  const submit = async () => {
    setError(null)
    try {
      if (editing) {
        // PUT: displayName and/or credentials; credentials are replaced wholesale.
        const filled = Object.fromEntries(
          fields.filter((f) => (creds[f.key] ?? '').trim() !== '').map((f) => [f.key, creds[f.key].trim()]),
        ) as Record<string, string>
        const anyFilled = Object.keys(filled).length > 0
        if (anyFilled && Object.keys(filled).length < fields.length) {
          setError('Fill in every credential field — updating credentials replaces them all at once.')
          return
        }
        await accountsApi.update(account.id, {
          displayName: displayName.trim() || undefined,
          ...(anyFilled ? { credentials: filled } : {}),
        })
        toast(anyFilled ? 'Account updated — status reset to UNVERIFIED, verify it again' : 'Account updated')
      } else {
        for (const f of fields) {
          if (!(creds[f.key] ?? '').trim()) {
            setError(`“${f.label}” is required for ${PLATFORMS[platform].label}.`)
            return
          }
        }
        const input: AccountInput = {
          platform,
          credentials: Object.fromEntries(fields.map((f) => [f.key, creds[f.key].trim()])),
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        }
        await accountsApi.create(input)
        toast(`${PLATFORMS[platform].label} account added — verify it to activate`)
      }
      onSaved(!editing)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={editing ? `Edit ${PLATFORMS[account.platform].label} account` : 'Connect social account'}
      sub={editing ? `account #${account.id}` : 'credentials are encrypted at rest and only shown masked'}
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => void submit()} disabled={busy}>
            {busy ? <Spinner /> : editing ? 'Save' : 'Add account'}
          </button>
        </>
      }
    >
      <label className="field">
        <span className="lab">Platform</span>
        <select
          value={platform}
          disabled={editing}
          onChange={(e) => {
            setPlatform(e.target.value as Platform)
            setCreds({})
          }}
        >
          {PLATFORM_LIST.map((p) => (
            <option key={p} value={p}>
              {PLATFORMS[p].label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="lab">Display name (optional — filled by verify)</span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={platform === 'FACEBOOK' ? 'My Page' : 'u/me → r/test'}
        />
      </label>

      <div className="eyebrow" style={{ margin: '14px 0 8px' }}>
        {PLATFORMS[platform].label} credentials
      </div>
      {fields.map((f) => (
        <label className="field" key={f.key}>
          <span className="lab">
            {f.label}
            {!editing && <span style={{ color: 'var(--text-mute)' }}> — required</span>}
          </span>
          <input
            type={f.secret ? 'password' : 'text'}
            value={creds[f.key] ?? ''}
            autoComplete="off"
            onChange={(e) => setCreds((c) => ({ ...c, [f.key]: e.target.value }))}
            placeholder={editing ? `unchanged (${account.credentialsMasked?.[f.key] ?? 'not set'})` : f.placeholder}
          />
          {f.hint && (
            <span className="hint" style={{ display: 'block', marginTop: 4 }}>
              {f.hint}
            </span>
          )}
        </label>
      ))}
      {editing && (
        <Callout>
          Updating credentials <b>replaces them all</b> and resets the account to <b>UNVERIFIED</b>. Leave every
          field blank to keep the current ones.
        </Callout>
      )}
      {error && (
        <p className="errtext" style={{ margin: '10px 0 0' }}>
          {error}
        </p>
      )}
    </Modal>
  )
}

/* --- Main view ------------------------------------------------------------- */

export default function AccountsView() {
  const toast = useToast()
  const { data, error, loading, refetch } = useApiQuery(() => accountsApi.list(), ['accounts'])
  const [formOpen, setFormOpen] = useState<AccountDto | null | 'new'>(null)
  const [verifying, setVerifying] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<AccountDto | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const accounts = data ?? []

  const verify = async (account: AccountDto) => {
    setVerifying(account.id)
    try {
      const res = await accountsApi.verify(account.id)
      if (res.ok) toast(`${account.displayName ?? 'Account'} verified — ${res.message}`)
      else toast(`Verify failed — ${res.message}`, 'error')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Verify failed', 'error')
    } finally {
      setVerifying(null)
      refetch()
    }
  }

  const doDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await accountsApi.remove(deleting.id)
      toast('Account deleted')
      setDeleting(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed', 'error')
    } finally {
      setDeleteBusy(false)
      refetch()
    }
  }

  if (loading && !data) return <Loading />
  if (error && !data) return <ErrorBlock message={error} onRetry={refetch} />

  return (
    <>
      <SectionHead
        title="Connected accounts"
        hint="credentials encrypted at rest · secrets never leave the server unmasked"
        actions={
          <button className="btn primary" onClick={() => setFormOpen('new')}>
            <Icon name="plus" />
            Add account
          </button>
        }
      />

      <div className="grid cols-2">
        {accounts.map((a) => (
          <div className="card pad" key={a.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <PlatformChip platform={a.platform} lg />
              <div style={{ minWidth: 0 }}>
                <b>{a.displayName ?? `account #${a.id}`}</b>
                <div className="meta mono" style={{ color: 'var(--text-mute)', fontSize: 11 }}>
                  added {fmtDate(a.createdAt)}
                </div>
              </div>
              <span style={{ marginLeft: 'auto' }}>
                <Pill value={a.status} />
              </span>
            </div>
            <div className="kv">
              {Object.entries(a.credentialsMasked ?? {}).map(([k, v]) => (
                <div key={k} style={{ display: 'contents' }}>
                  <span className="k mono" style={{ fontSize: 11 }}>{k}</span>
                  <span className="v mono" style={{ fontSize: 11 }}>{v}</span>
                </div>
              ))}
            </div>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => void verify(a)} disabled={verifying === a.id}>
                {verifying === a.id ? <Spinner /> : <Icon name="refresh" />}
                Verify
              </button>
              <button className="btn ghost" onClick={() => setFormOpen(a)}>
                <Icon name="edit" />
                Edit
              </button>
              <button className="btn danger" onClick={() => setDeleting(a)}>
                <Icon name="trash" />
                Remove
              </button>
            </div>
          </div>
        ))}
        {!accounts.length && (
          <div className="card pad" style={{ gridColumn: '1 / -1' }}>
            <div className="empty">
              No social accounts connected. Add a Facebook Page (or Reddit) account to start publishing.
            </div>
          </div>
        )}
      </div>

      <Callout tone="warn">
        <b>Reddit is currently unusable:</b> Reddit closed free API access, so credentials can’t be obtained
        right now. The adapter is implemented — adding a Reddit account works, but verify/publish will fail
        until Reddit reopens access.
      </Callout>
      <div style={{ height: 14 }} />
      <Callout>
        <b>How verify works:</b> it performs a cheap “who am I” call against the platform and updates the
        account status — <span className="pill p-approved"><i />active</span> when the credentials work,{' '}
        <span className="pill p-failed"><i />invalid</span> when they don’t (with the platform’s error
        message). Facebook verifies with a long-lived Page access token — see the backend README for the
        walkthrough.
      </Callout>

      {formOpen !== null && (
        <AccountFormModal
          account={formOpen === 'new' ? null : formOpen}
          onClose={() => setFormOpen(null)}
          onSaved={() => {
            setFormOpen(null)
            refetch()
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Remove account"
          message={
            <>
              Remove <b>{deleting.displayName ?? `account #${deleting.id}`}</b> ({PLATFORMS[deleting.platform].label})?
              Its publication history rows are removed as well — the posts themselves stay, but you’ll no longer
              see which account published them.
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
