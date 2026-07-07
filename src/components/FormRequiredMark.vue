<script setup lang="ts">
withDefaults(
  defineProps<{
    show?: boolean
  }>(),
  {
    show: true,
  },
)
</script>

<template>
  <span v-if="show" class="text-red-600" aria-hidden="true"> *</span>
</template>
