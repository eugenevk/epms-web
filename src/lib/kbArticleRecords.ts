import { addDoc, collection, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase'
import { cloneSnapshotValue } from '@/lib/formSnapshot'
import { isEmptyRichText } from '@/lib/richText'

export type KbArticle = {
  id: string
  objectID: string
  objectType: 'KbArticle'
  objectLabel: string
  title: string
  body: string
  categories: string[]
  publishedAt: string | null
  createdAt: string | null
  createdBy: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export type KbArticleInput = {
  title: string
  body: string
  categories: string[]
  publishedAt: string | null
}

const COLLECTION = 'kbArticles'

function requireCurrentUser() {
  const user = getFirebaseAuth().currentUser
  if (!user) {
    throw new Error('You must be signed in to manage knowledge base articles.')
  }
  return user
}

function getString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function mapCategories(data: Record<string, unknown>): string[] {
  const categories = normalizeTags(mapTags(data.categories))
  if (categories.length > 0) return categories

  const legacyTags = normalizeTags(mapTags(data.tags))
  if (legacyTags.length > 0) return legacyTags

  const legacyCategory = data.category
  if (!legacyCategory || typeof legacyCategory !== 'object') return []

  const label = getString((legacyCategory as { label?: unknown }).label)
  return label ? [label] : []
}

function mapKbArticle(id: string, data: Record<string, unknown>): KbArticle {
  const title = getString(data.title) ?? getString(data.objectLabel) ?? ''
  return {
    id,
    objectID: getString(data.objectID) ?? id,
    objectType: 'KbArticle',
    objectLabel: getString(data.objectLabel) ?? title,
    title,
    body: getString(data.body) ?? '',
    categories: mapCategories(data),
    publishedAt: getString(data.publishedAt),
    createdAt: getString(data.createdAt),
    createdBy: getString(data.createdBy),
    updatedAt: getString(data.updatedAt),
    updatedBy: getString(data.updatedBy),
  }
}

function mapTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
}

function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const tag of tags) {
    const trimmed = tag.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(trimmed)
  }

  return normalized
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function emptyKbArticleInput(publishedAt = todayIsoDate()): KbArticleInput {
  return {
    title: '',
    body: '',
    categories: [],
    publishedAt,
  }
}

export function kbArticleInputFromArticle(article: KbArticle): KbArticleInput {
  return cloneSnapshotValue({
    title: article.title,
    body: article.body,
    categories: [...article.categories],
    publishedAt: article.publishedAt,
  })
}

export function validateKbArticleInput(input: KbArticleInput): void {
  if (!input.title.trim()) {
    throw new Error('Title is required.')
  }
  if (isEmptyRichText(input.body)) {
    throw new Error('Article body is required.')
  }
}

function buildKbArticlePayload(
  input: KbArticleInput,
  audit: {
    createdAt: string | null
    createdBy: string | null
    updatedAt: string
    updatedBy: string
  },
) {
  const title = input.title.trim()
  const body = isEmptyRichText(input.body) ? '' : input.body
  const publishedAt = input.publishedAt?.trim() || null

  return {
    title,
    body,
    categories: normalizeTags(input.categories),
    publishedAt,
    objectType: 'KbArticle' as const,
    objectLabel: title,
    createdAt: audit.createdAt,
    createdBy: audit.createdBy,
    updatedAt: audit.updatedAt,
    updatedBy: audit.updatedBy,
  }
}

export async function loadKbArticle(id: string): Promise<KbArticle> {
  const snapshot = await getDoc(doc(getFirebaseDb(), COLLECTION, id))
  if (!snapshot.exists()) {
    throw new Error('Article not found.')
  }
  return mapKbArticle(snapshot.id, snapshot.data())
}

export async function createKbArticle(input: KbArticleInput): Promise<KbArticle> {
  const user = requireCurrentUser()
  validateKbArticleInput(input)

  const now = new Date().toISOString()
  const payload = buildKbArticlePayload(input, {
    createdAt: now,
    createdBy: user.email ?? user.uid,
    updatedAt: now,
    updatedBy: user.email ?? user.uid,
  })

  const docRef = await addDoc(collection(getFirebaseDb(), COLLECTION), {
    ...payload,
    id: null,
    objectID: null,
  })

  await setDoc(
    docRef,
    {
      ...payload,
      id: docRef.id,
      objectID: docRef.id,
    },
    { merge: true },
  )

  return mapKbArticle(docRef.id, {
    ...payload,
    id: docRef.id,
    objectID: docRef.id,
  })
}

export async function updateKbArticle(id: string, input: KbArticleInput): Promise<KbArticle> {
  const user = requireCurrentUser()
  validateKbArticleInput(input)

  const existingSnapshot = await getDoc(doc(getFirebaseDb(), COLLECTION, id))
  if (!existingSnapshot.exists()) {
    throw new Error('Article not found.')
  }

  const existing = mapKbArticle(id, existingSnapshot.data())
  const now = new Date().toISOString()
  const payload = buildKbArticlePayload(input, {
    createdAt: existing.createdAt,
    createdBy: existing.createdBy,
    updatedAt: now,
    updatedBy: user.email ?? user.uid,
  })

  await setDoc(
    doc(getFirebaseDb(), COLLECTION, id),
    {
      ...payload,
      id,
      objectID: id,
    },
    { merge: true },
  )

  return mapKbArticle(id, {
    ...payload,
    id,
    objectID: id,
  })
}

export async function deleteKbArticle(id: string): Promise<void> {
  requireCurrentUser()

  const articleRef = doc(getFirebaseDb(), COLLECTION, id)
  const existingSnapshot = await getDoc(articleRef)
  if (!existingSnapshot.exists()) {
    throw new Error('Article not found.')
  }

  await deleteDoc(articleRef)
}
