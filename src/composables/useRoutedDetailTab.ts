import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export function useRoutedDetailTab<T extends string>(
  isValidTab: (value: unknown) => value is T,
  defaultTab: T,
) {
  const route = useRoute()
  const router = useRouter()

  function readTab(): T {
    return isValidTab(route.query.tab) ? route.query.tab : defaultTab
  }

  const activeTab = ref<T>(readTab())

  watch(
    () => route.query.tab,
    () => {
      activeTab.value = readTab()
    },
  )

  function setActiveTab(tab: T) {
    if (activeTab.value === tab) return

    const query: Record<string, string | string[]> = {}
    for (const [key, value] of Object.entries(route.query)) {
      if (value === null || value === undefined) continue
      query[key] = value as string | string[]
    }

    if (tab === defaultTab) {
      delete query.tab
    } else {
      query.tab = tab
    }

    activeTab.value = tab
    void router.replace({ path: route.path, query })
  }

  return { activeTab, setActiveTab, readTab }
}
