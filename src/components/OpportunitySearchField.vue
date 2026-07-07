<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useDropdownListKeyboard } from '@/composables/useDropdownListKeyboard'
import type { ObjectRef } from '@/lib/companies'
import { opportunityDisplayTitle } from '@/lib/opportunities'
import { searchCompanyOpportunities, searchOpportunities, type OpportunityHit } from '@/lib/opportunitiesAlgolia'

const model = defineModel<ObjectRef | null>({ required: true })

const props = withDefaults(
  defineProps<{
    readonly?: boolean
    label?: string
    companyId?: string | null
    companyLabel?: string | null
  }>(),
  {
    label: 'Opportunity',
  },
)

const query = ref('')
const results = ref<OpportunityHit[]>([])
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

watch(
  () => [props.companyId, props.companyLabel] as const,
  () => {
    if (!props.readonly && open.value) {
      void search(query.value)
    }
  },
)

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

const disabled = computed(() => {
  if (props.readonly) return true
  const scopedToCompany = props.companyId !== undefined || props.companyLabel !== undefined
  return scopedToCompany && !props.companyId
})

const placeholder = computed(() =>
  disabled.value && !props.readonly ? 'Select a company first' : 'Search opportunity…',
)

const navigableResults = computed(() => (loading.value ? [] : results.value))

const { highlightedOptionClass, isHighlighted, onListKeydown } = useDropdownListKeyboard({
  items: navigableResults,
  isOpen: computed(() => open.value && !disabled.value && navigableResults.value.length > 0),
  onSelect: (opportunity) => selectOpportunity(opportunity),
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
  if (!needle && !props.companyId) {
    results.value = []
    return
  }

  loading.value = true
  try {
    if (props.companyId && props.companyLabel) {
      const response = await searchCompanyOpportunities({
        companyId: props.companyId,
        companyLabel: props.companyLabel,
        query: needle,
      })
      results.value = response.hits.slice(0, 8)
      return
    }

    const response = await searchOpportunities({ query: needle })
    results.value = response.hits.slice(0, 8)
  } finally {
    loading.value = false
  }
}

function selectOpportunity(opportunity: OpportunityHit) {
  model.value = {
    id: opportunity.id ?? opportunity.objectID,
    objectLabel: opportunityDisplayTitle(opportunity),
  }
  query.value = opportunityDisplayTitle(opportunity)
  open.value = false
  results.value = []
}

function clearSelection() {
  model.value = null
  query.value = ''
  results.value = []
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
      :data-dropdown-open="open && !disabled && navigableResults.length > 0 ? 'true' : null"
    >
      <input
        v-model="query"
        type="search"
        :readonly="readonly"
        :disabled="disabled"
        :placeholder="placeholder"
        :class="fieldClass"
        @focus="open = true"
        @blur="onBlur"
        @keydown="onInputKeydown"
      />
      <button
        v-if="model && !readonly"
        type="button"
        class="absolute inset-y-0 right-0 px-3 text-sm text-stone-500 hover:text-stone-700"
        @mousedown.prevent
        @click="clearSelection"
      >
        Clear
      </button>
      <div
        v-if="open && !readonly && !disabled && (results.length > 0 || loading)"
        class="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-stone-200 bg-white py-1 shadow-lg"
      >
        <p v-if="loading" class="px-3 py-2 text-sm text-stone-500">Searching…</p>
        <button
          v-for="(opportunity, index) in results"
          :key="opportunity.objectID"
          type="button"
          role="option"
          :aria-selected="isHighlighted(index)"
          :class="highlightedOptionClass(index, 'block w-full px-3 py-2 text-left text-sm text-stone-800 hover:bg-epms-50')"
          @mousedown.prevent
          @click="selectOpportunity(opportunity)"
        >
          <span class="font-medium">{{ opportunityDisplayTitle(opportunity) }}</span>
          <span v-if="opportunity.company?.objectLabel" class="mt-0.5 block text-xs text-stone-500">
            {{ opportunity.company.objectLabel }}
          </span>
        </button>
      </div>
    </div>
  </label>
</template>
