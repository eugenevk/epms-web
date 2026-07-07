<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useDropdownListKeyboard } from '@/composables/useDropdownListKeyboard'
import type { LabeledValue } from '@/lib/companies'
import {
  countryFlagEmoji,
  isRestCountriesConfigured,
  loadCountryOptions,
  type CountryOption,
} from '@/lib/restCountries'

const model = defineModel<LabeledValue | null>({ default: null })

const props = defineProps<{
  readonly?: boolean
  inputClass?: string
}>()

const countries = ref<CountryOption[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const open = ref(false)
const query = ref('')
const rootRef = ref<HTMLElement | null>(null)
const searchRef = ref<HTMLInputElement | null>(null)

const fieldClass = computed(
  () =>
    props.inputClass ??
    (props.readonly
      ? 'mt-1 w-full rounded-xl px-3 py-2.5 text-sm field-readonly'
      : 'mt-1 w-full rounded-xl px-3 py-2.5 text-sm text-stone-900 field-focus'),
)

const filteredCountries = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return countries.value

  return countries.value.filter((country) => {
    return (
      country.label.toLowerCase().includes(needle) ||
      country.value.toLowerCase().includes(needle)
    )
  })
})

const selectedCountry = computed(() => {
  if (!model.value) return null
  return (
    countries.value.find((country) => country.value === model.value?.value) ?? model.value
  )
})

const { highlightedOptionClass, isHighlighted, onListKeydown } = useDropdownListKeyboard({
  items: filteredCountries,
  isOpen: computed(() => open.value && filteredCountries.value.length > 0),
  onSelect: (country) => selectCountry(country),
  onClose: () => {
    open.value = false
  },
})

watch(open, (isOpen) => {
  if (!isOpen) {
    query.value = ''
    return
  }

  window.setTimeout(() => searchRef.value?.focus(), 0)
})

onMounted(async () => {
  document.addEventListener('mousedown', handleDocumentMouseDown)

  if (!isRestCountriesConfigured()) {
    loading.value = false
    loadError.value = 'REST Countries API key is not configured.'
    return
  }

  try {
    countries.value = await loadCountryOptions()
  } catch (error) {
    loadError.value =
      error instanceof Error ? error.message : 'Could not load countries from REST Countries.'
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleDocumentMouseDown)
})

function handleDocumentMouseDown(event: MouseEvent) {
  if (!rootRef.value?.contains(event.target as Node)) {
    open.value = false
  }
}

function toggleOpen() {
  if (props.readonly || loading.value || loadError.value) return
  open.value = !open.value
}

function selectCountry(country: CountryOption | null) {
  model.value = country ? { label: country.label, value: country.value } : null
  open.value = false
  query.value = ''
}

function onSearchKeydown(event: KeyboardEvent) {
  if (onListKeydown(event)) return

  if (event.key === 'Enter' && filteredCountries.value.length === 1) {
    event.preventDefault()
    event.stopPropagation()
    selectCountry(filteredCountries.value[0] ?? null)
  }
}
</script>

<template>
  <div v-if="readonly" :class="fieldClass">
    <span v-if="selectedCountry" class="inline-flex items-center gap-2">
      <span aria-hidden="true">{{ countryFlagEmoji(selectedCountry) }}</span>
      <span>{{ selectedCountry.label }}</span>
    </span>
    <span v-else class="text-stone-500">—</span>
  </div>

    <div
      v-else
      ref="rootRef"
      class="relative mt-1"
      data-dropdown-combobox
      :data-dropdown-open="open && filteredCountries.length > 0 ? 'true' : null"
    >
    <button
      type="button"
      class="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-normal text-stone-900 field-focus disabled:cursor-not-allowed disabled:opacity-60"
      :class="{ 'ring-2 ring-epms-600/30 border-epms-600': open }"
      :disabled="loading || Boolean(loadError)"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="toggleOpen"
    >
      <span v-if="loading" class="text-stone-500">Loading countries…</span>
      <span v-else-if="loadError" class="text-red-700">{{ loadError }}</span>
      <span v-else-if="selectedCountry" class="inline-flex min-w-0 items-center gap-2">
        <span aria-hidden="true">{{ countryFlagEmoji(selectedCountry) }}</span>
        <span class="truncate">{{ selectedCountry.label }}</span>
      </span>
      <span v-else class="text-stone-500">Select country</span>

      <svg
        class="h-4 w-4 shrink-0 text-stone-500 transition"
        :class="{ 'rotate-180': open }"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
          clip-rule="evenodd"
        />
      </svg>
    </button>

    <div
      v-if="open"
      class="absolute z-20 mt-1 max-h-72 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg"
    >
      <div class="border-b border-stone-200 p-2">
        <input
          ref="searchRef"
          v-model="query"
          type="search"
          placeholder="Search country…"
          class="w-full rounded-lg border-[0.5px] border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-epms-600 focus:ring-2 focus:ring-epms-600/30"
          @keydown="onSearchKeydown"
        />
      </div>

      <ul role="listbox" class="max-h-56 overflow-y-auto py-1">
        <li>
          <button
            type="button"
            class="flex w-full items-center px-3 py-2 text-left text-sm text-stone-500 transition hover:bg-stone-50"
            @click="selectCountry(null)"
          >
            Clear selection
          </button>
        </li>
        <li v-for="(country, index) in filteredCountries" :key="country.value">
          <button
            type="button"
            role="option"
            :class="highlightedOptionClass(
              index,
              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stone-900 transition hover:bg-epms-50',
            )"
            :aria-selected="isHighlighted(index) || country.value === model?.value"
            @click="selectCountry(country)"
          >
            <span aria-hidden="true">{{ countryFlagEmoji(country) }}</span>
            <span class="truncate">{{ country.label }}</span>
            <span class="ml-auto text-xs text-stone-400">{{ country.value }}</span>
          </button>
        </li>
        <li v-if="filteredCountries.length === 0" class="px-3 py-3 text-sm text-stone-500">
          No countries match your search.
        </li>
      </ul>
    </div>
  </div>
</template>
