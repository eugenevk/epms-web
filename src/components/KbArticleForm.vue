<script setup lang="ts">
import { computed } from 'vue'
import FormRequiredMark from '@/components/FormRequiredMark.vue'
import RichTextField from '@/components/RichTextField.vue'
import TagInputField from '@/components/TagInputField.vue'
import type { KbArticleInput } from '@/lib/kbArticleRecords'

const model = defineModel<KbArticleInput>({ required: true })

const props = withDefaults(
  defineProps<{
    readonly?: boolean
    formId?: string
    categorySuggestions?: string[]
  }>(),
  {
    formId: 'kb-article-form',
    categorySuggestions: () => [],
  },
)

defineEmits<{
  submit: []
  escape: []
}>()

const categories = computed({
  get: () => model.value.categories ?? [],
  set: (value: string[]) => {
    model.value = { ...model.value, categories: value }
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
</script>

<template>
  <form :id="formId" @submit.prevent="$emit('submit')">
    <div class="space-y-5">
      <label :class="labelClass">
        Title<FormRequiredMark v-if="!readonly" />
        <input
          v-model="model.title"
          type="text"
          :required="!readonly"
          aria-required="true"
          maxlength="240"
          placeholder="Article title"
          :class="fieldClass"
          :readonly="readonly"
        />
      </label>

      <div class="grid gap-5 md:grid-cols-2">
        <div>
          <p :class="labelClass">Categories</p>
          <TagInputField
            v-model="categories"
            :suggestions="categorySuggestions"
            :readonly="readonly"
            placeholder="Type to search categories or press Enter"
          />
        </div>

        <label :class="labelClass">
          Published date
          <input
            :value="model.publishedAt ?? ''"
            type="date"
            :class="fieldClass"
            :readonly="readonly"
            @input="model.publishedAt = ($event.target as HTMLInputElement).value || null"
          />
        </label>
      </div>

      <div>
        <p :class="labelClass">Article<FormRequiredMark v-if="!readonly" /></p>
        <RichTextField
          v-model="model.body"
          :readonly="readonly"
          placeholder="Write the article…"
          class="mt-1"
          :min-height="280"
          @escape="$emit('escape')"
        />
      </div>
    </div>
  </form>
</template>
