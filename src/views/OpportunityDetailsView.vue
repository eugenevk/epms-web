<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter, type RouteLocationNormalized } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import CompanyNotesGrid from '@/components/CompanyNotesGrid.vue'
import CompanyTasksGrid from '@/components/CompanyTasksGrid.vue'
import CompanyRfpsGrid from '@/components/CompanyRfpsGrid.vue'
import OpportunityForm from '@/components/OpportunityForm.vue'
import OpportunityStageProgress from '@/components/OpportunityStageProgress.vue'
import { useDetailBackNavigation } from '@/composables/useDetailBackNavigation'
import { useRoutedDetailTab } from '@/composables/useRoutedDetailTab'
import { useToast } from '@/composables/useToast'
import { loadCompany } from '@/lib/companies'
import { cloneSnapshotValue, isDirtySnapshot, snapshotOf } from '@/lib/formSnapshot'
import { preserveGridReturnQuery } from '@/lib/gridReturnNavigation'
import {
  opportunityBackLabel,
  opportunityBackRoute,
  opportunityDetailsQuery,
  opportunityReturnCompanyId,
} from '@/lib/opportunityNavigation'
import {
  createOpportunity,
  deleteOpportunity,
  emptyOpportunityInput,
  loadOpportunity,
  opportunityInputFromOpportunity,
  updateOpportunity,
  validateOpportunityInput,
  type Opportunity,
  type OpportunityInput,
} from '@/lib/opportunityRecords'
import { applyOpportunityStageChange } from '@/lib/opportunityRules'
import type { OpportunityStage } from '@/lib/stages'

const props = defineProps<{
  id?: string
}>()

const route = useRoute()
const router = useRouter()
const toast = useToast()

type OpportunityTab = 'details' | 'rfps' | 'notes' | 'tasks'

function isOpportunityTab(value: unknown): value is OpportunityTab {
  return value === 'details' || value === 'rfps' || value === 'notes' || value === 'tasks'
}

const { activeTab, setActiveTab } = useRoutedDetailTab(isOpportunityTab, 'details')

const opportunity = ref<Opportunity | null>(null)
const form = ref<OpportunityInput>(emptyOpportunityInput())
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
  if (isCreateMode.value) return 'Create opportunity'
  return opportunity.value?.title || opportunity.value?.objectLabel || 'Opportunity details'
})

const isDirty = computed(
  () => editing.value && isDirtySnapshot(form.value, formSnapshot.value),
)

const returnCompanyId = computed(() => opportunityReturnCompanyId(route.query))
const { backLabel, backRoute, navigateBack } = useDetailBackNavigation(() => ({
  route: opportunityBackRoute(returnCompanyId.value),
  label: opportunityBackLabel(returnCompanyId.value),
}))

const noteCount = computed(() => opportunity.value?.numOfNotes ?? 0)
const rfpCount = computed(() => opportunity.value?.numOfRfps ?? 0)
const taskCount = computed(() => opportunity.value?.numOfUncompletedTasks ?? 0)

const notesLinkedObject = computed(() => ({
  id: props.id ?? '',
  label: opportunity.value?.title || opportunity.value?.objectLabel || '',
  collection: 'opportunities' as const,
  type: 'Opportunity' as const,
}))

const tasksLinkedObject = computed(() => ({
  id: props.id ?? '',
  label: opportunity.value?.title || opportunity.value?.objectLabel || '',
  collection: 'opportunities' as const,
  type: 'Opportunity' as const,
}))

onMounted(async () => {
  if (!props.id) {
    await initializeCreateForm()
    return
  }

  try {
    opportunity.value = await loadOpportunity(props.id)
    resetForm(opportunityInputFromOpportunity(opportunity.value))
    editing.value = false
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Could not load opportunity.')
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
      opportunity.value = await loadOpportunity(nextId)
      resetForm(opportunityInputFromOpportunity(opportunity.value))
      editing.value = !prevId
    } catch (error) {
      toast.showError(error instanceof Error ? error.message : 'Could not load opportunity.')
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
    opportunityReturnCompanyId(route.query) ??
    (typeof route.query.companyId === 'string' ? route.query.companyId : null)

  if (companyId) {
    try {
      const company = await loadCompany(companyId)
      resetForm(
        emptyOpportunityInput({
          id: company.id,
          objectLabel: company.name || company.objectLabel,
        }),
      )
      return
    } catch {
      toast.showError('Could not prefill company.')
    }
  }

  resetForm(emptyOpportunityInput())
}

function resetForm(nextForm: OpportunityInput) {
  form.value = cloneSnapshotValue(nextForm)
  formSnapshot.value = snapshotOf(nextForm)
}

function discardFormState() {
  if (opportunity.value && !isCreateMode.value) {
    resetForm(opportunityInputFromOpportunity(opportunity.value))
    editing.value = false
    return
  }

  resetForm(emptyOpportunityInput())
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
  if (!opportunity.value) return
  resetForm(opportunityInputFromOpportunity(opportunity.value))
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

async function saveOpportunity() {
  try {
    validateOpportunityInput(form.value)
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Please check the required fields.')
    return
  }

  saving.value = true

  try {
    if (isCreateMode.value) {
      const created = await createOpportunity(form.value)
      toast.showSuccess('Opportunity created.')
      opportunity.value = created
      resetForm(opportunityInputFromOpportunity(created))
      editing.value = false
      await router.replace({
        name: 'opportunity-details',
        params: { id: created.id },
        query: preserveGridReturnQuery(route.query, opportunityDetailsQuery(returnCompanyId.value)),
      })
      return
    }

    if (!props.id) return

    opportunity.value = await updateOpportunity(props.id, form.value)
    resetForm(opportunityInputFromOpportunity(opportunity.value))
    editing.value = false
    toast.showSuccess('Opportunity saved.')
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
    await deleteOpportunity(props.id)
    toast.showSuccess('Opportunity deleted.')
    showDeleteDialog.value = false
    await router.replace(backRoute.value)
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Delete failed.')
  } finally {
    deleting.value = false
  }
}

async function reloadOpportunityCounts() {
  if (!props.id) return

  try {
    opportunity.value = await loadOpportunity(props.id)
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Could not refresh opportunity.')
  }
}

function handleStageSelect(stage: OpportunityStage) {
  if (!isCreateMode.value && !editing.value) return
  applyOpportunityStageChange(form.value, stage)
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
        <p v-if="opportunity?.company?.objectLabel" class="mt-1 text-sm text-stone-500">
          {{ opportunity.company.objectLabel }}
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
              form="opportunity-form"
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
            form="opportunity-form"
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
        Opportunity details
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition"
        :class="activeTab === 'rfps' ? 'border-b-2 border-epms-700 text-epms-900' : 'text-stone-500 hover:text-stone-700'"
        @click="setActiveTab('rfps')"
      >
        RFPs
        <span
          v-if="rfpCount > 0"
          class="rounded-full bg-epms-100 px-2 py-0.5 text-xs font-semibold text-epms-800"
        >
          {{ rfpCount }}
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
      <p v-if="loading" class="text-sm text-stone-500">Loading opportunity…</p>

      <template v-else-if="activeTab === 'details' || isCreateMode">
        <p class="mb-4 text-sm font-semibold uppercase tracking-wide text-epms-700">
          {{ isCreateMode ? 'New opportunity' : editing ? 'Edit opportunity' : 'Opportunity profile' }}
        </p>

        <OpportunityStageProgress
          embedded
          class="mb-4"
          :model-value="form.stage"
          :likelihood="form.likelihood"
          :readonly="!editing"
          :loading="saving"
          @update:model-value="handleStageSelect"
        />

        <OpportunityForm
          v-model="form"
          :readonly="!editing"
          hide-stage-select
          @submit="saveOpportunity"
        />
      </template>

      <template v-else-if="activeTab === 'rfps' && props.id && opportunity?.company">
        <CompanyRfpsGrid
          :company-id="opportunity.company.id"
          :company-label="opportunity.company.objectLabel"
          :opportunity-id="props.id"
          :opportunity-label="opportunity.title || opportunity.objectLabel"
        />
      </template>

      <template v-else-if="activeTab === 'notes' && props.id">
        <CompanyNotesGrid :linked-object="notesLinkedObject" @notes-changed="reloadOpportunityCounts" />
      </template>

      <template v-else-if="activeTab === 'tasks' && props.id">
        <CompanyTasksGrid :linked-object="tasksLinkedObject" @tasks-changed="reloadOpportunityCounts" />
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
      title="Delete opportunity?"
      message="This permanently deletes the opportunity and linked notes. RFPs are kept but unlinked. This cannot be undone."
      confirm-label="Delete"
      destructive
      :loading="deleting"
      @confirm="confirmDelete"
    />
  </section>
</template>
