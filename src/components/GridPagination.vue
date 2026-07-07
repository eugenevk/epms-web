<script setup lang="ts">
import { computed } from 'vue'
import { formatInteger } from '@/lib/formatNumber'
import { getVisiblePageNumbers } from '@/lib/gridPagination'

const props = defineProps<{
  page: number
  nbPages: number
  rangeStart: number
  rangeEnd: number
  nbHits: number
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:page': [page: number]
}>()

const visiblePages = computed(() => getVisiblePageNumbers(props.page, props.nbPages))

const buttonClass =
  'inline-flex min-w-[2.25rem] items-center justify-center rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50'

const activePageClass =
  'inline-flex min-w-[2.25rem] items-center justify-center rounded-lg border border-epms-700 bg-epms-700 px-2.5 py-1.5 text-sm font-semibold text-white'
</script>

<template>
  <div
    v-if="nbHits > 0"
    class="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 bg-white px-4 py-3 text-sm text-stone-600"
  >
    <p>
      Showing {{ formatInteger(rangeStart) }}–{{ formatInteger(rangeEnd) }} of
      {{ formatInteger(nbHits) }}
    </p>

    <nav class="flex flex-wrap items-center gap-1" aria-label="Pagination">
      <button
        type="button"
        :class="buttonClass"
        :disabled="loading || page <= 0"
        aria-label="Previous page"
        @click="emit('update:page', page - 1)"
      >
        ‹
      </button>

      <template v-for="(item, index) in visiblePages" :key="`${item}-${index}`">
        <span v-if="item === 'ellipsis'" class="px-1 text-stone-400">…</span>
        <button
          v-else
          type="button"
          :class="item === page ? activePageClass : buttonClass"
          :disabled="loading"
          :aria-current="item === page ? 'page' : undefined"
          @click="emit('update:page', item)"
        >
          {{ item + 1 }}
        </button>
      </template>

      <button
        type="button"
        :class="buttonClass"
        :disabled="loading || page >= nbPages - 1"
        aria-label="Next page"
        @click="emit('update:page', page + 1)"
      >
        ›
      </button>
    </nav>
  </div>
</template>
