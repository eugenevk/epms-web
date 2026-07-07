<script setup lang="ts">
import { useDialogKeyboardShortcuts } from '@/composables/useDialogKeyboardShortcuts'

const props = defineProps<{
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
}>()

const open = defineModel<boolean>({ required: true })

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

function dismiss() {
  open.value = false
  emit('cancel')
}

useDialogKeyboardShortcuts(open, {
  onDismiss: dismiss,
  onSave: () => emit('confirm'),
  disabled: () => Boolean(props.loading),
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-stone-900/40 p-4"
      @click.self="dismiss"
    >
      <div
        class="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <h2 class="text-lg font-semibold text-stone-900">{{ title }}</h2>
        <p class="mt-2 text-sm leading-6 text-stone-600">{{ message }}</p>

        <div class="mt-6 flex justify-end gap-3">
          <button
            type="button"
            class="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
            :disabled="loading"
            @click="dismiss"
          >
            {{ cancelLabel ?? 'Cancel' }}
          </button>
          <button
            type="button"
            class="rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
            :class="destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-epms-700 hover:bg-epms-800'"
            :disabled="loading"
            @click="emit('confirm')"
          >
            {{ confirmLabel ?? 'Confirm' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
