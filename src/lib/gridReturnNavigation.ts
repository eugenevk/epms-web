import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import {
  globalSearchBackLabel,
  globalSearchHomeRoute,
  readGlobalSearchReturnState,
} from '@/lib/globalSearchNavigation'

export const GRID_RETURN_PARAM = 'returnTo'

export type DetailBackDestination = {
  route: RouteLocationRaw
  label: string
}

const LIST_LABELS: Record<string, string> = {
  companies: 'Back to companies',
  contacts: 'Back to contacts',
  opportunities: 'Back to opportunities',
  rfps: 'Back to RFPs',
  tasks: 'Back to tasks',
  notes: 'Back to notes',
  'products-services': 'Back to Products & Services',
  kb: 'Back to Knowledge Base',
}

const COMPANY_TAB_LABELS: Record<string, string> = {
  contacts: 'Back to company contacts',
  opportunities: 'Back to company opportunities',
  rfps: 'Back to company RFPs',
  notes: 'Back to company notes',
  tasks: 'Back to company tasks',
  'products-services': 'Back to company products & services',
}

const OPPORTUNITY_TAB_LABELS: Record<string, string> = {
  rfps: 'Back to opportunity RFPs',
  notes: 'Back to opportunity notes',
  tasks: 'Back to opportunity tasks',
}

const RFP_TAB_LABELS: Record<string, string> = {
  timeline: 'Back to RFP timeline',
  notes: 'Back to RFP notes',
  tasks: 'Back to RFP tasks',
}

const CREATE_LABELS: Record<string, string> = {
  companies: 'Back to companies',
  contacts: 'Back to contacts',
  opportunities: 'Back to opportunities',
  rfps: 'Back to RFPs',
}

/** Query params used only for navigation context, not page state to restore. */
const NAVIGATION_ONLY_QUERY_PARAMS = new Set([
  GRID_RETURN_PARAM,
  'fromSearch',
  'fromCompany',
  'fromOpportunity',
  'companyId',
  'companyLabel',
  'opportunityId',
  'opportunityLabel',
])

function isSafeReturnPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//')
}

export function buildGridReturnPath(route: RouteLocationNormalized): string {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(route.query)) {
    if (NAVIGATION_ONLY_QUERY_PARAMS.has(key)) continue
    if (typeof value === 'string') {
      query.append(key, value)
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') query.append(key, item)
      }
    }
  }

  const search = query.toString()
  return search ? `${route.path}?${search}` : route.path
}

export function readGridReturnPath(query: Record<string, unknown>): string | null {
  const value = query[GRID_RETURN_PARAM]
  if (typeof value !== 'string') return null

  const path = value.trim()
  return isSafeReturnPath(path) ? path : null
}

export function gridReturnLabel(returnPath: string): string {
  try {
    const url = new URL(returnPath, 'http://localhost')
    const pathname = url.pathname.replace(/\/+$/, '') || '/'

    if (pathname === '/') {
      return url.searchParams.has('q') ? 'Back to search results' : 'Back to home'
    }

    const listMatch = pathname.match(/^\/(companies|contacts|opportunities|rfps|tasks|notes|kb)$/)
    if (listMatch) {
      return LIST_LABELS[listMatch[1]] ?? 'Back'
    }

    const createMatch = pathname.match(/^\/(companies|contacts|opportunities|rfps)\/create$/)
    if (createMatch) {
      return CREATE_LABELS[createMatch[1]] ?? 'Back'
    }

    const contactMatch = pathname.match(/^\/contacts\/[^/]+$/)
    if (contactMatch && pathname !== '/contacts/create') {
      return 'Back to contact'
    }

    const companyMatch = pathname.match(/^\/companies\/[^/]+$/)
    if (companyMatch && pathname !== '/companies/create') {
      const tab = url.searchParams.get('tab')
      if (tab && COMPANY_TAB_LABELS[tab]) return COMPANY_TAB_LABELS[tab]
      return 'Back to company'
    }

    const opportunityMatch = pathname.match(/^\/opportunities\/[^/]+$/)
    if (opportunityMatch && pathname !== '/opportunities/create') {
      const tab = url.searchParams.get('tab')
      if (tab && OPPORTUNITY_TAB_LABELS[tab]) return OPPORTUNITY_TAB_LABELS[tab]
      return 'Back to opportunity'
    }

    const rfpMatch = pathname.match(/^\/rfps\/[^/]+$/)
    if (rfpMatch && pathname !== '/rfps/create') {
      const tab = url.searchParams.get('tab')
      if (tab && RFP_TAB_LABELS[tab]) return RFP_TAB_LABELS[tab]
      return 'Back to RFP'
    }

    return 'Back'
  } catch {
    return 'Back'
  }
}

export function appendGridReturn(
  route: RouteLocationRaw,
  returnPath: string,
): RouteLocationRaw {
  if (!isSafeReturnPath(returnPath)) return route

  if (typeof route === 'string') return route

  const existingQuery =
    route.query && typeof route.query === 'object' && !Array.isArray(route.query) ? route.query : {}

  return {
    ...route,
    query: {
      ...existingQuery,
      [GRID_RETURN_PARAM]: returnPath,
    },
  }
}

export function preserveGridReturnQuery(
  query: Record<string, unknown>,
  next: Record<string, string> = {},
): Record<string, string> {
  const returnPath = readGridReturnPath(query)
  if (!returnPath) return next
  return { ...next, [GRID_RETURN_PARAM]: returnPath }
}

export function resolveDetailBackDestination(
  query: Record<string, unknown>,
  fallback: DetailBackDestination,
): DetailBackDestination {
  const returnPath = readGridReturnPath(query)
  if (returnPath) {
    return {
      route: returnPath,
      label: gridReturnLabel(returnPath),
    }
  }

  const searchReturnState = readGlobalSearchReturnState(query)
  if (searchReturnState) {
    return {
      route: globalSearchHomeRoute(searchReturnState),
      label: globalSearchBackLabel(),
    }
  }

  return fallback
}
