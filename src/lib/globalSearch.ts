import type { RouteLocationRaw } from 'vue-router'
import { contactDisplayName } from '@/lib/contactNames'
import { fetchCompanyLogosByIds } from '@/lib/companiesList'
import { highlightQueryInText, sanitizeAlgoliaHighlight } from '@/lib/algoliaHighlight'
import { getAlgoliaClient, isAlgoliaConfigured } from '@/lib/algoliaClient'
import { formatOpportunityAcv } from '@/lib/opportunities'
import { stripHtml } from '@/lib/plainTextSearch'
import { normalizeExternalUrl } from '@/lib/externalUrl'

export const GLOBAL_SEARCH_INDICES = [
  {
    id: 'companies',
    label: 'Companies',
    tagLabel: 'Company',
    titleAttributes: ['name', 'objectLabel'],
    snippetAttributes: [
      'name',
      'objectLabel',
      'description',
      'website',
      'city',
      'fullAddress',
      'companyNo',
      'country.label',
      'industry.label',
      'companyType.label',
      'accountManager.objectLabel',
      'implPartner.objectLabel',
    ],
  },
  {
    id: 'contacts',
    label: 'Contacts',
    tagLabel: 'Contact',
    titleAttributes: ['fullName', 'objectLabel'],
    snippetAttributes: [
      'fullName',
      'firstName',
      'lastName',
      'objectLabel',
      'company.objectLabel',
      'position',
      'department',
      'email',
      'phone',
      'mobile',
      'firstMet',
      'notes',
    ],
  },
  {
    id: 'notes',
    label: 'Notes',
    tagLabel: 'Note',
    titleAttributes: ['linkedObject.objectLabel', 'noteDt'],
    snippetAttributes: ['note', 'objectLabel', 'noteDt', 'linkedObject.objectLabel'],
  },
  {
    id: 'opportunities',
    label: 'Opportunities',
    tagLabel: 'Opportunity',
    titleAttributes: ['title', 'objectLabel'],
    snippetAttributes: [
      'title',
      'objectLabel',
      'opportunityNo',
      'description',
      'company.objectLabel',
      'status.label',
      'stage.label',
      'targetDt',
      'closingDt',
    ],
  },
  {
    id: 'rfps',
    label: "RFP's",
    tagLabel: 'RFP',
    titleAttributes: ['title', 'objectLabel'],
    snippetAttributes: ['title', 'objectLabel', 'description', 'company.objectLabel'],
  },
  {
    id: 'products',
    label: 'Products & services (offered)',
    tagLabel: 'Offering',
    titleAttributes: ['name', 'objectLabel'],
    snippetAttributes: [
      'name',
      'objectLabel',
      'description',
      'company.objectLabel',
      'objectType',
      'kind',
    ],
  },
  {
    id: 'productsInUse',
    label: 'Products & services (in use)',
    tagLabel: 'In use',
    titleAttributes: ['name', 'objectLabel'],
    snippetAttributes: [
      'name',
      'objectLabel',
      'description',
      'version',
      'company.objectLabel',
      'supplierCompany.objectLabel',
      'kind',
    ],
  },
  {
    id: 'tasks',
    label: 'Tasks',
    tagLabel: 'Task',
    titleAttributes: ['description', 'objectLabel'],
    snippetAttributes: [
      'description',
      'objectLabel',
      'linkedObject.objectLabel',
      'linkedObject.label',
      'priority.label',
    ],
  },
  {
    id: 'milestones',
    label: 'Milestones',
    tagLabel: 'Milestone',
    titleAttributes: ['title', 'objectLabel'],
    snippetAttributes: ['title', 'objectLabel', 'description', 'company.objectLabel'],
  },
  {
    id: 'rfpQuestions',
    label: 'RFP questions',
    tagLabel: 'RFP question',
    titleAttributes: ['question', 'objectLabel'],
    snippetAttributes: ['question', 'answer', 'description', 'objectLabel'],
  },
  {
    id: 'rfpQuestionsSearch',
    label: 'RFP question search',
    tagLabel: 'RFP question search',
    titleAttributes: ['question', 'objectLabel'],
    snippetAttributes: ['question', 'answer', 'description', 'objectLabel'],
  },
] as const

export type GlobalSearchIndexId = (typeof GLOBAL_SEARCH_INDICES)[number]['id']

export type GlobalSearchDetailLine = {
  label?: string
  value: string
  segments?: string[]
  href?: string
}

export type GlobalSearchMatchHint = {
  label: string
  html: string
}

export type GlobalSearchHit = {
  objectID: string
  indexId: GlobalSearchIndexId
  indexLabel: string
  title: string
  titleHtml: string | null
  subtitle: string | null
  companyId: string | null
  companyLabel: string | null
  companyLogoUrl: string | null
  details: GlobalSearchDetailLine[]
  matchHints: GlobalSearchMatchHint[]
  bodyHtml: string | null
  route: RouteLocationRaw | null
}

export type GlobalSearchGroup = {
  indexId: GlobalSearchIndexId
  label: string
  nbHits: number
  hits: GlobalSearchHit[]
}

type AlgoliaSearchHit = Record<string, unknown> & {
  objectID?: string
  _snippetResult?: Record<string, { value?: string }>
  _highlightResult?: Record<string, { value?: string; matchLevel?: 'none' | 'partial' | 'full' }>
}

type AlgoliaHighlightField = {
  value?: string
  matchLevel?: 'none' | 'partial' | 'full'
}

const GLOBAL_SEARCH_ATTRIBUTE_LABELS: Record<string, string> = {
  name: 'Name',
  objectLabel: 'Label',
  description: 'Description',
  website: 'Website',
  city: 'City',
  fullAddress: 'Address',
  companyNo: 'Company no.',
  country: 'Country',
  'country.label': 'Country',
  industry: 'Industry',
  'industry.label': 'Industry',
  companyType: 'Type',
  'companyType.label': 'Type',
  accountManager: 'Account manager',
  'accountManager.objectLabel': 'Account manager',
  implPartner: 'Implementation partner',
  'implPartner.objectLabel': 'Implementation partner',
  fullName: 'Name',
  firstName: 'First name',
  lastName: 'Last name',
  company: 'Company',
  'company.objectLabel': 'Company',
  'company.label': 'Company',
  position: 'Position',
  department: 'Department',
  email: 'Email',
  phone: 'Phone',
  mobile: 'Mobile',
  firstMet: 'First met',
  notes: 'Notes',
  note: 'Note',
  noteDt: 'Note date',
  title: 'Title',
  opportunityNo: 'Opportunity no.',
  question: 'Question',
  answer: 'Answer',
  status: 'Status',
  'status.label': 'Status',
  stage: 'Stage',
  'stage.label': 'Stage',
  targetDt: 'Target date',
  closingDt: 'Closing date',
  linkedObject: 'Linked to',
  'linkedObject.objectLabel': 'Linked to',
  'linkedObject.label': 'Linked to',
  priority: 'Priority',
  'priority.label': 'Priority',
  version: 'Version',
  supplierCompany: 'Supplier',
  'supplierCompany.objectLabel': 'Supplier',
  kind: 'Type',
  objectType: 'Type',
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function getNumber(value: unknown): number | undefined {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : undefined
}

function getNestedString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  return getString((value as Record<string, unknown>)[key])
}

function getLabeledValueLabel(value: unknown): string | undefined {
  return getNestedString(value, 'label')
}

function getHitId(hit: AlgoliaSearchHit): string | null {
  return getString(hit.objectID) ?? getString(hit.id) ?? null
}

function getCompanyId(hit: AlgoliaSearchHit): string | null {
  const company = hit.company
  if (company && typeof company === 'object') {
    const id = getString((company as Record<string, unknown>).id)
    if (id) return id
  }

  const linkedObject = hit.linkedObject
  if (linkedObject && typeof linkedObject === 'object') {
    const record = linkedObject as Record<string, unknown>
    if (getString(record.collection) === 'companies') {
      return getString(record.id) ?? null
    }
  }

  return null
}

function getLinkedObjectRoute(hit: AlgoliaSearchHit): RouteLocationRaw | null {
  const linkedObject = hit.linkedObject
  if (!linkedObject || typeof linkedObject !== 'object') return null

  const record = linkedObject as Record<string, unknown>
  const id = getString(record.id)
  const collection = getString(record.collection)

  if (!id) return null

  if (collection === 'companies') {
    return { name: 'company-details', params: { id } }
  }

  if (collection === 'contacts') {
    return { name: 'contact-details', params: { id } }
  }

  return null
}

export function resolveGlobalSearchRoute(
  indexId: GlobalSearchIndexId,
  hit: AlgoliaSearchHit,
): RouteLocationRaw | null {
  const id = getHitId(hit)
  if (!id) return null

  switch (indexId) {
    case 'companies':
      return { name: 'company-details', params: { id } }
    case 'contacts':
      return { name: 'contact-details', params: { id } }
    case 'opportunities':
      return { name: 'opportunity-details', params: { id } }
    case 'rfps':
      return { name: 'rfp-details', params: { id } }
    case 'products':
    case 'productsInUse': {
      const companyId = getCompanyId(hit)
      if (companyId) {
        return {
          name: 'company-details',
          params: { id: companyId },
          query: { tab: 'products-services' },
        }
      }
      return { name: 'products-services' }
    }
    case 'notes':
      return getLinkedObjectRoute(hit)
    default: {
      const companyId = getCompanyId(hit)
      if (companyId) {
        return { name: 'company-details', params: { id: companyId } }
      }
      return getLinkedObjectRoute(hit)
    }
  }
}

function containsHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value)
}

function resolveGlobalSearchTitle(indexId: GlobalSearchIndexId, hit: AlgoliaSearchHit): string {
  if (indexId === 'contacts') {
    return contactDisplayName({
      firstName: getString(hit.firstName),
      lastName: getString(hit.lastName),
      fullName: getString(hit.fullName),
      objectLabel: getString(hit.objectLabel),
    })
  }

  if (indexId === 'notes') {
    return (
      getNestedString(hit.linkedObject, 'objectLabel') ??
      getString(hit.noteDt) ??
      'Note'
    )
  }

  const objectLabel = getString(hit.objectLabel)
  const candidates = [
    objectLabel && !containsHtml(objectLabel) ? objectLabel : undefined,
    getString(hit.name),
    getString(hit.fullName),
    getString(hit.title),
    getString(hit.question),
    getString(hit.subject),
    getString(hit.noteDt),
  ]

  return candidates.find(Boolean) ?? 'Untitled'
}

function resolveGlobalSearchSubtitle(indexId: GlobalSearchIndexId, hit: AlgoliaSearchHit): string | null {
  if (indexId === 'contacts') {
    return (
      getNestedString(hit.company, 'objectLabel') ??
      getNestedString(hit.company, 'label') ??
      null
    )
  }

  if (indexId === 'companies') {
    return null
  }

  if (indexId === 'notes') {
    return getString(hit.noteDt) ?? null
  }

  if (indexId === 'productsInUse') {
    const supplier =
      getNestedString(hit.supplierCompany, 'objectLabel') ??
      getNestedString(hit.supplierCompany, 'label')
    const version = getString(hit.version)
    if (supplier && version) return `${supplier} · v${version}`
    if (supplier) return supplier
  }

  const companyLabel =
    getNestedString(hit.company, 'objectLabel') ?? getNestedString(hit.company, 'label')

  if (companyLabel) return companyLabel

  return (
    getNestedString(hit.linkedObject, 'objectLabel') ??
    getNestedString(hit.linkedObject, 'label') ??
    null
  )
}

function resolveGlobalSearchContactDetails(hit: AlgoliaSearchHit): GlobalSearchDetailLine[] {
  const details: GlobalSearchDetailLine[] = []

  const position = getString(hit.position)
  if (position) {
    details.push({ value: position })
  }

  const email = getString(hit.email)
  if (email) {
    details.push({ value: email, href: `mailto:${email}` })
  }

  const phone = getString(hit.phone) ?? getString(hit.mobile)
  if (phone) {
    details.push({ value: phone })
  }

  const firstMet = getString(hit.firstMet)
  if (firstMet) {
    details.push({ label: 'First met', value: firstMet })
  }

  return details
}

function isSameLocationPart(left: string, right: string): boolean {
  return left.localeCompare(right, 'en', { sensitivity: 'base' }) === 0
}

function uniqueAddressParts(parts: string[]): string[] {
  const result: string[] = []

  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    if (result.some((existing) => isSameLocationPart(existing, trimmed))) continue
    result.push(trimmed)
  }

  return result
}

function resolveCompanyAddressSegments(hit: AlgoliaSearchHit): string[] {
  const fromFields = uniqueAddressParts([
    getString(hit.streetLine1),
    getString(hit.streetLine2),
    getString(hit.zipcode),
    getString(hit.city),
    getString(hit.state),
    getLabeledValueLabel(hit.country),
  ].filter((part): part is string => Boolean(part)))

  if (fromFields.length > 0) {
    return fromFields
  }

  const fullAddress = getString(hit.fullAddress)
  if (!fullAddress) {
    return []
  }

  return uniqueAddressParts(fullAddress.split(',').map((part) => part.trim()))
}

function resolveGlobalSearchCompanyDetails(hit: AlgoliaSearchHit): GlobalSearchDetailLine[] {
  const details: GlobalSearchDetailLine[] = []

  const companyType = getLabeledValueLabel(hit.companyType)
  if (companyType) {
    details.push({ value: companyType })
  }

  const addressSegments = resolveCompanyAddressSegments(hit)
  if (addressSegments.length > 0) {
    details.push({
      value: addressSegments.join(' · '),
      segments: addressSegments,
    })
  }

  const website = getString(hit.website)
  const websiteHref = normalizeExternalUrl(website)
  if (website && websiteHref) {
    details.push({
      value: website.replace(/^https?:\/\//i, '').replace(/\/$/, ''),
      href: websiteHref,
    })
  }

  return details
}

function resolveGlobalSearchOpportunityDetails(hit: AlgoliaSearchHit): GlobalSearchDetailLine[] {
  const details: GlobalSearchDetailLine[] = []

  const stage = getLabeledValueLabel(hit.stage)
  const status = getLabeledValueLabel(hit.status)
  const stageStatusSegments = [stage, status].filter((part): part is string => Boolean(part))
  if (stageStatusSegments.length > 0) {
    details.push({
      value: stageStatusSegments.join(' · '),
      segments: stageStatusSegments,
    })
  }

  const acv = formatOpportunityAcv({
    acv: getNumber(hit.acv),
    amount: getNumber(hit.amount),
    currency:
      hit.currency && typeof hit.currency === 'object'
        ? {
            label: getNestedString(hit.currency, 'label'),
            value: getNestedString(hit.currency, 'value'),
          }
        : undefined,
  })
  if (acv !== '—') {
    details.push({ label: 'ACV', value: acv })
  }

  const targetDt = getString(hit.targetDt)
  if (targetDt) {
    details.push({ label: 'Target', value: targetDt })
  }

  const closingDt = getString(hit.closingDt)
  if (closingDt && closingDt !== targetDt) {
    details.push({ label: 'Closing', value: closingDt })
  }

  const likelihood = getNumber(hit.likelihood)
  if (likelihood !== undefined) {
    details.push({ label: 'Likelihood', value: `${likelihood}%` })
  }

  const opportunityNo = getString(hit.opportunityNo)
  if (opportunityNo) {
    details.push({ label: 'No.', value: opportunityNo })
  }

  if (typeof hit.isActive === 'boolean') {
    details.push({ label: 'Active', value: hit.isActive ? 'Yes' : 'No' })
  }

  return details
}

function resolveGlobalSearchDetails(
  indexId: GlobalSearchIndexId,
  hit: AlgoliaSearchHit,
): GlobalSearchDetailLine[] {
  if (indexId === 'contacts') {
    return resolveGlobalSearchContactDetails(hit)
  }

  if (indexId === 'companies') {
    return resolveGlobalSearchCompanyDetails(hit)
  }

  if (indexId === 'opportunities') {
    return resolveGlobalSearchOpportunityDetails(hit)
  }

  return []
}

function normalizeComparableText(value: string): string {
  return stripHtml(value).replace(/\s+/g, ' ').trim().toLowerCase()
}

function hasAlgoliaMatch(field: AlgoliaHighlightField | undefined): boolean {
  if (!field?.value?.trim()) return false
  if (field.matchLevel === 'full' || field.matchLevel === 'partial') return true
  return /<em>/i.test(field.value)
}

function formatGlobalSearchAttributeLabel(attribute: string): string {
  if (GLOBAL_SEARCH_ATTRIBUTE_LABELS[attribute]) {
    return GLOBAL_SEARCH_ATTRIBUTE_LABELS[attribute]
  }

  const leaf = attribute.split('.').pop() ?? attribute
  if (GLOBAL_SEARCH_ATTRIBUTE_LABELS[leaf]) {
    return GLOBAL_SEARCH_ATTRIBUTE_LABELS[leaf]
  }

  return leaf
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function resolveAlgoliaMatchHtml(hit: AlgoliaSearchHit, attribute: string): string | null {
  const snippet = hit._snippetResult?.[attribute]?.value?.trim()
  if (snippet && /<em>/i.test(snippet)) {
    return sanitizeAlgoliaHighlight(snippet)
  }

  const highlight = hit._highlightResult?.[attribute]
  if (hasAlgoliaMatch(highlight)) {
    return sanitizeAlgoliaHighlight(highlight!.value!)
  }

  return null
}

function getIndexConfig(indexId: GlobalSearchIndexId) {
  return GLOBAL_SEARCH_INDICES.find((index) => index.id === indexId)
}

function collectMatchedAttributes(hit: AlgoliaSearchHit, priority: readonly string[]): string[] {
  const matched = new Set<string>()

  for (const [attribute, field] of Object.entries(hit._highlightResult ?? {})) {
    if (hasAlgoliaMatch(field as AlgoliaHighlightField)) {
      matched.add(attribute)
    }
  }

  for (const [attribute, field] of Object.entries(hit._snippetResult ?? {})) {
    const value = field?.value?.trim()
    if (value && /<em>/i.test(value)) {
      matched.add(attribute)
    }
  }

  const ordered: string[] = []
  for (const attribute of priority) {
    if (matched.has(attribute)) {
      ordered.push(attribute)
    }
  }

  for (const attribute of matched) {
    if (!ordered.includes(attribute)) {
      ordered.push(attribute)
    }
  }

  return ordered
}

function resolveGlobalSearchTitleHtml(
  indexId: GlobalSearchIndexId,
  hit: AlgoliaSearchHit,
  title: string,
  query: string,
): string | null {
  const titleAttributes = getIndexConfig(indexId)?.titleAttributes ?? ['objectLabel', 'name', 'title']

  for (const attribute of titleAttributes) {
    const html = resolveAlgoliaMatchHtml(hit, attribute)
    if (html) return html
  }

  const normalizedQuery = normalizeComparableText(query)
  const normalizedTitle = normalizeComparableText(title)
  if (normalizedQuery && normalizedTitle.includes(normalizedQuery)) {
    return highlightQueryInText(title, query)
  }

  return null
}

function resolveGlobalSearchMatchHints(
  indexId: GlobalSearchIndexId,
  hit: AlgoliaSearchHit,
): GlobalSearchMatchHint[] {
  const indexConfig = getIndexConfig(indexId)
  if (!indexConfig) return []

  const titleAttributes = new Set<string>(indexConfig.titleAttributes)
  const matchedAttributes = collectMatchedAttributes(hit, indexConfig.snippetAttributes)
  const hints: GlobalSearchMatchHint[] = []
  const seenLabels = new Set<string>()

  for (const attribute of matchedAttributes) {
    if (titleAttributes.has(attribute)) continue

    const html = resolveAlgoliaMatchHtml(hit, attribute)
    if (!html) continue

    const label = formatGlobalSearchAttributeLabel(attribute)
    if (seenLabels.has(label)) continue

    hints.push({ label, html })
    seenLabels.add(label)

    if (hints.length >= 3) break
  }

  return hints
}

function resolveGlobalSearchBodyHtml(
  indexId: GlobalSearchIndexId,
  hit: AlgoliaSearchHit,
  query: string,
): string | null {
  if (indexId !== 'notes') return null

  const highlighted = resolveAlgoliaMatchHtml(hit, 'note') ?? resolveAlgoliaMatchHtml(hit, 'objectLabel')
  if (highlighted) return highlighted

  const note = getString(hit.note) ?? getString(hit.objectLabel)
  if (!note) return null

  const plain = containsHtml(note) ? stripHtml(note) : note
  const excerpt = plain.length > 200 ? `${plain.slice(0, 200).trim()}…` : plain

  if (query.trim()) {
    return highlightQueryInText(excerpt, query)
  }

  return highlightQueryInText(excerpt, '')
}

function resolveGlobalSearchCompanyContext(
  indexId: GlobalSearchIndexId,
  hit: AlgoliaSearchHit,
  objectID: string,
  title: string,
  subtitle: string | null,
): { companyId: string | null; companyLabel: string | null; companyLogoUrl: string | null } {
  if (indexId === 'companies') {
    return {
      companyId: objectID,
      companyLabel: title,
      companyLogoUrl: getString(hit.logoUrl) ?? null,
    }
  }

  const companyId = getCompanyId(hit)
  const companyLabel =
    getNestedString(hit.company, 'objectLabel') ??
    getNestedString(hit.company, 'label') ??
    (getNestedString(hit.linkedObject, 'collection') === 'companies'
      ? getNestedString(hit.linkedObject, 'objectLabel')
      : undefined) ??
    subtitle

  return {
    companyId,
    companyLabel,
    companyLogoUrl: null,
  }
}

function mapAlgoliaHit(
  indexId: GlobalSearchIndexId,
  hit: AlgoliaSearchHit,
  query: string,
): GlobalSearchHit | null {
  const objectID = getHitId(hit)
  if (!objectID) return null

  const title = resolveGlobalSearchTitle(indexId, hit)
  const subtitle = resolveGlobalSearchSubtitle(indexId, hit)
  const details = resolveGlobalSearchDetails(indexId, hit)
  const companyContext = resolveGlobalSearchCompanyContext(indexId, hit, objectID, title, subtitle)

  return {
    objectID,
    indexId,
    indexLabel: GLOBAL_SEARCH_INDICES.find((index) => index.id === indexId)?.tagLabel ?? indexId,
    title,
    titleHtml: resolveGlobalSearchTitleHtml(indexId, hit, title, query),
    subtitle,
    companyId: companyContext.companyId,
    companyLabel: companyContext.companyLabel,
    companyLogoUrl: companyContext.companyLogoUrl,
    details,
    matchHints: indexId === 'notes' ? [] : resolveGlobalSearchMatchHints(indexId, hit),
    bodyHtml: resolveGlobalSearchBodyHtml(indexId, hit, query),
    route: resolveGlobalSearchRoute(indexId, hit),
  }
}

type AlgoliaSearchResponse = {
  hits: AlgoliaSearchHit[]
  nbHits: number
}

function isSearchResponse(result: unknown): result is AlgoliaSearchResponse {
  if (!result || typeof result !== 'object') return false
  const record = result as AlgoliaSearchResponse
  return Array.isArray(record.hits) && typeof record.nbHits === 'number'
}

export function formatAlgoliaSearchError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }

  return 'Search could not be completed.'
}

function isIndexNotAllowedError(error: unknown): boolean {
  return formatAlgoliaSearchError(error).includes('Index not allowed')
}

function mapSearchResult(
  index: (typeof GLOBAL_SEARCH_INDICES)[number],
  result: unknown,
  query: string,
): GlobalSearchGroup | null {
  if (!isSearchResponse(result) || result.hits.length === 0) return null

  const hits = result.hits
    .map((hit) => mapAlgoliaHit(index.id, hit, query))
    .filter((hit): hit is GlobalSearchHit => Boolean(hit))

  if (hits.length === 0) return null

  return {
    indexId: index.id,
    label: index.label,
    nbHits: result.nbHits,
    hits,
  }
}

export function globalSearchTypeLabel(indexId: string): string {
  return GLOBAL_SEARCH_INDICES.find((index) => index.id === indexId)?.tagLabel ?? indexId
}

const GLOBAL_SEARCH_TYPE_BADGE_CLASSES: Record<GlobalSearchIndexId, string> = {
  companies: 'bg-epms-100 text-epms-800',
  contacts: 'bg-purple-100 text-purple-800',
  notes: 'bg-amber-100 text-amber-900',
  opportunities: 'bg-emerald-100 text-emerald-800',
  rfps: 'bg-violet-100 text-violet-800',
  products: 'bg-teal-100 text-teal-800',
  productsInUse: 'bg-cyan-100 text-cyan-900',
  tasks: 'bg-orange-100 text-orange-900',
  milestones: 'bg-indigo-100 text-indigo-800',
  rfpQuestions: 'bg-rose-100 text-rose-800',
  rfpQuestionsSearch: 'bg-fuchsia-100 text-fuchsia-800',
}

export function globalSearchTypeBadgeClass(indexId: GlobalSearchIndexId): string {
  return GLOBAL_SEARCH_TYPE_BADGE_CLASSES[indexId] ?? 'bg-stone-100 text-stone-600'
}

export function flattenGlobalSearchHits(groups: GlobalSearchGroup[]): GlobalSearchHit[] {
  return groups.flatMap((group) => group.hits)
}

export function buildGlobalSearchTypeFacets(
  groups: GlobalSearchGroup[],
): Partial<Record<GlobalSearchIndexId, number>> {
  const facets: Partial<Record<GlobalSearchIndexId, number>> = {}

  for (const group of groups) {
    facets[group.indexId] = group.nbHits
  }

  return facets
}

async function enrichSearchGroupsWithCompanyLogos(groups: GlobalSearchGroup[]): Promise<GlobalSearchGroup[]> {
  const companyIds = new Set<string>()

  for (const group of groups) {
    for (const hit of group.hits) {
      if (hit.companyId && !hit.companyLogoUrl) {
        companyIds.add(hit.companyId)
      }
    }
  }

  if (companyIds.size === 0) {
    return groups
  }

  const logosById = await fetchCompanyLogosByIds([...companyIds])

  return groups.map((group) => ({
    ...group,
    hits: group.hits.map((hit) => {
      if (!hit.companyId || hit.companyLogoUrl) {
        return hit
      }

      return {
        ...hit,
        companyLogoUrl: logosById.get(hit.companyId) ?? null,
      }
    }),
  }))
}

export async function searchAllIndices(query: string): Promise<GlobalSearchGroup[]> {
  if (!isAlgoliaConfigured()) {
    throw new Error('Algolia is not configured. Set VITE_ALGOLIA_APP_ID and VITE_ALGOLIA_SEARCH_KEY.')
  }

  const trimmedQuery = query.trim()
  if (!trimmedQuery) return []

  const client = getAlgoliaClient()
  const searchRequests = GLOBAL_SEARCH_INDICES.map((index) => ({
    indexName: index.id,
    query: trimmedQuery,
    params: {
      hitsPerPage: 8,
      attributesToSnippet: [...index.snippetAttributes],
      attributesToHighlight: [...index.snippetAttributes],
      snippetEllipsisText: '…',
    },
  }))

  try {
    const response = await client.search<AlgoliaSearchHit>(searchRequests)
    const groups = GLOBAL_SEARCH_INDICES.flatMap((index, position) => {
      const group = mapSearchResult(index, response.results[position], trimmedQuery)
      return group ? [group] : []
    })

    if (groups.length > 0) {
      return enrichSearchGroupsWithCompanyLogos(groups)
    }
  } catch (batchError) {
    if (!isIndexNotAllowedError(batchError)) {
      throw new Error(formatAlgoliaSearchError(batchError))
    }
  }

  const settled = await Promise.allSettled(
    GLOBAL_SEARCH_INDICES.map(async (index) => {
      const response = await client.search<AlgoliaSearchHit>([
        {
          indexName: index.id,
          query: trimmedQuery,
          params: {
            hitsPerPage: 8,
            attributesToSnippet: [...index.snippetAttributes],
            attributesToHighlight: [...index.snippetAttributes],
            snippetEllipsisText: '…',
          },
        },
      ])

      return mapSearchResult(index, response.results[0], trimmedQuery)
    }),
  )

  const groups: GlobalSearchGroup[] = []
  const failures: string[] = []

  for (const [position, outcome] of settled.entries()) {
    if (outcome.status === 'fulfilled') {
      if (outcome.value) groups.push(outcome.value)
      continue
    }

    const index = GLOBAL_SEARCH_INDICES[position]
    if (isIndexNotAllowedError(outcome.reason)) continue
    failures.push(`${index.label}: ${formatAlgoliaSearchError(outcome.reason)}`)
  }

  if (groups.length > 0) {
    return enrichSearchGroupsWithCompanyLogos(groups)
  }

  if (failures.length > 0) {
    throw new Error(failures[0])
  }

  return []
}
