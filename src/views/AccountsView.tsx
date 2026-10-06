import { useState } from 'react'
import { accountsApi, type AccountInput } from '../api/accounts'
import type { AccountDto, AuthMethod, Platform } from '../api/types'
import { Icon } from '../components/Icon'
import {
  Callout,
  ConfirmModal,
  ErrorBlock,
  InlineError,
  Linkify,
  Loading,
  Modal,
  Pill,
  PlatformChip,
  SectionHead,
  Spinner,
} from '../components/ui'
import { useApiQuery } from '../hooks/useApiQuery'
import { useToast } from '../hooks/useToast'
import { describeError } from '../lib/errors'
import { fmtDate } from '../lib/format'
import { AUTH_METHOD_LABELS, PLATFORMS, PLATFORM_LIST, defaultLoginOption } from '../lib/platform'

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
  const [authMethod, setAuthMethod] = useState<AuthMethod>(
    account?.authMethod ?? defaultLoginOption('FACEBOOK').authMethod,
  )
  const [displayName, setDisplayName] = useState(account?.displayName ?? '')
  const [creds, setCreds] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const loginOption = PLATFORMS[platform].loginOptions.find((o) => o.authMethod === authMethod)
    ?? defaultLoginOption(platform)
  const fields = loginOption.fields
  const editing = account !== null
  /** Switching the login option requires entering new credentials (backend rule). */
  const methodChanged = editing && authMethod !== account.authMethod

  const submit = async () => {
    setError(null)
    try {
      if (editing) {
        // PUT: displayName and/or credentials; credentials are replaced wholesale,
        // and the login option may only be switched together with new credentials.
        const filled = Object.fromEntries(
          fields.filter((f) => (creds[f.key] ?? '').trim() !== '').map((f) => [f.key, creds[f.key].trim()]),
        ) as Record<string, string>
        const anyFilled = Object.keys(filled).length > 0
        if (methodChanged && !anyFilled) {
          setError(`Switching the login option needs the new credentials — fill in “${fields[0].label}” and the rest.`)
          return
        }
        if (anyFilled && Object.keys(filled).length < fields.length) {
          setError('Fill in every credential field — updating credentials replaces them all at once.')
          return
        }
        await accountsApi.update(account.id, {
          displayName: displayName.trim() || undefined,
          ...(anyFilled || methodChanged ? { credentials: filled, authMethod } : {}),
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
          authMethod,
          credentials: Object.fromEntries(fields.map((f) => [f.key, creds[f.key].trim()])),
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        }
        await accountsApi.create(input)
        toast(
          loginOption.canPublish
            ? `${PLATFORMS[platform].label} account added — verify it to activate`
            : `${PLATFORMS[platform].label} link added — publishing will open it for you to post by hand`,
        )
      }
      onSaved(!editing)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={editing ? `Edit ${PLATFORMS[account.platform].label} account` : 'Connect social account'}
      sub={editing ? `account #${account.id}` : 'your credentials are stored securely and only ever shown partially'}
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
            const next = e.target.value as Platform
            setPlatform(next)
            setAuthMethod(defaultLoginOption(next).authMethod)
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
        <span className="lab">Login option</span>
        <select
          value={authMethod}
          onChange={(e) => {
            setAuthMethod(e.target.value as AuthMethod)
            setCreds({})
          }}
        >
          {PLATFORMS[platform].loginOptions.map((o) => (
            <option key={o.authMethod} value={o.authMethod}>
              {AUTH_METHOD_LABELS[o.authMethod]}
              {o.canPublish ? '' : ' (manual)'}
            </option>
          ))}
        </select>
        {!loginOption.canPublish && (
          <span className="hint" style={{ display: 'block', marginTop: 4 }}>
            No automatic posting with this option — the account is a link you open to create posts by hand.
          </span>
        )}
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
      <p className="hint" style={{ margin: '10px 0 0' }}>
        Credentials are entered manually for now — other login options may be added later.
      </p>
      {editing && (
        <Callout>
          Updating credentials <b>replaces all of them</b>, and the account will need to be verified again.
          Leave every field blank to keep the current ones — but switching the login option always requires
          the new credentials.
        </Callout>
      )}
      {error != null && <InlineError error={error} />}
    </Modal>
  )
}

/* --- Main view ------------------------------------------------------------- */

export default function AccountsView() {
  const toast = useToast()
  const [showDeleted, setShowDeleted] = useState(false)
  const { data, error, loading, refetch } = useApiQuery(
    () => accountsApi.list(showDeleted),
    ['accounts', showDeleted],
  )
  const [formOpen, setFormOpen] = useState<AccountDto | null | 'new'>(null)
  const [verifying, setVerifying] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<AccountDto | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const accounts = data ?? []

  const verify = async (account: AccountDto) => {
    setVerifying(account.id)
    try {
      const res = await accountsApi.verify(account.id)
      if (res.ok) toast(`${account.displayName ?? 'Account'} verified successfully`)
      else toast({ title: 'Verification failed', detail: res.message }, 'error')
    } catch (e) {
      toast(describeError(e), 'error')
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
      toast(describeError(e), 'error')
    } finally {
      setDeleteBusy(false)
      refetch()
    }
  }

  if (loading && !data) return <Loading />
  if (error && !data) return <ErrorBlock error={error} onRetry={refetch} />

  return (
    <>
      <SectionHead
        title="Connected accounts"
        hint="your credentials are stored securely and never shown in full"
        actions={
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text-dim)', cursor: 'pointer' }}>
              <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
              Show deleted
            </label>
            <button className="btn primary" onClick={() => setFormOpen('new')}>
              <Icon name="plus" />
              Add account
            </button>
          </>
        }
      />

      <div className="grid cols-2">
        {accounts.map((a) => (
          <div className="card pad" key={a.id} style={a.deletedAt ? { opacity: 0.55 } : undefined}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <PlatformChip platform={a.platform} lg />
              <div style={{ minWidth: 0 }}>
                <b>{a.displayName ?? `account #${a.id}`}</b>
                <div className="meta mono" style={{ color: 'var(--text-mute)', fontSize: 11 }}>
                  via {AUTH_METHOD_LABELS[a.authMethod].toLowerCase()} · added {fmtDate(a.createdAt)}
                  {a.deletedAt && ` · deleted ${fmtDate(a.deletedAt)}`}
                </div>
              </div>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {!a.canPublish && <Pill value="MANUAL" />}
                {a.deletedAt && <Pill value="DRAFT" label="deleted" />}
                <Pill value={a.status} />
              </span>
            </div>
            <div className="kv">
              {Object.entries(a.credentialsMasked ?? {}).map(([k, v]) => (
                <div key={k} style={{ display: 'contents' }}>
                  <span className="k mono" style={{ fontSize: 11 }}>{k}</span>
                  <span className="v mono" style={{ fontSize: 11 }}>
                    {/^https?:\/\//.test(v) ? <Linkify text={v} /> : v}
                  </span>
                </div>
              ))}
              {!Object.keys(a.credentialsMasked ?? {}).length && (
                <span className="k">credentials</span>
              )}
              {!Object.keys(a.credentialsMasked ?? {}).length && (
                <span className="v mono" style={{ fontSize: 11 }}>removed on delete</span>
              )}
            </div>
            {!a.deletedAt && (
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
            )}
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
        <b>Reddit is temporarily unavailable.</b> Reddit has closed its free API, so Reddit credentials
        can’t be set up right now. You can save a Reddit account, but connecting to it or posting to it
        won’t work until Reddit reopens access.
      </Callout>
      <div style={{ height: 14 }} />
      <Callout>
        <b>What “Verify” does:</b> it checks the account against the platform right away — it turns{' '}
        <span className="pill p-approved"><i />active</span> when the credentials work, or{' '}
        <span className="pill p-failed"><i />invalid</span> with the platform’s error message when they
        don’t. Facebook accounts use a long-lived Page access token — the project README explains how to
        get one.
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
              It will disappear from the app and its stored credentials are <b>erased</b>. Posts already
              published through it keep their history — including which account they were posted to.
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
