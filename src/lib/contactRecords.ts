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
import { formatContactFullName, resolveContactName } from '@/lib/contactNames'
import type { LabeledValue, ObjectRef } from '@/lib/companies'

export type ContactGender = LabeledValue & {
  color?: string
}

export type Contact = {
  id: string
  objectID: string
  objectType: 'Contact'
  objectLabel: string
  fullName: string
  firstName: string | null
  lastName: string
  position: string | null
  department: string | null
  email: string | null
  phone: string | null
  mobile: string | null
  gender: ContactGender | null
  dob: string | null
  firstMet: string | null
  atCompanySince: string | null
  linkedIn: string | null
  hasLeft: boolean
  leftSince: string | null
  sfRef: string | null
  notes: string
  company: ObjectRef | null
  reportsInto: ObjectRef | null
  numOfNotes: number
  createdAt: string | null
  createdBy: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export type ContactInput = Omit<
  Contact,
  | 'id'
  | 'objectID'
  | 'objectType'
  | 'objectLabel'
  | 'fullName'
  | 'createdAt'
  | 'createdBy'
  | 'updatedAt'
  | 'updatedBy'
>

const COLLECTION = 'contacts'

export function emptyContactInput(company: ObjectRef | null = null): ContactInput {
  return {
    firstName: null,
    lastName: '',
    position: null,
    department: null,
    email: null,
    phone: null,
    mobile: null,
    gender: null,
    dob: null,
    firstMet: null,
    atCompanySince: null,
    linkedIn: null,
    hasLeft: false,
    leftSince: null,
    sfRef: null,
    notes: '',
    company,
    reportsInto: null,
    numOfNotes: 0,
  }
}

export function contactInputFromContact(contact: Contact): ContactInput {
  const {
    id: _id,
    objectID: _objectID,
    objectType: _objectType,
    objectLabel: _objectLabel,
    fullName: _fullName,
    createdAt: _createdAt,
    createdBy: _createdBy,
    updatedAt: _updatedAt,
    updatedBy: _updatedBy,
    ...input
  } = contact
  return cloneSnapshotValue(input)
}

export async function loadContact(id: string): Promise<Contact> {
  const snapshot = await getDoc(doc(getFirebaseDb(), COLLECTION, id))
  if (!snapshot.exists()) {
    throw new Error('Contact not found.')
  }
  return mapContact(snapshot.id, snapshot.data())
}

export async function createContact(input: ContactInput): Promise<Contact> {
  const user = requireCurrentUser()
  validateContactInput(input)

  const now = new Date().toISOString()
  const payload = buildContactPayload(input, {
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

  const contact: Contact = {
    ...mapContact(docRef.id, payload),
    id: docRef.id,
    objectID: docRef.id,
  }

  await setDoc(docRef, { id: docRef.id, objectID: docRef.id }, { merge: true })

  if (input.company?.id) {
    await adjustCompanyContactCount(input.company.id, 1)
  }

  return contact
}

export async function updateContact(id: string, input: ContactInput): Promise<Contact> {
  const user = requireCurrentUser()
  validateContactInput(input)

  const existing = await loadContact(id)
  const now = new Date().toISOString()
  const payload = buildContactPayload(input, {
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

  await syncCompanyContactCounts(existing.company, input.company)
  await propagateContactLabelChanges(id, existing.fullName, payload.fullName)

  return loadContact(id)
}

export async function migrateAllContactNames(): Promise<{ updated: number; total: number }> {
  requireCurrentUser()

  const snapshot = await getDocs(collection(getFirebaseDb(), COLLECTION))
  let updated = 0

  for (const document of snapshot.docs) {
    const data = document.data()
    const resolved = resolveContactName({
      firstName: getNullableString(data.firstName),
      lastName: getString(data.lastName) ?? '',
      fullName: getString(data.fullName),
      objectLabel: getString(data.objectLabel),
    })

    const currentFirstName = getNullableString(data.firstName)
    const currentLastName = getString(data.lastName) ?? ''
    const currentFullName = getString(data.fullName) ?? ''
    const currentObjectLabel = getString(data.objectLabel) ?? ''

    if (
      currentFirstName === resolved.firstName &&
      currentLastName === resolved.lastName &&
      currentFullName === resolved.fullName &&
      currentObjectLabel === resolved.objectLabel
    ) {
      continue
    }

    await updateDoc(document.ref, {
      firstName: resolved.firstName,
      lastName: resolved.lastName,
      fullName: resolved.fullName,
      objectLabel: resolved.objectLabel,
    })

    if (currentFullName !== resolved.fullName) {
      await propagateContactLabelChanges(document.id, currentFullName, resolved.fullName)
    }

    updated += 1
  }

  return { updated, total: snapshot.size }
}

export async function deleteContact(id: string): Promise<void> {
  requireCurrentUser()

  const existing = await loadContact(id)

  const notes = await getDocs(
    query(collection(getFirebaseDb(), 'notes'), where('linkedObject.id', '==', id)),
  )
  await Promise.all(notes.docs.map((document) => deleteDoc(document.ref)))

  if (existing.company?.id) {
    await adjustCompanyContactCount(existing.company.id, -1)
  }

  await deleteDoc(doc(getFirebaseDb(), COLLECTION, id))
}

export function validateContactInput(input: ContactInput): void {
  if (!input.lastName.trim()) {
    throw new Error('Last name is required.')
  }

  if (!input.company?.id || !input.company.objectLabel.trim()) {
    throw new Error('Company is required.')
  }
}

function buildContactPayload(
  input: ContactInput,
  audit: {
    createdAt: string | null
    createdBy: string | null
    updatedAt: string
    updatedBy: string
  },
) {
  const normalized = resolveContactName({
    firstName: input.firstName,
    lastName: input.lastName,
  })
  const fullName = formatContactFullName(normalized.firstName, normalized.lastName)

  return {
    atCompanySince: nullableString(input.atCompanySince),
    company: normalizeObjectRef(input.company),
    createdAt: audit.createdAt,
    createdBy: audit.createdBy,
    department: nullableString(input.department),
    dob: nullableString(input.dob),
    email: nullableString(input.email),
    firstMet: nullableString(input.firstMet),
    firstName: normalized.firstName,
    fullName,
    gender: input.gender,
    hasLeft: Boolean(input.hasLeft),
    lastName: normalized.lastName,
    leftSince: input.hasLeft ? nullableString(input.leftSince) : null,
    linkedIn: nullableString(input.linkedIn),
    mobile: nullableString(input.mobile),
    notes: input.notes ?? '',
    numOfNotes: input.numOfNotes ?? 0,
    objectLabel: fullName,
    objectType: 'Contact' as const,
    phone: nullableString(input.phone),
    position: nullableString(input.position),
    reportsInto: normalizeObjectRef(input.reportsInto),
    sfRef: nullableString(input.sfRef),
    updatedAt: audit.updatedAt,
    updatedBy: audit.updatedBy,
  }
}

function mapContact(id: string, data: Record<string, unknown>): Contact {
  const resolved = resolveContactName({
    firstName: getNullableString(data.firstName),
    lastName: getString(data.lastName) ?? '',
    fullName: getString(data.fullName),
    objectLabel: getString(data.objectLabel),
  })

  return {
    id,
    objectID: getString(data.objectID) ?? id,
    objectType: 'Contact',
    objectLabel: resolved.objectLabel,
    fullName: resolved.fullName,
    firstName: resolved.firstName,
    lastName: resolved.lastName,
    position: getNullableString(data.position),
    department: getNullableString(data.department),
    email: getNullableString(data.email),
    phone: getNullableString(data.phone),
    mobile: getNullableString(data.mobile),
    gender: mapGender(data.gender),
    dob: getNullableString(data.dob),
    firstMet: getNullableString(data.firstMet),
    atCompanySince: getNullableString(data.atCompanySince),
    linkedIn: getNullableString(data.linkedIn),
    hasLeft: Boolean(data.hasLeft),
    leftSince: getNullableString(data.leftSince),
    sfRef: getNullableString(data.sfRef),
    notes: getRichTextValue(data.notes),
    company: mapObjectRef(data.company),
    reportsInto: mapObjectRef(data.reportsInto),
    numOfNotes: getNumber(data.numOfNotes),
    createdAt: getNullableString(data.createdAt),
    createdBy: getNullableString(data.createdBy),
    updatedAt: getNullableString(data.updatedAt),
    updatedBy: getNullableString(data.updatedBy),
  }
}

async function syncCompanyContactCounts(
  previousCompany: ObjectRef | null,
  nextCompany: ObjectRef | null,
): Promise<void> {
  const previousId = previousCompany?.id ?? null
  const nextId = nextCompany?.id ?? null

  if (previousId === nextId) return

  if (previousId) {
    await adjustCompanyContactCount(previousId, -1)
  }

  if (nextId) {
    await adjustCompanyContactCount(nextId, 1)
  }
}

async function adjustCompanyContactCount(companyId: string, delta: number): Promise<void> {
  const companyRef = doc(getFirebaseDb(), 'companies', companyId)
  const snapshot = await getDoc(companyRef)
  if (!snapshot.exists()) return

  const current = getNumber(snapshot.data().numOfContacts)
  await updateDoc(companyRef, {
    numOfContacts: Math.max(current + delta, 0),
  })
}

async function propagateContactLabelChanges(
  contactId: string,
  previousName: string,
  nextName: string,
): Promise<void> {
  if (previousName === nextName) return

  const notes = await getDocs(
    query(collection(getFirebaseDb(), 'notes'), where('linkedObject.id', '==', contactId)),
  )
  await Promise.all(
    notes.docs.map((document) =>
      updateDoc(document.ref, {
        linkedObject: {
          collection: 'contacts',
          id: contactId,
          objectLabel: nextName,
          type: 'Contact',
        },
      }),
    ),
  )

  const reports = await getDocs(
    query(collection(getFirebaseDb(), 'contacts'), where('reportsInto.id', '==', contactId)),
  )
  await Promise.all(
    reports.docs.map((document) =>
      updateDoc(document.ref, {
        reportsInto: {
          id: contactId,
          objectLabel: nextName,
        },
      }),
    ),
  )
}

function normalizeObjectRef(value: ObjectRef | null): ObjectRef | null {
  if (!value?.id?.trim() || !value.objectLabel?.trim()) return null
  return {
    id: value.id.trim(),
    objectLabel: value.objectLabel.trim(),
  }
}

function mapGender(value: unknown): ContactGender | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const label = getString(record.label)
  const itemValue = getString(record.value)
  if (!label || !itemValue) return null
  return {
    label,
    value: itemValue,
    color: getString(record.color),
  }
}

function mapObjectRef(value: unknown): ObjectRef | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const id = getString(record.id)
  const objectLabel = getString(record.objectLabel)
  if (!id || !objectLabel) return null
  return { id, objectLabel }
}

function requireCurrentUser() {
  const user = getFirebaseAuth().currentUser
  if (!user) {
    throw new Error('You must be signed in.')
  }
  return user
}

function getRichTextValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  return String(value)
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function getNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text ? text : null
}

function nullableString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const text = value.trim()
  return text ? text : null
}

function getNumber(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}
