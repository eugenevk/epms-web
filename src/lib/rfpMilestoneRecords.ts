import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore'
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase'
import { cloneSnapshotValue } from '@/lib/formSnapshot'
import type { ObjectRef } from '@/lib/companies'
import { compareOpenRfpMilestones } from '@/lib/rfps'
import { refreshRfpMilestoneCounts } from '@/lib/rfpRecords'

export type RfpMilestone = {
  id: string
  title: string
  startDt: string | null
  dueDt: string | null
  isCompleted: boolean
  isOverdue: boolean
  company: ObjectRef
  opportunity: ObjectRef | null
  rfp: ObjectRef
  createdAt: string | null
  createdBy: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export type RfpMilestoneInput = Omit<
  RfpMilestone,
  'id' | 'isOverdue' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'
>

export type RfpMilestoneContext = {
  company: ObjectRef
  opportunity: ObjectRef | null
  rfp: ObjectRef
}

const COLLECTION = 'rfpMilestones'

export function emptyRfpMilestoneInput(context: RfpMilestoneContext): RfpMilestoneInput {
  return {
    title: '',
    startDt: null,
    dueDt: null,
    isCompleted: false,
    company: context.company,
    opportunity: context.opportunity,
    rfp: context.rfp,
  }
}

export function rfpMilestoneInputFromMilestone(milestone: RfpMilestone): RfpMilestoneInput {
  const {
    id: _id,
    isOverdue: _isOverdue,
    createdAt: _createdAt,
    createdBy: _createdBy,
    updatedAt: _updatedAt,
    updatedBy: _updatedBy,
    ...input
  } = milestone
  return cloneSnapshotValue(input)
}

export async function loadRfpMilestones(rfpId: string): Promise<RfpMilestone[]> {
  const snapshot = await getDocs(
    query(collection(getFirebaseDb(), COLLECTION), where('rfp.id', '==', rfpId)),
  )

  return snapshot.docs
    .map((document) => mapRfpMilestone(document.id, document.data()))
    .sort((left, right) => {
      const leftDate = left.dueDt ?? left.startDt ?? ''
      const rightDate = right.dueDt ?? right.startDt ?? ''
      return leftDate.localeCompare(rightDate, 'en', { sensitivity: 'base' })
    })
}

export async function loadOpenRfpMilestones(): Promise<RfpMilestone[]> {
  const snapshot = await getDocs(
    query(collection(getFirebaseDb(), COLLECTION), where('isCompleted', '==', false)),
  )

  return snapshot.docs
    .map((document) => mapRfpMilestone(document.id, document.data()))
    .sort(compareOpenRfpMilestones)
}

export async function loadRfpMilestone(id: string): Promise<RfpMilestone> {
  const snapshot = await getDoc(doc(getFirebaseDb(), COLLECTION, id))
  if (!snapshot.exists()) {
    throw new Error('RFP milestone not found.')
  }

  return mapRfpMilestone(snapshot.id, snapshot.data())
}

export async function createRfpMilestone(input: RfpMilestoneInput): Promise<RfpMilestone> {
  const user = requireCurrentUser()
  validateRfpMilestoneInput(input)

  const now = new Date().toISOString()
  const payload = buildRfpMilestonePayload(input, {
    createdAt: now,
    createdBy: user.email ?? user.uid,
    updatedAt: now,
    updatedBy: user.email ?? user.uid,
  })

  const docRef = await addDoc(collection(getFirebaseDb(), COLLECTION), {
    ...payload,
    id: null,
  })

  await setDoc(
    docRef,
    {
      ...payload,
      id: docRef.id,
    },
    { merge: true },
  )

  await refreshRfpMilestoneCounts(input.rfp.id)

  return mapRfpMilestone(docRef.id, {
    ...payload,
    id: docRef.id,
  })
}

export async function updateRfpMilestone(id: string, input: RfpMilestoneInput): Promise<RfpMilestone> {
  const user = requireCurrentUser()
  validateRfpMilestoneInput(input)

  const existingSnapshot = await getDoc(doc(getFirebaseDb(), COLLECTION, id))
  if (!existingSnapshot.exists()) {
    throw new Error('RFP milestone not found.')
  }

  const now = new Date().toISOString()
  const payload = buildRfpMilestonePayload(input, {
    createdAt: getNullableString(existingSnapshot.data().createdAt),
    createdBy: getNullableString(existingSnapshot.data().createdBy),
    updatedAt: now,
    updatedBy: user.email ?? user.uid,
  })

  await setDoc(
    doc(getFirebaseDb(), COLLECTION, id),
    {
      ...payload,
      id,
    },
    { merge: true },
  )

  await refreshRfpMilestoneCounts(input.rfp.id)

  return mapRfpMilestone(id, {
    ...payload,
    id,
  })
}

export async function deleteRfpMilestone(id: string, rfpId: string): Promise<void> {
  requireCurrentUser()
  await deleteDoc(doc(getFirebaseDb(), COLLECTION, id))
  await refreshRfpMilestoneCounts(rfpId)
}

export async function completeRfpMilestone(milestone: RfpMilestone): Promise<RfpMilestone> {
  if (milestone.isCompleted) {
    return milestone
  }

  return updateRfpMilestone(milestone.id, {
    ...rfpMilestoneInputFromMilestone(milestone),
    isCompleted: true,
  })
}

export function validateRfpMilestoneInput(input: RfpMilestoneInput): void {
  if (!input.title.trim()) {
    throw new Error('Milestone title is required.')
  }
  if (!input.rfp?.id?.trim()) {
    throw new Error('RFP reference is required.')
  }
}

function buildRfpMilestonePayload(
  input: RfpMilestoneInput,
  audit: {
    createdAt: string | null
    createdBy: string | null
    updatedAt: string
    updatedBy: string
  },
) {
  const dueDt = nullableString(input.dueDt)

  return {
    title: input.title.trim(),
    startDt: nullableString(input.startDt),
    dueDt,
    isCompleted: Boolean(input.isCompleted),
    isOverdue: computeIsOverdue(dueDt, input.isCompleted),
    company: input.company,
    opportunity: input.opportunity,
    rfp: input.rfp,
    createdAt: audit.createdAt,
    createdBy: audit.createdBy,
    updatedAt: audit.updatedAt,
    updatedBy: audit.updatedBy,
  }
}

function computeIsOverdue(dueDt: string | null, isCompleted: boolean): boolean {
  if (isCompleted || !dueDt) return false

  const due = new Date(dueDt)
  if (Number.isNaN(due.getTime())) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)

  return due < today
}

function mapRfpMilestone(id: string, data: Record<string, unknown>): RfpMilestone {
  const company = mapObjectRef(data.company)
  const rfp = mapObjectRef(data.rfp)
  if (!company || !rfp) {
    throw new Error('RFP milestone references are incomplete.')
  }

  const dueDt = getNullableString(data.dueDt)
  const isCompleted = Boolean(data.isCompleted)

  return {
    id,
    title: getString(data.title) ?? '',
    startDt: getNullableString(data.startDt),
    dueDt,
    isCompleted,
    isOverdue:
      typeof data.isOverdue === 'boolean' ? data.isOverdue : computeIsOverdue(dueDt, isCompleted),
    company,
    opportunity: mapObjectRef(data.opportunity),
    rfp,
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

function requireCurrentUser() {
  const user = getFirebaseAuth().currentUser
  if (!user) {
    throw new Error('You must be signed in to manage RFP milestones.')
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
