<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import GridPagination from '@/components/GridPagination.vue'
import GridSearchStats from '@/components/GridSearchStats.vue'
import GridSortHeader from '@/components/GridSortHeader.vue'
import SearchHighlight from '@/components/SearchHighlight.vue'
import { useGridReturnLink } from '@/composables/useGridReturnLink'
import { useGridSort } from '@/composables/useGridSort'
import { highlightQueryInText } from '@/lib/algoliaHighlight'
import { paginateItems } from '@/lib/gridPagination'
import { formatInteger } from '@/lib/formatNumber'
import { activeBadgeClass, formatRfpDate, RFP_GRID_DEFAULT_SORT } from '@/lib/rfps'
import { createRfpQuery, rfpDetailsQuery } from '@/lib/rfpNavigation'
import {
  rfpDisplayTitle,
  rfpRecordId,
  searchCompanyRfps,
  searchOpportunityRfps,
  type RfpHit,
} from '@/lib/rfpsAlgolia'

const props = withDefaults(
  defineProps<{
    companyId: string
    companyLabel: string
    opportunityId?: string
    opportunityLabel?: string
    emptyMessage?: string
  }>(),
  {
    emptyMessage: 'No RFPs found.',
  },
)

const { withReturn } = useGridReturnLink()

const query = ref('')
const debouncedQuery = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const hits = ref<RfpHit[]>([])
const page = ref(0)
const nbHits = ref(0)

let debounceTimer: number | undefined

const { sortState, sortedItems, onSort } = useGridSort(
  hits,
  {
    title: (rfp) => rfpDisplayTitle(rfp),
    company: (rfp) => rfp.company?.objectLabel ?? '',
    opportunity: (rfp) => rfp.opportunity?.objectLabel ?? '',
    dueDt: (rfp) => rfp.dueDt ?? '',
    status: (rfp) => rfp.status?.label ?? '',
    isActive: (rfp) => (rfp.isActive === false ? 0 : 1),
    openMilestones: (rfp) => rfp.numOfUncompletedMilestones ?? 0,
  },
  RFP_GRID_DEFAULT_SORT,
  { isActive: 'desc', dueDt: 'asc', title: 'asc' },
)

const pagination = computed(() => paginateItems(sortedItems.value, page.value))
const visibleHits = computed(() => pagination.value.items)

const createQuery = computed(() =>
  createRfpQuery({
    companyId: props.companyId,
    companyLabel: props.companyLabel,
    opportunityId: props.opportunityId,
    opportunityLabel: props.opportunityLabel,
  }),
)

const detailsQuery = computed(() =>
  rfpDetailsQuery({
    fromCompanyId: props.companyId,
    fromOpportunityId: props.opportunityId ?? null,
  }),
)

watch(query, (value) => {
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    debouncedQuery.value = value
  }, 250)
})

watch(
  () => [props.companyId, props.companyLabel, props.opportunityId, debouncedQuery.value] as const,
  () => {
    page.value = 0
    void loadRfps()
  },
)

onMounted(() => {
  void loadRfps()
})

async function loadRfps() {
  loading.value = true
  error.value = null

  try {
    const result = props.opportunityId
      ? await searchOpportunityRfps({
          opportunityId: props.opportunityId,
          query: debouncedQuery.value,
        })
      : await searchCompanyRfps({
          companyId: props.companyId,
          companyLabel: props.companyLabel,
          query: debouncedQuery.value,
        })

    hits.value = result.hits
    nbHits.value = result.nbHits
    if (page.value >= pagination.value.nbPages) {
      page.value = Math.max(0, pagination.value.nbPages - 1)
    }
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Could not load RFPs.'
    hits.value = []
    page.value = 0
    nbHits.value = 0
  } finally {
    loading.value = false
  }
}

function titleHighlight(rfp: RfpHit): string {
  return highlightQueryInText(rfpDisplayTitle(rfp), debouncedQuery.value)
}

function textHighlight(value: string | null | undefined): string {
  return highlightQueryInText(value?.trim() || '—', debouncedQuery.value)
}

function handleSort(column: string, options = {}) {
  onSort(column, options)
  page.value = 0
}

function companyDetailsRoute(rfp: RfpHit) {
  const id = rfp.company?.id ?? props.companyId
  if (!id) return null
  return withReturn({ name: 'company-details' as const, params: { id } })
}

function opportunityDetailsRoute(rfp: RfpHit) {
  const id = rfp.opportunity?.id
  if (!id) return null
  return withReturn({ name: 'opportunity-details' as const, params: { id } })
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-end gap-4">
      <label class="w-96 shrink-0">
        <span class="sr-only">Search RFPs</span>
        <input
          v-model="query"
          type="search"
          placeholder="Search title, number, status…"
          class="w-full rounded-xl px-3 py-2.5 text-sm font-normal text-stone-900 field-focus"
        />
      </label>

      <GridSearchStats :loading="loading" :nb-hits="nbHits" singular="RFP" plural="RFPs" />

      <RouterLink
        :to="withReturn({ name: 'create-rfp', query: createQuery })"
        class="ml-auto inline-flex items-center rounded-lg bg-epms-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-epms-800"
      >
        New RFP
      </RouterLink>
    </div>

    <p v-if="error" class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {{ error }}
    </p>

    <div class="mt-4 min-w-0 overflow-x-auto rounded-xl border border-stone-200">
      <table class="min-w-full text-left text-sm">
        <thead class="bg-stone-100 text-xs font-semibold uppercase tracking-wide text-stone-600">
          <tr>
            <GridSortHeader column="title" label="Title" :sort-state="sortState" cell-class="min-w-[12rem] px-4 py-3" @sort="handleSort" />
            <GridSortHeader
              v-if="opportunityId"
              column="company"
              label="Company"
              :sort-state="sortState"
              cell-class="px-4 py-3"
              @sort="handleSort"
            />
            <GridSortHeader
              v-else
              column="opportunity"
              label="Opportunity"
              :sort-state="sortState"
              cell-class="px-4 py-3"
              @sort="handleSort"
            />
            <GridSortHeader column="dueDt" label="Due date" :sort-state="sortState" cell-class="px-4 py-3" @sort="handleSort" />
            <GridSortHeader column="status" label="Status" :sort-state="sortState" cell-class="min-w-[10rem] whitespace-nowrap px-4 py-3" @sort="handleSort" />
            <GridSortHeader column="openMilestones" label="Open milestones" :sort-state="sortState" align="center" cell-class="px-4 py-3" @sort="handleSort" />
            <GridSortHeader column="isActive" label="Active" :sort-state="sortState" cell-class="px-4 py-3" @sort="handleSort" />
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-8 text-center text-stone-500">Loading RFPs…</td>
          </tr>
          <tr v-else-if="visibleHits.length === 0">
            <td colspan="6" class="px-4 py-8 text-center text-stone-500">{{ emptyMessage }}</td>
          </tr>
          <tr
            v-for="rfp in visibleHits"
            :key="rfp.objectID"
            class="border-t border-stone-100 transition odd:bg-white even:bg-stone-50 hover:bg-epms-50/40"
          >
            <td class="min-w-[12rem] px-4 py-3 font-medium text-epms-900">
              <RouterLink
                :to="withReturn({
                  name: 'rfp-details',
                  params: { id: rfpRecordId(rfp) },
                  query: detailsQuery,
                })"
                class="hover:underline"
              >
                <SearchHighlight :html="titleHighlight(rfp)" />
              </RouterLink>
            </td>
            <td v-if="opportunityId" class="min-w-[10rem] px-4 py-3 font-medium text-epms-900">
              <RouterLink
                v-if="companyDetailsRoute(rfp)"
                :to="companyDetailsRoute(rfp)!"
                class="hover:underline"
              >
                <SearchHighlight :html="textHighlight(rfp.company?.objectLabel ?? companyLabel)" />
              </RouterLink>
              <SearchHighlight v-else :html="textHighlight(rfp.company?.objectLabel ?? companyLabel)" />
            </td>
            <td v-else class="min-w-[10rem] px-4 py-3 font-medium text-epms-900">
              <RouterLink
                v-if="opportunityDetailsRoute(rfp)"
                :to="opportunityDetailsRoute(rfp)!"
                class="hover:underline"
              >
                <SearchHighlight :html="textHighlight(rfp.opportunity?.objectLabel)" />
              </RouterLink>
              <SearchHighlight v-else :html="textHighlight(rfp.opportunity?.objectLabel)" />
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-stone-700">
              {{ formatRfpDate(rfp.dueDt) }}
            </td>
            <td class="min-w-[10rem] whitespace-nowrap px-4 py-3 text-stone-700">
              <SearchHighlight :html="textHighlight(rfp.status?.label)" />
            </td>
            <td class="px-4 py-3 text-center text-stone-700">
              {{ formatInteger(rfp.numOfUncompletedMilestones ?? 0) }}
            </td>
            <td class="px-4 py-3">
              <span class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="activeBadgeClass(rfp.isActive)">
                {{ rfp.isActive === false ? 'No' : 'Yes' }}
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
</template>
