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
import { parseProductKind, type ProductKind } from '@/lib/products'

export type CompanyProductInUse = {
  id: string
  objectID: string
  objectType: 'ProductInUse'
  objectLabel: string
  name: string
  kind: ProductKind
  version: string | null
  description: string
  company: ObjectRef
  supplierCompany: ObjectRef
  createdAt: string | null
  createdBy: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export type CompanyProductInUseInput = {
  name: string
  kind: ProductKind
  version: string | null
  description: string
  company: ObjectRef | null
  supplierCompany: ObjectRef | null
}

const COLLECTION = 'productsInUse'

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

export function emptyCompanyProductInUseInput(company: ObjectRef | null = null): CompanyProductInUseInput {
  return {
    name: '',
    kind: 'product',
    version: null,
    description: '',
    company,
    supplierCompany: null,
  }
}

export function companyProductInUseInputFromRecord(
  record: CompanyProductInUse,
): CompanyProductInUseInput {
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
  } = record
  return cloneSnapshotValue(input)
}

export function validateCompanyProductInUseInput(input: CompanyProductInUseInput): void {
  if (!input.name.trim()) {
    throw new Error('Name is required.')
  }
  if (!input.company?.id) {
    throw new Error('Company is required.')
  }
  if (!input.supplierCompany?.id) {
    throw new Error('Supplier company is required.')
  }
  if (input.company.id === input.supplierCompany.id) {
    throw new Error('Supplier company must be different from the company using the product or service.')
  }
}

function mapCompanyProductInUse(id: string, data: Record<string, unknown>): CompanyProductInUse {
  const kind = parseProductKind(data.kind) ?? 'product'
  const name = getString(data.name)?.trim() || getString(data.objectLabel)?.trim() || ''
  const company = mapObjectRef(data.company)
  const supplierCompany = mapObjectRef(data.supplierCompany)

  return {
    id,
    objectID: getString(data.objectID) ?? id,
    objectType: 'ProductInUse',
    objectLabel: name,
    name,
    kind,
    version: getNullableString(data.version),
    description: getString(data.description) ?? '',
    company: company ?? { id: '', objectLabel: '' },
    supplierCompany: supplierCompany ?? { id: '', objectLabel: '' },
    createdAt: getNullableString(data.createdAt),
    createdBy: getNullableString(data.createdBy),
    updatedAt: getNullableString(data.updatedAt),
    updatedBy: getNullableString(data.updatedBy),
  }
}

function buildCompanyProductInUsePayload(
  input: CompanyProductInUseInput,
  audit: {
    createdAt: string
    createdBy: string
    updatedAt: string
    updatedBy: string
  },
) {
  const name = input.name.trim()
  return {
    name,
    kind: input.kind,
    version: input.version?.trim() || null,
    description: input.description.trim(),
    company: {
      id: input.company!.id,
      objectLabel: input.company!.objectLabel.trim(),
    },
    supplierCompany: {
      id: input.supplierCompany!.id,
      objectLabel: input.supplierCompany!.objectLabel.trim(),
    },
    objectType: 'ProductInUse' as const,
    objectLabel: name,
    createdAt: audit.createdAt,
    createdBy: audit.createdBy,
    updatedAt: audit.updatedAt,
    updatedBy: audit.updatedBy,
  }
}

export async function loadCompanyProductInUse(id: string): Promise<CompanyProductInUse> {
  const snapshot = await getDoc(doc(getFirebaseDb(), COLLECTION, id))
  if (!snapshot.exists()) {
    throw new Error('Product or service in use not found.'
    )
  }
  return mapCompanyProductInUse(snapshot.id, snapshot.data())
}

export async function loadCompanyProductsInUseForCompany(companyId: string): Promise<CompanyProductInUse[]> {
  const snapshot = await getDocs(
    query(collection(getFirebaseDb(), COLLECTION), where('company.id', '==', companyId)),
  )

  return snapshot.docs
    .map((document) => mapCompanyProductInUse(document.id, document.data()))
    .sort((left, right) => left.name.localeCompare(right.name, 'en', { sensitivity: 'base' }))
}

export async function loadAllCompanyProductsInUse(): Promise<CompanyProductInUse[]> {
  const snapshot = await getDocs(collection(getFirebaseDb(), COLLECTION))

  return snapshot.docs
    .map((document) => mapCompanyProductInUse(document.id, document.data()))
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

export async function createCompanyProductInUse(
  input: CompanyProductInUseInput,
): Promise<CompanyProductInUse> {
  const user = requireCurrentUser()
  validateCompanyProductInUseInput(input)

  const now = new Date().toISOString()
  const payload = buildCompanyProductInUsePayload(input, {
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
  await adjustCompanyProductsInUseCount(input.company!.id, 1)

  return loadCompanyProductInUse(docRef.id)
}

export async function updateCompanyProductInUse(
  id: string,
  input: CompanyProductInUseInput,
): Promise<CompanyProductInUse> {
  const user = requireCurrentUser()
  validateCompanyProductInUseInput(input)

  const existing = await loadCompanyProductInUse(id)
  const now = new Date().toISOString()
  const payload = buildCompanyProductInUsePayload(input, {
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

  await syncCompanyProductsInUseCounts(existing.company, input.company)

  return loadCompanyProductInUse(id)
}

export async function deleteCompanyProductInUse(id: string): Promise<void> {
  requireCurrentUser()

  const existing = await loadCompanyProductInUse(id)
  await deleteDoc(doc(getFirebaseDb(), COLLECTION, id))

  if (existing.company?.id) {
    await adjustCompanyProductsInUseCount(existing.company.id, -1)
  }
}

export async function deleteCompanyProductsInUseForCompany(companyId: string): Promise<void> {
  const owned = await getDocs(
    query(collection(getFirebaseDb(), COLLECTION), where('company.id', '==', companyId)),
  )
  const supplied = await getDocs(
    query(collection(getFirebaseDb(), COLLECTION), where('supplierCompany.id', '==', companyId)),
  )

  const refs = new Map<string, (typeof owned.docs)[number]>()
  for (const document of [...owned.docs, ...supplied.docs]) {
    refs.set(document.id, document)
  }

  await Promise.all(
    [...refs.values()].map(async (document) => {
      const record = mapCompanyProductInUse(document.id, document.data())
      await deleteDoc(document.ref)
      if (record.company?.id) {
        await adjustCompanyProductsInUseCount(record.company.id, -1)
      }
    }),
  )
}

export async function updateCompanyProductInUseCompanyLabels(
  companyId: string,
  objectLabel: string,
): Promise<void> {
  const asOwner = await getDocs(
    query(collection(getFirebaseDb(), COLLECTION), where('company.id', '==', companyId)),
  )
  const asSupplier = await getDocs(
    query(collection(getFirebaseDb(), COLLECTION), where('supplierCompany.id', '==', companyId)),
  )

  await Promise.all([
    ...asOwner.docs.map((document) =>
      updateDoc(document.ref, {
        company: { id: companyId, objectLabel },
      }),
    ),
    ...asSupplier.docs.map((document) =>
      updateDoc(document.ref, {
        supplierCompany: { id: companyId, objectLabel },
      }),
    ),
  ])
}

async function syncCompanyProductsInUseCounts(
  previousCompany: ObjectRef | null,
  nextCompany: ObjectRef | null,
): Promise<void> {
  const previousId = previousCompany?.id ?? null
  const nextId = nextCompany?.id ?? null
  if (previousId === nextId) return

  if (previousId) await adjustCompanyProductsInUseCount(previousId, -1)
  if (nextId) await adjustCompanyProductsInUseCount(nextId, 1)
}

export async function adjustCompanyProductsInUseCount(companyId: string, delta: number): Promise<void> {
  const companyRef = doc(getFirebaseDb(), 'companies', companyId)
  const snapshot = await getDoc(companyRef)
  if (!snapshot.exists()) return

  const current = Number(snapshot.data().numOfProductsInUse ?? 0)
  await updateDoc(companyRef, {
    numOfProductsInUse: Math.max(current + delta, 0),
  })
}
