<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ContactForm from '@/components/ContactForm.vue'
import { useDialogFormDirty } from '@/composables/useDialogFormDirty'
import { useDialogKeyboardShortcuts } from '@/composables/useDialogKeyboardShortcuts'
import { useDialogInitialFocus } from '@/composables/useDialogInitialFocus'
import { useToast } from '@/composables/useToast'
import type { ObjectRef } from '@/lib/companies'
import { requestCloseWithConfirm } from '@/lib/confirmDiscard'
import {
  contactInputFromContact,
  createContact,
  emptyContactInput,
  loadContact,
  updateContact,
  validateContactInput,
  type ContactInput,
} from '@/lib/contactRecords'
import { normalizeRichTextValue } from '@/lib/formSnapshot'

const open = defineModel<boolean>({ required: true })

const props = defineProps<{
  company: ObjectRef
  contactId?: string | null
}>()

const emit = defineEmits<{
  saved: []
}>()

const toast = useToast()

const form = ref<ContactInput>(emptyContactInput())
const loading = ref(false)
const saving = ref(false)
const formContainerRef = ref<HTMLElement | null>(null)

const isEditMode = computed(() => Boolean(props.contactId))
const dialogTitle = computed(() => (isEditMode.value ? 'Edit contact' : 'New contact'))
const saveLabel = computed(() => {
  if (saving.value) return 'Saving…'
  return isEditMode.value ? 'Save changes' : 'Create contact'
})
const formId = computed(() =>
  isEditMode.value ? 'contact-edit-dialog-form' : 'contact-create-dialog-form',
)

type ContactDialogState = {
  form: ContactInput
}

function captureDialogState(): ContactDialogState {
  return {
    form: {
      ...form.value,
      company: props.company,
      lastName: form.value.lastName.trim(),
      notes: normalizeRichTextValue(form.value.notes),
    },
  }
}

const { commitSnapshot, isDirty } = useDialogFormDirty(open, captureDialogState)

watch(
  () => [open.value, props.company.id, props.company.objectLabel, props.contactId] as const,
  async ([isOpen, , , contactId]) => {
    if (!isOpen) return

    if (contactId) {
      loading.value = true
      try {
        const contact = await loadContact(contactId)
        form.value = contactInputFromContact(contact)
        await commitSnapshot()
      } catch (error) {
        toast.showError(error instanceof Error ? error.message : 'Could not load contact.')
        open.value = false
      } finally {
        loading.value = false
      }
      return
    }

    resetForm()
    await commitSnapshot()
  },
)

function resetForm() {
  form.value = emptyContactInput(props.company)
}

function dismiss() {
  if (saving.value || loading.value) return
  void requestCloseWithConfirm(() => {
    open.value = false
  }, isDirty.value)
}

useDialogKeyboardShortcuts(open, {
  onDismiss: dismiss,
  onSave: saveContact,
  disabled: () => saving.value || loading.value,
})

useDialogInitialFocus(open, formContainerRef, {
  disabled: () => saving.value || loading.value,
})

async function saveContact() {
  const input: ContactInput = {
    ...form.value,
    company: props.company,
    lastName: form.value.lastName.trim(),
    notes: normalizeRichTextValue(form.value.notes),
  }

  try {
    validateContactInput(input)
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Please check the required fields.')
    return
  }

  saving.value = true
  try {
    if (isEditMode.value && props.contactId) {
      await updateContact(props.contactId, input)
      toast.showSuccess('Contact updated.')
    } else {
      await createContact(input)
      toast.showSuccess('Contact created.')
    }
    emit('saved')
    open.value = false
  } catch (error) {
    toast.showError(
      error instanceof Error
        ? error.message
        : isEditMode.value
          ? 'Could not update contact.'
          : 'Could not create contact.',
    )
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
        :aria-label="dialogTitle"
      >
        <div class="form-dialog-header">
          <div>
            <h2 class="text-lg font-semibold text-stone-900">{{ dialogTitle }}</h2>
            <p class="mt-1 text-sm text-stone-600">
              <template v-if="isEditMode">
                Update contact details for {{ company.objectLabel }}.
              </template>
              <template v-else>
                Add a contact for {{ company.objectLabel }}.
              </template>
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg p-1.5 text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
            aria-label="Close"
            :disabled="saving || loading"
            @click="dismiss"
          >
            <FontAwesomeIcon icon="xmark" class="h-5 w-5" />
          </button>
        </div>

        <div class="form-dialog-body">
          <div ref="formContainerRef" class="form-dialog-body-inner">
            <div v-if="loading" class="py-8 text-sm text-stone-500">Loading contact…</div>
            <template v-else>
              <div class="form-dialog-context">
                <p class="font-semibold text-stone-800">Company</p>
                <p class="mt-1">{{ company.objectLabel }}</p>
              </div>

              <ContactForm
                v-model="form"
                :form-id="formId"
                :contact-id="contactId"
                hide-company-field
                dialog-layout
                @submit="saveContact"
              />
            </template>
          </div>
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
            type="submit"
            :form="formId"
            class="rounded-lg bg-epms-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-epms-800 disabled:opacity-50"
            :disabled="saving || loading"
          >
            {{ saveLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
