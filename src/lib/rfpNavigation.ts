import type { RouteLocationRaw } from 'vue-router'

export function rfpReturnCompanyId(query: Record<string, unknown>): string | null {
  const fromCompany = query.fromCompany
  if (typeof fromCompany === 'string' && fromCompany.trim()) {
    return fromCompany.trim()
  }
  return null
}

export function rfpReturnOpportunityId(query: Record<string, unknown>): string | null {
  const fromOpportunity = query.fromOpportunity
  if (typeof fromOpportunity === 'string' && fromOpportunity.trim()) {
    return fromOpportunity.trim()
  }
  return null
}

export function rfpBackLabel(fromCompanyId: string | null, fromOpportunityId: string | null): string {
  if (fromOpportunityId) return 'Back to opportunity RFPs'
  if (fromCompanyId) return 'Back to company RFPs'
  return 'Back to RFPs'
}

export function rfpBackRoute(
  fromCompanyId: string | null,
  fromOpportunityId: string | null,
): RouteLocationRaw {
  if (fromOpportunityId) {
    return {
      name: 'opportunity-details',
      params: { id: fromOpportunityId },
      query: { tab: 'rfps' },
    }
  }

  if (fromCompanyId) {
    return {
      name: 'company-details',
      params: { id: fromCompanyId },
      query: { tab: 'rfps' },
    }
  }

  return { name: 'rfps' }
}

export function rfpDetailsQuery(options: {
  fromCompanyId?: string | null
  fromOpportunityId?: string | null
}): Record<string, string> {
  const query: Record<string, string> = {}
  if (options.fromCompanyId) query.fromCompany = options.fromCompanyId
  if (options.fromOpportunityId) query.fromOpportunity = options.fromOpportunityId
  return query
}

export function createRfpQuery(options: {
  companyId: string
  companyLabel: string
  opportunityId?: string | null
  opportunityLabel?: string | null
}): Record<string, string> {
  const query: Record<string, string> = {
    fromCompany: options.companyId,
    companyId: options.companyId,
    companyLabel: options.companyLabel,
  }

  if (options.opportunityId && options.opportunityLabel) {
    query.fromOpportunity = options.opportunityId
    query.opportunityId = options.opportunityId
    query.opportunityLabel = options.opportunityLabel
  }

  return query
}
