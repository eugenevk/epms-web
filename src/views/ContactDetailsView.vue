<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter, type RouteLocationNormalized } from 'vue-router'
import ContactForm from '@/components/ContactForm.vue'
import ContactPersonalHierarchy from '@/components/ContactPersonalHierarchy.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useDetailBackNavigation } from '@/composables/useDetailBackNavigation'
import { useRoutedDetailTab } from '@/composables/useRoutedDetailTab'
import { useToast } from '@/composables/useToast'
import {
  contactBackLabel,
  contactBackRoute,
  contactDetailsQuery,
  contactReturnCompanyId,
} from '@/lib/contactNavigation'
import { loadCompany } from '@/lib/companies'
import {
  contactInputFromContact,
  createContact,
  deleteContact,
  emptyContactInput,
  loadContact,
  updateContact,
  validateContactInput,
  type Contact,
  type ContactInput,
} from '@/lib/contactRecords'
import { contactDisplayName } from '@/lib/contactNames'
import { cloneSnapshotValue, isDirtySnapshot, snapshotOf } from '@/lib/formSnapshot'
import { preserveGridReturnQuery } from '@/lib/gridReturnNavigation'

const props = defineProps<{
  id?: string
}>()

type ContactTab = 'details' | 'reporting-lines'

function isContactTab(value: unknown): value is ContactTab {
  return value === 'details' || value === 'reporting-lines'
}

const route = useRoute()
const router = useRouter()
const toast = useToast()

const { activeTab, setActiveTab } = useRoutedDetailTab(isContactTab, 'details')

const contact = ref<Contact | null>(null)
const form = ref<ContactInput>(emptyContactInput())
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
  if (isCreateMode.value) return 'Create contact'
  return contact.value ? contactDisplayName(contact.value) : 'Contact details'
})

const isDirty = computed(
  () => editing.value && isDirtySnapshot(form.value, formSnapshot.value),
)

const returnCompanyId = computed(() => contactReturnCompanyId(route.query))
const { backLabel, backRoute, navigateBack } = useDetailBackNavigation(() => ({
  route: contactBackRoute(returnCompanyId.value),
  label: contactBackLabel(returnCompanyId.value),
}))

onMounted(async () => {
  if (!props.id) {
    await initializeCreateForm()
    return
  }

  try {
    contact.value = await loadContact(props.id)
    resetForm(contactInputFromContact(contact.value))
    editing.value = false
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Could not load contact.')
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
      contact.value = await loadContact(nextId)
      resetForm(contactInputFromContact(contact.value))
      editing.value = !prevId
    } catch (error) {
      toast.showError(error instanceof Error ? error.message : 'Could not load contact.')
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
    contactReturnCompanyId(route.query) ??
    (typeof route.query.companyId === 'string' ? route.query.companyId : null)

  if (companyId) {
    try {
      const company = await loadCompany(companyId)
      resetForm(
        emptyContactInput({
          id: company.id,
          objectLabel: company.name || company.objectLabel,
        }),
      )
      return
    } catch {
      toast.showError('Could not prefill company.')
    }
  }

  resetForm(emptyContactInput())
}

function resetForm(nextForm: ContactInput) {
  form.value = cloneSnapshotValue(nextForm)
  formSnapshot.value = snapshotOf(nextForm)
}

function discardFormState() {
  if (contact.value && !isCreateMode.value) {
    resetForm(contactInputFromContact(contact.value))
    editing.value = false
    return
  }

  resetForm(emptyContactInput())
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
  if (!contact.value) return
  resetForm(contactInputFromContact(contact.value))
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

async function saveContact() {
  try {
    validateContactInput(form.value)
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Please check the required fields.')
    return
  }

  saving.value = true

  try {
    if (isCreateMode.value) {
      const created = await createContact(form.value)
      toast.showSuccess('Contact created.')
      contact.value = created
      resetForm(contactInputFromContact(created))
      editing.value = true
      await router.replace({
        name: 'contact-details',
        params: { id: created.id },
        query: preserveGridReturnQuery(route.query, contactDetailsQuery(returnCompanyId.value)),
      })
      return
    }

    if (!props.id) return

    contact.value = await updateContact(props.id, form.value)
    resetForm(contactInputFromContact(contact.value))
    editing.value = false
    toast.showSuccess('Contact saved.')
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
    await deleteContact(props.id)
    toast.showSuccess('Contact deleted.')
    showDeleteDialog.value = false
    await router.replace(backRoute.value)
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Delete failed.')
  } finally {
    deleting.value = false
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
        <p v-if="contact?.company?.objectLabel" class="mt-1 text-sm text-stone-500">
          {{ contact.company.objectLabel }}
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
              form="contact-form"
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
            form="contact-form"
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
        Contact details
      </button>
      <button
        type="button"
        class="rounded-t-lg px-4 py-2.5 text-sm font-semibold transition"
        :class="activeTab === 'reporting-lines' ? 'border-b-2 border-epms-700 text-epms-900' : 'text-stone-500 hover:text-stone-700'"
        @click="setActiveTab('reporting-lines')"
      >
        Reporting lines
      </button>
    </div>

    <div class="mt-6 rounded-2xl border border-epms-200 bg-white p-6 shadow-sm">
      <p v-if="loading" class="text-sm text-stone-500">Loading contact…</p>

      <template v-else-if="isCreateMode || activeTab === 'details'">
        <p class="mb-6 text-sm font-semibold uppercase tracking-wide text-epms-700">
          {{ isCreateMode ? 'New contact' : editing ? 'Edit contact' : 'Contact profile' }}
        </p>
        <ContactForm
          v-model="form"
          :contact-id="props.id"
          :readonly="!editing"
          @submit="saveContact"
        />
      </template>

      <template v-else-if="activeTab === 'reporting-lines' && props.id">
        <ContactPersonalHierarchy :contact-id="props.id" />
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
      title="Delete contact?"
      message="This permanently deletes the contact and linked notes. This cannot be undone."
      confirm-label="Delete"
      destructive
      :loading="deleting"
      @confirm="confirmDelete"
    />
  </section>
</template>
