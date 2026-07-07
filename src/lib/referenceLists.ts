import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase'

export type ListOption = {
  label: string
  value: string
}

export async function loadListOptions(listId: string): Promise<ListOption[]> {
  const listsSnapshot = await getDocs(
    query(collection(getFirebaseDb(), 'lists'), where('listId', '==', listId)),
  )

  const listDoc = listsSnapshot.docs[0]
  if (!listDoc) return []

  const itemsSnapshot = await getDocs(
    query(collection(getFirebaseDb(), 'lists', listDoc.id, 'items'), orderBy('order', 'asc')),
  )

  return itemsSnapshot.docs
    .map((document) => {
      const data = document.data()
      return {
        label: typeof data.label === 'string' ? data.label : '',
        value: typeof data.value === 'string' ? data.value : '',
      }
    })
    .filter((option) => option.label && option.value)
}
