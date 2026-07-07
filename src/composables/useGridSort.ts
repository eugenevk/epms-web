import { computed, ref, type MaybeRefOrGetter, toValue } from 'vue'
import {
  normalizeGridSortState,
  sortGridItems,
  toggleGridSort,
  type GridSortClickOptions,
  type GridSortState,
  type SortDirection,
} from '@/lib/gridSort'

export function useGridSort<T>(
  items: MaybeRefOrGetter<T[]>,
  accessors: Record<string, (item: T) => unknown>,
  initialSort: GridSortState | GridSortState[] | null = null,
  defaultDirections: Partial<Record<string, SortDirection>> = {},
) {
  const sortState = ref<GridSortState[]>(normalizeGridSortState(initialSort))

  const sortedItems = computed(() =>
    sortGridItems(toValue(items), sortState.value, accessors),
  )

  function onSort(column: string, options: GridSortClickOptions | boolean = false) {
    const defaultDirection = defaultDirections[column] ?? 'asc'
    sortState.value = toggleGridSort(sortState.value, column, defaultDirection, options)
  }

  return { sortState, sortedItems, onSort }
}
