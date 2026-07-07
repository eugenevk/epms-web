import { filterNoteHits, loadAllNotesFromFirestore, loadNotesFromFirestore } from '@/lib/notes'
import { getAlgoliaIndex, isAlgoliaConfigured } from '@/lib/algoliaClient'
import { GRID_PAGE_SIZE } from '@/lib/gridPagination'

export const NOTES_INDEX = 'notes'

export const NOTE_SEARCHABLE_ATTRIBUTES = [
  'note',
  'objectLabel',
  'createdBy',
  'noteDt',
  'linkedObject.objectLabel',
  'linkedObject.type',
] as const

export type NoteLinkedObject = {
  collection?: 'companies' | 'opportunities' | 'rfps' | string
  id?: string
  type?: 'Company' | 'Opportunity' | 'Rfp' | string
  objectLabel?: string
}

export type NotesGridLinkedObject = {
  id: string
  label: string
  collection: 'companies' | 'opportunities' | 'rfps'
  type: 'Company' | 'Opportunity' | 'Rfp'
}

export type NoteHit = {
  objectID: string
  id?: string
  noteDt?: string
  note?: string
  createdAt?: string
  createdBy?: string
  linkedObject?: NoteLinkedObject
  _highlightResult?: Record<string, { value?: string; matchLevel?: 'none' | 'partial' | 'full' }>
}

export type NoteDateFilter = {
  from?: string
  to?: string
}

export type SearchLinkedObjectNotesParams = {
  linkedObjectId: string
  linkedObjectCollection?: 'companies' | 'opportunities' | 'rfps'
  query?: string
  dateFilter?: NoteDateFilter
}

export type SearchLinkedObjectNotesResult = {
  hits: NoteHit[]
  nbHits: number
  source: 'firestore'
}

export type SearchCompanyNotesParams = {
  companyId: string
  query?: string
  dateFilter?: NoteDateFilter
}

export type SearchCompanyNotesResult = SearchLinkedObjectNotesResult

export type NoteFacetKey = 'linkedObject.type' | 'createdBy'

export const NOTE_FACET_KEYS: NoteFacetKey[] = ['linkedObject.type', 'createdBy']

export type NoteFacetFilters = Partial<Record<NoteFacetKey, string[]>>

export type SearchNotesParams = {
  query?: string
  dateFilter?: NoteDateFilter
  facetFilters?: NoteFacetFilters
}

export type SearchNotesResult = {
  hits: NoteHit[]
  nbHits: number
  page: number
  nbPages: number
  facets: Partial<Record<NoteFacetKey, Record<string, number>>>
  source: 'algolia' | 'firestore'
}

export function noteRecordId(note: NoteHit): string {
  return note.id ?? note.objectID
}

function getNoteFacetValue(hit: NoteHit, key: NoteFacetKey): string | undefined {
  if (key === 'linkedObject.type') return hit.linkedObject?.type
  if (key === 'createdBy') return hit.createdBy
  return undefined
}

function buildNoteFacetFilters(facetFilters: NoteFacetFilters): string[][] {
  const filters: string[][] = []

  for (const key of NOTE_FACET_KEYS) {
    const values = facetFilters[key]
    if (!values?.length) continue
    filters.push(values.map((value) => `${key}:${value}`))
  }

  return filters
}

function buildNoteFacets(hits: NoteHit[]): Partial<Record<NoteFacetKey, Record<string, number>>> {
  const facets: Partial<Record<NoteFacetKey, Record<string, number>>> = {}

  for (const key of NOTE_FACET_KEYS) {
    const counts: Record<string, number> = {}
    for (const hit of hits) {
      const value = getNoteFacetValue(hit, key)
      if (!value) continue
      counts[value] = (counts[value] ?? 0) + 1
    }
    if (Object.keys(counts).length > 0) {
      facets[key] = counts
    }
  }

  return facets
}

function normalizeNoteHit(hit: NoteHit): NoteHit {
  const id = hit.id ?? hit.objectID
  return {
    ...hit,
    id,
    objectID: id,
  }
}

export function filterNoteHitsWithFacets(
  hits: NoteHit[],
  queryText: string,
  dateFilter: NoteDateFilter = {},
  facetFilters: NoteFacetFilters = {},
): NoteHit[] {
  return filterNoteHits(hits, queryText, dateFilter).filter((hit) => {
    for (const key of NOTE_FACET_KEYS) {
      const selected = facetFilters[key]
      if (!selected?.length) continue
      const value = getNoteFacetValue(hit, key)
      if (!value || !selected.includes(value)) return false
    }
    return true
  })
}

function compareNoteHits(left: NoteHit, right: NoteHit): number {
  const leftDate = left.noteDt ?? ''
  const rightDate = right.noteDt ?? ''
  if (leftDate !== rightDate) {
    return rightDate.localeCompare(leftDate, 'en', { sensitivity: 'base' })
  }

  const leftCreated = left.createdAt ?? ''
  const rightCreated = right.createdAt ?? ''
  return rightCreated.localeCompare(leftCreated, 'en', { sensitivity: 'base' })
}

export async function searchNotes(params: SearchNotesParams = {}): Promise<SearchNotesResult> {
  const facetFilters = params.facetFilters ?? {}
  const dateFilter = params.dateFilter ?? {}
  const queryText = params.query ?? ''

  if (!isAlgoliaConfigured()) {
    const all = await loadAllNotesFromFirestore()
    const hits = filterNoteHitsWithFacets(all, queryText, dateFilter, facetFilters).sort(compareNoteHits)

    return {
      hits,
      nbHits: hits.length,
      page: 0,
      nbPages: Math.max(1, Math.ceil(hits.length / GRID_PAGE_SIZE)),
      facets: buildNoteFacets(all),
      source: 'firestore',
    }
  }

  const facetFilterGroups = buildNoteFacetFilters(facetFilters)
  const index = getAlgoliaIndex(NOTES_INDEX)

  try {
    const response = await index.search<NoteHit>(queryText, {
      hitsPerPage: 1000,
      ...(facetFilterGroups.length ? { facetFilters: facetFilterGroups } : {}),
      facets: [...NOTE_FACET_KEYS],
      restrictSearchableAttributes: [...NOTE_SEARCHABLE_ATTRIBUTES],
    })

    const hits = response.hits
      .map((hit) => normalizeNoteHit({ ...hit, id: hit.id ?? hit.objectID }))
      .filter((hit) => filterNoteHitsWithFacets([hit], '', dateFilter, facetFilters).length > 0)
      .sort(compareNoteHits)

    return {
      hits,
      nbHits: hits.length,
      page: 0,
      nbPages: Math.max(1, Math.ceil(hits.length / GRID_PAGE_SIZE)),
      facets:
        (response.facets as Partial<Record<NoteFacetKey, Record<string, number>>>) ?? buildNoteFacets(hits),
      source: 'algolia',
    }
  } catch {
    const all = await loadAllNotesFromFirestore()
    const hits = filterNoteHitsWithFacets(all, queryText, dateFilter, facetFilters).sort(compareNoteHits)

    return {
      hits,
      nbHits: hits.length,
      page: 0,
      nbPages: Math.max(1, Math.ceil(hits.length / GRID_PAGE_SIZE)),
      facets: buildNoteFacets(all),
      source: 'firestore',
    }
  }
}

export async function searchLinkedObjectNotes(
  params: SearchLinkedObjectNotesParams,
): Promise<SearchLinkedObjectNotesResult> {
  const dateFilter = params.dateFilter ?? {}
  const query = params.query ?? ''
  const allNotes = await loadNotesFromFirestore(params.linkedObjectId, params.linkedObjectCollection)
  const hits = filterNoteHits(allNotes, query, dateFilter)

  return {
    hits,
    nbHits: hits.length,
    source: 'firestore',
  }
}

export async function searchCompanyNotes(
  params: SearchCompanyNotesParams,
): Promise<SearchCompanyNotesResult> {
  return searchLinkedObjectNotes({
    linkedObjectId: params.companyId,
    linkedObjectCollection: 'companies',
    query: params.query,
    dateFilter: params.dateFilter,
  })
}
