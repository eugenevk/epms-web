<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import CompanySearchField from '@/components/CompanySearchField.vue'
import ContactSearchField from '@/components/ContactSearchField.vue'
import FormRequiredMark from '@/components/FormRequiredMark.vue'
import RichTextField from '@/components/RichTextField.vue'
import type { ContactInput } from '@/lib/contactRecords'
import { normalizeExternalUrl } from '@/lib/externalUrl'
import { iconExternalLinkClass } from '@/lib/iconActionClasses'
import { loadListOptions, type ListOption } from '@/lib/referenceLists'

const model = defineModel<ContactInput>({ required: true })

const props = withDefaults(
  defineProps<{
    readonly?: boolean
    contactId?: string | null
    formId?: string
    hideCompanyField?: boolean
    dialogLayout?: boolean
  }>(),
  {
    formId: 'contact-form',
    hideCompanyField: false,
    dialogLayout: false,
  },
)

defineEmits<{
  submit: []
}>()

const genders = ref<ListOption[]>([])
const listsLoading = ref(true)
const firstNameRef = ref<HTMLInputElement | null>(null)

const linkedInHref = computed(() => normalizeExternalUrl(model.value.linkedIn))
const salesforceHref = computed(() => normalizeExternalUrl(model.value.sfRef))

const openLinkClass = iconExternalLinkClass

onMounted(async () => {
  try {
    genders.value = await loadListOptions('genders')
  } finally {
    listsLoading.value = false
  }
})

watch(
  () => props.readonly,
  async (readonly) => {
    if (readonly) return
    await nextTick()
    firstNameRef.value?.focus()
  },
  { immediate: true },
)

watch(
  () => model.value.hasLeft,
  (hasLeft) => {
    if (!hasLeft) {
      model.value.leftSince = null
    }
  },
)

const genderValue = computed({
  get: () => model.value.gender?.value ?? '',
  set: (value: string) => {
    model.value.gender = genders.value.find((option) => option.value === value) ?? null
  },
})

const fieldClass = computed(() =>
  props.readonly
    ? 'mt-1 w-full rounded-xl px-3 py-2.5 text-sm field-readonly'
    : 'mt-1 w-full rounded-xl px-3 py-2.5 text-sm text-stone-900 field-focus',
)

const labelClass = computed(() =>
  props.readonly
    ? 'block text-sm font-semibold text-stone-700'
    : 'block text-sm font-semibold text-stone-800',
)

const checkboxLabelClass = computed(() =>
  props.readonly
    ? 'inline-flex items-center gap-2 self-end pb-2.5 text-sm font-normal text-stone-700'
    : 'inline-flex items-center gap-2 self-end pb-2.5 text-sm font-normal text-stone-800',
)

const gridClass = computed(() =>
  props.dialogLayout
    ? 'grid gap-3 md:grid-cols-3 xl:grid-cols-6'
    : 'grid gap-5 md:grid-cols-2 xl:grid-cols-4',
)
</script>

<template>
  <form :id="formId" @submit.prevent="$emit('submit')">
    <div :class="gridClass">
      <CompanySearchField
        v-if="!hideCompanyField"
        v-model="model.company"
        :readonly="readonly"
        required
        class="md:col-span-2 xl:col-span-2"
      />

      <label :class="labelClass">
        First name
        <input
          ref="firstNameRef"
          v-model="model.firstName"
          type="text"
          :readonly="readonly"
          :class="fieldClass"
        />
      </label>

      <label :class="labelClass">
        Last name<FormRequiredMark v-if="!readonly" />
        <input
          v-model="model.lastName"
          type="text"
          :required="!readonly"
          aria-required="true"
          :readonly="readonly"
          :class="fieldClass"
        />
      </label>

      <label :class="labelClass">
        Position
        <input v-model="model.position" type="text" :readonly="readonly" :class="fieldClass" />
      </label>

      <label :class="labelClass">
        Department
        <input v-model="model.department" type="text" :readonly="readonly" :class="fieldClass" />
      </label>

      <label
        v-if="dialogLayout"
        :class="labelClass"
        class="md:col-span-2 xl:col-span-2"
      >
        Email
        <input v-model="model.email" type="email" :readonly="readonly" :class="fieldClass" />
      </label>

      <ContactSearchField
        v-model="model.reportsInto"
        :readonly="readonly"
        :exclude-contact-id="contactId"
        :class="dialogLayout ? undefined : 'md:col-span-2 xl:col-span-2'"
      />

      <label v-if="!dialogLayout" :class="labelClass">
        Email
        <input v-model="model.email" type="email" :readonly="readonly" :class="fieldClass" />
      </label>

      <label :class="labelClass">
        Phone
        <input v-model="model.phone" type="text" :readonly="readonly" :class="fieldClass" />
      </label>

      <label :class="labelClass">
        Mobile
        <input v-model="model.mobile" type="text" :readonly="readonly" :class="fieldClass" />
      </label>

      <label :class="labelClass">
        Gender
        <select
          v-model="genderValue"
          :disabled="readonly || listsLoading"
          :class="fieldClass"
        >
          <option value="">—</option>
          <option v-for="option in genders" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label :class="labelClass">
        Date of birth
        <input v-model="model.dob" type="date" :readonly="readonly" :class="fieldClass" />
      </label>

      <label :class="labelClass">
        First met
        <input v-model="model.firstMet" type="text" :readonly="readonly" :class="fieldClass" />
      </label>

      <label :class="labelClass">
        Joined
        <input v-model="model.atCompanySince" type="text" :readonly="readonly" :class="fieldClass" />
      </label>

      <label :class="labelClass">
        LinkedIn
        <div v-if="readonly" class="mt-1 flex flex-wrap items-stretch gap-2">
          <a
            v-if="linkedInHref"
            :href="linkedInHref"
            target="_blank"
            rel="noopener noreferrer"
            class="min-w-0 flex-1 truncate rounded-xl px-3 py-2.5 text-sm field-readonly text-epms-800 underline decoration-epms-300 underline-offset-2 hover:text-epms-950"
          >
            {{ model.linkedIn }}
          </a>
          <span
            v-else
            class="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm field-readonly text-stone-500"
          >
            —
          </span>
        </div>
        <div v-else class="mt-1 flex items-center gap-2">
          <input
            v-model="model.linkedIn"
            type="text"
            :class="[fieldClass, 'min-w-0 flex-1']"
          />
          <a
            v-if="linkedInHref"
            :href="linkedInHref"
            target="_blank"
            rel="noreferrer noopener"
            :class="openLinkClass"
            aria-label="Open LinkedIn profile"
          >
            <FontAwesomeIcon icon="arrow-up-right-from-square" class="h-5 w-5" />
          </a>
        </div>
      </label>

      <label :class="labelClass" class="md:col-span-2 xl:col-span-2">
        Salesforce
        <div v-if="readonly" class="mt-1 flex flex-wrap items-stretch gap-2">
          <a
            v-if="salesforceHref"
            :href="salesforceHref"
            target="_blank"
            rel="noopener noreferrer"
            class="min-w-0 flex-1 truncate rounded-xl px-3 py-2.5 text-sm field-readonly text-epms-800 underline decoration-epms-300 underline-offset-2 hover:text-epms-950"
          >
            {{ model.sfRef }}
          </a>
          <span
            v-else
            class="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm field-readonly text-stone-500"
          >
            —
          </span>
        </div>
        <div v-else class="mt-1 flex items-center gap-2">
          <input
            v-model="model.sfRef"
            type="text"
            :class="[fieldClass, 'min-w-0 flex-1']"
          />
          <a
            v-if="salesforceHref"
            :href="salesforceHref"
            target="_blank"
            rel="noreferrer noopener"
            :class="openLinkClass"
            aria-label="Open Salesforce record"
          >
            <FontAwesomeIcon icon="arrow-up-right-from-square" class="h-5 w-5" />
          </a>
        </div>
      </label>

      <label :class="checkboxLabelClass">
        <input
          v-model="model.hasLeft"
          type="checkbox"
          :disabled="readonly"
        />
        Left company
      </label>

      <label v-if="model.hasLeft" :class="labelClass">
        Left since
        <input v-model="model.leftSince" type="text" :readonly="readonly" :class="fieldClass" />
      </label>
    </div>

    <div :class="[dialogLayout ? 'mt-4' : 'mt-6', labelClass]">
      Notes
      <div class="mt-1">
        <RichTextField
          v-model="model.notes"
          :readonly="readonly"
          :min-height="dialogLayout ? 160 : undefined"
        />
      </div>
    </div>
  </form>
</template>
