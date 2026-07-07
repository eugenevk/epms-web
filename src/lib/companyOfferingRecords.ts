import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase'
import { cloneSnapshotValue } from '@/lib/formSnapshot'
import type { ObjectRef } from '@/lib/companies'
import { offeringObjectType, parseProductKind, type ProductKind } from '@/lib/products'

export type CompanyOffering = {
  id: string
  objectID: string
  objectType: 'Product' | 'Service'
  objectLabel: string
  name: string
  kind: ProductKind
  description: string
  company: ObjectRef
  createdAt: string | null
  createdBy: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export type CompanyOfferingInput = {
  name: string
  kind: ProductKind
  description: string
  company: ObjectRef | null
}

const COLLECTION = 'products'

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function getNullableString(value: unknown): string | null {
  const text = getString(value)?.trim()
  return text || null
}

function mapObjectRef(value: unknown): ObjectRef | null {
  if (!value || typeof value !== 'object') return null
  const record = value as { id?: unknown; objectLabel?: unknown }
  const id = getString(record.id)
  if (!id) return null
  return {
    id,
    objectLabel: getString(record.objectLabel) ?? '',
  }
}

function requireCurrentUser() {
  const user = getFirebaseAuth().currentUser
  if (!user) {
    throw new Error('You must be signed in.')
  }
  return user
}

export function emptyCompanyOfferingInput(company: ObjectRef | null = null): CompanyOfferingInput {
  return {
    name: '',
    kind: 'product',
    description: '',
    company,
  }
}

export function companyOfferingInputFromOffering(offering: CompanyOffering): CompanyOfferingInput {
  const {
    id: _id,
    objectID: _objectID,
    objectType: _objectType,
    objectLabel: _objectLabel,
    createdAt: _createdAt,
    createdBy: _createdBy,
    updatedAt: _updatedAt,
    updatedBy: _updatedBy,
    ...input
  } = offering
  return cloneSnapshotValue(input)
}

export function validateCompanyOfferingInput(input: CompanyOfferingInput): void {
  if (!input.name.trim()) {
    throw new Error('Name is required.')
  }
  if (!input.company?.id) {
    throw new Error('Company is required.')
  }
}

function mapCompanyOffering(id: string, data: Record<string, unknown>): CompanyOffering {
  const kind =
    parseProductKind(data.kind) ??
    parseProductKind(data.objectType) ??
    'product'
  const name = getString(data.name)?.trim() || getString(data.objectLabel)?.trim() || ''
  const company = mapObjectRef(data.company)

  return {
    id,
    objectID: getString(data.objectID) ?? id,
    objectType: offeringObjectType(kind),
    objectLabel: name,
    name,
    kind,
    description: getString(data.description) ?? '',
    company: company ?? { id: '', objectLabel: '' },
    createdAt: getNullableString(data.createdAt),
    createdBy: getNullableString(data.createdBy),
    updatedAt: getNullableString(data.updatedAt),
    updatedBy: getNullableString(data.updatedBy),
  }
}

function buildCompanyOfferingPayload(
  input: CompanyOfferingInput,
  audit: {
    createdAt: string
    createdBy: string
    updatedAt: string
    updatedBy: string
  },
) {
  const name = input.name.trim()
  const kind = input.kind
  return {
    name,
    kind,
    description: input.description.trim(),
    company: {
      id: input.company!.id,
      objectLabel: input.company!.objectLabel.trim(),
    },
    objectType: offeringObjectType(kind),
    objectLabel: name,
    createdAt: audit.createdAt,
    createdBy: audit.createdBy,
    updatedAt: audit.updatedAt,
    updatedBy: audit.updatedBy,
  }
}

export async function loadCompanyOffering(id: string): Promise<CompanyOffering> {
  const snapshot = await getDoc(doc(getFirebaseDb(), COLLECTION, id))
  if (!snapshot.exists()) {
    throw new Error('Product or service not found.')
  }
  return mapCompanyOffering(snapshot.id, snapshot.data())
}

export async function loadCompanyOfferingsForCompany(companyId: string): Promise<CompanyOffering[]> {
  const snapshot = await getDocs(
    query(collection(getFirebaseDb(), COLLECTION), where('company.id', '==', companyId)),
  )

  return snapshot.docs
    .map((document) => mapCompanyOffering(document.id, document.data()))
    .sort((left, right) => left.name.localeCompare(right.name, 'en', { sensitivity: 'base' }))
}

export async function loadAllCompanyOfferings(): Promise<CompanyOffering[]> {
  const snapshot = await getDocs(collection(getFirebaseDb(), COLLECTION))

  return snapshot.docs
    .map((document) => mapCompanyOffering(document.id, document.data()))
    .sort((left, right) => {
      const companyCompare = (left.company.objectLabel || '').localeCompare(
        right.company.objectLabel || '',
        'en',
        { sensitivity: 'base' },
      )
      if (companyCompare !== 0) return companyCompare
      return left.name.localeCompare(right.name, 'en', { sensitivity: 'base' })
    })
}

export async function createCompanyOffering(input: CompanyOfferingInput): Promise<CompanyOffering> {
  const user = requireCurrentUser()
  validateCompanyOfferingInput(input)

  const now = new Date().toISOString()
  const payload = buildCompanyOfferingPayload(input, {
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

  await setDoc(docRef, { id: docRef.id, objectID: docRef.id }, { merge: true })
  await adjustCompanyProductCount(input.company!.id, 1)

  return loadCompanyOffering(docRef.id)
}

export async function updateCompanyOffering(
  id: string,
  input: CompanyOfferingInput,
): Promise<CompanyOffering> {
  const user = requireCurrentUser()
  validateCompanyOfferingInput(input)

  const existing = await loadCompanyOffering(id)
  const now = new Date().toISOString()
  const payload = buildCompanyOfferingPayload(input, {
    createdAt: existing.createdAt ?? now,
    createdBy: existing.createdBy ?? user.email ?? user.uid,
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

  await syncCompanyOfferingCounts(existing.company, input.company)

  return loadCompanyOffering(id)
}

export async function deleteCompanyOffering(id: string): Promise<void> {
  requireCurrentUser()

  const existing = await loadCompanyOffering(id)
  await deleteDoc(doc(getFirebaseDb(), COLLECTION, id))

  if (existing.company?.id) {
    await adjustCompanyProductCount(existing.company.id, -1)
  }
}

export async function deleteCompanyOfferingsForCompany(companyId: string): Promise<void> {
  const snapshot = await getDocs(
    query(collection(getFirebaseDb(), COLLECTION), where('company.id', '==', companyId)),
  )
  await Promise.all(
    snapshot.docs.map(async (document) => {
      await deleteDoc(document.ref)
      await adjustCompanyProductCount(companyId, -1)
    }),
  )
}

export async function updateCompanyOfferingCompanyLabel(
  companyId: string,
  objectLabel: string,
): Promise<void> {
  const snapshot = await getDocs(
    query(collection(getFirebaseDb(), COLLECTION), where('company.id', '==', companyId)),
  )
  await Promise.all(
    snapshot.docs.map((document) =>
      updateDoc(document.ref, {
        company: { id: companyId, objectLabel },
      }),
    ),
  )
}

async function syncCompanyOfferingCounts(
  previousCompany: ObjectRef | null,
  nextCompany: ObjectRef | null,
): Promise<void> {
  const previousId = previousCompany?.id ?? null
  const nextId = nextCompany?.id ?? null
  if (previousId === nextId) return

  if (previousId) await adjustCompanyProductCount(previousId, -1)
  if (nextId) await adjustCompanyProductCount(nextId, 1)
}

export async function adjustCompanyProductCount(companyId: string, delta: number): Promise<void> {
  const companyRef = doc(getFirebaseDb(), 'companies', companyId)
  const snapshot = await getDoc(companyRef)
  if (!snapshot.exists()) return

  const current = Number(snapshot.data().numOfProducts ?? 0)
  await updateDoc(companyRef, {
    numOfProducts: Math.max(current + delta, 0),
  })
}
