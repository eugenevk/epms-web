<script setup lang="ts">
import { computed } from 'vue'
import { getColumnSortState, type GridSortClickOptions, type GridSortState } from '@/lib/gridSort'

const props = withDefaults(
  defineProps<{
    column: string
    label: string
    sortState: GridSortState[]
    align?: 'left' | 'center' | 'right'
    sortable?: boolean
    cellClass?: string
  }>(),
  {
    align: 'left',
    sortable: true,
    cellClass: '',
  },
)

const emit = defineEmits<{
  sort: [column: string, options: GridSortClickOptions]
}>()

const columnSort = computed(() => getColumnSortState(props.sortState, props.column))

const textAlignClass = computed(() => {
  switch (props.align) {
    case 'center':
      return 'justify-center text-center'
    case 'right':
      return 'justify-end text-right'
    default:
      return 'justify-start text-left'
  }
})

const thClass = computed(() => [
  props.cellClass,
  props.align === 'center' && 'text-center',
  props.align === 'right' && 'text-right',
])

function onClick(event: MouseEvent) {
  const additive = event.metaKey || event.ctrlKey
  const options: GridSortClickOptions = {
    additive,
    removeSecondary: additive && event.shiftKey,
  }
  emit('sort', props.column, options)
}
</script>

<template>
  <th :class="thClass">
    <button
      v-if="sortable"
      type="button"
      class="-mx-1 inline-flex w-full items-center gap-1 rounded px-1 py-0.5 transition hover:text-epms-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epms-600"
      :class="[textAlignClass, columnSort && 'text-epms-900']"
      :title="`Sort by ${label}. ⌘-click to add or reverse secondary sort. ⌘⇧-click to remove secondary sort.`"
      @click="onClick"
    >
      <span>{{ label }}</span>
      <span
        v-if="columnSort"
        class="inline-flex items-center gap-0.5 text-[0.65rem] leading-none text-epms-700"
        aria-hidden="true"
      >
        <span>{{ columnSort.direction === 'asc' ? '▲' : '▼' }}</span>
        <span v-if="sortState.length > 1">{{ columnSort.priority }}</span>
      </span>
      <span v-if="columnSort" class="sr-only">
        , sorted {{ columnSort.direction === 'asc' ? 'ascending' : 'descending' }}
        <template v-if="sortState.length > 1">, priority {{ columnSort.priority }}</template>
      </span>
    </button>
    <span v-else>{{ label }}</span>
  </th>
</template>
