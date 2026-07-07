export const GRID_PAGE_SIZE = 25

export type PaginatedItems<T> = {
  items: T[]
  page: number
  nbPages: number
  rangeStart: number
  rangeEnd: number
}

export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize = GRID_PAGE_SIZE,
): PaginatedItems<T> {
  const nbHits = items.length
  const nbPages = Math.max(1, Math.ceil(nbHits / pageSize))
  const safePage = Math.min(Math.max(page, 0), nbPages - 1)
  const start = safePage * pageSize

  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    nbPages,
    rangeStart: nbHits === 0 ? 0 : start + 1,
    rangeEnd: Math.min(start + pageSize, nbHits),
  }
}

export function getVisiblePageNumbers(page: number, nbPages: number): Array<number | 'ellipsis'> {
  if (nbPages <= 1) {
    return [0]
  }

  if (nbPages <= 7) {
    return Array.from({ length: nbPages }, (_, index) => index)
  }

  const pages: number[] = [0]
  const start = Math.max(1, page - 1)
  const end = Math.min(nbPages - 2, page + 1)

  for (let index = start; index <= end; index += 1) {
    pages.push(index)
  }

  pages.push(nbPages - 1)

  const visible: Array<number | 'ellipsis'> = []
  let previous: number | undefined

  for (const pageNumber of pages) {
    if (previous !== undefined && pageNumber - previous > 1) {
      visible.push('ellipsis')
    }
    visible.push(pageNumber)
    previous = pageNumber
  }

  return visible
}
