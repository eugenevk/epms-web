import { getAlgoliaIndex, isAlgoliaConfigured } from '@/lib/algoliaClient'
import {
  buildContactFacets,
  filterContactHits,
  loadAllContactsFromFirestore,
  loadCompanyContactsFromFirestore,
  mergeContactHits,
  normalizeContactHit,
  sortContactHits,
} from '@/lib/contacts'
import { COMPANIES_INDEX } from '@/lib/companiesAlgolia'
import { GRID_PAGE_SIZE } from '@/lib/gridPagination'

export const CONTACTS_INDEX = 'contacts'
export { COMPANIES_INDEX }

export const CONTACT_SEARCHABLE_ATTRIBUTES = [
  'fullName',
  'firstName',
  'lastName',
  'objectLabel',
  'company.objectLabel',
  'position',
  'department',
  'email',
  'mobile',
  'phone',
  'notes',
] as const

export type ContactFacetKey = 'department' | 'position' | 'gender.label' | 'hasLeft'

export const CONTACT_FACET_KEYS: ContactFacetKey[] = [
  'department',
  'position',
  'gender.label',
  'hasLeft',
]

export type ContactGender = {
  label?: string
  value?: string
  color?: string
}

export type ContactCompanyRef = {
  id?: string
  objectLabel?: string
}

export type ContactReportsIntoRef = {
  id?: string
  objectLabel?: string
}

export type ContactHit = {
  objectID: string
  id?: string
  fullName?: string
  firstName?: string
  lastName?: string
  position?: string
  department?: string
  email?: string
  mobile?: string
  phone?: string
  notes?: string | null
  atCompanySince?: string
  firstMet?: string
  hasLeft?: boolean
  gender?: ContactGender
  company?: ContactCompanyRef
  reportsInto?: ContactReportsIntoRef | null
  _highlightResult?: Record<string, { value?: string; matchLevel?: 'none' | 'partial' | 'full' }>
}

export type ContactFacetFilters = Partial<Record<ContactFacetKey, string[]>>

export type ContactListFacetKey = ContactFacetKey | 'company.objectLabel'

export const CONTACT_LIST_FACET_KEYS: ContactListFacetKey[] = [
  'company.objectLabel',
  ...CONTACT_FACET_KEYS,
]

export type ContactListFacetFilters = Partial<Record<ContactListFacetKey, string[]>>

export type { ContactSortOption } from '@/lib/contacts'

export type SearchContactsParams = {
  query?: string
  facetFilters?: ContactListFacetFilters
  sort?: import('@/lib/contacts').ContactSortOption
}

export type SearchContactsResult = {
  hits: ContactHit[]
  nbHits: number
  page: number
  nbPages: number
  facets: Partial<Record<ContactListFacetKey, Record<string, number>>>
  source: 'algolia' | 'firestore'
}

export type SearchCompanyContactsParams = {
  companyId: string
  companyLabel: string
  query?: string
  facetFilters?: ContactFacetFilters
  page?: number
  hitsPerPage?: number
}

export type SearchCompanyContactsResult = {
  hits: ContactHit[]
  nbHits: number
  page: number
  nbPages: number
  facets: Partial<Record<ContactFacetKey, Record<string, number>>>
  source: 'algolia' | 'firestore'
}

function buildListFacetFilters(refinements: ContactListFacetFilters): string[][] {
  const filters: string[][] = []

  for (const key of CONTACT_LIST_FACET_KEYS) {
    const values = refinements[key]
    if (!values?.length) continue
    filters.push(values.map((value) => `${key}:${value}`))
  }

  return filters
}

function buildContactsListResult(
  query: string,
  facetFilters: ContactListFacetFilters,
  sort: import('@/lib/contacts').ContactSortOption,
  allContacts: ContactHit[],
): SearchContactsResult {
  const filtered = filterContactHits(allContacts, query, facetFilters, CONTACT_LIST_FACET_KEYS)
  const hits = sortContactHits(filtered, sort)

  return {
    hits,
    nbHits: hits.length,
    page: 0,
    nbPages: Math.max(1, Math.ceil(hits.length / GRID_PAGE_SIZE)),
    facets: buildContactFacets(allContacts, CONTACT_LIST_FACET_KEYS),
    source: 'firestore',
  }
}

async function fetchAllAlgoliaContacts(
  query: string,
  facetFilters: ContactListFacetFilters,
): Promise<{
  hits: ContactHit[]
  facets: Partial<Record<ContactListFacetKey, Record<string, number>>>
}> {
  const index = getAlgoliaIndex(CONTACTS_INDEX)
  const allHits: ContactHit[] = []
  let facets: Partial<Record<ContactListFacetKey, Record<string, number>>> = {}
  let page = 0
  let nbPages = 1
  const facetFilterGroups = buildListFacetFilters(facetFilters)

  while (page < nbPages) {
    const response = await index.search<ContactHit>(query, {
      page,
      hitsPerPage: 1000,
      ...(facetFilterGroups.length ? { facetFilters: facetFilterGroups } : {}),
      facets: [...CONTACT_LIST_FACET_KEYS],
      restrictSearchableAttributes: [...CONTACT_SEARCHABLE_ATTRIBUTES],
    })

    allHits.push(
      ...response.hits.map((hit) => normalizeContactHit({ ...hit, id: hit.id ?? hit.objectID })),
    )
    facets =
      (response.facets as Partial<Record<ContactListFacetKey, Record<string, number>>>) ?? facets
    nbPages = response.nbPages
    page += 1
  }

  return { hits: allHits, facets }
}

export async function searchContacts(params: SearchContactsParams): Promise<SearchContactsResult> {
  const facetFilters = params.facetFilters ?? {}
  const query = params.query ?? ''
  const sort = params.sort ?? 'name-asc'
  const firestoreContacts = await loadAllContactsFromFirestore()

  if (!isAlgoliaConfigured()) {
    return buildContactsListResult(query, facetFilters, sort, firestoreContacts)
  }

  const firestoreFiltered = filterContactHits(
    firestoreContacts,
    query,
    facetFilters,
    CONTACT_LIST_FACET_KEYS,
  )

  const { hits: algoliaHits } = await fetchAllAlgoliaContacts(
    query,
    facetFilters,
  )

  const merged = mergeContactHits(firestoreFiltered, algoliaHits)
  const hits = sortContactHits(await enrichContactCompanyIds(merged), sort)

  return {
    hits,
    nbHits: hits.length,
    page: 0,
    nbPages: Math.max(1, Math.ceil(hits.length / GRID_PAGE_SIZE)),
    facets: buildContactFacets(firestoreContacts, CONTACT_LIST_FACET_KEYS),
    source: firestoreFiltered.length > algoliaHits.length ? 'firestore' : 'algolia',
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

function buildFacetFilters(
  companyLabel: string,
  refinements: ContactFacetFilters,
): string[][] {
  const filters: string[][] = [[`company.objectLabel:${companyLabel}`]]

  for (const key of CONTACT_FACET_KEYS) {
    const values = refinements[key]
    if (!values?.length) continue
    filters.push(values.map((value) => `${key}:${value}`))
  }

  return filters
}

function buildFirestoreResult(
  query: string,
  facetFilters: ContactFacetFilters,
  allContacts: ContactHit[],
): SearchCompanyContactsResult {
  const hits = sortContactHits(filterContactHits(allContacts, query, facetFilters), 'name-asc')

  return {
    hits,
    nbHits: hits.length,
    page: 0,
    nbPages: Math.max(1, Math.ceil(hits.length / GRID_PAGE_SIZE)),
    facets: buildContactFacets(allContacts),
    source: 'firestore',
  }
}

async function fetchAllAlgoliaContactHits(
  companyLabel: string,
  query: string,
  facetFilters: ContactFacetFilters,
): Promise<{
  hits: ContactHit[]
  facets: Partial<Record<ContactFacetKey, Record<string, number>>>
}> {
  const index = getAlgoliaIndex(CONTACTS_INDEX)
  const allHits: ContactHit[] = []
  let facets: Partial<Record<ContactFacetKey, Record<string, number>>> = {}
  let page = 0
  let nbPages = 1

  while (page < nbPages) {
    const response = await index.search<ContactHit>(query, {
      page,
      hitsPerPage: 1000,
      facetFilters: buildFacetFilters(companyLabel, facetFilters),
      facets: [...CONTACT_FACET_KEYS],
      restrictSearchableAttributes: [...CONTACT_SEARCHABLE_ATTRIBUTES],
    })

    allHits.push(
      ...response.hits.map((hit) => normalizeContactHit({ ...hit, id: hit.id ?? hit.objectID })),
    )
    facets = (response.facets as Partial<Record<ContactFacetKey, Record<string, number>>>) ?? facets
    nbPages = response.nbPages
    page += 1
  }

  return { hits: allHits, facets }
}

export function formatContactFacetLabel(
  attribute: ContactFacetKey | 'company.objectLabel',
  value: string,
): string {
  if (attribute === 'hasLeft') {
    if (value === 'true') return 'Yes'
    if (value === 'false') return 'No'
  }
  return value
}

export { contactDisplayName } from '@/lib/contactNames'

export function contactCompanyId(contact: ContactHit): string | undefined {
  return contact.company?.id?.trim() || undefined
}

let contactCompanyIdByObjectId: Map<string, string> | null = null

async function enrichContactCompanyIds(hits: ContactHit[]): Promise<ContactHit[]> {
  if (!hits.some((hit) => hit.company?.objectLabel && !contactCompanyId(hit))) {
    return hits
  }

  if (!contactCompanyIdByObjectId) {
    const contacts = await loadAllContactsFromFirestore()
    contactCompanyIdByObjectId = new Map(
      contacts.flatMap((contact) => {
        const companyId = contactCompanyId(contact)
        return companyId ? [[contact.objectID, companyId] as const] : []
      }),
    )
  }

  return hits.map((hit) => {
    const companyId = contactCompanyId(hit) ?? contactCompanyIdByObjectId!.get(hit.objectID)
    if (!companyId || contactCompanyId(hit) === companyId) return hit

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

export async function searchCompanyContacts(
  params: SearchCompanyContactsParams,
): Promise<SearchCompanyContactsResult> {
  const facetFilters = params.facetFilters ?? {}
  const query = params.query ?? ''
  const firestoreContacts = await loadCompanyContactsFromFirestore(params.companyId)

  if (!isAlgoliaConfigured()) {
    return buildFirestoreResult(query, facetFilters, firestoreContacts)
  }

  const firestoreFiltered = filterContactHits(firestoreContacts, query, facetFilters)

  const companyLabel = await resolveCompanyLabel(params.companyId, params.companyLabel)
  const algoliaResult = companyLabel.trim()
    ? await fetchAllAlgoliaContactHits(companyLabel, query, facetFilters)
    : {
        hits: [] as ContactHit[],
        facets: {} as Partial<Record<ContactFacetKey, Record<string, number>>>,
      }
  const algoliaHits = algoliaResult.hits

  const merged = mergeContactHits(firestoreFiltered, algoliaHits)
  const hits = sortContactHits(await enrichContactCompanyIds(merged), 'name-asc')

  return {
    hits,
    nbHits: hits.length,
    page: 0,
    nbPages: Math.max(1, Math.ceil(hits.length / GRID_PAGE_SIZE)),
    facets: buildContactFacets(firestoreContacts),
    source: firestoreFiltered.length > algoliaHits.length ? 'firestore' : 'algolia',
  }
}
