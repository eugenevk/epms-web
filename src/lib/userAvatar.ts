import { deleteField, doc, updateDoc } from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { getFirebaseAuth, getFirebaseDb, getFirebaseStorage } from '@/lib/firebase'
import { loadCurrentUserSettings } from '@/lib/userSettings'

const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/gif':
      return 'gif'
    default:
      return 'jpg'
  }
}

function validateAvatarFile(file: File): void {
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    throw new Error('Choose a JPEG, PNG, WebP, or GIF image.')
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error('The image is too large (max. 2 MB).')
  }
}

async function deleteAvatarAtPath(path: string | null | undefined): Promise<void> {
  if (!path) return
  await deleteObject(storageRef(getFirebaseStorage(), path)).catch(() => undefined)
}

export async function uploadUserAvatar(file: File): Promise<string> {
  validateAvatarFile(file)

  const user = getFirebaseAuth().currentUser
  if (!user) throw new Error('You must be signed in.')

  const profile = await loadCurrentUserSettings()
  const extension = extensionForContentType(file.type)
  const avatarPath = `avatars/${user.uid}/avatar.${extension}`

  await deleteAvatarAtPath(profile.avatarPath)

  const reference = storageRef(getFirebaseStorage(), avatarPath)
  await uploadBytes(reference, file, { contentType: file.type })
  const avatarUrl = await getDownloadURL(reference)

  const now = new Date().toISOString()
  await updateDoc(doc(getFirebaseDb(), 'userSettings', profile.documentId), {
    avatarUrl,
    avatarPath,
    updatedAt: now,
    updatedBy: user.email ?? profile.username,
  })

  return avatarUrl
}

export async function removeUserAvatar(): Promise<void> {
  const user = getFirebaseAuth().currentUser
  if (!user) throw new Error('You must be signed in.')

  const profile = await loadCurrentUserSettings()
  await deleteAvatarAtPath(profile.avatarPath)

  const now = new Date().toISOString()
  await updateDoc(doc(getFirebaseDb(), 'userSettings', profile.documentId), {
    avatarUrl: deleteField(),
    avatarPath: deleteField(),
    updatedAt: now,
    updatedBy: user.email ?? profile.username,
  })
}
