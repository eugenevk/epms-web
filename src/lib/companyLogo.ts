import { deleteField, doc, updateDoc } from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { getFirebaseAuth, getFirebaseDb, getFirebaseStorage } from '@/lib/firebase'

const MAX_LOGO_BYTES = 2 * 1024 * 1024
const ALLOWED_LOGO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export type CompanyLogo = {
  logoUrl: string
  logoPath: string
}

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

export function validateCompanyLogoFile(file: File): void {
  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    throw new Error('Choose a JPEG, PNG, WebP, or GIF image.')
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new Error('The image is too large (max. 2 MB).')
  }
}

export function getImageFileFromClipboard(event: ClipboardEvent): File | null {
  const items = event.clipboardData?.items
  if (!items) return null

  for (const item of items) {
    if (!item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file) return file
  }

  return null
}

export async function deleteCompanyLogoAtPath(path: string | null | undefined): Promise<void> {
  if (!path) return
  await deleteObject(storageRef(getFirebaseStorage(), path)).catch(() => undefined)
}

export async function uploadCompanyLogo(
  companyId: string,
  file: File,
  currentLogoPath?: string | null,
): Promise<CompanyLogo> {
  validateCompanyLogoFile(file)

  const user = getFirebaseAuth().currentUser
  if (!user) throw new Error('You must be signed in.')

  await deleteCompanyLogoAtPath(currentLogoPath)

  const extension = extensionForContentType(file.type)
  const logoPath = `companies/${companyId}/logo.${extension}`
  const reference = storageRef(getFirebaseStorage(), logoPath)

  await uploadBytes(reference, file, { contentType: file.type })
  const logoUrl = await getDownloadURL(reference)

  const now = new Date().toISOString()
  await updateDoc(doc(getFirebaseDb(), 'companies', companyId), {
    logoUrl,
    logoPath,
    updatedAt: now,
    updatedBy: user.email ?? user.uid,
  })

  return { logoUrl, logoPath }
}

export async function removeCompanyLogo(
  companyId: string,
  currentLogoPath?: string | null,
): Promise<void> {
  const user = getFirebaseAuth().currentUser
  if (!user) throw new Error('You must be signed in.')

  await deleteCompanyLogoAtPath(currentLogoPath)

  const now = new Date().toISOString()
  await updateDoc(doc(getFirebaseDb(), 'companies', companyId), {
    logoUrl: deleteField(),
    logoPath: deleteField(),
    updatedAt: now,
    updatedBy: user.email ?? user.uid,
  })
}
