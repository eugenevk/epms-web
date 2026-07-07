import { collection, getDocs, query, where } from 'firebase/firestore'
import { getAlgoliaIndex, isAlgoliaConfigured } from '@/lib/algoliaClient'
import { resolveAlgoliaRecordId } from '@/lib/algoliaRecordId'
import { getFirebaseDb } from '@/lib/firebase'
import { excerptForSearch } from '@/lib/plainTextSearch'
import type { RfpSortOption } from '@/lib/rfps'
import { rfpDisplayTitle } from '@/lib/rfps'
import { GRID_PAGE_SIZE } from '@/lib/gridPagination'

export const RFPS_INDEX = 'rfps'

export const RFP_SEARCHABLE_ATTRIBUTES = [
  'title',
  'objectLabel',
  'rfpNo',
  'description',
  'company.objectLabel',
  'opportunity.objectLabel',
  'status.label',
  'type.label',
  'dueDt',
  'submissionDt',
] as const

export type RfpFacetKey = 'status.label' | 'type.label' | 'isActive'

export type RfpListFacetKey = RfpFacetKey | 'company.objectLabel' | 'opportunity.objectLabel'

export const RFP_FACET_KEYS: RfpFacetKey[] = ['status.label', 'type.label', 'isActive']

export const RFP_LIST_FACET_KEYS: RfpListFacetKey[] = [
  'company.objectLabel',
  'opportunity.objectLabel',
  ...RFP_FACET_KEYS,
]

export type RfpCompanyRef = {
  id?: string
  objectLabel?: string
}

export type RfpOpportunityRef = {
  id?: string
  objectLabel?: string
}

export type RfpLabeledValue = {
  label?: string
  value?: string
}

export type RfpHit = {
  objectID: string
  id?: string
  title?: string
  objectLabel?: string
  rfpNo?: string | null
  description?: string
  company?: RfpCompanyRef
  opportunity?: RfpOpportunityRef | null
  type?: RfpLabeledValue | null
  status?: RfpLabeledValue | null
  dueDt?: string | null
  submissionDt?: string | null
  isActive?: boolean
  numOfUncompletedMilestones?: number
  _highlightResult?: Record<string, { value?: string; matchLevel?: 'none' | 'partial' | 'full' }>
}

export type RfpFacetFilters = Partial<Record<RfpFacetKey, string[]>>

export type RfpListFacetFilters = Partial<Record<RfpListFacetKey, string[]>>

export type SearchRfpsParams = {
  query?: string
  facetFilters?: RfpListFacetFilters
  sort?: RfpSortOption
}

export type SearchRfpsResult = {
  hits: RfpHit[]
  nbHits: number
  page: number
  nbPages: number
  facets: Partial<Record<RfpListFacetKey, Record<string, number>>>
  source: 'algolia' | 'firestore'
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function getBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function mapRfpHit(id: string, data: Record<string, unknown>): RfpHit {
  const company =
    data.company && typeof data.company === 'object'
      ? {
          id: getString((data.company as { id?: unknown }).id),
          objectLabel: getString((data.company as { objectLabel?: unknown }).objectLabel),
        }
      : undefined

  const opportunity =
    data.opportunity && typeof data.opportunity === 'object'
      ? {
          id: getString((data.opportunity as { id?: unknown }).id),
          objectLabel: getString((data.opportunity as { objectLabel?: unknown }).objectLabel),
        }
      : null

  const status =
    data.status && typeof data.status === 'object'
      ? {
          label: getString((data.status as { label?: unknown }).label),
          value: getString((data.status as { value?: unknown }).value),
        }
      : undefined

  const type =
    data.type && typeof data.type === 'object'
      ? {
          label: getString((data.type as { label?: unknown }).label),
          value: getString((data.type as { value?: unknown }).value),
        }
      : undefined

  return {
    objectID: id,
    id,
    title: getString(data.title),
    objectLabel: getString(data.objectLabel),
    rfpNo: getString(data.rfpNo) ?? null,
    description: excerptForSearch(getString(data.description), 8_000),
    company,
    opportunity,
    type,
    status,
    dueDt: getString(data.dueDt) ?? null,
    submissionDt: getString(data.submissionDt) ?? null,
    isActive: getBoolean(data.isActive),
    numOfUncompletedMilestones:
      typeof data.numOfUncompletedMilestones === 'number' ? data.numOfUncompletedMilestones : undefined,
  }
}

export function normalizeRfpHit(hit: RfpHit): RfpHit {
  return mapRfpHit(resolveAlgoliaRecordId(hit), hit as unknown as Record<string, unknown>)
}

export function rfpRecordId(rfp: Pick<RfpHit, 'objectID' | 'id'>): string {
  return resolveAlgoliaRecordId(rfp)
}

export async function loadRfpHitFromAlgolia(idOrKey: string): Promise<RfpHit | null> {
  const trimmed = idOrKey.trim()
  if (!trimmed || !isAlgoliaConfigured()) return null

  const index = getAlgoliaIndex(RFPS_INDEX)

  const byId = await index.search<RfpHit>('', {
    filters: `objectID:${escapeAlgoliaFilterValue(trimmed)}`,
    hitsPerPage: 1,
  })
  if (byId.hits[0]) {
    return normalizeRfpHit(byId.hits[0])
  }

  const byLabel = await index.search<RfpHit>(trimmed, {
    hitsPerPage: 1,
    restrictSearchableAttributes: ['title', 'objectLabel'],
  })
  if (byLabel.hits[0]) {
    return normalizeRfpHit(byLabel.hits[0])
  }

  return null
}

function escapeAlgoliaFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export async function loadAllRfpsFromFirestore(): Promise<RfpHit[]> {
  const snapshot = await getDocs(collection(getFirebaseDb(), 'rfps'))
  return snapshot.docs.map((document) => mapRfpHit(document.id, document.data()))
}

export async function loadCompanyRfpsFromFirestore(companyId: string): Promise<RfpHit[]> {
  const snapshot = await getDocs(
    query(collection(getFirebaseDb(), 'rfps'), where('company.id', '==', companyId)),
  )
  return snapshot.docs.map((document) => mapRfpHit(document.id, document.data()))
}

export async function loadOpportunityRfpsFromFirestore(opportunityId: string): Promise<RfpHit[]> {
  const snapshot = await getDocs(
    query(collection(getFirebaseDb(), 'rfps'), where('opportunity.id', '==', opportunityId)),
  )
  return snapshot.docs.map((document) => mapRfpHit(document.id, document.data()))
}

function buildFacetFilters(refinements: RfpListFacetFilters): string[][] {
  const filters: string[][] = []

  for (const key of RFP_LIST_FACET_KEYS) {
    const values = refinements[key]
    if (!values?.length) continue
    filters.push(values.map((value) => `${key}:${value}`))
  }

  return filters
}

function buildRfpFacets(hits: RfpHit[]): Partial<Record<RfpListFacetKey, Record<string, number>>> {
  const facets: Partial<Record<RfpListFacetKey, Record<string, number>>> = {}

  for (const key of RFP_LIST_FACET_KEYS) {
    facets[key] = {}
  }

  for (const hit of hits) {
    for (const key of RFP_LIST_FACET_KEYS) {
      const value = getFacetValue(hit, key)
      if (!value) continue
      const bucket = facets[key]!
      bucket[value] = (bucket[value] ?? 0) + 1
    }
  }

  return facets
}

function getFacetValue(hit: RfpHit, key: RfpListFacetKey): string | undefined {
  if (key === 'company.objectLabel') return hit.company?.objectLabel
  if (key === 'opportunity.objectLabel') return hit.opportunity?.objectLabel ?? undefined
  if (key === 'isActive') {
    if (hit.isActive === undefined) return undefined
    return hit.isActive ? 'true' : 'false'
  }
  if (key === 'status.label') return hit.status?.label
  if (key === 'type.label') return hit.type?.label
  return undefined
}

export function filterRfpHits(
  hits: RfpHit[],
  queryText: string,
  facetFilters: RfpListFacetFilters = {},
): RfpHit[] {
  const needle = queryText.trim().toLowerCase()

  return hits.filter((hit) => {
    for (const key of RFP_LIST_FACET_KEYS) {
      const selected = facetFilters[key]
      if (!selected?.length) continue
      const value = getFacetValue(hit, key)
      if (!value || !selected.includes(value)) return false
    }

    if (!needle) return true

    const haystack = [
      hit.title,
      hit.objectLabel,
      hit.rfpNo,
      hit.description,
      hit.company?.objectLabel,
      hit.opportunity?.objectLabel,
      hit.status?.label,
      hit.type?.label,
      hit.dueDt,
      hit.submissionDt,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(needle)
  })
}

export function sortRfpHits(hits: RfpHit[], sort: RfpSortOption): RfpHit[] {
  return [...hits].sort((left, right) => {
    switch (sort) {
      case 'title-desc':
        return rfpDisplayTitle(right).localeCompare(rfpDisplayTitle(left), 'en', { sensitivity: 'base' })
      case 'due-asc':
        return (left.dueDt ?? '').localeCompare(right.dueDt ?? '', 'en', { sensitivity: 'base' })
      case 'due-desc':
        return (right.dueDt ?? '').localeCompare(left.dueDt ?? '', 'en', { sensitivity: 'base' })
      default:
        return rfpDisplayTitle(left).localeCompare(rfpDisplayTitle(right), 'en', { sensitivity: 'base' })
    }
  })
}

export function formatRfpFacetLabel(attribute: RfpListFacetKey, value: string): string {
  if (attribute === 'isActive') {
    return value === 'true' ? 'Yes' : 'No'
  }
  return value
}

export async function searchRfps(params: SearchRfpsParams = {}): Promise<SearchRfpsResult> {
  const facetFilters = params.facetFilters ?? {}
  const queryText = params.query ?? ''
  const sort = params.sort ?? 'due-asc'

  if (!isAlgoliaConfigured()) {
    const all = await loadAllRfpsFromFirestore()
    const hits = sortRfpHits(filterRfpHits(all, queryText, facetFilters), sort)
    return {
      hits,
      nbHits: hits.length,
      page: 0,
      nbPages: Math.max(1, Math.ceil(hits.length / GRID_PAGE_SIZE)),
      facets: buildRfpFacets(all),
      source: 'firestore',
    }
  }

  const facetFilterGroups = buildFacetFilters(facetFilters)
  const index = getAlgoliaIndex(RFPS_INDEX)

  try {
    const response = await index.search<RfpHit>(queryText, {
      hitsPerPage: 1000,
      ...(facetFilterGroups.length ? { facetFilters: facetFilterGroups } : {}),
      facets: [...RFP_LIST_FACET_KEYS],
      restrictSearchableAttributes: [...RFP_SEARCHABLE_ATTRIBUTES],
    })

    const hits = sortRfpHits(
      response.hits.map((hit) => normalizeRfpHit({ ...hit, id: hit.id ?? hit.objectID })),
      sort,
    )

    return {
      hits,
      nbHits: hits.length,
      page: 0,
      nbPages: Math.max(1, Math.ceil(hits.length / GRID_PAGE_SIZE)),
      facets: (response.facets as Partial<Record<RfpListFacetKey, Record<string, number>>>) ?? buildRfpFacets(hits),
      source: 'algolia',
    }
  } catch {
    const all = await loadAllRfpsFromFirestore()
    const hits = sortRfpHits(filterRfpHits(all, queryText, facetFilters), sort)
    return {
      hits,
      nbHits: hits.length,
      page: 0,
      nbPages: Math.max(1, Math.ceil(hits.length / GRID_PAGE_SIZE)),
      facets: buildRfpFacets(all),
      source: 'firestore',
    }
  }
}

export async function searchCompanyRfps(params: {
  companyId: string
  companyLabel: string
  query?: string
  facetFilters?: RfpFacetFilters
  sort?: RfpSortOption
}): Promise<SearchRfpsResult> {
  const facetFilters: RfpListFacetFilters = {
    ...params.facetFilters,
    'company.objectLabel': [params.companyLabel],
  }
  return searchRfps({
    query: params.query,
    facetFilters,
    sort: params.sort,
  })
}

export async function searchOpportunityRfps(params: {
  opportunityId: string
  query?: string
  facetFilters?: RfpFacetFilters
  sort?: RfpSortOption
}): Promise<SearchRfpsResult> {
  const all = await loadOpportunityRfpsFromFirestore(params.opportunityId)
  const hits = sortRfpHits(
    filterRfpHits(all, params.query ?? '', params.facetFilters ?? {}),
    params.sort ?? 'due-asc',
  )

  return {
    hits,
    nbHits: hits.length,
    page: 0,
    nbPages: Math.max(1, Math.ceil(hits.length / GRID_PAGE_SIZE)),
    facets: buildRfpFacets(all),
    source: 'firestore',
  }
}

export { rfpDisplayTitle } from '@/lib/rfps'
