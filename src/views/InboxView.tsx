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
        hint={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>backend not implemented — preview only <Pill value="PLANNED" /></span>}
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
          <div>Nothing here yet — engagement tracking hasn’t landed.</div>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <Callout>
          <b>How it will work.</b> Polling, not webhooks — Facebook Page webhooks require a public callback
          URL and app review, while polling the Graph API on demand needs neither. Each sync pulls comments
          and reactions per publication, stores them as events and updates counters. Webhooks remain a
          future upgrade once the app is reachable on a public domain.
        </Callout>
        <Callout>
          <b>What you’ll see.</b> A flat feed across all published posts — new comments and reactions with
          author, text and platform timestamp — plus per-publication counters (comments, reactions,
          last synced). A “Sync all” action will pull every successful publication of every active account.
        </Callout>
      </div>
    </>
  )
}
