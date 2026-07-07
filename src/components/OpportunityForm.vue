<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import CompanySearchField from '@/components/CompanySearchField.vue'
import ContactSearchField from '@/components/ContactSearchField.vue'
import FormRequiredMark from '@/components/FormRequiredMark.vue'
import FormattedIntegerInput from '@/components/FormattedIntegerInput.vue'
import RichTextField from '@/components/RichTextField.vue'
import type { OpportunityInput } from '@/lib/opportunityRecords'
import {
  applyOpportunityStageChange,
  applyOpportunityStatusChange,
} from '@/lib/opportunityRules'
import { normalizeExternalUrl } from '@/lib/externalUrl'
import { iconExternalLinkClass } from '@/lib/iconActionClasses'
import { loadListOptions, type ListOption } from '@/lib/referenceLists'
import { loadOpportunityStages, type OpportunityStage } from '@/lib/stages'

const model = defineModel<OpportunityInput>({ required: true })

const props = withDefaults(
  defineProps<{
    readonly?: boolean
    hideStageSelect?: boolean
    formId?: string
    hideCompanyField?: boolean
    dialogLayout?: boolean
  }>(),
  {
    hideStageSelect: false,
    formId: 'opportunity-form',
    hideCompanyField: false,
    dialogLayout: false,
  },
)

defineEmits<{
  submit: []
}>()

const statuses = ref<ListOption[]>([])
const currencies = ref<ListOption[]>([])
const stages = ref<OpportunityStage[]>([])
const listsLoading = ref(true)

const salesforceHref = computed(() => normalizeExternalUrl(model.value.sfRef))

const openLinkClass = iconExternalLinkClass

onMounted(async () => {
  try {
    const [loadedStatuses, loadedCurrencies, loadedStages] = await Promise.all([
      loadListOptions('opportunityStatuses'),
      loadListOptions('currencies'),
      loadOpportunityStages(),
    ])
    statuses.value = loadedStatuses
    currencies.value = loadedCurrencies
    stages.value = loadedStages
  } finally {
    listsLoading.value = false
  }
})

const statusValue = computed({
  get: () => model.value.status?.value ?? '',
  set: (value: string) => {
    const status = statuses.value.find((option) => option.value === value) ?? null
    applyOpportunityStatusChange(model.value, status, stages.value)
  },
})

const currencyValue = computed({
  get: () => model.value.currency?.value ?? '',
  set: (value: string) => {
    model.value.currency = currencies.value.find((option) => option.value === value) ?? null
  },
})

const stageId = computed({
  get: () => model.value.stage?.id ?? '',
  set: (value: string) => {
    const stage = stages.value.find((option) => option.id === value) ?? null
    applyOpportunityStageChange(model.value, stage)
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
    ? 'inline-flex items-center gap-2 text-sm font-normal text-stone-700'
    : 'inline-flex items-center gap-2 text-sm font-normal text-stone-800',
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
        class="md:col-span-2 xl:col-span-2"
      />

      <label :class="labelClass">
        Number
        <input v-model="model.opportunityNo" type="text" :readonly="readonly" :class="fieldClass" />
      </label>

      <label :class="labelClass" class="md:col-span-2 xl:col-span-2">
        Title<FormRequiredMark v-if="!readonly" />
        <input
          v-model="model.title"
          type="text"
          :required="!readonly"
          aria-required="true"
          :readonly="readonly"
          :class="fieldClass"
        />
      </label>

      <label v-if="!hideStageSelect" :class="labelClass">
        Stage
        <select v-model="stageId" :disabled="readonly || listsLoading" :class="fieldClass">
          <option value="">—</option>
          <option v-for="stage in stages" :key="stage.id" :value="stage.id">
            {{ stage.label }}
          </option>
        </select>
      </label>

      <label :class="labelClass">
        Status
        <select v-model="statusValue" :disabled="readonly || listsLoading" :class="fieldClass">
          <option value="">—</option>
          <option v-for="status in statuses" :key="status.value" :value="status.value">
            {{ status.label }}
          </option>
        </select>
      </label>

      <label :class="labelClass">
        Likelihood (%)
        <input
          v-model.number="model.likelihood"
          type="number"
          min="0"
          max="100"
          step="1"
          :readonly="readonly"
          :class="fieldClass"
        />
      </label>

      <label :class="labelClass">
        Target date
        <input v-model="model.targetDt" type="date" :readonly="readonly" :class="fieldClass" />
      </label>

      <label :class="labelClass">
        Closing date
        <input v-model="model.closingDt" type="date" :readonly="readonly" :class="fieldClass" />
      </label>

      <label :class="labelClass">
        Amount
        <FormattedIntegerInput v-model="model.amount" :readonly="readonly" :min="0" :input-class="fieldClass" />
      </label>

      <label :class="labelClass">
        ACV
        <FormattedIntegerInput v-model="model.acv" :readonly="readonly" :min="0" :input-class="fieldClass" />
      </label>

      <label :class="labelClass">
        Currency
        <select v-model="currencyValue" :disabled="readonly || listsLoading" :class="fieldClass">
          <option value="">—</option>
          <option v-for="currency in currencies" :key="currency.value" :value="currency.value">
            {{ currency.label }}
          </option>
        </select>
      </label>

      <ContactSearchField
        v-model="model.leadSC"
        label="Lead solutions consultant"
        :readonly="readonly"
        class="md:col-span-2 xl:col-span-2"
      />

      <label :class="labelClass" class="md:col-span-1 xl:col-span-2">
        Salesforce
        <div class="mt-1 flex gap-2">
          <input v-model="model.sfRef" type="url" :readonly="readonly" :class="fieldClass" />
          <a
            v-if="salesforceHref"
            :href="salesforceHref"
            target="_blank"
            rel="noopener noreferrer"
            :class="openLinkClass"
            aria-label="Open Salesforce link"
          >
            <FontAwesomeIcon icon="arrow-up-right-from-square" class="h-5 w-5" />
          </a>
        </div>
      </label>

      <label :class="checkboxLabelClass" class="self-end pb-2">
        <input
          v-model="model.isActive"
          type="checkbox"
          :disabled="readonly"
        />
        Active
      </label>
    </div>

    <div :class="dialogLayout ? 'mt-4' : 'mt-6'">
      <p :class="labelClass">Description</p>
      <RichTextField
        v-model="model.description"
        :readonly="readonly"
        placeholder="Enter a description…"
        :min-height="dialogLayout ? 160 : undefined"
      />
    </div>
  </form>
</template>
