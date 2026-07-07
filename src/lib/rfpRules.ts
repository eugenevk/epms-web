import type { LabeledValue } from '@/lib/companies'
import type { RfpInput } from '@/lib/rfpRecords'

export function isClosedRfpStatus(status: LabeledValue | null | undefined): boolean {
  if (!status) return false

  const label = status.label?.trim()
  if (label?.startsWith('Closed')) return true

  const value = status.value?.trim().toLowerCase()
  if (!value) return false

  return value === 'closed' || value.startsWith('closed')
}

export function applyRfpStatusChange(input: RfpInput, status: LabeledValue | null): void {
  input.status = status
  if (isClosedRfpStatus(status)) {
    input.isActive = false
  }
}

export function applyRfpActiveChange(input: RfpInput, isActive: boolean): void {
  input.isActive = isActive
  input.status = null
}

export function normalizeRfpInput(input: RfpInput): RfpInput {
  const normalized: RfpInput = { ...input }

  if (normalized.status) {
    applyRfpStatusChange(normalized, normalized.status)
  }

  return normalized
}
