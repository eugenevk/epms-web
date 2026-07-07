import { getAlgoliaIndex, isAlgoliaConfigured } from '@/lib/algoliaClient'
import { GRID_PAGE_SIZE } from '@/lib/gridPagination'
import { loadAllTasksFromFirestore, type Task, type TaskLinkedObject } from '@/lib/taskRecords'

export const TASKS_INDEX = 'tasks'

export const TASK_SEARCHABLE_ATTRIBUTES = [
  'summary',
  'description',
  'outcome',
  'objectLabel',
  'linkedObject.objectLabel',
  'linkedObject.type',
  'priority.label',
  'status.label',
  'dueDt',
] as const

export type TaskFacetKey = 'priority.label' | 'status.label' | 'linkedObject.type' | 'isCompleted'

export const TASK_FACET_KEYS: TaskFacetKey[] = [
  'priority.label',
  'status.label',
  'linkedObject.type',
  'isCompleted',
]

export type TaskLabeledValue = {
  label?: string
  value?: string
}

export type TaskHit = {
  objectID: string
  id?: string
  summary?: string
  description?: string
  outcome?: string
  objectLabel?: string
  dueDt?: string | null
  isCompleted?: boolean
  isOverdue?: boolean
  priority?: TaskLabeledValue | null
  status?: TaskLabeledValue | null
  linkedObject?: TaskLinkedObject
  _highlightResult?: Record<string, { value?: string; matchLevel?: 'none' | 'partial' | 'full' }>
}

export type TaskFacetFilters = Partial<Record<TaskFacetKey, string[]>>

export type SearchTasksParams = {
  query?: string
  facetFilters?: TaskFacetFilters
}

export type SearchTasksResult = {
  hits: TaskHit[]
  nbHits: number
  page: number
  nbPages: number
  facets: Partial<Record<TaskFacetKey, Record<string, number>>>
  source: 'algolia' | 'firestore'
}

export function taskRecordId(task: TaskHit): string {
  return task.id ?? task.objectID
}

export function taskToHit(task: Task): TaskHit {
  return {
    objectID: task.id,
    id: task.id,
    summary: task.summary,
    description: task.description,
    outcome: task.outcome,
    objectLabel: task.objectLabel,
    dueDt: task.dueDt,
    isCompleted: task.isCompleted,
    isOverdue: task.isOverdue,
    priority: task.priority,
    status: task.status,
    linkedObject: task.linkedObject,
  }
}

function getFacetValue(hit: TaskHit, key: TaskFacetKey): string | undefined {
  if (key === 'priority.label') return hit.priority?.label
  if (key === 'status.label') return hit.status?.label
  if (key === 'linkedObject.type') return hit.linkedObject?.type
  if (key === 'isCompleted') {
    return hit.isCompleted === true ? 'true' : 'false'
  }
  return undefined
}

function buildFacetFilters(facetFilters: TaskFacetFilters): string[][] {
  const filters: string[][] = []

  for (const key of TASK_FACET_KEYS) {
    const values = facetFilters[key]
    if (!values?.length) continue
    filters.push(values.map((value) => `${key}:${value}`))
  }

  return filters
}

function buildTaskFacets(hits: TaskHit[]): Partial<Record<TaskFacetKey, Record<string, number>>> {
  const facets: Partial<Record<TaskFacetKey, Record<string, number>>> = {}

  for (const key of TASK_FACET_KEYS) {
    const counts: Record<string, number> = {}
    for (const hit of hits) {
      const value = getFacetValue(hit, key)
      if (!value) continue
      counts[value] = (counts[value] ?? 0) + 1
    }
    if (Object.keys(counts).length > 0) {
      facets[key] = counts
    }
  }

  return facets
}

function compareTaskHits(left: TaskHit, right: TaskHit): number {
  const leftCompleted = left.isCompleted === true
  const rightCompleted = right.isCompleted === true
  if (leftCompleted !== rightCompleted) {
    return leftCompleted ? 1 : -1
  }

  const leftDue = left.dueDt ?? ''
  const rightDue = right.dueDt ?? ''
  if (!leftDue && !rightDue) {
    return (left.summary ?? '').localeCompare(right.summary ?? '', 'en', { sensitivity: 'base' })
  }
  if (!leftDue) return 1
  if (!rightDue) return -1
  return leftDue.localeCompare(rightDue, 'en', { sensitivity: 'base' })
}

function normalizeTaskHit(hit: TaskHit): TaskHit {
  const id = hit.id ?? hit.objectID
  return {
    ...hit,
    id,
    objectID: id,
    summary: hit.summary ?? hit.objectLabel ?? '',
    linkedObject: hit.linkedObject,
  }
}

export function filterTaskHits(
  hits: TaskHit[],
  queryText: string,
  facetFilters: TaskFacetFilters = {},
): TaskHit[] {
  const needle = queryText.trim().toLowerCase()

  return hits.filter((hit) => {
    for (const key of TASK_FACET_KEYS) {
      const selected = facetFilters[key]
      if (!selected?.length) continue
      const value = getFacetValue(hit, key)
      if (!value || !selected.includes(value)) return false
    }

    if (!needle) return true

    const haystack = [
      hit.summary,
      hit.description,
      hit.outcome,
      hit.objectLabel,
      hit.linkedObject?.objectLabel,
      hit.linkedObject?.type,
      hit.priority?.label,
      hit.status?.label,
      hit.dueDt,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(needle)
  })
}

export function formatTaskFacetLabel(attribute: TaskFacetKey, value: string): string {
  if (attribute === 'isCompleted') {
    return value === 'true' ? 'Completed' : 'Open'
  }
  return value
}

export async function searchTasks(params: SearchTasksParams = {}): Promise<SearchTasksResult> {
  const facetFilters = params.facetFilters ?? {}
  const queryText = params.query ?? ''

  if (!isAlgoliaConfigured()) {
    const all = (await loadAllTasksFromFirestore()).map(taskToHit)
    const hits = filterTaskHits(all, queryText, facetFilters).sort(compareTaskHits)

    return {
      hits,
      nbHits: hits.length,
      page: 0,
      nbPages: Math.max(1, Math.ceil(hits.length / GRID_PAGE_SIZE)),
      facets: buildTaskFacets(all),
      source: 'firestore',
    }
  }

  const facetFilterGroups = buildFacetFilters(facetFilters)
  const index = getAlgoliaIndex(TASKS_INDEX)

  try {
    const response = await index.search<TaskHit>(queryText, {
      hitsPerPage: 1000,
      ...(facetFilterGroups.length ? { facetFilters: facetFilterGroups } : {}),
      facets: [...TASK_FACET_KEYS],
      restrictSearchableAttributes: [...TASK_SEARCHABLE_ATTRIBUTES],
    })

    const hits = response.hits
      .map((hit) => normalizeTaskHit({ ...hit, id: hit.id ?? hit.objectID }))
      .sort(compareTaskHits)

    return {
      hits,
      nbHits: hits.length,
      page: 0,
      nbPages: Math.max(1, Math.ceil(hits.length / GRID_PAGE_SIZE)),
      facets:
        (response.facets as Partial<Record<TaskFacetKey, Record<string, number>>>) ?? buildTaskFacets(hits),
      source: 'algolia',
    }
  } catch {
    const all = (await loadAllTasksFromFirestore()).map(taskToHit)
    const hits = filterTaskHits(all, queryText, facetFilters).sort(compareTaskHits)

    return {
      hits,
      nbHits: hits.length,
      page: 0,
      nbPages: Math.max(1, Math.ceil(hits.length / GRID_PAGE_SIZE)),
      facets: buildTaskFacets(all),
      source: 'firestore',
    }
  }
}
