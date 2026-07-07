import { doc, getDoc, setDoc } from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { getFirebaseAuth, getFirebaseDb, getFirebaseStorage } from '@/lib/firebase'

const COLLECTION = 'companyPinboards'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export const PINBOARD_DEFAULT_ITEM_WIDTH = 220
export const PINBOARD_DEFAULT_ITEM_HEIGHT = 165
export const PINBOARD_MIN_ITEM_SIZE = 40

export type PinboardRect = {
  x: number
  y: number
  width: number
  height: number
}

export type CompanyPinboardItem = PinboardRect & {
  id: string
  imageUrl: string
  imagePath: string
  zIndex: number
}

export type CompanyPinboardPage = {
  id: string
  name: string
  items: CompanyPinboardItem[]
}

export type CompanyPinboardData = {
  pages: CompanyPinboardPage[]
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

function getNumber(value: unknown): number | undefined {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : undefined
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function mapPinboardItem(value: unknown): CompanyPinboardItem | null {
  if (!value || typeof value !== 'object') return null

  const record = value as Record<string, unknown>
  const id = getString(record.id)
  const imageUrl = getString(record.imageUrl)
  const imagePath = getString(record.imagePath)
  const x = getNumber(record.x)
  const y = getNumber(record.y)
  const width = getNumber(record.width)
  const constHeight = getNumber(record.height)
  const zIndex = getNumber(record.zIndex)

  if (!id || !imageUrl || !imagePath || x === undefined || y === undefined || width === undefined || zIndex === undefined) {
    return null
  }

  return {
    id,
    imageUrl,
    imagePath,
    x,
    y,
    width,
    height: constHeight ?? width,
    zIndex,
  }
}

function mapPinboardPage(value: unknown): CompanyPinboardPage | null {
  if (!value || typeof value !== 'object') return null

  const record = value as Record<string, unknown>
  const id = getString(record.id)
  const name = getString(record.name)
  const rawItems = Array.isArray(record.items) ? record.items : []
  const items = rawItems
    .map(mapPinboardItem)
    .filter((item): item is CompanyPinboardItem => Boolean(item))
    .sort((left, right) => left.zIndex - right.zIndex)

  if (!id) return null

  return {
    id,
    name: name ?? 'Page',
    items,
  }
}

function createDefaultPinboardPage(name = 'Page 1'): CompanyPinboardPage {
  return {
    id: crypto.randomUUID(),
    name,
    items: [],
  }
}

export function nextPinboardPageName(pages: CompanyPinboardPage[]): string {
  const used = new Set(pages.map((page) => page.name.trim().toLowerCase()))
  let index = pages.length + 1

  while (used.has(`page ${index}`.toLowerCase())) {
    index += 1
  }

  return `Page ${index}`
}

function mapPinboardDocument(data: Record<string, unknown> | undefined): CompanyPinboardData {
  if (data && Array.isArray(data.pages)) {
    const pages = data.pages
      .map(mapPinboardPage)
      .filter((page): page is CompanyPinboardPage => Boolean(page))

    if (pages.length > 0) {
      return { pages }
    }
  }

  const rawItems = data && Array.isArray(data.items) ? data.items : []
  const items = rawItems
    .map(mapPinboardItem)
    .filter((item): item is CompanyPinboardItem => Boolean(item))
    .sort((left, right) => left.zIndex - right.zIndex)

  return {
    pages: [
      {
        id: crypto.randomUUID(),
        name: 'Page 1',
        items,
      },
    ],
  }
}

export function validatePinboardImageFile(file: File): void {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Choose a JPEG, PNG, WebP, or GIF image.')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('The image is too large (max. 5 MB).')
  }
}

export function countPinboardItems(data: CompanyPinboardData): number {
  return data.pages.reduce((total, page) => total + page.items.length, 0)
}

export async function loadCompanyPinboardDocument(companyId: string): Promise<CompanyPinboardData> {
  const snapshot = await getDoc(doc(getFirebaseDb(), COLLECTION, companyId))
  if (!snapshot.exists()) {
    return { pages: [createDefaultPinboardPage()] }
  }

  return mapPinboardDocument(snapshot.data())
}

export async function saveCompanyPinboardDocument(
  companyId: string,
  data: CompanyPinboardData,
): Promise<void> {
  const user = getFirebaseAuth().currentUser
  if (!user) throw new Error('You must be signed in.')

  const now = new Date().toISOString()
  await setDoc(
    doc(getFirebaseDb(), COLLECTION, companyId),
    {
      pages: data.pages,
      updatedAt: now,
      updatedBy: user.email ?? user.uid,
    },
    { merge: true },
  )
}

export async function uploadPinboardImage(
  companyId: string,
  file: File,
  itemId: string,
): Promise<{ imageUrl: string; imagePath: string }> {
  validatePinboardImageFile(file)

  const user = getFirebaseAuth().currentUser
  if (!user) throw new Error('You must be signed in.')

  const extension = extensionForContentType(file.type)
  const imagePath = `companies/${companyId}/pinboard-${itemId}.${extension}`
  const reference = storageRef(getFirebaseStorage(), imagePath)

  await uploadBytes(reference, file, { contentType: file.type })
  const imageUrl = await getDownloadURL(reference)

  return { imageUrl, imagePath }
}

export async function deletePinboardImage(imagePath: string | null | undefined): Promise<void> {
  if (!imagePath) return
  await deleteObject(storageRef(getFirebaseStorage(), imagePath)).catch(() => undefined)
}

export function nextPinboardZIndex(items: CompanyPinboardItem[]): number {
  if (items.length === 0) return 1
  return Math.max(...items.map((item) => item.zIndex)) + 1
}

export function getImageFileFromDataTransfer(dataTransfer: DataTransfer | null): File | null {
  if (!dataTransfer) return null

  if (dataTransfer.files?.length) {
    for (const file of dataTransfer.files) {
      if (file.type.startsWith('image/')) return file
    }
  }

  for (const item of dataTransfer.items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) return file
    }
  }

  return null
}

export function dataTransferHasImage(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false

  if (Array.from(dataTransfer.types).includes('Files')) {
    return true
  }

  return Array.from(dataTransfer.items).some(
    (item) => item.kind === 'file' && item.type.startsWith('image/'),
  )
}

export function normalizePlacementRect(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): PinboardRect {
  const x = Math.min(startX, endX)
  const y = Math.min(startY, endY)
  const width = Math.max(PINBOARD_MIN_ITEM_SIZE, Math.abs(endX - startX))
  const height = Math.max(PINBOARD_MIN_ITEM_SIZE, Math.abs(endY - startY))

  return { x, y, width, height }
}

export function clampPinboardRect(
  rect: PinboardRect,
  canvasWidth: number,
  canvasHeight: number,
): PinboardRect {
  let { x, y, width, height } = rect

  width = Math.max(PINBOARD_MIN_ITEM_SIZE, width)
  height = Math.max(PINBOARD_MIN_ITEM_SIZE, height)
  x = Math.min(Math.max(0, x), Math.max(0, canvasWidth - width))
  y = Math.min(Math.max(0, y), Math.max(0, canvasHeight - height))
  width = Math.min(width, Math.max(PINBOARD_MIN_ITEM_SIZE, canvasWidth - x))
  height = Math.min(height, Math.max(PINBOARD_MIN_ITEM_SIZE, canvasHeight - y))

  return { x, y, width, height }
}
