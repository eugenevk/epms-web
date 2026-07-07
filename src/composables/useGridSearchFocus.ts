import { nextTick, ref } from 'vue'

export function useGridSearchFocus() {
  const searchInputRef = ref<HTMLInputElement | null>(null)

  async function focusSearchInput() {
    await nextTick()
    searchInputRef.value?.focus()
  }

  return { searchInputRef, focusSearchInput }
}
