import type { RouteLocationRaw } from 'vue-router'
import { GLOBAL_SEARCH_INDICES, type GlobalSearchIndexId } from '@/lib/globalSearch'

export const GLOBAL_SEARCH_QUERY_PARAM = 'q'
export const GLOBAL_SEARCH_TYPES_PARAM = 'types'
export const GLOBAL_SEARCH_FROM_PARAM = 'fromSearch'

const VALID_INDEX_IDS = new Set<string>(GLOBAL_SEARCH_INDICES.map((index) => index.id))

export type GlobalSearchRouteState = {
  query: string
  types: GlobalSearchIndexId[]
}

function isGlobalSearchIndexId(value: string): value is GlobalSearchIndexId {
  return VALID_INDEX_IDS.has(value)
}

export function parseGlobalSearchRouteState(
  query: Record<string, unknown>,
): GlobalSearchRouteState {
  const searchQuery =
    typeof query[GLOBAL_SEARCH_QUERY_PARAM] === 'string'
      ? query[GLOBAL_SEARCH_QUERY_PARAM]
      : ''

  const typesRaw =
    typeof query[GLOBAL_SEARCH_TYPES_PARAM] === 'string' ? query[GLOBAL_SEARCH_TYPES_PARAM] : ''

  const types = typesRaw
    .split(',')
    .map((value) => value.trim())
    .filter(isGlobalSearchIndexId)

  return { query: searchQuery, types }
}

export function isGlobalSearchReturn(query: Record<string, unknown>): boolean {
  return query[GLOBAL_SEARCH_FROM_PARAM] === '1'
}

export function readGlobalSearchReturnState(
  query: Record<string, unknown>,
): GlobalSearchRouteState | null {
  if (!isGlobalSearchReturn(query)) return null

  const state = parseGlobalSearchRouteState(query)
  return state.query ? state : null
}

export function globalSearchRouteQuery(state: GlobalSearchRouteState): Record<string, string> {
  const routeQuery: Record<string, string> = {}

  if (state.query) {
    routeQuery[GLOBAL_SEARCH_QUERY_PARAM] = state.query
  }

  if (state.types.length > 0) {
    routeQuery[GLOBAL_SEARCH_TYPES_PARAM] = state.types.join(',')
  }

  return routeQuery
}

export function globalSearchHomeRoute(state: GlobalSearchRouteState): RouteLocationRaw {
  return {
    name: 'home',
    query: globalSearchRouteQuery(state),
  }
}

export function globalSearchReturnPath(state: GlobalSearchRouteState): string {
  const search = new URLSearchParams(globalSearchRouteQuery(state)).toString()
  return search ? `/?${search}` : '/'
}

export function globalSearchReturnQuery(state: GlobalSearchRouteState): Record<string, string> {
  return {
    [GLOBAL_SEARCH_FROM_PARAM]: '1',
    ...globalSearchRouteQuery(state),
  }
}

export function appendGlobalSearchReturn(
  route: RouteLocationRaw,
  state: GlobalSearchRouteState,
): RouteLocationRaw {
  if (typeof route === 'string' || !state.query) {
    return route
  }

  const existingQuery =
    route.query && typeof route.query === 'object' && !Array.isArray(route.query) ? route.query : {}

  return {
    ...route,
    query: {
      ...existingQuery,
      ...globalSearchReturnQuery(state),
    },
  }
}

export function globalSearchBackLabel(): string {
  return 'Back to search results'
}

export function globalSearchRouteQueriesEqual(
  left: Record<string, unknown>,
  right: Record<string, string>,
): boolean {
  const leftState = parseGlobalSearchRouteState(left)
  const rightState = parseGlobalSearchRouteState(right)

  return (
    leftState.query === rightState.query &&
    leftState.types.join(',') === rightState.types.join(',')
  )
}
