import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase'
import { cloneSnapshotValue } from '@/lib/formSnapshot'

export type LabeledValue = {
  label: string
  value: string
}

export type CompanyHosting = 'cloud' | 'self-managed'

export type ObjectRef = {
  id: string
  objectLabel: string
}

export type CompanySummary = {
  id: string
  name: string
  objectLabel: string
  companyNo: string | null
  logoUrl: string | null
  city: string | null
  country: LabeledValue | null
  industry: LabeledValue | null
  companyType: LabeledValue | null
  numOfContacts: number
  healthScore: number
  isReference: boolean
}

export type Company = CompanySummary & {
  objectID: string
  objectType: 'Company'
  duns: string | null
  streetLine1: string | null
  streetLine2: string | null
  zipcode: string | null
  state: string | null
  fullAddress: string | null
  phone: string | null
  website: string | null
  customerLevel: LabeledValue | null
  customerSince: string | null
  accountManager: ObjectRef | null
  implPartner: ObjectRef | null
  sfRef: string | null
  logoUrl: string | null
  logoPath: string | null
  description: string
  isFocusPartner: boolean
  nda: boolean
  hosting: CompanyHosting | null
  numOfOpportunities: number
  numOfProducts: number
  numOfProductsInUse: number
  numOfNotes: number
  numOfUncompletedTasks: number
  numOfRfps: number
  numOfDeals: number
  createdAt: string | null
  createdBy: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export type CompanyInput = Omit<
  Company,
  'id' | 'objectID' | 'objectType' | 'objectLabel' | 'fullAddress' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'
>

export type CompaniesPage = {
  companies: CompanySummary[]
  cursor: QueryDocumentSnapshot<DocumentData> | null
  hasMore: boolean
}

export type CompanySortOption = 'name-asc' | 'name-desc' | 'health-desc'

const COLLECTION = 'companies'

export function emptyCompanyInput(): CompanyInput {
  return {
    name: '',
    companyNo: null,
    duns: null,
    streetLine1: null,
    streetLine2: null,
    zipcode: null,
    city: null,
    state: null,
    country: null,
    phone: null,
    website: null,
    industry: null,
    companyType: null,
    customerLevel: null,
    customerSince: null,
    healthScore: 0,
    accountManager: null,
    implPartner: null,
    sfRef: null,
    logoUrl: null,
    logoPath: null,
    description: '',
    isFocusPartner: false,
    nda: false,
    hosting: null,
    isReference: false,
    numOfContacts: 0,
    numOfOpportunities: 0,
    numOfProducts: 0,
    numOfProductsInUse: 0,
    numOfNotes: 0,
    numOfUncompletedTasks: 0,
    numOfRfps: 0,
    numOfDeals: 0,
  }
}

export function companyInputFromCompany(company: Company): CompanyInput {
  const {
    id: _id,
    objectID: _objectID,
    objectType: _objectType,
    objectLabel: _objectLabel,
    fullAddress: _fullAddress,
    createdAt: _createdAt,
    createdBy: _createdBy,
    updatedAt: _updatedAt,
    updatedBy: _updatedBy,
    ...input
  } = company
  return cloneSnapshotValue(input)
}

export async function loadCompaniesPage(
  pageSize = 50,
  cursor: QueryDocumentSnapshot<DocumentData> | null = null,
): Promise<CompaniesPage> {
  const constraints = [orderBy('name'), limit(pageSize + 1)]
  const pageQuery = cursor
    ? query(collection(getFirebaseDb(), COLLECTION), ...constraints, startAfter(cursor))
    : query(collection(getFirebaseDb(), COLLECTION), ...constraints)

  const snapshot = await getDocs(pageQuery)
  const docs = snapshot.docs.slice(0, pageSize)

  return {
    companies: docs.map(mapCompanySummary),
    cursor: docs.at(-1) ?? null,
    hasMore: snapshot.docs.length > pageSize,
  }
}

export async function loadAllCompanies(): Promise<CompanySummary[]> {
  const snapshot = await getDocs(query(collection(getFirebaseDb(), COLLECTION), orderBy('name')))
  return snapshot.docs.map(mapCompanySummary)
}

export async function loadCompany(id: string): Promise<Company> {
  const snapshot = await getDoc(doc(getFirebaseDb(), COLLECTION, id))
  if (!snapshot.exists()) {
    throw new Error('Company not found.')
  }
  return mapCompany(snapshot.id, snapshot.data())
}

export async function createCompany(input: CompanyInput): Promise<Company> {
  const user = requireCurrentUser()
  validateCompanyInput(input)

  const now = new Date().toISOString()
  const payload = buildCompanyPayload(input, {
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

  const company: Company = {
    ...mapCompany(docRef.id, payload),
    id: docRef.id,
    objectID: docRef.id,
  }

  await setDoc(docRef, { id: docRef.id, objectID: docRef.id }, { merge: true })

  return company
}

export async function updateCompany(id: string, input: CompanyInput, previousName?: string): Promise<Company> {
  const user = requireCurrentUser()
  validateCompanyInput(input)

  const existing = await loadCompany(id)
  const now = new Date().toISOString()
  const payload = buildCompanyPayload(input, {
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

  if (previousName && previousName !== input.name.trim()) {
    await propagateCompanyLabel(id, input.name.trim())
  }

  return loadCompany(id)
}

export async function deleteCompany(id: string): Promise<void> {
  requireCurrentUser()

  const existing = await getDoc(doc(getFirebaseDb(), COLLECTION, id))
  if (existing.exists()) {
    const logoPath = getNullableString(existing.data().logoPath)
    if (logoPath) {
      const { deleteCompanyLogoAtPath } = await import('@/lib/companyLogo')
      await deleteCompanyLogoAtPath(logoPath)
    }
  }

  const relatedCollections = ['contacts', 'opportunities', 'rfps'] as const
  for (const collectionName of relatedCollections) {
    const snapshot = await getDocs(
      query(
        collection(getFirebaseDb(), collectionName),
        where('company.id', '==', id),
      ),
    )
    await Promise.all(snapshot.docs.map((document) => deleteDoc(document.ref)))
  }

  for (const collectionName of ['tasks', 'notes'] as const) {
    const snapshot = await getDocs(
      query(
        collection(getFirebaseDb(), collectionName),
        where('linkedObject.id', '==', id),
      ),
    )
    await Promise.all(snapshot.docs.map((document) => deleteDoc(document.ref)))
  }

  const { deleteCompanyOfferingsForCompany } = await import('@/lib/companyOfferingRecords')
  const { deleteCompanyProductsInUseForCompany } = await import('@/lib/companyProductInUseRecords')
  await deleteCompanyOfferingsForCompany(id)
  await deleteCompanyProductsInUseForCompany(id)

  await deleteDoc(doc(getFirebaseDb(), COLLECTION, id))
}

export function compareCompanies(a: CompanySummary, b: CompanySummary, sort: CompanySortOption): number {
  switch (sort) {
    case 'name-desc':
      return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' })
    case 'health-desc':
      return b.healthScore - a.healthScore
    default:
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  }
}

export function companyMatchesQuery(company: CompanySummary, queryText: string): boolean {
  const term = queryText.trim().toLowerCase()
  if (!term) return true

  return [
    company.name,
    company.companyNo,
    company.city,
    company.country?.label,
    company.industry?.label,
    company.companyType?.label,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(term))
}

function buildCompanyPayload(
  input: CompanyInput,
  audit: {
    createdAt: string | null
    createdBy: string | null
    updatedAt: string
    updatedBy: string
  },
) {
  const name = input.name.trim()

  return {
    accountManager: input.accountManager,
    city: nullableString(input.city),
    country: input.country,
    companyType: input.companyType,
    companyNo: nullableString(input.companyNo),
    createdAt: audit.createdAt,
    createdBy: audit.createdBy,
    customerLevel: input.customerLevel,
    customerSince: nullableString(input.customerSince),
    description: input.description ?? '',
    duns: nullableString(input.duns),
    fullAddress: composeFullAddress([
      input.streetLine1,
      input.streetLine2,
      input.zipcode,
      input.city,
      input.state,
      input.country?.label,
    ]),
    healthScore: clampHealthScore(input.healthScore),
    implPartner: input.implPartner,
    industry: input.industry,
    logoUrl: nullableString(input.logoUrl),
    logoPath: nullableString(input.logoPath),
    isFocusPartner: Boolean(input.isFocusPartner),
    isReference: Boolean(input.isReference),
    name,
    nda: Boolean(input.nda),
    numOfContacts: input.numOfContacts ?? 0,
    numOfDeals: input.numOfDeals ?? 0,
    numOfNotes: input.numOfNotes ?? 0,
    numOfUncompletedTasks: input.numOfUncompletedTasks ?? 0,
    numOfOpportunities: input.numOfOpportunities ?? 0,
    numOfProducts: input.numOfProducts ?? 0,
    numOfProductsInUse: input.numOfProductsInUse ?? 0,
    numOfRfps: input.numOfRfps ?? 0,
    objectType: 'Company' as const,
    objectLabel: name,
    hosting: input.hosting,
    onCloud: input.hosting === 'cloud',
    phone: nullableString(input.phone),
    sfRef: nullableString(input.sfRef),
    state: nullableString(input.state),
    streetLine1: nullableString(input.streetLine1),
    streetLine2: nullableString(input.streetLine2),
    updatedAt: audit.updatedAt,
    updatedBy: audit.updatedBy,
    website: nullableString(input.website),
    zipcode: nullableString(input.zipcode),
  }
}

async function propagateCompanyLabel(companyId: string, name: string): Promise<void> {
  const db = getFirebaseDb()

  const contacts = await getDocs(
    query(collection(db, 'contacts'), where('company.id', '==', companyId)),
  )
  await Promise.all(
    contacts.docs.map((document) =>
      updateDoc(document.ref, { company: { id: companyId, objectLabel: name } }),
    ),
  )

  const opportunities = await getDocs(
    query(collection(db, 'opportunities'), where('company.id', '==', companyId)),
  )
  await Promise.all(
    opportunities.docs.map((document) =>
      updateDoc(document.ref, { company: { id: companyId, objectLabel: name } }),
    ),
  )

  const rfps = await getDocs(
    query(collection(db, 'rfps'), where('company.id', '==', companyId)),
  )
  await Promise.all(
    rfps.docs.map((document) =>
      updateDoc(document.ref, { company: { id: companyId, objectLabel: name } }),
    ),
  )

  const linkedObject = {
    collection: 'companies',
    id: companyId,
    objectLabel: name,
    type: 'Company',
  }

  const tasks = await getDocs(
    query(collection(db, 'tasks'), where('linkedObject.id', '==', companyId)),
  )
  await Promise.all(tasks.docs.map((document) => updateDoc(document.ref, { linkedObject })))

  const notes = await getDocs(
    query(collection(db, 'notes'), where('linkedObject.id', '==', companyId)),
  )
  await Promise.all(notes.docs.map((document) => updateDoc(document.ref, { linkedObject })))

  const { updateCompanyOfferingCompanyLabel } = await import('@/lib/companyOfferingRecords')
  const { updateCompanyProductInUseCompanyLabels } = await import('@/lib/companyProductInUseRecords')
  await updateCompanyOfferingCompanyLabel(companyId, name)
  await updateCompanyProductInUseCompanyLabels(companyId, name)
}

function mapCompanySummary(document: QueryDocumentSnapshot<DocumentData>): CompanySummary {
  return mapCompany(document.id, document.data())
}

function mapCompany(id: string, data: DocumentData): Company {
  return {
    id,
    objectID: getString(data.objectID) ?? id,
    objectType: 'Company',
    objectLabel: getString(data.objectLabel) ?? getString(data.name) ?? '',
    name: getString(data.name) ?? '',
    companyNo: getNullableString(data.companyNo),
    duns: getNullableString(data.duns),
    streetLine1: getNullableString(data.streetLine1),
    streetLine2: getNullableString(data.streetLine2),
    zipcode: getNullableString(data.zipcode),
    city: getNullableString(data.city),
    state: getNullableString(data.state),
    country: mapLabeledValue(data.country),
    fullAddress: getNullableString(data.fullAddress),
    phone: getNullableString(data.phone),
    website: getNullableString(data.website),
    industry: mapLabeledValue(data.industry),
    companyType: mapLabeledValue(data.companyType),
    customerLevel: mapLabeledValue(data.customerLevel),
    customerSince: getNullableString(data.customerSince),
    healthScore: clampHealthScore(data.healthScore),
    accountManager: mapObjectRef(data.accountManager),
    implPartner: mapObjectRef(data.implPartner),
    sfRef: getNullableString(data.sfRef),
    logoUrl: getNullableString(data.logoUrl),
    logoPath: getNullableString(data.logoPath),
    description: getRichTextValue(data.description),
    isFocusPartner: Boolean(data.isFocusPartner),
    nda: Boolean(data.nda),
    hosting: mapHosting(data),
    isReference: Boolean(data.isReference),
    numOfContacts: getNumber(data.numOfContacts),
    numOfOpportunities: getNumber(data.numOfOpportunities),
    numOfProducts: getNumber(data.numOfProducts),
    numOfProductsInUse: getNumber(data.numOfProductsInUse),
    numOfNotes: getNumber(data.numOfNotes),
    numOfUncompletedTasks: getNumber(data.numOfUncompletedTasks),
    numOfRfps: getNumber(data.numOfRfps),
    numOfDeals: getNumber(data.numOfDeals),
    createdAt: getNullableString(data.createdAt),
    createdBy: getNullableString(data.createdBy),
    updatedAt: getNullableString(data.updatedAt),
    updatedBy: getNullableString(data.updatedBy),
  }
}

function mapHosting(data: Record<string, unknown>): CompanyHosting | null {
  const hosting = getString(data.hosting)
  if (hosting === 'cloud' || hosting === 'self-managed') {
    return hosting
  }
  if (data.onCloud === true) {
    return 'cloud'
  }
  return null
}

function mapLabeledValue(value: unknown): LabeledValue | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const label = getString(record.label)
  const itemValue = getString(record.value)
  if (!label || !itemValue) return null
  return { label, value: itemValue }
}

function mapObjectRef(value: unknown): ObjectRef | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const id = getString(record.id)
  const objectLabel = getString(record.objectLabel)
  if (!id || !objectLabel) return null
  return { id, objectLabel }
}

function composeFullAddress(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => (part ? String(part).trim() : ''))
    .filter(Boolean)
    .join(', ')
}

function clampHealthScore(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.min(Math.max(Math.round(numeric), 0), 5)
}

export function validateCompanyInput(input: CompanyInput): void {
  if (!input.name.trim()) {
    throw new Error('Company name is required.')
  }
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
