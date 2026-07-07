<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import GridEditDeleteActions from '@/components/GridEditDeleteActions.vue'
import GridSortHeader from '@/components/GridSortHeader.vue'
import RfpMilestoneDialog from '@/components/RfpMilestoneDialog.vue'
import { useGridReturnLink } from '@/composables/useGridReturnLink'
import { useGridSort } from '@/composables/useGridSort'
import { completeRfpMilestone, deleteRfpMilestone, loadOpenRfpMilestones, type RfpMilestone } from '@/lib/rfpMilestoneRecords'
import { daysUntilDate, formatRfpDate, milestoneDueBadgeClass, milestoneDueLabel } from '@/lib/rfps'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const { withReturn } = useGridReturnLink()

const milestones = ref<RfpMilestone[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const completingId = ref<string | null>(null)
const showMilestoneDialog = ref(false)
const editingMilestoneId = ref<string | null>(null)
const showDeleteDialog = ref(false)
const deletingMilestoneId = ref<string | null>(null)
const deleting = ref(false)

const { sortState, sortedItems, onSort: handleSort } = useGridSort(
  milestones,
  {
    title: (milestone) => milestone.title,
    rfp: (milestone) => milestone.rfp.objectLabel,
    company: (milestone) => milestone.company.objectLabel,
    dueDt: (milestone) => milestone.dueDt ?? '',
    status: (milestone) => daysUntilDate(milestone.dueDt) ?? Number.MAX_SAFE_INTEGER,
  },
  [{ column: 'dueDt', direction: 'asc' }],
  { title: 'asc', rfp: 'asc', company: 'asc', dueDt: 'asc', status: 'asc' },
)

const overdueCount = computed(() => milestones.value.filter((milestone) => milestone.isOverdue).length)
const dueSoonCount = computed(() =>
  milestones.value.filter((milestone) => {
    if (milestone.isOverdue || !milestone.dueDt) return false
    const due = new Date(milestone.dueDt)
    if (Number.isNaN(due.getTime())) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)
    const days = Math.round((due.getTime() - today.getTime()) / 86_400_000)
    return days >= 0 && days <= 7
  }).length,
)

onMounted(() => {
  void loadMilestones()
})

async function loadMilestones() {
  loading.value = true
  error.value = null

  try {
    milestones.value = await loadOpenRfpMilestones()
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Could not load open RFP milestones.'
    milestones.value = []
  } finally {
    loading.value = false
  }
}

function rfpRoute(milestone: RfpMilestone) {
  return withReturn({
    name: 'rfp-details' as const,
    params: { id: milestone.rfp.id },
    query: { tab: 'timeline' },
  })
}

function startEditMilestone(milestone: RfpMilestone) {
  editingMilestoneId.value = milestone.id
  showMilestoneDialog.value = true
}

function deleteDialogMessage(milestoneId: string | null): string {
  const milestone = milestones.value.find((item) => item.id === milestoneId)
  const label = milestone?.title?.trim() || 'this milestone'
  return `Delete "${label}"? This cannot be undone.`
}

function startDeleteMilestone(milestone: RfpMilestone) {
  deletingMilestoneId.value = milestone.id
  showDeleteDialog.value = true
}

function cancelDeleteMilestone() {
  showDeleteDialog.value = false
  deletingMilestoneId.value = null
}

async function confirmDeleteMilestone() {
  if (!deletingMilestoneId.value) return

  const milestone = milestones.value.find((item) => item.id === deletingMilestoneId.value)
  if (!milestone) return

  deleting.value = true
  try {
    await deleteRfpMilestone(deletingMilestoneId.value, milestone.rfp.id)
    toast.showSuccess('Milestone deleted.')
    showDeleteDialog.value = false
    deletingMilestoneId.value = null
    await loadMilestones()
  } catch (deleteError) {
    toast.showError(deleteError instanceof Error ? deleteError.message : 'Could not delete milestone.')
  } finally {
    deleting.value = false
  }
}

async function completeMilestone(milestone: RfpMilestone) {
  if (completingId.value) return

  completingId.value = milestone.id
  try {
    await completeRfpMilestone(milestone)
    toast.showSuccess('Milestone completed.')
    await loadMilestones()
  } catch (completeError) {
    toast.showError(completeError instanceof Error ? completeError.message : 'Could not complete milestone.')
  } finally {
    completingId.value = null
  }
}
</script>

<template>
  <section class="w-full rounded-2xl border border-epms-200 bg-white p-5 shadow-sm sm:p-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="inline-flex flex-wrap items-center gap-2 text-lg font-bold text-epms-900">
          Open RFP milestones
          <span
            v-if="!loading"
            class="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800"
          >
            {{ milestones.length }}
          </span>
        </h2>
        <p class="mt-1 text-sm text-stone-600">
          Deadlines that still need to be completed across all RFPs.
        </p>
      </div>

      <RouterLink
        :to="{ name: 'rfps' }"
        class="text-sm font-semibold text-epms-800 transition hover:text-epms-950"
      >
        View all RFPs
      </RouterLink>
    </div>

    <div v-if="!loading && milestones.length > 0 && (overdueCount > 0 || dueSoonCount > 0)" class="mt-4 flex flex-wrap gap-2">
      <span
        v-if="overdueCount > 0"
        class="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"
      >
        {{ overdueCount }} overdue
      </span>
      <span
        v-if="dueSoonCount > 0"
        class="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900"
      >
        {{ dueSoonCount }} due within 7 days
      </span>
    </div>

    <p v-if="loading" class="mt-5 text-sm text-stone-500">Loading open milestones…</p>

    <p
      v-else-if="error"
      class="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      {{ error }}
    </p>

    <p
      v-else-if="milestones.length === 0"
      class="mt-5 rounded-xl border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500"
    >
      No open RFP milestones. All deadlines are completed.
    </p>

    <div v-else class="mt-5 overflow-x-auto rounded-xl border border-stone-200">
      <table class="w-full min-w-[64rem] text-left text-sm">
        <thead class="bg-stone-100 text-xs font-semibold uppercase tracking-wide text-stone-600">
          <tr>
            <GridSortHeader
              column="title"
              label="Milestone"
              :sort-state="sortState"
              cell-class="whitespace-nowrap px-4 py-3"
              @sort="handleSort"
            />
            <GridSortHeader
              column="rfp"
              label="RFP"
              :sort-state="sortState"
              cell-class="whitespace-nowrap px-4 py-3"
              @sort="handleSort"
            />
            <GridSortHeader
              column="company"
              label="Company"
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
              column="status"
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
          <tr
            v-for="milestone in sortedItems"
            :key="milestone.id"
            class="border-t border-stone-100 transition odd:bg-white even:bg-stone-50 hover:bg-epms-50/40"
          >
            <td class="whitespace-nowrap px-4 py-3 text-stone-700">
              {{ milestone.title }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-stone-700">
              <RouterLink :to="rfpRoute(milestone)" class="text-epms-800 hover:underline">
                {{ milestone.rfp.objectLabel }}
              </RouterLink>
            </td>
            <td class="whitespace-nowrap px-4 py-3">
              <RouterLink
                :to="withReturn({ name: 'company-details', params: { id: milestone.company.id } })"
                class="font-medium text-epms-800 hover:underline"
              >
                {{ milestone.company.objectLabel }}
              </RouterLink>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-stone-700">
              {{ formatRfpDate(milestone.dueDt) }}
            </td>
            <td class="px-4 py-3 text-center">
              <span
                class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                :class="milestoneDueBadgeClass(milestone.dueDt, milestone.isCompleted)"
              >
                {{ milestoneDueLabel(milestone.dueDt, milestone.isCompleted) }}
              </span>
            </td>
            <td class="px-4 py-3">
              <GridEditDeleteActions
                show-complete
                complete-label="Mark milestone completed"
                :disabled="completingId !== null || deleting || showMilestoneDialog"
                @complete="completeMilestone(milestone)"
                @edit="startEditMilestone(milestone)"
                @delete="startDeleteMilestone(milestone)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <RfpMilestoneDialog
    v-model="showMilestoneDialog"
    :milestone-id="editingMilestoneId"
    @saved="loadMilestones"
  />

  <ConfirmDialog
    v-model="showDeleteDialog"
    title="Delete milestone"
    :message="deleteDialogMessage(deletingMilestoneId)"
    confirm-label="Delete milestone"
    destructive
    :loading="deleting"
    @confirm="confirmDeleteMilestone"
    @cancel="cancelDeleteMilestone"
  />
</template>
