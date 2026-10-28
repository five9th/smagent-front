import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { accountsApi } from '../api/accounts'
import { aiApi } from '../api/ai'
import { postsApi } from '../api/posts'
import type {
  AccountDto,
  GeneratePlatform,
  GenerateResult,
  Platform,
  PostContent,
  PostDto,
  PostInput,
  PublishResult,
} from '../api/types'
import { GeneratePanel, type AiDraftSeed, type ApplyTarget } from '../components/GeneratePanel'
import { Icon } from '../components/Icon'
import { PostPreview, type PreviewTab } from '../components/PostPreview'
import {
  Callout,
  ConfirmModal,
  CopyButton,
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
import { PLATFORMS, PLATFORM_LIST } from '../lib/platform'

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
    PLATFORM_LIST.map((p) => [p, { on: false, title: '', text: '', link: '' }]),
  ) as Record<Platform, OverrideForm>
}

const EMPTY_FORM: FormState = { title: '', text: '', link: '', ovr: emptyOvr() }

function formFromPost(post: PostDto): FormState {
  const ovr = emptyOvr()
  for (const p of PLATFORM_LIST) {
    const o = post.overrides?.[p]
    if (o) ovr[p] = { on: true, title: o.title ?? '', text: o.text, link: o.link ?? '' }
  }
  return { title: post.content.title ?? '', text: post.content.text, link: post.content.link ?? '', ovr }
}

/** Initial form for a draft handed over from the /ai generate flow. */
function seedForm(seed: AiDraftSeed): FormState {
  const ovr = emptyOvr()
  for (const p of PLATFORM_LIST) {
    const s = seed.overrides[p]
    if (s) ovr[p] = { on: true, title: s.title ?? '', text: s.text, link: '' }
  }
  return { title: seed.title, text: seed.text, link: '', ovr }
}

/**
 * Current content the AI may read (with consent) in the generate modal:
 * GENERIC plus every enabled override. Entries with blank text are dropped
 * (the backend ignores them anyway); null when there's nothing to show.
 */
function aiDraftFromForm(form: FormState): Partial<Record<GeneratePlatform, PostContent>> | null {
  const state: Partial<Record<GeneratePlatform, PostContent>> = {}
  if (form.text.trim()) {
    state.GENERIC = {
      title: form.title.trim() || null,
      text: form.text,
      link: form.link.trim() || null,
    }
  }
  for (const p of PLATFORM_LIST) {
    const o = form.ovr[p]
    if (o.on && o.text.trim()) {
      state[p] = { title: o.title.trim() || null, text: o.text, link: o.link.trim() || null }
    }
  }
  return Object.keys(state).length ? state : null
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

/* --- Manual publish checklist dialog ---------------------------------------- */

function ManualPublishDialog({
  accounts,
  postedAccountIds,
  shareBusy,
  recordingId,
  onClose,
  onOpenShare,
  onRecord,
}: {
  accounts: AccountDto[]
  /** Accounts the post already went out on (SUCCESS publications). */
  postedAccountIds: Set<number>
  /** Account id an "Open to post by hand" is in flight for. */
  shareBusy: number | null
  /** Account id a record is in flight for. */
  recordingId: number | null
  onClose: () => void
  onOpenShare: (account: AccountDto) => void
  /** Resolves true when recorded (the row flips to posted). */
  onRecord: (account: AccountDto, externalUrl?: string) => Promise<boolean>
}) {
  const [markingId, setMarkingId] = useState<number | null>(null)
  const [url, setUrl] = useState('')
  const trimmed = url.trim()
  const invalid = trimmed !== '' && !/^https?:\/\//.test(trimmed)

  const closeMarking = () => {
    setMarkingId(null)
    setUrl('')
  }

  return (
    <Modal
      title="Manual publish"
      sub="walk through each account — open, post by hand, record it"
      onClose={onClose}
      footer={
        <button className="btn primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <Callout>
        <b>1.</b> Open to post by hand — opens the platform composer with this post prefilled.{' '}
        <b>2.</b> Create the post there. <b>3.</b> Mark as posted to record it in the history — it
        counts like a real publish.
      </Callout>
      <div style={{ marginTop: 12 }}>
        {accounts.map((a) => {
          const name = a.displayName ?? `account #${a.id}`
          const posted = postedAccountIds.has(a.id)
          const busy = recordingId === a.id
          return (
            <div key={a.id} style={{ marginBottom: 14 }}>
              <div className="pick static" style={{ marginBottom: 6 }}>
                <PlatformChip platform={a.platform} />
                <span className="who" style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <b>{name}</b>
                  {posted && <Pill value="SUCCESS" label="posted" />}
                  <Pill value={a.status} />
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginLeft: 26 }}>
                {a.canShare ? (
                  <button
                    className="btn ghost"
                    style={{ padding: '4px 10px', fontSize: 11 }}
                    disabled={shareBusy === a.id || busy}
                    title="Saves the post if needed, then opens the platform composer with it prefilled"
                    onClick={() => onOpenShare(a)}
                  >
                    {shareBusy === a.id ? <Spinner /> : 'Open to post by hand ↗'}
                  </button>
                ) : a.credentialsMasked?.profileUrl ? (
                  <a
                    className="btn ghost"
                    style={{ padding: '4px 10px', fontSize: 11, textDecoration: 'none' }}
                    href={a.credentialsMasked.profileUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={a.credentialsMasked.profileUrl}
                  >
                    Open profile ↗
                  </a>
                ) : null}
                {markingId === a.id ? (
                  <>
                    <input
                      type="url"
                      value={url}
                      autoFocus
                      style={{ flex: 1, minWidth: 170, padding: '5px 10px', fontSize: 12 }}
                      placeholder="Link to the created post (optional)"
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !invalid && !busy) {
                          void onRecord(a, trimmed || undefined).then((ok) => ok && closeMarking())
                        }
                      }}
                    />
                    <button
                      className="btn primary"
                      style={{ padding: '4px 10px', fontSize: 11, whiteSpace: 'nowrap' }}
                      disabled={busy || invalid}
                      title="Record the by-hand post"
                      onClick={() => void onRecord(a, trimmed || undefined).then((ok) => ok && closeMarking())}
                    >
                      {busy ? <Spinner /> : 'Record'}
                    </button>
                    <button
                      className="btn ghost"
                      style={{ padding: '4px 10px', fontSize: 11 }}
                      onClick={closeMarking}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className="btn ghost"
                    style={{ padding: '4px 10px', fontSize: 11 }}
                    disabled={shareBusy === a.id || busy}
                    title="Record that you posted there by hand"
                    onClick={() => {
                      setUrl('')
                      setMarkingId(a.id)
                    }}
                  >
                    {busy ? <Spinner /> : 'Mark as posted…'}
                  </button>
                )}
              </div>
              {markingId === a.id && invalid && (
                <p className="errtext" style={{ margin: '6px 0 0 26px' }}>
                  The link must start with http:// or https:// — or leave it empty.
                </p>
              )}
            </div>
          )
        })}
        {!accounts.length && <div className="empty">No manual accounts connected.</div>}
      </div>
    </Modal>
  )
}

/* --- Container: data loading, keyed remount per post ----------------------- */

export default function PostEditorView() {
  const { id } = useParams()
  const postId = id ? Number(id) : null
  // The /ai generate flow hands a drafted variant set over via router state.
  const location = useLocation()
  const seed = (location.state as { aiDraft?: AiDraftSeed } | null)?.aiDraft

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
      seed={seed}
    />
  )
}

/* --- Editor ---------------------------------------------------------------- */

function Editor({
  post,
  accounts,
  refresh,
  seed,
}: {
  post: PostDto | null
  accounts: AccountDto[]
  refresh: () => void
  seed?: AiDraftSeed
}) {
  const nav = useNavigate()
  const location = useLocation()
  const toast = useToast()

  // On /posts/new a created draft lives here until the URL catches up, so the
  // editor (and an open results modal) never unmount mid-flow.
  const [created, setCreated] = useState<PostDto | null>(null)
  const current = post ?? created
  const postId = current?.id ?? null
  const readOnly = current?.status === 'PUBLISHED'

  const [form, setForm] = useState<FormState>(() =>
    post ? formFromPost(post) : seed ? seedForm(seed) : EMPTY_FORM,
  )
  const [baseline, setBaseline] = useState<string>(() =>
    JSON.stringify(post ? formFromPost(post) : seed ? seedForm(seed) : EMPTY_FORM),
  )
  const [tab, setTab] = useState<Tab>('GENERIC')
  const [previewPlatform, setPreviewPlatform] = useState<PreviewTab>('FACEBOOK')
  const [targets, setTargets] = useState<number[]>(() =>
    accounts.filter((a) => a.status === 'ACTIVE' && a.canPublish).map((a) => a.id),
  )
  const apiAccounts = accounts.filter((a) => a.canPublish)
  const manualAccounts = accounts.filter((a) => !a.canPublish)
  /** Accounts this post actually went out on (SUCCESS publications) — display only. */
  const postedAccountIds = useMemo(
    () => new Set(current?.publications.filter((p) => p.status === 'SUCCESS').map((p) => p.accountId)),
    [current],
  )
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<unknown>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [results, setResults] = useState<PublishResult | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualBusy, setManualBusy] = useState(false)
  const [manualRecordingId, setManualRecordingId] = useState<number | null>(null)
  const [shareBusy, setShareBusy] = useState<number | null>(null)
  /** "Delete publications" — the backend rejects true (501) until platform-side deletion ships. */
  const [deletePublications, setDeletePublications] = useState(false)
  // AI tab: the provider list feeds the GeneratePanel. The panel mounts lazily
  // on the first AI-tab visit and then stays mounted (hidden while editing),
  // so switching the Edit/AI tabs never loses its state.
  const providersQuery = useApiQuery(() => aiApi.list(), ['ai-providers'])
  const providers = providersQuery.data ?? []
  const [page, setPage] = useState<'edit' | 'ai'>('edit')
  const [aiVisited, setAiVisited] = useState(false)

  const dirty = !readOnly && JSON.stringify(form) !== baseline

  // Consume the /ai handoff: replace the history entry so navigating back to
  // it (or refreshing after a failed autosave) can't re-seed a new draft.
  useEffect(() => {
    if (seed) nav(location.pathname, { replace: true })
  }, [seed, nav, location.pathname])

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
    for (const p of PLATFORM_LIST) {
      if (form.ovr[p].on && !form.ovr[p].text.trim()) {
        setFormError(`The ${PLATFORMS[p].label} override needs its own text (or disable it).`)
        return null
      }
    }
    const links = [form.link, ...PLATFORM_LIST.filter((p) => form.ovr[p].on).map((p) => form.ovr[p].link)]
    const badLink = links.find((l) => l.trim() !== '' && !looksLikeUrl(l.trim()))
    if (badLink !== undefined) {
      setFormError('Links must start with http:// or https://.')
      return null
    }
    const overrides: Partial<Record<Platform, PostContent>> = {}
    for (const p of PLATFORM_LIST) {
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

  // Best-effort autosave when the editor unmounts — in-app navigation
  // (Dashboard, Accounts, another post…) must not lose dirty edits either.
  // Latest-ref indirection because an empty-deps cleanup closes over stale state.
  const autosaveOnLeave = useRef<() => void>(() => {})
  useEffect(() => {
    autosaveOnLeave.current = () => {
      if (dirty && !readOnly && !saving && form.text.trim()) void save({ silent: true })
    }
  })
  useEffect(() => () => autosaveOnLeave.current(), [])

  /** Persist pending edits on drafts; resolves to the post id (null on failure). */
  const ensureSaved = async (): Promise<number | null> => {
    if (readOnly) return postId // published posts always carry an id
    const saved = await save({ silent: true })
    return saved?.id ?? null
  }

  const doPublish = async () => {
    setPublishing(true)
    try {
      // Publish what's on screen: save pending edits first, so an unsaved
      // draft never publishes its stale server version.
      const pid = await ensureSaved()
      if (pid == null) return
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

  /** Record a by-hand post. Resolves true when recorded (row flips to posted). */
  const doManualPublish = async (accountId: number, externalUrl?: string): Promise<boolean> => {
    const pid = await ensureSaved()
    if (pid == null) return false
    setManualBusy(true)
    setManualRecordingId(accountId)
    try {
      const res = await postsApi.publishManual(pid, accountId, externalUrl)
      toast(
        res.results[0]?.publishedManually
          ? `Recorded — posted by hand on ${res.results[0].accountName}`
          : 'Recorded',
      )
      if (post) refresh()
      else postsApi.get(pid).then(setCreated).catch(() => {})
      return true
    } catch (e) {
      toast(describeError(e), 'error')
      return false
    } finally {
      setManualBusy(false)
      setManualRecordingId(null)
    }
  }

  /** Open the platform's composer prefilled with this post (manual accounts). */
  const openShare = async (account: AccountDto) => {
    setShareBusy(account.id)
    try {
      // The composer is prefilled from the saved post — persist edits first so
      // it always shows what's on screen.
      const pid = await ensureSaved()
      if (pid == null) return
      const { url } = await postsApi.shareUrl(pid, account.id)
      // Facebook/LinkedIn composers don't take prefilled text — hand it over
      // via the clipboard so it's one paste away.
      const text = effectiveText(form, account.platform)
      if (text.trim()) {
        await navigator.clipboard.writeText(text).then(
          () => toast('Composer opened — post text copied, paste it there'),
          () => toast('Composer opened — copy the text manually from the editor'),
        )
      } else {
        toast('Composer opened')
      }
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      toast(describeError(e), 'error')
    } finally {
      setShareBusy(null)
    }
  }

  /**
   * Apply a generation result into the form: 'all' takes everything, otherwise
   * just the generic content or one platform variant. Generated overrides carry
   * no link — the form's existing link values stay untouched.
   */
  const applyGenerated = (r: GenerateResult, which: ApplyTarget) => {
    const generic = which === 'all' || which === 'GENERIC'
    setForm((f) => {
      const ovr = { ...f.ovr }
      for (const p of PLATFORM_LIST) {
        const g = which === 'all' || which === p ? r.overrides[p] : undefined
        if (g) ovr[p] = { on: true, title: g.title ?? '', text: g.text, link: f.ovr[p].link }
      }
      return {
        ...f,
        ...(generic && r.content?.title ? { title: r.content.title } : {}),
        ...(generic && r.content?.text ? { text: r.content.text } : {}),
        ovr,
      }
    })
    setPage('edit')
    toast(
      which === 'all'
        ? 'AI text applied to the draft'
        : `AI ${which === 'GENERIC' ? 'generic text' : `${PLATFORMS[which].label} variant`} applied`,
    )
    if (which !== 'all' && which !== 'GENERIC') setTab(which)
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

      {!readOnly && (
        <div className="tabs" style={{ marginBottom: 14 }}>
          <button className={page === 'edit' ? 'active' : ''} onClick={() => setPage('edit')}>
            Editor
          </button>
          <button
            className={page === 'ai' ? 'active' : ''}
            onClick={() => {
              setPage('ai')
              setAiVisited(true)
            }}
          >
            AI Generation
          </button>
        </div>
      )}

      <div style={{ display: page === 'edit' ? undefined : 'none' }}>
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
                  {form.ovr[p].on && <span style={{ color: 'var(--gold)' }}> *</span>}
                </button>
              ))}
            </div>

            {tab === 'GENERIC' ? (
              <>
                <label className="field">
                  <span className="lab" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ flex: 1 }}>
                      Title <span style={{ color: 'var(--text-mute)' }}>(optional — required for Reddit)</span>
                    </span>
                    <CopyButton value={form.title} />
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
                  <span className="lab" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ flex: 1 }}>Text — shared by all platforms unless overridden</span>
                    <CopyButton value={form.text} />
                  </span>
                  <textarea
                    rows={8}
                    value={form.text}
                    disabled={readOnly}
                    onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                    placeholder="Write once, publish everywhere…"
                  />
                </label>
                <label className="field">
                  <span className="lab" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ flex: 1 }}>Link (optional) — attached to the post, e.g. an image or article</span>
                    <CopyButton value={form.link} />
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
                    onChange={(e) => {
                      const on = e.target.checked
                      setForm((f) => {
                        // Seed the override with the generic text so it starts as a tweak, not a blank page.
                        if (on && !f.ovr[tab].text.trim() && f.text.trim()) {
                          const max = PLATFORMS[tab].maxLength
                          const seeded = f.text.slice(0, max)
                          if (seeded.length < f.text.length)
                            toast(
                              `${PLATFORMS[tab].label} limit is ${max.toLocaleString('en-US')} chars — generic text was trimmed to fit`,
                              'error',
                            )
                          return { ...f, ovr: { ...f.ovr, [tab]: { ...f.ovr[tab], on, text: seeded } } }
                        }
                        return { ...f, ovr: { ...f.ovr, [tab]: { ...f.ovr[tab], on } } }
                      })
                    }}
                  />
                  <span style={{ fontSize: 12.5 }}>
                    Override content for <b>{PLATFORMS[tab].label}</b> (character limit{' '}
                    {PLATFORMS[tab].maxLength.toLocaleString('en-US')})
                  </span>
                </label>
                {tab === 'REDDIT' && (
                  <label className="field">
                    <span className="lab" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ flex: 1 }}>
                        {PLATFORMS[tab].label} title — required, falls back to the generic title when empty
                      </span>
                      <CopyButton value={form.ovr[tab].title} />
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
                )}
                <label className="field">
                  <span className="lab" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ flex: 1 }}>
                      {PLATFORMS[tab].label} text — required when the override is enabled
                    </span>
                    <CopyButton value={form.ovr[tab].text} />
                  </span>
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
                  <span className="lab" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ flex: 1 }}>
                      {PLATFORMS[tab].label} link — optional, falls back to the generic link when empty
                    </span>
                    <CopyButton value={form.ovr[tab].link} />
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
                {tab === 'X' && form.ovr[tab].on && effectiveLink(form, 'X').trim() && (
                  <p className="hint" style={{ margin: '10px 0 0', color: 'var(--warn)' }}>
                    ⚠ An X post that includes a link consumes ~13× more API credits than a link-free one.
                  </p>
                )}
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

            <div className="btn-row" style={{ marginTop: 14 }}>
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
          </div>

          <PostPreview
            tab={previewPlatform}
            contentFor={(p) =>
              p === 'GENERIC'
                ? { title: form.title, text: form.text, link: form.link }
                : {
                    title: effectiveTitle(form, p),
                    text: effectiveText(form, p),
                    link: effectiveLink(form, p),
                  }
            }
            accounts={accounts}
            note={(p) => (p !== 'GENERIC' && form.ovr[p].on ? ' · platform override' : ' · generic text')}
            onSelectTab={setPreviewPlatform}
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
                    {postedAccountIds.has(a.id) && <Pill value="SUCCESS" label="posted" />}
                    <Pill value={a.status} />
                  </span>
                  <PlatformChip platform={a.platform} />
                </label>
              ))
            )}
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button
                className="btn primary"
                onClick={() => {
                  setResults(null)
                  setPublishOpen(true)
                }}
                disabled={!apiAccounts.length}
              >
                {readOnly ? 'Republish…' : 'Publish…'}
              </button>
            </div>
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
                  <div key={a.id} className="pick static" style={{ marginBottom: 6 }}>
                    <PlatformChip platform={a.platform} />
                    <span className="who" style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      {profileUrl ? (
                        <a
                          href={profileUrl}
                          target="_blank"
                          rel="noreferrer"
                          title={`${name} — open the ${PLATFORMS[a.platform].label} ${a.platform === 'REDDIT' ? 'subreddit' : 'page/profile'}`}
                          style={{
                            fontSize: 12.5,
                            fontWeight: 600,
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
                        <b style={{ fontSize: 12.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>
                          {name}
                        </b>
                      )}
                      {postedAccountIds.has(a.id) && <Pill value="SUCCESS" label="posted" />}
                      <Pill value={a.status} />
                    </span>
                  </div>
                )
              })}
              <div className="btn-row" style={{ marginTop: 10 }}>
                <button className="btn" onClick={() => setManualOpen(true)}>
                  <Icon name="external" />
                  Manual publish…
                </button>
              </div>
            </div>
          )}


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
      </div>

      {!readOnly && aiVisited && (
        <div style={{ display: page === 'ai' ? undefined : 'none' }}>
          <GeneratePanel
            providers={providers}
            loading={providersQuery.data === undefined && providersQuery.loading}
            refreshProviders={providersQuery.refetch}
            draft={aiDraftFromForm(form)}
            onApply={applyGenerated}
            onGoToProviders={() => nav('/ai')}
          />
        </div>
      )}

      {manualOpen && (
        <ManualPublishDialog
          accounts={manualAccounts}
          postedAccountIds={postedAccountIds}
          shareBusy={shareBusy}
          recordingId={manualBusy ? manualRecordingId : null}
          onClose={() => setManualOpen(false)}
          onOpenShare={(a) => void openShare(a)}
          onRecord={(a, url) => doManualPublish(a.id, url)}
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
