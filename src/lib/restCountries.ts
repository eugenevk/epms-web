import type { LabeledValue } from '@/lib/companies'

export type CountryOption = LabeledValue & {
  flagEmoji: string | null
}

const API_BASE = 'https://api.restcountries.com/countries/v5'
const RESPONSE_FIELDS = 'names.common,codes.alpha_2,flag.emoji'
const CACHE_KEY = 'epms-restcountries-v1'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

type RestCountriesListResponse = {
  data?: {
    objects?: Record<string, unknown>[]
    meta?: {
      more?: boolean
    }
  }
  errors?: Array<{ message?: string }>
}

type CachedCountries = {
  fetchedAt: number
  countries: CountryOption[]
}

let memoryCache: CountryOption[] | null = null
let loadPromise: Promise<CountryOption[]> | null = null

export function isRestCountriesConfigured(): boolean {
  return Boolean(import.meta.env.VITE_RESTCOUNTRIES_API_KEY?.trim())
}

function getApiKey(): string {
  const apiKey = import.meta.env.VITE_RESTCOUNTRIES_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      'Missing VITE_RESTCOUNTRIES_API_KEY. Add your REST Countries API key to .env.',
    )
  }
  return apiKey
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseCountryObject(raw: Record<string, unknown>): CountryOption | null {
  const label =
    readString(raw['names.common']) ??
    readString((raw.names as { common?: unknown } | undefined)?.common)

  const value =
    readString(raw['codes.alpha_2']) ??
    readString((raw.codes as { alpha_2?: unknown } | undefined)?.alpha_2)

  const flagEmoji =
    readString(raw['flag.emoji']) ??
    readString((raw.flag as { emoji?: unknown } | undefined)?.emoji)

  if (!label || !value) return null

  return {
    label,
    value: value.toUpperCase(),
    flagEmoji,
  }
}

function readCachedCountries(): CountryOption[] | null {
  if (typeof sessionStorage === 'undefined') return null

  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as CachedCountries
    if (!Array.isArray(parsed.countries) || typeof parsed.fetchedAt !== 'number') {
      return null
    }

    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_KEY)
      return null
    }

    return parsed.countries
  } catch {
    sessionStorage.removeItem(CACHE_KEY)
    return null
  }
}

function writeCachedCountries(countries: CountryOption[]) {
  if (typeof sessionStorage === 'undefined') return

  const payload: CachedCountries = {
    fetchedAt: Date.now(),
    countries,
  }
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload))
}

async function fetchCountriesPage(
  offset: number,
  limit: number,
): Promise<{ countries: CountryOption[]; hasMore: boolean }> {
  const url = new URL(API_BASE)
  url.searchParams.set('response_fields', RESPONSE_FIELDS)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('offset', String(offset))

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
    },
  })

  const payload = (await response.json()) as RestCountriesListResponse

  if (!response.ok) {
    const message =
      payload.errors?.map((error) => error.message).filter(Boolean).join(' ') ||
      `REST Countries request failed (${response.status}).`
    throw new Error(message)
  }

  const objects = payload.data?.objects ?? []
  const countries = objects
    .map((object) => parseCountryObject(object))
    .filter((country): country is CountryOption => country !== null)

  return {
    countries,
    hasMore: payload.data?.meta?.more === true,
  }
}

async function fetchAllCountriesFromApi(): Promise<CountryOption[]> {
  const limit = 100
  let offset = 0
  const countries: CountryOption[] = []

  while (true) {
    const page = await fetchCountriesPage(offset, limit)
    countries.push(...page.countries)

    if (!page.hasMore) break
    offset += limit
  }

  return countries.sort((left, right) => left.label.localeCompare(right.label, 'en'))
}

export async function loadCountryOptions(): Promise<CountryOption[]> {
  if (memoryCache) return memoryCache
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const cached = readCachedCountries()
    if (cached) {
      memoryCache = cached
      return cached
    }

    const countries = await fetchAllCountriesFromApi()
    memoryCache = countries
    writeCachedCountries(countries)
    return countries
  })()

  try {
    return await loadPromise
  } finally {
    loadPromise = null
  }
}

export function flagEmojiForCountryCode(code: string | null | undefined): string {
  if (!code || code.length !== 2) return ''
  const upper = code.toUpperCase()
  if (!/^[A-Z]{2}$/.test(upper)) return ''

  return String.fromCodePoint(
    ...upper.split('').map((char) => 0x1f1e6 - 65 + char.charCodeAt(0)),
  )
}

export function countryFlagEmoji(country: LabeledValue | CountryOption | null | undefined): string {
  if (!country) return ''
  if ('flagEmoji' in country && country.flagEmoji) return country.flagEmoji
  return flagEmojiForCountryCode(country.value)
}
