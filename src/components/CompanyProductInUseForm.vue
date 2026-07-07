<script setup lang="ts">
import { computed } from 'vue'
import CompanySearchField from '@/components/CompanySearchField.vue'
import FormRequiredMark from '@/components/FormRequiredMark.vue'
import RichTextField from '@/components/RichTextField.vue'
import type { CompanyProductInUseInput } from '@/lib/companyProductInUseRecords'
import { PRODUCT_KIND_OPTIONS } from '@/lib/products'

const model = defineModel<CompanyProductInUseInput>({ required: true })

const props = withDefaults(
  defineProps<{
    readonly?: boolean
    formId?: string
  }>(),
  {
    formId: 'company-product-in-use-form',
  },
)

defineEmits<{
  submit: []
}>()

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

const supplierCompany = computed({
  get: () => model.value.supplierCompany,
  set: (value) => {
    model.value = { ...model.value, supplierCompany: value }
  },
})
</script>

<template>
  <form :id="formId" @submit.prevent="$emit('submit')">
    <div class="space-y-5">
      <fieldset>
        <legend :class="labelClass">Type<FormRequiredMark v-if="!readonly" /></legend>
        <div class="mt-2 flex flex-wrap gap-4">
          <label
            v-for="option in PRODUCT_KIND_OPTIONS"
            :key="option.value"
            class="inline-flex items-center gap-2 text-sm text-stone-700"
          >
            <input
              v-model="model.kind"
              type="radio"
              :value="option.value"
              :disabled="readonly"
            />
            {{ option.label }}
          </label>
        </div>
      </fieldset>

      <label :class="labelClass">
        Name<FormRequiredMark v-if="!readonly" />
        <input
          v-model="model.name"
          type="text"
          maxlength="240"
          placeholder="Product or service name"
          :class="fieldClass"
          :readonly="readonly"
          :required="!readonly"
        />
      </label>

      <div>
        <p :class="labelClass">Supplier company<FormRequiredMark v-if="!readonly" /></p>
        <CompanySearchField
          v-model="supplierCompany"
          :readonly="readonly"
          placeholder="Search supplier company…"
        />
      </div>

      <label :class="labelClass">
        Version
        <input
          :value="model.version ?? ''"
          type="text"
          maxlength="80"
          placeholder="Optional version number"
          :class="fieldClass"
          :readonly="readonly"
          @input="model.version = ($event.target as HTMLInputElement).value || null"
        />
      </label>

      <div>
        <p :class="labelClass">Description</p>
        <RichTextField
          v-model="model.description"
          :readonly="readonly"
          placeholder="Optional notes"
          :min-height="160"
        />
      </div>
    </div>
  </form>
</template>
