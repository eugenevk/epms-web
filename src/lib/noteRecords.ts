import { addDoc, collection, deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase'
import { isEmptyRichText } from '@/lib/richText'

export type NoteLinkedObject = {
  collection: string
  id: string
  type: string
  objectLabel: string
}

export type Note = {
  id: string
  objectID: string
  objectType: 'Note'
  objectLabel: string | null
  note: string
  noteDt: string | null
  noteDttm: string | null
  linkedObject: NoteLinkedObject
  createdAt: string | null
  createdBy: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export type NoteInput = {
  note: string
  noteDt: string
}

export type CreateNoteParams = NoteInput & {
  linkedObject: NoteLinkedObject
}

const COLLECTION = 'notes'

function requireCurrentUser() {
  const user = getFirebaseAuth().currentUser
  if (!user) {
    throw new Error('You must be signed in to manage notes.')
  }
  return user
}

function formatNoteDateTime(includeTime = true): string {
  const date = new Date()
  return date.toDateString() + (includeTime ? ` ${date.toLocaleTimeString()}` : '')
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function getString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function mapNote(id: string, data: Record<string, unknown>): Note {
  const linked =
    data.linkedObject && typeof data.linkedObject === 'object'
      ? (data.linkedObject as Record<string, unknown>)
      : {}

  return {
    id,
    objectID: getString(data.objectID) ?? id,
    objectType: 'Note',
    objectLabel: getString(data.objectLabel),
    note: getString(data.note) ?? '',
    noteDt: getString(data.noteDt),
    noteDttm: getString(data.noteDttm),
    linkedObject: {
      collection: getString(linked.collection) ?? 'companies',
      id: getString(linked.id) ?? '',
      type: getString(linked.type) ?? 'Company',
      objectLabel: getString(linked.objectLabel) ?? '',
    },
    createdAt: getString(data.createdAt),
    createdBy: getString(data.createdBy),
    updatedAt: getString(data.updatedAt),
    updatedBy: getString(data.updatedBy),
  }
}

function validateNoteInput(input: NoteInput): void {
  if (!input.noteDt.trim()) {
    throw new Error('Note date is required.')
  }
  if (isEmptyRichText(input.note)) {
    throw new Error('Note text is required.')
  }
}

function buildNotePayload(
  input: NoteInput,
  linkedObject: NoteLinkedObject,
  audit: {
    createdAt: string | null
    createdBy: string | null
    updatedAt: string
    updatedBy: string
  },
  noteDttm: string | null,
) {
  const note = isEmptyRichText(input.note) ? '' : input.note

  return {
    linkedObject,
    note,
    noteDt: input.noteDt.trim(),
    noteDttm,
    objectType: 'Note' as const,
    objectLabel: note,
    createdAt: audit.createdAt,
    createdBy: audit.createdBy,
    updatedAt: audit.updatedAt,
    updatedBy: audit.updatedBy,
  }
}

async function adjustCompanyNoteCount(companyId: string, delta: number): Promise<void> {
  const companyRef = doc(getFirebaseDb(), 'companies', companyId)
  const snapshot = await getDoc(companyRef)
  if (!snapshot.exists()) return

  const current = typeof snapshot.data().numOfNotes === 'number' ? snapshot.data().numOfNotes : 0
  await updateDoc(companyRef, { numOfNotes: Math.max(0, current + delta) })
}

async function adjustOpportunityNoteCount(opportunityId: string, delta: number): Promise<void> {
  const opportunityRef = doc(getFirebaseDb(), 'opportunities', opportunityId)
  const snapshot = await getDoc(opportunityRef)
  if (!snapshot.exists()) return

  const current = typeof snapshot.data().numOfNotes === 'number' ? snapshot.data().numOfNotes : 0
  await updateDoc(opportunityRef, { numOfNotes: Math.max(0, current + delta) })
}

async function adjustRfpNoteCount(rfpId: string, delta: number): Promise<void> {
  const rfpRef = doc(getFirebaseDb(), 'rfps', rfpId)
  const snapshot = await getDoc(rfpRef)
  if (!snapshot.exists()) return

  const current = typeof snapshot.data().numOfNotes === 'number' ? snapshot.data().numOfNotes : 0
  await updateDoc(rfpRef, { numOfNotes: Math.max(0, current + delta) })
}

async function adjustLinkedObjectNoteCount(linkedObject: NoteLinkedObject, delta: number): Promise<void> {
  if (!linkedObject.id) return

  if (linkedObject.collection === 'opportunities') {
    await adjustOpportunityNoteCount(linkedObject.id, delta)
    return
  }

  if (linkedObject.collection === 'rfps') {
    await adjustRfpNoteCount(linkedObject.id, delta)
    return
  }

  if (linkedObject.collection === 'companies') {
    await adjustCompanyNoteCount(linkedObject.id, delta)
  }
}

export function emptyNoteInput(noteDt = todayIsoDate()): NoteInput {
  return {
    note: '',
    noteDt,
  }
}

export function noteInputFromNote(note: Note): NoteInput {
  return {
    noteDt: note.noteDt ?? todayIsoDate(),
    note: note.note,
  }
}

export async function loadNote(id: string): Promise<Note> {
  const snapshot = await getDoc(doc(getFirebaseDb(), COLLECTION, id))
  if (!snapshot.exists()) {
    throw new Error('Note not found.')
  }

  return mapNote(snapshot.id, snapshot.data())
}

export async function createNote(params: CreateNoteParams): Promise<Note> {
  const user = requireCurrentUser()
  validateNoteInput(params)

  const now = formatNoteDateTime(true)
  const linkedObject: NoteLinkedObject = {
    collection: params.linkedObject.collection,
    id: params.linkedObject.id,
    type: params.linkedObject.type,
    objectLabel: params.linkedObject.objectLabel.trim(),
  }

  const payload = buildNotePayload(
    params,
    linkedObject,
    {
      createdAt: now,
      createdBy: user.email ?? user.uid,
      updatedAt: now,
      updatedBy: user.email ?? user.uid,
    },
    new Date().toISOString(),
  )

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

  await adjustLinkedObjectNoteCount(params.linkedObject, 1)

  return mapNote(docRef.id, {
    ...payload,
    id: docRef.id,
    objectID: docRef.id,
  })
}

export async function updateNote(id: string, input: NoteInput): Promise<Note> {
  const user = requireCurrentUser()
  validateNoteInput(input)

  const existingSnapshot = await getDoc(doc(getFirebaseDb(), COLLECTION, id))
  if (!existingSnapshot.exists()) {
    throw new Error('Note not found.')
  }

  const existing = mapNote(id, existingSnapshot.data())
  const now = formatNoteDateTime(true)
  const payload = buildNotePayload(
    input,
    existing.linkedObject,
    {
      createdAt: existing.createdAt,
      createdBy: existing.createdBy,
      updatedAt: now,
      updatedBy: user.email ?? user.uid,
    },
    existing.noteDttm,
  )

  await setDoc(
    doc(getFirebaseDb(), COLLECTION, id),
    {
      ...payload,
      id,
      objectID: id,
    },
    { merge: true },
  )

  return mapNote(id, {
    ...payload,
    id,
    objectID: id,
  })
}

export async function deleteNote(id: string): Promise<void> {
  requireCurrentUser()

  const noteRef = doc(getFirebaseDb(), COLLECTION, id)
  const existingSnapshot = await getDoc(noteRef)
  if (!existingSnapshot.exists()) {
    throw new Error('Note not found.')
  }

  const existing = mapNote(id, existingSnapshot.data())
  await deleteDoc(noteRef)

  if (existing.linkedObject.id) {
    await adjustLinkedObjectNoteCount(existing.linkedObject, -1)
  }
}
