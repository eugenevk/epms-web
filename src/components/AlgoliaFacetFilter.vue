<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatInteger } from '@/lib/formatNumber'

const props = withDefaults(
  defineProps<{
    label: string
    facets?: Record<string, number>
    selected: string[]
    limit?: number
    formatValue?: (value: string) => string
  }>(),
  {
    limit: 5,
    formatValue: (value: string) => value,
  },
)

const emit = defineEmits<{
  toggle: [value: string]
}>()

const query = ref('')
const showAll = ref(false)

const items = computed(() => {
  const needle = query.value.trim().toLowerCase()
  const entries = Object.entries(props.facets ?? {})
    .filter(([value]) => value.trim().length > 0)
    .sort(([left], [right]) => left.localeCompare(right, 'en', { sensitivity: 'base' }))

  const filtered = needle
    ? entries.filter(([value]) => value.toLowerCase().includes(needle))
    : entries

  return showAll.value ? filtered : filtered.slice(0, props.limit)
})

const canShowMore = computed(() => {
  const needle = query.value.trim().toLowerCase()
  const total = Object.entries(props.facets ?? {}).filter(([value]) => {
    if (!value.trim()) return false
    return needle ? value.toLowerCase().includes(needle) : true
  }).length
  return total > props.limit
})

function isSelected(value: string) {
  return props.selected.includes(value)
}
</script>

<template>
  <div>
    <p class="text-sm font-semibold text-stone-800">{{ label }}</p>

    <input
      v-model="query"
      type="search"
      :placeholder="`Filter ${label.toLowerCase()}…`"
      class="mt-2 w-full rounded-lg border-[0.5px] border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-epms-600 focus:ring-2 focus:ring-epms-600/30"
    />

    <ul class="mt-2 space-y-0">
      <li v-if="items.length === 0" class="px-1 py-0.5 text-sm text-stone-500">No options</li>
      <li v-for="[value, count] in items" :key="value">
        <label class="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-0.5 transition hover:bg-white/70">
          <input
            type="checkbox"
            class="mt-0.5"
            :checked="isSelected(value)"
            @change="emit('toggle', value)"
          />
          <span class="min-w-0 flex-1 text-sm text-stone-700">
            {{ formatValue(value) }}
          </span>
          <span
            class="inline-flex h-6 min-w-[2.25rem] shrink-0 items-center justify-center rounded-full bg-stone-200 px-2 text-xs font-medium leading-none tabular-nums text-stone-700"
          >
            {{ formatInteger(count) }}
          </span>
        </label>
      </li>
    </ul>

    <button
      v-if="canShowMore"
      type="button"
      class="mt-2 text-sm font-medium text-epms-800 transition hover:text-epms-950"
      @click="showAll = !showAll"
    >
      {{ showAll ? 'Show less' : 'Show more' }}
    </button>
  </div>
</template>
