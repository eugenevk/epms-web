<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AlgoliaFacetFilter from '@/components/AlgoliaFacetFilter.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ContactCreateDialog from '@/components/ContactCreateDialog.vue'
import GridEditDeleteActions from '@/components/GridEditDeleteActions.vue'
import GridPagination from '@/components/GridPagination.vue'
import GridSearchStats from '@/components/GridSearchStats.vue'
import GridSortHeader from '@/components/GridSortHeader.vue'
import SearchHighlight from '@/components/SearchHighlight.vue'
import { useGridSort } from '@/composables/useGridSort'
import { useGridSearchFocus } from '@/composables/useGridSearchFocus'
import { useToast } from '@/composables/useToast'
import { isAlgoliaConfigured } from '@/lib/algoliaClient'
import {
  renderContactFieldHighlight,
  renderContactNameHighlight,
} from '@/lib/algoliaHighlight'
import {
  CONTACT_FACET_KEYS,
  contactDisplayName,
  formatContactFacetLabel,
  searchCompanyContacts,
  type ContactFacetFilters,
  type ContactFacetKey,
  type ContactHit,
} from '@/lib/contactsAlgolia'
import { deleteContact } from '@/lib/contactRecords'
import { paginateItems } from '@/lib/gridPagination'

const props = defineProps<{
  companyId: string
  companyLabel: string
}>()

const emit = defineEmits<{
  contactsChanged: []
}>()

const toast = useToast()
const { searchInputRef, focusSearchInput } = useGridSearchFocus()

const showContactDialog = ref(false)
const editingContactId = ref<string | null>(null)
const showDeleteDialog = ref(false)
const deletingContactId = ref<string | null>(null)
const deleting = ref(false)

const query = ref('')
const debouncedQuery = ref('')
const facetFilters = ref<ContactFacetFilters>({})
const showFilters = ref(true)
const loading = ref(false)
const error = ref<string | null>(null)
const hits = ref<ContactHit[]>([])
const page = ref(0)
const nbHits = ref(0)
const facets = ref<Partial<Record<ContactFacetKey, Record<string, number>>>>({})
const searchSource = ref<'algolia' | 'firestore'>('algolia')

let debounceTimer: number | undefined

const algoliaReady = computed(() => isAlgoliaConfigured())

const { sortState, sortedItems, onSort } = useGridSort(
  hits,
  {
    name: (contact) => contactDisplayName(contact),
    position: (contact) => contact.position ?? '',
    email: (contact) => contact.email ?? '',
    mobile: (contact) => contact.mobile ?? '',
    atCompanySince: (contact) => contact.atCompanySince ?? '',
    firstMet: (contact) => contact.firstMet ?? '',
    hasLeft: (contact) => (contact.hasLeft ? 1 : 0),
  },
  { column: 'name', direction: 'asc' },
)

const pagination = computed(() => paginateItems(sortedItems.value, page.value))

const visibleHits = computed(() => pagination.value.items)

const hasActiveFilters = computed(() =>
  CONTACT_FACET_KEYS.some((key) => (facetFilters.value[key]?.length ?? 0) > 0),
)

const facetLabels: Record<ContactFacetKey, string> = {
  department: 'Department',
  position: 'Position',
  'gender.label': 'Gender',
  hasLeft: 'Left company',
}

watch(query, (value) => {
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    debouncedQuery.value = value
  }, 250)
})

watch(
  () => [props.companyId, props.companyLabel, debouncedQuery.value, facetFilters.value] as const,
  () => {
    page.value = 0
    void loadContacts()
  },
  { deep: true },
)

onMounted(() => {
  if (algoliaReady.value) {
    void loadContacts()
  }
})

async function loadContacts() {
  if (!algoliaReady.value || !props.companyLabel.trim()) return

  loading.value = true
  error.value = null

  try {
    const result = await searchCompanyContacts({
      companyId: props.companyId,
      companyLabel: props.companyLabel,
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
    error.value =
      loadError instanceof Error ? loadError.message : 'Could not load contacts from Algolia.'
    hits.value = []
    page.value = 0
    nbHits.value = 0
    facets.value = {}
  } finally {
    loading.value = false
  }
}

function toggleFacet(attribute: ContactFacetKey, value: string) {
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

function selectedFacetValues(attribute: ContactFacetKey): string[] {
  return facetFilters.value[attribute] ?? []
}

function nameHighlight(contact: ContactHit): string {
  return renderContactNameHighlight(
    contact,
    contactDisplayName(contact),
    debouncedQuery.value,
    searchSource.value,
  )
}

function fieldHighlight(
  contact: ContactHit,
  attribute: 'position' | 'email' | 'mobile',
  value: string | null | undefined,
): string {
  const fallback = value?.trim() || '—'
  return renderContactFieldHighlight(
    contact,
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

function startCreateContact() {
  editingContactId.value = null
  showContactDialog.value = true
}

function startEditContact(contact: ContactHit) {
  editingContactId.value = contact.id ?? contact.objectID
  showContactDialog.value = true
}

function onContactSaved() {
  const shouldFocusSearch = editingContactId.value === null
  void loadContacts()
  emit('contactsChanged')
  if (shouldFocusSearch) {
    void focusSearchInput()
  }
}

function deleteDialogMessage(contactId: string | null): string {
  const contact = hits.value.find((item) => (item.id ?? item.objectID) === contactId)
  const name = contact ? contactDisplayName(contact) : 'this contact'
  return `Delete ${name}? This cannot be undone.`
}

function startDeleteContact(contact: ContactHit) {
  deletingContactId.value = contact.id ?? contact.objectID
  showDeleteDialog.value = true
}

function cancelDeleteContact() {
  showDeleteDialog.value = false
  deletingContactId.value = null
}

async function confirmDeleteContact() {
  if (!deletingContactId.value) return

  deleting.value = true
  try {
    await deleteContact(deletingContactId.value)
    toast.showSuccess('Contact deleted.')
    showDeleteDialog.value = false
    deletingContactId.value = null
    emit('contactsChanged')
    await loadContacts()
  } catch (deleteError) {
    toast.showError(deleteError instanceof Error ? deleteError.message : 'Could not delete contact.')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div>
    <div v-if="!algoliaReady" class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      Algolia is not configured. Add <code class="rounded bg-amber-100 px-1">VITE_ALGOLIA_APP_ID</code> and
      <code class="rounded bg-amber-100 px-1">VITE_ALGOLIA_SEARCH_KEY</code> to your <code class="rounded bg-amber-100 px-1">.env</code>.
    </div>

    <template v-else>
      <div class="flex flex-wrap items-end gap-4">
        <label class="w-96 shrink-0">
          <span class="sr-only">Search contacts</span>
          <input
            ref="searchInputRef"
            v-model="query"
            type="search"
            placeholder="Search name, position, email…"
            class="w-full rounded-xl px-3 py-2.5 text-sm font-normal text-stone-900 field-focus"
          />
        </label>

        <GridSearchStats :loading="loading" :nb-hits="nbHits" singular="contact" plural="contacts" />

        <button
          type="button"
          class="ml-auto inline-flex items-center rounded-lg bg-epms-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-epms-800 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="showContactDialog"
          @click="startCreateContact"
        >
          New contact
        </button>
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
          class="text-sm font-medium text-stone-600 transition hover:text-stone-900"
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
            v-for="attribute in CONTACT_FACET_KEYS"
            :key="attribute"
            :label="facetLabels[attribute]"
            :facets="facets[attribute]"
            :selected="selectedFacetValues(attribute)"
            :format-value="(value) => formatContactFacetLabel(attribute, value)"
            @toggle="toggleFacet(attribute, $event)"
          />
        </aside>

        <div class="min-w-0 rounded-xl border border-stone-200">
          <table class="w-full table-fixed text-left text-sm">
            <colgroup>
              <col style="width: 19%" />
              <col style="width: 19%" />
              <col style="width: 19%" />
              <col style="width: 8%" />
              <col style="width: 8%" />
              <col style="width: 19%" />
              <col style="width: 8%" />
            </colgroup>
            <thead class="bg-stone-100 text-xs font-semibold uppercase tracking-wide text-stone-600">
              <tr>
                <GridSortHeader
                  column="name"
                  label="Name"
                  :sort-state="sortState"
                  cell-class="px-3 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="position"
                  label="Position"
                  :sort-state="sortState"
                  cell-class="px-3 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="email"
                  label="Email"
                  :sort-state="sortState"
                  cell-class="px-3 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="mobile"
                  label="Mobile"
                  :sort-state="sortState"
                  cell-class="px-3 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="atCompanySince"
                  label="Joined"
                  :sort-state="sortState"
                  cell-class="px-3 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="firstMet"
                  label="First met"
                  :sort-state="sortState"
                  cell-class="px-3 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="hasLeft"
                  label="Left?"
                  :sort-state="sortState"
                  cell-class="px-3 py-3"
                  @sort="handleSort"
                />
                <th class="w-28 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="8" class="px-4 py-8 text-center text-stone-500">Loading contacts…</td>
              </tr>
              <tr v-else-if="visibleHits.length === 0">
                <td colspan="8" class="px-4 py-8 text-center text-stone-500">
                  No contacts found for this company.
                </td>
              </tr>
              <tr
                v-for="contact in visibleHits"
                :key="contact.objectID"
                class="border-t border-stone-100 transition odd:bg-white even:bg-stone-50 hover:bg-epms-50/40"
              >
                <td
                  class="truncate overflow-hidden px-3 py-3 text-stone-700"
                  :title="contactDisplayName(contact)"
                >
                  <SearchHighlight :html="nameHighlight(contact)" />
                </td>
                <td
                  class="truncate overflow-hidden px-3 py-3 text-stone-700"
                  :title="contact.position || undefined"
                >
                  <SearchHighlight :html="fieldHighlight(contact, 'position', contact.position)" />
                </td>
                <td
                  class="truncate overflow-hidden px-3 py-3 text-stone-700"
                  :title="contact.email || undefined"
                >
                  <SearchHighlight :html="fieldHighlight(contact, 'email', contact.email)" />
                </td>
                <td
                  class="truncate overflow-hidden whitespace-nowrap px-3 py-3 text-stone-700"
                  :title="contact.mobile || undefined"
                >
                  <SearchHighlight :html="fieldHighlight(contact, 'mobile', contact.mobile)" />
                </td>
                <td
                  class="truncate overflow-hidden whitespace-nowrap px-3 py-3 text-stone-700"
                  :title="contact.atCompanySince || undefined"
                >
                  {{ contact.atCompanySince || '—' }}
                </td>
                <td
                  class="truncate overflow-hidden whitespace-nowrap px-3 py-3 text-stone-700"
                  :title="contact.firstMet || undefined"
                >
                  {{ contact.firstMet || '—' }}
                </td>
                <td class="overflow-hidden px-3 py-3">
                  <span
                    class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    :class="
                      contact.hasLeft
                        ? 'bg-red-100 text-red-800'
                        : 'bg-emerald-100 text-emerald-800'
                    "
                  >
                    {{ contact.hasLeft ? 'Yes' : 'No' }}
                  </span>
                </td>
                <td class="px-3 py-3">
                  <GridEditDeleteActions
                    :disabled="deleting || showContactDialog"
                    @edit="startEditContact(contact)"
                    @delete="startDeleteContact(contact)"
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
      </div>
    </template>

    <ContactCreateDialog
      v-model="showContactDialog"
      :company="{ id: companyId, objectLabel: companyLabel }"
      :contact-id="editingContactId"
      @saved="onContactSaved"
    />

    <ConfirmDialog
      v-model="showDeleteDialog"
      title="Delete contact"
      :message="deleteDialogMessage(deletingContactId)"
      confirm-label="Delete contact"
      destructive
      :loading="deleting"
      @confirm="confirmDeleteContact"
      @cancel="cancelDeleteContact"
    />
  </div>
</template>
