import { collection, getDocs, query, where } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase'
import { excerptForSearch } from '@/lib/plainTextSearch'
import { formatInteger } from '@/lib/formatNumber'
import {
  OPPORTUNITY_FACET_KEYS,
  OPPORTUNITY_LIST_FACET_KEYS,
  type OpportunityFacetKey,
  type OpportunityHit,
  type OpportunityListFacetKey,
} from '@/lib/opportunitiesAlgolia'
import type { GridSortState } from '@/lib/gridSort'

export type OpportunitySortOption =
  | 'stage-desc'
  | 'title-asc'
  | 'title-desc'
  | 'company-asc'
  | 'target-desc'

export const OPPORTUNITY_GRID_DEFAULT_SORT: GridSortState[] = [
  { column: 'isActive', direction: 'desc' },
  { column: 'stage', direction: 'desc' },
]

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function getNumber(value: unknown): number | undefined {
  return coerceStageValue(value)
}

function coerceStageValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function parseStageValueFromLabel(label: string | undefined): number | undefined {
  if (!label) return undefined
  const match = label.match(/\d+/)
  if (!match) return undefined
  return coerceStageValue(match[0])
}

export function resolveOpportunityStageValue(hit: OpportunityHit): number | undefined {
  const fromStage = coerceStageValue(hit.stage?.stageValue)
  const fromRoot = coerceStageValue(hit.stageValue)
  const fromLabel = parseStageValueFromLabel(hit.stage?.label)
  const explicit = fromStage ?? fromRoot

  if (explicit !== undefined && explicit > 0) return explicit
  if (fromLabel !== undefined && fromLabel > 0) return fromLabel
  if (explicit !== undefined) return explicit
  return fromLabel
}

export function normalizeOpportunityHit(hit: OpportunityHit): OpportunityHit {
  const resolved = resolveOpportunityStageValue(hit)
  if (resolved === undefined) return hit

  return {
    ...hit,
    stageValue: resolved,
    stage: hit.stage ? { ...hit.stage, stageValue: resolved } : hit.stage,
  }
}

export function remapOpportunityHit(hit: OpportunityHit): OpportunityHit {
  return normalizeOpportunityHit(
    mapOpportunityHit(hit.id ?? hit.objectID, hit as unknown as Record<string, unknown>),
  )
}

export function opportunityStageBadgeClass(hit: OpportunityHit): string {
  return stageBadgeClass(resolveOpportunityStageValue(hit))
}

function getBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

export function opportunityDisplayTitle(hit: OpportunityHit): string {
  return hit.title?.trim() || hit.objectLabel?.trim() || 'Untitled'
}

function mapOpportunityHit(id: string, data: Record<string, unknown>): OpportunityHit {
  const company =
    data.company && typeof data.company === 'object'
      ? {
          id: getString((data.company as { id?: unknown }).id),
          objectLabel: getString((data.company as { objectLabel?: unknown }).objectLabel),
        }
      : undefined

  const status =
    data.status && typeof data.status === 'object'
      ? {
          label: getString((data.status as { label?: unknown }).label),
          value: getString((data.status as { value?: unknown }).value),
        }
      : undefined

  const rootStageValue = coerceStageValue(data.stageValue)

  const stage =
    data.stage && typeof data.stage === 'object'
      ? {
          id: getString((data.stage as { id?: unknown }).id),
          label: getString((data.stage as { label?: unknown }).label),
          stageValue:
            coerceStageValue((data.stage as { stageValue?: unknown }).stageValue) ?? rootStageValue,
          color: getString((data.stage as { color?: unknown }).color),
        }
      : undefined

  const currency =
    data.currency && typeof data.currency === 'object'
      ? {
          label: getString((data.currency as { label?: unknown }).label),
          value: getString((data.currency as { value?: unknown }).value),
        }
      : undefined

  return {
    objectID: id,
    id,
    title: getString(data.title),
    objectLabel: getString(data.objectLabel),
    opportunityNo: getString(data.opportunityNo),
    description: excerptForSearch(getString(data.description), 8_000),
    company,
    status,
    stage,
    stageValue: rootStageValue ?? stage?.stageValue,
    currency,
    amount: getNumber(data.amount),
    acv: getNumber(data.acv),
    likelihood: getNumber(data.likelihood),
    targetDt: getString(data.targetDt),
    closingDt: getString(data.closingDt),
    isActive: getBoolean(data.isActive),
  }
}

export async function loadCompanyOpportunitiesFromFirestore(
  companyId: string,
): Promise<OpportunityHit[]> {
  const snapshot = await getDocs(
    query(collection(getFirebaseDb(), 'opportunities'), where('company.id', '==', companyId)),
  )

  return sortOpportunityHits(
    snapshot.docs.map((document) =>
      normalizeOpportunityHit(mapOpportunityHit(document.id, document.data())),
    ),
  )
}

export async function loadAllOpportunitiesFromFirestore(): Promise<OpportunityHit[]> {
  const snapshot = await getDocs(collection(getFirebaseDb(), 'opportunities'))
  return sortOpportunityHits(
    snapshot.docs.map((document) =>
      normalizeOpportunityHit(mapOpportunityHit(document.id, document.data())),
    ),
  )
}

export function sortOpportunityHits(
  hits: OpportunityHit[],
  sort: OpportunitySortOption = 'stage-desc',
): OpportunityHit[] {
  return [...hits].sort((left, right) => compareOpportunityHits(left, right, sort))
}

export function compareOpportunityHits(
  left: OpportunityHit,
  right: OpportunityHit,
  sort: OpportunitySortOption,
): number {
  switch (sort) {
    case 'title-desc':
      return opportunityDisplayTitle(right).localeCompare(opportunityDisplayTitle(left), 'en', {
        sensitivity: 'base',
      })
    case 'company-asc':
      return (left.company?.objectLabel ?? '').localeCompare(right.company?.objectLabel ?? '', 'en', {
        sensitivity: 'base',
      })
    case 'target-desc':
      return (right.targetDt ?? '').localeCompare(left.targetDt ?? '', 'en', { sensitivity: 'base' })
    case 'title-asc':
      return opportunityDisplayTitle(left).localeCompare(opportunityDisplayTitle(right), 'en', {
        sensitivity: 'base',
      })
    default:
      return compareOpportunityStageDesc(left, right)
  }
}

function compareOpportunityStageDesc(left: OpportunityHit, right: OpportunityHit): number {
  const leftStage = resolveOpportunityStageValue(left) ?? Number.NEGATIVE_INFINITY
  const rightStage = resolveOpportunityStageValue(right) ?? Number.NEGATIVE_INFINITY

  if (rightStage !== leftStage) {
    return rightStage - leftStage
  }

  return opportunityDisplayTitle(left).localeCompare(opportunityDisplayTitle(right), 'en', {
    sensitivity: 'base',
  })
}

function getOpportunityFacetValue(
  hit: OpportunityHit,
  key: OpportunityListFacetKey,
): string | undefined {
  if (key === 'company.objectLabel') {
    return hit.company?.objectLabel
  }

  if (key === 'status.label') {
    return hit.status?.label
  }

  if (key === 'stage.label') {
    return hit.stage?.label
  }

  if (key === 'isActive') {
    return hit.isActive === undefined ? undefined : hit.isActive ? 'true' : 'false'
  }

  if (key === 'likelihood') {
    return hit.likelihood === undefined ? undefined : String(hit.likelihood)
  }

  return undefined
}

export function buildOpportunityFacets(
  hits: OpportunityHit[],
  facetKeys: ReadonlyArray<OpportunityListFacetKey> = OPPORTUNITY_LIST_FACET_KEYS,
): Partial<Record<OpportunityListFacetKey, Record<string, number>>> {
  const facets: Partial<Record<OpportunityListFacetKey, Record<string, number>>> = {}

  for (const key of facetKeys) {
    facets[key] = {}
  }

  for (const hit of hits) {
    for (const key of facetKeys) {
      const value = getOpportunityFacetValue(hit, key)
      if (!value) continue
      facets[key]![value] = (facets[key]![value] ?? 0) + 1
    }
  }

  return facets
}

export function filterOpportunityHits(
  hits: OpportunityHit[],
  queryText: string,
  facetFilters: Partial<Record<OpportunityListFacetKey, string[]>>,
  facetKeys: ReadonlyArray<OpportunityListFacetKey> = OPPORTUNITY_FACET_KEYS,
): OpportunityHit[] {
  const needle = queryText.trim().toLowerCase()

  return hits.filter((hit) => {
    for (const key of facetKeys) {
      const selected = facetFilters[key]
      if (!selected?.length) continue

      const value = getOpportunityFacetValue(hit, key)
      if (!value || !selected.includes(value)) {
        return false
      }
    }

    if (!needle) return true

    const haystack = [
      hit.title,
      hit.objectLabel,
      hit.opportunityNo,
      hit.company?.objectLabel,
      hit.status?.label,
      hit.stage?.label,
      hit.description,
      hit.targetDt,
      hit.closingDt,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(needle)
  })
}

export function formatOpportunityFacetLabel(
  attribute: OpportunityFacetKey | 'company.objectLabel',
  value: string,
): string {
  if (attribute === 'isActive') {
    return value === 'true' ? 'Active' : 'Inactive'
  }

  return value
}

const STAGE_GREEN_BADGE_CLASSES = [
  'bg-emerald-100 text-emerald-800',
  'bg-emerald-200 text-emerald-900',
  'bg-emerald-300 text-emerald-950',
  'bg-emerald-400 text-white',
  'bg-emerald-500 text-white',
  'bg-emerald-600 text-white',
  'bg-emerald-700 text-white',
  'bg-emerald-800 text-white',
  'bg-emerald-900 text-white',
  'bg-emerald-950 text-white',
] as const

export function stageBadgeClass(stageValue: number | null | undefined): string {
  if (stageValue == null || stageValue < 0) {
    return 'bg-stone-200 text-stone-700'
  }

  if (stageValue === 0) {
    return 'bg-red-100 text-red-800'
  }

  const index = Math.min(stageValue - 1, STAGE_GREEN_BADGE_CLASSES.length - 1)
  return STAGE_GREEN_BADGE_CLASSES[index]
}

export function activeBadgeClass(isActive: boolean | undefined): string {
  return isActive === false ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  CHF: 'CHF',
  JPY: '¥',
  CAD: 'CA$',
  AUD: 'A$',
}

function resolveCurrencyCode(value: string | undefined, label: string | undefined): string | null {
  const normalizedValue = value?.trim().toUpperCase()
  if (normalizedValue && /^[A-Z]{3}$/.test(normalizedValue)) {
    return normalizedValue
  }

  const normalizedLabel = label?.trim().toUpperCase()
  if (normalizedLabel && /^[A-Z]{3}$/.test(normalizedLabel)) {
    return normalizedLabel
  }

  return null
}

function resolveCurrencySymbol(currencyCode: string): string {
  if (CURRENCY_SYMBOLS[currencyCode]) {
    return CURRENCY_SYMBOLS[currencyCode]
  }

  try {
    return (
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currencyCode,
        currencyDisplay: 'narrowSymbol',
      })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value ?? currencyCode
    )
  } catch {
    return currencyCode
  }
}

export function formatOpportunityAcv(opportunity: {
  acv?: number
  amount?: number
  currency?: { label?: string; value?: string }
}): string {
  const amount = opportunity.acv ?? opportunity.amount
  if (amount === undefined || amount === null) return '—'

  const formattedNumber = formatInteger(amount)
  const currencyCode = resolveCurrencyCode(opportunity.currency?.value, opportunity.currency?.label)
  if (!currencyCode) {
    return formattedNumber
  }

  return `${resolveCurrencySymbol(currencyCode)} ${formattedNumber}`
}
