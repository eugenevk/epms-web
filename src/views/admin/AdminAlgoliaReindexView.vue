<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import {
  ALGOLIA_REINDEX_OPTIONS,
  reindexAlgoliaIndices,
  type AlgoliaReindexCollection,
  type AlgoliaReindexResult,
} from '@/lib/algoliaReindex'

const toast = useToast()

const selectedIndices = ref<AlgoliaReindexCollection[]>([])
const running = ref(false)
const results = ref<AlgoliaReindexResult[]>([])
const lastError = ref<string | null>(null)

const allSelected = computed(
  () => selectedIndices.value.length === ALGOLIA_REINDEX_OPTIONS.length,
)

function toggleIndex(id: AlgoliaReindexCollection, checked: boolean) {
  if (checked) {
    if (!selectedIndices.value.includes(id)) {
      selectedIndices.value = [...selectedIndices.value, id]
    }
    return
  }

  selectedIndices.value = selectedIndices.value.filter((value) => value !== id)
}

function toggleAll(checked: boolean) {
  selectedIndices.value = checked
    ? ALGOLIA_REINDEX_OPTIONS.map((option) => option.id)
    : []
}

async function runReindex() {
  if (selectedIndices.value.length === 0) {
    toast.showError('Select at least one index.')
    return
  }

  running.value = true
  results.value = []
  lastError.value = null

  try {
    results.value = await reindexAlgoliaIndices(selectedIndices.value)
    const total = results.value.reduce((sum, item) => sum + item.count, 0)
    toast.showSuccess(`Re-index complete (${total.toLocaleString()} records).`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Re-index failed.'
    lastError.value = message
    toast.showError(message)
  } finally {
    running.value = false
  }
}
</script>

<template>
  <section class="w-full">
    <div class="rounded-2xl border border-epms-200 bg-white p-6 shadow-sm">
      <p class="text-sm font-semibold uppercase tracking-wide text-epms-700">Admin</p>
      <h1 class="mt-1 text-2xl font-bold text-epms-900">Algolia re-index</h1>
      <p class="mt-2 text-sm leading-6 text-stone-600">
        Rebuild search indices from Firestore. Use this after changing data outside epms-web or
        when search results are out of date. Large indices can take several minutes.
      </p>

      <div class="mt-6 space-y-4">
        <div class="flex items-center justify-between gap-4">
          <p class="text-sm font-semibold text-stone-700">Indices</p>
          <label class="inline-flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              :checked="allSelected"
              :disabled="running"
              @change="toggleAll(($event.target as HTMLInputElement).checked)"
            />
            Select all
          </label>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label
            v-for="option in ALGOLIA_REINDEX_OPTIONS"
            :key="option.id"
            class="flex items-center gap-3 rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-800"
          >
            <input
              type="checkbox"
              :checked="selectedIndices.includes(option.id)"
              :disabled="running"
              @change="toggleIndex(option.id, ($event.target as HTMLInputElement).checked)"
            />
            <span class="font-medium">{{ option.label }}</span>
            <span class="ml-auto text-xs text-stone-500">{{ option.id }}</span>
          </label>
        </div>
      </div>

      <button
        type="button"
        class="mt-6 rounded-lg bg-epms-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-epms-800 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="running || selectedIndices.length === 0"
        @click="runReindex"
      >
        {{ running ? 'Re-indexing…' : 'Start re-index' }}
      </button>

      <p
        v-if="lastError"
        class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      >
        {{ lastError }}
      </p>

      <div
        v-if="results.length > 0"
        class="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4"
      >
        <p class="text-sm font-semibold text-emerald-900">Re-index successful</p>
        <ul class="mt-3 space-y-2 text-sm text-emerald-800">
          <li v-for="result in results" :key="result.collection" class="flex justify-between gap-4">
            <span class="font-medium">{{ result.collection }}</span>
            <span>{{ result.count.toLocaleString() }} records</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
