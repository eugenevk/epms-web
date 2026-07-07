<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AlgoliaFacetFilter from '@/components/AlgoliaFacetFilter.vue'
import CompanyOfferingDialog from '@/components/CompanyOfferingDialog.vue'
import CompanyProductInUseDialog from '@/components/CompanyProductInUseDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import GridEditDeleteActions from '@/components/GridEditDeleteActions.vue'
import RichTextGridCell from '@/components/RichTextGridCell.vue'
import GridPagination from '@/components/GridPagination.vue'
import GridSearchStats from '@/components/GridSearchStats.vue'
import GridSortHeader from '@/components/GridSortHeader.vue'
import { useGridReturnLink } from '@/composables/useGridReturnLink'
import { useGridSearchFocus } from '@/composables/useGridSearchFocus'
import { useGridSort } from '@/composables/useGridSort'
import { useListGridRouteQuery } from '@/composables/useListGridRouteQuery'
import { useToast } from '@/composables/useToast'
import {
  deleteCompanyOffering,
  type CompanyOffering,
} from '@/lib/companyOfferingRecords'
import {
  offeringHitToRecord,
  offeringRecordId,
  offeringFacetsToKindCounts,
  searchCompanyOfferings,
  selectedKindLabelsToOfferingFacetFilters,
  type OfferingHit,
} from '@/lib/companyOfferingsAlgolia'
import {
  deleteCompanyProductInUse,
  type CompanyProductInUse,
} from '@/lib/companyProductInUseRecords'
import {
  productInUseFacetsToKindCounts,
  productInUseHitToRecord,
  productInUseRecordId,
  searchCompanyProductsInUse,
  selectedKindLabelsToProductInUseFacetFilters,
  type ProductInUseHit,
} from '@/lib/companyProductsInUseAlgolia'
import { paginateItems } from '@/lib/gridPagination'
import { stripHtml } from '@/lib/plainTextSearch'
import { productKindLabel } from '@/lib/products'

type ProductsTab = 'offered' | 'in-use'

const toast = useToast()
const { withReturn } = useGridReturnLink()
const { searchInputRef, focusSearchInput } = useGridSearchFocus()

const activeTab = ref<ProductsTab>('offered')
const query = ref('')
const debouncedQuery = ref('')
const selectedKinds = ref<string[]>([])
const showFilters = ref(true)
const loading = ref(true)
const error = ref<string | null>(null)
const offeringHits = ref<OfferingHit[]>([])
const inUseHits = ref<ProductInUseHit[]>([])
const offeringsTotal = ref(0)
const inUseTotal = ref(0)
const kindFacets = ref<Record<string, number>>({})
const page = ref(0)

const showOfferingDialog = ref(false)
const editingOfferingId = ref<string | null>(null)
const showInUseDialog = ref(false)
const editingInUseId = ref<string | null>(null)
const showDeleteDialog = ref(false)
const deletingOffering = ref(false)
const deletingInUse = ref(false)
const deletingOfferingId = ref<string | null>(null)
const deletingInUseId = ref<string | null>(null)

let debounceTimer: number | undefined

useListGridRouteQuery('products-services', query, debouncedQuery)

const nbHits = computed(() => (activeTab.value === 'offered' ? offeringsTotal.value : inUseTotal.value))
const hasActiveFilters = computed(() => selectedKinds.value.length > 0)

const offeringSort = useGridSort(
  offeringHits,
  {
    company: (item) => item.company?.objectLabel ?? '',
    name: (item) => item.name ?? '',
    kind: (item) => productKindLabel(item.kind),
    description: (item) => stripHtml(item.description ?? ''),
  },
  [{ column: 'company', direction: 'asc' }, { column: 'name', direction: 'asc' }],
  { company: 'asc', name: 'asc', kind: 'asc' },
)

const inUseSort = useGridSort(
  inUseHits,
  {
    company: (item) => item.company?.objectLabel ?? '',
    name: (item) => item.name ?? '',
    kind: (item) => productKindLabel(item.kind),
    supplier: (item) => item.supplierCompany?.objectLabel ?? '',
    version: (item) => item.version ?? '',
    description: (item) => stripHtml(item.description ?? ''),
  },
  [{ column: 'company', direction: 'asc' }, { column: 'name', direction: 'asc' }],
  { company: 'asc', name: 'asc', kind: 'asc', supplier: 'asc', version: 'asc' },
)

const sortState = computed(() =>
  activeTab.value === 'offered' ? offeringSort.sortState.value : inUseSort.sortState.value,
)

function handleSort(column: string) {
  if (activeTab.value === 'offered') {
    offeringSort.onSort(column)
  } else {
    inUseSort.onSort(column)
  }
}

const offeringPagination = computed(() =>
  paginateItems(offeringSort.sortedItems.value, activeTab.value === 'offered' ? page.value : 0),
)
const inUsePagination = computed(() =>
  paginateItems(inUseSort.sortedItems.value, activeTab.value === 'in-use' ? page.value : 0),
)
const pagination = computed(() =>
  activeTab.value === 'offered' ? offeringPagination.value : inUsePagination.value,
)
const visibleOfferings = computed(() => offeringPagination.value.items)
const visibleInUse = computed(() => inUsePagination.value.items)

watch(query, (value) => {
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    debouncedQuery.value = value
  }, 250)
})

watch(
  () => [debouncedQuery.value, selectedKinds.value] as const,
  () => {
    page.value = 0
    void loadAll()
  },
)

watch(activeTab, () => {
  selectedKinds.value = []
  page.value = 0
  kindFacets.value = {}
  void loadActiveTab()
})

onMounted(() => {
  void loadAll()
  searchInputRef.value?.focus()
})

async function loadAll() {
  loading.value = true
  error.value = null

  try {
    const [offeringResult, inUseResult] = await Promise.all([
      searchCompanyOfferings({
        query: debouncedQuery.value,
        facetFilters: selectedKindLabelsToOfferingFacetFilters(selectedKinds.value),
      }),
      searchCompanyProductsInUse({
        query: debouncedQuery.value,
        facetFilters: selectedKindLabelsToProductInUseFacetFilters(selectedKinds.value),
      }),
    ])

    offeringHits.value = offeringResult.hits
    offeringsTotal.value = offeringResult.nbHits
    inUseHits.value = inUseResult.hits
    inUseTotal.value = inUseResult.nbHits
    kindFacets.value =
      activeTab.value === 'offered'
        ? offeringFacetsToKindCounts(offeringResult.facets)
        : productInUseFacetsToKindCounts(inUseResult.facets)

    if (page.value >= pagination.value.nbPages) {
      page.value = Math.max(0, pagination.value.nbPages - 1)
    }
  } catch (loadError) {
    error.value =
      loadError instanceof Error ? loadError.message : 'Could not load products and services.'
    offeringHits.value = []
    inUseHits.value = []
    offeringsTotal.value = 0
    inUseTotal.value = 0
    kindFacets.value = {}
    page.value = 0
  } finally {
    loading.value = false
  }
}

async function loadActiveTab() {
  if (activeTab.value === 'offered') {
    await loadOfferingsOnly()
    return
  }
  await loadInUseOnly()
}

async function loadOfferingsOnly() {
  loading.value = true
  error.value = null

  try {
    const result = await searchCompanyOfferings({
      query: debouncedQuery.value,
      facetFilters: selectedKindLabelsToOfferingFacetFilters(selectedKinds.value),
    })
    offeringHits.value = result.hits
    offeringsTotal.value = result.nbHits
    kindFacets.value = offeringFacetsToKindCounts(result.facets)
    if (page.value >= pagination.value.nbPages) {
      page.value = Math.max(0, pagination.value.nbPages - 1)
    }
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Could not load offerings.'
    offeringHits.value = []
    offeringsTotal.value = 0
    page.value = 0
  } finally {
    loading.value = false
  }
}

async function loadInUseOnly() {
  loading.value = true
  error.value = null

  try {
    const result = await searchCompanyProductsInUse({
      query: debouncedQuery.value,
      facetFilters: selectedKindLabelsToProductInUseFacetFilters(selectedKinds.value),
    })
    inUseHits.value = result.hits
    inUseTotal.value = result.nbHits
    kindFacets.value = productInUseFacetsToKindCounts(result.facets)
    if (page.value >= pagination.value.nbPages) {
      page.value = Math.max(0, pagination.value.nbPages - 1)
    }
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Could not load records in use.'
    inUseHits.value = []
    inUseTotal.value = 0
    page.value = 0
  } finally {
    loading.value = false
  }
}

function setTab(tab: ProductsTab) {
  activeTab.value = tab
}

function toggleKind(value: string) {
  const current = selectedKinds.value
  selectedKinds.value = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value]
  page.value = 0
}

function clearFilters() {
  selectedKinds.value = []
  page.value = 0
}

function startCreate() {
  if (activeTab.value === 'offered') {
    editingOfferingId.value = null
    showOfferingDialog.value = true
    return
  }
  editingInUseId.value = null
  showInUseDialog.value = true
}

function startEditOffering(item: CompanyOffering) {
  editingOfferingId.value = item.id
  showOfferingDialog.value = true
}

function startEditOfferingHit(item: OfferingHit) {
  startEditOffering(offeringHitToRecord(item))
}

function startEditInUse(item: CompanyProductInUse) {
  editingInUseId.value = item.id
  showInUseDialog.value = true
}

function startEditInUseHit(item: ProductInUseHit) {
  startEditInUse(productInUseHitToRecord(item))
}

function onOfferingSaved() {
  const shouldFocus = editingOfferingId.value === null
  void loadAll()
  if (shouldFocus) void focusSearchInput()
}

function onInUseSaved() {
  const shouldFocus = editingInUseId.value === null
  void loadAll()
  if (shouldFocus) void focusSearchInput()
}

function startDeleteOffering(item: CompanyOffering) {
  deletingOfferingId.value = item.id
  deletingInUseId.value = null
  showDeleteDialog.value = true
}

function startDeleteOfferingHit(item: OfferingHit) {
  startDeleteOffering(offeringHitToRecord(item))
}

function startDeleteInUse(item: CompanyProductInUse) {
  deletingInUseId.value = item.id
  deletingOfferingId.value = null
  showDeleteDialog.value = true
}

function startDeleteInUseHit(item: ProductInUseHit) {
  startDeleteInUse(productInUseHitToRecord(item))
}

async function confirmDelete() {
  if (deletingOfferingId.value) {
    deletingOffering.value = true
    try {
      await deleteCompanyOffering(deletingOfferingId.value)
      toast.showSuccess('Offering deleted.')
      showDeleteDialog.value = false
      deletingOfferingId.value = null
      await loadAll()
    } catch (deleteError) {
      toast.showError(deleteError instanceof Error ? deleteError.message : 'Delete failed.')
    } finally {
      deletingOffering.value = false
    }
    return
  }

  if (!deletingInUseId.value) return

  deletingInUse.value = true
  try {
    await deleteCompanyProductInUse(deletingInUseId.value)
    toast.showSuccess('Record deleted.')
    showDeleteDialog.value = false
    deletingInUseId.value = null
    await loadAll()
  } catch (deleteError) {
    toast.showError(deleteError instanceof Error ? deleteError.message : 'Delete failed.')
  } finally {
    deletingInUse.value = false
  }
}

function companyRoute(companyId: string) {
  return withReturn({
    name: 'company-details',
    params: { id: companyId },
    query: { tab: 'products-services' },
  })
}
</script>

<template>
  <section class="w-full min-w-0">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-epms-900">Products & Services</h1>
        <p class="mt-1 text-sm text-stone-600">
          Offerings companies deliver and products or services they use from suppliers.
        </p>
      </div>
      <button
        type="button"
        class="inline-flex shrink-0 items-center rounded-lg bg-epms-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-epms-800"
        @click="startCreate"
      >
        {{ activeTab === 'offered' ? 'New offering' : 'New in use' }}
      </button>
    </div>

    <div class="mt-6 flex flex-wrap gap-2 border-b border-stone-200">
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition"
        :class="activeTab === 'offered' ? 'border-b-2 border-epms-700 text-epms-900' : 'text-stone-500 hover:text-stone-700'"
        @click="setTab('offered')"
      >
        Offered
        <span
          v-if="!loading"
          class="rounded-full bg-epms-100 px-2 py-0.5 text-xs font-semibold text-epms-800"
        >
          {{ offeringsTotal }}
        </span>
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition"
        :class="activeTab === 'in-use' ? 'border-b-2 border-epms-700 text-epms-900' : 'text-stone-500 hover:text-stone-700'"
        @click="setTab('in-use')"
      >
        In use
        <span
          v-if="!loading"
          class="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-800"
        >
          {{ inUseTotal }}
        </span>
      </button>
    </div>

    <div class="mt-6 grid items-end gap-4 lg:grid-cols-[1fr_minmax(20rem,40rem)_1fr]">
      <div class="hidden lg:block" />
      <div class="flex w-full min-w-0 items-end gap-3 lg:justify-self-center">
        <label class="min-w-0 flex-1">
          <span class="sr-only">Search products and services</span>
          <input
            ref="searchInputRef"
            v-model="query"
            type="search"
            placeholder="Search name, company, supplier…"
            class="w-full rounded-xl px-3 py-2.5 text-sm font-normal text-stone-900 field-focus"
          />
        </label>
        <GridSearchStats
          :loading="loading"
          :nb-hits="nbHits"
          :singular="activeTab === 'offered' ? 'offering' : 'record'"
          :plural="activeTab === 'offered' ? 'offerings' : 'records'"
        />
      </div>
      <div class="hidden lg:block" />
    </div>

    <div class="mt-4 flex items-center justify-between gap-3">
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
        @click="clearFilters"
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
          label="Type"
          :facets="kindFacets"
          :selected="selectedKinds"
          @toggle="toggleKind"
        />
      </aside>

      <div class="min-w-0 overflow-x-auto rounded-xl border border-stone-200">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-stone-100 text-xs font-semibold uppercase tracking-wide text-stone-600">
            <tr v-if="activeTab === 'offered'">
              <GridSortHeader column="company" label="Company" :sort-state="sortState" cell-class="px-4 py-2.5" @sort="handleSort" />
              <GridSortHeader column="name" label="Name" :sort-state="sortState" cell-class="px-4 py-2.5" @sort="handleSort" />
              <GridSortHeader column="kind" label="Type" :sort-state="sortState" cell-class="px-4 py-2.5" @sort="handleSort" />
              <GridSortHeader column="description" label="Description" :sort-state="sortState" cell-class="min-w-[16rem] px-4 py-2.5" @sort="handleSort" />
              <th class="w-20 px-4 py-2.5" />
            </tr>
            <tr v-else>
              <GridSortHeader column="company" label="Company" :sort-state="sortState" cell-class="px-4 py-2.5" @sort="handleSort" />
              <GridSortHeader column="name" label="Name" :sort-state="sortState" cell-class="px-4 py-2.5" @sort="handleSort" />
              <GridSortHeader column="kind" label="Type" :sort-state="sortState" cell-class="px-4 py-2.5" @sort="handleSort" />
              <GridSortHeader column="supplier" label="Supplier" :sort-state="sortState" cell-class="min-w-[12rem] px-4 py-2.5" @sort="handleSort" />
              <GridSortHeader column="version" label="Version" :sort-state="sortState" cell-class="px-4 py-2.5" @sort="handleSort" />
              <GridSortHeader column="description" label="Description" :sort-state="sortState" cell-class="min-w-[14rem] px-4 py-2.5" @sort="handleSort" />
              <th class="w-20 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td :colspan="activeTab === 'offered' ? 5 : 7" class="px-4 py-8 text-center text-stone-500">Loading…</td>
            </tr>
            <tr v-else-if="visibleOfferings.length === 0 && activeTab === 'offered'">
              <td colspan="5" class="px-4 py-8 text-center text-stone-500">No records found.</td>
            </tr>
            <tr v-else-if="visibleInUse.length === 0 && activeTab === 'in-use'">
              <td colspan="7" class="px-4 py-8 text-center text-stone-500">No records found.</td>
            </tr>
            <template v-else-if="activeTab === 'offered'">
              <tr
                v-for="item in visibleOfferings"
                :key="offeringRecordId(item)"
                class="border-t border-stone-100 transition odd:bg-white even:bg-stone-50 hover:bg-epms-50/40"
              >
                <td class="px-4 py-2">
                  <RouterLink
                    v-if="item.company?.id"
                    :to="companyRoute(item.company.id)"
                    class="font-medium text-epms-800 hover:underline"
                  >
                    {{ item.company.objectLabel }}
                  </RouterLink>
                  <span v-else>—</span>
                </td>
                <td class="px-4 py-2 font-medium text-stone-800">{{ item.name || '—' }}</td>
                <td class="px-4 py-2 text-stone-700">{{ productKindLabel(item.kind) }}</td>
                <td class="max-w-md px-4 py-2 text-stone-700">
                  <RichTextGridCell :html="item.description" />
                </td>
                <td class="px-4 py-2">
                  <GridEditDeleteActions
                    :disabled="deletingOffering || deletingInUse || showOfferingDialog || showInUseDialog"
                    @edit="startEditOfferingHit(item)"
                    @delete="startDeleteOfferingHit(item)"
                  />
                </td>
              </tr>
            </template>
            <template v-else>
              <tr
                v-for="item in visibleInUse"
                :key="productInUseRecordId(item)"
                class="border-t border-stone-100 transition odd:bg-white even:bg-stone-50 hover:bg-epms-50/40"
              >
                <td class="px-4 py-2">
                  <RouterLink
                    v-if="item.company?.id"
                    :to="companyRoute(item.company.id)"
                    class="font-medium text-epms-800 hover:underline"
                  >
                    {{ item.company.objectLabel }}
                  </RouterLink>
                  <span v-else>—</span>
                </td>
                <td class="px-4 py-2 font-medium text-stone-800">{{ item.name || '—' }}</td>
                <td class="px-4 py-2 text-stone-700">{{ productKindLabel(item.kind) }}</td>
                <td class="px-4 py-2">
                  <RouterLink
                    v-if="item.supplierCompany?.id"
                    :to="withReturn({ name: 'company-details', params: { id: item.supplierCompany.id } })"
                    class="font-medium text-epms-800 hover:underline"
                  >
                    {{ item.supplierCompany.objectLabel }}
                  </RouterLink>
                  <span v-else>—</span>
                </td>
                <td class="px-4 py-2 text-stone-700">{{ item.version || '—' }}</td>
                <td class="max-w-md px-4 py-2 text-stone-700">
                  <RichTextGridCell :html="item.description" />
                </td>
                <td class="px-4 py-2">
                  <GridEditDeleteActions
                    :disabled="deletingOffering || deletingInUse || showOfferingDialog || showInUseDialog"
                    @edit="startEditInUseHit(item)"
                    @delete="startDeleteInUseHit(item)"
                  />
                </td>
              </tr>
            </template>
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

    <CompanyOfferingDialog v-model="showOfferingDialog" :offering-id="editingOfferingId" @saved="onOfferingSaved" />
    <CompanyProductInUseDialog v-model="showInUseDialog" :record-id="editingInUseId" @saved="onInUseSaved" />

    <ConfirmDialog
      v-model="showDeleteDialog"
      title="Delete record?"
      message="This permanently deletes the selected record. This cannot be undone."
      confirm-label="Delete"
      destructive
      :loading="deletingOffering || deletingInUse"
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false"
    />
  </section>
</template>
