<script setup lang="ts">
import { computed } from 'vue'
import FormRequiredMark from '@/components/FormRequiredMark.vue'
import RichTextField from '@/components/RichTextField.vue'
import type { CompanyOfferingInput } from '@/lib/companyOfferingRecords'
import { PRODUCT_KIND_OPTIONS } from '@/lib/products'

const model = defineModel<CompanyOfferingInput>({ required: true })

const props = withDefaults(
  defineProps<{
    readonly?: boolean
    formId?: string
  }>(),
  {
    formId: 'company-offering-form',
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
        <p :class="labelClass">Description</p>
        <RichTextField
          v-model="model.description"
          :readonly="readonly"
          placeholder="Optional description"
          :min-height="160"
        />
      </div>
    </div>
  </form>
</template>
