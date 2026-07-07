import { loadAllKbArticlesFromFirestore } from '@/lib/kbArticles'
import { loadListOptions } from '@/lib/referenceLists'

function uniqueSorted(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }

  return result.sort((left, right) => left.localeCompare(right, 'en', { sensitivity: 'base' }))
}

export function formatKbArticleCategories(categories: string[] | undefined): string {
  if (!categories?.length) return '—'
  return categories.join(', ')
}

export async function loadKbCategorySuggestions(): Promise<string[]> {
  const [listResult, articlesResult] = await Promise.allSettled([
    loadListOptions('kbCategories'),
    loadAllKbArticlesFromFirestore(),
  ])

  const fromList =
    listResult.status === 'fulfilled' ? listResult.value.map((option) => option.label) : []
  const fromArticles =
    articlesResult.status === 'fulfilled'
      ? articlesResult.value.flatMap((article) => article.categories ?? [])
      : []

  return uniqueSorted([...fromList, ...fromArticles])
}
