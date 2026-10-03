import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { postsApi } from '../api/posts'
import type { PostDto } from '../api/types'
import { Icon } from '../components/Icon'
import { ErrorBlock, Loading, Pill, SectionHead } from '../components/ui'
import { useApiQuery } from '../hooks/useApiQuery'
import { fmtDateTime, snippet } from '../lib/format'

type Tab = 'ALL' | 'DRAFT' | 'PARTIALLY_PUBLISHED' | 'PUBLISHED'

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'PARTIALLY_PUBLISHED', label: 'Partially published' },
  { key: 'PUBLISHED', label: 'Published' },
]

function PostRow({ post }: { post: PostDto }) {
  const nav = useNavigate()
  const sev = post.status === 'PUBLISHED' ? 'sev-ok' : 'sev-med'
  return (
    <button className="row" style={{ gridTemplateColumns: '1fr auto auto' }} onClick={() => nav(`/posts/${post.id}`)}>
      <span className={`sev ${sev}`} />
      <div style={{ minWidth: 0 }}>
        <div className="title">{post.content.title ?? snippet(post.content.text)}</div>
        <div className="meta" style={{ marginTop: 2 }}>
          {fmtDateTime(post.updatedAt)}
          {Object.keys(post.overrides ?? {}).length ? ' · has platform overrides' : ''}
        </div>
      </div>
      <div className="meta" style={{ textAlign: 'right' }}>#{post.id}</div>
      <Pill value={post.status} />
    </button>
  )
}

export default function PostsView() {
  const [tab, setTab] = useState<Tab>('ALL')
  const { data, error, loading, refetch } = useApiQuery(() => postsApi.list(), ['posts'])

  if (loading && !data) return <Loading />
  if (error && !data) return <ErrorBlock error={error} onRetry={refetch} />

  const posts = data ?? []
  const filtered = tab === 'ALL' ? posts : posts.filter((p) => p.status === tab)
  const counts = {
    ALL: posts.length,
    DRAFT: posts.filter((p) => p.status === 'DRAFT').length,
    PARTIALLY_PUBLISHED: posts.filter((p) => p.status === 'PARTIALLY_PUBLISHED').length,
    PUBLISHED: posts.filter((p) => p.status === 'PUBLISHED').length,
  }

  return (
    <>
      <SectionHead
        title="Posts"
        hint="one post → several platforms"
        actions={
          <Link className="btn primary" to="/posts/new">
            <Icon name="plus" />
            New post
          </Link>
        }
      />
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
            <span className="mono" style={{ marginLeft: 6, opacity: 0.6 }}>
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>
      <div className="card list">
        {filtered.length ? (
          filtered.map((p) => <PostRow key={p.id} post={p} />)
        ) : (
          <div className="empty">
            {posts.length === 0
              ? 'No posts yet. Create your first one — write once, publish to every connected account.'
              : 'No posts in this view.'}
          </div>
        )}
      </div>
      <p className="hint" style={{ marginTop: 10 }}>
        Select a post to view its publication history, edit it (drafts only) or republish it.
      </p>
    </>
  )
}
