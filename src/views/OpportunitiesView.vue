<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AlgoliaFacetFilter from '@/components/AlgoliaFacetFilter.vue'
import GridPagination from '@/components/GridPagination.vue'
import GridSearchStats from '@/components/GridSearchStats.vue'
import GridSortHeader from '@/components/GridSortHeader.vue'
import SearchHighlight from '@/components/SearchHighlight.vue'
import { useGridReturnLink } from '@/composables/useGridReturnLink'
import { useListGridRouteQuery } from '@/composables/useListGridRouteQuery'
import { useGridSort } from '@/composables/useGridSort'
import { highlightQueryInText } from '@/lib/algoliaHighlight'
import { isAlgoliaConfigured } from '@/lib/algoliaClient'
import { paginateItems } from '@/lib/gridPagination'
import { opportunityDisplayTitle, formatOpportunityAcv, opportunityStageBadgeClass, activeBadgeClass, resolveOpportunityStageValue, OPPORTUNITY_GRID_DEFAULT_SORT } from '@/lib/opportunities'
import {
  formatOpportunityFacetLabel,
  OPPORTUNITY_LIST_FACET_KEYS,
  searchOpportunities,
  type OpportunityHit,
  type OpportunityListFacetFilters,
  type OpportunityListFacetKey,
} from '@/lib/opportunitiesAlgolia'

const query = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)
const debouncedQuery = ref('')
const facetFilters = ref<OpportunityListFacetFilters>({})
const showFilters = ref(true)
const loading = ref(true)
const error = ref<string | null>(null)
const hits = ref<OpportunityHit[]>([])
const page = ref(0)
const nbHits = ref(0)
const facets = ref<Partial<Record<OpportunityListFacetKey, Record<string, number>>>>({})

let debounceTimer: number | undefined

useListGridRouteQuery('opportunities', query, debouncedQuery)

const { withReturn } = useGridReturnLink()

const algoliaReady = computed(() => isAlgoliaConfigured())

const { sortState, sortedItems, onSort } = useGridSort(
  hits,
  {
    title: (opportunity) => opportunityDisplayTitle(opportunity),
    company: (opportunity) => opportunity.company?.objectLabel ?? '',
    stage: (opportunity) => resolveOpportunityStageValue(opportunity) ?? Number.NEGATIVE_INFINITY,
    status: (opportunity) => opportunity.status?.label ?? '',
    targetDt: (opportunity) => opportunity.targetDt ?? '',
    acv: (opportunity) => opportunity.acv ?? 0,
    likelihood: (opportunity) => opportunity.likelihood ?? -1,
    isActive: (opportunity) => (opportunity.isActive === false ? 0 : 1),
  },
  OPPORTUNITY_GRID_DEFAULT_SORT,
  {
    isActive: 'desc',
    stage: 'desc',
    targetDt: 'desc',
    acv: 'desc',
    likelihood: 'desc',
  },
)

const pagination = computed(() => paginateItems(sortedItems.value, page.value))
const visibleHits = computed(() => pagination.value.items)

const hasActiveFilters = computed(() =>
  OPPORTUNITY_LIST_FACET_KEYS.some((key) => (facetFilters.value[key]?.length ?? 0) > 0),
)

const facetLabels: Record<OpportunityListFacetKey, string> = {
  'company.objectLabel': 'Company',
  'status.label': 'Status',
  'stage.label': 'Stage',
  likelihood: 'Likelihood',
  isActive: 'Active',
}

watch(query, (value) => {
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    debouncedQuery.value = value
  }, 250)
})

watch(
  () => [debouncedQuery.value, facetFilters.value] as const,
  () => {
    page.value = 0
    void loadOpportunities()
  },
  { deep: true },
)

onMounted(() => {
  void loadOpportunities()
  searchInputRef.value?.focus()
})

async function loadOpportunities() {
  loading.value = true
  error.value = null

  try {
    const result = await searchOpportunities({
      query: debouncedQuery.value,
      facetFilters: facetFilters.value,
    })
    hits.value = result.hits
    nbHits.value = result.nbHits
    if (page.value >= pagination.value.nbPages) {
      page.value = Math.max(0, pagination.value.nbPages - 1)
    }
    facets.value = result.facets
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Could not load opportunities.'
    hits.value = []
    page.value = 0
    nbHits.value = 0
    facets.value = {}
  } finally {
    loading.value = false
  }
}

function toggleFacet(attribute: OpportunityListFacetKey, value: string) {
  const current = facetFilters.value[attribute] ?? []
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value]

  facetFilters.value = {
    ...facetFilters.value,
    [attribute]: next,
  }
}

function clearFacetFilters() {
  facetFilters.value = {}
}

function selectedFacetValues(attribute: OpportunityListFacetKey): string[] {
  return facetFilters.value[attribute] ?? []
}

function textHighlight(value: string | null | undefined): string {
  return highlightQueryInText(value?.trim() || '—', debouncedQuery.value)
}

function titleHighlight(opportunity: OpportunityHit): string {
  return highlightQueryInText(opportunityDisplayTitle(opportunity), debouncedQuery.value)
}

function handleSort(column: string, options = {}) {
  onSort(column, options)
  page.value = 0
}

function companyDetailsRoute(opportunity: OpportunityHit) {
  const id = opportunity.company?.id?.trim()
  if (!id) return null
  return { name: 'company-details' as const, params: { id } }
}
</script>

<template>
  <section class="w-full">
    <div class="grid items-end gap-4 lg:grid-cols-[1fr_minmax(20rem,40rem)_1fr]">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold text-epms-900">Opportunities</h1>
        <p class="mt-1 text-sm text-stone-600">
          Browse and search opportunities across all companies.
        </p>
      </div>

      <div class="flex w-full min-w-0 items-end gap-3 lg:justify-self-center">
        <label class="min-w-0 flex-1">
          <span class="sr-only">Search opportunities</span>
          <input
            ref="searchInputRef"
            v-model="query"
            type="search"
            placeholder="Search title, company, stage, status…"
            class="w-full rounded-xl px-3 py-2.5 text-sm font-normal text-stone-900 field-focus"
          />
        </label>

        <GridSearchStats :loading="loading" :nb-hits="nbHits" singular="opportunity" plural="opportunities" />
      </div>

      <div class="flex justify-end">
        <RouterLink
          :to="withReturn({ name: 'create-opportunity' })"
          class="inline-flex shrink-0 items-center rounded-lg bg-epms-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-epms-800"
        >
          New opportunity
        </RouterLink>
      </div>
    </div>

    <div v-if="!algoliaReady" class="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      Algolia is not configured. Add <code class="rounded bg-amber-100 px-1">VITE_ALGOLIA_APP_ID</code> and
      <code class="rounded bg-amber-100 px-1">VITE_ALGOLIA_SEARCH_KEY</code> to your <code class="rounded bg-amber-100 px-1">.env</code>.
    </div>

    <div class="mt-6">
      <p v-if="error" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {{ error }}
      </p>

      <div class="flex items-center justify-between gap-3" :class="error ? 'mt-4' : ''">
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
          class="ml-auto text-sm font-medium text-stone-600 transition hover:text-stone-900"
          @click="clearFacetFilters"
        >
          Clear filters
        </button>
      </div>

      <div class="mt-4 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside v-if="showFilters" class="space-y-6 rounded-xl border border-stone-200 bg-stone-100 p-4">
          <AlgoliaFacetFilter
            v-for="attribute in OPPORTUNITY_LIST_FACET_KEYS"
            :key="attribute"
            :label="facetLabels[attribute]"
            :facets="facets[attribute]"
            :selected="selectedFacetValues(attribute)"
            :format-value="(value) => formatOpportunityFacetLabel(attribute, value)"
            @toggle="toggleFacet(attribute, $event)"
          />
        </aside>

        <div class="min-w-0 overflow-x-auto rounded-xl border border-stone-200">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-stone-100 text-xs font-semibold uppercase tracking-wide text-stone-600">
              <tr>
                <GridSortHeader
                  column="title"
                  label="Title"
                  :sort-state="sortState"
                  cell-class="min-w-[12rem] px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="company"
                  label="Company"
                  :sort-state="sortState"
                  cell-class="min-w-[10rem] px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="stage"
                  label="Stage"
                  :sort-state="sortState"
                  align="center"
                  cell-class="px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="status"
                  label="Status"
                  :sort-state="sortState"
                  cell-class="px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="targetDt"
                  label="Target date"
                  :sort-state="sortState"
                  cell-class="px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="acv"
                  label="ACV"
                  :sort-state="sortState"
                  align="right"
                  cell-class="px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="likelihood"
                  label="Likelihood"
                  :sort-state="sortState"
                  align="center"
                  cell-class="px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="isActive"
                  label="Active"
                  :sort-state="sortState"
                  cell-class="px-4 py-3"
                  @sort="handleSort"
                />
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="8" class="px-4 py-8 text-center text-stone-500">Loading opportunities…</td>
              </tr>
              <tr v-else-if="visibleHits.length === 0">
                <td colspan="8" class="px-4 py-8 text-center text-stone-500">No opportunities found.</td>
              </tr>
              <tr
                v-for="opportunity in visibleHits"
                v-else
                :key="opportunity.objectID"
                class="border-t border-stone-100 transition odd:bg-white even:bg-stone-50 hover:bg-epms-50/40"
              >
                <td class="min-w-[12rem] px-4 py-3 font-medium text-epms-900">
                  <RouterLink
                    :to="withReturn({ name: 'opportunity-details', params: { id: opportunity.id ?? opportunity.objectID } })"
                    class="hover:underline"
                  >
                    <SearchHighlight :html="titleHighlight(opportunity)" />
                  </RouterLink>
                </td>
                <td class="min-w-[10rem] px-4 py-3 font-medium text-epms-900">
                  <RouterLink
                    v-if="companyDetailsRoute(opportunity)"
                    :to="withReturn(companyDetailsRoute(opportunity)!)"
                    class="hover:underline"
                  >
                    <SearchHighlight :html="textHighlight(opportunity.company?.objectLabel)" />
                  </RouterLink>
                  <SearchHighlight v-else :html="textHighlight(opportunity.company?.objectLabel)" />
                </td>
                <td class="px-4 py-3 text-center">
                  <span
                    v-if="opportunity.stage?.label"
                    class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    :class="opportunityStageBadgeClass(opportunity)"
                  >
                    <SearchHighlight :html="textHighlight(opportunity.stage.label)" />
                  </span>
                  <span v-else class="text-stone-500">—</span>
                </td>
                <td class="px-4 py-3 text-stone-700">
                  <SearchHighlight :html="textHighlight(opportunity.status?.label)" />
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-stone-700">
                  <SearchHighlight :html="textHighlight(opportunity.targetDt)" />
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-right text-stone-700 tabular-nums">
                  {{ formatOpportunityAcv(opportunity) }}
                </td>
                <td class="px-4 py-3 text-center text-stone-700">
                  {{ opportunity.likelihood ?? '—' }}<span v-if="opportunity.likelihood !== undefined">%</span>
                </td>
                <td class="px-4 py-3">
                  <span
                    class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    :class="activeBadgeClass(opportunity.isActive)"
                  >
                    {{ opportunity.isActive === false ? 'No' : 'Yes' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <GridPagination
            :page="pagination.page"
            :nb-pages="pagination.nbPages"
            :range-start="pagination.rangeStart"
            :range-end="pagination.rangeEnd"
            :nb-hits="nbHits"
            :loading="loading"
            @update:page="page = $event"
          />
        </div>
      </div>
    </div>
  </section>
</template>
