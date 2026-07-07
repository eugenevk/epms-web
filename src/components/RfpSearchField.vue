<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useDropdownListKeyboard } from '@/composables/useDropdownListKeyboard'
import type { ObjectRef } from '@/lib/companies'
import { rfpDisplayTitle } from '@/lib/rfps'
import { searchRfps, type RfpHit } from '@/lib/rfpsAlgolia'

const model = defineModel<ObjectRef | null>({ required: true })

const props = withDefaults(
  defineProps<{
    readonly?: boolean
    label?: string
  }>(),
  {
    label: 'RFP',
  },
)

const query = ref('')
const results = ref<RfpHit[]>([])
const loading = ref(false)
const open = ref(false)

let debounceTimer: number | undefined

watch(
  () => model.value?.objectLabel,
  (value) => {
    if (value && !open.value) {
      query.value = value
    }
  },
  { immediate: true },
)

watch(query, (value) => {
  if (props.readonly) return

  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    void search(value)
  }, 250)
})

const labelClass = computed(() =>
  props.readonly
    ? 'block text-sm font-semibold text-stone-700'
    : 'block text-sm font-semibold text-stone-800',
)

const fieldClass = computed(() =>
  props.readonly
    ? 'mt-1 block w-full rounded-xl px-3 py-2.5 text-sm field-readonly'
    : 'w-full rounded-xl px-3 py-2.5 text-sm text-stone-900 field-focus',
)

const navigableResults = computed(() => (loading.value ? [] : results.value))

const { highlightedOptionClass, isHighlighted, onListKeydown } = useDropdownListKeyboard({
  items: navigableResults,
  isOpen: computed(() => open.value && navigableResults.value.length > 0),
  onSelect: (rfp) => selectRfp(rfp),
  onClose: () => {
    open.value = false
  },
})

onMounted(() => {
  if (model.value?.objectLabel) {
    query.value = model.value.objectLabel
  }
})

async function search(value: string) {
  const needle = value.trim()
  if (!needle) {
    results.value = []
    return
  }

  loading.value = true
  try {
    const response = await searchRfps({ query: needle, sort: 'title-asc' })
    results.value = response.hits.slice(0, 8)
  } finally {
    loading.value = false
  }
}

function rfpSearchContext(rfp: RfpHit): string {
  const parts = [rfp.company?.objectLabel?.trim(), rfp.opportunity?.objectLabel?.trim()].filter(Boolean)
  return parts.join(' · ')
}

function selectRfp(rfp: RfpHit) {
  model.value = {
    id: rfp.id ?? rfp.objectID,
    objectLabel: rfpDisplayTitle(rfp),
  }
  query.value = rfpDisplayTitle(rfp)
  open.value = false
  results.value = []
}

function clearSelection() {
  model.value = null
  query.value = ''
  results.value = []
}

function onFocus() {
  if (props.readonly) return
  open.value = true
  if (query.value.trim()) {
    void search(query.value)
  }
}

function onBlur() {
  window.setTimeout(() => {
    open.value = false
  }, 150)
}

function onInputKeydown(event: KeyboardEvent) {
  onListKeydown(event)
}
</script>

<template>
  <label :class="labelClass">
    {{ label }}
    <span
      v-if="readonly"
      :class="[fieldClass, model?.objectLabel ? 'text-stone-600' : 'text-stone-500']"
    >
      {{ model?.objectLabel || '—' }}
    </span>
    <div
      v-else
      class="relative mt-1"
      data-dropdown-combobox
      :data-dropdown-open="open && navigableResults.length > 0 ? 'true' : null"
    >
      <input
        v-model="query"
        type="search"
        placeholder="Search RFP…"
        :class="fieldClass"
        @focus="onFocus"
        @blur="onBlur"
        @keydown="onInputKeydown"
      />
      <button
        v-if="!readonly && model"
        type="button"
        class="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-800"
        @mousedown.prevent
        @click="clearSelection"
      >
        Clear
      </button>
      <div
        v-if="open && !readonly && (loading || results.length > 0)"
        class="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-lg"
      >
        <p v-if="loading" class="px-3 py-2 text-sm text-stone-500">Searching…</p>
        <button
          v-for="(rfp, index) in results"
          :key="rfp.objectID"
          type="button"
          role="option"
          :aria-selected="isHighlighted(index)"
          :class="highlightedOptionClass(index, 'block w-full px-3 py-2 text-left text-sm text-stone-800 hover:bg-epms-50')"
          @mousedown.prevent
          @click="selectRfp(rfp)"
        >
          <span class="font-medium">{{ rfpDisplayTitle(rfp) }}</span>
          <span v-if="rfpSearchContext(rfp)" class="mt-0.5 block text-xs text-stone-500">
            {{ rfpSearchContext(rfp) }}
          </span>
        </button>
      </div>
    </div>
  </label>
</template>
