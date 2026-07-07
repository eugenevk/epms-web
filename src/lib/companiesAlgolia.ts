import { getAlgoliaIndex, isAlgoliaConfigured } from '@/lib/algoliaClient'
import {
  buildCompanyFacets,
  enrichCompanyHitsWithLogos,
  filterCompanyHits,
  loadAllCompaniesAsHits,
} from '@/lib/companiesList'
import { GRID_PAGE_SIZE } from '@/lib/gridPagination'
import type { CompanySortOption, LabeledValue } from '@/lib/companies'

export const COMPANIES_INDEX = 'companies'

export const COMPANY_SEARCHABLE_ATTRIBUTES = [
  'name',
  'objectLabel',
  'description',
  'city',
  'companyNo',
  'website',
  'fullAddress',
  'country.label',
  'industry.label',
  'companyType.label',
] as const

export type CompanyFacetKey =
  | 'companyType.label'
  | 'industry.label'
  | 'accountManager.objectLabel'
  | 'implPartner.objectLabel'
  | 'country.label'
  | 'healthScore'
  | 'isReference'

export const COMPANY_FACET_KEYS: CompanyFacetKey[] = [
  'companyType.label',
  'industry.label',
  'accountManager.objectLabel',
  'implPartner.objectLabel',
  'country.label',
  'healthScore',
  'isReference',
]

export type CompanyObjectRef = {
  id?: string
  objectLabel?: string
}

export type CompanyHit = {
  objectID: string
  id?: string
  name?: string
  objectLabel?: string
  logoUrl?: string | null
  companyType?: LabeledValue | null
  city?: string | null
  country?: LabeledValue | null
  industry?: LabeledValue | null
  accountManager?: CompanyObjectRef | null
  implPartner?: CompanyObjectRef | null
  numOfContacts?: number
  healthScore?: number
  isReference?: boolean
  description?: string | null
  _highlightResult?: Record<string, { value?: string; matchLevel?: 'none' | 'partial' | 'full' }>
}

export type CompanyFacetFilters = Partial<Record<CompanyFacetKey, string[]>>

export type SearchCompaniesParams = {
  query?: string
  facetFilters?: CompanyFacetFilters
  sort?: CompanySortOption
  page?: number
  hitsPerPage?: number
}

export type SearchCompaniesResult = {
  hits: CompanyHit[]
  nbHits: number
  page: number
  nbPages: number
  facets: Partial<Record<CompanyFacetKey, Record<string, number>>>
  source: 'algolia' | 'firestore'
}

function hasFacetRefinements(refinements: CompanyFacetFilters): boolean {
  return COMPANY_FACET_KEYS.some((key) => (refinements[key]?.length ?? 0) > 0)
}

function buildFacetFilters(refinements: CompanyFacetFilters): string[][] {
  const filters: string[][] = []

  for (const key of COMPANY_FACET_KEYS) {
    const values = refinements[key]
    if (!values?.length) continue
    filters.push(values.map((value) => `${key}:${value}`))
  }

  return filters
}

function buildFirestoreResult(
  query: string,
  facetFilters: CompanyFacetFilters,
  sort: CompanySortOption,
  allCompanies: CompanyHit[],
): SearchCompaniesResult {
  const hits = filterCompanyHits(allCompanies, query, facetFilters, sort)

  return {
    hits,
    nbHits: hits.length,
    page: 0,
    nbPages: Math.max(1, Math.ceil(hits.length / GRID_PAGE_SIZE)),
    facets: buildCompanyFacets(allCompanies),
    source: 'firestore',
  }
}

async function fetchAllAlgoliaCompanyHits(
  query: string,
  facetFilterGroups: string[][],
): Promise<{
  hits: CompanyHit[]
  facets: Partial<Record<CompanyFacetKey, Record<string, number>>>
}> {
  const index = getAlgoliaIndex(COMPANIES_INDEX)
  const allHits: CompanyHit[] = []
  let facets: Partial<Record<CompanyFacetKey, Record<string, number>>> = {}
  let page = 0
  let nbPages = 1

  while (page < nbPages) {
    const response = await index.search<CompanyHit>(query, {
      page,
      hitsPerPage: 1000,
      ...(facetFilterGroups.length ? { facetFilters: facetFilterGroups } : {}),
      facets: [...COMPANY_FACET_KEYS],
      restrictSearchableAttributes: [...COMPANY_SEARCHABLE_ATTRIBUTES],
    })

    allHits.push(...response.hits)
    facets = (response.facets as Partial<Record<CompanyFacetKey, Record<string, number>>>) ?? facets
    nbPages = response.nbPages
    page += 1
  }

  return { hits: allHits, facets }
}

export function formatCompanyFacetLabel(attribute: CompanyFacetKey, value: string): string {
  if (attribute === 'isReference') {
    if (value === 'true') return 'Yes'
    if (value === 'false') return 'No'
  }

  if (attribute === 'healthScore') {
    if (value === '0') return 'None'
    return `${value} star${value === '1' ? '' : 's'}`
  }

  return value
}

export function companyDisplayName(company: CompanyHit): string {
  return company.name?.trim() || company.objectLabel?.trim() || '—'
}

export async function searchCompanies(params: SearchCompaniesParams): Promise<SearchCompaniesResult> {
  const facetFilters = params.facetFilters ?? {}
  const query = params.query ?? ''
  const sort = params.sort ?? 'name-asc'

  if (!isAlgoliaConfigured()) {
    const allCompanies = await loadAllCompaniesAsHits()
    return buildFirestoreResult(query, facetFilters, sort, allCompanies)
  }

  const facetFilterGroups = buildFacetFilters(facetFilters)

  const { hits: algoliaHits, facets: algoliaFacets } = await fetchAllAlgoliaCompanyHits(
    query,
    facetFilterGroups,
  )

  if (algoliaHits.length > 0 || query || hasFacetRefinements(facetFilters)) {
    const hits = await enrichCompanyHitsWithLogos(sortCompanyHits(algoliaHits, sort))
    return {
      hits,
      nbHits: hits.length,
      page: 0,
      nbPages: Math.max(1, Math.ceil(hits.length / GRID_PAGE_SIZE)),
      facets: algoliaFacets,
      source: 'algolia',
    }
  }

  const firestoreCompanies = await loadAllCompaniesAsHits()
  if (firestoreCompanies.length > 0) {
    return buildFirestoreResult(query, facetFilters, sort, firestoreCompanies)
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

function sortCompanyHits(hits: CompanyHit[], sort: CompanySortOption): CompanyHit[] {
  return [...hits].sort((left, right) => {
    switch (sort) {
      case 'name-desc':
        return companyDisplayName(right).localeCompare(companyDisplayName(left), 'en', {
          sensitivity: 'base',
        })
      case 'health-desc':
        return (right.healthScore ?? 0) - (left.healthScore ?? 0)
      default:
        return companyDisplayName(left).localeCompare(companyDisplayName(right), 'en', {
          sensitivity: 'base',
        })
    }
  })
}
