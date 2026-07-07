import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { resolveAlgoliaRecordId } from '@/lib/algoliaRecordId'
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase'
import { cloneSnapshotValue } from '@/lib/formSnapshot'
import type { LabeledValue, ObjectRef } from '@/lib/companies'
import { loadRfpHitFromAlgolia, type RfpHit } from '@/lib/rfpsAlgolia'
import { normalizeRfpInput } from '@/lib/rfpRules'

export type Rfp = {
  id: string
  objectID: string
  objectType: 'Rfp'
  objectLabel: string
  title: string
  rfpNo: string | null
  description: string
  company: ObjectRef
  opportunity: ObjectRef | null
  type: LabeledValue | null
  status: LabeledValue | null
  dueDt: string | null
  submissionDt: string | null
  isActive: boolean
  numOfNotes: number
  numOfMilestones: number
  numOfUncompletedMilestones: number
  numOfUncompletedTasks: number
  numOfOpenRfpQuestions: number
  numOfRfpQuestions: number
  createdAt: string | null
  createdBy: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export type RfpInput = Omit<
  Rfp,
  | 'id'
  | 'objectID'
  | 'objectType'
  | 'objectLabel'
  | 'numOfNotes'
  | 'numOfMilestones'
  | 'numOfUncompletedMilestones'
  | 'numOfUncompletedTasks'
  | 'numOfOpenRfpQuestions'
  | 'numOfRfpQuestions'
  | 'createdAt'
  | 'createdBy'
  | 'updatedAt'
  | 'updatedBy'
>

const COLLECTION = 'rfps'

export function emptyRfpInput(
  company: ObjectRef | null = null,
  opportunity: ObjectRef | null = null,
): RfpInput {
  return {
    title: '',
    rfpNo: null,
    description: '',
    company: company ?? { id: '', objectLabel: '' },
    opportunity,
    type: null,
    status: null,
    dueDt: null,
    submissionDt: null,
    isActive: true,
  }
}

export function rfpInputFromRfp(rfp: Rfp): RfpInput {
  const {
    id: _id,
    objectID: _objectID,
    objectType: _objectType,
    objectLabel: _objectLabel,
    numOfNotes: _numOfNotes,
    numOfMilestones: _numOfMilestones,
    numOfUncompletedMilestones: _numOfUncompletedMilestones,
    numOfUncompletedTasks: _numOfUncompletedTasks,
    numOfOpenRfpQuestions: _numOfOpenRfpQuestions,
    numOfRfpQuestions: _numOfRfpQuestions,
    createdAt: _createdAt,
    createdBy: _createdBy,
    updatedAt: _updatedAt,
    updatedBy: _updatedBy,
    ...input
  } = rfp
  return cloneSnapshotValue(input)
}

export async function loadRfp(id: string): Promise<Rfp> {
  const trimmed = id.trim()
  if (!trimmed) {
    throw new Error('RFP not found.')
  }

  const resolvedId = await resolveRfpDocumentId(trimmed)
  if (resolvedId) {
    const snapshot = await getDoc(doc(getFirebaseDb(), COLLECTION, resolvedId))
    if (snapshot.exists()) {
      return mapRfp(snapshot.id, snapshot.data())
    }
  }

  const algoliaHit = await loadRfpHitFromAlgolia(trimmed)
  if (!algoliaHit) {
    throw new Error('RFP not found.')
  }

  const recordId = resolveAlgoliaRecordId(algoliaHit)
  await restoreRfpDocumentFromAlgolia(recordId, algoliaHit)

  const restored = await getDoc(doc(getFirebaseDb(), COLLECTION, recordId))
  if (!restored.exists()) {
    throw new Error('RFP not found.')
  }

  return mapRfp(restored.id, restored.data())
}

async function resolveRfpDocumentId(idOrKey: string): Promise<string | null> {
  const trimmed = idOrKey.trim()
  if (!trimmed) return null

  const directSnapshot = await getDoc(doc(getFirebaseDb(), COLLECTION, trimmed))
  if (directSnapshot.exists()) return directSnapshot.id

  const fallbackQueries = [
    query(collection(getFirebaseDb(), COLLECTION), where('objectID', '==', trimmed), limit(1)),
    query(collection(getFirebaseDb(), COLLECTION), where('id', '==', trimmed), limit(1)),
    query(collection(getFirebaseDb(), COLLECTION), where('title', '==', trimmed), limit(1)),
    query(collection(getFirebaseDb(), COLLECTION), where('objectLabel', '==', trimmed), limit(1)),
  ]

  for (const fallbackQuery of fallbackQueries) {
    const snapshot = await getDocs(fallbackQuery)
    if (!snapshot.empty) return snapshot.docs[0].id
  }

  return null
}

async function restoreRfpDocumentFromAlgolia(recordId: string, hit: RfpHit): Promise<void> {
  requireCurrentUser()

  const data = hit as unknown as Record<string, unknown>
  const company = mapObjectRef(data.company)
  if (!company) {
    throw new Error('RFP company reference is missing.')
  }

  const title = getString(data.title) ?? getString(data.objectLabel) ?? company.objectLabel

  await setDoc(
    doc(getFirebaseDb(), COLLECTION, recordId),
    {
      id: recordId,
      objectID: recordId,
      objectType: 'Rfp',
      objectLabel: getString(data.objectLabel) ?? title,
      title,
      rfpNo: getNullableString(data.rfpNo),
      description: getString(data.description) ?? '',
      company,
      opportunity: mapObjectRef(data.opportunity),
      type: mapLabeledValue(data.type),
      status: mapLabeledValue(data.status),
      dueDt: getNullableString(data.dueDt),
      submissionDt: getNullableString(data.submissionDt),
      isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
      numOfNotes: getNumber(data.numOfNotes) ?? 0,
      numOfMilestones: getNumber(data.numOfMilestones) ?? 0,
      numOfUncompletedMilestones: getNumber(data.numOfUncompletedMilestones) ?? 0,
      numOfUncompletedTasks: getNumber(data.numOfUncompletedTasks) ?? 0,
      numOfOpenRfpQuestions: getNumber(data.numOfOpenRfpQuestions) ?? 0,
      numOfRfpQuestions: getNumber(data.numOfRfpQuestions) ?? 0,
      createdAt: getNullableString(data.createdAt),
      createdBy: getNullableString(data.createdBy),
      updatedAt: getNullableString(data.updatedAt),
      updatedBy: getNullableString(data.updatedBy),
    },
    { merge: true },
  )
}

export async function createRfp(input: RfpInput): Promise<Rfp> {
  const user = requireCurrentUser()
  const normalizedInput = normalizeRfpInput(cloneSnapshotValue(input))
  validateRfpInput(normalizedInput)

  const now = new Date().toISOString()
  const payload = buildRfpPayload(normalizedInput, {
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

  await adjustCompanyRfpCount(payload.company.id, 1)
  if (payload.opportunity?.id) {
    await adjustOpportunityRfpCount(payload.opportunity.id, 1)
  }

  return loadRfp(docRef.id)
}

export async function updateRfp(id: string, input: RfpInput): Promise<Rfp> {
  const user = requireCurrentUser()
  const normalizedInput = normalizeRfpInput(cloneSnapshotValue(input))
  validateRfpInput(normalizedInput)

  const existing = await loadRfp(id)
  const now = new Date().toISOString()
  const payload = buildRfpPayload(normalizedInput, {
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
      numOfNotes: existing.numOfNotes,
      numOfMilestones: existing.numOfMilestones,
      numOfUncompletedMilestones: existing.numOfUncompletedMilestones,
      numOfUncompletedTasks: existing.numOfUncompletedTasks,
      numOfOpenRfpQuestions: existing.numOfOpenRfpQuestions,
      numOfRfpQuestions: existing.numOfRfpQuestions,
    },
    { merge: true },
  )

  await syncCompanyRfpCounts(existing.company, normalizedInput.company)
  await syncOpportunityRfpCounts(existing.opportunity, normalizedInput.opportunity)

  if (existing.title !== payload.title) {
    await propagateRfpLabelChanges(id, payload.title, payload.company, payload.opportunity)
  }

  return loadRfp(id)
}

export async function deleteRfp(id: string): Promise<void> {
  requireCurrentUser()

  const existing = await loadRfp(id)

  const milestonesSnapshot = await getDocs(
    query(collection(getFirebaseDb(), 'rfpMilestones'), where('rfp.id', '==', id)),
  )
  await Promise.all(milestonesSnapshot.docs.map((document) => deleteDoc(document.ref)))

  const notesSnapshot = await getDocs(
    query(collection(getFirebaseDb(), 'notes'), where('linkedObject.id', '==', id)),
  )
  await Promise.all(notesSnapshot.docs.map((document) => deleteDoc(document.ref)))

  await adjustCompanyRfpCount(existing.company.id, -1)
  if (existing.opportunity?.id) {
    await adjustOpportunityRfpCount(existing.opportunity.id, -1)
  }

  await deleteDoc(doc(getFirebaseDb(), COLLECTION, id))
}

export function validateRfpInput(input: RfpInput): void {
  if (!input.title.trim()) {
    throw new Error('Title is required.')
  }
  if (!input.company?.id?.trim() || !input.company.objectLabel.trim()) {
    throw new Error('Company is required.')
  }
}

function buildRfpPayload(
  input: RfpInput,
  audit: {
    createdAt: string | null
    createdBy: string | null
    updatedAt: string
    updatedBy: string
  },
) {
  const title = input.title.trim()

  return {
    title,
    rfpNo: nullableString(input.rfpNo),
    description: input.description ?? '',
    company: normalizeObjectRef(input.company)!,
    opportunity: normalizeObjectRef(input.opportunity),
    type: input.type,
    status: input.status,
    dueDt: nullableString(input.dueDt),
    submissionDt: nullableString(input.submissionDt),
    isActive: input.isActive ?? true,
    objectType: 'Rfp' as const,
    objectLabel: title,
    numOfNotes: 0,
    numOfMilestones: 0,
    numOfUncompletedMilestones: 0,
    numOfUncompletedTasks: 0,
    numOfOpenRfpQuestions: 0,
    numOfRfpQuestions: 0,
    createdAt: audit.createdAt,
    createdBy: audit.createdBy,
    updatedAt: audit.updatedAt,
    updatedBy: audit.updatedBy,
  }
}

function mapRfp(id: string, data: Record<string, unknown>): Rfp {
  const company = mapObjectRef(data.company)
  if (!company) {
    throw new Error('RFP company reference is missing.')
  }

  return {
    id,
    objectID: getString(data.objectID) ?? id,
    objectType: 'Rfp',
    objectLabel: getString(data.objectLabel) ?? getString(data.title) ?? '',
    title: getString(data.title) ?? '',
    rfpNo: getNullableString(data.rfpNo),
    description: getString(data.description) ?? '',
    company,
    opportunity: mapObjectRef(data.opportunity),
    type: mapLabeledValue(data.type),
    status: mapLabeledValue(data.status),
    dueDt: getNullableString(data.dueDt),
    submissionDt: getNullableString(data.submissionDt),
    isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
    numOfNotes: getNumber(data.numOfNotes) ?? 0,
    numOfMilestones: getNumber(data.numOfMilestones) ?? 0,
    numOfUncompletedMilestones: getNumber(data.numOfUncompletedMilestones) ?? 0,
    numOfUncompletedTasks: getNumber(data.numOfUncompletedTasks) ?? 0,
    numOfOpenRfpQuestions: getNumber(data.numOfOpenRfpQuestions) ?? 0,
    numOfRfpQuestions: getNumber(data.numOfRfpQuestions) ?? 0,
    createdAt: getNullableString(data.createdAt),
    createdBy: getNullableString(data.createdBy),
    updatedAt: getNullableString(data.updatedAt),
    updatedBy: getNullableString(data.updatedBy),
  }
}

async function adjustCompanyRfpCount(companyId: string, delta: number): Promise<void> {
  const companyRef = doc(getFirebaseDb(), 'companies', companyId)
  const snapshot = await getDoc(companyRef)
  if (!snapshot.exists()) return

  const current = typeof snapshot.data().numOfRfps === 'number' ? snapshot.data().numOfRfps : 0
  await updateDoc(companyRef, { numOfRfps: Math.max(0, current + delta) })
}

async function adjustOpportunityRfpCount(opportunityId: string, delta: number): Promise<void> {
  const opportunityRef = doc(getFirebaseDb(), 'opportunities', opportunityId)
  const snapshot = await getDoc(opportunityRef)
  if (!snapshot.exists()) return

  const current = typeof snapshot.data().numOfRfps === 'number' ? snapshot.data().numOfRfps : 0
  await updateDoc(opportunityRef, { numOfRfps: Math.max(0, current + delta) })
}

async function syncCompanyRfpCounts(previousCompany: ObjectRef, nextCompany: ObjectRef): Promise<void> {
  if (previousCompany.id === nextCompany.id) return

  await adjustCompanyRfpCount(previousCompany.id, -1)
  await adjustCompanyRfpCount(nextCompany.id, 1)
}

async function syncOpportunityRfpCounts(
  previousOpportunity: ObjectRef | null,
  nextOpportunity: ObjectRef | null,
): Promise<void> {
  const previousId = previousOpportunity?.id ?? null
  const nextId = nextOpportunity?.id ?? null
  if (previousId === nextId) return

  if (previousId) {
    await adjustOpportunityRfpCount(previousId, -1)
  }
  if (nextId) {
    await adjustOpportunityRfpCount(nextId, 1)
  }
}

async function propagateRfpLabelChanges(
  rfpId: string,
  title: string,
  company: ObjectRef,
  opportunity: ObjectRef | null,
): Promise<void> {
  const rfpRef = { id: rfpId, objectLabel: title }

  const milestonesSnapshot = await getDocs(
    query(collection(getFirebaseDb(), 'rfpMilestones'), where('rfp.id', '==', rfpId)),
  )
  await Promise.all(
    milestonesSnapshot.docs.map((document) =>
      updateDoc(document.ref, {
        rfp: rfpRef,
        company,
        opportunity,
      }),
    ),
  )

  const notesSnapshot = await getDocs(
    query(collection(getFirebaseDb(), 'notes'), where('linkedObject.id', '==', rfpId)),
  )
  await Promise.all(
    notesSnapshot.docs.map((document) =>
      updateDoc(document.ref, {
        linkedObject: {
          collection: 'rfps',
          id: rfpId,
          objectLabel: title,
          type: 'Rfp',
        },
      }),
    ),
  )
}

export async function refreshRfpMilestoneCounts(rfpId: string): Promise<void> {
  const snapshot = await getDocs(
    query(collection(getFirebaseDb(), 'rfpMilestones'), where('rfp.id', '==', rfpId)),
  )

  let numOfUncompletedMilestones = 0
  for (const document of snapshot.docs) {
    if (document.data().isCompleted !== true) {
      numOfUncompletedMilestones += 1
    }
  }

  await updateDoc(doc(getFirebaseDb(), COLLECTION, rfpId), {
    numOfMilestones: snapshot.size,
    numOfUncompletedMilestones,
  })
}

function normalizeObjectRef(value: ObjectRef | null): ObjectRef | null {
  if (!value?.id?.trim() || !value.objectLabel.trim()) return null
  return {
    id: value.id.trim(),
    objectLabel: value.objectLabel.trim(),
  }
}

function mapObjectRef(value: unknown): ObjectRef | null {
  if (!value || typeof value !== 'object') return null

  const id = getString((value as { id?: unknown }).id)
  const objectLabel = getString((value as { objectLabel?: unknown }).objectLabel)
  if (!id || !objectLabel) return null

  return { id, objectLabel }
}

function mapLabeledValue(value: unknown): LabeledValue | null {
  if (!value || typeof value !== 'object') return null

  const label = getString((value as { label?: unknown }).label)
  const itemValue = getString((value as { value?: unknown }).value)
  if (!label || !itemValue) return null

  return { label, value: itemValue }
}

function requireCurrentUser() {
  const user = getFirebaseAuth().currentUser
  if (!user) {
    throw new Error('You must be signed in to manage RFPs.')
  }
  return user
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function getNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function nullableString(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
