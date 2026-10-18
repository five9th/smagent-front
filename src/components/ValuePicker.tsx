import { useState } from 'react'

export interface Suggestion {
  value: string
  label: string
}

const CUSTOM = '__custom__'

/**
 * Dropdown fed by a backend listing (models, base URLs…), with an escape
 * hatch: "Custom…" swaps it for a free-text input — listings are suggestions,
 * not exhaustive (custom endpoints, brand-new models must stay enterable).
 * With no suggestions available it degrades to a plain input.
 */
export function ValuePicker({
  value,
  onChange,
  suggestions,
  placeholder,
  /** Label of the empty option; omit when empty isn't a valid choice. */
  emptyLabel,
  type = 'text',
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  suggestions: Suggestion[]
  placeholder?: string
  emptyLabel?: string
  type?: string
  disabled?: boolean
}) {
  const [custom, setCustom] = useState(false)
  const inList = suggestions.some((s) => s.value === value)
  // Custom mode: user asked for it, or the value isn't one of the suggestions.
  const customMode = custom || (value !== '' && !inList)

  if (!suggestions.length || customMode) {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type={type}
          value={value}
          disabled={disabled}
          autoComplete="off"
          // focus only when the user just picked "Custom…", not on plain mounts
          autoFocus={custom}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={{ minWidth: 0 }}
        />
        {suggestions.length > 0 && (
          <button
            type="button"
            className="btn ghost"
            style={{ padding: '5px 10px', fontSize: 11, whiteSpace: 'nowrap' }}
            disabled={disabled}
            title="Back to the suggestion list"
            onClick={() => {
              setCustom(false)
              onChange('')
            }}
          >
            list ▾
          </button>
        )}
      </div>
    )
  }

  return (
    <select
      value={inList ? value : ''}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value
        if (v === CUSTOM) setCustom(true)
        else onChange(v)
      }}
    >
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {suggestions.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
      <option value={CUSTOM}>Custom…</option>
    </select>
  )
}
