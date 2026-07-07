import type { LabeledValue } from '@/lib/companies'
import type { TaskInput } from '@/lib/taskRecords'

const CLOSED_STATUS: LabeledValue = { label: 'Closed', value: 'closed' }

export function normalizeTaskInput(input: TaskInput): TaskInput {
  const normalized: TaskInput = { ...input }

  if (normalized.isCompleted) {
    normalized.priority = null
    normalized.status = CLOSED_STATUS
  }

  return normalized
}
