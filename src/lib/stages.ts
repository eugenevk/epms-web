import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase'

export type OpportunityStage = {
  id: string
  label: string
  stageValue: number
  color: string | null
  likelihood: number | null
  description: string | null
}

function getString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function getNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function mapStage(id: string, data: Record<string, unknown>): OpportunityStage {
  return {
    id,
    label: getString(data.label) ?? 'Stage',
    stageValue: getNumber(data.stageValue) ?? 0,
    color: getString(data.color),
    likelihood: getNumber(data.likelihood),
    description: getString(data.description),
  }
}

export async function loadOpportunityStages(): Promise<OpportunityStage[]> {
  const snapshot = await getDocs(
    query(collection(getFirebaseDb(), 'stages'), orderBy('stageValue', 'asc')),
  )

  return snapshot.docs.map((document) => mapStage(document.id, document.data()))
}

export function opportunityStageTooltip(stage: OpportunityStage): string {
  const description = stage.description?.trim() || `Stage ${stage.label}`
  if (stage.likelihood !== null && stage.likelihood !== undefined) {
    return `${description} · ${stage.likelihood}% likelihood`
  }
  return description
}

export function opportunityStageSummary(stage: OpportunityStage, likelihood?: number): string {
  const label = stage.description?.trim() || `Stage ${stage.label}`
  if (likelihood === undefined) return label
  return `${label} · ${likelihood}% likelihood`
}
