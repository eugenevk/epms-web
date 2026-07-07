import type { LabeledValue } from '@/lib/companies'
import type { OpportunityInput } from '@/lib/opportunityRecords'
import type { OpportunityStage } from '@/lib/stages'

export const WON_OPPORTUNITY_STATUS_VALUE = 'won'
export const CLOSED_WON_OPPORTUNITY_STATUS_LABEL = 'Closed - Won'
export const CLOSED_STAGE_VALUE = 0
export const WON_STAGE_VALUE = 8

export function isWonOpportunityStatus(status: LabeledValue | null | undefined): boolean {
  if (!status) return false
  return (
    status.value === WON_OPPORTUNITY_STATUS_VALUE ||
    status.label === CLOSED_WON_OPPORTUNITY_STATUS_LABEL
  )
}

export function isClosedOpportunityStatus(status: LabeledValue | null | undefined): boolean {
  if (!status) return false
  if (isWonOpportunityStatus(status)) return true

  const label = status.label?.trim()
  if (label?.startsWith('Closed')) return true

  return status.value === 'closed'
}

export function findOpportunityStageByValue(
  stages: OpportunityStage[],
  stageValue: number,
): OpportunityStage | null {
  return stages.find((stage) => stage.stageValue === stageValue) ?? null
}

export function applyOpportunityStatusChange(
  input: OpportunityInput,
  status: LabeledValue | null,
  stages: OpportunityStage[],
): void {
  input.status = status
  if (!status) return

  if (isWonOpportunityStatus(status)) {
    input.isActive = false
    input.likelihood = 100
    const wonStage = findOpportunityStageByValue(stages, WON_STAGE_VALUE)
    if (wonStage) {
      input.stage = wonStage
    }
    return
  }

  if (isClosedOpportunityStatus(status)) {
    input.isActive = false
    input.likelihood = 0
  }
}

export function applyOpportunityStageChange(
  input: OpportunityInput,
  stage: OpportunityStage | null,
): void {
  input.stage = stage
  input.status = null
  if (!stage) return

  if (stage.stageValue === CLOSED_STAGE_VALUE) {
    input.isActive = false
    input.likelihood = 0
    return
  }

  input.likelihood = stage.likelihood ?? 0

  if (stage.stageValue > CLOSED_STAGE_VALUE && stage.stageValue < WON_STAGE_VALUE) {
    input.isActive = true
    return
  }

  if (stage.stageValue === WON_STAGE_VALUE) {
    input.isActive = false
  }
}

export function normalizeOpportunityInput(
  input: OpportunityInput,
  stages: OpportunityStage[] = [],
): OpportunityInput {
  const normalized: OpportunityInput = { ...input }

  if (normalized.status) {
    applyOpportunityStatusChange(normalized, normalized.status, stages)
    if (isWonOpportunityStatus(normalized.status)) {
      return normalized
    }
  }

  if (normalized.stage?.stageValue === CLOSED_STAGE_VALUE) {
    applyOpportunityStageChange(normalized, normalized.stage)
  }

  return normalized
}
