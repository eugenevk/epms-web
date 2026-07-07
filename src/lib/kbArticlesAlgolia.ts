import {
  filterKbArticleHitsWithFacets,
  loadAllKbArticlesFromFirestore,
} from '@/lib/kbArticles'
import { GRID_PAGE_SIZE } from '@/lib/gridPagination'

export type KbArticleHit = {
  objectID: string
  id?: string
  title?: string
  body?: string
  categories?: string[]
  publishedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  _highlightResult?: Record<string, { value?: string; matchLevel?: 'none' | 'partial' | 'full' }>
}

export type KbArticleFacetKey = 'categories'

export const KB_ARTICLE_FACET_KEYS: KbArticleFacetKey[] = ['categories']

export type KbArticleFacetFilters = Partial<Record<KbArticleFacetKey, string[]>>

export type SearchKbArticlesParams = {
  query?: string
  facetFilters?: KbArticleFacetFilters
}

export type SearchKbArticlesResult = {
  hits: KbArticleHit[]
  nbHits: number
  page: number
  nbPages: number
  facets: Partial<Record<KbArticleFacetKey, Record<string, number>>>
  source: 'firestore'
}

export function kbArticleRecordId(article: KbArticleHit): string {
  return article.id ?? article.objectID
}

function getKbArticleFacetValues(hit: KbArticleHit, key: KbArticleFacetKey): string[] {
  if (key === 'categories') return hit.categories ?? []
  return []
}

function buildKbArticleFacets(
  hits: KbArticleHit[],
): Partial<Record<KbArticleFacetKey, Record<string, number>>> {
  const facets: Partial<Record<KbArticleFacetKey, Record<string, number>>> = {}

  for (const key of KB_ARTICLE_FACET_KEYS) {
    const counts: Record<string, number> = {}
    for (const hit of hits) {
      for (const value of getKbArticleFacetValues(hit, key)) {
        counts[value] = (counts[value] ?? 0) + 1
      }
    }
    if (Object.keys(counts).length > 0) {
      facets[key] = counts
    }
  }

  return facets
}

function compareKbArticleHits(left: KbArticleHit, right: KbArticleHit): number {
  const leftUpdated = left.updatedAt ?? left.createdAt ?? ''
  const rightUpdated = right.updatedAt ?? right.createdAt ?? ''
  if (leftUpdated !== rightUpdated) {
    return rightUpdated.localeCompare(leftUpdated, 'en', { sensitivity: 'base' })
  }

  return (left.title ?? '').localeCompare(right.title ?? '', 'en', { sensitivity: 'base' })
}

export function formatKbArticleFacetLabel(_key: KbArticleFacetKey, value: string): string {
  return value
}

export async function searchKbArticles(
  params: SearchKbArticlesParams = {},
): Promise<SearchKbArticlesResult> {
  const facetFilters = params.facetFilters ?? {}
  const queryText = params.query ?? ''
  const all = await loadAllKbArticlesFromFirestore()
  const hits = filterKbArticleHitsWithFacets(all, queryText, facetFilters).sort(compareKbArticleHits)

  return {
    hits,
    nbHits: hits.length,
    page: 0,
    nbPages: Math.max(1, Math.ceil(hits.length / GRID_PAGE_SIZE)),
    facets: buildKbArticleFacets(all),
    source: 'firestore',
  }
}
