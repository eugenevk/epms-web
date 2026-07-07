<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AlgoliaFacetFilter from '@/components/AlgoliaFacetFilter.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import GridEditDeleteActions from '@/components/GridEditDeleteActions.vue'
import GridPagination from '@/components/GridPagination.vue'
import GridSortHeader from '@/components/GridSortHeader.vue'
import TaskCreateDialog from '@/components/TaskCreateDialog.vue'
import TaskDueInBadge from '@/components/TaskDueInBadge.vue'
import { useGridReturnLink } from '@/composables/useGridReturnLink'
import { useGridSort } from '@/composables/useGridSort'
import { useToast } from '@/composables/useToast'
import { completeTask, deleteTask, loadOpenTasks, type Task } from '@/lib/taskRecords'
import {
  buildOpenTaskLinkedToFacets,
  filterOpenTasksByLinkedTo,
  formatTaskDate,
  priorityBadgeClass,
  taskLinkedObjectRoute,
  taskDaysUntilDue,
  taskPrioritySortValue,
} from '@/lib/tasks'
import { paginateItems } from '@/lib/gridPagination'

const OPEN_TASKS_PAGE_SIZE = 10

const toast = useToast()
const { withReturn } = useGridReturnLink()

const tasks = ref<Task[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const completingId = ref<string | null>(null)
const showTaskDialog = ref(false)
const editingTaskId = ref<string | null>(null)
const showDeleteDialog = ref(false)
const deletingTaskId = ref<string | null>(null)
const deleting = ref(false)
const showFilters = ref(true)
const selectedLinkedTo = ref<string[]>([])
const page = ref(0)

const linkedToFacets = computed(() => buildOpenTaskLinkedToFacets(tasks.value))
const filteredTasks = computed(() => filterOpenTasksByLinkedTo(tasks.value, selectedLinkedTo.value))
const hasActiveFilters = computed(() => selectedLinkedTo.value.length > 0)

const { sortState, sortedItems, onSort: handleSort } = useGridSort(
  filteredTasks,
  {
    summary: (task) => task.summary,
    linkedTo: (task) => task.linkedObject.objectLabel,
    dueDt: (task) => task.dueDt ?? '',
    dueIn: (task) => taskDaysUntilDue(task.dueDt) ?? Number.MAX_SAFE_INTEGER,
    priority: (task) => taskPrioritySortValue(task.priority?.value),
  },
  [
    { column: 'dueDt', direction: 'asc' },
    { column: 'priority', direction: 'desc' },
  ],
  { summary: 'asc', linkedTo: 'asc', dueDt: 'asc', dueIn: 'asc', priority: 'desc' },
)

const pagination = computed(() =>
  paginateItems(sortedItems.value, page.value, OPEN_TASKS_PAGE_SIZE),
)
const visibleTasks = computed(() => pagination.value.items)

watch(selectedLinkedTo, () => {
  page.value = 0
})

watch(
  () => pagination.value.nbPages,
  (nbPages) => {
    if (page.value >= nbPages) {
      page.value = Math.max(0, nbPages - 1)
    }
  },
)

const overdueCount = computed(() => filteredTasks.value.filter((task) => task.isOverdue).length)
const dueSoonCount = computed(() =>
  filteredTasks.value.filter((task) => {
    if (task.isOverdue || !task.dueDt) return false
    const days = taskDaysUntilDue(task.dueDt)
    return days !== null && days >= 0 && days <= 7
  }).length,
)

function toggleLinkedToFacet(value: string) {
  const current = selectedLinkedTo.value
  selectedLinkedTo.value = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value]
}

function clearFacetFilters() {
  selectedLinkedTo.value = []
  page.value = 0
}

onMounted(() => {
  void loadTasks()
})

async function loadTasks() {
  loading.value = true
  error.value = null

  try {
    tasks.value = await loadOpenTasks()
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Could not load open tasks.'
    tasks.value = []
  } finally {
    loading.value = false
  }
}

function startCreateTask() {
  editingTaskId.value = null
  showTaskDialog.value = true
}

function startEditTask(task: Task) {
  editingTaskId.value = task.id
  showTaskDialog.value = true
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
    await loadTasks()
  } catch (deleteError) {
    toast.showError(deleteError instanceof Error ? deleteError.message : 'Could not delete task.')
  } finally {
    deleting.value = false
  }
}

async function completeTaskItem(task: Task) {
  if (completingId.value) return

  completingId.value = task.id
  try {
    await completeTask(task)
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
  <section class="mb-6 w-full rounded-2xl border border-epms-200 bg-white p-5 shadow-sm sm:p-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="inline-flex flex-wrap items-center gap-2 text-lg font-bold text-epms-900">
          Open tasks
          <span
            v-if="!loading"
            class="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800"
          >
            {{ filteredTasks.length }}
          </span>
          <span
            v-if="!loading && dueSoonCount > 0"
            class="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900"
          >
            {{ dueSoonCount }} due within 7 days
          </span>
        </h2>
        <p class="mt-1 text-sm text-stone-600">
          Action items linked to companies, opportunities, and RFPs.
        </p>
      </div>

      <button
        type="button"
        class="inline-flex items-center rounded-lg bg-epms-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-epms-800"
        @click="startCreateTask"
      >
        New task
      </button>
    </div>

    <div v-if="!loading && tasks.length > 0 && overdueCount > 0" class="mt-4 flex flex-wrap gap-2">
      <span class="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
        {{ overdueCount }} overdue
      </span>
    </div>

    <p v-if="loading" class="mt-5 text-sm text-stone-500">Loading open tasks…</p>

    <p
      v-else-if="error"
      class="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      {{ error }}
    </p>

    <p
      v-else-if="tasks.length === 0"
      class="mt-5 rounded-xl border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500"
    >
      No open tasks. Everything is completed.
    </p>

    <template v-else>
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
          @click="clearFacetFilters"
        >
          Clear filters
        </button>
      </div>

      <div class="mt-4 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside v-if="showFilters" class="space-y-6 rounded-xl border border-stone-200 bg-stone-100 p-4">
          <AlgoliaFacetFilter
            label="Linked to"
            :facets="linkedToFacets"
            :selected="selectedLinkedTo"
            @toggle="toggleLinkedToFacet"
          />
        </aside>

        <div class="min-w-0">
          <p
            v-if="filteredTasks.length === 0"
            class="rounded-xl border border-stone-200 bg-stone-50 px-4 py-8 text-center text-sm text-stone-600"
          >
            No open tasks match the selected filters.
          </p>

          <div v-else class="overflow-x-auto rounded-xl border border-stone-200">
            <table class="w-full min-w-[56rem] text-left text-sm">
        <thead class="bg-stone-100 text-xs font-semibold uppercase tracking-wide text-stone-600">
          <tr>
            <GridSortHeader
              column="summary"
              label="Task"
              :sort-state="sortState"
              cell-class="whitespace-nowrap px-4 py-3"
              @sort="handleSort"
            />
            <GridSortHeader
              column="linkedTo"
              label="Linked to"
              :sort-state="sortState"
              cell-class="whitespace-nowrap px-4 py-3"
              @sort="handleSort"
            />
            <GridSortHeader
              column="dueDt"
              label="Due date"
              :sort-state="sortState"
              cell-class="whitespace-nowrap px-4 py-3"
              @sort="handleSort"
            />
            <GridSortHeader
              column="dueIn"
              label="Due in"
              :sort-state="sortState"
              align="center"
              cell-class="whitespace-nowrap px-4 py-3"
              @sort="handleSort"
            />
            <GridSortHeader
              column="priority"
              label="Priority"
              :sort-state="sortState"
              align="center"
              cell-class="whitespace-nowrap px-4 py-3"
              @sort="handleSort"
            />
            <th class="w-28 px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="task in visibleTasks"
            :key="task.id"
            class="border-t border-stone-100 transition odd:bg-white even:bg-stone-50 hover:bg-epms-50/40"
          >
            <td class="whitespace-nowrap px-4 py-3 text-stone-700">
              {{ task.summary }}
            </td>
            <td class="whitespace-nowrap px-4 py-3">
              <RouterLink
                :to="withReturn(taskLinkedObjectRoute(task.linkedObject))"
                class="font-medium text-epms-800 hover:underline"
              >
                {{ task.linkedObject.objectLabel }}
              </RouterLink>
              <span class="ml-2 text-xs text-stone-500">{{ task.linkedObject.type }}</span>
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
              <span v-else class="text-stone-400">—</span>
            </td>
            <td class="px-4 py-3">
              <GridEditDeleteActions
                show-complete
                complete-label="Mark task completed"
                :disabled="completingId !== null || deleting || showTaskDialog"
                @complete="completeTaskItem(task)"
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
              :nb-hits="filteredTasks.length"
              :loading="loading"
              @update:page="page = $event"
            />
          </div>
        </div>
      </div>
    </template>
  </section>

  <TaskCreateDialog
    v-model="showTaskDialog"
    :task-id="editingTaskId"
    @saved="loadTasks"
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
</template>
