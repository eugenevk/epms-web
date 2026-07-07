import { getAlgoliaIndex, isAlgoliaConfigured } from '@/lib/algoliaClient'
import {
  buildOpportunityFacets,
  filterOpportunityHits,
  loadAllOpportunitiesFromFirestore,
  loadCompanyOpportunitiesFromFirestore,
  remapOpportunityHit,
  sortOpportunityHits,
  type OpportunitySortOption,
} from '@/lib/opportunities'
import { COMPANIES_INDEX } from '@/lib/companiesAlgolia'
import { GRID_PAGE_SIZE } from '@/lib/gridPagination'

export const OPPORTUNITIES_INDEX = 'opportunities'

export const OPPORTUNITY_SEARCHABLE_ATTRIBUTES = [
  'title',
  'objectLabel',
  'opportunityNo',
  'company.objectLabel',
  'status.label',
  'stage.label',
  'description',
  'targetDt',
  'closingDt',
] as const

export type OpportunityFacetKey = 'status.label' | 'stage.label' | 'likelihood' | 'isActive'

export const OPPORTUNITY_FACET_KEYS: OpportunityFacetKey[] = [
  'status.label',
  'stage.label',
  'likelihood',
  'isActive',
]

export type OpportunityListFacetKey = OpportunityFacetKey | 'company.objectLabel'

export const OPPORTUNITY_LIST_FACET_KEYS: OpportunityListFacetKey[] = [
  'company.objectLabel',
  ...OPPORTUNITY_FACET_KEYS,
]

export type OpportunityCompanyRef = {
  id?: string
  objectLabel?: string
}

export type OpportunityLabeledValue = {
  label?: string
  value?: string
}

export type OpportunityStageRef = {
  id?: string
  label?: string
  stageValue?: number
  color?: string
}

export type OpportunityHit = {
  objectID: string
  id?: string
  title?: string
  objectLabel?: string
  opportunityNo?: string
  description?: string
  company?: OpportunityCompanyRef
  status?: OpportunityLabeledValue
  stage?: OpportunityStageRef
  stageValue?: number
  currency?: OpportunityLabeledValue
  amount?: number
  acv?: number
  likelihood?: number
  targetDt?: string
  closingDt?: string
  isActive?: boolean
  _highlightResult?: Record<string, { value?: string; matchLevel?: 'none' | 'partial' | 'full' }>
}

export type OpportunityFacetFilters = Partial<Record<OpportunityFacetKey, string[]>>

export type OpportunityListFacetFilters = Partial<Record<OpportunityListFacetKey, string[]>>

export type SearchOpportunitiesParams = {
  query?: string
  facetFilters?: OpportunityListFacetFilters
  sort?: OpportunitySortOption
}

export type SearchOpportunitiesResult = {
  hits: OpportunityHit[]
  nbHits: number
  page: number
  nbPages: number
  facets: Partial<Record<OpportunityListFacetKey, Record<string, number>>>
  source: 'algolia' | 'firestore'
}

export type SearchCompanyOpportunitiesParams = {
  companyId: string
  companyLabel: string
  query?: string
  facetFilters?: OpportunityFacetFilters
}

export type SearchCompanyOpportunitiesResult = {
  hits: OpportunityHit[]
  nbHits: number
  facets: Partial<Record<OpportunityFacetKey, Record<string, number>>>
  source: 'algolia' | 'firestore'
}

function hasListFacetRefinements(refinements: OpportunityListFacetFilters): boolean {
  return OPPORTUNITY_LIST_FACET_KEYS.some((key) => (refinements[key]?.length ?? 0) > 0)
}

function hasFacetRefinements(refinements: OpportunityFacetFilters): boolean {
  return OPPORTUNITY_FACET_KEYS.some((key) => (refinements[key]?.length ?? 0) > 0)
}

function buildListFacetFilters(refinements: OpportunityListFacetFilters): string[][] {
  const filters: string[][] = []

  for (const key of OPPORTUNITY_LIST_FACET_KEYS) {
    const values = refinements[key]
    if (!values?.length) continue
    filters.push(values.map((value) => `${key}:${value}`))
  }

  return filters
}

function buildCompanyFacetFilters(
  companyLabel: string,
  refinements: OpportunityFacetFilters,
): string[][] {
  const filters: string[][] = [[`company.objectLabel:${companyLabel}`]]

  for (const key of OPPORTUNITY_FACET_KEYS) {
    const values = refinements[key]
    if (!values?.length) continue
    filters.push(values.map((value) => `${key}:${value}`))
  }

  return filters
}

function buildListResult(
  query: string,
  facetFilters: OpportunityListFacetFilters,
  sort: OpportunitySortOption,
  allOpportunities: OpportunityHit[],
): SearchOpportunitiesResult {
  const filtered = filterOpportunityHits(allOpportunities, query, facetFilters, OPPORTUNITY_LIST_FACET_KEYS)
  const hits = sortOpportunityHits(filtered, sort)

  return {
    hits,
    nbHits: hits.length,
    page: 0,
    nbPages: Math.max(1, Math.ceil(hits.length / GRID_PAGE_SIZE)),
    facets: buildOpportunityFacets(allOpportunities, OPPORTUNITY_LIST_FACET_KEYS),
    source: 'firestore',
  }
}

function buildCompanyFirestoreResult(
  query: string,
  facetFilters: OpportunityFacetFilters,
  allOpportunities: OpportunityHit[],
): SearchCompanyOpportunitiesResult {
  const hits = filterOpportunityHits(allOpportunities, query, facetFilters, OPPORTUNITY_FACET_KEYS)

  return {
    hits,
    nbHits: hits.length,
    facets: buildOpportunityFacets(allOpportunities, OPPORTUNITY_FACET_KEYS),
    source: 'firestore',
  }
}

async function fetchAllAlgoliaOpportunities(
  query: string,
  facetFilters: OpportunityListFacetFilters,
): Promise<{
  hits: OpportunityHit[]
  facets: Partial<Record<OpportunityListFacetKey, Record<string, number>>>
}> {
  const index = getAlgoliaIndex(OPPORTUNITIES_INDEX)
  const allHits: OpportunityHit[] = []
  let facets: Partial<Record<OpportunityListFacetKey, Record<string, number>>> = {}
  let page = 0
  let nbPages = 1
  const facetFilterGroups = buildListFacetFilters(facetFilters)

  while (page < nbPages) {
    const response = await index.search<OpportunityHit>(query, {
      page,
      hitsPerPage: 1000,
      ...(facetFilterGroups.length ? { facetFilters: facetFilterGroups } : {}),
      facets: [...OPPORTUNITY_LIST_FACET_KEYS],
      restrictSearchableAttributes: [...OPPORTUNITY_SEARCHABLE_ATTRIBUTES],
    })

    allHits.push(
      ...response.hits.map((hit) => remapOpportunityHit({ ...hit, id: hit.id ?? hit.objectID })),
    )
    facets =
      (response.facets as Partial<Record<OpportunityListFacetKey, Record<string, number>>>) ?? facets
    nbPages = response.nbPages
    page += 1
  }

  return { hits: allHits, facets }
}

function opportunityCompanyId(opportunity: OpportunityHit): string | undefined {
  return opportunity.company?.id?.trim() || undefined
}

let opportunityCompanyIdByObjectId: Map<string, string> | null = null

async function enrichOpportunityCompanyIds(hits: OpportunityHit[]): Promise<OpportunityHit[]> {
  if (!hits.some((hit) => hit.company?.objectLabel && !opportunityCompanyId(hit))) {
    return hits
  }

  if (!opportunityCompanyIdByObjectId) {
    const opportunities = await loadAllOpportunitiesFromFirestore()
    opportunityCompanyIdByObjectId = new Map(
      opportunities.flatMap((opportunity) => {
        const companyId = opportunityCompanyId(opportunity)
        return companyId ? [[opportunity.objectID, companyId] as const] : []
      }),
    )
  }

  return hits.map((hit) => {
    const companyId = opportunityCompanyId(hit) ?? opportunityCompanyIdByObjectId!.get(hit.objectID)
    if (!companyId || opportunityCompanyId(hit) === companyId) return hit

    return {
      ...hit,
      company: {
        ...hit.company,
        id: companyId,
        objectLabel: hit.company?.objectLabel,
      },
    }
  })
}

export async function searchOpportunities(
  params: SearchOpportunitiesParams,
): Promise<SearchOpportunitiesResult> {
  const facetFilters = params.facetFilters ?? {}
  const query = params.query ?? ''
  const sort = params.sort ?? 'stage-desc'

  if (!isAlgoliaConfigured()) {
    const allOpportunities = await loadAllOpportunitiesFromFirestore()
    return buildListResult(query, facetFilters, sort, allOpportunities)
  }

  const { hits: algoliaHits, facets: algoliaFacets } = await fetchAllAlgoliaOpportunities(
    query,
    facetFilters,
  )

  if (algoliaHits.length > 0 || query || hasListFacetRefinements(facetFilters)) {
    const hits = sortOpportunityHits(await enrichOpportunityCompanyIds(algoliaHits), sort)
    return {
      hits,
      nbHits: hits.length,
      page: 0,
      nbPages: Math.max(1, Math.ceil(hits.length / GRID_PAGE_SIZE)),
      facets: algoliaFacets,
      source: 'algolia',
    }
  }

  const firestoreOpportunities = await loadAllOpportunitiesFromFirestore()
  if (firestoreOpportunities.length > 0) {
    return buildListResult(query, facetFilters, sort, firestoreOpportunities)
  }

  return {
    hits: [],
    nbHits: 0,
    page: 0,
    nbPages: 1,
    facets: algoliaFacets,
    source: 'algolia',
  }
}

async function resolveCompanyLabel(companyId: string, fallbackLabel: string): Promise<string> {
  const trimmedFallback = fallbackLabel.trim()
  if (!isAlgoliaConfigured()) return trimmedFallback

  try {
    const result = await getAlgoliaIndex(COMPANIES_INDEX).search<{ name?: string; objectLabel?: string }>(
      '',
      {
        filters: `objectID:${companyId}`,
        hitsPerPage: 1,
      },
    )
    const company = result.hits[0]
    return company?.name?.trim() || company?.objectLabel?.trim() || trimmedFallback
  } catch {
    return trimmedFallback
  }
}

export async function searchCompanyOpportunities(
  params: SearchCompanyOpportunitiesParams,
): Promise<SearchCompanyOpportunitiesResult> {
  const facetFilters = params.facetFilters ?? {}
  const query = params.query ?? ''
  const companyLabel = await resolveCompanyLabel(params.companyId, params.companyLabel)

  if (!companyLabel.trim()) {
    return {
      hits: [],
      nbHits: 0,
      facets: {},
      source: isAlgoliaConfigured() ? 'algolia' : 'firestore',
    }
  }

  if (!isAlgoliaConfigured()) {
    const allOpportunities = await loadCompanyOpportunitiesFromFirestore(params.companyId)
    return buildCompanyFirestoreResult(query, facetFilters, allOpportunities)
  }

  const index = getAlgoliaIndex(OPPORTUNITIES_INDEX)
  const facetFilterGroups = buildCompanyFacetFilters(companyLabel, facetFilters)

  const response = await index.search<OpportunityHit>(query, {
    hitsPerPage: 1000,
    facetFilters: facetFilterGroups,
    facets: [...OPPORTUNITY_FACET_KEYS],
    restrictSearchableAttributes: [...OPPORTUNITY_SEARCHABLE_ATTRIBUTES],
  })

  if (response.hits.length > 0 || query || hasFacetRefinements(facetFilters)) {
    return {
      hits: sortOpportunityHits(response.hits.map(remapOpportunityHit)),
      nbHits: response.nbHits,
      facets: (response.facets as Partial<Record<OpportunityFacetKey, Record<string, number>>>) ?? {},
      source: 'algolia',
    }
  }

  const firestoreOpportunities = await loadCompanyOpportunitiesFromFirestore(params.companyId)
  if (firestoreOpportunities.length > 0) {
    return buildCompanyFirestoreResult(query, facetFilters, firestoreOpportunities)
  }

  return {
    hits: [],
    nbHits: 0,
    facets: (response.facets as Partial<Record<OpportunityFacetKey, Record<string, number>>>) ?? {},
    source: 'algolia',
  }
}

export { formatOpportunityFacetLabel } from '@/lib/opportunities'
