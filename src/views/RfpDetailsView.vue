<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter, type RouteLocationNormalized } from 'vue-router'
import CompanyNotesGrid from '@/components/CompanyNotesGrid.vue'
import CompanyTasksGrid from '@/components/CompanyTasksGrid.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import RfpForm from '@/components/RfpForm.vue'
import RfpMilestonesTimeline from '@/components/RfpMilestonesTimeline.vue'
import { useDetailBackNavigation } from '@/composables/useDetailBackNavigation'
import { useRoutedDetailTab } from '@/composables/useRoutedDetailTab'
import { useToast } from '@/composables/useToast'
import { loadCompany } from '@/lib/companies'
import { cloneSnapshotValue, isDirtySnapshot, snapshotOf } from '@/lib/formSnapshot'
import { preserveGridReturnQuery } from '@/lib/gridReturnNavigation'
import { loadOpportunity } from '@/lib/opportunityRecords'
import type { RfpMilestoneContext } from '@/lib/rfpMilestoneRecords'
import {
  rfpBackLabel,
  rfpBackRoute,
  rfpDetailsQuery,
  rfpReturnCompanyId,
  rfpReturnOpportunityId,
} from '@/lib/rfpNavigation'
import {
  createRfp,
  deleteRfp,
  emptyRfpInput,
  loadRfp,
  rfpInputFromRfp,
  updateRfp,
  validateRfpInput,
  type Rfp,
  type RfpInput,
} from '@/lib/rfpRecords'

const props = defineProps<{
  id?: string
}>()

const route = useRoute()
const router = useRouter()
const toast = useToast()

type RfpTab = 'details' | 'timeline' | 'notes' | 'tasks'

function isRfpTab(value: unknown): value is RfpTab {
  return value === 'details' || value === 'timeline' || value === 'notes' || value === 'tasks'
}

const { activeTab, setActiveTab } = useRoutedDetailTab(isRfpTab, 'details')

const rfp = ref<Rfp | null>(null)
const form = ref<RfpInput>(emptyRfpInput())
const formSnapshot = ref<string | null>(null)

const loading = ref(Boolean(props.id))
const saving = ref(false)
const deleting = ref(false)
const editing = ref(!props.id)

const showDiscardDialog = ref(false)
const showDeleteDialog = ref(false)

type DiscardAction =
  | { type: 'cancel-edit' }
  | { type: 'navigate'; run: () => unknown | Promise<unknown> }
  | { type: 'route-leave'; to: RouteLocationNormalized }

const pendingDiscardAction = ref<DiscardAction | null>(null)

const isCreateMode = computed(() => !props.id)

const pageTitle = computed(() => {
  if (isCreateMode.value) return 'Create RFP'
  return rfp.value?.title || rfp.value?.objectLabel || 'RFP details'
})

const isDirty = computed(
  () => editing.value && isDirtySnapshot(form.value, formSnapshot.value),
)

const returnCompanyId = computed(() => rfpReturnCompanyId(route.query))
const returnOpportunityId = computed(() => rfpReturnOpportunityId(route.query))
const { backLabel, backRoute, navigateBack } = useDetailBackNavigation(() => ({
  route: rfpBackRoute(returnCompanyId.value, returnOpportunityId.value),
  label: rfpBackLabel(returnCompanyId.value, returnOpportunityId.value),
}))

const noteCount = computed(() => rfp.value?.numOfNotes ?? 0)
const openMilestoneCount = computed(() => rfp.value?.numOfUncompletedMilestones ?? 0)
const taskCount = computed(() => rfp.value?.numOfUncompletedTasks ?? 0)

const notesLinkedObject = computed(() => ({
  id: props.id ?? '',
  label: rfp.value?.title || rfp.value?.objectLabel || '',
  collection: 'rfps' as const,
  type: 'Rfp' as const,
}))

const tasksLinkedObject = computed(() => ({
  id: props.id ?? '',
  label: rfp.value?.title || rfp.value?.objectLabel || '',
  collection: 'rfps' as const,
  type: 'Rfp' as const,
}))

const milestoneContext = computed<RfpMilestoneContext>(() => ({
  company: rfp.value?.company ?? form.value.company,
  opportunity: rfp.value?.opportunity ?? form.value.opportunity,
  rfp: {
    id: props.id ?? '',
    objectLabel: rfp.value?.title || rfp.value?.objectLabel || form.value.title || 'RFP',
  },
}))

onMounted(async () => {
  if (!props.id) {
    await initializeCreateForm()
    return
  }

  try {
    rfp.value = await loadRfp(props.id)
    resetForm(rfpInputFromRfp(rfp.value))
    editing.value = false
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Could not load RFP.')
    await router.replace(backRoute.value)
  } finally {
    loading.value = false
  }
})

watch(
  () => props.id,
  async (nextId, prevId) => {
    if (!nextId) return
    loading.value = true
    try {
      rfp.value = await loadRfp(nextId)
      resetForm(rfpInputFromRfp(rfp.value))
      editing.value = !prevId
    } catch (error) {
      toast.showError(error instanceof Error ? error.message : 'Could not load RFP.')
    } finally {
      loading.value = false
    }
  },
)

onBeforeRouteLeave((to, _from, next) => {
  if (saving.value || !isDirty.value) {
    next()
    return
  }

  pendingDiscardAction.value = { type: 'route-leave', to }
  showDiscardDialog.value = true
  next(false)
})

async function initializeCreateForm() {
  const companyId =
    rfpReturnCompanyId(route.query) ??
    (typeof route.query.companyId === 'string' ? route.query.companyId : null)
  const opportunityId =
    rfpReturnOpportunityId(route.query) ??
    (typeof route.query.opportunityId === 'string' ? route.query.opportunityId : null)

  if (companyId) {
    try {
      const company = await loadCompany(companyId)
      let opportunity = null

      if (opportunityId) {
        try {
          const opportunityRecord = await loadOpportunity(opportunityId)
          opportunity = {
            id: opportunityRecord.id,
            objectLabel: opportunityRecord.title || opportunityRecord.objectLabel,
          }
        } catch {
          const opportunityLabel =
            typeof route.query.opportunityLabel === 'string' ? route.query.opportunityLabel : ''
          if (opportunityLabel) {
            opportunity = { id: opportunityId, objectLabel: opportunityLabel }
          }
        }
      }

      resetForm(
        emptyRfpInput(
          { id: company.id, objectLabel: company.name || company.objectLabel },
          opportunity,
        ),
      )
      return
    } catch {
      toast.showError('Could not prefill company.')
    }
  }

  const companyLabel = typeof route.query.companyLabel === 'string' ? route.query.companyLabel : ''
  if (companyId && companyLabel) {
    const opportunityLabel =
      typeof route.query.opportunityLabel === 'string' ? route.query.opportunityLabel : ''
    resetForm(
      emptyRfpInput(
        { id: companyId, objectLabel: companyLabel },
        opportunityId && opportunityLabel
          ? { id: opportunityId, objectLabel: opportunityLabel }
          : null,
      ),
    )
    return
  }

  resetForm(emptyRfpInput())
}

function resetForm(nextForm: RfpInput) {
  form.value = cloneSnapshotValue(nextForm)
  formSnapshot.value = snapshotOf(nextForm)
}

function discardFormState() {
  if (rfp.value && !isCreateMode.value) {
    resetForm(rfpInputFromRfp(rfp.value))
    editing.value = false
    return
  }

  resetForm(emptyRfpInput())
}

function requestDiscard(action: DiscardAction) {
  if (!isDirty.value) {
    void executeDiscardAction(action)
    return
  }

  pendingDiscardAction.value = action
  showDiscardDialog.value = true
}

async function executeDiscardAction(action: DiscardAction) {
  switch (action.type) {
    case 'cancel-edit':
      discardFormState()
      break
    case 'navigate':
      discardFormState()
      await action.run()
      break
    case 'route-leave':
      discardFormState()
      await router.push(action.to)
      break
  }
}

function startEditing() {
  if (!rfp.value) return
  resetForm(rfpInputFromRfp(rfp.value))
  editing.value = true
}

function cancelEditing() {
  if (isCreateMode.value) {
    requestDiscard({ type: 'navigate', run: () => navigateBack() })
    return
  }

  requestDiscard({ type: 'cancel-edit' })
}

function dismissDiscardDialog() {
  pendingDiscardAction.value = null
}

async function applyDiscard() {
  const action = pendingDiscardAction.value
  showDiscardDialog.value = false
  pendingDiscardAction.value = null

  if (!action) return
  await executeDiscardAction(action)
}

async function saveRfp() {
  try {
    validateRfpInput(form.value)
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Please check the required fields.')
    return
  }

  saving.value = true

  try {
    if (isCreateMode.value) {
      const created = await createRfp(form.value)
      toast.showSuccess('RFP created.')
      rfp.value = created
      resetForm(rfpInputFromRfp(created))
      editing.value = false
      await router.replace({
        name: 'rfp-details',
        params: { id: created.id },
        query: preserveGridReturnQuery(
          route.query,
          rfpDetailsQuery({
            fromCompanyId: returnCompanyId.value,
            fromOpportunityId: returnOpportunityId.value,
          }),
        ),
      })
      return
    }

    if (!props.id) return

    rfp.value = await updateRfp(props.id, form.value)
    resetForm(rfpInputFromRfp(rfp.value))
    editing.value = false
    toast.showSuccess('RFP saved.')
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Save failed.')
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!props.id) return

  deleting.value = true
  try {
    await deleteRfp(props.id)
    toast.showSuccess('RFP deleted.')
    showDeleteDialog.value = false
    await router.replace(backRoute.value)
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Delete failed.')
  } finally {
    deleting.value = false
  }
}

async function reloadRfpCounts() {
  if (!props.id) return

  try {
    rfp.value = await loadRfp(props.id)
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Could not refresh RFP.')
  }
}
</script>

<template>
  <section class="w-full">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <button
          type="button"
          class="mb-3 inline-flex items-center text-sm font-medium text-epms-800 transition hover:text-epms-950"
          @click="requestDiscard({ type: 'navigate', run: () => navigateBack() })"
        >
          ← {{ backLabel }}
        </button>
        <h1 class="text-2xl font-bold text-epms-900">{{ pageTitle }}</h1>
        <p v-if="rfp?.company?.objectLabel" class="mt-1 text-sm text-stone-500">
          {{ rfp.company.objectLabel }}
          <template v-if="rfp.opportunity?.objectLabel">
            · {{ rfp.opportunity.objectLabel }}
          </template>
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <template v-if="!isCreateMode && !loading">
          <button
            v-if="!editing"
            type="button"
            class="rounded-lg border border-epms-300 px-4 py-2.5 text-sm font-semibold text-epms-800 transition hover:bg-epms-50"
            @click="startEditing"
          >
            Edit
          </button>
          <template v-else>
            <button
              type="submit"
              form="rfp-form"
              class="rounded-lg bg-epms-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-epms-800 disabled:opacity-50"
              :disabled="saving"
            >
              {{ saving ? 'Saving…' : 'Save' }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
              :disabled="saving"
              @click="cancelEditing"
            >
              Cancel
            </button>
          </template>
          <button
            v-if="!editing"
            type="button"
            class="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50"
            @click="showDeleteDialog = true"
          >
            Delete
          </button>
        </template>

        <template v-if="isCreateMode">
          <button
            type="submit"
            form="rfp-form"
            class="rounded-lg bg-epms-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-epms-800 disabled:opacity-50"
            :disabled="saving"
          >
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
            :disabled="saving"
            @click="cancelEditing"
          >
            Cancel
          </button>
        </template>
      </div>
    </div>

    <div v-if="!isCreateMode" class="mt-6 flex flex-wrap gap-2 border-b border-stone-200">
      <button
        type="button"
        class="rounded-t-lg px-4 py-2.5 text-sm font-semibold transition"
        :class="activeTab === 'details' ? 'border-b-2 border-epms-700 text-epms-900' : 'text-stone-500 hover:text-stone-700'"
        @click="setActiveTab('details')"
      >
        RFP details
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition"
        :class="activeTab === 'timeline' ? 'border-b-2 border-epms-700 text-epms-900' : 'text-stone-500 hover:text-stone-700'"
        @click="setActiveTab('timeline')"
      >
        Timeline
        <span
          v-if="openMilestoneCount > 0"
          class="rounded-full bg-epms-100 px-2 py-0.5 text-xs font-semibold text-epms-800"
        >
          {{ openMilestoneCount }}
        </span>
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition"
        :class="activeTab === 'notes' ? 'border-b-2 border-epms-700 text-epms-900' : 'text-stone-500 hover:text-stone-700'"
        @click="setActiveTab('notes')"
      >
        Notes
        <span
          v-if="noteCount > 0"
          class="rounded-full bg-epms-100 px-2 py-0.5 text-xs font-semibold text-epms-800"
        >
          {{ noteCount }}
        </span>
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition"
        :class="activeTab === 'tasks' ? 'border-b-2 border-epms-700 text-epms-900' : 'text-stone-500 hover:text-stone-700'"
        @click="setActiveTab('tasks')"
      >
        Tasks
        <span
          v-if="taskCount > 0"
          class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800"
        >
          {{ taskCount }}
        </span>
      </button>
    </div>

    <div class="mt-6 rounded-2xl border border-epms-200 bg-white p-6 shadow-sm">
      <p v-if="loading" class="text-sm text-stone-500">Loading RFP…</p>

      <template v-else-if="activeTab === 'details' || isCreateMode">
        <p class="mb-6 text-sm font-semibold uppercase tracking-wide text-epms-700">
          {{ isCreateMode ? 'New RFP' : editing ? 'Edit RFP' : 'RFP profile' }}
        </p>
        <RfpForm v-model="form" :readonly="!editing" @submit="saveRfp" />
      </template>

      <template v-else-if="activeTab === 'timeline' && props.id">
        <RfpMilestonesTimeline :context="milestoneContext" @milestones-changed="reloadRfpCounts" />
      </template>

      <template v-else-if="activeTab === 'notes' && props.id">
        <CompanyNotesGrid :linked-object="notesLinkedObject" @notes-changed="reloadRfpCounts" />
      </template>

      <template v-else-if="activeTab === 'tasks' && props.id">
        <CompanyTasksGrid :linked-object="tasksLinkedObject" @tasks-changed="reloadRfpCounts" />
      </template>
    </div>

    <ConfirmDialog
      v-model="showDiscardDialog"
      title="Discard changes?"
      message="You have unsaved changes. Discard them and continue?"
      confirm-label="Discard"
      cancel-label="Keep editing"
      destructive
      @confirm="applyDiscard"
      @cancel="dismissDiscardDialog"
    />

    <ConfirmDialog
      v-model="showDeleteDialog"
      title="Delete RFP?"
      message="This permanently deletes the RFP, its milestones, and linked notes. This cannot be undone."
      confirm-label="Delete"
      destructive
      :loading="deleting"
      @confirm="confirmDelete"
    />
  </section>
</template>
