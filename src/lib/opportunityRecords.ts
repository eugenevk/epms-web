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
import type { LabeledValue, ObjectRef } from '@/lib/companies'
import { normalizeOpportunityInput } from '@/lib/opportunityRules'
import type { OpportunityStage } from '@/lib/stages'
import { loadOpportunityStages } from '@/lib/stages'

export type Opportunity = {
  id: string
  objectID: string
  objectType: 'Opportunity'
  objectLabel: string
  title: string
  opportunityNo: string | null
  description: string
  company: ObjectRef | null
  status: LabeledValue | null
  currency: LabeledValue | null
  stage: OpportunityStage | null
  stageValue: number
  leadSC: ObjectRef | null
  amount: number
  acv: number
  likelihood: number
  targetDt: string | null
  closingDt: string | null
  isActive: boolean
  sfRef: string | null
  numOfNotes: number
  numOfRfps: number
  numOfUncompletedTasks: number
  createdAt: string | null
  createdBy: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export type OpportunityInput = Omit<
  Opportunity,
  | 'id'
  | 'objectID'
  | 'objectType'
  | 'objectLabel'
  | 'stageValue'
  | 'numOfNotes'
  | 'numOfRfps'
  | 'numOfUncompletedTasks'
  | 'createdAt'
  | 'createdBy'
  | 'updatedAt'
  | 'updatedBy'
>

const COLLECTION = 'opportunities'

export function emptyOpportunityInput(company: ObjectRef | null = null): OpportunityInput {
  return {
    title: '',
    opportunityNo: null,
    description: '',
    company,
    status: null,
    currency: null,
    stage: null,
    leadSC: null,
    amount: 0,
    acv: 0,
    likelihood: 0,
    targetDt: null,
    closingDt: null,
    isActive: true,
    sfRef: null,
  }
}

export function opportunityInputFromOpportunity(opportunity: Opportunity): OpportunityInput {
  const {
    id: _id,
    objectID: _objectID,
    objectType: _objectType,
    objectLabel: _objectLabel,
    stageValue: _stageValue,
    numOfNotes: _numOfNotes,
    numOfRfps: _numOfRfps,
    numOfUncompletedTasks: _numOfUncompletedTasks,
    createdAt: _createdAt,
    createdBy: _createdBy,
    updatedAt: _updatedAt,
    updatedBy: _updatedBy,
    ...input
  } = opportunity
  return cloneSnapshotValue(input)
}

export async function loadOpportunity(id: string): Promise<Opportunity> {
  const snapshot = await getDoc(doc(getFirebaseDb(), COLLECTION, id))
  if (!snapshot.exists()) {
    throw new Error('Opportunity not found.')
  }
  return mapOpportunity(snapshot.id, snapshot.data())
}

export async function createOpportunity(input: OpportunityInput): Promise<Opportunity> {
  const user = requireCurrentUser()
  const stages = await loadOpportunityStages()
  const normalizedInput = normalizeOpportunityInput(cloneSnapshotValue(input), stages)
  validateOpportunityInput(normalizedInput)

  const now = new Date().toISOString()
  const payload = buildOpportunityPayload(normalizedInput, {
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

  if (normalizedInput.company?.id) {
    await adjustCompanyOpportunityCount(normalizedInput.company.id, 1)
  }

  return loadOpportunity(docRef.id)
}

export async function updateOpportunity(id: string, input: OpportunityInput): Promise<Opportunity> {
  const user = requireCurrentUser()
  const stages = await loadOpportunityStages()
  const normalizedInput = normalizeOpportunityInput(cloneSnapshotValue(input), stages)
  validateOpportunityInput(normalizedInput)

  const existing = await loadOpportunity(id)
  const now = new Date().toISOString()
  const payload = buildOpportunityPayload(normalizedInput, {
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
      numOfRfps: existing.numOfRfps,
      numOfUncompletedTasks: existing.numOfUncompletedTasks,
    },
    { merge: true },
  )

  await syncCompanyOpportunityCounts(existing.company, normalizedInput.company)

  if (existing.title !== payload.title) {
    await propagateOpportunityLabelChanges(id, payload.title, payload.opportunityNo)
  }

  return loadOpportunity(id)
}

export async function deleteOpportunity(id: string): Promise<void> {
  requireCurrentUser()

  const existing = await loadOpportunity(id)

  const notesSnapshot = await getDocs(
    query(collection(getFirebaseDb(), 'notes'), where('linkedObject.id', '==', id)),
  )
  await Promise.all(notesSnapshot.docs.map((document) => deleteDoc(document.ref)))

  const rfpsSnapshot = await getDocs(
    query(collection(getFirebaseDb(), 'rfps'), where('opportunity.id', '==', id)),
  )
  await Promise.all(
    rfpsSnapshot.docs.map((document) =>
      updateDoc(document.ref, {
        opportunity: null,
      }),
    ),
  )

  if (existing.company?.id) {
    await adjustCompanyOpportunityCount(existing.company.id, -1)
  }

  await deleteDoc(doc(getFirebaseDb(), COLLECTION, id))
}

export function validateOpportunityInput(input: OpportunityInput): void {
  if (!input.title.trim()) {
    throw new Error('Title is required.')
  }
}

function buildOpportunityPayload(
  input: OpportunityInput,
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
    opportunityNo: nullableString(input.opportunityNo),
    description: input.description ?? '',
    company: input.company,
    status: input.status,
    currency: input.currency,
    stage: input.stage,
    stageValue: input.stage?.stageValue ?? 0,
    leadSC: input.leadSC,
    amount: input.amount ?? 0,
    acv: input.acv ?? 0,
    likelihood: input.likelihood ?? 0,
    targetDt: nullableString(input.targetDt),
    closingDt: nullableString(input.closingDt),
    isActive: input.isActive ?? true,
    sfRef: nullableString(input.sfRef),
    objectType: 'Opportunity' as const,
    objectLabel: title,
    numOfNotes: 0,
    numOfRfps: 0,
    numOfUncompletedTasks: 0,
    createdAt: audit.createdAt,
    createdBy: audit.createdBy,
    updatedAt: audit.updatedAt,
    updatedBy: audit.updatedBy,
  }
}

function mapOpportunity(id: string, data: Record<string, unknown>): Opportunity {
  const stage =
    data.stage && typeof data.stage === 'object'
      ? {
          id: getString((data.stage as { id?: unknown }).id) ?? '',
          label: getString((data.stage as { label?: unknown }).label) ?? 'Stage',
          stageValue: getNumber(data.stageValue) ?? getNumber((data.stage as { stageValue?: unknown }).stageValue) ?? 0,
          color: getNullableString((data.stage as { color?: unknown }).color),
          likelihood: getNullableNumber((data.stage as { likelihood?: unknown }).likelihood),
          description: getNullableString((data.stage as { description?: unknown }).description),
        }
      : null

  return {
    id,
    objectID: getString(data.objectID) ?? id,
    objectType: 'Opportunity',
    objectLabel: getString(data.objectLabel) ?? getString(data.title) ?? '',
    title: getString(data.title) ?? '',
    opportunityNo: getNullableString(data.opportunityNo),
    description: getString(data.description) ?? '',
    company: mapObjectRef(data.company),
    status: mapLabeledValue(data.status),
    currency: mapLabeledValue(data.currency),
    stage,
    stageValue: getNumber(data.stageValue) ?? stage?.stageValue ?? 0,
    leadSC: mapObjectRef(data.leadSC),
    amount: getNumber(data.amount) ?? 0,
    acv: getNumber(data.acv) ?? 0,
    likelihood: getNumber(data.likelihood) ?? 0,
    targetDt: getNullableString(data.targetDt),
    closingDt: getNullableString(data.closingDt),
    isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
    sfRef: getNullableString(data.sfRef),
    numOfNotes: getNumber(data.numOfNotes) ?? 0,
    numOfRfps: getNumber(data.numOfRfps) ?? 0,
    numOfUncompletedTasks: getNumber(data.numOfUncompletedTasks) ?? 0,
    createdAt: getNullableString(data.createdAt),
    createdBy: getNullableString(data.createdBy),
    updatedAt: getNullableString(data.updatedAt),
    updatedBy: getNullableString(data.updatedBy),
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

async function adjustCompanyOpportunityCount(companyId: string, delta: number): Promise<void> {
  const companyRef = doc(getFirebaseDb(), 'companies', companyId)
  const snapshot = await getDoc(companyRef)
  if (!snapshot.exists()) return

  const current =
    typeof snapshot.data().numOfOpportunities === 'number' ? snapshot.data().numOfOpportunities : 0
  await updateDoc(companyRef, { numOfOpportunities: Math.max(0, current + delta) })
}

async function syncCompanyOpportunityCounts(
  previousCompany: ObjectRef | null,
  nextCompany: ObjectRef | null,
): Promise<void> {
  const previousId = previousCompany?.id ?? null
  const nextId = nextCompany?.id ?? null

  if (previousId === nextId) return

  if (previousId) {
    await adjustCompanyOpportunityCount(previousId, -1)
  }

  if (nextId) {
    await adjustCompanyOpportunityCount(nextId, 1)
  }
}

async function propagateOpportunityLabelChanges(
  opportunityId: string,
  title: string,
  opportunityNo: string | null,
): Promise<void> {
  const rfpsSnapshot = await getDocs(
    query(collection(getFirebaseDb(), 'rfps'), where('opportunity.id', '==', opportunityId)),
  )

  await Promise.all(
    rfpsSnapshot.docs.map((document) =>
      updateDoc(document.ref, {
        opportunity: {
          id: opportunityId,
          objectLabel: title,
          ...(opportunityNo ? { opportunityNo } : {}),
        },
      }),
    ),
  )

  const notesSnapshot = await getDocs(
    query(collection(getFirebaseDb(), 'notes'), where('linkedObject.id', '==', opportunityId)),
  )

  await Promise.all(
    notesSnapshot.docs.map((document) =>
      updateDoc(document.ref, {
        linkedObject: {
          ...(document.data().linkedObject as Record<string, unknown>),
          objectLabel: title,
        },
      }),
    ),
  )
}

function nullableString(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function getNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function getNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function requireCurrentUser() {
  const user = getFirebaseAuth().currentUser
  if (!user) {
    throw new Error('You must be signed in to manage opportunities.')
  }
  return user
}
