<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter, type RouteLocationNormalized } from 'vue-router'
import CompanyForm from '@/components/CompanyForm.vue'
import CompanyContactsGrid from '@/components/CompanyContactsGrid.vue'
import CompanyContactHierarchy from '@/components/CompanyContactHierarchy.vue'
import CompanyNotesGrid from '@/components/CompanyNotesGrid.vue'
import CompanyOfferingsGrid from '@/components/CompanyOfferingsGrid.vue'
import CompanyProductsInUseGrid from '@/components/CompanyProductsInUseGrid.vue'
import CompanyTasksGrid from '@/components/CompanyTasksGrid.vue'
import CompanyOpportunitiesGrid from '@/components/CompanyOpportunitiesGrid.vue'
import CompanyPinboard from '@/components/CompanyPinboard.vue'
import CompanyRfpsGrid from '@/components/CompanyRfpsGrid.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useDetailBackNavigation } from '@/composables/useDetailBackNavigation'
import { useRoutedDetailTab } from '@/composables/useRoutedDetailTab'
import { useToast } from '@/composables/useToast'
import { uploadCompanyLogo } from '@/lib/companyLogo'
import {
  companyInputFromCompany,
  createCompany,
  deleteCompany,
  emptyCompanyInput,
  loadCompany,
  updateCompany,
  validateCompanyInput,
  type Company,
  type CompanyInput,
} from '@/lib/companies'
import {
  countContactsWithReportsInto,
  mapContactHitToHierarchyContact,
} from '@/lib/contactHierarchy'
import { loadCompanyContactsFromFirestore } from '@/lib/contacts'
import { cloneSnapshotValue, isDirtySnapshot, snapshotOf } from '@/lib/formSnapshot'
import { preserveGridReturnQuery } from '@/lib/gridReturnNavigation'
import { countPinboardItems, loadCompanyPinboardDocument } from '@/lib/companyPinboard'

const props = defineProps<{
  id?: string
}>()

const route = useRoute()
const router = useRouter()
const toast = useToast()

type CompanyTab =
  | 'details'
  | 'contacts'
  | 'org-chart'
  | 'opportunities'
  | 'rfps'
  | 'notes'
  | 'tasks'
  | 'products-services'
  | 'pinboard'
  | 'related'

function isCompanyTab(value: unknown): value is CompanyTab {
  return (
    value === 'details' ||
    value === 'contacts' ||
    value === 'org-chart' ||
    value === 'opportunities' ||
    value === 'rfps' ||
    value === 'notes' ||
    value === 'tasks' ||
    value === 'products-services' ||
    value === 'pinboard' ||
    value === 'related'
  )
}

const { activeTab, setActiveTab } = useRoutedDetailTab(isCompanyTab, 'details')

const company = ref<Company | null>(null)
const form = ref<CompanyInput>(emptyCompanyInput())
const formSnapshot = ref<string | null>(null)
const previousName = ref('')

const loading = ref(Boolean(props.id))
const saving = ref(false)
const deleting = ref(false)
const editing = ref(!props.id)

const showDiscardDialog = ref(false)
const showDeleteDialog = ref(false)
const pendingLogoFile = ref<File | null>(null)
const reportingLinesCount = ref(0)
const pinboardItemCount = ref(0)

type DiscardAction =
  | { type: 'cancel-edit' }
  | { type: 'navigate'; run: () => unknown | Promise<unknown> }
  | { type: 'route-leave'; to: RouteLocationNormalized }

const pendingDiscardAction = ref<DiscardAction | null>(null)

const isCreateMode = computed(() => !props.id)
const pageTitle = computed(() => {
  if (isCreateMode.value) return 'Create company'
  return company.value?.name || 'Company details'
})

const isDirty = computed(
  () =>
    editing.value &&
    (isDirtySnapshot(form.value, formSnapshot.value) || pendingLogoFile.value !== null),
)

const relatedCounts = computed(() => ({
  contacts: company.value?.numOfContacts ?? 0,
  opportunities: company.value?.numOfOpportunities ?? 0,
  rfps: company.value?.numOfRfps ?? 0,
  products: company.value?.numOfProducts ?? 0,
  productsInUse: company.value?.numOfProductsInUse ?? 0,
  notes: company.value?.numOfNotes ?? 0,
  tasks: company.value?.numOfUncompletedTasks ?? 0,
}))

const productsServicesCount = computed(
  () => relatedCounts.value.products + relatedCounts.value.productsInUse,
)

const { backLabel, backRoute, navigateBack: navigateToList } = useDetailBackNavigation(() => ({
  route: { name: 'companies' },
  label: 'Back to companies',
}))

onMounted(async () => {
  if (!props.id) {
    resetForm(emptyCompanyInput())
    return
  }

  try {
    company.value = await loadCompany(props.id)
    previousName.value = company.value.name
    resetForm(companyInputFromCompany(company.value))
    editing.value = false
    await reloadReportingLinesCount()
    await reloadPinboardItemCount()
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Could not load company.')
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
      company.value = await loadCompany(nextId)
      previousName.value = company.value.name
      resetForm(companyInputFromCompany(company.value))
      editing.value = !prevId
    } catch (error) {
      toast.showError(error instanceof Error ? error.message : 'Could not load company.')
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

function resetForm(nextForm: CompanyInput) {
  form.value = cloneSnapshotValue(nextForm)
  formSnapshot.value = snapshotOf(nextForm)
}

function discardFormState() {
  pendingLogoFile.value = null

  if (company.value && !isCreateMode.value) {
    resetForm(companyInputFromCompany(company.value))
    editing.value = false
    return
  }

  resetForm(emptyCompanyInput())
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
  if (!company.value) return
  resetForm(companyInputFromCompany(company.value))
  editing.value = true
}

function cancelEditing() {
  if (isCreateMode.value) {
    requestDiscard({ type: 'navigate', run: () => navigateToList() })
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

function handlePendingLogo(file: File | null) {
  pendingLogoFile.value = file
}

function handleLogoError(message: string) {
  toast.showError(message)
}

async function saveCompany() {
  try {
    validateCompanyInput(form.value)
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Company name is required.')
    return
  }

  saving.value = true

  try {
    if (isCreateMode.value) {
      const created = await createCompany(form.value)

      if (pendingLogoFile.value) {
        const logo = await uploadCompanyLogo(created.id, pendingLogoFile.value)
        created.logoUrl = logo.logoUrl
        created.logoPath = logo.logoPath
        pendingLogoFile.value = null
      }

      toast.showSuccess('Company created.')
      company.value = created
      previousName.value = created.name
      resetForm(companyInputFromCompany(created))
      editing.value = true
      await router.replace({
        name: 'company-details',
        params: { id: created.id },
        query: preserveGridReturnQuery(route.query),
      })
      return
    }

    if (!props.id) return

    company.value = await updateCompany(props.id, form.value, previousName.value)
    previousName.value = company.value.name
    resetForm(companyInputFromCompany(company.value))
    editing.value = false
    toast.showSuccess('Company saved.')
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
    await deleteCompany(props.id)
    toast.showSuccess('Company deleted.')
    showDeleteDialog.value = false
    await router.replace(backRoute.value)
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Delete failed.')
  } finally {
    deleting.value = false
  }
}

async function reloadCompanyCounts() {
  if (!props.id) return

  try {
    company.value = await loadCompany(props.id)
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Could not refresh company.')
  }
}

async function reloadReportingLinesCount() {
  if (!props.id) return

  try {
    const hits = await loadCompanyContactsFromFirestore(props.id)
    reportingLinesCount.value = countContactsWithReportsInto(
      hits.map(mapContactHitToHierarchyContact),
    )
  } catch {
    reportingLinesCount.value = 0
  }
}

async function reloadPinboardItemCount() {
  if (!props.id) {
    pinboardItemCount.value = 0
    return
  }

  try {
    const document = await loadCompanyPinboardDocument(props.id)
    pinboardItemCount.value = countPinboardItems(document)
  } catch {
    pinboardItemCount.value = 0
  }
}

async function handleContactsChanged() {
  await reloadCompanyCounts()
  await reloadReportingLinesCount()
}
</script>

<template>
  <section class="w-full">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <button
          type="button"
          class="mb-3 inline-flex items-center text-sm font-medium text-epms-800 transition hover:text-epms-950"
          @click="requestDiscard({ type: 'navigate', run: () => navigateToList() })"
        >
          ← {{ backLabel }}
        </button>
        <h1 class="text-2xl font-bold text-epms-900">{{ pageTitle }}</h1>
        <p v-if="company?.companyNo" class="mt-1 text-sm text-stone-500">
          Company no. {{ company.companyNo }}
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
              form="company-form"
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
            form="company-form"
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
        Company details
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition"
        :class="activeTab === 'contacts' ? 'border-b-2 border-epms-700 text-epms-900' : 'text-stone-500 hover:text-stone-700'"
        @click="setActiveTab('contacts')"
      >
        Contacts
        <span
          v-if="relatedCounts.contacts > 0"
          class="rounded-full bg-epms-100 px-2 py-0.5 text-xs font-semibold text-epms-800"
        >
          {{ relatedCounts.contacts }}
        </span>
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition"
        :class="activeTab === 'org-chart' ? 'border-b-2 border-epms-700 text-epms-900' : 'text-stone-500 hover:text-stone-700'"
        @click="setActiveTab('org-chart')"
      >
        Reporting lines
        <span
          v-if="reportingLinesCount > 0"
          class="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800"
        >
          {{ reportingLinesCount }}
        </span>
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition"
        :class="activeTab === 'opportunities' ? 'border-b-2 border-epms-700 text-epms-900' : 'text-stone-500 hover:text-stone-700'"
        @click="setActiveTab('opportunities')"
      >
        Opportunities
        <span
          v-if="relatedCounts.opportunities > 0"
          class="rounded-full bg-epms-100 px-2 py-0.5 text-xs font-semibold text-epms-800"
        >
          {{ relatedCounts.opportunities }}
        </span>
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition"
        :class="activeTab === 'rfps' ? 'border-b-2 border-epms-700 text-epms-900' : 'text-stone-500 hover:text-stone-700'"
        @click="setActiveTab('rfps')"
      >
        RFPs
        <span
          v-if="relatedCounts.rfps > 0"
          class="rounded-full bg-epms-100 px-2 py-0.5 text-xs font-semibold text-epms-800"
        >
          {{ relatedCounts.rfps }}
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
          v-if="relatedCounts.notes > 0"
          class="rounded-full bg-epms-100 px-2 py-0.5 text-xs font-semibold text-epms-800"
        >
          {{ relatedCounts.notes }}
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
          v-if="relatedCounts.tasks > 0"
          class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800"
        >
          {{ relatedCounts.tasks }}
        </span>
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition"
        :class="activeTab === 'products-services' ? 'border-b-2 border-epms-700 text-epms-900' : 'text-stone-500 hover:text-stone-700'"
        @click="setActiveTab('products-services')"
      >
        Products & Services
        <span
          v-if="productsServicesCount > 0"
          class="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-800"
        >
          {{ productsServicesCount }}
        </span>
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition"
        :class="activeTab === 'pinboard' ? 'border-b-2 border-epms-700 text-epms-900' : 'text-stone-500 hover:text-stone-700'"
        @click="setActiveTab('pinboard')"
      >
        Pinboard
        <span
          v-if="pinboardItemCount > 0"
          class="rounded-full bg-epms-100 px-2 py-0.5 text-xs font-semibold text-epms-800"
        >
          {{ pinboardItemCount }}
        </span>
      </button>
      <button
        type="button"
        class="rounded-t-lg px-4 py-2.5 text-sm font-semibold transition"
        :class="activeTab === 'related' ? 'border-b-2 border-epms-700 text-epms-900' : 'text-stone-500 hover:text-stone-700'"
        @click="setActiveTab('related')"
      >
        Related records
      </button>
    </div>

    <div class="mt-6 rounded-2xl border border-epms-200 bg-white p-6 shadow-sm">
      <p v-if="loading" class="text-sm text-stone-500">Loading company…</p>

      <template v-else-if="activeTab === 'details' || isCreateMode">
        <p class="mb-6 text-sm font-semibold uppercase tracking-wide text-epms-700">
          {{ isCreateMode ? 'New company' : editing ? 'Edit company' : 'Company profile' }}
        </p>
        <CompanyForm
          v-model="form"
          :company-id="props.id"
          :readonly="!editing"
          @submit="saveCompany"
          @pending-logo="handlePendingLogo"
          @logo-error="handleLogoError"
        />
      </template>

      <template v-else-if="activeTab === 'contacts' && props.id">
        <CompanyContactsGrid
          :company-id="props.id"
          :company-label="company?.name ?? company?.objectLabel ?? ''"
          @contacts-changed="handleContactsChanged"
        />
      </template>

      <template v-else-if="activeTab === 'org-chart' && props.id">
        <CompanyContactHierarchy
          :company-id="props.id"
          @loaded="reportingLinesCount = $event"
        />
      </template>

      <template v-else-if="activeTab === 'opportunities' && props.id">
        <CompanyOpportunitiesGrid
          :company-id="props.id"
          :company-label="company?.name ?? company?.objectLabel ?? ''"
          @opportunities-changed="reloadCompanyCounts"
        />
      </template>

      <template v-else-if="activeTab === 'rfps' && props.id">
        <CompanyRfpsGrid
          :company-id="props.id"
          :company-label="company?.name ?? company?.objectLabel ?? ''"
        />
      </template>

      <template v-else-if="activeTab === 'notes' && props.id">
        <CompanyNotesGrid
          :linked-object="{
            id: props.id,
            label: company?.name ?? company?.objectLabel ?? '',
            collection: 'companies',
            type: 'Company',
          }"
          @notes-changed="reloadCompanyCounts"
        />
      </template>

      <template v-else-if="activeTab === 'tasks' && props.id">
        <CompanyTasksGrid
          :linked-object="{
            id: props.id,
            label: company?.name ?? company?.objectLabel ?? '',
            collection: 'companies',
            type: 'Company',
          }"
          @tasks-changed="reloadCompanyCounts"
        />
      </template>

      <template v-else-if="activeTab === 'products-services' && props.id">
        <CompanyOfferingsGrid
          :company-id="props.id"
          :company-label="company?.name ?? company?.objectLabel ?? ''"
          @changed="reloadCompanyCounts"
        />
        <CompanyProductsInUseGrid
          :company-id="props.id"
          :company-label="company?.name ?? company?.objectLabel ?? ''"
          @changed="reloadCompanyCounts"
        />
      </template>

      <template v-else-if="activeTab === 'pinboard' && props.id">
        <CompanyPinboard
          :company-id="props.id"
          :editable="editing"
          @changed="pinboardItemCount = $event"
        />
      </template>

      <template v-else-if="activeTab === 'related'">
        <p class="text-sm font-semibold uppercase tracking-wide text-epms-700">Related records</p>
        <p class="mt-2 text-sm text-stone-600">
          Summary counts for linked records. Manage products and services on the Products & Services tab.
        </p>

        <dl class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div class="rounded-xl border border-stone-200 px-4 py-3">
            <dt class="text-xs font-semibold uppercase tracking-wide text-stone-500">Contacts</dt>
            <dd class="mt-1 text-2xl font-bold text-epms-900">{{ relatedCounts.contacts }}</dd>
          </div>
          <div class="rounded-xl border border-stone-200 px-4 py-3">
            <dt class="text-xs font-semibold uppercase tracking-wide text-stone-500">Opportunities</dt>
            <dd class="mt-1 text-2xl font-bold text-epms-900">{{ relatedCounts.opportunities }}</dd>
          </div>
          <div class="rounded-xl border border-stone-200 px-4 py-3">
            <dt class="text-xs font-semibold uppercase tracking-wide text-stone-500">RFPs</dt>
            <dd class="mt-1 text-2xl font-bold text-epms-900">{{ relatedCounts.rfps }}</dd>
          </div>
          <div class="rounded-xl border border-stone-200 px-4 py-3">
            <dt class="text-xs font-semibold uppercase tracking-wide text-stone-500">Offerings</dt>
            <dd class="mt-1 text-2xl font-bold text-epms-900">{{ relatedCounts.products }}</dd>
          </div>
          <div class="rounded-xl border border-stone-200 px-4 py-3">
            <dt class="text-xs font-semibold uppercase tracking-wide text-stone-500">Products in use</dt>
            <dd class="mt-1 text-2xl font-bold text-epms-900">{{ relatedCounts.productsInUse }}</dd>
          </div>
          <div class="rounded-xl border border-stone-200 px-4 py-3">
            <dt class="text-xs font-semibold uppercase tracking-wide text-stone-500">Notes</dt>
            <dd class="mt-1 text-2xl font-bold text-epms-900">{{ relatedCounts.notes }}</dd>
          </div>
          <div class="rounded-xl border border-stone-200 px-4 py-3">
            <dt class="text-xs font-semibold uppercase tracking-wide text-stone-500">Open tasks</dt>
            <dd class="mt-1 text-2xl font-bold text-epms-900">{{ relatedCounts.tasks }}</dd>
          </div>
        </dl>
      </template>
    </div>

    <ConfirmDialog
      v-model="showDiscardDialog"
      title="Discard changes?"
      message="Unsaved changes will be lost. Do you want to continue?"
      confirm-label="Discard"
      cancel-label="Keep editing"
      destructive
      @confirm="applyDiscard"
      @cancel="dismissDiscardDialog"
    />

    <ConfirmDialog
      v-model="showDeleteDialog"
      title="Delete company"
      message="This company and all associated contacts, opportunities, RFPs, tasks, and notes will be deleted. This cannot be undone."
      confirm-label="Delete company"
      destructive
      :loading="deleting"
      @confirm="confirmDelete"
    />
  </section>
</template>
