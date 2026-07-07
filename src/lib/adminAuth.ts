import { getIdTokenResult } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase'

export async function assertCurrentUserIsAdmin() {
  const user = getFirebaseAuth().currentUser
  if (!user) {
    throw new Error('You must be signed in to perform this action.')
  }

  const token = await getIdTokenResult(user)
  if (!token.claims.admin && token.claims.role !== 'admin') {
    throw new Error('Only administrators may perform this action.')
  }

  return user
}
