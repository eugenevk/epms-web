<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    name?: string
    url?: string | null
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    name: '',
    url: null,
    size: 'sm',
  },
)

const sizeClass = computed(() => {
  switch (props.size) {
    case 'lg':
      return 'h-20 w-20 text-xl'
    case 'md':
      return 'h-10 w-10 text-sm'
    default:
      return 'h-7 w-7 text-xs'
  }
})

const initials = computed(() => {
  const parts = props.name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase()
})
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-epms-100 font-semibold text-epms-800 ring-1 ring-epms-200/80"
    :class="sizeClass"
    aria-hidden="true"
  >
    <img v-if="url" :src="url" alt="" class="h-full w-full object-cover" />
    <span v-else>{{ initials }}</span>
  </span>
</template>
