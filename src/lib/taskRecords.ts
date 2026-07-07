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
import type { LabeledValue } from '@/lib/companies'
import { isEmptyRichText } from '@/lib/richText'
import { normalizeTaskInput } from '@/lib/taskRules'

export type TaskLinkedObject = {
  collection: 'companies' | 'opportunities' | 'rfps'
  id: string
  type: 'Company' | 'Opportunity' | 'Rfp'
  objectLabel: string
}

export type Task = {
  id: string
  objectID: string
  objectType: 'Task'
  objectLabel: string
  summary: string
  description: string
  outcome: string
  dueDt: string | null
  isCompleted: boolean
  isOverdue: boolean
  priority: LabeledValue | null
  status: LabeledValue | null
  linkedObject: TaskLinkedObject
  createdAt: string | null
  createdBy: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export type TaskInput = {
  summary: string
  description: string
  outcome: string
  dueDt: string | null
  isCompleted: boolean
  priority: LabeledValue | null
  status: LabeledValue | null
}

export type CreateTaskParams = TaskInput & {
  linkedObject: TaskLinkedObject
}

const COLLECTION = 'tasks'

const OPEN_STATUS: LabeledValue = { label: 'Open', value: 'open' }
const CLOSED_STATUS: LabeledValue = { label: 'Closed', value: 'closed' }

function requireCurrentUser() {
  const user = getFirebaseAuth().currentUser
  if (!user) {
    throw new Error('You must be signed in to manage tasks.')
  }
  return user
}

function formatTaskDateTime(): string {
  const date = new Date()
  return date.toDateString() + ` ${date.toLocaleTimeString()}`
}

function getString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function getBoolean(value: unknown): boolean {
  return value === true
}

function mapLabeledValue(value: unknown): LabeledValue | null {
  if (!value || typeof value !== 'object') return null
  const label = getString((value as { label?: unknown }).label)
  const itemValue = getString((value as { value?: unknown }).value)
  if (!label || !itemValue) return null
  return { label, value: itemValue }
}

function mapLinkedObject(value: unknown): TaskLinkedObject | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const id = getString(record.id)
  const collection = getString(record.collection)
  const type = getString(record.type)
  const objectLabel = getString(record.objectLabel)
  if (!id || !collection || !type || !objectLabel) return null
  if (collection !== 'companies' && collection !== 'opportunities' && collection !== 'rfps') {
    return null
  }
  if (type !== 'Company' && type !== 'Opportunity' && type !== 'Rfp') {
    return null
  }
  return {
    collection,
    id,
    type,
    objectLabel,
  }
}

export function computeTaskIsOverdue(dueDt: string | null, isCompleted: boolean): boolean {
  if (isCompleted || !dueDt) return false
  const due = new Date(dueDt)
  if (Number.isNaN(due.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return due < today
}

function resolveTaskStatus(isCompleted: boolean, status: LabeledValue | null): LabeledValue {
  if (isCompleted) return CLOSED_STATUS
  if (status?.value === 'closed') return OPEN_STATUS
  return status ?? OPEN_STATUS
}

function mapTask(id: string, data: Record<string, unknown>): Task {
  const linkedObject = mapLinkedObject(data.linkedObject)
  if (!linkedObject) {
    throw new Error('Task linked object is missing.')
  }

  const isCompleted = getBoolean(data.isCompleted)
  const dueDt = getString(data.dueDt)

  return {
    id,
    objectID: getString(data.objectID) ?? id,
    objectType: 'Task',
    objectLabel: getString(data.objectLabel) ?? getString(data.summary) ?? '',
    summary: getString(data.summary) ?? '',
    description: getString(data.description) ?? '',
    outcome: getString(data.outcome) ?? '',
    dueDt,
    isCompleted,
    isOverdue:
      typeof data.isOverdue === 'boolean' ? data.isOverdue : computeTaskIsOverdue(dueDt, isCompleted),
    priority: isCompleted ? null : mapLabeledValue(data.priority),
    status: resolveTaskStatus(isCompleted, mapLabeledValue(data.status)),
    linkedObject,
    createdAt: getString(data.createdAt),
    createdBy: getString(data.createdBy),
    updatedAt: getString(data.updatedAt),
    updatedBy: getString(data.updatedBy),
  }
}

function validateTaskInput(input: TaskInput): void {
  if (!input.summary.trim()) {
    throw new Error('Task summary is required.')
  }
}

function buildTaskPayload(
  input: TaskInput,
  linkedObject: TaskLinkedObject,
  audit: {
    createdAt: string | null
    createdBy: string | null
    updatedAt: string
    updatedBy: string
  },
) {
  const summary = input.summary.trim()
  const dueDt = input.dueDt?.trim() || null
  const isCompleted = Boolean(input.isCompleted)
  const status = resolveTaskStatus(isCompleted, input.status)
  const description = isEmptyRichText(input.description) ? '' : input.description
  const outcome = isEmptyRichText(input.outcome) ? '' : input.outcome

  return {
    linkedObject,
    summary,
    description,
    outcome,
    dueDt,
    isCompleted,
    isOverdue: computeTaskIsOverdue(dueDt, isCompleted),
    priority: isCompleted ? null : input.priority,
    status,
    objectType: 'Task' as const,
    objectLabel: summary,
    createdAt: audit.createdAt,
    createdBy: audit.createdBy,
    updatedAt: audit.updatedAt,
    updatedBy: audit.updatedBy,
  }
}

async function countUncompletedTasks(linkedObjectId: string): Promise<number> {
  const snapshot = await getDocs(
    query(collection(getFirebaseDb(), COLLECTION), where('linkedObject.id', '==', linkedObjectId)),
  )

  return snapshot.docs.filter((document) => document.data().isCompleted !== true).length
}

async function refreshLinkedObjectTaskCount(linkedObject: TaskLinkedObject): Promise<void> {
  if (!linkedObject.id) return

  const count = await countUncompletedTasks(linkedObject.id)
  await updateDoc(doc(getFirebaseDb(), linkedObject.collection, linkedObject.id), {
    numOfUncompletedTasks: count,
  })
}

export function emptyTaskInput(): TaskInput {
  return {
    summary: '',
    description: '',
    outcome: '',
    dueDt: null,
    isCompleted: false,
    priority: null,
    status: OPEN_STATUS,
  }
}

export function taskInputFromTask(task: Task): TaskInput {
  return {
    summary: task.summary,
    description: task.description,
    outcome: task.outcome,
    dueDt: task.dueDt,
    isCompleted: task.isCompleted,
    priority: task.priority,
    status: task.status,
  }
}

export async function loadTasksForLinkedObject(
  linkedObjectId: string,
  linkedObjectCollection?: TaskLinkedObject['collection'],
): Promise<Task[]> {
  const snapshot = await getDocs(
    query(collection(getFirebaseDb(), COLLECTION), where('linkedObject.id', '==', linkedObjectId)),
  )

  return snapshot.docs
    .map((document) => mapTask(document.id, document.data()))
    .filter((task) => {
      if (!linkedObjectCollection) return true
      return task.linkedObject.collection === linkedObjectCollection
    })
    .sort(compareTasks)
}

export async function loadOpenTasks(): Promise<Task[]> {
  const snapshot = await getDocs(
    query(collection(getFirebaseDb(), COLLECTION), where('isCompleted', '==', false)),
  )

  return snapshot.docs.map((document) => mapTask(document.id, document.data())).sort(compareTasks)
}

export async function loadAllTasksFromFirestore(): Promise<Task[]> {
  const snapshot = await getDocs(collection(getFirebaseDb(), COLLECTION))

  return snapshot.docs.map((document) => mapTask(document.id, document.data())).sort(compareTasks)
}

export async function loadTask(id: string): Promise<Task> {
  const snapshot = await getDoc(doc(getFirebaseDb(), COLLECTION, id))
  if (!snapshot.exists()) {
    throw new Error('Task not found.')
  }

  return mapTask(id, snapshot.data())
}

export function compareTasks(left: Task, right: Task): number {
  if (left.isCompleted !== right.isCompleted) {
    return left.isCompleted ? 1 : -1
  }

  const leftDue = left.dueDt ?? ''
  const rightDue = right.dueDt ?? ''
  if (!leftDue && !rightDue) {
    return left.summary.localeCompare(right.summary, 'en', { sensitivity: 'base' })
  }
  if (!leftDue) return 1
  if (!rightDue) return -1
  return leftDue.localeCompare(rightDue, 'en', { sensitivity: 'base' })
}

export async function createTask(params: CreateTaskParams): Promise<Task> {
  const user = requireCurrentUser()
  const normalizedParams = normalizeTaskInput(params)
  validateTaskInput(normalizedParams)

  const now = formatTaskDateTime()
  const linkedObject: TaskLinkedObject = {
    collection: params.linkedObject.collection,
    id: params.linkedObject.id,
    type: params.linkedObject.type,
    objectLabel: params.linkedObject.objectLabel.trim(),
  }

  const payload = buildTaskPayload(
    normalizedParams,
    linkedObject,
    {
      createdAt: now,
      createdBy: user.email ?? user.uid,
      updatedAt: now,
      updatedBy: user.email ?? user.uid,
    },
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

  await refreshLinkedObjectTaskCount(linkedObject)

  return mapTask(docRef.id, {
    ...payload,
    id: docRef.id,
    objectID: docRef.id,
  })
}

export async function updateTask(id: string, input: TaskInput): Promise<Task> {
  const user = requireCurrentUser()
  const normalizedInput = normalizeTaskInput(input)
  validateTaskInput(normalizedInput)

  const existingSnapshot = await getDoc(doc(getFirebaseDb(), COLLECTION, id))
  if (!existingSnapshot.exists()) {
    throw new Error('Task not found.')
  }

  const existing = mapTask(id, existingSnapshot.data())
  const now = formatTaskDateTime()
  const payload = buildTaskPayload(normalizedInput, existing.linkedObject, {
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

  await refreshLinkedObjectTaskCount(existing.linkedObject)

  return mapTask(id, {
    ...payload,
    id,
    objectID: id,
  })
}

export async function completeTask(task: Task): Promise<Task> {
  if (task.isCompleted) return task

  return updateTask(task.id, {
    ...taskInputFromTask(task),
    isCompleted: true,
    status: CLOSED_STATUS,
    priority: null,
  })
}

export async function migrateCompletedTaskPriorities(): Promise<{ updated: number; total: number }> {
  requireCurrentUser()

  const snapshot = await getDocs(
    query(collection(getFirebaseDb(), COLLECTION), where('isCompleted', '==', true)),
  )

  let updated = 0

  for (const document of snapshot.docs) {
    const data = document.data()
    if (!data.priority) continue

    await updateDoc(document.ref, { priority: null })
    updated += 1
  }

  return { updated, total: snapshot.size }
}

export async function deleteTask(id: string): Promise<void> {
  requireCurrentUser()

  const taskRef = doc(getFirebaseDb(), COLLECTION, id)
  const existingSnapshot = await getDoc(taskRef)
  if (!existingSnapshot.exists()) {
    throw new Error('Task not found.')
  }

  const existing = mapTask(id, existingSnapshot.data())
  await deleteDoc(taskRef)
  await refreshLinkedObjectTaskCount(existing.linkedObject)
}
