import type { RouteLocationRaw } from 'vue-router'
import { daysUntilDate, formatRfpDate, milestoneDueLabel } from '@/lib/rfps'
import type { GridSortState } from '@/lib/gridSort'
import type { Task, TaskLinkedObject } from '@/lib/taskRecords'

export type TasksGridLinkedObject = {
  id: string
  label: string
  collection: TaskLinkedObject['collection']
  type: TaskLinkedObject['type']
}

export const TASK_GRID_DEFAULT_SORT: GridSortState[] = [
  { column: 'isCompleted', direction: 'asc' },
  { column: 'dueDt', direction: 'asc' },
  { column: 'priority', direction: 'desc' },
]

export function taskDueBadgeClass(dueDt: string | null | undefined, isCompleted: boolean): string {
  if (isCompleted) return 'bg-stone-200 text-stone-700'
  const days = daysUntilDate(dueDt)
  if (days === null) return 'bg-stone-100 text-stone-600'
  if (days < 0) return 'bg-red-100 text-red-800'
  if (days === 0) return 'bg-amber-100 text-amber-900'
  return 'bg-emerald-100 text-emerald-800'
}

export function taskDueLabel(dueDt: string | null | undefined, isCompleted: boolean): string {
  return milestoneDueLabel(dueDt, isCompleted)
}

export function formatTaskDate(value: string | null | undefined): string {
  return formatRfpDate(value)
}

export function taskDaysUntilDue(dueDt: string | null | undefined): number | null {
  return daysUntilDate(dueDt)
}

export function taskStatusLabel(isCompleted: boolean, statusLabel?: string | null): string {
  if (isCompleted) return 'Completed'
  return statusLabel?.trim() || 'Open'
}

export function taskStatusBadgeClass(isCompleted: boolean): string {
  if (isCompleted) return 'bg-emerald-100 text-emerald-800'
  return 'bg-sky-100 text-sky-800'
}

export function taskPrioritySortValue(priorityValue: string | null | undefined): number {
  switch (priorityValue) {
    case 'VH':
      return 5
    case 'H':
      return 4
    case 'M':
      return 3
    case 'L':
      return 2
    case 'VL':
      return 1
    default:
      return -1
  }
}

export function priorityBadgeClass(priorityValue: string | null | undefined): string {
  switch (priorityValue) {
    case 'VH':
      return 'bg-red-200 text-red-900'
    case 'H':
      return 'bg-red-100 text-red-800'
    case 'M':
      return 'bg-amber-100 text-amber-900'
    case 'L':
    case 'VL':
      return 'bg-sky-100 text-sky-800'
    default:
      return 'bg-stone-100 text-stone-600'
  }
}

export function taskLinkedObjectRoute(linkedObject: TaskLinkedObject): RouteLocationRaw {
  switch (linkedObject.collection) {
    case 'companies':
      return { name: 'company-details', params: { id: linkedObject.id }, query: { tab: 'tasks' } }
    case 'opportunities':
      return { name: 'opportunity-details', params: { id: linkedObject.id }, query: { tab: 'tasks' } }
    case 'rfps':
      return { name: 'rfp-details', params: { id: linkedObject.id }, query: { tab: 'tasks' } }
    default:
      return { name: 'home' }
  }
}

export function filterTasks(tasks: Task[], queryText: string, showCompleted = false): Task[] {
  const needle = queryText.trim().toLowerCase()
  return tasks.filter((task) => {
    if (!showCompleted && task.isCompleted) return false
    if (!needle) return true

    const haystack = [
      task.summary,
      task.description,
      task.outcome,
      task.priority?.label,
      task.status?.label,
      task.linkedObject.objectLabel,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(needle)
  })
}

export function openTaskLinkedToFacetValue(task: Task): string {
  return task.linkedObject.objectLabel?.trim() || 'Unknown'
}

export function buildOpenTaskLinkedToFacets(tasks: Task[]): Record<string, number> {
  const counts: Record<string, number> = {}

  for (const task of tasks) {
    const value = openTaskLinkedToFacetValue(task)
    counts[value] = (counts[value] ?? 0) + 1
  }

  return counts
}

export function filterOpenTasksByLinkedTo(tasks: Task[], selected: string[]): Task[] {
  if (selected.length === 0) return tasks

  const allowed = new Set(selected)
  return tasks.filter((task) => allowed.has(openTaskLinkedToFacetValue(task)))
}
