<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const model = defineModel<string[]>({ required: true })

const props = withDefaults(
  defineProps<{
    suggestions?: string[]
    readonly?: boolean
    placeholder?: string
    inputId?: string
  }>(),
  {
    suggestions: () => [],
    placeholder: 'Type and press Enter',
    inputId: undefined,
  },
)

const input = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const dropdownOpen = ref(false)
const highlightedIndex = ref(-1)
const dropdownStyle = ref({ top: '0px', left: '0px', width: '0px' })

const suggestionList = computed(() => props.suggestions ?? [])

const selectedKeys = computed(() => new Set(model.value.map((tag) => tag.toLowerCase())))

const availableSuggestions = computed(() => {
  const needle = input.value.trim().toLowerCase()

  return suggestionList.value
    .filter((suggestion) => {
      const key = suggestion.toLowerCase()
      if (selectedKeys.value.has(key)) return false
      if (!needle) return true
      return key.includes(needle)
    })
    .slice(0, 12)
})

const showSuggestions = computed(
  () => !props.readonly && dropdownOpen.value && availableSuggestions.value.length > 0,
)

const containerClass = computed(() =>
  props.readonly
    ? 'flex min-h-[2.75rem] flex-wrap items-center gap-2 rounded-xl px-3 py-2 field-readonly'
    : 'flex min-h-[2.75rem] flex-wrap items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 focus-within:border-epms-500 focus-within:ring-2 focus-within:ring-epms-600/20',
)

const badgeClass =
  'inline-flex items-center gap-1 rounded-full bg-epms-100 px-2.5 py-0.5 text-xs font-semibold text-epms-800'

watch(input, () => {
  highlightedIndex.value = -1
})

watch(showSuggestions, async (visible) => {
  if (!visible) return
  await nextTick()
  updateDropdownPosition()
})

watch(suggestionList, async () => {
  if (!dropdownOpen.value) return
  await nextTick()
  updateDropdownPosition()
})

function updateDropdownPosition() {
  if (!rootRef.value) return

  const rect = rootRef.value.getBoundingClientRect()
  dropdownStyle.value = {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${Math.max(rect.width, 200)}px`,
  }
}

function openDropdown() {
  if (props.readonly) return
  dropdownOpen.value = true
  void nextTick().then(updateDropdownPosition)
}

function closeDropdown() {
  dropdownOpen.value = false
  highlightedIndex.value = -1
}

function addTag(raw: string) {
  const tag = raw.trim()
  if (!tag) return

  const key = tag.toLowerCase()
  if (selectedKeys.value.has(key)) return

  model.value = [...model.value, tag]
  input.value = ''
  highlightedIndex.value = -1
  openDropdown()
  inputRef.value?.focus()
}

function removeTag(index: number) {
  model.value = model.value.filter((_, itemIndex) => itemIndex !== index)
}

function selectSuggestion(suggestion: string) {
  addTag(suggestion)
}

function handleDocumentMouseDown(event: MouseEvent) {
  const target = event.target as Node
  if (rootRef.value?.contains(target)) return
  if (dropdownRef.value?.contains(target)) return
  closeDropdown()
}

function onKeydown(event: KeyboardEvent) {
  if (showSuggestions.value) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      highlightedIndex.value = Math.min(
        highlightedIndex.value + 1,
        availableSuggestions.value.length - 1,
      )
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
      return
    }
  }

  if (event.key === 'Tab') {
    if (showSuggestions.value && highlightedIndex.value >= 0) {
      event.preventDefault()
      selectSuggestion(availableSuggestions.value[highlightedIndex.value]!)
      return
    }

    closeDropdown()
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    if (highlightedIndex.value >= 0 && showSuggestions.value) {
      selectSuggestion(availableSuggestions.value[highlightedIndex.value]!)
      return
    }

    addTag(input.value)
    return
  }

  if (event.key === 'Backspace' && !input.value && model.value.length > 0) {
    model.value = model.value.slice(0, -1)
  }

  if (event.key === 'Escape') {
    if (dropdownOpen.value || input.value) {
      event.stopPropagation()
      closeDropdown()
      input.value = ''
      return
    }
  }
}

function onInputBlur(event: FocusEvent) {
  const relatedTarget = event.relatedTarget as Node | null
  if (relatedTarget && dropdownRef.value?.contains(relatedTarget)) return
  closeDropdown()
}

function focusInput() {
  if (!props.readonly) {
    inputRef.value?.focus()
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleDocumentMouseDown)
  window.addEventListener('resize', updateDropdownPosition)
  window.addEventListener('scroll', updateDropdownPosition, true)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleDocumentMouseDown)
  window.removeEventListener('resize', updateDropdownPosition)
  window.removeEventListener('scroll', updateDropdownPosition, true)
})
</script>

<template>
  <div ref="rootRef" class="relative mt-1" data-tag-input-field>
    <div :class="containerClass" @click="focusInput">
      <template v-if="model.length > 0">
        <span
          v-for="(tag, index) in model"
          :key="`${tag}-${index}`"
          :class="badgeClass"
        >
          {{ tag }}
          <button
            v-if="!readonly"
            type="button"
            class="rounded-full p-0.5 text-epms-800 transition hover:bg-epms-200/70 hover:text-epms-900"
            :aria-label="`Remove ${tag}`"
            @click.stop="removeTag(index)"
          >
            ×
          </button>
        </span>
      </template>
      <span v-else-if="readonly" class="text-sm text-stone-500">—</span>

      <input
        v-if="!readonly"
        :id="inputId"
        ref="inputRef"
        v-model="input"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="showSuggestions"
        :placeholder="model.length === 0 ? placeholder : ''"
        class="min-w-[8rem] flex-1 border-0 bg-transparent py-1 text-sm text-stone-900 outline-none placeholder:text-stone-400"
        @keydown="onKeydown"
        @focus="openDropdown"
        @input="openDropdown"
        @blur="onInputBlur"
      />
    </div>

    <Teleport to="body">
      <div
        v-if="showSuggestions"
        ref="dropdownRef"
        class="fixed z-[80] max-h-48 overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-lg"
        :style="dropdownStyle"
        role="listbox"
      >
        <button
          v-for="(suggestion, index) in availableSuggestions"
          :key="suggestion"
          type="button"
          role="option"
          :aria-selected="index === highlightedIndex"
          class="block w-full px-3 py-2 text-left text-sm transition"
          :class="index === highlightedIndex ? 'bg-epms-50 text-epms-900' : 'text-stone-800 hover:bg-epms-50'"
          @mousedown.prevent
          @click="selectSuggestion(suggestion)"
        >
          {{ suggestion }}
        </button>
      </div>
    </Teleport>
  </div>
</template>
