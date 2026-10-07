import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { accountsApi } from '../api/accounts'
import { postsApi } from '../api/posts'
import type { AccountDto, Platform, PostContent, PostDto, PostInput, PublishResult } from '../api/types'
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
  Spinner,
} from '../components/ui'
import { useApiQuery } from '../hooks/useApiQuery'
import { useToast } from '../hooks/useToast'
import { describeError } from '../lib/errors'
import { fmtDateTime } from '../lib/format'
import { PLATFORMS, PUBLISHABLE_PLATFORMS } from '../lib/platform'

type Tab = 'GENERIC' | Platform

interface OverrideForm {
  on: boolean
  title: string
  text: string
  link: string
}

interface FormState {
  title: string
  text: string
  /** Optional http(s) link the post shares — feeds the manual share composers. */
  link: string
  ovr: Record<Platform, OverrideForm>
}

function emptyOvr(): Record<Platform, OverrideForm> {
  return Object.fromEntries(
    PUBLISHABLE_PLATFORMS.map((p) => [p, { on: false, title: '', text: '', link: '' }]),
  ) as Record<Platform, OverrideForm>
}

const EMPTY_FORM: FormState = { title: '', text: '', link: '', ovr: emptyOvr() }

function formFromPost(post: PostDto): FormState {
  const ovr = emptyOvr()
  for (const p of PUBLISHABLE_PLATFORMS) {
    const o = post.overrides?.[p]
    if (o) ovr[p] = { on: true, title: o.title ?? '', text: o.text, link: o.link ?? '' }
  }
  return { title: post.content.title ?? '', text: post.content.text, link: post.content.link ?? '', ovr }
}

/** Per-field fallback exactly as the backend resolves at publish time. */
function effectiveTitle(form: FormState, platform: Platform): string {
  const o = form.ovr[platform]
  return o.on && o.title.trim() ? o.title : form.title
}

function effectiveText(form: FormState, platform: Platform): string {
  const o = form.ovr[platform]
  return o.on && o.text.trim() ? o.text : form.text
}

function effectiveLink(form: FormState, platform: Platform): string {
  const o = form.ovr[platform]
  return o.on && o.link.trim() ? o.link : form.link
}

const looksLikeUrl = (v: string) => /^https?:\/\//.test(v)

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
  const override = form.ovr[platform].on
  const title = effectiveTitle(form, platform)
  const text = effectiveText(form, platform)
  const link = effectiveLink(form, platform)
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
          {PUBLISHABLE_PLATFORMS.map((p) => (
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
      {title.trim() && (
        <div className="pbody" style={{ fontWeight: 600, marginBottom: 6 }}>
          {title}
        </div>
      )}
      <div className="pbody">
        {text || <span style={{ color: 'var(--text-mute)' }}>Nothing yet — start typing the generic text.</span>}
      </div>
      {link && (
        <div className="meta mono" style={{ marginTop: 8, overflowWrap: 'anywhere' }}>
          🔗{' '}
          <a href={link} target="_blank" rel="noreferrer">
            {link}
          </a>
        </div>
      )}
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
  const redditNeedsTitle =
    chosen.some((a) => a.platform === 'REDDIT') && !effectiveTitle(form, 'REDDIT').trim()

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
                    <Linkify text={r.errorMessage} />
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
            The post stays a <b>draft</b> until at least one account succeeds — fix the errors and publish again.
          </Callout>
        )}
      </Modal>
    )
  }

  return (
    <Modal
      title="Publish post"
      sub="Each account gets the post separately — if one fails, the others still go through"
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
            const usesOverride = form.ovr[a.platform]?.on
            return (
              <div key={a.id} className="row plain" style={{ gridTemplateColumns: '1fr auto', padding: '11px 0' }}>
                <div>
                  <div className="title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <PlatformChip platform={a.platform} />
                    <span>{a.displayName ?? `account #${a.id}`}</span>
                  </div>
                  <div className="meta" style={{ marginTop: 2 }}>
                    {`will receive: ${usesOverride ? `${PLATFORMS[a.platform].label} override` : 'generic text'}`}
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

/* --- Record-a-by-hand-post modal -------------------------------------------- */

function ManualPublishModal({
  account,
  busy,
  onClose,
  onConfirm,
}: {
  account: AccountDto
  busy: boolean
  onClose: () => void
  onConfirm: (externalUrl?: string) => void
}) {
  const [url, setUrl] = useState('')
  const trimmed = url.trim()
  const invalid = trimmed !== '' && !/^https?:\/\//.test(trimmed)

  return (
    <Modal
      title="Mark as posted by hand"
      sub={`${PLATFORMS[account.platform].label} · ${account.displayName ?? `account #${account.id}`}`}
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={busy || invalid}
            onClick={() => onConfirm(trimmed || undefined)}
          >
            {busy ? <Spinner /> : 'Record'}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: '0 0 12px' }}>
        You opened the platform and created the post there yourself. Recording it keeps the history
        complete — and it counts like a real publish: the post becomes <b>Published</b> and locks.
      </p>
      {account.credentialsMasked?.profileUrl && (
        <p className="hint" style={{ margin: '0 0 12px' }}>
          Didn’t post yet?{' '}
          <a href={account.credentialsMasked.profileUrl} target="_blank" rel="noreferrer">
            Open {account.displayName ?? PLATFORMS[account.platform].label} ↗
          </a>{' '}
          first.
        </p>
      )}
      <label className="field">
        <span className="lab">Link to the created post (optional)</span>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={`https://${account.platform.toLowerCase()}.com/your-post…`}
        />
      </label>
      {invalid && (
        <InlineError error={new Error('The link must start with http:// or https://')} title="Check the link" />
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
    return <ErrorBlock error={postQuery.error} onRetry={postQuery.refetch} />
  }
  if (accountsQuery.data === undefined && accountsQuery.error) {
    return <ErrorBlock error={accountsQuery.error} onRetry={accountsQuery.refetch} />
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
    accounts.filter((a) => a.status === 'ACTIVE' && a.canPublish).map((a) => a.id),
  )
  const apiAccounts = accounts.filter((a) => a.canPublish)
  const manualAccounts = accounts.filter((a) => !a.canPublish)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<unknown>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [results, setResults] = useState<PublishResult | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [manualFor, setManualFor] = useState<AccountDto | null>(null)
  const [manualBusy, setManualBusy] = useState(false)
  const [shareBusy, setShareBusy] = useState<number | null>(null)
  /** "Delete publications" — the backend rejects true (501) until platform-side deletion ships. */
  const [deletePublications, setDeletePublications] = useState(false)

  const dirty = !readOnly && JSON.stringify(form) !== baseline

  // Warn before losing an edited draft when the tab/app closes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const buildInput = (): PostInput | null => {
    if (!form.text.trim()) {
      setFormError('Post text is required.')
      return null
    }
    for (const p of PUBLISHABLE_PLATFORMS) {
      if (form.ovr[p].on && !form.ovr[p].text.trim()) {
        setFormError(`The ${PLATFORMS[p].label} override needs its own text (or disable it).`)
        return null
      }
    }
    const links = [form.link, ...PUBLISHABLE_PLATFORMS.filter((p) => form.ovr[p].on).map((p) => form.ovr[p].link)]
    const badLink = links.find((l) => l.trim() !== '' && !looksLikeUrl(l.trim()))
    if (badLink !== undefined) {
      setFormError('Links must start with http:// or https://.')
      return null
    }
    const overrides: Partial<Record<Platform, PostContent>> = {}
    for (const p of PUBLISHABLE_PLATFORMS) {
      if (form.ovr[p].on) {
        overrides[p] = {
          title: form.ovr[p].title.trim() || null,
          text: form.ovr[p].text,
          link: form.ovr[p].link.trim() || null,
        }
      }
    }
    return {
      content: { title: form.title.trim() || null, text: form.text, link: form.link.trim() || null },
      overrides,
    }
  }

  /**
   * Create or update; returns the saved post or null on failure. `silent`
   * suppresses the success toast (publish/share/autosave announce themselves),
   * errors always surface; `navigateAfterCreate` is the explicit Save button
   * catching the URL up on /posts/new.
   */
  const save = async (opts: { silent?: boolean; navigateAfterCreate?: boolean } = {}): Promise<PostDto | null> => {
    const input = buildInput()
    if (!input) return null
    setSaving(true)
    try {
      const saved = postId ? await postsApi.update(postId, input) : await postsApi.create(input)
      setBaseline(JSON.stringify(formFromPost(saved)))
      if (!opts.silent) toast(postId ? 'Draft saved' : 'Draft created')
      if (postId) {
        refresh()
        return saved
      }
      setCreated(saved)
      if (opts.navigateAfterCreate) nav(`/posts/${saved.id}`, { replace: true })
      return saved
    } catch (e) {
      setFormError(e)
      toast(describeError(e), 'error')
      return null
    } finally {
      setSaving(false)
    }
  }


  // Auto-save a non-empty draft when the user switches away — nothing is lost
  // to a forgotten Save, and the beforeunload warning above only remains for
  // saves that failed (e.g. offline). No dep array: re-subscribes every render
  // so the handler always sees the latest form.
  useEffect(() => {
    const onVisibility = () => {
      if (
        document.visibilityState === 'hidden' &&
        dirty &&
        !readOnly &&
        !saving &&
        form.text.trim()
      ) {
        void save({ silent: true })
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  })

  const doPublish = async () => {
    setPublishing(true)
    try {
      let pid = postId
      if (!readOnly) {
        // Publish what's on screen: save pending edits first, so an unsaved
        // draft never publishes its stale server version.
        const saved = await save({ silent: true })
        if (!saved) return
        pid = saved.id
      }
      if (pid == null) return // unreachable: published posts always have an id
      const res = await postsApi.publish(pid, targets)
      setResults(res)
      const total = res.results.length
      const ok = res.results.filter((r) => r.status === 'SUCCESS').length
      if (res.postStatus === 'PUBLISHED') {
        toast(total === 1 ? 'Published' : `Published to ${ok}/${total} accounts`)
      } else {
        toast(
          { title: 'Not published anywhere yet', detail: 'Open the details — failed targets may carry a link for posting by hand.' },
          'error',
        )
      }
      // Refresh the post (status may have flipped to PUBLISHED, new attempt rows).
      if (post) refresh()
      else postsApi.get(pid).then(setCreated).catch(() => {})
    } catch (e) {
      toast(describeError(e), 'error')
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
      await postsApi.remove(postId, readOnly ? deletePublications : undefined)
      toast('Post deleted')
      nav('/posts')
    } catch (e) {
      toast(describeError(e), 'error')
      setDeleting(false)
    }
  }

  const doManualPublish = async (accountId: number, externalUrl?: string) => {
    if (!postId) return
    setManualBusy(true)
    try {
      const res = await postsApi.publishManual(postId, accountId, externalUrl)
      toast(
        res.results[0]?.publishedManually
          ? `Recorded — posted by hand on ${res.results[0].accountName}`
          : 'Recorded',
      )
      setManualFor(null)
      if (post) refresh()
      else postsApi.get(postId).then(setCreated).catch(() => {})
    } catch (e) {
      toast(describeError(e), 'error')
    } finally {
      setManualBusy(false)
    }
  }

  /** Open the platform's composer prefilled with this post (manual accounts). */
  const openShare = async (account: AccountDto) => {
    setShareBusy(account.id)
    try {
      // The composer is prefilled from the saved post — persist edits first so
      // it always shows what's on screen.
      let pid = postId
      if (!readOnly) {
        const saved = await save({ silent: true })
        if (!saved) return
        pid = saved.id
      }
      if (pid == null) return // unreachable: published posts always have an id
      const { url } = await postsApi.shareUrl(pid, account.id)
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      toast(describeError(e), 'error')
    } finally {
      setShareBusy(null)
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
        <Callout tone="gold">
          <b>This post is published and locked.</b> Republishing pushes the same content to accounts
          again and adds new attempt rows to the history below.
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
              {PUBLISHABLE_PLATFORMS.map((p) => (
                <button key={p} className={tab === p ? 'active' : ''} onClick={() => setTab(p)}>
                  {PLATFORMS[p].label}
                  {form.ovr[p].on && <span style={{ color: 'var(--gold)' }}> *</span>}
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
                <label className="field">
                  <span className="lab">
                    Link (optional) — attached to the post, e.g. an image or article
                  </span>
                  <input
                    type="url"
                    value={form.link}
                    disabled={readOnly}
                    onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                    placeholder="https://example.com/my-picture"
                  />
                </label>
                <div className="media-drop">
                  🖼 &nbsp;Image and video support is coming later — posts are text-only for now.
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
                    checked={form.ovr[tab].on}
                    disabled={readOnly}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, ovr: { ...f.ovr, [tab]: { ...f.ovr[tab], on: e.target.checked } } }))
                    }
                  />
                  <span style={{ fontSize: 12.5 }}>
                    Override content for <b>{PLATFORMS[tab].label}</b> (character limit{' '}
                    {PLATFORMS[tab].maxLength.toLocaleString('en-US')})
                  </span>
                </label>
                <label className="field">
                  <span className="lab">
                    {PLATFORMS[tab].label} title — optional, falls back to the generic title when empty
                  </span>
                  <input
                    type="text"
                    value={form.ovr[tab].title}
                    disabled={readOnly || !form.ovr[tab].on}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, ovr: { ...f.ovr, [tab]: { ...f.ovr[tab], title: e.target.value } } }))
                    }
                    placeholder={form.ovr[tab].on ? form.title || 'no generic title either' : '—'}
                  />
                </label>
                <label className="field">
                  <span className="lab">{PLATFORMS[tab].label} text — required when the override is enabled</span>
                  <textarea
                    rows={8}
                    value={form.ovr[tab].text}
                    disabled={readOnly || !form.ovr[tab].on}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, ovr: { ...f.ovr, [tab]: { ...f.ovr[tab], text: e.target.value } } }))
                    }
                    placeholder={
                      form.ovr[tab].on
                        ? `${PLATFORMS[tab].label}-specific variant of this post…`
                        : 'Enable the override to write a platform-specific variant.'
                    }
                  />
                </label>
                <label className="field">
                  <span className="lab">
                    {PLATFORMS[tab].label} link — optional, falls back to the generic link when empty
                  </span>
                  <input
                    type="url"
                    value={form.ovr[tab].link}
                    disabled={readOnly || !form.ovr[tab].on}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, ovr: { ...f.ovr, [tab]: { ...f.ovr[tab], link: e.target.value } } }))
                    }
                    placeholder={form.ovr[tab].on ? form.link || 'no generic link either' : '—'}
                  />
                </label>
                <p className="hint">
                  Leave the override title empty to reuse the generic title. The override text replaces the
                  generic text — but only on this platform.
                </p>
              </>
            )}

            {formError != null && <InlineError error={formError} />}
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
            {!apiAccounts.length ? (
              <p className="hint" style={{ margin: 0 }}>
                {accounts.length
                  ? 'Only manual accounts connected — publishing needs an account with API access.'
                  : 'No accounts connected. '}
                <Link to="/accounts">Connect one →</Link>
              </p>
            ) : (
              apiAccounts.map((a) => (
                <label key={a.id} className={`pick ${targets.includes(a.id) ? 'on' : ''}`} style={{ marginBottom: 6 }}>
                  <input
                    type="checkbox"
                    checked={targets.includes(a.id)}
                    onChange={() => toggleTarget(a.id)}
                  />
                  <span className="who" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <b>{a.displayName ?? `account #${a.id}`}</b>
                    <Pill value={a.status} />
                  </span>
                  <PlatformChip platform={a.platform} />
                </label>
              ))
            )}
          </div>

          {manualAccounts.length > 0 && (
            <div className="card pad">
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                Manual accounts — open &amp; post by hand
              </div>
              {manualAccounts.map((a) => {
                const profileUrl = a.credentialsMasked?.profileUrl
                const name = a.displayName ?? `account #${a.id}`
                return (
                  <div key={a.id} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <PlatformChip platform={a.platform} />
                      {profileUrl ? (
                        <a
                          href={profileUrl}
                          target="_blank"
                          rel="noreferrer"
                          title={`${name} — open the ${PLATFORMS[a.platform].label} ${a.platform === 'REDDIT' ? 'subreddit' : 'page/profile'}`}
                          style={{
                            fontSize: 12.5,
                            fontWeight: 600,
                            flex: 1,
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            textDecoration: 'underline dotted',
                            textUnderlineOffset: 3,
                          }}
                        >
                          {name}
                        </a>
                      ) : (
                        <b
                          style={{ fontSize: 12.5, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={name}
                        >
                          {name}
                        </b>
                      )}
                      <button
                        className="btn"
                        disabled={!postId}
                        title={postId ? 'Record that you posted there by hand' : 'Save the post first'}
                        onClick={() => setManualFor(a)}
                      >
                        Mark as posted…
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      {a.canShare ? (
                        <button
                          className="btn ghost"
                          style={{ padding: '4px 10px', fontSize: 11 }}
                          disabled={shareBusy === a.id || saving}
                          title="Saves the post if needed, then opens the platform composer with it prefilled"
                          onClick={() => void openShare(a)}
                        >
                          {shareBusy === a.id ? <Spinner /> : 'Open to post by hand ↗'}
                        </button>
                      ) : profileUrl ? (
                        <a
                          className="btn ghost"
                          style={{ padding: '4px 10px', fontSize: 11, textDecoration: 'none' }}
                          href={profileUrl}
                          target="_blank"
                          rel="noreferrer"
                          title={profileUrl}
                        >
                          Open profile ↗
                        </a>
                      ) : null}
                    </div>
                  </div>
                )
              })}
              <p className="hint" style={{ margin: 0 }}>
                These have no API access: open the link, create the post there, then mark it as posted to
                keep the history complete.
              </p>
            </div>
          )}

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
              AI text generation is on the roadmap. <Link to="/ai">See what’s coming →</Link>
            </p>
          </div>

          <div className="card pad">
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Actions
            </div>
            <div className="btn-row">
              {!readOnly && (
                <button
                  className="btn primary"
                  onClick={() => void save({ navigateAfterCreate: true })}
                  disabled={saving}
                >
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
              <button
                className="btn danger"
                onClick={() => {
                  setDeletePublications(false)
                  setDeleteOpen(true)
                }}
              >
                <Icon name="trash" />
                Delete
              </button>
            </div>
            <p className="hint" style={{ margin: '10px 0 0' }}>
              {readOnly
                ? 'Deleting removes the post from the app — its history is kept, and copies already on social platforms stay.'
                : 'Publishing sends the post to each selected account separately — it’s marked Published as soon as one of them succeeds.'}
            </p>
          </div>
        </div>
      </div>

      {current && (
        <>
          <div className="section-head">
            <h2>Publication history</h2>
            <span className="hint">every publishing attempt, newest first</span>
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
                      {pub.errorMessage && (
                        <span className="errtext">
                          {' · '}
                          <Linkify text={pub.errorMessage} />
                        </span>
                      )}
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
                    {pub.publishedManually && <Pill value="MANUAL" label="by hand" />}
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

      {manualFor && (
        <ManualPublishModal
          account={manualFor}
          busy={manualBusy}
          onClose={() => setManualFor(null)}
          onConfirm={(externalUrl) => void doManualPublish(manualFor.id, externalUrl)}
        />
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
            readOnly ? (
              <>The post will disappear from the app; its history stays.</>
            ) : (
              <>Delete this draft? Nothing was published yet, so this only removes it from the app.</>
            )
          }
          confirmLabel="Delete"
          danger
          busy={deleting}
          onConfirm={() => void doDelete()}
          onClose={() => setDeleteOpen(false)}
        >
          {readOnly && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'not-allowed' }}>
                <input
                  type="checkbox"
                  checked={deletePublications}
                  disabled
                  onChange={(e) => setDeletePublications(e.target.checked)}
                />
                <span style={{ fontSize: 12.5 }}>
                  Delete publications <span className="hint">(not available yet)</span>
                </span>
              </label>
              <div className="callout warn sm">
                Copies already posted to social platforms will <b>stay live</b> — remove them manually if you
                don’t want them visible there.
              </div>
            </div>
          )}
        </ConfirmModal>
      )}
    </>
  )
}
