<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CompanyProductInUseForm from '@/components/CompanyProductInUseForm.vue'
import CompanySearchField from '@/components/CompanySearchField.vue'
import FormRequiredMark from '@/components/FormRequiredMark.vue'
import { useDialogFormDirty } from '@/composables/useDialogFormDirty'
import { useDialogKeyboardShortcuts } from '@/composables/useDialogKeyboardShortcuts'
import { useDialogInitialFocus } from '@/composables/useDialogInitialFocus'
import { useToast } from '@/composables/useToast'
import type { ObjectRef } from '@/lib/companies'
import {
  companyProductInUseInputFromRecord,
  createCompanyProductInUse,
  emptyCompanyProductInUseInput,
  loadCompanyProductInUse,
  updateCompanyProductInUse,
  validateCompanyProductInUseInput,
  type CompanyProductInUse,
  type CompanyProductInUseInput,
} from '@/lib/companyProductInUseRecords'
import { requestCloseWithConfirm } from '@/lib/confirmDiscard'
import { cloneSnapshotValue } from '@/lib/formSnapshot'

const open = defineModel<boolean>({ required: true })

const props = defineProps<{
  recordId?: string | null
  fixedCompany?: ObjectRef | null
}>()

const emit = defineEmits<{
  saved: [record: CompanyProductInUse]
}>()

const toast = useToast()
const formId = 'company-product-in-use-dialog-form'
const form = ref<CompanyProductInUseInput>(emptyCompanyProductInUseInput())
const companyRef = ref<ObjectRef | null>(null)
const loading = ref(false)
const saving = ref(false)
const formContainerRef = ref<HTMLElement | null>(null)

const isCreateMode = computed(() => !props.recordId)
const companyPickerVisible = computed(() => !props.fixedCompany && isCreateMode.value)
const dialogTitle = computed(() =>
  isCreateMode.value ? 'New product or service in use' : 'Edit product or service in use',
)

type DialogState = {
  companyId: string | null
  supplierCompanyId: string | null
  form: CompanyProductInUseInput
}

function captureDialogState(): DialogState {
  return {
    companyId: props.fixedCompany?.id ?? companyRef.value?.id ?? form.value.company?.id ?? null,
    supplierCompanyId: form.value.supplierCompany?.id ?? null,
    form: {
      ...form.value,
      name: form.value.name.trim(),
      description: form.value.description.trim(),
      version: form.value.version?.trim() || null,
      company: props.fixedCompany ?? companyRef.value ?? form.value.company,
      supplierCompany: form.value.supplierCompany,
    },
  }
}

const { commitSnapshot, isDirty } = useDialogFormDirty(open, captureDialogState)

watch(
  () => [open.value, props.recordId, props.fixedCompany?.id] as const,
  async ([isOpen, recordId]) => {
    if (!isOpen) return

    if (recordId) {
      loading.value = true
      try {
        const record = await loadCompanyProductInUse(recordId)
        resetForm(companyProductInUseInputFromRecord(record))
        companyRef.value = record.company
      } catch (error) {
        toast.showError(error instanceof Error ? error.message : 'Could not load record.')
        open.value = false
      } finally {
        loading.value = false
      }
      return
    }

    const company = props.fixedCompany ?? null
    companyRef.value = company
    resetForm(emptyCompanyProductInUseInput(company))
  },
)

function resetForm(nextForm: CompanyProductInUseInput) {
  form.value = cloneSnapshotValue(nextForm)
  void commitSnapshot()
}

function requestDismiss() {
  if (saving.value) return
  void requestCloseWithConfirm(() => {
    open.value = false
  }, isDirty.value)
}

useDialogKeyboardShortcuts(open, {
  onDismiss: requestDismiss,
  onSave: saveRecord,
  disabled: () => saving.value || loading.value,
})

useDialogInitialFocus(open, formContainerRef, {
  disabled: () => saving.value || loading.value,
})

async function saveRecord() {
  const company = props.fixedCompany ?? companyRef.value ?? form.value.company
  const input: CompanyProductInUseInput = {
    ...form.value,
    name: form.value.name.trim(),
    description: form.value.description.trim(),
    version: form.value.version?.trim() || null,
    company,
    supplierCompany: form.value.supplierCompany,
  }

  try {
    validateCompanyProductInUseInput(input)
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Please check the required fields.')
    return
  }

  saving.value = true
  try {
    const saved = isCreateMode.value
      ? await createCompanyProductInUse(input)
      : await updateCompanyProductInUse(props.recordId!, input)

    toast.showSuccess(isCreateMode.value ? 'Record created.' : 'Record saved.')
    emit('saved', saved)
    open.value = false
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Save failed.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="form-dialog-overlay" @click.self="requestDismiss">
      <div
        ref="formContainerRef"
        class="form-dialog-panel form-dialog-panel-medium"
        role="dialog"
        aria-modal="true"
        :aria-label="dialogTitle"
      >
        <div class="form-dialog-header">
          <div>
            <h2 class="text-lg font-semibold text-stone-900">{{ dialogTitle }}</h2>
            <p class="mt-1 text-sm text-stone-600">
              Record a product or service this company uses from another supplier.
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg p-1.5 text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
            aria-label="Close"
            :disabled="saving"
            @click="requestDismiss"
          >
            <FontAwesomeIcon icon="xmark" class="h-5 w-5" />
          </button>
        </div>

        <div class="form-dialog-body">
          <div v-if="loading" class="py-8 text-sm text-stone-500">Loading…</div>
          <div v-else class="form-dialog-body-inner space-y-5">
            <div v-if="companyPickerVisible">
              <p class="block text-sm font-semibold text-stone-800">
                Company<FormRequiredMark />
              </p>
              <CompanySearchField v-model="companyRef" placeholder="Search company…" />
            </div>

            <div v-else-if="fixedCompany" class="form-dialog-context">
              Company: <strong>{{ fixedCompany.objectLabel }}</strong>
            </div>

            <CompanyProductInUseForm v-model="form" :form-id="formId" @submit="saveRecord" />
          </div>
        </div>

        <div class="form-dialog-footer">
          <button
            type="button"
            class="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
            :disabled="saving"
            @click="requestDismiss"
          >
            Cancel
          </button>
          <button
            type="submit"
            :form="formId"
            class="rounded-lg bg-epms-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-epms-800 disabled:opacity-50"
            :disabled="saving || loading"
          >
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
