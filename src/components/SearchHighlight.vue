<script setup lang="ts">
defineProps<{
  html: string
}>()
</script>

<template>
  <span v-html="html" />
</template>
