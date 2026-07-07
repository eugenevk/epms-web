import type { RouteLocationRaw } from 'vue-router'

export function contactReturnCompanyId(query: Record<string, unknown>): string | null {
  const fromCompany = query.fromCompany
  if (typeof fromCompany === 'string' && fromCompany.trim()) {
    return fromCompany.trim()
  }
  return null
}

export function contactBackLabel(fromCompanyId: string | null): string {
  return fromCompanyId ? 'Back to company contacts' : 'Back to contacts'
}

export function contactBackRoute(fromCompanyId: string | null): RouteLocationRaw {
  if (fromCompanyId) {
    return {
      name: 'company-details',
      params: { id: fromCompanyId },
      query: { tab: 'contacts' },
    }
  }

  return { name: 'contacts' }
}

export function contactDetailsQuery(fromCompanyId: string | null): Record<string, string> {
  return fromCompanyId ? { fromCompany: fromCompanyId } : {}
}
