import { collection, getDocs, query, where } from 'firebase/firestore'
import { contactDisplayName, resolveContactName } from '@/lib/contactNames'
import { getFirebaseDb } from '@/lib/firebase'
import { excerptForSearch } from '@/lib/plainTextSearch'
import {
  CONTACT_FACET_KEYS,
  type ContactFacetKey,
  type ContactHit,
} from '@/lib/contactsAlgolia'

export type ContactSortOption = 'name-asc' | 'name-desc' | 'company-asc'

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function getBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function mapContactHit(id: string, data: Record<string, unknown>): ContactHit {
  const resolved = resolveContactName({
    firstName: getString(data.firstName),
    lastName: getString(data.lastName),
    fullName: getString(data.fullName),
    objectLabel: getString(data.objectLabel),
  })

  const gender =
    data.gender && typeof data.gender === 'object'
      ? {
          label: getString((data.gender as { label?: unknown }).label),
          value: getString((data.gender as { value?: unknown }).value),
          color: getString((data.gender as { color?: unknown }).color),
        }
      : undefined

  const company =
    data.company && typeof data.company === 'object'
      ? {
          id: getString((data.company as { id?: unknown }).id),
          objectLabel: getString((data.company as { objectLabel?: unknown }).objectLabel),
        }
      : undefined

  const reportsInto =
    data.reportsInto && typeof data.reportsInto === 'object'
      ? {
          id: getString((data.reportsInto as { id?: unknown }).id),
          objectLabel: getString((data.reportsInto as { objectLabel?: unknown }).objectLabel),
        }
      : undefined

  return {
    objectID: id,
    id,
    fullName: resolved.fullName,
    firstName: resolved.firstName ?? undefined,
    lastName: resolved.lastName,
    position: getString(data.position),
    department: getString(data.department),
    email: getString(data.email),
    mobile: getString(data.mobile),
    phone: getString(data.phone),
    notes: excerptForSearch(getString(data.notes), 8_000),
    atCompanySince: getString(data.atCompanySince),
    firstMet: getString(data.firstMet),
    hasLeft: getBoolean(data.hasLeft),
    gender,
    company,
    reportsInto: reportsInto?.id ? reportsInto : undefined,
  }
}

export function normalizeContactHit(hit: ContactHit): ContactHit {
  return mapContactHit(hit.id ?? hit.objectID, hit as unknown as Record<string, unknown>)
}

export async function loadCompanyContactsFromFirestore(companyId: string): Promise<ContactHit[]> {
  const snapshot = await getDocs(
    query(collection(getFirebaseDb(), 'contacts'), where('company.id', '==', companyId)),
  )

  return sortContactHits(
    snapshot.docs.map((document) => mapContactHit(document.id, document.data())),
  )
}

export async function loadContactsReportingIntoFromFirestore(
  managerContactId: string,
): Promise<ContactHit[]> {
  const snapshot = await getDocs(
    query(
      collection(getFirebaseDb(), 'contacts'),
      where('reportsInto.id', '==', managerContactId),
    ),
  )

  return sortContactHits(
    snapshot.docs.map((document) => mapContactHit(document.id, document.data())),
  )
}

export async function loadAllContactsFromFirestore(): Promise<ContactHit[]> {
  const snapshot = await getDocs(collection(getFirebaseDb(), 'contacts'))
  return sortContactHits(snapshot.docs.map((document) => mapContactHit(document.id, document.data())))
}

export function sortContactHits(
  hits: ContactHit[],
  sort: ContactSortOption = 'name-asc',
): ContactHit[] {
  return [...hits].sort((left, right) => compareContactHits(left, right, sort))
}

export function compareContactHits(
  left: ContactHit,
  right: ContactHit,
  sort: ContactSortOption,
): number {
  switch (sort) {
    case 'name-desc':
      return contactDisplayName(right).localeCompare(contactDisplayName(left), 'en', {
        sensitivity: 'base',
      })
    case 'company-asc':
      return (left.company?.objectLabel ?? '').localeCompare(right.company?.objectLabel ?? '', 'en', {
        sensitivity: 'base',
      })
    default:
      return contactDisplayName(left).localeCompare(contactDisplayName(right), 'en', {
        sensitivity: 'base',
      })
  }
}

export { contactDisplayName } from '@/lib/contactNames'

export function buildContactFacets(
  hits: ContactHit[],
  facetKeys: ReadonlyArray<ContactFacetKey | 'company.objectLabel'> = CONTACT_FACET_KEYS,
): Partial<Record<ContactFacetKey | 'company.objectLabel', Record<string, number>>> {
  const facets: Partial<Record<ContactFacetKey | 'company.objectLabel', Record<string, number>>> = {}

  for (const key of facetKeys) {
    facets[key] = {}
  }

  for (const hit of hits) {
    for (const key of facetKeys) {
      const value = getContactFacetValue(hit, key)
      if (!value) continue
      facets[key]![value] = (facets[key]![value] ?? 0) + 1
    }
  }

  return facets
}

function getContactFacetValue(
  hit: ContactHit,
  key: ContactFacetKey | 'company.objectLabel',
): string | undefined {
  if (key === 'company.objectLabel') {
    return hit.company?.objectLabel
  }

  if (key === 'gender.label') {
    return hit.gender?.label
  }

  if (key === 'hasLeft') {
    return hit.hasLeft ? 'true' : 'false'
  }

  return hit[key]
}

export function filterContactHits(
  hits: ContactHit[],
  queryText: string,
  facetFilters: Partial<Record<ContactFacetKey | 'company.objectLabel', string[]>>,
  facetKeys: ReadonlyArray<ContactFacetKey | 'company.objectLabel'> = CONTACT_FACET_KEYS,
): ContactHit[] {
  const needle = queryText.trim().toLowerCase()

  return hits.filter((hit) => {
    for (const key of facetKeys) {
      const selected = facetFilters[key]
      if (!selected?.length) continue

      const value = getContactFacetValue(hit, key)
      if (!value || !selected.includes(value)) {
        return false
      }
    }

    if (!needle) return true

    const haystack = [
      hit.fullName,
      hit.firstName,
      hit.lastName,
      hit.position,
      hit.department,
      hit.email,
      hit.mobile,
      hit.phone,
      hit.notes,
      hit.company?.objectLabel,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    const tokens = needle.split(/\s+/).filter(Boolean)
    return tokens.every((token) => haystack.includes(token))
  })
}

/** Prefer authoritative Firestore hits; keep Algolia highlights when available. */
export function mergeContactHits(
  authoritative: ContactHit[],
  supplemental: ContactHit[],
): ContactHit[] {
  const merged = new Map<string, ContactHit>()

  for (const hit of supplemental) {
    merged.set(hit.objectID, hit)
  }

  for (const hit of authoritative) {
    const existing = merged.get(hit.objectID)
    merged.set(
      hit.objectID,
      existing
        ? {
            ...hit,
            _highlightResult: existing._highlightResult ?? hit._highlightResult,
          }
        : hit,
    )
  }

  return [...merged.values()]
}
