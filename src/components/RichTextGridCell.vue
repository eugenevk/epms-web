<script setup lang="ts">
import { computed } from 'vue'
import { isEmptyRichText, isRichTextContent, richTextPreviewText } from '@/lib/richText'

const props = withDefaults(
  defineProps<{
    html?: string | null
    clamp?: boolean
    previewLength?: number
  }>(),
  {
    clamp: true,
    previewLength: 120,
  },
)

const preview = computed(() => richTextPreviewText(props.html, props.previewLength))
const showRich = computed(() => isRichTextContent(props.html) && !isEmptyRichText(props.html))
const showPlain = computed(() => !isEmptyRichText(props.html) && !showRich.value)
</script>

<template>
  <div
    v-if="showRich"
    class="rich-text-content prose prose-sm max-w-none text-stone-700"
    :class="clamp ? 'line-clamp-3' : undefined"
    :title="preview"
    v-html="html"
  />
  <span
    v-else-if="showPlain"
    class="block text-stone-700"
    :class="clamp ? 'line-clamp-3' : undefined"
    :title="preview"
  >
    {{ html }}
  </span>
  <span v-else>—</span>
</template>
