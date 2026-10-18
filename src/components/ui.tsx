import { useEffect, useState, type ReactNode } from 'react'
import type { Platform } from '../api/types'
import { describeError } from '../lib/errors'
import { PLATFORMS } from '../lib/platform'
import { Icon } from './Icon'

/* --- Status pill ---------------------------------------------------------- */

const PILL_CLASS: Record<string, string> = {
  DRAFT: 'p-draft',
  PUBLISHED: 'p-published',
  PENDING: 'p-submitted',
  SUCCESS: 'p-approved',
  FAILED: 'p-failed',
  ACTIVE: 'p-approved',
  UNVERIFIED: 'p-draft',
  INVALID: 'p-failed',
  PLANNED: 'p-scheduled',
  MANUAL: 'p-manual',
}

export function Pill({ value, label }: { value: string; label?: string }) {
  const cls = PILL_CLASS[value] ?? 'p-draft'
  return (
    <span className={`pill ${cls}`}>
      <i />
      {(label ?? value).replace(/_/g, ' ').toLowerCase()}
    </span>
  )
}

/* --- Platform chip -------------------------------------------------------- */

export function PlatformChip({ platform, lg }: { platform: Platform; lg?: boolean }) {
  const meta = PLATFORMS[platform]
  return (
    <span className={`chan ${lg ? 'lg' : ''}`}>
      <span className={`g g-${platform.toLowerCase()}`}>{meta.label[0]}</span>
      {meta.label}
    </span>
  )
}

/* --- Linkified text (manual-posting links inside error messages) ----------- */

/** Renders plain text with any http(s) URLs as clickable links. */
export function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g)
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noreferrer" style={{ overflowWrap: 'anywhere' }}>
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  )
}

/** Compact copy-to-clipboard affordance for field labels. Inert when empty. */
export function CopyButton({ value, title = 'Copy to clipboard' }: { value: string; title?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="iconlink"
      style={{ opacity: value ? undefined : 0.3, cursor: value ? 'pointer' : 'default' }}
      disabled={!value}
      title={title}
      aria-label={title}
      onClick={(e) => {
        // keep the surrounding <label> from hijacking the click
        e.preventDefault()
        e.stopPropagation()
        navigator.clipboard.writeText(value).then(
          () => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          },
          () => {},
        )
      }}
    >
      <Icon name={copied ? 'check' : 'copy'} />
    </button>
  )
}

/* --- Layout bits ---------------------------------------------------------- */

export function SectionHead({
  title,
  hint,
  actions,
}: {
  title: string
  hint?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {hint && <span className="hint">{hint}</span>}
      {actions && <div className="actions">{actions}</div>}
    </div>
  )
}

export function Callout({
  tone = 'gold',
  children,
}: {
  tone?: 'gold' | 'warn' | 'danger'
  children: ReactNode
}) {
  return <div className={`callout ${tone === 'gold' ? '' : tone}`}>{children}</div>
}

export function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: ReactNode
  sub?: string
  tone?: 'gold' | 'ok' | 'warn' | 'danger' | 'mute'
}) {
  const color =
    tone === 'gold'
      ? 'var(--gold)'
      : tone === 'ok'
        ? 'var(--ok)'
        : tone === 'warn'
          ? 'var(--warn)'
          : tone === 'danger'
            ? 'var(--danger)'
            : 'var(--text-mute)'
  return (
    <div className="card tile">
      <span className="stripe" style={{ background: color }} />
      <div className="eyebrow">{label}</div>
      <div className="k num">{value}</div>
      {sub && <div className="l">{sub}</div>}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function Spinner({ lg }: { lg?: boolean }) {
  return <span className={`spinner ${lg ? 'lg' : ''}`} aria-label="Loading" />
}

export function Loading() {
  return (
    <div className="empty" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <Spinner /> Loading…
    </div>
  )
}

export function ErrorBlock({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { title, detail } = describeError(error)
  return (
    <div className="card pad" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <span style={{ color: 'var(--danger)', display: 'inline-flex', marginTop: 1 }}>
        <Icon name="alert" />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="errblock-title">{title}</div>
        {detail && <div className="errblock-detail">{detail}</div>}
      </div>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          <Icon name="refresh" /> Retry
        </button>
      )}
    </div>
  )
}

/** Compact inline error (forms, modals): bold title + smaller detail. */
export function InlineError({ error, title }: { error: unknown; title?: string }) {
  const d = describeError(error)
  const shownTitle = title ?? d.title
  const shownDetail = d.detail ?? (title ? d.title : undefined)
  return (
    <div className="errblock" role="alert">
      <div className="errblock-title">{shownTitle}</div>
      {shownDetail && <div className="errblock-detail">{shownDetail}</div>}
    </div>
  )
}

/* --- Modal ---------------------------------------------------------------- */

export function Modal({
  title,
  sub,
  onClose,
  wide,
  children,
  footer,
}: {
  title: string
  sub?: string
  onClose?: () => void
  /** Wider dialog for content that needs the room (e.g. AI result previews). */
  wide?: boolean
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!onClose) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="modal-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && onClose) onClose()
      }}
    >
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <div>
            <h3>{title}</h3>
            {sub && <div className="meta mono" style={{ color: 'var(--text-mute)', fontSize: 11 }}>{sub}</div>}
          </div>
          {onClose && (
            <button className="xbtn" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
        </header>
        <div className="body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  )
}

export function ConfirmModal({
  title,
  message,
  children,
  confirmLabel = 'Confirm',
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  title: string
  message: ReactNode
  /** Extra body content (options, warnings) below the message. */
  children?: ReactNode
  confirmLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal
      title={title}
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm} disabled={busy}>
            {busy ? <Spinner /> : confirmLabel}
          </button>
        </>
      }
    >
      <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{message}</div>
      {children}
    </Modal>
  )
}
