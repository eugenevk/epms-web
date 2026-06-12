import algoliasearch, { type SearchClient, type SearchIndex } from 'algoliasearch/lite'

let client: SearchClient | null = null
const indices = new Map<string, SearchIndex>()

export function isAlgoliaConfigured(): boolean {
  return Boolean(import.meta.env.VITE_ALGOLIA_APP_ID && import.meta.env.VITE_ALGOLIA_SEARCH_KEY)
}

export function getAlgoliaClient(): SearchClient {
  if (!client) {
    const appId = import.meta.env.VITE_ALGOLIA_APP_ID
    const searchKey = import.meta.env.VITE_ALGOLIA_SEARCH_KEY
    if (!appId || !searchKey) {
      throw new Error('Algolia is niet geconfigureerd. Vul VITE_ALGOLIA_* in .env in.')
    }
    client = algoliasearch(appId, searchKey)
  }
  return client
}

export function getAlgoliaIndex(indexName: string): SearchIndex {
  let index = indices.get(indexName)
  if (!index) {
    index = getAlgoliaClient().initIndex(indexName)
    indices.set(indexName, index)
  }
  return index
}
