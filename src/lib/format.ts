export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** First line / trimmed snippet of a post for list rows and previews. */
export function snippet(text: string, max = 80): string {
  const firstLine = text.split('\n').find((l) => l.trim()) ?? ''
  return firstLine.length > max ? firstLine.slice(0, max - 1) + '…' : firstLine
}
