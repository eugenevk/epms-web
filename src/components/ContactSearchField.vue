<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDropdownListKeyboard } from '@/composables/useDropdownListKeyboard'
import type { ObjectRef } from '@/lib/companies'
import { contactDisplayName, searchContacts, type ContactHit } from '@/lib/contactsAlgolia'

const model = defineModel<ObjectRef | null>({ required: true })

const props = withDefaults(
  defineProps<{
    readonly?: boolean
    label?: string
    excludeContactId?: string | null
  }>(),
  {
    label: 'Reports into',
  },
)

const query = ref('')
const results = ref<ContactHit[]>([])
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
  onSelect: (contact) => selectContact(contact),
  onClose: () => {
    open.value = false
  },
})

async function search(value: string) {
  const needle = value.trim()
  if (!needle) {
    results.value = []
    return
  }

  loading.value = true
  try {
    const response = await searchContacts({ query: needle, sort: 'name-asc' })
    results.value = response.hits
      .filter((contact) => contact.id !== props.excludeContactId && contact.objectID !== props.excludeContactId)
      .slice(0, 8)
  } finally {
    loading.value = false
  }
}

function selectContact(contact: ContactHit) {
  model.value = {
    id: contact.id ?? contact.objectID,
    objectLabel: contactDisplayName(contact),
  }
  query.value = contactDisplayName(contact)
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
        placeholder="Search contact…"
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
          v-for="(contact, index) in results"
          :key="contact.objectID"
          type="button"
          role="option"
          :aria-selected="isHighlighted(index)"
          :class="highlightedOptionClass(index, 'block w-full px-3 py-2 text-left text-sm text-stone-800 hover:bg-epms-50')"
          @mousedown.prevent
          @click="selectContact(contact)"
        >
          <span class="font-medium">{{ contactDisplayName(contact) }}</span>
          <span v-if="contact.company?.objectLabel" class="mt-0.5 block text-xs text-stone-500">
            {{ contact.company.objectLabel }}
          </span>
        </button>
      </div>
    </div>
  </label>
</template>
