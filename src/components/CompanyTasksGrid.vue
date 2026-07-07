<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import GridEditDeleteActions from '@/components/GridEditDeleteActions.vue'
import GridPagination from '@/components/GridPagination.vue'
import GridSearchStats from '@/components/GridSearchStats.vue'
import GridSortHeader from '@/components/GridSortHeader.vue'
import SearchHighlight from '@/components/SearchHighlight.vue'
import TaskCreateDialog from '@/components/TaskCreateDialog.vue'
import TaskDueInBadge from '@/components/TaskDueInBadge.vue'
import { useGridSort } from '@/composables/useGridSort'
import { useGridSearchFocus } from '@/composables/useGridSearchFocus'
import { useToast } from '@/composables/useToast'
import { highlightQueryInText } from '@/lib/algoliaHighlight'
import { paginateItems } from '@/lib/gridPagination'
import {
  completeTask,
  deleteTask,
  loadTasksForLinkedObject,
  type Task,
  type TaskLinkedObject,
} from '@/lib/taskRecords'
import {
  filterTasks,
  formatTaskDate,
  priorityBadgeClass,
  TASK_GRID_DEFAULT_SORT,
  taskPrioritySortValue,
  taskStatusBadgeClass,
  taskStatusLabel,
  type TasksGridLinkedObject,
} from '@/lib/tasks'

const props = defineProps<{
  linkedObject: TasksGridLinkedObject
}>()

const emit = defineEmits<{
  tasksChanged: []
}>()

const toast = useToast()
const { searchInputRef, focusSearchInput } = useGridSearchFocus()

const emptyStateMessage = computed(() => {
  if (props.linkedObject.type === 'Opportunity') return 'No tasks found for this opportunity.'
  if (props.linkedObject.type === 'Rfp') return 'No tasks found for this RFP.'
  return 'No tasks found for this company.'
})

const fixedLinkedObject = computed<TaskLinkedObject>(() => ({
  collection: props.linkedObject.collection,
  id: props.linkedObject.id,
  type: props.linkedObject.type,
  objectLabel: props.linkedObject.label,
}))

const query = ref('')
const debouncedQuery = ref('')
const showCompleted = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)
const tasks = ref<Task[]>([])
const page = ref(0)

const showTaskDialog = ref(false)
const editingTaskId = ref<string | null>(null)
const showDeleteDialog = ref(false)
const deletingTaskId = ref<string | null>(null)
const deleting = ref(false)
const completingId = ref<string | null>(null)

let debounceTimer: number | undefined

const filteredTasks = computed(() => filterTasks(tasks.value, debouncedQuery.value, showCompleted.value))
const nbHits = computed(() => filteredTasks.value.length)

const { sortState, sortedItems, onSort } = useGridSort(
  filteredTasks,
  {
    summary: (task) => task.summary,
    dueDt: (task) => task.dueDt ?? '',
    priority: (task) => taskPrioritySortValue(task.priority?.value),
    isCompleted: (task) => (task.isCompleted ? 1 : 0),
  },
  TASK_GRID_DEFAULT_SORT,
  { isCompleted: 'asc', dueDt: 'asc', priority: 'desc', summary: 'asc' },
)

const pagination = computed(() => paginateItems(sortedItems.value, page.value))
const visibleTasks = computed(() => pagination.value.items)

watch(query, (value) => {
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    debouncedQuery.value = value
  }, 250)
})

watch(
  () => [props.linkedObject.id, props.linkedObject.collection, debouncedQuery.value, showCompleted.value] as const,
  () => {
    page.value = 0
    void loadTasks()
  },
)

onMounted(() => {
  void loadTasks()
})

async function loadTasks() {
  loading.value = true
  error.value = null

  try {
    tasks.value = await loadTasksForLinkedObject(
      props.linkedObject.id,
      props.linkedObject.collection,
    )
    if (page.value >= pagination.value.nbPages) {
      page.value = Math.max(0, pagination.value.nbPages - 1)
    }
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Could not load tasks.'
    tasks.value = []
    page.value = 0
  } finally {
    loading.value = false
  }
}

function textHighlight(value: string | null | undefined): string {
  return highlightQueryInText(value?.trim() || '—', debouncedQuery.value)
}

function startCreateTask() {
  editingTaskId.value = null
  showTaskDialog.value = true
}

function startEditTask(task: Task) {
  editingTaskId.value = task.id
  showTaskDialog.value = true
}

function onTaskSaved() {
  const shouldFocusSearch = editingTaskId.value === null
  emit('tasksChanged')
  void loadTasks()
  if (shouldFocusSearch) {
    void focusSearchInput()
  }
}

function handleSort(column: string, options = {}) {
  onSort(column, options)
  page.value = 0
}

function deleteDialogMessage(taskId: string | null): string {
  const task = tasks.value.find((item) => item.id === taskId)
  const label = task?.summary?.trim() || 'this task'
  return `Delete "${label}"? This cannot be undone.`
}

function startDeleteTask(task: Task) {
  deletingTaskId.value = task.id
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
    emit('tasksChanged')
    await loadTasks()
  } catch (deleteError) {
    toast.showError(deleteError instanceof Error ? deleteError.message : 'Could not delete task.')
  } finally {
    deleting.value = false
  }
}

async function markCompleted(task: Task) {
  if (completingId.value || task.isCompleted) return

  completingId.value = task.id
  try {
    await completeTask(task)
    toast.showSuccess('Task completed.')
    emit('tasksChanged')
    await loadTasks()
  } catch (completeError) {
    toast.showError(completeError instanceof Error ? completeError.message : 'Could not complete task.')
  } finally {
    completingId.value = null
  }
}
</script>

<template>
  <div>
    <div class="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-6 gap-y-4">
      <div class="flex min-w-0 items-center gap-x-6">
        <label class="w-96 shrink-0">
          <span class="sr-only">Search tasks</span>
          <input
            ref="searchInputRef"
            v-model="query"
            type="search"
            placeholder="Search summary, priority…"
            class="w-full rounded-xl px-3 py-2.5 text-sm font-normal text-stone-900 field-focus"
          />
        </label>

        <GridSearchStats
          centered
          :loading="loading"
          :nb-hits="nbHits"
          singular="task"
          plural="tasks"
        />
      </div>

      <label class="inline-flex shrink-0 items-center justify-self-center gap-2 text-sm text-stone-700">
        <input v-model="showCompleted" type="checkbox" />
        Show completed
      </label>

      <div class="flex justify-end">
        <button
          type="button"
          class="inline-flex shrink-0 items-center rounded-lg bg-epms-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-epms-800 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="showTaskDialog"
          @click="startCreateTask"
        >
          New task
        </button>
      </div>
    </div>

    <p v-if="error" class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {{ error }}
    </p>

    <div class="mt-4 min-w-0 overflow-x-auto rounded-xl border border-stone-200">
      <table class="min-w-full text-left text-sm [&_td]:align-top [&_th]:align-top">
        <thead class="bg-stone-100 text-xs font-semibold uppercase tracking-wide text-stone-600">
          <tr>
            <GridSortHeader
              column="summary"
              label="Summary"
              :sort-state="sortState"
              cell-class="min-w-[14rem] px-4 py-3"
              @sort="handleSort"
            />
            <GridSortHeader
              column="dueDt"
              label="Due date"
              :sort-state="sortState"
              cell-class="whitespace-nowrap px-4 py-3"
              @sort="handleSort"
            />
            <th class="whitespace-nowrap px-4 py-3 text-center">Due in</th>
            <GridSortHeader
              column="priority"
              label="Priority"
              :sort-state="sortState"
              align="center"
              cell-class="whitespace-nowrap px-4 py-3"
              @sort="handleSort"
            />
            <GridSortHeader
              column="isCompleted"
              label="Status"
              :sort-state="sortState"
              align="center"
              cell-class="whitespace-nowrap px-4 py-3"
              @sort="handleSort"
            />
            <th class="w-28 px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-8 text-center text-stone-500">Loading tasks…</td>
          </tr>
          <tr v-else-if="visibleTasks.length === 0">
            <td colspan="6" class="px-4 py-8 text-center text-stone-500">
              {{ emptyStateMessage }}
            </td>
          </tr>
          <tr
            v-for="task in visibleTasks"
            :key="task.id"
            class="border-t border-stone-100 transition odd:bg-white even:bg-stone-50 hover:bg-epms-50/40"
            :class="task.isCompleted ? 'opacity-70' : ''"
          >
            <td class="px-4 py-3 text-stone-700">
              <SearchHighlight :html="textHighlight(task.summary)" />
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-stone-700">
              {{ formatTaskDate(task.dueDt) }}
            </td>
            <td class="px-4 py-3 text-center">
              <TaskDueInBadge :due-dt="task.dueDt" :is-completed="task.isCompleted" />
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
                :class="taskStatusBadgeClass(task.isCompleted)"
              >
                {{ taskStatusLabel(task.isCompleted, task.status?.label) }}
              </span>
            </td>
            <td class="px-4 py-3">
              <GridEditDeleteActions
                :show-complete="!task.isCompleted"
                complete-label="Mark task completed"
                :disabled="deleting || showTaskDialog || completingId !== null"
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

    <TaskCreateDialog
      v-model="showTaskDialog"
      :task-id="editingTaskId"
      :fixed-linked-object="editingTaskId ? undefined : fixedLinkedObject"
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
  </div>
</template>
