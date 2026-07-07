<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AlgoliaFacetFilter from '@/components/AlgoliaFacetFilter.vue'
import GridPagination from '@/components/GridPagination.vue'
import GridSearchStats from '@/components/GridSearchStats.vue'
import GridSortHeader from '@/components/GridSortHeader.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import GridEditDeleteActions from '@/components/GridEditDeleteActions.vue'
import SearchHighlight from '@/components/SearchHighlight.vue'
import TaskCreateDialog from '@/components/TaskCreateDialog.vue'
import TaskDueInBadge from '@/components/TaskDueInBadge.vue'
import { useGridReturnLink } from '@/composables/useGridReturnLink'
import { useListGridRouteQuery } from '@/composables/useListGridRouteQuery'
import { useGridSearchFocus } from '@/composables/useGridSearchFocus'
import { useGridSort } from '@/composables/useGridSort'
import { useToast } from '@/composables/useToast'
import { highlightQueryInText } from '@/lib/algoliaHighlight'
import { isAlgoliaConfigured } from '@/lib/algoliaClient'
import { paginateItems } from '@/lib/gridPagination'
import { completeTask, deleteTask, loadTask, migrateCompletedTaskPriorities } from '@/lib/taskRecords'
import {
  formatTaskDate,
  priorityBadgeClass,
  TASK_GRID_DEFAULT_SORT,
  taskLinkedObjectRoute,
  taskPrioritySortValue,
  taskStatusBadgeClass,
  taskStatusLabel,
} from '@/lib/tasks'
import {
  formatTaskFacetLabel,
  searchTasks,
  TASK_FACET_KEYS,
  taskRecordId,
  type TaskFacetFilters,
  type TaskFacetKey,
  type TaskHit,
} from '@/lib/tasksAlgolia'

const toast = useToast()
const { withReturn } = useGridReturnLink()
const { searchInputRef, focusSearchInput } = useGridSearchFocus()

const query = ref('')
const debouncedQuery = ref('')
const facetFilters = ref<TaskFacetFilters>({})
const showFilters = ref(true)
const loading = ref(true)
const error = ref<string | null>(null)
const hits = ref<TaskHit[]>([])
const page = ref(0)
const nbHits = ref(0)
const facets = ref<Partial<Record<TaskFacetKey, Record<string, number>>>>({})
const showTaskDialog = ref(false)
const editingTaskId = ref<string | null>(null)
const showDeleteDialog = ref(false)
const deletingTaskId = ref<string | null>(null)
const deleting = ref(false)
const completingId = ref<string | null>(null)

const TASK_PRIORITY_CLEANUP_KEY = 'epms-task-priority-cleanup-v1'

let debounceTimer: number | undefined

useListGridRouteQuery('tasks', query, debouncedQuery)

const algoliaReady = computed(() => isAlgoliaConfigured())

const { sortState, sortedItems, onSort } = useGridSort(
  hits,
  {
    summary: (task) => task.summary ?? '',
    linkedTo: (task) => task.linkedObject?.objectLabel ?? '',
    type: (task) => task.linkedObject?.type ?? '',
    dueDt: (task) => task.dueDt ?? '',
    priority: (task) => taskPrioritySortValue(task.priority?.value),
    isCompleted: (task) => (task.isCompleted === true ? 1 : 0),
  },
  TASK_GRID_DEFAULT_SORT,
  { isCompleted: 'asc', dueDt: 'asc', priority: 'desc', summary: 'asc' },
)

const pagination = computed(() => paginateItems(sortedItems.value, page.value))
const visibleHits = computed(() => pagination.value.items)

const hasActiveFilters = computed(() =>
  TASK_FACET_KEYS.some((key) => (facetFilters.value[key]?.length ?? 0) > 0),
)

const facetLabels: Record<TaskFacetKey, string> = {
  'priority.label': 'Priority',
  'status.label': 'Status',
  'linkedObject.type': 'Linked type',
  isCompleted: 'Completion',
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
    void loadTasks()
  },
  { deep: true },
)

onMounted(() => {
  void loadTasks()
  void cleanupCompletedTaskPriorities()
  searchInputRef.value?.focus()
})

async function cleanupCompletedTaskPriorities() {
  if (sessionStorage.getItem(TASK_PRIORITY_CLEANUP_KEY)) return

  try {
    const result = await migrateCompletedTaskPriorities()
    sessionStorage.setItem(TASK_PRIORITY_CLEANUP_KEY, '1')
    if (result.updated > 0) {
      await loadTasks()
    }
  } catch {
    // Ignore cleanup errors; task saves still enforce the rule.
  }
}

async function loadTasks() {
  loading.value = true
  error.value = null

  try {
    const result = await searchTasks({
      query: debouncedQuery.value,
      facetFilters: facetFilters.value,
    })
    hits.value = result.hits
    nbHits.value = result.nbHits
    facets.value = result.facets
    if (page.value >= pagination.value.nbPages) {
      page.value = Math.max(0, pagination.value.nbPages - 1)
    }
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Could not load tasks.'
    hits.value = []
    page.value = 0
    nbHits.value = 0
    facets.value = {}
  } finally {
    loading.value = false
  }
}

function toggleFacet(attribute: TaskFacetKey, value: string) {
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

function selectedFacetValues(attribute: TaskFacetKey): string[] {
  return facetFilters.value[attribute] ?? []
}

function textHighlight(value: string | null | undefined): string {
  return highlightQueryInText(value?.trim() || '—', debouncedQuery.value)
}

function summaryHighlight(task: TaskHit): string {
  return highlightQueryInText(task.summary?.trim() || '—', debouncedQuery.value)
}

function handleSort(column: string, options = {}) {
  onSort(column, options)
  page.value = 0
}

function linkedObjectRoute(task: TaskHit) {
  if (!task.linkedObject) return withReturn({ name: 'tasks' as const })
  return withReturn(taskLinkedObjectRoute(task.linkedObject))
}

function startCreateTask() {
  editingTaskId.value = null
  showTaskDialog.value = true
}

function startEditTask(task: TaskHit) {
  editingTaskId.value = taskRecordId(task)
  showTaskDialog.value = true
}

function onTaskSaved() {
  const shouldFocusSearch = editingTaskId.value === null
  void loadTasks()
  if (shouldFocusSearch) {
    void focusSearchInput()
  }
}

function deleteDialogMessage(taskId: string | null): string {
  const task = hits.value.find((item) => taskRecordId(item) === taskId)
  const label = task?.summary?.trim() || 'this task'
  return `Delete "${label}"? This cannot be undone.`
}

function startDeleteTask(task: TaskHit) {
  deletingTaskId.value = taskRecordId(task)
  showDeleteDialog.value = true
}

function cancelDeleteTask() {
  showDeleteDialog.value = false
  deletingTaskId.value = null
}

async function confirmDeleteTask() {
  if (!deletingTaskId.value) return

  deleting.value = true
  try {
    await deleteTask(deletingTaskId.value)
    toast.showSuccess('Task deleted.')
    showDeleteDialog.value = false
    deletingTaskId.value = null
    await loadTasks()
  } catch (deleteError) {
    toast.showError(deleteError instanceof Error ? deleteError.message : 'Could not delete task.')
  } finally {
    deleting.value = false
  }
}

async function markCompleted(task: TaskHit) {
  if (completingId.value || task.isCompleted) return

  completingId.value = taskRecordId(task)
  try {
    const fullTask = await loadTask(taskRecordId(task))
    await completeTask(fullTask)
    toast.showSuccess('Task completed.')
    await loadTasks()
  } catch (completeError) {
    toast.showError(completeError instanceof Error ? completeError.message : 'Could not complete task.')
  } finally {
    completingId.value = null
  }
}
</script>

<template>
  <section class="w-full">
    <div class="grid items-end gap-4 lg:grid-cols-[1fr_minmax(20rem,40rem)_1fr]">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold text-epms-900">Tasks</h1>
        <p class="mt-1 text-sm text-stone-600">
          Browse and search action items across companies, opportunities, and RFPs.
        </p>
      </div>

      <div class="flex w-full min-w-0 items-end gap-3 lg:justify-self-center">
        <label class="min-w-0 flex-1">
          <span class="sr-only">Search tasks</span>
          <input
            ref="searchInputRef"
            v-model="query"
            type="search"
            placeholder="Search summary, linked record…"
            class="w-full rounded-xl px-3 py-2.5 text-sm font-normal text-stone-900 field-focus"
          />
        </label>

        <GridSearchStats :loading="loading" :nb-hits="nbHits" singular="task" plural="tasks" />
      </div>

      <div class="flex justify-end">
        <button
          type="button"
          class="inline-flex shrink-0 items-center rounded-lg bg-epms-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-epms-800"
          @click="startCreateTask"
        >
          New task
        </button>
      </div>
    </div>

    <div
      v-if="!algoliaReady"
      class="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      Algolia is not configured. Firestore fallback is used for the task list.
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
            v-for="attribute in TASK_FACET_KEYS"
            :key="attribute"
            :label="facetLabels[attribute]"
            :facets="facets[attribute]"
            :selected="selectedFacetValues(attribute)"
            :format-value="(value) => formatTaskFacetLabel(attribute, value)"
            @toggle="toggleFacet(attribute, $event)"
          />
        </aside>

        <div class="min-w-0 overflow-x-auto rounded-xl border border-stone-200">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-stone-100 text-xs font-semibold uppercase tracking-wide text-stone-600">
              <tr>
                <GridSortHeader
                  column="summary"
                  label="Summary"
                  :sort-state="sortState"
                  cell-class="min-w-[12rem] px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="linkedTo"
                  label="Linked to"
                  :sort-state="sortState"
                  cell-class="min-w-[12rem] px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="type"
                  label="Type"
                  :sort-state="sortState"
                  cell-class="px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="dueDt"
                  label="Due date"
                  :sort-state="sortState"
                  cell-class="px-4 py-3"
                  @sort="handleSort"
                />
                <th class="whitespace-nowrap px-4 py-3 text-center">Due in</th>
                <GridSortHeader
                  column="priority"
                  label="Priority"
                  :sort-state="sortState"
                  align="center"
                  cell-class="px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="isCompleted"
                  label="Status"
                  :sort-state="sortState"
                  align="center"
                  cell-class="px-4 py-3"
                  @sort="handleSort"
                />
                <th class="w-28 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="8" class="px-4 py-8 text-center text-stone-500">Loading tasks…</td>
              </tr>
              <tr v-else-if="visibleHits.length === 0">
                <td colspan="8" class="px-4 py-8 text-center text-stone-500">No tasks found.</td>
              </tr>
              <tr
                v-for="task in visibleHits"
                :key="task.objectID"
                class="border-t border-stone-100 transition odd:bg-white even:bg-stone-50 hover:bg-epms-50/40"
                :class="task.isCompleted ? 'opacity-70' : ''"
              >
                <td class="min-w-[12rem] px-4 py-3 text-stone-700">
                  <SearchHighlight :html="summaryHighlight(task)" />
                </td>
                <td class="min-w-[12rem] px-4 py-3">
                  <RouterLink
                    v-if="task.linkedObject"
                    :to="linkedObjectRoute(task)"
                    class="font-medium text-epms-800 hover:underline"
                  >
                    <SearchHighlight :html="textHighlight(task.linkedObject.objectLabel)" />
                  </RouterLink>
                  <span v-else>—</span>
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-stone-700">
                  {{ task.linkedObject?.type ?? '—' }}
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-stone-700">
                  {{ formatTaskDate(task.dueDt) }}
                </td>
                <td class="px-4 py-3 text-center">
                  <TaskDueInBadge
                    :due-dt="task.dueDt"
                    :is-completed="task.isCompleted === true"
                  />
                </td>
                <td class="px-4 py-3 text-center">
                  <span
                    v-if="task.priority"
                    class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    :class="priorityBadgeClass(task.priority.value)"
                  >
                    {{ task.priority.label }}
                  </span>
                  <span v-else class="text-stone-500">—</span>
                </td>
                <td class="px-4 py-3 text-center">
                  <span
                    class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    :class="taskStatusBadgeClass(task.isCompleted === true)"
                  >
                    {{ taskStatusLabel(task.isCompleted === true, task.status?.label) }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <GridEditDeleteActions
                    :show-complete="!task.isCompleted"
                    complete-label="Mark task completed"
                    :disabled="completingId !== null || deleting || showTaskDialog"
                    @complete="markCompleted(task)"
                    @edit="startEditTask(task)"
                    @delete="startDeleteTask(task)"
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

    <TaskCreateDialog
      v-model="showTaskDialog"
      :task-id="editingTaskId"
      @saved="onTaskSaved"
    />

    <ConfirmDialog
      v-model="showDeleteDialog"
      title="Delete task"
      :message="deleteDialogMessage(deletingTaskId)"
      confirm-label="Delete task"
      destructive
      :loading="deleting"
      @confirm="confirmDeleteTask"
      @cancel="cancelDeleteTask"
    />
  </section>
</template>
