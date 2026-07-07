<script setup lang="ts">
import { computed } from 'vue'
import { useDialogKeyboardShortcuts } from '@/composables/useDialogKeyboardShortcuts'
import { discardConfirmState, settleDiscardConfirm } from '@/lib/confirmDiscard'

const open = computed({
  get: () => discardConfirmState.open,
  set: (value) => {
    if (!value) settleDiscardConfirm(false)
  },
})

function keepEditing() {
  settleDiscardConfirm(false)
}

function closeAnyway() {
  settleDiscardConfirm(true)
}

useDialogKeyboardShortcuts(open, {
  onDismiss: keepEditing,
  onSave: closeAnyway,
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="discardConfirmState.open"
      class="fixed inset-0 z-[80] flex items-center justify-center bg-stone-900/40 p-4"
      @click.self="keepEditing"
    >
      <div
        class="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        :aria-label="discardConfirmState.title"
      >
        <h2 class="text-lg font-semibold text-stone-900">{{ discardConfirmState.title }}</h2>
        <p class="mt-2 text-sm leading-6 text-stone-600">{{ discardConfirmState.message }}</p>

        <div class="mt-6 flex justify-end gap-3">
          <button
            type="button"
            class="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
            @click="keepEditing"
          >
            Keep editing
          </button>
          <button
            type="button"
            class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            @click="closeAnyway"
          >
            Close anyway
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
