import type { CompanyOffering } from '@/lib/companyOfferingRecords'
import type { CompanyProductInUse } from '@/lib/companyProductInUseRecords'
import { stripHtml } from '@/lib/plainTextSearch'

export type ProductKind = 'product' | 'service'

export const PRODUCT_KIND_OPTIONS: { value: ProductKind; label: string }[] = [
  { value: 'product', label: 'Product' },
  { value: 'service', label: 'Service' },
]

export function productKindLabel(kind: ProductKind | string | null | undefined): string {
  if (kind === 'service') return 'Service'
  return 'Product'
}

export function offeringObjectType(kind: ProductKind): 'Product' | 'Service' {
  return kind === 'service' ? 'Service' : 'Product'
}

export function parseProductKind(value: unknown): ProductKind | null {
  if (value === 'product' || value === 'service') return value
  if (value === 'Product') return 'product'
  if (value === 'Service') return 'service'
  return null
}

export function filterOfferings(offerings: CompanyOffering[], queryText: string): CompanyOffering[] {
  const needle = queryText.trim().toLowerCase()
  if (!needle) return offerings

  return offerings.filter((item) => {
    const haystack = [
      item.name,
      stripHtml(item.description),
      item.company?.objectLabel,
      productKindLabel(item.kind),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(needle)
  })
}

export function filterProductsInUse(
  items: CompanyProductInUse[],
  queryText: string,
): CompanyProductInUse[] {
  const needle = queryText.trim().toLowerCase()
  if (!needle) return items

  return items.filter((item) => {
    const haystack = [
      item.name,
      stripHtml(item.description),
      item.version,
      item.company?.objectLabel,
      item.supplierCompany?.objectLabel,
      productKindLabel(item.kind),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(needle)
  })
}

export function buildOfferingKindFacets(offerings: CompanyOffering[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const item of offerings) {
    const label = productKindLabel(item.kind)
    counts[label] = (counts[label] ?? 0) + 1
  }
  return counts
}

export function buildProductsInUseKindFacets(items: CompanyProductInUse[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const item of items) {
    const label = productKindLabel(item.kind)
    counts[label] = (counts[label] ?? 0) + 1
  }
  return counts
}
