import type { ContactHit } from '@/lib/contactsAlgolia'
import type { CompanyHit } from '@/lib/companiesAlgolia'

type AlgoliaHighlightField = {
  value?: string
  matchLevel?: 'none' | 'partial' | 'full'
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function sanitizeAlgoliaHighlight(value: string): string {
  const withMarks = value
    .replace(/<em>/gi, '<mark class="search-highlight">')
    .replace(/<\/em>/gi, '</mark>')

  return withMarks.replace(/<(?!\/?mark\b)[^>]+>/gi, '')
}

function getAlgoliaHighlightValue(hit: ContactHit, attribute: string): string | null {
  const highlight = hit._highlightResult?.[attribute] as AlgoliaHighlightField | undefined
  if (!highlight?.value || highlight.matchLevel === 'none') return null
  return sanitizeAlgoliaHighlight(highlight.value)
}

export function highlightQueryInText(text: string, query: string): string {
  const trimmedQuery = query.trim()
  if (!trimmedQuery || !text) return escapeHtml(text)

  const pattern = new RegExp(`(${escapeRegExp(trimmedQuery)})`, 'gi')
  return escapeHtml(text).replace(
    pattern,
    '<mark class="search-highlight">$1</mark>',
  )
}

export function renderContactNameHighlight(
  hit: ContactHit,
  fallback: string,
  query: string,
  source: 'algolia' | 'firestore',
): string {
  if (source === 'algolia') {
    const highlighted =
      getAlgoliaHighlightValue(hit, 'fullName') ??
      getAlgoliaHighlightValue(hit, 'objectLabel')
    if (highlighted) return highlighted
  }

  if (query.trim()) {
    return highlightQueryInText(fallback, query)
  }

  return escapeHtml(fallback)
}

export function renderContactFieldHighlight(
  hit: ContactHit,
  attribute: 'position' | 'department' | 'mobile' | 'email' | 'company.objectLabel',
  fallback: string,
  query: string,
  source: 'algolia' | 'firestore',
): string {
  if (!fallback || fallback === '—') return escapeHtml(fallback)

  if (source === 'algolia') {
    const highlighted = getAlgoliaHighlightValue(hit, attribute)
    if (highlighted) return highlighted
  }

  if (query.trim()) {
    return highlightQueryInText(fallback, query)
  }

  return escapeHtml(fallback)
}

function getCompanyAlgoliaHighlightValue(hit: CompanyHit, attribute: string): string | null {
  const highlight = hit._highlightResult?.[attribute] as AlgoliaHighlightField | undefined
  if (!highlight?.value || highlight.matchLevel === 'none') return null
  return sanitizeAlgoliaHighlight(highlight.value)
}

export function renderCompanyNameHighlight(
  hit: CompanyHit,
  fallback: string,
  query: string,
  source: 'algolia' | 'firestore',
): string {
  if (source === 'algolia') {
    const highlighted =
      getCompanyAlgoliaHighlightValue(hit, 'name') ??
      getCompanyAlgoliaHighlightValue(hit, 'objectLabel')
    if (highlighted) return highlighted
  }

  if (query.trim()) {
    return highlightQueryInText(fallback, query)
  }

  return escapeHtml(fallback)
}

export function renderCompanyFieldHighlight(
  hit: CompanyHit,
  attribute: 'city' | 'companyType.label' | 'country.label' | 'industry.label',
  fallback: string,
  query: string,
  source: 'algolia' | 'firestore',
): string {
  if (!fallback || fallback === '—') return escapeHtml(fallback)

  if (source === 'algolia') {
    const highlighted = getCompanyAlgoliaHighlightValue(hit, attribute)
    if (highlighted) return highlighted
  }

  if (query.trim()) {
    return highlightQueryInText(fallback, query)
  }

  return escapeHtml(fallback)
}
