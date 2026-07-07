import { ref, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export const LIST_GRID_QUERY_PARAM = 'q'

function readRouteQuery(query: Record<string, unknown>): string {
  const value = query[LIST_GRID_QUERY_PARAM]
  return typeof value === 'string' ? value : ''
}

export function useListGridRouteQuery(
  routeName: string,
  query: Ref<string>,
  debouncedQuery: Ref<string>,
) {
  const route = useRoute()
  const router = useRouter()
  const restoringFromRoute = ref(false)

  function restoreFromRoute() {
    const routeQuery = readRouteQuery(route.query)
    if (routeQuery === debouncedQuery.value) return

    restoringFromRoute.value = true
    query.value = routeQuery
    debouncedQuery.value = routeQuery
    restoringFromRoute.value = false
  }

  function syncRouteFromQuery() {
    if (route.name !== routeName) return

    const next = debouncedQuery.value
    const current = readRouteQuery(route.query)

    if (next === current) return

    void router.replace({
      name: routeName,
      query: next ? { [LIST_GRID_QUERY_PARAM]: next } : {},
    })
  }

  restoreFromRoute()

  watch(debouncedQuery, () => {
    if (!restoringFromRoute.value) {
      syncRouteFromQuery()
    }
  })

  watch(
    () => route.query[LIST_GRID_QUERY_PARAM],
    () => {
      if (route.name === routeName) {
        restoreFromRoute()
      }
    },
  )
}
