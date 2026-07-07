<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDialogFormDirty } from '@/composables/useDialogFormDirty'
import FormRequiredMark from '@/components/FormRequiredMark.vue'
import { useDialogKeyboardShortcuts } from '@/composables/useDialogKeyboardShortcuts'
import { useDialogInitialFocus } from '@/composables/useDialogInitialFocus'
import { useToast } from '@/composables/useToast'
import { requestCloseWithConfirm } from '@/lib/confirmDiscard'
import {
  createRfpMilestone,
  emptyRfpMilestoneInput,
  loadRfpMilestone,
  rfpMilestoneInputFromMilestone,
  updateRfpMilestone,
  type RfpMilestoneContext,
  type RfpMilestoneInput,
} from '@/lib/rfpMilestoneRecords'

const open = defineModel<boolean>({ required: true })

const props = defineProps<{
  milestoneId?: string | null
  fixedContext?: RfpMilestoneContext
}>()

const emit = defineEmits<{
  saved: []
}>()

const toast = useToast()

const form = ref<RfpMilestoneInput | null>(null)
const lockedContext = ref<RfpMilestoneContext | null>(null)
const formContainerRef = ref<HTMLElement | null>(null)
const loading = ref(false)
const saving = ref(false)

const isEditMode = computed(() => Boolean(props.milestoneId))
const dialogTitle = computed(() => (isEditMode.value ? 'Edit milestone' : 'New milestone'))

function captureDialogState(): RfpMilestoneInput | null {
  if (!form.value) return null

  return {
    ...form.value,
    title: form.value.title.trim(),
    startDt: form.value.startDt?.trim() || null,
    dueDt: form.value.dueDt?.trim() || null,
  }
}

const { commitSnapshot, isDirty } = useDialogFormDirty(open, captureDialogState)

watch(
  () => [open.value, props.milestoneId, props.fixedContext] as const,
  async ([isOpen, milestoneId, fixedContext]) => {
    if (!isOpen) return

    if (milestoneId) {
      loading.value = true
      try {
        const milestone = await loadRfpMilestone(milestoneId)
        form.value = rfpMilestoneInputFromMilestone(milestone)
        lockedContext.value = {
          company: milestone.company,
          opportunity: milestone.opportunity,
          rfp: milestone.rfp,
        }
        await commitSnapshot()
      } catch (error) {
        toast.showError(error instanceof Error ? error.message : 'Could not load milestone.')
        open.value = false
      } finally {
        loading.value = false
      }
      return
    }

    if (!fixedContext) {
      toast.showError('Milestone context is missing.')
      open.value = false
      return
    }

    lockedContext.value = fixedContext
    form.value = emptyRfpMilestoneInput(fixedContext)
    await commitSnapshot()
  },
)

function dismiss() {
  if (saving.value) return
  void requestCloseWithConfirm(() => {
    open.value = false
  }, isDirty.value)
}

useDialogKeyboardShortcuts(open, {
  onDismiss: dismiss,
  onSave: saveMilestone,
  disabled: () => saving.value || loading.value || !form.value,
})

useDialogInitialFocus(open, formContainerRef, {
  disabled: () => saving.value || loading.value || !form.value,
})

watch(open, (isOpen) => {
  if (!isOpen) {
    form.value = null
    lockedContext.value = null
  }
})

async function saveMilestone() {
  if (!form.value) return

  saving.value = true
  try {
    if (isEditMode.value && props.milestoneId) {
      await updateRfpMilestone(props.milestoneId, form.value)
      toast.showSuccess('Milestone saved.')
    } else {
      await createRfpMilestone(form.value)
      toast.showSuccess('Milestone added.')
    }

    emit('saved')
    open.value = false
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Could not save milestone.')
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
        class="form-dialog-panel form-dialog-panel-narrow"
        role="dialog"
        aria-modal="true"
        :aria-label="dialogTitle"
      >
        <div class="form-dialog-header">
          <h2 class="text-lg font-semibold text-stone-900">{{ dialogTitle }}</h2>
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
          <div v-if="loading" class="py-4 text-sm text-stone-500">Loading milestone…</div>
          <form v-else-if="form" ref="formContainerRef" class="form-dialog-body-inner" @submit.prevent="saveMilestone">
            <div
              v-if="lockedContext"
              class="mb-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700"
            >
              <p class="font-semibold text-stone-800">RFP</p>
              <p class="mt-1">{{ lockedContext.rfp.objectLabel }}</p>
              <p class="mt-2 font-semibold text-stone-800">Company</p>
              <p class="mt-1">{{ lockedContext.company.objectLabel }}</p>
            </div>

            <label class="block text-sm font-semibold text-stone-700">
              Title<FormRequiredMark />
              <input
                v-model="form.title"
                type="text"
                required
                aria-required="true"
                class="mt-1 w-full rounded-xl px-3 py-2.5 text-sm text-stone-900 field-focus"
                :disabled="saving"
              />
            </label>

            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <label class="block text-sm font-semibold text-stone-700">
                Start date
                <input
                  v-model="form.startDt"
                  type="date"
                  class="mt-1 w-full rounded-xl px-3 py-2.5 text-sm text-stone-900 field-focus"
                  :disabled="saving"
                />
              </label>
              <label class="block text-sm font-semibold text-stone-700">
                Due date
                <input
                  v-model="form.dueDt"
                  type="date"
                  class="mt-1 w-full rounded-xl px-3 py-2.5 text-sm text-stone-900 field-focus"
                  :disabled="saving"
                />
              </label>
            </div>

            <label class="mt-4 inline-flex items-center gap-2 text-sm font-normal text-stone-800">
              <input
                v-model="form.isCompleted"
                type="checkbox"
                :disabled="saving"
              />
              Completed
            </label>
          </form>
        </div>

        <div class="form-dialog-footer">
          <button
            type="button"
            class="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
            :disabled="saving || loading"
            @click="dismiss"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-lg bg-epms-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-epms-800 disabled:opacity-50"
            :disabled="saving || loading || !form"
            @click="saveMilestone"
          >
            {{ saving ? 'Saving…' : isEditMode ? 'Save' : 'Create milestone' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
