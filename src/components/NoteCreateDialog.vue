<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CompanySearchField from '@/components/CompanySearchField.vue'
import FormRequiredMark from '@/components/FormRequiredMark.vue'
import OpportunitySearchField from '@/components/OpportunitySearchField.vue'
import RfpSearchField from '@/components/RfpSearchField.vue'
import RichTextField from '@/components/RichTextField.vue'
import { useDialogFormDirty } from '@/composables/useDialogFormDirty'
import { useDialogKeyboardShortcuts } from '@/composables/useDialogKeyboardShortcuts'
import { useDialogInitialFocus } from '@/composables/useDialogInitialFocus'
import { useToast } from '@/composables/useToast'
import type { ObjectRef } from '@/lib/companies'
import { requestCloseWithConfirm } from '@/lib/confirmDiscard'
import { normalizeRichTextValue } from '@/lib/formSnapshot'
import { loadOpportunity } from '@/lib/opportunityRecords'
import {
  createNote,
  emptyNoteInput,
  loadNote,
  noteInputFromNote,
  updateNote,
  type NoteInput,
  type NoteLinkedObject,
} from '@/lib/noteRecords'
import { loadRfp } from '@/lib/rfpRecords'
import { isEmptyRichText } from '@/lib/richText'

const open = defineModel<boolean>({ required: true })

const props = defineProps<{
  noteId?: string | null
  fixedLinkedObject?: NoteLinkedObject
}>()

const emit = defineEmits<{
  created: []
  saved: []
}>()

const toast = useToast()

type LinkType = NoteLinkedObject['type']

const linkType = ref<LinkType>('Company')
const companyRef = ref<ObjectRef | null>(null)
const opportunityRef = ref<ObjectRef | null>(null)
const rfpRef = ref<ObjectRef | null>(null)
const derivedCompany = ref<ObjectRef | null>(null)
const derivedOpportunity = ref<ObjectRef | null>(null)
const resolvingContext = ref(false)
const form = ref<NoteInput>(emptyNoteInput())
const loading = ref(false)
const saving = ref(false)
const lockedLinkedObject = ref<NoteLinkedObject | null>(null)
const formContainerRef = ref<HTMLElement | null>(null)

type NoteDialogState = {
  linkType: LinkType
  companyId: string | null
  opportunityId: string | null
  rfpId: string | null
  form: NoteInput
}

function captureDialogState(): NoteDialogState {
  const state: NoteDialogState = {
    linkType: linkType.value,
    companyId: companyRef.value?.id ?? null,
    opportunityId: opportunityRef.value?.id ?? null,
    rfpId: rfpRef.value?.id ?? null,
    form: {
      noteDt: form.value.noteDt.trim(),
      note: normalizeRichTextValue(form.value.note),
    },
  }

  if (props.fixedLinkedObject || props.noteId) {
    return {
      linkType: state.linkType,
      companyId: null,
      opportunityId: null,
      rfpId: null,
      form: state.form,
    }
  }

  return state
}

const { commitSnapshot, isDirty } = useDialogFormDirty(open, captureDialogState)

const isEditMode = computed(() => Boolean(props.noteId))
const linkPickerVisible = computed(() => !props.fixedLinkedObject && !isEditMode.value)
const dialogTitle = computed(() => (isEditMode.value ? 'Edit note' : 'New note'))

const selectedLinkedObject = computed<NoteLinkedObject | null>(() => {
  if (lockedLinkedObject.value) return lockedLinkedObject.value

  if (linkType.value === 'Company' && companyRef.value) {
    return {
      collection: 'companies',
      id: companyRef.value.id,
      type: 'Company',
      objectLabel: companyRef.value.objectLabel,
    }
  }
  if (linkType.value === 'Opportunity' && opportunityRef.value) {
    return {
      collection: 'opportunities',
      id: opportunityRef.value.id,
      type: 'Opportunity',
      objectLabel: opportunityRef.value.objectLabel,
    }
  }
  if (linkType.value === 'Rfp' && rfpRef.value) {
    return {
      collection: 'rfps',
      id: rfpRef.value.id,
      type: 'Rfp',
      objectLabel: rfpRef.value.objectLabel,
    }
  }
  return null
})

watch(
  () => [open.value, props.noteId, props.fixedLinkedObject] as const,
  async ([isOpen, noteId, fixedLinkedObject]) => {
    if (!isOpen) return

    if (noteId) {
      loading.value = true
      try {
        const note = await loadNote(noteId)
        form.value = noteInputFromNote(note)
        lockedLinkedObject.value = note.linkedObject
        applyLinkedObject(note.linkedObject, true)
        await commitSnapshot()
      } catch (error) {
        toast.showError(error instanceof Error ? error.message : 'Could not load note.')
        open.value = false
      } finally {
        loading.value = false
      }
      return
    }

    resetForm()
    if (fixedLinkedObject) {
      lockedLinkedObject.value = fixedLinkedObject
      applyLinkedObject(fixedLinkedObject, true)
    }
    await commitSnapshot()
  },
)

watch(linkType, () => {
  if (lockedLinkedObject.value) return
  companyRef.value = null
  opportunityRef.value = null
  rfpRef.value = null
  derivedCompany.value = null
  derivedOpportunity.value = null
})

watch(opportunityRef, (value) => {
  derivedCompany.value = null
  derivedOpportunity.value = null
  if (linkType.value !== 'Opportunity' || !value?.id) return
  void resolveOpportunityContext(value.id)
})

watch(rfpRef, (value) => {
  derivedCompany.value = null
  derivedOpportunity.value = null
  if (linkType.value !== 'Rfp' || !value?.id) return
  void resolveRfpContext(value.id)
})

function applyLinkedObject(linkedObject: NoteLinkedObject, readonly = false) {
  const type = linkedObject.type
  if (type !== 'Company' && type !== 'Opportunity' && type !== 'Rfp') return

  linkType.value = type
  const objectRef = { id: linkedObject.id, objectLabel: linkedObject.objectLabel }

  companyRef.value = null
  opportunityRef.value = null
  rfpRef.value = null
  derivedCompany.value = null
  derivedOpportunity.value = null

  if (type === 'Company') {
    companyRef.value = objectRef
    return
  }

  if (type === 'Opportunity') {
    opportunityRef.value = objectRef
    if (!readonly) void resolveOpportunityContext(linkedObject.id)
    return
  }

  rfpRef.value = objectRef
  if (!readonly) void resolveRfpContext(linkedObject.id)
}

async function resolveOpportunityContext(opportunityId: string) {
  resolvingContext.value = true
  try {
    const opportunity = await loadOpportunity(opportunityId)
    derivedCompany.value = opportunity.company
  } catch {
    derivedCompany.value = null
    toast.showError('Could not determine the company for this opportunity.')
  } finally {
    resolvingContext.value = false
  }
}

async function resolveRfpContext(rfpId: string) {
  resolvingContext.value = true
  try {
    const rfp = await loadRfp(rfpId)
    derivedCompany.value = rfp.company
    derivedOpportunity.value = rfp.opportunity
  } catch {
    derivedCompany.value = null
    derivedOpportunity.value = null
    toast.showError('Could not determine the company and opportunity for this RFP.')
  } finally {
    resolvingContext.value = false
  }
}

function resetForm() {
  linkType.value = 'Company'
  companyRef.value = null
  opportunityRef.value = null
  rfpRef.value = null
  derivedCompany.value = null
  derivedOpportunity.value = null
  resolvingContext.value = false
  lockedLinkedObject.value = null
  form.value = emptyNoteInput()
}

function dismiss() {
  if (saving.value) return
  void requestCloseWithConfirm(() => {
    open.value = false
  }, isDirty.value)
}

useDialogKeyboardShortcuts(open, {
  onDismiss: dismiss,
  onSave: saveNote,
  disabled: () => saving.value || loading.value,
})

useDialogInitialFocus(open, formContainerRef, {
  disabled: () => saving.value || loading.value,
})

async function saveNote() {
  if (!selectedLinkedObject.value) {
    toast.showError('Select a record to link this note to.')
    return
  }
  if (!form.value.noteDt.trim()) {
    toast.showError('Note date is required.')
    return
  }
  if (isEmptyRichText(form.value.note)) {
    toast.showError('Note text is required.')
    return
  }

  saving.value = true
  try {
    if (isEditMode.value && props.noteId) {
      await updateNote(props.noteId, form.value)
      toast.showSuccess('Note saved.')
    } else {
      await createNote({
        ...form.value,
        linkedObject: selectedLinkedObject.value,
      })
      toast.showSuccess('Note created.')
      emit('created')
    }

    emit('saved')
    open.value = false
  } catch (saveError) {
    toast.showError(saveError instanceof Error ? saveError.message : 'Could not save note.')
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
        class="form-dialog-panel form-dialog-panel-medium"
        role="dialog"
        aria-modal="true"
        :aria-label="dialogTitle"
      >
        <div class="form-dialog-header">
          <div>
            <h2 class="text-lg font-semibold text-stone-900">{{ dialogTitle }}</h2>
            <p class="mt-1 text-sm text-stone-600">
              {{
                linkPickerVisible
                  ? 'Link the note to a company, opportunity, or RFP.'
                  : 'Update the note date and text.'
              }}
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
          <div v-if="loading" class="py-8 text-sm text-stone-500">Loading note…</div>
          <div v-else ref="formContainerRef" class="form-dialog-body-inner space-y-4">
            <template v-if="linkPickerVisible">
              <fieldset>
                <legend class="text-sm font-semibold text-stone-800">Link to</legend>
                <div class="mt-2 flex flex-wrap gap-2">
                  <label
                    v-for="option in (['Company', 'Opportunity', 'Rfp'] as const)"
                    :key="option"
                    class="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition"
                    :class="
                      linkType === option
                        ? 'border-epms-600 bg-epms-50 text-epms-900'
                        : 'border-stone-300 text-stone-700 hover:bg-stone-50'
                    "
                  >
                    <input
                      v-model="linkType"
                      type="radio"
                      class="text-epms-700 focus:ring-epms-600"
                      :value="option"
                      :disabled="saving"
                    />
                    {{ option }}
                  </label>
                </div>
              </fieldset>

              <CompanySearchField v-if="linkType === 'Company'" v-model="companyRef" />

              <template v-else-if="linkType === 'Opportunity'">
                <OpportunitySearchField v-model="opportunityRef" />
                <p v-if="resolvingContext" class="text-sm text-stone-500">Determining company…</p>
                <CompanySearchField
                  v-else-if="derivedCompany"
                  v-model="derivedCompany"
                  readonly
                  label="Company"
                />
              </template>

              <template v-else>
                <RfpSearchField v-model="rfpRef" />
                <p v-if="resolvingContext" class="text-sm text-stone-500">Determining company and opportunity…</p>
                <template v-else-if="derivedCompany">
                  <CompanySearchField v-model="derivedCompany" readonly label="Company" />
                  <OpportunitySearchField
                    v-if="derivedOpportunity"
                    v-model="derivedOpportunity"
                    readonly
                    label="Opportunity"
                  />
                  <p v-else class="text-sm text-stone-500">No opportunity linked to this RFP.</p>
                </template>
              </template>
            </template>

            <div v-else-if="lockedLinkedObject" class="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
              <p class="font-semibold text-stone-800">Linked to</p>
              <p class="mt-1">
                {{ lockedLinkedObject.type }} · {{ lockedLinkedObject.objectLabel }}
              </p>
            </div>

            <label class="block w-48 text-sm font-semibold text-stone-700">
              Note date<FormRequiredMark />
              <input
                v-model="form.noteDt"
                type="date"
                required
                aria-required="true"
                class="mt-1 w-full rounded-xl px-3 py-2.5 text-sm font-normal text-stone-900 field-focus"
                :disabled="saving"
              />
            </label>

            <div>
              <p class="text-sm font-semibold text-stone-700">Note<FormRequiredMark /></p>
              <RichTextField
                v-model="form.note"
                placeholder="Write a note…"
                class="mt-1"
                :min-height="160"
                :readonly="saving"
                @escape="dismiss"
              />
            </div>
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
            type="button"
            class="rounded-lg bg-epms-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-epms-800 disabled:opacity-50"
            :disabled="saving || loading"
            @click="saveNote"
          >
            {{ saving ? 'Saving…' : isEditMode ? 'Save' : 'Create note' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
