import { computed } from 'vue'
import { useRoute, type RouteLocationRaw } from 'vue-router'
import { appendGridReturn, buildGridReturnPath } from '@/lib/gridReturnNavigation'

export function useGridReturnLink() {
  const route = useRoute()
  const returnPath = computed(() => buildGridReturnPath(route))

  function withReturn(to: RouteLocationRaw): RouteLocationRaw {
    return appendGridReturn(to, returnPath.value)
  }

  return { withReturn, returnPath }
}
