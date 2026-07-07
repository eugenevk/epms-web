<script setup lang="ts">
import { formatInteger } from '@/lib/formatNumber'

defineProps<{
  loading?: boolean
  nbHits: number
  singular: string
  plural: string
  /** Omit bottom padding when the parent toolbar uses vertical center alignment. */
  centered?: boolean
}>()
</script>

<template>
  <p :class="['shrink-0 text-sm text-stone-500 whitespace-nowrap', centered ? '' : 'pb-2.5']">
    <span v-if="loading">Loading…</span>
    <span v-else>{{ formatInteger(nbHits) }} {{ nbHits === 1 ? singular : plural }} found</span>
  </p>
</template>
