import { getAlgoliaIndex, isAlgoliaConfigured } from '@/lib/algoliaClient'
import type { ObjectRef } from '@/lib/companies'
import {
  loadAllCompanyOfferings,
  type CompanyOffering,
} from '@/lib/companyOfferingRecords'
import { GRID_PAGE_SIZE } from '@/lib/gridPagination'
import { filterOfferings, productKindLabel, type ProductKind } from '@/lib/products'

export const OFFERINGS_INDEX = 'products'

export const OFFERING_SEARCHABLE_ATTRIBUTES = [
  'name',
  'objectLabel',
  'description',
  'kind',
  'objectType',
  'company.objectLabel',
] as const

export type OfferingFacetKey = 'objectType'

export const OFFERING_FACET_KEYS: OfferingFacetKey[] = ['objectType']

export type OfferingHit = {
  objectID: string
  id?: string
  name?: string
  objectLabel?: string
  kind?: ProductKind | string
  objectType?: 'Product' | 'Service' | string
  description?: string
  company?: ObjectRef
  _highlightResult?: Record<string, { value?: string; matchLevel?: 'none' | 'partial' | 'full' }>
}

export type OfferingFacetFilters = Partial<Record<OfferingFacetKey, string[]>>

export type SearchCompanyOfferingsParams = {
  query?: string
  facetFilters?: OfferingFacetFilters
}

export type SearchCompanyOfferingsResult = {
  hits: OfferingHit[]
  nbHits: number
  page: number
  nbPages: number
  facets: Partial<Record<OfferingFacetKey, Record<string, number>>>
  source: 'algolia' | 'firestore'
}

export function offeringRecordId(hit: OfferingHit): string {
  return hit.id ?? hit.objectID
}

export function offeringHitToRecord(hit: OfferingHit): CompanyOffering {
  const id = offeringRecordId(hit)
  const kind = hit.kind === 'service' || hit.objectType === 'Service' ? 'service' : 'product'
  const name = hit.name?.trim() || hit.objectLabel?.trim() || ''

  return {
    id,
    objectID: hit.objectID,
    objectType: kind === 'service' ? 'Service' : 'Product',
    objectLabel: name,
    name,
    kind,
    description: hit.description ?? '',
    company: hit.company ?? { id: '', objectLabel: '' },
    createdAt: null,
    createdBy: null,
    updatedAt: null,
    updatedBy: null,
  }
}

function getOfferingFacetValue(hit: OfferingHit, key: OfferingFacetKey): string | undefined {
  if (key === 'objectType') {
    return hit.objectType ?? (hit.kind === 'service' ? 'Service' : hit.kind === 'product' ? 'Product' : undefined)
  }
  return undefined
}

function buildOfferingFacetFilters(facetFilters: OfferingFacetFilters): string[][] {
  const filters: string[][] = []

  for (const key of OFFERING_FACET_KEYS) {
    const values = facetFilters[key]
    if (!values?.length) continue
    filters.push(values.map((value) => `${key}:${value}`))
  }

  return filters
}

function buildOfferingFacets(hits: OfferingHit[]): Partial<Record<OfferingFacetKey, Record<string, number>>> {
  const facets: Partial<Record<OfferingFacetKey, Record<string, number>>> = {}

  for (const key of OFFERING_FACET_KEYS) {
    const counts: Record<string, number> = {}
    for (const hit of hits) {
      const value = getOfferingFacetValue(hit, key)
      if (!value) continue
      counts[value] = (counts[value] ?? 0) + 1
    }
    if (Object.keys(counts).length > 0) {
      facets[key] = counts
    }
  }

  return facets
}

function normalizeOfferingHit(hit: OfferingHit): OfferingHit {
  const id = hit.id ?? hit.objectID
  return {
    ...hit,
    id,
    objectID: id,
    name: hit.name ?? hit.objectLabel ?? '',
  }
}

function compareOfferingHits(left: OfferingHit, right: OfferingHit): number {
  const companyCompare = (left.company?.objectLabel ?? '').localeCompare(
    right.company?.objectLabel ?? '',
    'en',
    { sensitivity: 'base' },
  )
  if (companyCompare !== 0) return companyCompare

  return (left.name ?? '').localeCompare(right.name ?? '', 'en', { sensitivity: 'base' })
}

export function offeringKindFacetLabel(value: string): string {
  if (value === 'Service') return 'Service'
  if (value === 'Product') return 'Product'
  return productKindLabel(value)
}

export function selectedKindLabelsToOfferingFacetFilters(
  selectedKindLabels: string[],
): OfferingFacetFilters {
  if (selectedKindLabels.length === 0) return {}

  const values = selectedKindLabels.map((label) => (label === 'Service' ? 'Service' : 'Product'))
  return { objectType: values }
}

export function offeringFacetsToKindCounts(
  facets: Partial<Record<OfferingFacetKey, Record<string, number>>>,
): Record<string, number> {
  const objectType = facets.objectType ?? {}
  const counts: Record<string, number> = {}

  for (const [value, count] of Object.entries(objectType)) {
    counts[offeringKindFacetLabel(value)] = count
  }

  return counts
}

export async function searchCompanyOfferings(
  params: SearchCompanyOfferingsParams = {},
): Promise<SearchCompanyOfferingsResult> {
  const facetFilters = params.facetFilters ?? {}
  const queryText = params.query ?? ''

  if (!isAlgoliaConfigured()) {
    const all = await loadAllCompanyOfferings()
    const filtered = filterOfferings(all, queryText).filter((item) => {
      const selected = facetFilters.objectType
      if (!selected?.length) return true
      const objectType = item.kind === 'service' ? 'Service' : 'Product'
      return selected.includes(objectType)
    })

    return {
      hits: filtered.map((item) => offeringHitToRecord(item)),
      nbHits: filtered.length,
      page: 0,
      nbPages: Math.max(1, Math.ceil(filtered.length / GRID_PAGE_SIZE)),
      facets: buildOfferingFacets(filtered.map((item) => offeringHitToRecord(item))),
      source: 'firestore',
    }
  }

  const facetFilterGroups = buildOfferingFacetFilters(facetFilters)
  const index = getAlgoliaIndex(OFFERINGS_INDEX)

  try {
    const response = await index.search<OfferingHit>(queryText, {
      hitsPerPage: 1000,
      ...(facetFilterGroups.length ? { facetFilters: facetFilterGroups } : {}),
      facets: [...OFFERING_FACET_KEYS],
      restrictSearchableAttributes: [...OFFERING_SEARCHABLE_ATTRIBUTES],
    })

    const hits = response.hits
      .map((hit) => normalizeOfferingHit({ ...hit, id: hit.id ?? hit.objectID }))
      .sort(compareOfferingHits)

    return {
      hits,
      nbHits: hits.length,
      page: 0,
      nbPages: Math.max(1, Math.ceil(hits.length / GRID_PAGE_SIZE)),
      facets:
        (response.facets as Partial<Record<OfferingFacetKey, Record<string, number>>>) ??
        buildOfferingFacets(hits),
      source: 'algolia',
    }
  } catch {
    const all = await loadAllCompanyOfferings()
    const filtered = filterOfferings(all, queryText).filter((item) => {
      const selected = facetFilters.objectType
      if (!selected?.length) return true
      const objectType = item.kind === 'service' ? 'Service' : 'Product'
      return selected.includes(objectType)
    })

    return {
      hits: filtered.map((item) => offeringHitToRecord(item)),
      nbHits: filtered.length,
      page: 0,
      nbPages: Math.max(1, Math.ceil(filtered.length / GRID_PAGE_SIZE)),
      facets: buildOfferingFacets(filtered.map((item) => offeringHitToRecord(item))),
      source: 'firestore',
    }
  }
}
