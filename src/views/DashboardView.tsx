import { Link, useNavigate } from 'react-router-dom'
import { accountsApi } from '../api/accounts'
import { postsApi } from '../api/posts'
import type { AccountDto, PostDto, PublicationDto } from '../api/types'
import { Icon } from '../components/Icon'
import {
  Callout,
  ErrorBlock,
  Loading,
  Pill,
  PlatformChip,
  Tile,
} from '../components/ui'
import { useApiQuery } from '../hooks/useApiQuery'
import { fmtDateTime } from '../lib/format'

interface DashboardData {
  posts: PostDto[]
  accounts: AccountDto[]
  recentPublications: Array<PublicationDto & { postTitle: string | null }>
}

async function loadDashboard(): Promise<DashboardData> {
  const [posts, accounts] = await Promise.all([postsApi.list(), accountsApi.list()])
  // Publications are only included on single-post GETs (and /api/publications
  // requires postId), so fan out over the newest published posts.
  const newestPublished = posts.filter((p) => p.status === 'PUBLISHED').slice(0, 5)
  const details = await Promise.all(
    newestPublished.map((p) => postsApi.get(p.id).catch(() => null)),
  )
  const titleById = new Map(details.map((d) => [d?.id, d]))
  const recentPublications = details
    .filter((d): d is PostDto => d !== null)
    .flatMap((d) =>
      d.publications.map((pub) => ({ ...pub, postTitle: titleById.get(d.id)?.content.title ?? null })),
    )
    .sort((a, b) => (a.publishedAt ?? a.createdAt).localeCompare(b.publishedAt ?? b.createdAt))
    .reverse()
    .slice(0, 8)
  return { posts, accounts, recentPublications }
}

function PublicationRow({ pub }: { pub: DashboardData['recentPublications'][number] }) {
  const nav = useNavigate()
  return (
    <button className="row" onClick={() => nav(`/posts/${pub.postId}`)}>
      <span className={`sev ${pub.status === 'SUCCESS' ? 'sev-ok' : pub.status === 'FAILED' ? 'sev-high' : 'sev-med'}`} />
      <div style={{ minWidth: 0 }}>
        <div className="title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PlatformChip platform={pub.platform} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pub.accountName}
          </span>
        </div>
        <div className="meta" style={{ marginTop: 2 }}>
          {fmtDateTime(pub.publishedAt ?? pub.createdAt)}
          {pub.postTitle ? ` · ${pub.postTitle}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
        {pub.externalUrl && (
          <a
            className="iconlink"
            href={pub.externalUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={pub.externalUrl}
          >
            <Icon name="external" />
          </a>
        )}
        <Pill value={pub.status} />
      </div>
    </button>
  )
}

export default function DashboardView() {
  const { data, error, loading, refetch } = useApiQuery(loadDashboard, ['dashboard'])

  if (loading && !data) return <Loading />
  if (error && !data) return <ErrorBlock error={error} onRetry={refetch} />

  const posts = data?.posts ?? []
  const accounts = data?.accounts ?? []
  const drafts = posts.filter((p) => p.status === 'DRAFT').length
  const published = posts.length - drafts
  const active = accounts.filter((a) => a.status === 'ACTIVE').length
  const attention = accounts.length - active
  const hasAccounts = accounts.length > 0
  const hasPosts = posts.length > 0

  return (
    <>
      {!hasAccounts && (
        <Callout tone="warn">
          <b>No social accounts connected yet.</b>{' '}
          <Link to="/accounts">Connect your first account</Link> to start publishing.
        </Callout>
      )}

      <div className="grid cols-4" style={{ marginBottom: 8 }}>
        <Tile label="Drafts" value={drafts} tone="gold" sub={drafts ? 'awaiting publish' : 'queue clear'} />
        <Tile label="Published" value={published} tone="ok" sub="saved with full history" />
        <Tile
          label="Active accounts"
          value={`${active}/${accounts.length}`}
          tone={active ? 'ok' : 'mute'}
          sub="verified & ready"
        />
        <Tile
          label="Needs attention"
          value={attention}
          tone={attention ? 'warn' : 'mute'}
          sub={attention ? 'unverified or invalid' : 'all accounts healthy'}
        />
      </div>

      <div className="section-head">
        <h2>Recent publications</h2>
        <span className="hint">newest attempts across published posts</span>
      </div>
      <div className="card list">
        {data && data.recentPublications.length > 0 ? (
          data.recentPublications.map((pub) => <PublicationRow key={pub.id} pub={pub} />)
        ) : (
          <div className="empty">
            {hasPosts
              ? 'No publication attempts yet — open a draft and hit Publish.'
              : 'Nothing here yet. Create your first post to see publication activity.'}
          </div>
        )}
      </div>

      <div className="grid cols-2" style={{ marginTop: 22 }}>
        <div>
          <div className="section-head">
            <h2>Account health</h2>
            <span className="hint mono">
              <Link to="/accounts">manage →</Link>
            </span>
          </div>
          <div className="card list">
            {hasAccounts ? (
              accounts.map((a) => (
                <Link key={a.id} to="/accounts" className="row" style={{ gridTemplateColumns: '1fr auto' }}>
                  <div>
                    <div className="title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <PlatformChip platform={a.platform} />
                    </div>
                    <div className="meta" style={{ marginTop: 2 }}>{a.displayName ?? 'unnamed account'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Pill value={a.status} />
                    <div className="meta" style={{ marginTop: 4 }}>since {fmtDateTime(a.createdAt)}</div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="empty">No accounts connected.</div>
            )}
          </div>
        </div>
        <div>
          <div className="section-head">
            <h2>Getting around</h2>
          </div>
          <div className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Callout>
              <b>Compose once, publish everywhere.</b> Write a post, optionally tailor the text per
              platform, pick target accounts and publish — one attempt per account, results shown
              per target. <Link to="/posts/new">Create a post →</Link>
            </Callout>
            <Callout>
              <b>AI assistance is on the way.</b> Provider management, token usage and text
              generation are designed but not implemented on the backend yet.{' '}
              <Link to="/ai">Preview the AI panel →</Link>
            </Callout>
            <Callout tone="warn">
              <b>Engagement inbox is coming too.</b> Comment and reaction tracking will land as
              polling-based sync. <Link to="/inbox">Preview the inbox →</Link>
            </Callout>
          </div>
        </div>
      </div>
    </>
  )
}
