export const NUMBER_FORMAT_LOCALE = 'nl-NL'

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return Math.round(value).toLocaleString(NUMBER_FORMAT_LOCALE)
}

export function formatNumber(
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return value.toLocaleString(NUMBER_FORMAT_LOCALE, options)
}

export function parseLocaleInteger(value: string): number {
  const digits = value.replace(/[^\d]/g, '')
  if (!digits) return 0
  const parsed = Number(digits)
  return Number.isFinite(parsed) ? parsed : 0
}
