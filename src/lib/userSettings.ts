import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase'

export type UserSettingsProfile = {
  documentId: string
  username: string
  name: string
  avatarUrl: string | null
  avatarPath: string | null
}

export async function loadCurrentUserSettings(): Promise<UserSettingsProfile> {
  const user = getFirebaseAuth().currentUser
  if (!user?.email) {
    throw new Error('You must be signed in.')
  }

  const snapshot = await getDocs(
    query(
      collection(getFirebaseDb(), 'userSettings'),
      where('username', '==', user.email),
      limit(1),
    ),
  )

  if (snapshot.empty) {
    throw new Error('User settings not found. Please contact your administrator.')
  }

  const document = snapshot.docs[0]
  const data = document.data()

  return {
    documentId: document.id,
    username: typeof data.username === 'string' ? data.username : user.email,
    name: typeof data.name === 'string' ? data.name.trim() : '',
    avatarUrl: typeof data.avatarUrl === 'string' && data.avatarUrl.trim() ? data.avatarUrl.trim() : null,
    avatarPath: typeof data.avatarPath === 'string' && data.avatarPath.trim() ? data.avatarPath.trim() : null,
  }
}

const USERNAME_QUERY_BATCH_SIZE = 30

export async function loadUserNamesByEmails(emails: string[]): Promise<Map<string, string>> {
  const uniqueEmails = [...new Set(emails.map((email) => email.trim()).filter(Boolean))]
  const nameByEmail = new Map<string, string>()

  if (uniqueEmails.length === 0) {
    return nameByEmail
  }

  const db = getFirebaseDb()

  for (let index = 0; index < uniqueEmails.length; index += USERNAME_QUERY_BATCH_SIZE) {
    const batch = uniqueEmails.slice(index, index + USERNAME_QUERY_BATCH_SIZE)
    const snapshot = await getDocs(
      query(collection(db, 'userSettings'), where('username', 'in', batch)),
    )

    for (const document of snapshot.docs) {
      const data = document.data()
      const username = typeof data.username === 'string' ? data.username.trim() : ''
      const name = typeof data.name === 'string' ? data.name.trim() : ''

      if (username && name) {
        nameByEmail.set(username, name)
      }
    }
  }

  return nameByEmail
}

export function resolveUserDisplayName(
  email: string | null | undefined,
  nameByEmail: Map<string, string>,
): string {
  const trimmedEmail = email?.trim()
  if (!trimmedEmail) return '—'
  return nameByEmail.get(trimmedEmail) ?? trimmedEmail
}

export async function saveCurrentUserProfileName(name: string): Promise<void> {
  const user = getFirebaseAuth().currentUser
  if (!user?.email) {
    throw new Error('You must be signed in.')
  }

  const profile = await loadCurrentUserSettings()
  const now = new Date().toISOString()

  await updateDoc(doc(getFirebaseDb(), 'userSettings', profile.documentId), {
    name: name.trim(),
    updatedAt: now,
    updatedBy: user.email,
  })
}
