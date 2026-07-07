import { collection, getDocs } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase'
import type { GridSortState } from '@/lib/gridSort'
import { stripHtml } from '@/lib/plainTextSearch'
import type { KbArticleFacetFilters, KbArticleHit } from '@/lib/kbArticlesAlgolia'

export const KB_ARTICLE_GRID_DEFAULT_SORT: GridSortState[] = [
  { column: 'title', direction: 'asc' },
]

export const KB_ARTICLE_SNIPPET_LENGTH = 120

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function mapTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
}

export function mapKbArticleHit(id: string, data: Record<string, unknown>): KbArticleHit {
  const categories = mapTags(data.categories)
  const legacyTags = mapTags(data.tags)
  const legacyCategory =
    data.category && typeof data.category === 'object'
      ? getString((data.category as { label?: unknown }).label)
      : undefined
  const resolvedCategories =
    categories.length > 0
      ? categories
      : legacyTags.length > 0
        ? legacyTags
        : legacyCategory
          ? [legacyCategory]
          : []

  return {
    objectID: id,
    id,
    title: getString(data.title) ?? getString(data.objectLabel) ?? '',
    body: getString(data.body) ?? '',
    categories: resolvedCategories,
    publishedAt: getString(data.publishedAt),
    createdAt: getString(data.createdAt),
    updatedAt: getString(data.updatedAt),
  }
}

export function kbArticlePreviewText(article: KbArticleHit, maxLength = 160): string {
  const plain = stripHtml(article.body ?? '')
  if (!plain) return '—'
  if (plain.length <= maxLength) return plain
  return `${plain.slice(0, maxLength).trim()}…`
}

export function kbArticleSnippetText(article: KbArticleHit): string {
  return kbArticlePreviewText(article, KB_ARTICLE_SNIPPET_LENGTH)
}

export function filterKbArticleHits(
  hits: KbArticleHit[],
  queryText: string,
): KbArticleHit[] {
  const needle = queryText.trim().toLowerCase()
  if (!needle) return hits

  return hits.filter((hit) => {
    const haystack = [
      hit.title,
      hit.categories?.join(' '),
      stripHtml(hit.body ?? ''),
      hit.publishedAt,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(needle)
  })
}

export function filterKbArticleHitsWithFacets(
  hits: KbArticleHit[],
  queryText: string,
  facetFilters: KbArticleFacetFilters = {},
): KbArticleHit[] {
  return filterKbArticleHits(hits, queryText).filter((hit) => {
    const categoryFilter = facetFilters.categories
    if (categoryFilter?.length) {
      const matches = hit.categories?.some((category) => categoryFilter.includes(category))
      if (!matches) return false
    }

    return true
  })
}

export async function loadAllKbArticlesFromFirestore(): Promise<KbArticleHit[]> {
  const snapshot = await getDocs(collection(getFirebaseDb(), 'kbArticles'))

  return snapshot.docs
    .map((document) => mapKbArticleHit(document.id, document.data()))
    .sort((left, right) => {
      const leftUpdated = left.updatedAt ?? left.createdAt ?? ''
      const rightUpdated = right.updatedAt ?? right.createdAt ?? ''
      return rightUpdated.localeCompare(leftUpdated, 'en', { sensitivity: 'base' })
    })
}
