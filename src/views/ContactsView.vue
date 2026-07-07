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
  renderContactFieldHighlight,
  renderContactNameHighlight,
} from '@/lib/algoliaHighlight'
import {
  CONTACT_LIST_FACET_KEYS,
  contactDisplayName,
  contactCompanyId,
  formatContactFacetLabel,
  searchContacts,
  type ContactHit,
  type ContactListFacetFilters,
  type ContactListFacetKey,
} from '@/lib/contactsAlgolia'
import { paginateItems } from '@/lib/gridPagination'

const query = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)
const debouncedQuery = ref('')
const facetFilters = ref<ContactListFacetFilters>({})
const showFilters = ref(true)
const loading = ref(true)
const error = ref<string | null>(null)
const hits = ref<ContactHit[]>([])
const page = ref(0)
const nbHits = ref(0)
const facets = ref<Partial<Record<ContactListFacetKey, Record<string, number>>>>({})
const searchSource = ref<'algolia' | 'firestore'>('algolia')

let debounceTimer: number | undefined

useListGridRouteQuery('contacts', query, debouncedQuery)

const { withReturn } = useGridReturnLink()

const algoliaReady = computed(() => isAlgoliaConfigured())

const { sortState, sortedItems, onSort } = useGridSort(
  hits,
  {
    name: (contact) => contactDisplayName(contact),
    company: (contact) => contact.company?.objectLabel ?? '',
    position: (contact) => contact.position ?? '',
    email: (contact) => contact.email ?? '',
    mobile: (contact) => contact.mobile ?? '',
    firstMet: (contact) => contact.firstMet ?? '',
    hasLeft: (contact) => (contact.hasLeft ? 1 : 0),
  },
  { column: 'name', direction: 'asc' },
)

const pagination = computed(() => paginateItems(sortedItems.value, page.value))

const visibleHits = computed(() => pagination.value.items)

const hasActiveFilters = computed(() =>
  CONTACT_LIST_FACET_KEYS.some((key) => (facetFilters.value[key]?.length ?? 0) > 0),
)

const facetLabels: Record<ContactListFacetKey, string> = {
  'company.objectLabel': 'Company',
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
  () => [debouncedQuery.value, facetFilters.value] as const,
  () => {
    page.value = 0
    void loadContacts()
  },
  { deep: true },
)

onMounted(() => {
  void loadContacts()
  searchInputRef.value?.focus()
})

async function loadContacts() {
  loading.value = true
  error.value = null

  try {
    const result = await searchContacts({
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
    error.value = loadError instanceof Error ? loadError.message : 'Could not load contacts.'
    hits.value = []
    page.value = 0
    nbHits.value = 0
    facets.value = {}
  } finally {
    loading.value = false
  }
}

function toggleFacet(attribute: ContactListFacetKey, value: string) {
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

function selectedFacetValues(attribute: ContactListFacetKey): string[] {
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
  attribute: 'company.objectLabel' | 'position' | 'email' | 'mobile',
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

function leftBadgeClass(hasLeft: boolean | undefined): string {
  return hasLeft ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
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
        <h1 class="text-2xl font-bold text-epms-900">Contacts</h1>
        <p class="mt-1 text-sm text-stone-600">
          Browse and search contacts across all companies.
        </p>
      </div>

      <div class="flex w-full min-w-0 items-end gap-3 lg:justify-self-center">
        <label class="min-w-0 flex-1">
          <span class="sr-only">Search contacts</span>
          <input
            ref="searchInputRef"
            v-model="query"
            type="search"
            placeholder="Search name, company, position, email…"
            class="w-full rounded-xl px-3 py-2.5 text-sm font-normal text-stone-900 field-focus"
          />
        </label>

        <GridSearchStats :loading="loading" :nb-hits="nbHits" singular="contact" plural="contacts" />
      </div>

      <div class="flex justify-end">
        <RouterLink
          :to="withReturn({ name: 'create-contact' })"
          class="inline-flex shrink-0 items-center rounded-lg bg-epms-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-epms-800"
        >
          New contact
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
            v-for="attribute in CONTACT_LIST_FACET_KEYS"
            :key="attribute"
            :label="facetLabels[attribute]"
            :facets="facets[attribute]"
            :selected="selectedFacetValues(attribute)"
            :format-value="(value) => formatContactFacetLabel(attribute, value)"
            @toggle="toggleFacet(attribute, $event)"
          />
        </aside>

        <div class="min-w-0 overflow-x-auto rounded-xl border border-stone-200">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-stone-100 text-xs font-semibold uppercase tracking-wide text-stone-600">
              <tr>
                <GridSortHeader
                  column="name"
                  label="Name"
                  :sort-state="sortState"
                  cell-class="min-w-[12rem] px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="company"
                  label="Company"
                  :sort-state="sortState"
                  cell-class="min-w-[12rem] px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="position"
                  label="Position"
                  :sort-state="sortState"
                  cell-class="min-w-[12rem] px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="email"
                  label="Email"
                  :sort-state="sortState"
                  cell-class="min-w-[12rem] px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="mobile"
                  label="Mobile"
                  :sort-state="sortState"
                  cell-class="whitespace-nowrap px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="firstMet"
                  label="First met"
                  :sort-state="sortState"
                  cell-class="px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="hasLeft"
                  label="Left?"
                  :sort-state="sortState"
                  cell-class="px-4 py-3"
                  @sort="handleSort"
                />
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="7" class="px-4 py-8 text-center text-stone-500">Loading contacts…</td>
              </tr>
              <tr v-else-if="visibleHits.length === 0">
                <td colspan="7" class="px-4 py-8 text-center text-stone-500">No contacts found.</td>
              </tr>
              <tr
                v-for="contact in visibleHits"
                v-else
                :key="contact.objectID"
                class="border-t border-stone-100 transition odd:bg-white even:bg-stone-50 hover:bg-epms-50/40"
              >
                <td class="min-w-[12rem] px-4 py-3 font-medium text-epms-900">
                  <RouterLink
                    :to="withReturn({ name: 'contact-details', params: { id: contact.id ?? contact.objectID } })"
                    class="hover:underline"
                  >
                    <SearchHighlight :html="nameHighlight(contact)" />
                  </RouterLink>
                </td>
                <td class="min-w-[10rem] px-4 py-3 font-medium text-epms-900">
                  <RouterLink
                    v-if="contactCompanyId(contact)"
                    :to="withReturn({ name: 'company-details', params: { id: contactCompanyId(contact) } })"
                    class="hover:underline"
                  >
                    <SearchHighlight
                      :html="fieldHighlight(contact, 'company.objectLabel', contact.company?.objectLabel)"
                    />
                  </RouterLink>
                  <SearchHighlight
                    v-else
                    :html="fieldHighlight(contact, 'company.objectLabel', contact.company?.objectLabel)"
                  />
                </td>
                <td
                  class="min-w-[12rem] truncate px-4 py-3 text-stone-700"
                  :title="contact.position || undefined"
                >
                  <SearchHighlight :html="fieldHighlight(contact, 'position', contact.position)" />
                </td>
                <td
                  class="min-w-[12rem] truncate px-4 py-3 text-stone-700"
                  :title="contact.email || undefined"
                >
                  <SearchHighlight :html="fieldHighlight(contact, 'email', contact.email)" />
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-stone-700">
                  <SearchHighlight :html="fieldHighlight(contact, 'mobile', contact.mobile)" />
                </td>
                <td class="px-4 py-3 text-stone-700">{{ contact.firstMet || '—' }}</td>
                <td class="px-4 py-3">
                  <span
                    class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    :class="leftBadgeClass(contact.hasLeft)"
                  >
                    {{ contact.hasLeft ? 'Yes' : 'No' }}
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
