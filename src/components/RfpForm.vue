<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import CompanySearchField from '@/components/CompanySearchField.vue'
import FormRequiredMark from '@/components/FormRequiredMark.vue'
import OpportunitySearchField from '@/components/OpportunitySearchField.vue'
import RichTextField from '@/components/RichTextField.vue'
import type { RfpInput } from '@/lib/rfpRecords'
import { applyRfpActiveChange, applyRfpStatusChange } from '@/lib/rfpRules'
import { loadListOptions, type ListOption } from '@/lib/referenceLists'

const model = defineModel<RfpInput>({ required: true })

const props = defineProps<{
  readonly?: boolean
}>()

defineEmits<{
  submit: []
}>()

const rfpTypes = ref<ListOption[]>([])
const rfpStatuses = ref<ListOption[]>([])
const listsLoading = ref(true)

onMounted(async () => {
  try {
    const [types, statuses] = await Promise.all([
      loadListOptions('rfpTypes'),
      loadListOptions('rfpStatuses'),
    ])
    rfpTypes.value = types
    rfpStatuses.value = statuses
  } finally {
    listsLoading.value = false
  }
})

watch(
  () => model.value.company?.id,
  (nextId, previousId) => {
    if (previousId && nextId !== previousId) {
      model.value.opportunity = null
    }
  },
)

const typeValue = computed({
  get: () => model.value.type?.value ?? '',
  set: (value: string) => {
    model.value.type = rfpTypes.value.find((option) => option.value === value) ?? null
  },
})

const statusValue = computed({
  get: () => model.value.status?.value ?? '',
  set: (value: string) => {
    const status = rfpStatuses.value.find((option) => option.value === value) ?? null
    applyRfpStatusChange(model.value, status)
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

function onActiveChange(event: Event) {
  if (props.readonly) return
  applyRfpActiveChange(model.value, (event.target as HTMLInputElement).checked)
}
</script>

<template>
  <form id="rfp-form" @submit.prevent="$emit('submit')">
    <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      <CompanySearchField
        v-model="model.company"
        :readonly="readonly"
        required
        class="md:col-span-2 xl:col-span-2"
      />

      <OpportunitySearchField
        v-model="model.opportunity"
        :readonly="readonly"
        :company-id="model.company?.id"
        :company-label="model.company?.objectLabel"
        class="md:col-span-2 xl:col-span-2"
      />

      <label :class="labelClass">
        Number
        <input v-model="model.rfpNo" type="text" :readonly="readonly" :class="fieldClass" />
      </label>

      <label :class="[labelClass, 'md:col-span-2 xl:col-span-2']">
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

      <label :class="labelClass">
        Type
        <select v-model="typeValue" :disabled="readonly || listsLoading" :class="fieldClass">
          <option value="">—</option>
          <option v-for="option in rfpTypes" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label :class="labelClass">
        Status
        <select v-model="statusValue" :disabled="readonly || listsLoading" :class="fieldClass">
          <option value="">—</option>
          <option v-for="option in rfpStatuses" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label :class="labelClass">
        Due date
        <input v-model="model.dueDt" type="date" :readonly="readonly" :class="fieldClass" />
      </label>

      <label :class="labelClass">
        Submission date
        <input v-model="model.submissionDt" type="date" :readonly="readonly" :class="fieldClass" />
      </label>

      <label :class="checkboxLabelClass">
        <input
          :checked="model.isActive"
          type="checkbox"
          :disabled="readonly"
          @change="onActiveChange"
        />
        Active
      </label>

      <div class="md:col-span-2 xl:col-span-4">
        <p :class="labelClass">Description</p>
        <RichTextField v-model="model.description" :readonly="readonly" class="mt-1" />
      </div>
    </div>
  </form>
</template>
