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
import { isAlgoliaConfigured } from '@/lib/algoliaClient'
import {
  renderCompanyFieldHighlight,
  renderCompanyNameHighlight,
} from '@/lib/algoliaHighlight'
import {
  COMPANY_FACET_KEYS,
  companyDisplayName,
  formatCompanyFacetLabel,
  searchCompanies,
  type CompanyFacetFilters,
  type CompanyFacetKey,
  type CompanyHit,
} from '@/lib/companiesAlgolia'
import { paginateItems } from '@/lib/gridPagination'
import { formatInteger } from '@/lib/formatNumber'

const query = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)
const debouncedQuery = ref('')
const facetFilters = ref<CompanyFacetFilters>({})
const showFilters = ref(true)
const loading = ref(true)
const error = ref<string | null>(null)
const hits = ref<CompanyHit[]>([])
const page = ref(0)
const nbHits = ref(0)
const facets = ref<Partial<Record<CompanyFacetKey, Record<string, number>>>>({})
const searchSource = ref<'algolia' | 'firestore'>('algolia')

let debounceTimer: number | undefined

useListGridRouteQuery('companies', query, debouncedQuery)

const { withReturn } = useGridReturnLink()

const algoliaReady = computed(() => isAlgoliaConfigured())

const { sortState, sortedItems, onSort } = useGridSort(
  hits,
  {
    name: (company) => companyDisplayName(company),
    companyType: (company) => company.companyType?.label ?? '',
    country: (company) => company.country?.label ?? '',
    industry: (company) => company.industry?.label ?? '',
    numOfContacts: (company) => company.numOfContacts ?? 0,
    healthScore: (company) => company.healthScore ?? 0,
    isReference: (company) => (company.isReference ? 1 : 0),
  },
  { column: 'name', direction: 'asc' },
  {
    numOfContacts: 'desc',
    healthScore: 'desc',
  },
)

const pagination = computed(() => paginateItems(sortedItems.value, page.value))

const visibleHits = computed(() => pagination.value.items)

const hasActiveFilters = computed(() =>
  COMPANY_FACET_KEYS.some((key) => (facetFilters.value[key]?.length ?? 0) > 0),
)

const facetLabels: Record<CompanyFacetKey, string> = {
  'companyType.label': 'Company type',
  'industry.label': 'Industry',
  'accountManager.objectLabel': 'Account executive',
  'implPartner.objectLabel': 'Implementation partner',
  'country.label': 'Country',
  healthScore: 'Health score',
  isReference: 'Reference',
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
    void loadCompanies()
  },
  { deep: true },
)

onMounted(() => {
  void loadCompanies()
  searchInputRef.value?.focus()
})

async function loadCompanies() {
  loading.value = true
  error.value = null

  try {
    const result = await searchCompanies({
      query: debouncedQuery.value,
      facetFilters: facetFilters.value,
    })
    hits.value = result.hits
    nbHits.value = result.nbHits
    if (page.value >= pagination.value.nbPages) {
      page.value = Math.max(0, pagination.value.nbPages - 1)
    }
    facets.value = result.facets
    searchSource.value = result.source
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Could not load companies.'
    hits.value = []
    page.value = 0
    nbHits.value = 0
    facets.value = {}
  } finally {
    loading.value = false
  }
}

function toggleFacet(attribute: CompanyFacetKey, value: string) {
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

function selectedFacetValues(attribute: CompanyFacetKey): string[] {
  return facetFilters.value[attribute] ?? []
}

function companyId(company: CompanyHit): string {
  return company.id ?? company.objectID
}

function formatYesNo(value: boolean | undefined): string {
  return value ? 'Yes' : 'No'
}

function referenceBadgeClass(isReference: boolean | undefined): string {
  return isReference
    ? 'bg-emerald-100 text-emerald-800'
    : 'bg-red-100 text-red-800'
}

function companyInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

function renderStars(score: number | undefined): string {
  const value = Math.min(Math.max(Math.round(score ?? 0), 0), 5)
  return '★'.repeat(value) + '☆'.repeat(5 - value)
}

function nameHighlight(company: CompanyHit): string {
  return renderCompanyNameHighlight(
    company,
    companyDisplayName(company),
    debouncedQuery.value,
    searchSource.value,
  )
}

function fieldHighlight(
  company: CompanyHit,
  attribute: 'companyType.label' | 'country.label' | 'industry.label',
  value: string | null | undefined,
): string {
  const fallback = value?.trim() || '—'
  return renderCompanyFieldHighlight(
    company,
    attribute,
    fallback,
    debouncedQuery.value,
    searchSource.value,
  )
}

function handleSort(column: string, options = {}) {
  onSort(column, options)
  page.value = 0
}
</script>

<template>
  <section class="w-full">
    <div class="grid items-end gap-4 lg:grid-cols-[1fr_minmax(20rem,40rem)_1fr]">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold text-epms-900">Companies</h1>
        <p class="mt-1 text-sm text-stone-600">
          Browse and manage company records.
        </p>
      </div>

      <div class="flex w-full min-w-0 items-end gap-3 lg:justify-self-center">
        <label class="min-w-0 flex-1">
          <span class="sr-only">Search companies</span>
          <input
            ref="searchInputRef"
            v-model="query"
            type="search"
            placeholder="Search name, city, industry, description…"
            class="w-full rounded-xl px-3 py-2.5 text-sm font-normal text-stone-900 field-focus"
          />
        </label>

        <GridSearchStats :loading="loading" :nb-hits="nbHits" singular="company" plural="companies" />
      </div>

      <div class="flex justify-end">
        <RouterLink
          :to="withReturn({ name: 'create-company' })"
          class="inline-flex shrink-0 items-center rounded-lg bg-epms-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-epms-800"
        >
          New company
        </RouterLink>
      </div>
    </div>

    <div v-if="!algoliaReady" class="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      Algolia is not configured. Add <code class="rounded bg-amber-100 px-1">VITE_ALGOLIA_APP_ID</code> and
      <code class="rounded bg-amber-100 px-1">VITE_ALGOLIA_SEARCH_KEY</code> to your <code class="rounded bg-amber-100 px-1">.env</code>.
    </div>

    <div class="mt-6">
      <div class="flex items-center justify-between gap-3">
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

      <p v-if="error" class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {{ error }}
      </p>

      <div class="mt-4 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside v-if="showFilters" class="space-y-6 rounded-xl border border-stone-200 bg-stone-100 p-4">
          <AlgoliaFacetFilter
            v-for="attribute in COMPANY_FACET_KEYS"
            :key="attribute"
            :label="facetLabels[attribute]"
            :facets="facets[attribute]"
            :selected="selectedFacetValues(attribute)"
            :format-value="(value) => formatCompanyFacetLabel(attribute, value)"
            @toggle="toggleFacet(attribute, $event)"
          />
        </aside>

        <div class="min-w-0 overflow-x-auto rounded-xl border border-stone-200">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-stone-100 text-xs font-semibold uppercase tracking-wide text-stone-600">
              <tr>
                <th class="w-16 px-4 py-3"><span class="sr-only">Logo</span></th>
                <GridSortHeader
                  column="name"
                  label="Company name"
                  :sort-state="sortState"
                  cell-class="min-w-[12rem] px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="companyType"
                  label="Type"
                  :sort-state="sortState"
                  cell-class="px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="country"
                  label="Country"
                  :sort-state="sortState"
                  cell-class="px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="industry"
                  label="Industry"
                  :sort-state="sortState"
                  cell-class="px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="numOfContacts"
                  label="Contacts"
                  :sort-state="sortState"
                  align="center"
                  cell-class="whitespace-nowrap px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="healthScore"
                  label="Health"
                  :sort-state="sortState"
                  cell-class="whitespace-nowrap px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="isReference"
                  label="Reference"
                  :sort-state="sortState"
                  align="center"
                  cell-class="px-4 py-3"
                  @sort="handleSort"
                />
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="8" class="px-4 py-8 text-center text-stone-500">Loading companies…</td>
              </tr>
              <tr v-else-if="visibleHits.length === 0">
                <td colspan="8" class="px-4 py-8 text-center text-stone-500">No companies found.</td>
              </tr>
              <tr
                v-for="company in visibleHits"
                v-else
                :key="company.objectID"
                class="border-t border-stone-100 transition odd:bg-white even:bg-stone-50 hover:bg-epms-50/40"
              >
                <td class="px-4 py-3">
                  <RouterLink
                    :to="withReturn({ name: 'company-details', params: { id: companyId(company) } })"
                    class="block"
                    :aria-label="`${companyDisplayName(company)} details`"
                  >
                    <div
                      class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border-[0.5px] border-stone-200 bg-stone-50"
                    >
                      <img
                        v-if="company.logoUrl"
                        :src="company.logoUrl"
                        :alt="`${companyDisplayName(company)} logo`"
                        class="h-full w-full object-contain"
                      />
                      <span v-else class="text-sm font-semibold text-stone-400">
                        {{ companyInitial(companyDisplayName(company)) }}
                      </span>
                    </div>
                  </RouterLink>
                </td>
                <td class="min-w-[12rem] px-4 py-3 font-medium text-epms-900">
                  <RouterLink
                    :to="withReturn({ name: 'company-details', params: { id: companyId(company) } })"
                    class="hover:underline"
                  >
                    <SearchHighlight :html="nameHighlight(company)" />
                  </RouterLink>
                </td>
                <td class="px-4 py-3 text-stone-700">
                  <SearchHighlight
                    :html="fieldHighlight(company, 'companyType.label', company.companyType?.label)"
                  />
                </td>
                <td class="px-4 py-3 text-stone-700">
                  <SearchHighlight
                    :html="fieldHighlight(company, 'country.label', company.country?.label)"
                  />
                </td>
                <td class="px-4 py-3 text-stone-700">
                  <SearchHighlight
                    :html="fieldHighlight(company, 'industry.label', company.industry?.label)"
                  />
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-center text-stone-700">
                  {{ formatInteger(company.numOfContacts ?? 0) }}
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-amber-500">{{ renderStars(company.healthScore) }}</td>
                <td class="px-4 py-3 text-center">
                  <span
                    class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    :class="referenceBadgeClass(company.isReference)"
                  >
                    {{ formatYesNo(company.isReference) }}
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
