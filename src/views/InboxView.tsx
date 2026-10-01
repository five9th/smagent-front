import { Callout, Pill, SectionHead } from '../components/ui'
import { Icon } from '../components/Icon'

/**
 * STUB VIEW — engagement tracking (/api/publications/{id}/sync-engagement,
 * /api/engagement-events, …) is designed but not implemented on the backend.
 * This screen previews the planned inbox; all controls are inert.
 */

const FILTERS = ['All', 'Unread', 'Comments', 'Reactions']

export default function InboxView() {
  return (
    <>
      <SectionHead
        title="Engagement inbox"
        hint={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>planned — not available yet <Pill value="PLANNED" /></span>}
      />

      <div className="tabs">
        {FILTERS.map((f, i) => (
          <span key={f} className={i === 0 ? 'active' : ''} style={{ padding: '8px 12px', cursor: 'default' }}>
            {f}
          </span>
        ))}
      </div>

      <div className="card list">
        <div className="empty">
          <span style={{ display: 'inline-block' }}>
            <Icon name="inbox" className="ico" />
          </span>
          <div>Nothing here yet — this feature is still in the works.</div>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <Callout>
          <b>How it will work.</b> SMAgent will regularly check your connected platforms and collect new
          comments and reactions for you — no public server or special platform permissions needed.
        </Callout>
        <Callout>
          <b>What you’ll see.</b> One feed of comments and reactions across all your published posts, with
          counts per post and a “check everything now” action.
        </Callout>
      </div>
    </>
  )
}
