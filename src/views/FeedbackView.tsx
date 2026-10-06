import { useState, type FormEvent } from 'react'
import { feedbackApi, type FeedbackDto } from '../api/feedback'
import { Icon } from '../components/Icon'
import { ErrorBlock, InlineError, Loading, SectionHead, Spinner } from '../components/ui'
import { useApiQuery } from '../hooks/useApiQuery'
import { useToast } from '../hooks/useToast'
import { describeError } from '../lib/errors'
import { fmtDateTime } from '../lib/format'

/**
 * Demo feedback checklist — standalone items backed by /api/feedback.
 * Add, check/uncheck, delete. Nothing here relates to posts or accounts.
 */
export default function FeedbackView() {
  const toast = useToast()
  const { data, error, loading, refetch } = useApiQuery(() => feedbackApi.list(), ['feedback'])
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)
  const [formError, setFormError] = useState<unknown>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const items = data ?? []

  const add = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    setAdding(true)
    setFormError(null)
    try {
      await feedbackApi.create(trimmed)
      setText('')
      refetch()
    } catch (err) {
      setFormError(err)
    } finally {
      setAdding(false)
    }
  }

  const toggle = async (item: FeedbackDto) => {
    setBusyId(item.id)
    try {
      await feedbackApi.update(item.id, { checked: !item.checked })
      await refetch()
    } catch (err) {
      toast(describeError(err), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (item: FeedbackDto) => {
    setBusyId(item.id)
    try {
      await feedbackApi.remove(item.id)
      toast('Feedback item deleted')
      refetch()
    } catch (err) {
      toast(describeError(err), 'error')
    } finally {
      setBusyId(null)
    }
  }

  if (loading && !data) return <Loading />
  if (error && !data) return <ErrorBlock error={error} onRetry={refetch} />

  const open = items.filter((i) => !i.checked).length

  return (
    <>
      <SectionHead title="Demo feedback" hint="a scratch checklist for demo sessions — nothing here touches posts or accounts" />
      <div className="grid cols-3" style={{ marginBottom: 8 }}>
        <div className="card tile">
          <span className="stripe" style={{ background: 'var(--gold)' }} />
          <div className="eyebrow">Items</div>
          <div className="k num">{items.length}</div>
        </div>
        <div className="card tile">
          <span className="stripe" style={{ background: 'var(--ok)' }} />
          <div className="eyebrow">Unchecked</div>
          <div className="k num">{open}</div>
        </div>
        <div className="card tile">
          <span className="stripe" style={{ background: 'var(--info)' }} />
          <div className="eyebrow">Done</div>
          <div className="k num">{items.length - open}</div>
        </div>
      </div>

      <form
        onSubmit={add}
        style={{ display: 'flex', gap: 8, margin: '14px 0 16px', alignItems: 'flex-start' }}
      >
        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void add(e)
          }}
          placeholder="Here you can add a note for developer to fix/change/add a feature…"
          style={{ flex: 1, minHeight: 0 }}
        />
        <button className="btn primary" disabled={adding || !text.trim()}>
          {adding ? <Spinner /> : 'Add'}
        </button>
      </form>
      {formError != null && (
        <div style={{ marginBottom: 12 }}>
          <InlineError error={formError} />
        </div>
      )}

      <div className="card list">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="row plain" style={{ gridTemplateColumns: 'auto 1fr auto' }}>
              <span className={`sev ${item.checked ? 'sev-ok' : 'sev-med'}`} />
              <input
                type="checkbox"
                checked={item.checked}
                disabled={busyId === item.id}
                onChange={() => void toggle(item)}
                aria-label={item.checked ? 'Mark as not done' : 'Mark as done'}
              />
              <div style={{ minWidth: 0 }}>
                <div
                  className="title"
                  style={{
                    whiteSpace: 'pre-wrap',
                    ...(item.checked
                      ? { textDecoration: 'line-through', color: 'var(--text-mute)' }
                      : {}),
                  }}
                >
                  {item.text}
                </div>
                <div className="meta" style={{ marginTop: 2 }}>{fmtDateTime(item.createdAt)}</div>
              </div>
              <button
                className="iconlink"
                onClick={() => void remove(item)}
                disabled={busyId === item.id}
                title="Delete item"
                aria-label="Delete item"
              >
                <Icon name="trash" />
              </button>
            </div>
          ))
        ) : (
          <div className="empty">Nothing noted yet — add the first item above.</div>
        )}
      </div>
    </>
  )
}
