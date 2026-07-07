import { getAlgoliaIndex, isAlgoliaConfigured } from '@/lib/algoliaClient'
import type { ObjectRef } from '@/lib/companies'
import {
  loadAllCompanyProductsInUse,
  type CompanyProductInUse,
} from '@/lib/companyProductInUseRecords'
import { GRID_PAGE_SIZE } from '@/lib/gridPagination'
import { filterProductsInUse, productKindLabel, type ProductKind } from '@/lib/products'

export const PRODUCTS_IN_USE_INDEX = 'productsInUse'

export const PRODUCT_IN_USE_SEARCHABLE_ATTRIBUTES = [
  'name',
  'objectLabel',
  'description',
  'version',
  'kind',
  'company.objectLabel',
  'supplierCompany.objectLabel',
] as const

export type ProductInUseFacetKey = 'kind'

export const PRODUCT_IN_USE_FACET_KEYS: ProductInUseFacetKey[] = ['kind']

export type ProductInUseHit = {
  objectID: string
  id?: string
  name?: string
  objectLabel?: string
  kind?: ProductKind | string
  version?: string | null
  description?: string
  company?: ObjectRef
  supplierCompany?: ObjectRef
  _highlightResult?: Record<string, { value?: string; matchLevel?: 'none' | 'partial' | 'full' }>
}

export type ProductInUseFacetFilters = Partial<Record<ProductInUseFacetKey, string[]>>

export type SearchCompanyProductsInUseParams = {
  query?: string
  facetFilters?: ProductInUseFacetFilters
}

export type SearchCompanyProductsInUseResult = {
  hits: ProductInUseHit[]
  nbHits: number
  page: number
  nbPages: number
  facets: Partial<Record<ProductInUseFacetKey, Record<string, number>>>
  source: 'algolia' | 'firestore'
}

export function productInUseRecordId(hit: ProductInUseHit): string {
  return hit.id ?? hit.objectID
}

export function productInUseHitToRecord(hit: ProductInUseHit): CompanyProductInUse {
  const id = productInUseRecordId(hit)
  const kind = hit.kind === 'service' ? 'service' : 'product'
  const name = hit.name?.trim() || hit.objectLabel?.trim() || ''

  return {
    id,
    objectID: hit.objectID,
    objectType: 'ProductInUse',
    objectLabel: name,
    name,
    kind,
    version: hit.version?.trim() || null,
    description: hit.description ?? '',
    company: hit.company ?? { id: '', objectLabel: '' },
    supplierCompany: hit.supplierCompany ?? { id: '', objectLabel: '' },
    createdAt: null,
    createdBy: null,
    updatedAt: null,
    updatedBy: null,
  }
}

function getProductInUseFacetValue(hit: ProductInUseHit, key: ProductInUseFacetKey): string | undefined {
  if (key === 'kind') {
    return hit.kind === 'service' ? 'service' : hit.kind === 'product' ? 'product' : undefined
  }
  return undefined
}

function buildProductInUseFacetFilters(facetFilters: ProductInUseFacetFilters): string[][] {
  const filters: string[][] = []

  for (const key of PRODUCT_IN_USE_FACET_KEYS) {
    const values = facetFilters[key]
    if (!values?.length) continue
    filters.push(values.map((value) => `${key}:${value}`))
  }

  return filters
}

function buildProductInUseFacets(
  hits: ProductInUseHit[],
): Partial<Record<ProductInUseFacetKey, Record<string, number>>> {
  const facets: Partial<Record<ProductInUseFacetKey, Record<string, number>>> = {}

  for (const key of PRODUCT_IN_USE_FACET_KEYS) {
    const counts: Record<string, number> = {}
    for (const hit of hits) {
      const value = getProductInUseFacetValue(hit, key)
      if (!value) continue
      counts[value] = (counts[value] ?? 0) + 1
    }
    if (Object.keys(counts).length > 0) {
      facets[key] = counts
    }
  }

  return facets
}

function normalizeProductInUseHit(hit: ProductInUseHit): ProductInUseHit {
  const id = hit.id ?? hit.objectID
  return {
    ...hit,
    id,
    objectID: id,
    name: hit.name ?? hit.objectLabel ?? '',
  }
}

function compareProductInUseHits(left: ProductInUseHit, right: ProductInUseHit): number {
  const companyCompare = (left.company?.objectLabel ?? '').localeCompare(
    right.company?.objectLabel ?? '',
    'en',
    { sensitivity: 'base' },
  )
  if (companyCompare !== 0) return companyCompare

  return (left.name ?? '').localeCompare(right.name ?? '', 'en', { sensitivity: 'base' })
}

export function productInUseKindFacetLabel(value: string): string {
  return productKindLabel(value)
}

export function selectedKindLabelsToProductInUseFacetFilters(
  selectedKindLabels: string[],
): ProductInUseFacetFilters {
  if (selectedKindLabels.length === 0) return {}

  const values = selectedKindLabels.map((label) => (label === 'Service' ? 'service' : 'product'))
  return { kind: values }
}

export function productInUseFacetsToKindCounts(
  facets: Partial<Record<ProductInUseFacetKey, Record<string, number>>>,
): Record<string, number> {
  const kindFacets = facets.kind ?? {}
  const counts: Record<string, number> = {}

  for (const [value, count] of Object.entries(kindFacets)) {
    counts[productInUseKindFacetLabel(value)] = count
  }

  return counts
}

export async function searchCompanyProductsInUse(
  params: SearchCompanyProductsInUseParams = {},
): Promise<SearchCompanyProductsInUseResult> {
  const facetFilters = params.facetFilters ?? {}
  const queryText = params.query ?? ''

  if (!isAlgoliaConfigured()) {
    const all = await loadAllCompanyProductsInUse()
    const filtered = filterProductsInUse(all, queryText).filter((item) => {
      const selected = facetFilters.kind
      if (!selected?.length) return true
      return selected.includes(item.kind)
    })

    return {
      hits: filtered.map((item) => productInUseHitToRecord(item)),
      nbHits: filtered.length,
      page: 0,
      nbPages: Math.max(1, Math.ceil(filtered.length / GRID_PAGE_SIZE)),
      facets: buildProductInUseFacets(filtered.map((item) => productInUseHitToRecord(item))),
      source: 'firestore',
    }
  }

  const facetFilterGroups = buildProductInUseFacetFilters(facetFilters)
  const index = getAlgoliaIndex(PRODUCTS_IN_USE_INDEX)

  try {
    const response = await index.search<ProductInUseHit>(queryText, {
      hitsPerPage: 1000,
      ...(facetFilterGroups.length ? { facetFilters: facetFilterGroups } : {}),
      facets: [...PRODUCT_IN_USE_FACET_KEYS],
      restrictSearchableAttributes: [...PRODUCT_IN_USE_SEARCHABLE_ATTRIBUTES],
    })

    const hits = response.hits
      .map((hit) => normalizeProductInUseHit({ ...hit, id: hit.id ?? hit.objectID }))
      .sort(compareProductInUseHits)

    return {
      hits,
      nbHits: hits.length,
      page: 0,
      nbPages: Math.max(1, Math.ceil(hits.length / GRID_PAGE_SIZE)),
      facets:
        (response.facets as Partial<Record<ProductInUseFacetKey, Record<string, number>>>) ??
        buildProductInUseFacets(hits),
      source: 'algolia',
    }
  } catch {
    const all = await loadAllCompanyProductsInUse()
    const filtered = filterProductsInUse(all, queryText).filter((item) => {
      const selected = facetFilters.kind
      if (!selected?.length) return true
      return selected.includes(item.kind)
    })

    return {
      hits: filtered.map((item) => productInUseHitToRecord(item)),
      nbHits: filtered.length,
      page: 0,
      nbPages: Math.max(1, Math.ceil(filtered.length / GRID_PAGE_SIZE)),
      facets: buildProductInUseFacets(filtered.map((item) => productInUseHitToRecord(item))),
      source: 'firestore',
    }
  }
}
