<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AlgoliaFacetFilter from '@/components/AlgoliaFacetFilter.vue'
import GlobalSearchResultCard from '@/components/GlobalSearchResultCard.vue'
import OpenRfpMilestonesOverview from '@/components/OpenRfpMilestonesOverview.vue'
import OpenTasksOverview from '@/components/OpenTasksOverview.vue'
import { isAlgoliaConfigured } from '@/lib/algoliaClient'
import { formatInteger } from '@/lib/formatNumber'
import {
  buildGlobalSearchTypeFacets,
  flattenGlobalSearchHits,
  formatAlgoliaSearchError,
  globalSearchTypeLabel,
  searchAllIndices,
  type GlobalSearchGroup,
  type GlobalSearchIndexId,
} from '@/lib/globalSearch'
import {
  globalSearchRouteQueriesEqual,
  globalSearchRouteQuery,
  parseGlobalSearchRouteState,
} from '@/lib/globalSearchNavigation'

const MIN_QUERY_LENGTH = 2

const route = useRoute()
const router = useRouter()

const searchInputRef = ref<HTMLInputElement | null>(null)
const query = ref('')
const debouncedQuery = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const hasSearched = ref(false)
const groups = ref<GlobalSearchGroup[]>([])
const selectedTypes = ref<GlobalSearchIndexId[]>([])
const showFilters = ref(true)
const restoringFromRoute = ref(false)

let debounceTimer: number | undefined

const algoliaReady = computed(() => isAlgoliaConfigured())
const trimmedQuery = computed(() => debouncedQuery.value.trim())
const showResults = computed(() => hasSearched.value && trimmedQuery.value.length >= MIN_QUERY_LENGTH)
const typeFacets = computed(() => buildGlobalSearchTypeFacets(groups.value))
const allHits = computed(() => flattenGlobalSearchHits(groups.value))
const filteredHits = computed(() => {
  if (selectedTypes.value.length === 0) return allHits.value
  return allHits.value.filter((hit) => selectedTypes.value.includes(hit.indexId))
})
const totalHits = computed(() => groups.value.reduce((sum, group) => sum + group.nbHits, 0))
const hasHits = computed(() => filteredHits.value.length > 0)
const hasActiveFilters = computed(() => selectedTypes.value.length > 0)
const searchRouteState = computed(() => ({
  query: debouncedQuery.value,
  types: selectedTypes.value,
}))

watch(query, (value) => {
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    debouncedQuery.value = value
  }, 300)
})

watch(debouncedQuery, () => {
  if (!restoringFromRoute.value) {
    selectedTypes.value = []
  }
  void runSearch()
  syncRouteFromState()
})

watch(selectedTypes, () => {
  syncRouteFromState()
}, { deep: true })

function restoreSearchFromRoute() {
  const { query: routeQuery, types } = parseGlobalSearchRouteState(route.query)

  if (routeQuery) {
    if (
      routeQuery === debouncedQuery.value &&
      types.join(',') === selectedTypes.value.join(',')
    ) {
      return
    }

    restoringFromRoute.value = true
    query.value = routeQuery
    debouncedQuery.value = routeQuery
    selectedTypes.value = types
    restoringFromRoute.value = false
    return
  }

  if (debouncedQuery.value) {
    query.value = ''
    debouncedQuery.value = ''
    selectedTypes.value = []
    groups.value = []
    hasSearched.value = false
    error.value = null
    loading.value = false
  }
}

onMounted(async () => {
  restoreSearchFromRoute()
  await focusSearchInput()
})

watch(
  () => [route.name, route.query.q, route.query.types] as const,
  ([name]) => {
    if (name === 'home') {
      restoreSearchFromRoute()
    }
  },
)

watch(
  () => route.name,
  (name) => {
    if (name === 'home') {
      void focusSearchInput()
    }
  },
)

async function focusSearchInput() {
  await nextTick()
  searchInputRef.value?.focus()
}

function syncRouteFromState() {
  if (route.name !== 'home') return

  if (!debouncedQuery.value) {
    if (route.query.q || route.query.types) {
      void router.replace({ name: 'home' })
    }
    return
  }

  const nextQuery = globalSearchRouteQuery(searchRouteState.value)
  if (globalSearchRouteQueriesEqual(route.query, nextQuery)) return

  void router.replace({ name: 'home', query: nextQuery })
}

async function runSearch() {
  const needle = trimmedQuery.value

  if (needle.length < MIN_QUERY_LENGTH) {
    groups.value = []
    hasSearched.value = false
    error.value = null
    loading.value = false
    return
  }

  if (!algoliaReady.value) {
    groups.value = []
    hasSearched.value = true
    error.value = 'Algolia is not configured.'
    return
  }

  loading.value = true
  error.value = null

  try {
    groups.value = await searchAllIndices(needle)
    hasSearched.value = true
  } catch (searchError) {
    groups.value = []
    hasSearched.value = true
    error.value = formatAlgoliaSearchError(searchError)
  } finally {
    loading.value = false
  }
}

function submitSearch() {
  window.clearTimeout(debounceTimer)
  debouncedQuery.value = query.value
}

function toggleType(indexId: string) {
  const typedId = indexId as GlobalSearchIndexId
  const current = selectedTypes.value
  selectedTypes.value = current.includes(typedId)
    ? current.filter((value) => value !== typedId)
    : [...current, typedId]
}

function clearFilters() {
  selectedTypes.value = []
}
</script>

<template>
  <div class="w-full">
    <div
      class="flex justify-center"
      :class="showResults ? '' : 'mb-6'"
    >
      <form class="w-full max-w-2xl" @submit.prevent="submitSearch">
        <label class="sr-only" for="global-search">Search EPMS</label>
        <div
          class="flex items-center gap-3 rounded-full border border-stone-300 bg-white px-5 py-3 shadow-sm transition focus-within:border-epms-500 focus-within:ring-2 focus-within:ring-epms-600/20"
        >
          <FontAwesomeIcon icon="magnifying-glass" class="h-5 w-5 shrink-0 text-stone-400" />
          <input
            id="global-search"
            ref="searchInputRef"
            v-model="query"
            type="search"
            autocomplete="off"
            placeholder="Search companies, contacts, notes, opportunities…"
            class="min-w-0 flex-1 border-0 bg-transparent text-base text-stone-900 outline-none placeholder:text-stone-400"
          />
        </div>
      </form>
    </div>

    <p v-if="!showResults && !algoliaReady" class="mb-6 text-sm text-amber-800">
      Algolia is not configured. Add <code class="rounded bg-amber-100 px-1">VITE_ALGOLIA_APP_ID</code> and
      <code class="rounded bg-amber-100 px-1">VITE_ALGOLIA_SEARCH_KEY</code> to your
      <code class="rounded bg-amber-100 px-1">.env</code>.
    </p>

    <OpenTasksOverview v-if="!showResults" class="w-full" />
    <OpenRfpMilestonesOverview v-if="!showResults" class="w-full" />

    <div v-if="showResults" class="mt-4 w-full">
      <p class="text-sm text-stone-500">
        <span v-if="loading">Searching…</span>
        <span v-else-if="error">{{ error }}</span>
        <span v-else-if="hasHits">
          Showing {{ formatInteger(filteredHits.length) }} of about
          {{ formatInteger(totalHits) }} result{{ totalHits === 1 ? '' : 's' }}
          for <strong class="font-medium text-stone-700">{{ trimmedQuery }}</strong>
        </span>
        <span v-else-if="allHits.length > 0 && hasActiveFilters">
          No results match the selected filters.
        </span>
        <span v-else>
          No results for <strong class="font-medium text-stone-700">{{ trimmedQuery }}</strong>
        </span>
      </p>

      <div class="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          class="text-sm font-medium text-epms-800 transition hover:text-epms-950"
          @click="showFilters = !showFilters"
        >
          {{ showFilters ? 'Hide filters' : 'Show filters' }}
        </button>

        <button
          v-if="hasActiveFilters"
          type="button"
          class="text-sm font-medium text-stone-600 transition hover:text-stone-900"
          @click="clearFilters"
        >
          Clear filters
        </button>
      </div>

      <div v-if="!loading && !error && allHits.length > 0" class="mt-4 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside v-if="showFilters" class="space-y-6 rounded-xl border border-stone-200 bg-stone-100 p-4">
          <AlgoliaFacetFilter
            label="Type"
            :facets="typeFacets"
            :selected="selectedTypes"
            :format-value="globalSearchTypeLabel"
            @toggle="toggleType"
          />
        </aside>

        <div class="min-w-0">
          <div
            v-if="filteredHits.length > 0"
            class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
          >
            <GlobalSearchResultCard
              v-for="hit in filteredHits"
              :key="`${hit.indexId}-${hit.objectID}`"
              :hit="hit"
              :search-query="debouncedQuery"
              :search-types="selectedTypes"
            />
          </div>

          <p
            v-else
            class="rounded-xl border border-stone-200 bg-stone-50 px-4 py-8 text-center text-sm text-stone-600"
          >
            No results match the selected filters.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
