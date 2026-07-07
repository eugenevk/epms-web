<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AlgoliaFacetFilter from '@/components/AlgoliaFacetFilter.vue'
import GridPagination from '@/components/GridPagination.vue'
import GridSearchStats from '@/components/GridSearchStats.vue'
import GridSortHeader from '@/components/GridSortHeader.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import GridEditDeleteActions from '@/components/GridEditDeleteActions.vue'
import NoteCreateDialog from '@/components/NoteCreateDialog.vue'
import SearchHighlight from '@/components/SearchHighlight.vue'
import { useGridReturnLink } from '@/composables/useGridReturnLink'
import { useListGridRouteQuery } from '@/composables/useListGridRouteQuery'
import { useGridSearchFocus } from '@/composables/useGridSearchFocus'
import { useGridSort } from '@/composables/useGridSort'
import { useToast } from '@/composables/useToast'
import { highlightQueryInText } from '@/lib/algoliaHighlight'
import { isAlgoliaConfigured } from '@/lib/algoliaClient'
import { paginateItems } from '@/lib/gridPagination'
import { deleteNote } from '@/lib/noteRecords'
import { noteLinkedObjectRoute } from '@/lib/noteNavigation'
import { NOTE_GRID_DEFAULT_SORT, noteSnippetText } from '@/lib/notes'
import {
  NOTE_FACET_KEYS,
  searchNotes,
  type NoteDateFilter,
  type NoteFacetFilters,
  type NoteFacetKey,
  type NoteHit,
} from '@/lib/notesAlgolia'

const { withReturn } = useGridReturnLink()
const toast = useToast()
const { searchInputRef, focusSearchInput } = useGridSearchFocus()

const query = ref('')
const debouncedQuery = ref('')
const dateFilter = ref<NoteDateFilter>({})
const facetFilters = ref<NoteFacetFilters>({})
const showFilters = ref(true)
const loading = ref(true)
const error = ref<string | null>(null)
const hits = ref<NoteHit[]>([])
const page = ref(0)
const nbHits = ref(0)
const facets = ref<Partial<Record<NoteFacetKey, Record<string, number>>>>({})
const showNoteDialog = ref(false)
const editingNoteId = ref<string | null>(null)
const showDeleteDialog = ref(false)
const deletingNoteId = ref<string | null>(null)
const deleting = ref(false)

let debounceTimer: number | undefined

useListGridRouteQuery('notes', query, debouncedQuery)

const algoliaReady = computed(() => isAlgoliaConfigured())

const { sortState, sortedItems, onSort } = useGridSort(
  hits,
  {
    noteDt: (note) => note.noteDt ?? '',
    note: (note) => noteSnippetText(note),
    linkedTo: (note) => note.linkedObject?.objectLabel ?? '',
    type: (note) => note.linkedObject?.type ?? '',
  },
  NOTE_GRID_DEFAULT_SORT,
  { noteDt: 'desc', note: 'asc' },
)

const pagination = computed(() => paginateItems(sortedItems.value, page.value))
const visibleHits = computed(() => pagination.value.items)

const hasActiveFilters = computed(
  () =>
    NOTE_FACET_KEYS.some((key) => (facetFilters.value[key]?.length ?? 0) > 0) ||
    Boolean(dateFilter.value.from?.trim() || dateFilter.value.to?.trim()),
)

const facetLabels: Record<NoteFacetKey, string> = {
  'linkedObject.type': 'Linked type',
  createdBy: 'Created by',
}

watch(query, (value) => {
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    debouncedQuery.value = value
  }, 250)
})

watch(
  () => [debouncedQuery.value, dateFilter.value, facetFilters.value] as const,
  () => {
    page.value = 0
    void loadNotes()
  },
  { deep: true },
)

onMounted(() => {
  void loadNotes()
  searchInputRef.value?.focus()
})

async function loadNotes() {
  loading.value = true
  error.value = null

  try {
    const result = await searchNotes({
      query: debouncedQuery.value,
      dateFilter: dateFilter.value,
      facetFilters: facetFilters.value,
    })
    hits.value = result.hits
    nbHits.value = result.nbHits
    facets.value = result.facets
    if (page.value >= pagination.value.nbPages) {
      page.value = Math.max(0, pagination.value.nbPages - 1)
    }
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Could not load notes.'
    hits.value = []
    page.value = 0
    nbHits.value = 0
    facets.value = {}
  } finally {
    loading.value = false
  }
}

function toggleFacet(attribute: NoteFacetKey, value: string) {
  const current = facetFilters.value[attribute] ?? []
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value]

  facetFilters.value = {
    ...facetFilters.value,
    [attribute]: next,
  }
}

function clearFilters() {
  facetFilters.value = {}
  dateFilter.value = {}
}

function selectedFacetValues(attribute: NoteFacetKey): string[] {
  return facetFilters.value[attribute] ?? []
}

function textHighlight(value: string | null | undefined): string {
  return highlightQueryInText(value?.trim() || '—', debouncedQuery.value)
}

function noteHighlight(note: NoteHit): string {
  return highlightQueryInText(noteSnippetText(note), debouncedQuery.value)
}

function handleSort(column: string, options = {}) {
  onSort(column, options)
  page.value = 0
}

function linkedObjectRoute(note: NoteHit) {
  if (!note.linkedObject?.id) return withReturn({ name: 'notes' as const })
  return withReturn(noteLinkedObjectRoute(note.linkedObject))
}

function startCreateNote() {
  editingNoteId.value = null
  showNoteDialog.value = true
}

function startEditNote(note: NoteHit) {
  editingNoteId.value = note.objectID
  showNoteDialog.value = true
}

function onNoteSaved() {
  const shouldFocusSearch = editingNoteId.value === null
  void loadNotes()
  if (shouldFocusSearch) {
    void focusSearchInput()
  }
}

function deleteDialogMessage(noteId: string | null): string {
  const note = hits.value.find((item) => item.objectID === noteId)
  const dateLabel = note?.noteDt?.trim() || 'this note'
  return `Delete the note from ${dateLabel}? This cannot be undone.`
}

function startDeleteNote(note: NoteHit) {
  deletingNoteId.value = note.objectID
  showDeleteDialog.value = true
}

function cancelDeleteNote() {
  showDeleteDialog.value = false
  deletingNoteId.value = null
}

async function confirmDeleteNote() {
  if (!deletingNoteId.value) return

  deleting.value = true
  try {
    await deleteNote(deletingNoteId.value)
    toast.showSuccess('Note deleted.')
    showDeleteDialog.value = false
    deletingNoteId.value = null
    await loadNotes()
  } catch (deleteError) {
    toast.showError(deleteError instanceof Error ? deleteError.message : 'Could not delete note.')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <section class="w-full">
    <div class="grid items-end gap-4 lg:grid-cols-[1fr_minmax(20rem,40rem)_1fr]">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold text-epms-900">Notes</h1>
        <p class="mt-1 text-sm text-stone-600">
          Browse and search notes across companies, opportunities, and RFPs.
        </p>
      </div>

      <div class="flex w-full min-w-0 items-end gap-3 lg:justify-self-center">
        <label class="min-w-0 flex-1">
          <span class="sr-only">Search notes</span>
          <input
            ref="searchInputRef"
            v-model="query"
            type="search"
            placeholder="Search note text, date, linked record…"
            class="w-full rounded-xl px-3 py-2.5 text-sm font-normal text-stone-900 field-focus"
          />
        </label>

        <GridSearchStats :loading="loading" :nb-hits="nbHits" singular="note" plural="notes" />
      </div>

      <div class="flex justify-end">
        <button
          type="button"
          class="inline-flex shrink-0 items-center rounded-lg bg-epms-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-epms-800"
          @click="startCreateNote"
        >
          New note
        </button>
      </div>
    </div>

    <div
      v-if="!algoliaReady"
      class="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      Algolia is not configured. Firestore fallback is used for the notes list.
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
          @click="clearFilters"
        >
          Clear filters
        </button>
      </div>

      <div class="mt-4 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside v-if="showFilters" class="space-y-6 rounded-xl border border-stone-200 bg-stone-100 p-4">
          <div>
            <p class="text-sm font-semibold text-stone-800">Note date</p>
            <div class="mt-2 space-y-3">
              <label class="block text-sm text-stone-700">
                From
                <input
                  v-model="dateFilter.from"
                  type="date"
                  class="mt-1 w-full rounded-lg border-[0.5px] border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-epms-600 focus:ring-2 focus:ring-epms-600/30"
                />
              </label>
              <label class="block text-sm text-stone-700">
                To
                <input
                  v-model="dateFilter.to"
                  type="date"
                  class="mt-1 w-full rounded-lg border-[0.5px] border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-epms-600 focus:ring-2 focus:ring-epms-600/30"
                />
              </label>
            </div>
          </div>

          <AlgoliaFacetFilter
            v-for="attribute in NOTE_FACET_KEYS"
            :key="attribute"
            :label="facetLabels[attribute]"
            :facets="facets[attribute]"
            :selected="selectedFacetValues(attribute)"
            @toggle="toggleFacet(attribute, $event)"
          />
        </aside>

        <div class="min-w-0 overflow-x-auto rounded-xl border border-stone-200">
          <table class="min-w-full text-left text-sm [&_td]:align-middle [&_th]:align-middle">
            <thead class="bg-stone-100 text-xs font-semibold uppercase tracking-wide text-stone-600">
              <tr>
                <GridSortHeader
                  column="noteDt"
                  label="Note date"
                  align="center"
                  :sort-state="sortState"
                  cell-class="w-28 whitespace-nowrap px-3 py-2.5"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="note"
                  label="Note"
                  :sort-state="sortState"
                  cell-class="min-w-[16rem] px-4 py-2.5"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="linkedTo"
                  label="Linked to"
                  :sort-state="sortState"
                  cell-class="min-w-[12rem] px-4 py-2.5"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="type"
                  label="Type"
                  :sort-state="sortState"
                  cell-class="px-4 py-2.5"
                  @sort="handleSort"
                />
                <th class="w-20 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="5" class="px-4 py-8 text-center text-stone-500">Loading notes…</td>
              </tr>
              <tr v-else-if="visibleHits.length === 0">
                <td colspan="5" class="px-4 py-8 text-center text-stone-500">No notes found.</td>
              </tr>
              <tr
                v-for="note in visibleHits"
                :key="note.objectID"
                class="border-t border-stone-100 transition odd:bg-white even:bg-stone-50 hover:bg-epms-50/40"
              >
                <td class="w-28 whitespace-nowrap px-3 py-2 text-center text-stone-700">
                  <SearchHighlight :html="textHighlight(note.noteDt)" />
                </td>
                <td class="max-w-[28rem] px-4 py-2 text-stone-700">
                  <div
                    v-if="note.note?.includes('<')"
                    class="rich-text-content prose prose-sm max-w-none truncate"
                    :title="noteSnippetText(note)"
                    v-html="note.note"
                  />
                  <span v-else class="block truncate" :title="noteSnippetText(note)">
                    <SearchHighlight :html="noteHighlight(note)" />
                  </span>
                </td>
                <td class="min-w-[12rem] max-w-[16rem] px-4 py-2">
                  <RouterLink
                    v-if="note.linkedObject?.objectLabel"
                    :to="linkedObjectRoute(note)"
                    class="block truncate font-medium text-epms-800 hover:underline"
                    :title="note.linkedObject.objectLabel"
                  >
                    <SearchHighlight :html="textHighlight(note.linkedObject.objectLabel)" />
                  </RouterLink>
                  <span v-else>—</span>
                </td>
                <td class="whitespace-nowrap px-4 py-2 text-stone-700">
                  {{ note.linkedObject?.type ?? '—' }}
                </td>
                <td class="px-4 py-2">
                  <GridEditDeleteActions
                    :disabled="deleting || showNoteDialog"
                    @edit="startEditNote(note)"
                    @delete="startDeleteNote(note)"
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
    </div>

    <NoteCreateDialog
      v-model="showNoteDialog"
      :note-id="editingNoteId"
      @saved="onNoteSaved"
    />

    <ConfirmDialog
      v-model="showDeleteDialog"
      title="Delete note"
      :message="deleteDialogMessage(deletingNoteId)"
      confirm-label="Delete note"
      destructive
      :loading="deleting"
      @confirm="confirmDeleteNote"
      @cancel="cancelDeleteNote"
    />
  </section>
</template>
