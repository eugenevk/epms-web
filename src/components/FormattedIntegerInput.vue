<script setup lang="ts">
import { ref, watch } from 'vue'
import { formatInteger, parseLocaleInteger } from '@/lib/formatNumber'

const model = defineModel<number>({ required: true })

const props = defineProps<{
  readonly?: boolean
  inputClass?: string
  min?: number
}>()

const inputValue = ref('')
const isFocused = ref(false)

watch(
  () => model.value,
  () => {
    if (!isFocused.value) {
      syncDisplay()
    }
  },
  { immediate: true },
)

function syncDisplay() {
  inputValue.value = formatInteger(model.value)
  if (inputValue.value === '—') {
    inputValue.value = ''
  }
}

function onFocus() {
  if (props.readonly) return
  isFocused.value = true
  inputValue.value = String(model.value)
}

function onBlur() {
  if (props.readonly) return
  isFocused.value = false
  commitValue()
  syncDisplay()
}

function onInput(event: Event) {
  if (props.readonly) return
  const value = (event.target as HTMLInputElement).value
  inputValue.value = value
  let parsed = parseLocaleInteger(value)
  if (props.min !== undefined) {
    parsed = Math.max(props.min, parsed)
  }
  model.value = parsed
}

function commitValue() {
  let parsed = parseLocaleInteger(inputValue.value)
  if (props.min !== undefined) {
    parsed = Math.max(props.min, parsed)
  }
  model.value = parsed
}
</script>

<template>
  <input
    :value="inputValue"
    type="text"
    inputmode="numeric"
    :readonly="readonly"
    :class="inputClass"
    @focus="onFocus"
    @blur="onBlur"
    @input="onInput"
  />
</template>
