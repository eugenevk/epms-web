<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import CompanyLogoField from '@/components/CompanyLogoField.vue'
import ContactSearchField from '@/components/ContactSearchField.vue'
import CountrySelectField from '@/components/CountrySelectField.vue'
import FormRequiredMark from '@/components/FormRequiredMark.vue'
import RichTextField from '@/components/RichTextField.vue'
import type { CompanyInput } from '@/lib/companies'
import { normalizeExternalUrl } from '@/lib/externalUrl'
import { iconExternalLinkClass } from '@/lib/iconActionClasses'
import { loadListOptions, type ListOption } from '@/lib/referenceLists'

const model = defineModel<CompanyInput>({ required: true })

const props = defineProps<{
  readonly?: boolean
  companyId?: string | null
}>()

defineEmits<{
  submit: []
  pendingLogo: [file: File | null]
  logoError: [message: string]
}>()

const industries = ref<ListOption[]>([])
const companyTypes = ref<ListOption[]>([])
const customerLevels = ref<ListOption[]>([])
const listsLoading = ref(true)

const isCustomer = computed(() => model.value.companyType?.value === 'customer')
const isPartner = computed(() => model.value.companyType?.value === 'partner')
const isInternal = computed(() => model.value.companyType?.value === 'internal')

const websiteHref = computed(() => normalizeExternalUrl(model.value.website))
const salesforceHref = computed(() => normalizeExternalUrl(model.value.sfRef))

const openLinkClass = iconExternalLinkClass

onMounted(async () => {
  try {
    const [industryItems, companyTypeItems, customerLevelItems] = await Promise.all([
      loadListOptions('industries'),
      loadListOptions('companyTypes'),
      loadListOptions('customerLevels'),
    ])
    industries.value = industryItems
    companyTypes.value = companyTypeItems
    customerLevels.value = customerLevelItems
  } finally {
    listsLoading.value = false
  }
})

function bindLabeledValue(field: 'industry' | 'companyType' | 'customerLevel') {
  return computed({
    get: () => model.value[field]?.value ?? '',
    set: (value: string) => {
      const options =
        field === 'industry'
          ? industries.value
          : field === 'companyType'
            ? companyTypes.value
            : customerLevels.value
      model.value[field] = options.find((option) => option.value === value) ?? null
    },
  })
}

const industryValue = bindLabeledValue('industry')
const companyTypeValue = bindLabeledValue('companyType')
const customerLevelValue = bindLabeledValue('customerLevel')

const hostingValue = computed({
  get: () => model.value.hosting ?? '',
  set: (value: string) => {
    model.value.hosting =
      value === 'cloud' || value === 'self-managed' ? value : null
  },
})

function toggleHealthScore(star: number) {
  if (props.readonly) return
  model.value.healthScore = model.value.healthScore === star ? 0 : star
}

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
    ? 'inline-flex items-center gap-2 text-sm font-normal text-stone-700'
    : 'inline-flex items-center gap-2 text-sm font-normal text-stone-800',
)

const alwaysReadonlyFieldClass =
  'mt-1 w-full rounded-xl px-3 py-2.5 text-sm field-readonly'
</script>

<template>
  <CompanyLogoField
    v-model:logo-url="model.logoUrl"
    v-model:logo-path="model.logoPath"
    :company-id="companyId"
    :company-name="model.name"
    :readonly="readonly"
    class="mb-6"
    @pending-logo="$emit('pendingLogo', $event)"
    @error="$emit('logoError', $event)"
  />

  <form id="company-form" @submit.prevent="$emit('submit')">
  <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
    <label :class="labelClass">
      Company number
      <input
        v-model="model.companyNo"
        type="text"
        :readonly="readonly"
        :class="fieldClass"
      />
    </label>

    <label :class="labelClass">
      DUNS
      <input v-model="model.duns" type="text" :readonly="readonly" :class="fieldClass" />
    </label>

    <label class="md:col-span-2 xl:col-span-2" :class="labelClass">
      Name<FormRequiredMark v-if="!readonly" />
      <input
        v-model="model.name"
        type="text"
        :required="!readonly"
        aria-required="true"
        :readonly="readonly"
        :class="fieldClass"
      />
    </label>

    <label class="md:col-span-2" :class="labelClass">
      Street line 1
      <input v-model="model.streetLine1" type="text" :readonly="readonly" :class="fieldClass" />
    </label>

    <label class="md:col-span-2" :class="labelClass">
      Street line 2
      <input v-model="model.streetLine2" type="text" :readonly="readonly" :class="fieldClass" />
    </label>

    <label :class="labelClass">
      Zip code
      <input v-model="model.zipcode" type="text" :readonly="readonly" :class="fieldClass" />
    </label>

    <label :class="labelClass">
      City
      <input v-model="model.city" type="text" :readonly="readonly" :class="fieldClass" />
    </label>

    <label :class="labelClass">
      Country
      <CountrySelectField v-model="model.country" :readonly="readonly" />
    </label>

    <label :class="labelClass">
      State / province
      <input v-model="model.state" type="text" :readonly="readonly" :class="fieldClass" />
    </label>

    <label :class="labelClass">
      Phone
      <input v-model="model.phone" type="text" :readonly="readonly" :class="fieldClass" />
    </label>

    <label class="md:col-span-2" :class="labelClass">
      Website
      <div v-if="readonly" class="mt-1 flex flex-wrap items-stretch gap-2">
        <a
          v-if="websiteHref"
          :href="websiteHref"
          target="_blank"
          rel="noopener noreferrer"
          class="min-w-0 flex-1 truncate rounded-xl px-3 py-2.5 text-sm field-readonly text-epms-800 underline decoration-epms-300 underline-offset-2 hover:text-epms-950"
        >
          {{ model.website }}
        </a>
        <span
          v-else
          class="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm field-readonly text-stone-500"
        >
          —
        </span>
      </div>
      <div v-else class="mt-1 flex flex-wrap items-stretch gap-2">
        <input
          v-model="model.website"
          type="text"
          inputmode="url"
          autocomplete="url"
          placeholder="example.com"
          :class="[fieldClass, 'min-w-0 flex-1']"
        />
        <a
          v-if="websiteHref"
          :href="websiteHref"
          target="_blank"
          rel="noopener noreferrer"
          :class="openLinkClass"
          aria-label="Open website"
        >
          <FontAwesomeIcon icon="arrow-up-right-from-square" class="h-5 w-5" />
        </a>
      </div>
    </label>

    <label :class="labelClass">
      Industry
      <select
        v-model="industryValue"
        :disabled="readonly || listsLoading"
        :class="fieldClass"
      >
        <option value="">Select industry</option>
        <option v-for="option in industries" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>

    <label :class="labelClass">
      Company type
      <select
        v-model="companyTypeValue"
        :disabled="readonly || listsLoading"
        :class="fieldClass"
      >
        <option value="">Select type</option>
        <option v-for="option in companyTypes" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>

    <label v-if="isCustomer" :class="labelClass">
      License tier
      <select
        v-model="customerLevelValue"
        :disabled="readonly || listsLoading"
        :class="fieldClass"
      >
        <option value="">Select tier</option>
        <option v-for="option in customerLevels" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>

    <label v-if="isCustomer" :class="labelClass">
      Customer since
      <input
        v-model="model.customerSince"
        type="text"
        placeholder="YYYY-MM-DD"
        :readonly="readonly"
        :class="fieldClass"
      />
    </label>

    <ContactSearchField
      v-model="model.accountManager"
      label="Account manager"
      :readonly="readonly"
    />

    <label v-if="!isInternal" :class="labelClass">
      Hosting
      <select v-model="hostingValue" :disabled="readonly" :class="fieldClass">
        <option value="">—</option>
        <option value="cloud">Cloud</option>
        <option value="self-managed">Self-Managed</option>
      </select>
    </label>

    <div :class="labelClass">
      Health score
      <div class="mt-2 flex items-center gap-1">
        <button
          v-for="star in 5"
          :key="star"
          type="button"
          class="rounded p-1 transition disabled:cursor-default"
          :class="star <= model.healthScore ? 'text-amber-500' : 'text-stone-300'"
          :disabled="readonly"
          :aria-label="`Set health score to ${star}`"
          @click="toggleHealthScore(star)"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M12 2l2.9 6.9H22l-5.5 4.1 2.1 6.9L12 16.8 5.4 19.9l2.1-6.9L2 8.9h7.1L12 2z"
            />
          </svg>
        </button>
        <span class="ml-2 text-sm font-normal text-stone-500">{{ model.healthScore }}/5</span>
      </div>
    </div>

    <label class="md:col-span-2" :class="labelClass">
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
        <a
          v-if="salesforceHref"
          :href="salesforceHref"
          target="_blank"
          rel="noopener noreferrer"
          :class="openLinkClass"
          aria-label="Open Salesforce"
        >
          <FontAwesomeIcon icon="arrow-up-right-from-square" class="h-5 w-5" />
        </a>
      </div>
      <div v-else class="mt-1 flex flex-wrap items-stretch gap-2">
        <input
          v-model="model.sfRef"
          type="text"
          inputmode="url"
          autocomplete="url"
          placeholder="salesforce.com/..."
          :class="[fieldClass, 'min-w-0 flex-1']"
        />
        <a
          v-if="salesforceHref"
          :href="salesforceHref"
          target="_blank"
          rel="noopener noreferrer"
          :class="openLinkClass"
          aria-label="Open Salesforce"
        >
          <FontAwesomeIcon icon="arrow-up-right-from-square" class="h-5 w-5" />
        </a>
      </div>
    </label>

    <label v-if="model.implPartner" class="md:col-span-2" :class="labelClass">
      Implementation partner
      <input
        :value="model.implPartner.objectLabel"
        type="text"
        readonly
        :class="alwaysReadonlyFieldClass"
      />
    </label>

    <div
      v-if="!isInternal"
      class="md:col-span-2 xl:col-span-4 flex flex-wrap items-center gap-x-6 gap-y-2"
    >
      <label :class="checkboxLabelClass">
        <input v-model="model.nda" type="checkbox" :disabled="readonly" />
        NDA
      </label>
      <label v-if="isPartner" :class="checkboxLabelClass">
        <input v-model="model.isFocusPartner" type="checkbox" :disabled="readonly" />
        Focus partner
      </label>
      <label v-if="isCustomer" :class="checkboxLabelClass">
        <input v-model="model.isReference" type="checkbox" :disabled="readonly" />
        Reference customer
      </label>
    </div>

    <div class="md:col-span-2 xl:col-span-4" :class="labelClass">
      Description
      <div class="mt-1">
        <RichTextField v-model="model.description" :readonly="readonly" />
      </div>
    </div>
  </div>
  </form>
</template>
