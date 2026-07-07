import { stripHtml } from '@/lib/plainTextSearch'

export function isEmptyRichText(html: string | null | undefined): boolean {
  if (!html) return true
  return stripHtml(html).length === 0
}

export function isRichTextContent(html: string | null | undefined): boolean {
  return Boolean(html?.includes('<'))
}

export function richTextPreviewText(html: string | null | undefined, maxLength = 160): string {
  const plain = stripHtml(html ?? '')
  if (!plain) return '—'
  if (plain.length <= maxLength) return plain
  return `${plain.slice(0, maxLength).trim()}…`
}
