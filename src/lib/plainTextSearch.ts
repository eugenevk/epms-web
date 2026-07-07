export function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function excerptForSearch(
  value: string | null | undefined,
  maxChars = 12_000,
): string | undefined {
  if (!value?.trim()) {
    return undefined
  }

  const plain = value.includes('<') ? stripHtml(value) : value.trim()
  if (!plain) {
    return undefined
  }

  if (plain.length <= maxChars) {
    return plain
  }

  return `${plain.slice(0, maxChars)}…`
}
