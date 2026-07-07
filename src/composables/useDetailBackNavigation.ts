import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  resolveDetailBackDestination,
  type DetailBackDestination,
} from '@/lib/gridReturnNavigation'

export function useDetailBackNavigation(getFallback: () => DetailBackDestination) {
  const route = useRoute()
  const router = useRouter()

  const back = computed(() =>
    resolveDetailBackDestination(route.query, getFallback()),
  )

  const backLabel = computed(() => back.value.label)
  const backRoute = computed(() => back.value.route)

  function navigateBack() {
    return router.push(backRoute.value)
  }

  return {
    backRoute,
    backLabel,
    navigateBack,
  }
}
