<script setup lang="ts">
import {
  iconActionDeleteClass,
  iconActionEditClass,
  iconActionSuccessClass,
} from '@/lib/iconActionClasses'

withDefaults(
  defineProps<{
    disabled?: boolean
    disableEdit?: boolean
    disableDelete?: boolean
    showComplete?: boolean
    completeLabel?: string
  }>(),
  {
    completeLabel: 'Mark completed',
  },
)

defineEmits<{
  edit: []
  delete: []
  complete: []
}>()

const iconClass = 'h-[1.125rem] w-[1.125rem]'
</script>

<template>
  <div class="flex items-center gap-0.5">
    <button
      v-if="showComplete"
      type="button"
      :class="iconActionSuccessClass"
      :aria-label="completeLabel"
      :disabled="disabled"
      @click="$emit('complete')"
    >
      <svg
        class="h-[1.125rem] w-[1.125rem] shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M5 13 9 17 19 7" />
      </svg>
    </button>
    <button
      type="button"
      :class="iconActionEditClass"
      aria-label="Edit"
      :disabled="disabled || disableEdit"
      @click="$emit('edit')"
    >
      <FontAwesomeIcon icon="pencil" :class="iconClass" />
    </button>
    <button
      type="button"
      :class="iconActionDeleteClass"
      aria-label="Delete"
      :disabled="disabled || disableDelete"
      @click="$emit('delete')"
    >
      <FontAwesomeIcon icon="trash" :class="iconClass" />
    </button>
  </div>
</template>
