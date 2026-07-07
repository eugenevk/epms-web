<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import GridEditDeleteActions from '@/components/GridEditDeleteActions.vue'
import RfpMilestoneDialog from '@/components/RfpMilestoneDialog.vue'
import {
  completeRfpMilestone,
  deleteRfpMilestone,
  loadRfpMilestones,
  type RfpMilestone,
  type RfpMilestoneContext,
} from '@/lib/rfpMilestoneRecords'
import { formatRfpDate, milestoneDueBadgeClass, milestoneDueLabel } from '@/lib/rfps'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  context: RfpMilestoneContext
  readonly?: boolean
}>()

const emit = defineEmits<{
  milestonesChanged: []
}>()

const toast = useToast()

const milestones = ref<RfpMilestone[]>([])
const loading = ref(true)
const deleting = ref(false)
const completingId = ref<string | null>(null)

const showMilestoneDialog = ref(false)
const editingMilestoneId = ref<string | null>(null)

const showDeleteDialog = ref(false)
const deletingMilestoneId = ref<string | null>(null)

const sortedMilestones = computed(() =>
  [...milestones.value].sort((left, right) => {
    const leftDate = left.dueDt ?? left.startDt ?? ''
    const rightDate = right.dueDt ?? right.startDt ?? ''
    return leftDate.localeCompare(rightDate, 'en', { sensitivity: 'base' })
  }),
)

onMounted(() => {
  void loadMilestones()
})

async function loadMilestones() {
  loading.value = true
  try {
    milestones.value = await loadRfpMilestones(props.context.rfp.id)
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Could not load timeline.')
    milestones.value = []
  } finally {
    loading.value = false
  }
}

function startCreate() {
  editingMilestoneId.value = null
  showMilestoneDialog.value = true
}

function startEdit(milestone: RfpMilestone) {
  editingMilestoneId.value = milestone.id
  showMilestoneDialog.value = true
}

function startDelete(milestone: RfpMilestone) {
  deletingMilestoneId.value = milestone.id
  showDeleteDialog.value = true
}

function onMilestoneSaved() {
  emit('milestonesChanged')
  void loadMilestones()
}

async function completeMilestone(milestone: RfpMilestone) {
  if (milestone.isCompleted || completingId.value) return

  completingId.value = milestone.id
  try {
    await completeRfpMilestone(milestone)
    toast.showSuccess('Milestone completed.')
    emit('milestonesChanged')
    await loadMilestones()
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Could not complete milestone.')
  } finally {
    completingId.value = null
  }
}

async function confirmDelete() {
  if (!deletingMilestoneId.value) return

  deleting.value = true
  try {
    await deleteRfpMilestone(deletingMilestoneId.value, props.context.rfp.id)
    toast.showSuccess('Milestone deleted.')
    showDeleteDialog.value = false
    deletingMilestoneId.value = null
    emit('milestonesChanged')
    await loadMilestones()
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Could not delete milestone.')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-stone-600">
        <span v-if="loading">Loading timeline…</span>
        <span v-else>{{ sortedMilestones.length }} milestone{{ sortedMilestones.length === 1 ? '' : 's' }}</span>
      </p>
      <button
        v-if="!readonly"
        type="button"
        class="inline-flex items-center rounded-lg bg-epms-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-epms-800 disabled:opacity-60"
        :disabled="deleting || completingId !== null || showMilestoneDialog"
        @click="startCreate"
      >
        New milestone
      </button>
    </div>

    <div v-if="loading" class="mt-6 text-sm text-stone-500">Loading milestones…</div>

    <div v-else-if="sortedMilestones.length === 0" class="mt-6 rounded-xl border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">
      No milestones yet. Add deadlines to build the RFP timeline.
    </div>

    <ol v-else class="relative mt-6 space-y-0">
      <li
        v-for="(milestone, index) in sortedMilestones"
        :key="milestone.id"
        class="relative flex gap-4 pb-8 last:pb-0"
      >
        <div class="flex w-24 shrink-0 flex-col items-end pt-1 sm:w-28">
          <span class="whitespace-nowrap text-xs font-semibold text-stone-700">
            {{ formatRfpDate(milestone.dueDt) }}
          </span>
          <span class="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
            Deadline
          </span>
        </div>

        <div class="flex w-8 shrink-0 flex-col items-center">
          <span
            class="mt-1 h-3 w-3 rounded-full border-2"
            :class="milestone.isCompleted ? 'border-emerald-600 bg-emerald-600' : milestone.isOverdue ? 'border-red-600 bg-red-600' : 'border-epms-700 bg-white'"
          />
          <span
            v-if="index < sortedMilestones.length - 1"
            class="mt-1 w-px flex-1 bg-stone-200"
          />
        </div>

        <div class="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <h4 class="text-sm font-semibold text-stone-800">{{ milestone.title }}</h4>
              <p class="mt-1 text-xs text-stone-500">
                <span class="font-medium text-stone-600">Deadline:</span>
                {{ formatRfpDate(milestone.dueDt) }}
                <template v-if="milestone.startDt">
                  <span> · </span>
                  <span class="font-medium text-stone-600">Start:</span>
                  {{ formatRfpDate(milestone.startDt) }}
                </template>
              </p>
            </div>

            <div class="flex items-center gap-2">
              <span
                class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
                :class="milestoneDueBadgeClass(milestone.dueDt, milestone.isCompleted)"
              >
                {{ milestoneDueLabel(milestone.dueDt, milestone.isCompleted) }}
              </span>

              <GridEditDeleteActions
                v-if="!readonly"
                :show-complete="!milestone.isCompleted"
                complete-label="Mark milestone completed"
                :disabled="deleting || completingId !== null || showMilestoneDialog"
                @complete="completeMilestone(milestone)"
                @edit="startEdit(milestone)"
                @delete="startDelete(milestone)"
              />
            </div>
          </div>
        </div>
      </li>
    </ol>

    <RfpMilestoneDialog
      v-model="showMilestoneDialog"
      :milestone-id="editingMilestoneId"
      :fixed-context="editingMilestoneId ? undefined : context"
      @saved="onMilestoneSaved"
    />

    <ConfirmDialog
      v-model="showDeleteDialog"
      title="Delete milestone"
      message="Delete this milestone from the timeline? This cannot be undone."
      confirm-label="Delete milestone"
      destructive
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false; deletingMilestoneId = null"
    />
  </div>
</template>
