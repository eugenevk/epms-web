<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import GridEditDeleteActions from '@/components/GridEditDeleteActions.vue'
import GridPagination from '@/components/GridPagination.vue'
import GridSearchStats from '@/components/GridSearchStats.vue'
import GridSortHeader from '@/components/GridSortHeader.vue'
import NoteCreateDialog from '@/components/NoteCreateDialog.vue'
import SearchHighlight from '@/components/SearchHighlight.vue'
import { useGridSort } from '@/composables/useGridSort'
import { useGridSearchFocus } from '@/composables/useGridSearchFocus'
import { useToast } from '@/composables/useToast'
import { highlightQueryInText } from '@/lib/algoliaHighlight'
import { deleteNote, type NoteLinkedObject } from '@/lib/noteRecords'
import { notePreviewText } from '@/lib/notes'
import {
  searchLinkedObjectNotes,
  type NoteDateFilter,
  type NoteHit,
  type NotesGridLinkedObject,
} from '@/lib/notesAlgolia'
import { paginateItems } from '@/lib/gridPagination'

const props = defineProps<{
  linkedObject: NotesGridLinkedObject
}>()

const emit = defineEmits<{
  notesChanged: []
}>()

const toast = useToast()
const { searchInputRef, focusSearchInput } = useGridSearchFocus()

const emptyStateMessage = computed(() => {
  if (props.linkedObject.type === 'Opportunity') return 'No notes found for this opportunity.'
  if (props.linkedObject.type === 'Rfp') return 'No notes found for this RFP.'
  return 'No notes found for this company.'
})

const fixedLinkedObject = computed<NoteLinkedObject>(() => ({
  collection: props.linkedObject.collection,
  id: props.linkedObject.id,
  type: props.linkedObject.type,
  objectLabel: props.linkedObject.label,
}))

const query = ref('')
const debouncedQuery = ref('')
const dateFilter = ref<NoteDateFilter>({})
const showFilters = ref(true)
const loading = ref(false)
const error = ref<string | null>(null)
const hits = ref<NoteHit[]>([])
const page = ref(0)
const nbHits = ref(0)

const showNoteDialog = ref(false)
const editingNoteId = ref<string | null>(null)
const showDeleteDialog = ref(false)
const deletingNoteId = ref<string | null>(null)
const deleting = ref(false)

let debounceTimer: number | undefined

const { sortState, sortedItems, onSort } = useGridSort(
  hits,
  {
    noteDt: (note) => note.noteDt ?? '',
    note: (note) => notePreviewText(note),
  },
  { column: 'noteDt', direction: 'desc' },
  {
    noteDt: 'desc',
  },
)

const pagination = computed(() => paginateItems(sortedItems.value, page.value))
const visibleHits = computed(() => pagination.value.items)

const hasActiveFilters = computed(
  () => Boolean(dateFilter.value.from?.trim() || dateFilter.value.to?.trim()),
)

watch(query, (value) => {
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    debouncedQuery.value = value
  }, 250)
})

watch(
  () => [props.linkedObject.id, props.linkedObject.collection, debouncedQuery.value, dateFilter.value] as const,
  () => {
    page.value = 0
    void loadNotes()
  },
  { deep: true },
)

onMounted(() => {
  void loadNotes()
})

async function loadNotes() {
  loading.value = true
  error.value = null

  try {
    const result = await searchLinkedObjectNotes({
      linkedObjectId: props.linkedObject.id,
      linkedObjectCollection: props.linkedObject.collection,
      query: debouncedQuery.value,
      dateFilter: dateFilter.value,
    })
    hits.value = result.hits
    nbHits.value = result.nbHits
    if (page.value >= pagination.value.nbPages) {
      page.value = Math.max(0, pagination.value.nbPages - 1)
    }
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Could not load notes.'
    hits.value = []
    page.value = 0
    nbHits.value = 0
  } finally {
    loading.value = false
  }
}

function clearFilters() {
  dateFilter.value = {}
}

function noteHighlight(note: NoteHit): string {
  return highlightQueryInText(notePreviewText(note), debouncedQuery.value)
}

function textHighlight(value: string | null | undefined): string {
  return highlightQueryInText(value?.trim() || '—', debouncedQuery.value)
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
  emit('notesChanged')
  void loadNotes()
  if (shouldFocusSearch) {
    void focusSearchInput()
  }
}

function handleSort(column: string, options = {}) {
  onSort(column, options)
  page.value = 0
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
    emit('notesChanged')
    await loadNotes()
  } catch (deleteError) {
    toast.showError(deleteError instanceof Error ? deleteError.message : 'Could not delete note.')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-end gap-4">
      <label class="w-96 shrink-0">
        <span class="sr-only">Search notes</span>
          <input
            ref="searchInputRef"
            v-model="query"
          type="search"
          placeholder="Search note text, date…"
          class="w-full rounded-xl px-3 py-2.5 text-sm font-normal text-stone-900 field-focus"
        />
      </label>

      <GridSearchStats :loading="loading" :nb-hits="nbHits" singular="note" plural="notes" />

      <button
        type="button"
        class="ml-auto inline-flex items-center rounded-lg bg-epms-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-epms-800 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="showNoteDialog"
        @click="startCreateNote"
      >
        New note
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
        @click="clearFilters"
      >
        Clear filters
      </button>
    </div>

    <p v-if="error" class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {{ error }}
    </p>

    <div class="mt-4 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside v-if="showFilters" class="space-y-4 rounded-xl border border-stone-200 bg-stone-100 p-4">
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
      </aside>

      <div class="min-w-0 overflow-x-auto rounded-xl border border-stone-200">
        <table class="min-w-full text-left text-sm [&_td]:align-top [&_th]:align-top">
          <thead class="bg-stone-100 text-xs font-semibold uppercase tracking-wide text-stone-600">
            <tr>
              <GridSortHeader
                column="noteDt"
                label="Note date"
                align="center"
                :sort-state="sortState"
                cell-class="w-28 whitespace-nowrap px-3 py-3"
                @sort="handleSort"
              />
              <GridSortHeader
                column="note"
                label="Note"
                :sort-state="sortState"
                cell-class="min-w-[20rem] px-4 py-3"
                @sort="handleSort"
              />
              <th class="w-20 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="3" class="px-4 py-8 text-center text-stone-500">Loading notes…</td>
            </tr>
            <tr v-else-if="visibleHits.length === 0">
              <td colspan="3" class="px-4 py-8 text-center text-stone-500">
                {{ emptyStateMessage }}
              </td>
            </tr>
            <tr
              v-for="note in visibleHits"
              :key="note.objectID"
              class="border-t border-stone-100 transition odd:bg-white even:bg-stone-50 hover:bg-epms-50/40"
            >
              <td class="w-28 whitespace-nowrap px-3 py-3 text-center text-stone-700">
                <SearchHighlight :html="textHighlight(note.noteDt)" />
              </td>
              <td class="max-w-[32rem] px-4 py-3 text-stone-700">
                <div
                  v-if="note.note?.includes('<')"
                  class="rich-text-content prose prose-sm max-w-none text-stone-700"
                  v-html="note.note"
                />
                <SearchHighlight v-else :html="noteHighlight(note)" />
              </td>
              <td class="px-4 py-3">
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

    <NoteCreateDialog
      v-model="showNoteDialog"
      :note-id="editingNoteId"
      :fixed-linked-object="editingNoteId ? undefined : fixedLinkedObject"
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
  </div>
</template>
