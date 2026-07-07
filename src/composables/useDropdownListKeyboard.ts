import { ref, watch, type MaybeRefOrGetter, toValue } from 'vue'

type DropdownListKeyboardOptions<T> = {
  items: MaybeRefOrGetter<readonly T[]>
  isOpen: MaybeRefOrGetter<boolean>
  onSelect: (item: T, index: number) => void
  onClose?: () => void
}

export function useDropdownListKeyboard<T>(options: DropdownListKeyboardOptions<T>) {
  const highlightedIndex = ref(-1)

  watch(
    () => toValue(options.items),
    () => {
      highlightedIndex.value = -1
    },
  )

  watch(
    () => toValue(options.isOpen),
    (open) => {
      if (!open) highlightedIndex.value = -1
    },
  )

  function isHighlighted(index: number): boolean {
    return index === highlightedIndex.value
  }

  function highlightedOptionClass(index: number, baseClass: string): string {
    return isHighlighted(index) ? `${baseClass} bg-epms-50 text-epms-900` : baseClass
  }

  function onListKeydown(event: KeyboardEvent): boolean {
    const items = toValue(options.items)
    const open = toValue(options.isOpen)

    if (!open || items.length === 0) return false

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      highlightedIndex.value = Math.min(highlightedIndex.value + 1, items.length - 1)
      return true
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
      return true
    }

    if (event.key === 'Enter' && highlightedIndex.value >= 0) {
      event.preventDefault()
      event.stopPropagation()
      options.onSelect(items[highlightedIndex.value]!, highlightedIndex.value)
      return true
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      highlightedIndex.value = -1
      options.onClose?.()
      return true
    }

    return false
  }

  return {
    highlightedIndex,
    isHighlighted,
    highlightedOptionClass,
    onListKeydown,
  }
}
