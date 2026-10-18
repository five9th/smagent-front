import type { AccountDto, Platform } from '../api/types'
import { PLATFORMS, PLATFORM_LIST } from '../lib/platform'

/** Tabs a preview can render: the generic variant or one per platform. */
export type PreviewTab = 'GENERIC' | Platform

export interface PreviewContent {
  title: string
  text: string
  link: string
}

/**
 * Platform-styled post preview shared by the post editor and the AI generate
 * UI. The caller resolves effective content per tab (per-field fallback);
 * GENERIC content has no platform limit, so the counter line hides there.
 */
export function PostPreview({
  tab,
  tabs = PLATFORM_LIST,
  contentFor,
  accounts,
  note,
  onSelectTab,
  placeholder = 'Nothing yet — start typing the generic text.',
}: {
  /** Variant shown. */
  tab: PreviewTab
  /** Switcher set; the switcher itself hides when onSelectTab is omitted. */
  tabs?: PreviewTab[]
  /** Effective content per tab (the caller resolves the per-field fallback). */
  contentFor: (tab: PreviewTab) => PreviewContent
  /** Optional — the header shows a matching account's display name. */
  accounts?: AccountDto[]
  /** Suffix on the counter line, e.g. ' · platform override'; absent = none. */
  note?: (tab: PreviewTab) => string | null
  onSelectTab?: (tab: PreviewTab) => void
  placeholder?: string
}) {
  const label = tab === 'GENERIC' ? 'Generic' : PLATFORMS[tab].label
  const account = tab === 'GENERIC' ? undefined : accounts?.find((a) => a.platform === tab)
  const { title, text, link } = contentFor(tab)
  const len = text.length
  /** Generic content has no platform limit — the counter (and over state) hides. */
  const max = tab === 'GENERIC' ? null : PLATFORMS[tab].maxLength
  const over = max !== null && len > max
  const noteStr = note?.(tab) ?? ''

  return (
    <div className={`preview ${over ? 'over' : ''}`}>
      <div className="ph">
        <div className="av">{label[0]}</div>
        <div>
          <div className="pn">{account?.displayName ?? label}</div>
          <div className="pt">{label} · preview - beta</div>
        </div>
        {onSelectTab && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {tabs.map((t) => (
              <button
                key={t}
                className="btn ghost"
                style={{ padding: '4px 9px', fontSize: 11, opacity: t === tab ? 1 : 0.5 }}
                onClick={() => onSelectTab(t)}
                disabled={t === tab}
              >
                {(t === 'GENERIC' ? 'Generic' : PLATFORMS[t].label)[0]}
              </button>
            ))}
          </div>
        )}
      </div>
      {(tab === 'REDDIT' || tab === 'GENERIC') && title.trim() && (
        <div className="pbody" style={{ fontWeight: 600, marginBottom: 6 }}>
          {title}
        </div>
      )}
      <div className="pbody">
        {text || <span style={{ color: 'var(--text-mute)' }}>{placeholder}</span>}
      </div>
      {link && (
        <div className="meta mono" style={{ marginTop: 8, overflowWrap: 'anywhere' }}>
          🔗{' '}
          <a href={link} target="_blank" rel="noreferrer">
            {link}
          </a>
        </div>
      )}
      {(max !== null || noteStr) && (
        <div className="pcount">
          {max !== null && (
            <>
              {len.toLocaleString('en-US')} / ~{max.toLocaleString('en-US')} chars
              {over && ` — ${len - max} over (soft limit, not enforced)`}
            </>
          )}
          {noteStr}
        </div>
      )}
    </div>
  )
}
