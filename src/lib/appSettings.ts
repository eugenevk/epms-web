import {
  addDoc,
  collection,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { assertCurrentUserIsAdmin } from '@/lib/adminAuth'
import { getFirebaseDb } from '@/lib/firebase'

export type SecuritySettings = {
  autoLogoutMinutes: number
}

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  autoLogoutMinutes: 15,
}

const SYSTEM_COLLECTION = 'system'

export async function getSecuritySettings(): Promise<SecuritySettings> {
  const snapshot = await getDocs(query(collection(getFirebaseDb(), SYSTEM_COLLECTION), limit(1)))
  const settingsDoc = snapshot.docs[0]
  if (!settingsDoc) return DEFAULT_SECURITY_SETTINGS

  return normalizeSettings(settingsDoc.data())
}

export async function saveSecuritySettings(settings: SecuritySettings): Promise<void> {
  await assertCurrentUserIsAdmin()
  const db = getFirebaseDb()
  const payload = {
    autoLogoutMinutes: clampAutoLogoutMinutes(settings.autoLogoutMinutes),
    updatedAt: serverTimestamp(),
  }
  const snapshot = await getDocs(query(collection(db, SYSTEM_COLLECTION), limit(1)))
  const settingsDoc = snapshot.docs[0]

  if (settingsDoc) {
    await setDoc(settingsDoc.ref, payload, { merge: true })
  } else {
    await addDoc(collection(db, SYSTEM_COLLECTION), payload)
  }
}

export function subscribeSecuritySettings(onChange: (settings: SecuritySettings) => void): Unsubscribe {
  return onSnapshot(
    query(collection(getFirebaseDb(), SYSTEM_COLLECTION), limit(1)),
    (snapshot) => {
      onChange(snapshot.docs[0] ? normalizeSettings(snapshot.docs[0].data()) : DEFAULT_SECURITY_SETTINGS)
    },
    () => {
      onChange(DEFAULT_SECURITY_SETTINGS)
    },
  )
}

function normalizeSettings(data: unknown): SecuritySettings {
  const record = data as Partial<SecuritySettings> | undefined
  return {
    autoLogoutMinutes: clampAutoLogoutMinutes(record?.autoLogoutMinutes),
  }
}

function clampAutoLogoutMinutes(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return DEFAULT_SECURITY_SETTINGS.autoLogoutMinutes
  if (numeric <= 0) return 0
  return Math.min(Math.max(Math.round(numeric), 1), 24 * 60)
}
