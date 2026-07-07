import { collection, documentId, getDocs, orderBy, query, where } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase'
import { excerptForSearch } from '@/lib/plainTextSearch'
import { type CompanySortOption, type CompanySummary } from '@/lib/companies'
import {
  COMPANY_FACET_KEYS,
  companyDisplayName,
  type CompanyFacetKey,
  type CompanyHit,
} from '@/lib/companiesAlgolia'

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function getBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function getNumber(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function mapLabeledValue(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const label = getString(record.label)
  const itemValue = getString(record.value)
  if (!label || !itemValue) return null
  return { label, value: itemValue }
}

function mapObjectRef(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const id = getString(record.id)
  const objectLabel = getString(record.objectLabel)
  if (!id || !objectLabel) return null
  return { id, objectLabel }
}

export function mapCompanySummaryToHit(company: CompanySummary): CompanyHit {
  return {
    objectID: company.id,
    id: company.id,
    name: company.name,
    objectLabel: company.objectLabel,
    logoUrl: company.logoUrl,
    companyType: company.companyType,
    city: company.city,
    country: company.country,
    industry: company.industry,
    numOfContacts: company.numOfContacts,
    healthScore: company.healthScore,
    isReference: company.isReference,
  }
}

function mapCompanyHit(id: string, data: Record<string, unknown>): CompanyHit {
  return {
    objectID: id,
    id,
    name: getString(data.name),
    objectLabel: getString(data.objectLabel) ?? getString(data.name),
    logoUrl: getString(data.logoUrl) ?? null,
    companyType: mapLabeledValue(data.companyType),
    city: getString(data.city) ?? null,
    country: mapLabeledValue(data.country),
    industry: mapLabeledValue(data.industry),
    accountManager: mapObjectRef(data.accountManager),
    implPartner: mapObjectRef(data.implPartner),
    numOfContacts: getNumber(data.numOfContacts),
    healthScore: getNumber(data.healthScore),
    isReference: getBoolean(data.isReference) ?? false,
    description: excerptForSearch(getString(data.description)),
  }
}

export async function loadAllCompaniesAsHits(): Promise<CompanyHit[]> {
  const snapshot = await getDocs(
    query(collection(getFirebaseDb(), 'companies'), orderBy('name')),
  )

  return snapshot.docs.map((document) => mapCompanyHit(document.id, document.data()))
}

const LOGO_QUERY_BATCH_SIZE = 30

export async function fetchCompanyLogosByIds(ids: string[]): Promise<Map<string, string | null>> {
  return loadCompanyLogosByIds(ids)
}

export async function enrichCompanyHitsWithLogos(hits: CompanyHit[]): Promise<CompanyHit[]> {
  if (hits.length === 0) return hits

  const logoById = await loadCompanyLogosByIds(hits.map((hit) => hit.id ?? hit.objectID))

  return hits.map((hit) => {
    const id = hit.id ?? hit.objectID
    return {
      ...hit,
      logoUrl: logoById.get(id) ?? hit.logoUrl ?? null,
    }
  })
}

async function loadCompanyLogosByIds(ids: string[]): Promise<Map<string, string | null>> {
  const uniqueIds = [...new Set(ids.filter(Boolean))]
  const logoById = new Map<string, string | null>()

  if (uniqueIds.length === 0) {
    return logoById
  }

  const db = getFirebaseDb()

  for (let index = 0; index < uniqueIds.length; index += LOGO_QUERY_BATCH_SIZE) {
    const batch = uniqueIds.slice(index, index + LOGO_QUERY_BATCH_SIZE)
    const snapshot = await getDocs(
      query(collection(db, 'companies'), where(documentId(), 'in', batch)),
    )

    for (const document of snapshot.docs) {
      const logoUrl = getString(document.data().logoUrl)?.trim() ?? null
      logoById.set(document.id, logoUrl || null)
    }
  }

  for (const id of uniqueIds) {
    if (!logoById.has(id)) {
      logoById.set(id, null)
    }
  }

  return logoById
}

function getFacetValue(hit: CompanyHit, key: CompanyFacetKey): string | undefined {
  switch (key) {
    case 'companyType.label':
      return hit.companyType?.label
    case 'industry.label':
      return hit.industry?.label
    case 'country.label':
      return hit.country?.label
    case 'accountManager.objectLabel':
      return hit.accountManager?.objectLabel
    case 'implPartner.objectLabel':
      return hit.implPartner?.objectLabel
    case 'healthScore':
      return String(hit.healthScore ?? 0)
    case 'isReference':
      return hit.isReference ? 'true' : 'false'
  }
}

export function buildCompanyFacets(
  hits: CompanyHit[],
): Partial<Record<CompanyFacetKey, Record<string, number>>> {
  const facets: Partial<Record<CompanyFacetKey, Record<string, number>>> = {}

  for (const key of COMPANY_FACET_KEYS) {
    facets[key] = {}
  }

  for (const hit of hits) {
    for (const key of COMPANY_FACET_KEYS) {
      const value = getFacetValue(hit, key)
      if (!value) continue
      facets[key]![value] = (facets[key]![value] ?? 0) + 1
    }
  }

  return facets
}

export function filterCompanyHits(
  hits: CompanyHit[],
  queryText: string,
  facetFilters: Partial<Record<CompanyFacetKey, string[]>>,
  sort: CompanySortOption,
): CompanyHit[] {
  const needle = queryText.trim().toLowerCase()

  const filtered = hits.filter((hit) => {
    for (const key of COMPANY_FACET_KEYS) {
      const selected = facetFilters[key]
      if (!selected?.length) continue

      const value = getFacetValue(hit, key)
      if (!value || !selected.includes(value)) {
        return false
      }
    }

    if (!needle) return true

    const haystack = [
      hit.name,
      hit.objectLabel,
      hit.description,
      hit.city,
      hit.country?.label,
      hit.industry?.label,
      hit.companyType?.label,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(needle)
  })

  return filtered.sort((left, right) => compareCompanyHits(left, right, sort))
}

function compareCompanyHits(left: CompanyHit, right: CompanyHit, sort: CompanySortOption): number {
  switch (sort) {
    case 'name-desc':
      return companyDisplayName(right).localeCompare(companyDisplayName(left), 'en', {
        sensitivity: 'base',
      })
    case 'health-desc':
      return (right.healthScore ?? 0) - (left.healthScore ?? 0)
    default:
      return companyDisplayName(left).localeCompare(companyDisplayName(right), 'en', {
        sensitivity: 'base',
      })
  }
}
