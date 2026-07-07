<script setup lang="ts">
import { ref, watch } from 'vue'
import OpportunityForm from '@/components/OpportunityForm.vue'
import OpportunityStageProgress from '@/components/OpportunityStageProgress.vue'
import { useDialogFormDirty } from '@/composables/useDialogFormDirty'
import { useDialogKeyboardShortcuts } from '@/composables/useDialogKeyboardShortcuts'
import { useDialogInitialFocus } from '@/composables/useDialogInitialFocus'
import { useToast } from '@/composables/useToast'
import type { ObjectRef } from '@/lib/companies'
import { requestCloseWithConfirm } from '@/lib/confirmDiscard'
import { normalizeRichTextValue } from '@/lib/formSnapshot'
import { applyOpportunityStageChange } from '@/lib/opportunityRules'
import {
  createOpportunity,
  emptyOpportunityInput,
  validateOpportunityInput,
  type OpportunityInput,
} from '@/lib/opportunityRecords'
import type { OpportunityStage } from '@/lib/stages'

const open = defineModel<boolean>({ required: true })

const props = defineProps<{
  company: ObjectRef
}>()

const emit = defineEmits<{
  saved: []
}>()

const toast = useToast()

const form = ref<OpportunityInput>(emptyOpportunityInput())
const saving = ref(false)
const formContainerRef = ref<HTMLElement | null>(null)

type OpportunityDialogState = {
  form: OpportunityInput
}

function captureDialogState(): OpportunityDialogState {
  return {
    form: {
      ...form.value,
      company: props.company,
      title: form.value.title.trim(),
      description: normalizeRichTextValue(form.value.description),
    },
  }
}

const { commitSnapshot, isDirty } = useDialogFormDirty(open, captureDialogState)

watch(
  () => [open.value, props.company.id, props.company.objectLabel] as const,
  async ([isOpen]) => {
    if (!isOpen) return
    resetForm()
    await commitSnapshot()
  },
)

function resetForm() {
  form.value = emptyOpportunityInput(props.company)
}

function handleStageSelect(stage: OpportunityStage) {
  applyOpportunityStageChange(form.value, stage)
}

function dismiss() {
  if (saving.value) return
  void requestCloseWithConfirm(() => {
    open.value = false
  }, isDirty.value)
}

useDialogKeyboardShortcuts(open, {
  onDismiss: dismiss,
  onSave: saveOpportunity,
  disabled: () => saving.value,
})

useDialogInitialFocus(open, formContainerRef, {
  disabled: () => saving.value,
})

async function saveOpportunity() {
  const input: OpportunityInput = {
    ...form.value,
    company: props.company,
    title: form.value.title.trim(),
    description: normalizeRichTextValue(form.value.description),
  }

  try {
    validateOpportunityInput(input)
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Please check the required fields.')
    return
  }

  saving.value = true
  try {
    await createOpportunity(input)
    toast.showSuccess('Opportunity created.')
    emit('saved')
    open.value = false
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Could not create opportunity.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="form-dialog-overlay"
      @click.self="dismiss"
    >
      <div
        class="form-dialog-panel form-dialog-panel-wide"
        role="dialog"
        aria-modal="true"
        aria-label="New opportunity"
      >
        <div class="form-dialog-header">
          <div>
            <h2 class="text-lg font-semibold text-stone-900">New opportunity</h2>
            <p class="mt-1 text-sm text-stone-600">
              Add an opportunity for {{ company.objectLabel }}.
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg p-1.5 text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
            aria-label="Close"
            :disabled="saving"
            @click="dismiss"
          >
            <FontAwesomeIcon icon="xmark" class="h-5 w-5" />
          </button>
        </div>

        <div class="form-dialog-body">
          <div ref="formContainerRef" class="form-dialog-body-inner">
            <div class="form-dialog-context">
              <p class="font-semibold text-stone-800">Company</p>
              <p class="mt-1">{{ company.objectLabel }}</p>
            </div>

            <OpportunityStageProgress
              embedded
              class="mb-4"
              :model-value="form.stage"
              :likelihood="form.likelihood"
              :loading="saving"
              @update:model-value="handleStageSelect"
            />

            <OpportunityForm
              v-model="form"
              form-id="opportunity-create-dialog-form"
              hide-company-field
              hide-stage-select
              dialog-layout
              @submit="saveOpportunity"
            />
          </div>
        </div>

        <div class="form-dialog-footer">
          <button
            type="button"
            class="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
            :disabled="saving"
            @click="dismiss"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="opportunity-create-dialog-form"
            class="rounded-lg bg-epms-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-epms-800 disabled:opacity-50"
            :disabled="saving"
          >
            {{ saving ? 'Saving…' : 'Create opportunity' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
