<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import CompanyOfferingDialog from '@/components/CompanyOfferingDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import GridEditDeleteActions from '@/components/GridEditDeleteActions.vue'
import RichTextGridCell from '@/components/RichTextGridCell.vue'
import GridPagination from '@/components/GridPagination.vue'
import GridSearchStats from '@/components/GridSearchStats.vue'
import GridSortHeader from '@/components/GridSortHeader.vue'
import { useGridSearchFocus } from '@/composables/useGridSearchFocus'
import { useGridSort } from '@/composables/useGridSort'
import { useToast } from '@/composables/useToast'
import {
  deleteCompanyOffering,
  loadCompanyOfferingsForCompany,
  type CompanyOffering,
} from '@/lib/companyOfferingRecords'
import { paginateItems } from '@/lib/gridPagination'
import { stripHtml } from '@/lib/plainTextSearch'
import { filterOfferings, productKindLabel } from '@/lib/products'

const props = defineProps<{
  companyId: string
  companyLabel: string
}>()

const emit = defineEmits<{
  changed: []
}>()

const toast = useToast()
const { searchInputRef, focusSearchInput } = useGridSearchFocus()

const query = ref('')
const debouncedQuery = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const offerings = ref<CompanyOffering[]>([])
const page = ref(0)
const showDialog = ref(false)
const editingId = ref<string | null>(null)
const showDeleteDialog = ref(false)
const deletingId = ref<string | null>(null)
const deleting = ref(false)

let debounceTimer: number | undefined

const fixedCompany = computed(() => ({
  id: props.companyId,
  objectLabel: props.companyLabel,
}))

const filteredOfferings = computed(() => filterOfferings(offerings.value, debouncedQuery.value))
const nbHits = computed(() => filteredOfferings.value.length)

const { sortState, sortedItems, onSort } = useGridSort(
  filteredOfferings,
  {
    name: (item) => item.name,
    kind: (item) => productKindLabel(item.kind),
    description: (item) => stripHtml(item.description),
  },
  [{ column: 'name', direction: 'asc' }],
  { name: 'asc', kind: 'asc' },
)

const pagination = computed(() => paginateItems(sortedItems.value, page.value))
const visibleItems = computed(() => pagination.value.items)

watch(query, (value) => {
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    debouncedQuery.value = value
    page.value = 0
  }, 250)
})

watch(
  () => props.companyId,
  () => {
    page.value = 0
    void loadOfferings()
  },
)

onMounted(() => {
  void loadOfferings()
})

async function loadOfferings() {
  loading.value = true
  error.value = null

  try {
    offerings.value = await loadCompanyOfferingsForCompany(props.companyId)
    if (page.value >= pagination.value.nbPages) {
      page.value = Math.max(0, pagination.value.nbPages - 1)
    }
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Could not load offerings.'
    offerings.value = []
    page.value = 0
  } finally {
    loading.value = false
  }
}

function startCreate() {
  editingId.value = null
  showDialog.value = true
}

function startEdit(item: CompanyOffering) {
  editingId.value = item.id
  showDialog.value = true
}

function onSaved() {
  const shouldFocusSearch = editingId.value === null
  emit('changed')
  void loadOfferings()
  if (shouldFocusSearch) {
    void focusSearchInput()
  }
}

function startDelete(item: CompanyOffering) {
  deletingId.value = item.id
  showDeleteDialog.value = true
}

async function confirmDelete() {
  if (!deletingId.value) return

  deleting.value = true
  try {
    await deleteCompanyOffering(deletingId.value)
    toast.showSuccess('Product or service deleted.')
    showDeleteDialog.value = false
    deletingId.value = null
    emit('changed')
    await loadOfferings()
  } catch (deleteError) {
    toast.showError(deleteError instanceof Error ? deleteError.message : 'Delete failed.')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold uppercase tracking-wide text-epms-700">Offered products & services</h3>
        <p class="mt-1 text-sm text-stone-600">Products and services this company delivers.</p>
      </div>
      <button
        type="button"
        class="inline-flex items-center rounded-lg bg-epms-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-epms-800"
        @click="startCreate"
      >
        Add offering
      </button>
    </div>

    <div class="mb-4 flex w-full min-w-0 items-end gap-3">
      <label class="min-w-0 flex-1">
        <span class="sr-only">Search offerings</span>
        <input
          ref="searchInputRef"
          v-model="query"
          type="search"
          placeholder="Search name or description…"
          class="w-full rounded-xl px-3 py-2.5 text-sm font-normal text-stone-900 field-focus"
        />
      </label>
      <GridSearchStats :loading="loading" :nb-hits="nbHits" singular="offering" plural="offerings" />
    </div>

    <p v-if="error" class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {{ error }}
    </p>

    <div class="overflow-x-auto rounded-xl border border-stone-200">
      <table class="min-w-full text-left text-sm">
        <thead class="bg-stone-100 text-xs font-semibold uppercase tracking-wide text-stone-600">
          <tr>
            <GridSortHeader column="name" label="Name" :sort-state="sortState" cell-class="px-4 py-3" @sort="onSort" />
            <GridSortHeader column="kind" label="Type" :sort-state="sortState" cell-class="px-4 py-3" @sort="onSort" />
            <GridSortHeader
              column="description"
              label="Description"
              :sort-state="sortState"
              cell-class="min-w-[16rem] px-4 py-3"
              @sort="onSort"
            />
            <th class="w-20 px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="4" class="px-4 py-8 text-center text-stone-500">Loading offerings…</td>
          </tr>
          <tr v-else-if="visibleItems.length === 0">
            <td colspan="4" class="px-4 py-8 text-center text-stone-500">No offerings found.</td>
          </tr>
          <tr
            v-for="item in visibleItems"
            v-else
            :key="item.id"
            class="border-t border-stone-100 transition odd:bg-white even:bg-stone-50 hover:bg-epms-50/40"
          >
            <td class="px-4 py-3 font-medium text-stone-800">{{ item.name }}</td>
            <td class="px-4 py-3 text-stone-700">{{ productKindLabel(item.kind) }}</td>
            <td class="max-w-md px-4 py-3 text-stone-700">
              <RichTextGridCell :html="item.description" />
            </td>
            <td class="px-4 py-3">
              <GridEditDeleteActions
                :disabled="deleting || showDialog"
                @edit="startEdit(item)"
                @delete="startDelete(item)"
              />
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

    <CompanyOfferingDialog
      v-model="showDialog"
      :offering-id="editingId"
      :fixed-company="fixedCompany"
      @saved="onSaved"
    />

    <ConfirmDialog
      v-model="showDeleteDialog"
      title="Delete offering?"
      message="This permanently deletes the product or service. This cannot be undone."
      confirm-label="Delete"
      destructive
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false"
    />
  </div>
</template>
