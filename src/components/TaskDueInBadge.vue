<script setup lang="ts">
import { taskDueBadgeClass, taskDueLabel } from '@/lib/tasks'

defineProps<{
  dueDt: string | null | undefined
  isCompleted: boolean
}>()
</script>

<template>
  <span
    class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
    :class="taskDueBadgeClass(dueDt, isCompleted)"
  >
    {{ taskDueLabel(dueDt, isCompleted) }}
  </span>
</template>
