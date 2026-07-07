import type { LabeledValue } from '@/lib/companies'
import type { GridSortState } from '@/lib/gridSort'

export type RfpSortOption = 'title-asc' | 'title-desc' | 'due-asc' | 'due-desc'

export const RFP_GRID_DEFAULT_SORT: GridSortState[] = [
  { column: 'isActive', direction: 'desc' },
  { column: 'dueDt', direction: 'asc' },
]

export type RfpLabeledValueLike = {
  label?: string
  value?: string
}

export type RfpHitLike = {
  title?: string | null
  objectLabel?: string | null
  rfpNo?: string | null
  dueDt?: string | null
  submissionDt?: string | null
  status?: RfpLabeledValueLike | LabeledValue | null
  isActive?: boolean
}

export function rfpDisplayTitle(rfp: RfpHitLike): string {
  const title = rfp.title?.trim() || rfp.objectLabel?.trim()
  if (!title) return '—'
  const number = rfp.rfpNo?.trim()
  return number ? `${title} (${number})` : title
}

export function formatRfpDate(value: string | null | undefined): string {
  if (!value?.trim()) return '—'

  const trimmed = value.trim()
  const isoDate = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoDate) {
    const date = new Date(`${isoDate[1]}-${isoDate[2]}-${isoDate[3]}T00:00:00`)
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    }
  }

  const parsed = Date.parse(trimmed)
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return trimmed
}

export function daysUntilDate(value: string | null | undefined, reference = new Date()): number | null {
  if (!value?.trim()) return null

  const target = new Date(value.trim())
  if (Number.isNaN(target.getTime())) return null

  const today = new Date(reference)
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)

  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export function milestoneDueBadgeClass(dueDt: string | null | undefined, isCompleted: boolean): string {
  if (isCompleted) return 'bg-stone-200 text-stone-700'
  const days = daysUntilDate(dueDt)
  if (days === null) return 'bg-stone-100 text-stone-600'
  if (days < 0) return 'bg-red-100 text-red-800'
  if (days <= 7) return 'bg-amber-100 text-amber-900'
  return 'bg-emerald-100 text-emerald-800'
}

export function milestoneDueLabel(dueDt: string | null | undefined, isCompleted: boolean): string {
  if (isCompleted) return 'Completed'
  const days = daysUntilDate(dueDt)
  if (days === null) return 'No due date'
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  return `${days}d left`
}

export function activeBadgeClass(isActive: boolean | undefined): string {
  return isActive === false
    ? 'bg-red-100 text-red-800'
    : 'bg-emerald-100 text-emerald-800'
}

export type RfpMilestoneSortable = {
  title: string
  dueDt?: string | null
  isOverdue?: boolean
}

export function compareOpenRfpMilestones(left: RfpMilestoneSortable, right: RfpMilestoneSortable): number {
  const leftDays = daysUntilDate(left.dueDt)
  const rightDays = daysUntilDate(right.dueDt)

  if (leftDays !== null && rightDays !== null && leftDays !== rightDays) {
    return leftDays - rightDays
  }

  if (leftDays !== null && rightDays === null) return -1
  if (leftDays === null && rightDays !== null) return 1

  if (left.isOverdue !== right.isOverdue) {
    return left.isOverdue ? -1 : 1
  }

  return left.title.localeCompare(right.title, 'en', { sensitivity: 'base' })
}
