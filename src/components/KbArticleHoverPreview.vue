<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { KbArticleHit } from '@/lib/kbArticlesAlgolia'
import { isEmptyRichText } from '@/lib/richText'

const props = defineProps<{
  article: KbArticleHit
}>()

const visible = ref(false)
const hoveringRow = ref(false)
const hoveringPopup = ref(false)

let hideTimer: number | undefined

const hasBody = computed(() => !isEmptyRichText(props.article.body))

function clearHideTimer() {
  window.clearTimeout(hideTimer)
}

function scheduleHide() {
  clearHideTimer()
  hideTimer = window.setTimeout(() => {
    if (!hoveringRow.value && !hoveringPopup.value) {
      visible.value = false
    }
  }, 250)
}

function showPreview() {
  if (!hasBody.value) return

  hoveringRow.value = true
  clearHideTimer()
  visible.value = true
}

function hidePreviewFromRow() {
  hoveringRow.value = false
  scheduleHide()
}

function keepPreviewOpen() {
  hoveringPopup.value = true
  clearHideTimer()
}

function hidePreviewFromPopup() {
  hoveringPopup.value = false
  scheduleHide()
}

onBeforeUnmount(() => {
  clearHideTimer()
})
</script>

<template>
  <tr v-bind="$attrs" @mouseenter="showPreview" @mouseleave="hidePreviewFromRow">
    <slot />
  </tr>

  <Teleport to="body">
    <div
      v-if="visible && hasBody"
      class="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="presentation"
    >
      <div
        class="pointer-events-auto flex max-h-[min(88vh,52rem)] w-full max-w-[min(56rem,94vw)] flex-col overflow-hidden rounded-2xl border border-epms-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="false"
        :aria-label="article.title || 'Article preview'"
        @mouseenter="keepPreviewOpen"
        @mouseleave="hidePreviewFromPopup"
      >
        <div class="shrink-0 border-b border-stone-200 px-6 py-4">
          <p class="text-base font-semibold text-epms-900">
            {{ article.title || 'Untitled article' }}
          </p>
        </div>
        <div
          class="rich-text-content prose prose-base min-h-0 flex-1 overflow-y-auto px-6 py-5 text-stone-700"
          v-html="article.body"
        />
      </div>
    </div>
  </Teleport>
</template>
