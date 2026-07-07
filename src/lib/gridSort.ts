export type SortDirection = 'asc' | 'desc'

export type GridSortState = {
  column: string
  direction: SortDirection
}

export type GridSortClickOptions = {
  additive?: boolean
  removeSecondary?: boolean
}

export function normalizeGridSortState(
  state: GridSortState | GridSortState[] | null | undefined,
): GridSortState[] {
  if (!state) return []
  return Array.isArray(state) ? [...state] : [state]
}

export function toggleGridSort(
  state: GridSortState[],
  column: string,
  defaultDirection: SortDirection = 'asc',
  options: GridSortClickOptions | boolean = false,
): GridSortState[] {
  const { additive, removeSecondary } =
    typeof options === 'boolean'
      ? { additive: options, removeSecondary: false }
      : { additive: options.additive ?? false, removeSecondary: options.removeSecondary ?? false }

  const existingIndex = state.findIndex((entry) => entry.column === column)

  if (!additive) {
    if (state.length === 1 && state[0]?.column === column) {
      return [{ column, direction: state[0].direction === 'asc' ? 'desc' : 'asc' }]
    }

    const existing = existingIndex >= 0 ? state[existingIndex] : undefined
    return [{ column, direction: existing?.direction ?? defaultDirection }]
  }

  if (removeSecondary && existingIndex > 0) {
    return state.filter((_, index) => index !== existingIndex)
  }

  if (existingIndex >= 0) {
    const next = [...state]
    const current = state[existingIndex]
    next[existingIndex] = {
      column,
      direction: current.direction === 'asc' ? 'desc' : 'asc',
    }
    return next
  }

  return [...state, { column, direction: defaultDirection }]
}

export function compareSortValues(
  left: unknown,
  right: unknown,
  direction: SortDirection,
): number {
  const multiplier = direction === 'asc' ? 1 : -1

  if (left == null && right == null) return 0
  if (left == null) return 1
  if (right == null) return -1

  if (typeof left === 'number' && typeof right === 'number') {
    return (left - right) * multiplier
  }

  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return (Number(left) - Number(right)) * multiplier
  }

  return (
    String(left).localeCompare(String(right), 'en', { sensitivity: 'base', numeric: true }) *
    multiplier
  )
}

export function sortGridItems<T>(
  items: T[],
  state: GridSortState | GridSortState[] | null | undefined,
  accessors: Record<string, (item: T) => unknown>,
): T[] {
  const sortState = normalizeGridSortState(state)
  if (sortState.length === 0) return items

  return [...items].sort((left, right) => {
    for (const { column, direction } of sortState) {
      const accessor = accessors[column]
      if (!accessor) continue

      const comparison = compareSortValues(accessor(left), accessor(right), direction)
      if (comparison !== 0) return comparison
    }

    return 0
  })
}

export function getColumnSortState(
  state: GridSortState[],
  column: string,
): { direction: SortDirection; priority: number } | null {
  const index = state.findIndex((entry) => entry.column === column)
  if (index === -1) return null

  return {
    direction: state[index].direction,
    priority: index + 1,
  }
}
