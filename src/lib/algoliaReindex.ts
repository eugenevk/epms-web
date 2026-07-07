import { httpsCallable } from 'firebase/functions'
import { assertCurrentUserIsAdmin } from '@/lib/adminAuth'
import { getCallableErrorMessage } from '@/lib/callableError'
import { getFirebaseFunctions } from '@/lib/firebase'

export const ALGOLIA_REINDEX_OPTIONS = [
  { id: 'companies', label: 'Companies' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'notes', label: 'Notes' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'rfps', label: "RFP's" },
  { id: 'deals', label: 'Deals' },
  { id: 'products', label: 'Products & services (offered)' },
  { id: 'productsInUse', label: 'Products & services (in use)' },
  { id: 'tasks', label: 'Tasks' },
] as const

export type AlgoliaReindexCollection = (typeof ALGOLIA_REINDEX_OPTIONS)[number]['id']

export type AlgoliaReindexResult = {
  collection: string
  count: number
}

type ReindexAlgoliaResponse = {
  results: AlgoliaReindexResult[]
}

export async function reindexAlgoliaIndices(
  indices: AlgoliaReindexCollection[],
): Promise<AlgoliaReindexResult[]> {
  await assertCurrentUserIsAdmin()

  const callable = httpsCallable<{ indices: string[] }, ReindexAlgoliaResponse>(
    getFirebaseFunctions(),
    'reindexAlgolia',
  )

  try {
    const response = await callable({ indices })
    return response.data.results
  } catch (error) {
    throw new Error(getCallableErrorMessage(error))
  }
}
