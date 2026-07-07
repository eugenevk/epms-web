import type { RouteLocationRaw } from 'vue-router'

export function opportunityReturnCompanyId(query: Record<string, unknown>): string | null {
  const fromCompany = query.fromCompany
  if (typeof fromCompany === 'string' && fromCompany.trim()) {
    return fromCompany.trim()
  }
  return null
}

export function opportunityBackLabel(fromCompanyId: string | null): string {
  return fromCompanyId ? 'Back to company opportunities' : 'Back to opportunities'
}

export function opportunityBackRoute(fromCompanyId: string | null): RouteLocationRaw {
  if (fromCompanyId) {
    return {
      name: 'company-details',
      params: { id: fromCompanyId },
      query: { tab: 'opportunities' },
    }
  }

  return { name: 'opportunities' }
}

export function opportunityDetailsQuery(fromCompanyId: string | null): Record<string, string> {
  return fromCompanyId ? { fromCompany: fromCompanyId } : {}
}

export function createOpportunityQuery(companyId: string, companyLabel: string): Record<string, string> {
  return {
    fromCompany: companyId,
    companyId,
    companyLabel,
  }
}
