<script setup lang="ts">
import { computed } from 'vue'
import Editor from '@tinymce/tinymce-vue'
import type { Editor as TinyMceEditor } from 'tinymce'
import { createRichTextEditorInit } from '@/lib/tinymceEditor'
import { isEmptyRichText } from '@/lib/richText'

const model = defineModel<string>({ default: '' })

const props = defineProps<{
  readonly?: boolean
  placeholder?: string
  minHeight?: number
}>()

const emit = defineEmits<{
  escape: []
}>()

const editorMinHeight = computed(() => props.minHeight ?? 240)

const hasContent = computed(() => !isEmptyRichText(model.value))

const editorInit = computed(() => {
  const baseInit = createRichTextEditorInit(props.placeholder ?? 'Enter a description…', {
    minHeight: editorMinHeight.value,
  })

  return {
    ...baseInit,
    setup: (editor: TinyMceEditor) => {
      if (typeof baseInit.setup === 'function') {
        baseInit.setup(editor)
      }

      editor.on('keydown', (event) => {
        if (event.key === 'Escape') {
          emit('escape')
        }
      })
    },
  }
})

function onEditorUpdate(value: string) {
  model.value = isEmptyRichText(value) ? '' : value
}
</script>

<template>
  <div v-if="readonly" class="rich-text-field">
    <div
      v-if="hasContent"
      class="rich-text-content rounded-xl px-3 py-3 text-sm field-readonly text-stone-700"
      :style="{ minHeight: `${editorMinHeight}px` }"
      v-html="model"
    />
    <div
      v-else
      class="rounded-xl px-3 py-3 text-sm field-readonly text-stone-500"
      :style="{ minHeight: `${editorMinHeight}px` }"
    >
      —
    </div>
  </div>

  <div v-else class="rich-text-field rich-text-editor">
    <Editor
      :model-value="model"
      license-key="gpl"
      :init="editorInit"
      @update:model-value="onEditorUpdate"
    />
  </div>
</template>

<style scoped>
.rich-text-editor :deep(.tox-tinymce) {
  border: 0.5px solid rgb(214 211 209);
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: none;
}

.rich-text-editor :deep(.tox.tox-tinymce:focus-within),
.rich-text-editor :deep(.tox.tox-tinymce.tox-tinymce--focus) {
  border-color: rgb(22 101 52);
  box-shadow: 0 0 0 2px rgb(22 101 52 / 0.3);
}

.rich-text-editor :deep(.tox-editor-header) {
  border-bottom: 0.5px solid rgb(231 229 228);
  box-shadow: none;
}

.rich-text-editor :deep(.tox-toolbar),
.rich-text-editor :deep(.tox-toolbar__primary) {
  background: rgb(250 250 249);
}

.rich-text-editor :deep(.tox-statusbar) {
  border-top: 0.5px solid rgb(231 229 228);
}
</style>
