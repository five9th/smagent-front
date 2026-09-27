import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { accountsApi } from '../api/accounts'
import { postsApi } from '../api/posts'
import type { AccountDto, Platform, PostDto, PostInput, PublishResult } from '../api/types'
import { Icon } from '../components/Icon'
import {
  Callout,
  ConfirmModal,
  ErrorBlock,
  Loading,
  Modal,
  Pill,
  PlatformChip,
  Spinner,
} from '../components/ui'
import { useApiQuery } from '../hooks/useApiQuery'
import { useToast } from '../hooks/useToast'
import { fmtDateTime } from '../lib/format'
import { PLATFORMS, PLATFORM_LIST } from '../lib/platform'

type Tab = 'GENERIC' | Platform

interface FormState {
  title: string
  text: string
  ovr: Record<Platform, string>
  ovrOn: Record<Platform, boolean>
}

const EMPTY_FORM: FormState = {
  title: '',
  text: '',
  ovr: { FACEBOOK: '', REDDIT: '' },
  ovrOn: { FACEBOOK: false, REDDIT: false },
}

function formFromPost(post: PostDto): FormState {
  return {
    title: post.title ?? '',
    text: post.text,
    ovr: {
      FACEBOOK: post.overrides?.FACEBOOK ?? '',
      REDDIT: post.overrides?.REDDIT ?? '',
    },
    ovrOn: {
      FACEBOOK: !!post.overrides?.FACEBOOK,
      REDDIT: !!post.overrides?.REDDIT,
    },
  }
}

/* --- Live preview --------------------------------------------------------- */

function PreviewCard({
  form,
  accounts,
  platform,
  onSelectPlatform,
}: {
  form: FormState
  accounts: AccountDto[]
  platform: Platform
  onSelectPlatform: (p: Platform) => void
}) {
  const meta = PLATFORMS[platform]
  const account = accounts.find((a) => a.platform === platform)
  const override = form.ovrOn[platform] && form.ovr[platform].trim()
  const text = override ? form.ovr[platform] : form.text
  const len = text.length
  const over = len > meta.maxLength

  return (
    <div className={`preview ${over ? 'over' : ''}`}>
      <div className="ph">
        <div className="av">{meta.label[0]}</div>
        <div>
          <div className="pn">{account?.displayName ?? meta.label}</div>
          <div className="pt">{meta.label} · preview</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {PLATFORM_LIST.map((p) => (
            <button
              key={p}
              className="btn ghost"
              style={{ padding: '4px 9px', fontSize: 11, opacity: p === platform ? 1 : 0.5 }}
              onClick={() => onSelectPlatform(p)}
              disabled={p === platform}
            >
              {PLATFORMS[p].label[0]}
            </button>
          ))}
        </div>
      </div>
      {form.title.trim() && (
        <div className="pbody" style={{ fontWeight: 600, marginBottom: 6 }}>
          {form.title}
        </div>
      )}
      <div className="pbody">
        {text || <span style={{ color: 'var(--text-mute)' }}>Nothing yet — start typing the generic text.</span>}
      </div>
      <div className="pcount">
        {len.toLocaleString('en-US')} / ~{meta.maxLength.toLocaleString('en-US')} chars
        {over && ` — ${len - meta.maxLength} over (soft limit, not enforced)`}
        {override ? ' · platform override' : ' · generic text'}
      </div>
    </div>
  )
}

/* --- Publish confirm / results modal -------------------------------------- */

function PublishModal({
  accounts,
  selected,
  form,
  publishing,
  results,
  onClose,
  onConfirm,
}: {
  accounts: AccountDto[]
  selected: number[]
  form: FormState
  publishing: boolean
  results: PublishResult | null
  onClose: () => void
  onConfirm: () => void
}) {
  const chosen = accounts.filter((a) => selected.includes(a.id))
  const redditNeedsTitle = chosen.some((a) => a.platform === 'REDDIT') && !form.title.trim()

  if (results) {
    const ok = results.results.filter((r) => r.status === 'SUCCESS').length
    return (
      <Modal
        title="Publish results"
        sub={`${ok}/${results.results.length} targets succeeded · post is ${results.postStatus}`}
        onClose={onClose}
        footer={
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        }
      >
        <div className="list" style={{ marginTop: -6 }}>
          {results.results.map((r) => (
            <div key={r.accountId} className="row plain" style={{ gridTemplateColumns: '1fr auto', padding: '11px 0' }}>
              <div style={{ minWidth: 0 }}>
                <div className="title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PlatformChip platform={r.platform} />
                  <span>{r.accountName}</span>
                </div>
                {r.errorMessage && (
                  <div className="errtext" style={{ marginTop: 3 }}>
                    {r.errorMessage}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {r.externalUrl && (
                  <a className="iconlink" href={r.externalUrl} target="_blank" rel="noreferrer" title="Open on platform">
                    <Icon name="external" />
                  </a>
                )}
                <Pill value={r.status} />
              </div>
            </div>
          ))}
        </div>
        {results.postStatus === 'DRAFT' && (
          <Callout tone="warn">
            The post stays a <b>draft</b> until at least one target succeeds — fix the errors and publish again.
          </Callout>
        )}
      </Modal>
    )
  }

  return (
    <Modal
      title="Publish post"
      sub="one attempt per account — a failing target never blocks the others"
      onClose={publishing ? undefined : onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose} disabled={publishing}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={onConfirm}
            disabled={publishing || chosen.length === 0 || redditNeedsTitle}
          >
            {publishing ? <Spinner /> : `Publish to ${chosen.length} account${chosen.length === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      {!chosen.length ? (
        <Callout tone="danger">
          <b>No target accounts selected.</b> Pick at least one in the “Target accounts” panel first.
        </Callout>
      ) : (
        <div className="list" style={{ marginTop: -6 }}>
          {chosen.map((a) => {
            const usesOverride = form.ovrOn[a.platform] && form.ovr[a.platform].trim()
            return (
              <div key={a.id} className="row plain" style={{ gridTemplateColumns: '1fr auto', padding: '11px 0' }}>
                <div>
                  <div className="title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <PlatformChip platform={a.platform} />
                    <span>{a.displayName ?? `account #${a.id}`}</span>
                  </div>
                  <div className="meta" style={{ marginTop: 2 }}>
                    will receive: {usesOverride ? `${PLATFORMS[a.platform].label} override` : 'generic text'}
                    {a.status !== 'ACTIVE' && ` · account is ${a.status.toLowerCase()} (verify it first?)`}
                  </div>
                </div>
                <Pill value={a.status} />
              </div>
            )
          })}
        </div>
      )}
      {redditNeedsTitle && (
        <Callout tone="danger">
          <b>Reddit posts require a non-empty title.</b> Add a title before publishing to Reddit.
        </Callout>
      )}
    </Modal>
  )
}

/* --- Container: data loading, keyed remount per post ----------------------- */

export default function PostEditorView() {
  const { id } = useParams()
  const postId = id ? Number(id) : null

  const postQuery = useApiQuery<PostDto | null>(
    () => (postId ? postsApi.get(postId) : Promise.resolve(null)),
    ['post', postId],
  )
  const accountsQuery = useApiQuery(() => accountsApi.list(), ['accounts'])

  if (postId && postQuery.data === undefined && postQuery.error) {
    return <ErrorBlock message={postQuery.error} onRetry={postQuery.refetch} />
  }
  if (accountsQuery.data === undefined && accountsQuery.error) {
    return <ErrorBlock message={accountsQuery.error} onRetry={accountsQuery.refetch} />
  }
  if (postQuery.data === undefined || accountsQuery.data === undefined) return <Loading />

  return (
    <Editor
      // Remount (resetting all local state) when the underlying post changes.
      key={postQuery.data?.id ?? 'new'}
      post={postQuery.data}
      accounts={accountsQuery.data}
      refresh={postQuery.refetch}
    />
  )
}

/* --- Editor ---------------------------------------------------------------- */

function Editor({
  post,
  accounts,
  refresh,
}: {
  post: PostDto | null
  accounts: AccountDto[]
  refresh: () => void
}) {
  const nav = useNavigate()
  const toast = useToast()

  // On /posts/new a created draft lives here until the URL catches up, so the
  // editor (and an open results modal) never unmount mid-flow.
  const [created, setCreated] = useState<PostDto | null>(null)
  const current = post ?? created
  const postId = current?.id ?? null
  const readOnly = current?.status === 'PUBLISHED'

  const [form, setForm] = useState<FormState>(() => (post ? formFromPost(post) : EMPTY_FORM))
  const [baseline, setBaseline] = useState<string>(() => JSON.stringify(post ? formFromPost(post) : EMPTY_FORM))
  const [tab, setTab] = useState<Tab>('GENERIC')
  const [previewPlatform, setPreviewPlatform] = useState<Platform>('FACEBOOK')
  const [targets, setTargets] = useState<number[]>(() =>
    accounts.filter((a) => a.status === 'ACTIVE').map((a) => a.id),
  )
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [results, setResults] = useState<PublishResult | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const dirty = !readOnly && JSON.stringify(form) !== baseline

  // Warn before losing an edited draft when the tab/app closes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const buildInput = (): PostInput => ({
    title: form.title.trim() || null,
    text: form.text,
    overrides: {
      ...(form.ovrOn.FACEBOOK && form.ovr.FACEBOOK.trim() ? { FACEBOOK: form.ovr.FACEBOOK } : {}),
      ...(form.ovrOn.REDDIT && form.ovr.REDDIT.trim() ? { REDDIT: form.ovr.REDDIT } : {}),
    },
  })

  /** Create or update; returns the saved post or null on failure. */
  const save = async (navigateAfterCreate: boolean): Promise<PostDto | null> => {
    if (!form.text.trim()) {
      setFormError('Post text is required.')
      return null
    }
    setFormError(null)
    setSaving(true)
    try {
      const input = buildInput()
      const saved = postId ? await postsApi.update(postId, input) : await postsApi.create(input)
      setBaseline(JSON.stringify(formFromPost(saved)))
      toast(postId ? 'Draft saved' : 'Draft created')
      if (postId) {
        refresh()
        return saved
      }
      setCreated(saved)
      if (navigateAfterCreate) nav(`/posts/${saved.id}`, { replace: true })
      return saved
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed'
      setFormError(msg)
      toast(msg, 'error')
      return null
    } finally {
      setSaving(false)
    }
  }

  const doPublish = async () => {
    setPublishing(true)
    try {
      let pid = postId
      if (!pid) {
        const saved = await save(false)
        if (!saved) return
        pid = saved.id
      }
      const res = await postsApi.publish(pid, targets)
      setResults(res)
      const ok = res.results.filter((r) => r.status === 'SUCCESS').length
      toast(
        ok
          ? `Published to ${ok}/${res.results.length} account${res.results.length === 1 ? '' : 's'}`
          : 'Publish failed on all targets — see details',
        ok ? 'ok' : 'error',
      )
      // Refresh the post (status may have flipped to PUBLISHED, new attempt rows).
      if (post) refresh()
      else postsApi.get(pid).then(setCreated).catch(() => {})
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Publish failed', 'error')
    } finally {
      setPublishing(false)
    }
  }

  const doDelete = async () => {
    if (!postId) {
      nav('/posts')
      return
    }
    setDeleting(true)
    try {
      await postsApi.remove(postId)
      toast('Post deleted')
      nav('/posts')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed', 'error')
      setDeleting(false)
    }
  }

  const toggleTarget = (accountId: number) => {
    setTargets((ts) => (ts.includes(accountId) ? ts.filter((t) => t !== accountId) : [...ts, accountId]))
  }

  return (
    <>
      <div className="btn-row" style={{ marginBottom: 14 }}>
        <Link className="btn ghost" to="/posts">
          ← Posts
        </Link>
        {current && <Pill value={current.status} />}
        <span className="meta mono" style={{ alignSelf: 'center' }}>
          {current ? `#${current.id} · created ${fmtDateTime(current.createdAt)}` : 'new draft'}
        </span>
      </div>

      {readOnly && (
        <Callout tone="warn">
          <b>This post is published and locked.</b> Only DRAFT posts can be edited. Republishing pushes the
          same content to accounts again (a natural retry) and adds new attempt rows to the history below.
        </Callout>
      )}

      <div className="composer-grid">
        {/* Editor + preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div className="card pad">
            <div className="tabs" style={{ marginBottom: 12 }}>
              <button className={tab === 'GENERIC' ? 'active' : ''} onClick={() => setTab('GENERIC')}>
                Generic
              </button>
              {PLATFORM_LIST.map((p) => (
                <button key={p} className={tab === p ? 'active' : ''} onClick={() => setTab(p)}>
                  {PLATFORMS[p].label}
                  {form.ovrOn[p] && <span style={{ color: 'var(--gold)' }}> *</span>}
                </button>
              ))}
            </div>

            {tab === 'GENERIC' ? (
              <>
                <label className="field">
                  <span className="lab">
                    Title <span style={{ color: 'var(--text-mute)' }}>(optional — required for Reddit)</span>
                  </span>
                  <input
                    type="text"
                    value={form.title}
                    disabled={readOnly}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Our v2 release is out"
                  />
                </label>
                <label className="field">
                  <span className="lab">Text — shared by all platforms unless overridden</span>
                  <textarea
                    rows={8}
                    value={form.text}
                    disabled={readOnly}
                    onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                    placeholder="Write once, publish everywhere…"
                  />
                </label>
                <div className="media-drop">
                  🖼 &nbsp;Add image / video — <b>planned</b>. The backend doesn’t accept media yet, so posts
                  are text-only for now.
                </div>
              </>
            ) : (
              <>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    marginBottom: 12,
                    cursor: readOnly ? 'default' : 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.ovrOn[tab]}
                    disabled={readOnly}
                    onChange={(e) => setForm((f) => ({ ...f, ovrOn: { ...f.ovrOn, [tab]: e.target.checked } }))}
                  />
                  <span style={{ fontSize: 12.5 }}>
                    Override the text for <b>{PLATFORMS[tab].label}</b> (character limit{' '}
                    {PLATFORMS[tab].maxLength.toLocaleString('en-US')})
                  </span>
                </label>
                <label className="field">
                  <span className="lab">
                    {PLATFORMS[tab].label} text — full replacement of the generic text when enabled
                  </span>
                  <textarea
                    rows={8}
                    value={form.ovr[tab]}
                    disabled={readOnly || !form.ovrOn[tab]}
                    onChange={(e) => setForm((f) => ({ ...f, ovr: { ...f.ovr, [tab]: e.target.value } }))}
                    placeholder={
                      form.ovrOn[tab]
                        ? `${PLATFORMS[tab].label}-specific variant of this post…`
                        : 'Enable the override to write a platform-specific variant.'
                    }
                  />
                </label>
                <p className="hint">
                  Without an override the platform receives the generic text. Overrides replace it wholesale —
                  tweak length, tone or details per platform.
                </p>
              </>
            )}

            {formError && (
              <p className="errtext" style={{ margin: '10px 0 0' }}>
                {formError}
              </p>
            )}
            {dirty && (
              <p className="hint" style={{ margin: '10px 0 0', color: 'var(--warn)' }}>
                Unsaved changes.
              </p>
            )}
          </div>

          <PreviewCard
            form={form}
            accounts={accounts}
            platform={previewPlatform}
            onSelectPlatform={setPreviewPlatform}
          />
        </div>

        {/* Right column: targets, AI stub, actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card pad">
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Target accounts
            </div>
            {!accounts.length ? (
              <p className="hint" style={{ margin: 0 }}>
                No accounts connected. <Link to="/accounts">Connect one →</Link>
              </p>
            ) : (
              accounts.map((a) => (
                <label key={a.id} className={`pick ${targets.includes(a.id) ? 'on' : ''}`} style={{ marginBottom: 6 }}>
                  <input
                    type="checkbox"
                    checked={targets.includes(a.id)}
                    onChange={() => toggleTarget(a.id)}
                  />
                  <span className="who">
                    <b>{a.displayName ?? `account #${a.id}`}</b>
                    <Pill value={a.status} />
                  </span>
                  <PlatformChip platform={a.platform} />
                </label>
              ))
            )}
          </div>

          <div className="card pad">
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              AI assist
            </div>
            <div className="dim">
              <button className="btn" style={{ width: '100%', justifyContent: 'center' }} disabled>
                <Icon name="ai" /> Generate text with AI
              </button>
            </div>
            <p className="hint" style={{ margin: '8px 0 0' }}>
              Planned — the backend generation endpoint isn’t implemented yet.{' '}
              <Link to="/ai">Preview the design →</Link>
            </p>
          </div>

          <div className="card pad">
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Actions
            </div>
            <div className="btn-row">
              {!readOnly && (
                <button className="btn primary" onClick={() => void save(true)} disabled={saving}>
                  {saving ? <Spinner /> : postId ? 'Save changes' : 'Save draft'}
                </button>
              )}
              <button
                className="btn primary"
                onClick={() => {
                  setResults(null)
                  setPublishOpen(true)
                }}
                disabled={!accounts.length}
              >
                {readOnly ? 'Republish…' : 'Publish…'}
              </button>
              <button className="btn danger" onClick={() => setDeleteOpen(true)}>
                <Icon name="trash" />
                Delete
              </button>
            </div>
            <p className="hint" style={{ margin: '10px 0 0' }}>
              {readOnly
                ? 'Delete removes the post and its local publication rows — it does NOT delete the post on the platforms.'
                : 'Publish creates one attempt per selected account; the post becomes PUBLISHED once at least one target succeeds.'}
            </p>
          </div>
        </div>
      </div>

      {current && (
        <>
          <div className="section-head">
            <h2>Publication history</h2>
            <span className="hint">every attempt, newest first</span>
          </div>
          <div className="card list">
            {current.publications.length ? (
              current.publications.map((pub) => (
                <div key={pub.id} className="row plain" style={{ gridTemplateColumns: '1fr auto' }}>
                  <span
                    className={`sev ${pub.status === 'SUCCESS' ? 'sev-ok' : pub.status === 'FAILED' ? 'sev-high' : 'sev-med'}`}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div className="title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <PlatformChip platform={pub.platform} />
                      <span>{pub.accountName}</span>
                    </div>
                    <div className="meta" style={{ marginTop: 2 }}>
                      {fmtDateTime(pub.publishedAt ?? pub.createdAt)}
                      {pub.errorMessage && <span className="errtext"> · {pub.errorMessage}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {pub.externalUrl && (
                      <a
                        className="iconlink"
                        href={pub.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={pub.externalUrl}
                      >
                        <Icon name="external" />
                      </a>
                    )}
                    <Pill value={pub.status} />
                  </div>
                </div>
              ))
            ) : (
              <div className="empty">No publication attempts yet.</div>
            )}
          </div>
        </>
      )}

      {publishOpen && (
        <PublishModal
          accounts={accounts}
          selected={targets}
          form={form}
          publishing={publishing}
          results={results}
          onClose={() => {
            setPublishOpen(false)
            setResults(null)
            // Catch the URL up after a create+publish from /posts/new.
            if (!post && created) nav(`/posts/${created.id}`, { replace: true })
          }}
          onConfirm={() => void doPublish()}
        />
      )}

      {deleteOpen && (
        <ConfirmModal
          title={readOnly ? 'Delete published post' : 'Delete draft'}
          message={
            <>
              This removes the post <b>and its local publication history</b>. It does <b>not</b> delete the
              post on the platforms — that requires deleting each publication on the platform itself
              (planned backend extension).
            </>
          }
          confirmLabel="Delete"
          danger
          busy={deleting}
          onConfirm={() => void doDelete()}
          onClose={() => setDeleteOpen(false)}
        />
      )}
    </>
  )
}
