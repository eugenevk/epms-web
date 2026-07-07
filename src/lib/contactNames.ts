const NAME_PARTICLES = new Set([
  'van',
  'von',
  'den',
  'der',
  'de',
  'het',
  'ten',
  'ter',
  'te',
  'und',
  'la',
  'le',
  'du',
])

export type ContactNameFields = {
  firstName?: string | null
  lastName?: string | null
  fullName?: string | null
  objectLabel?: string | null
}

export type ResolvedContactName = {
  firstName: string | null
  lastName: string
  fullName: string
  objectLabel: string
}

export function cleanNamePart(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  return value.trim().replace(/,/g, '').replace(/\s+/g, ' ').trim() || null
}

function isParticle(word: string): boolean {
  return NAME_PARTICLES.has(word.toLowerCase())
}

function splitLastNameParticles(lastName: string): {
  particles: string | null
  surname: string
} {
  const parts = lastName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return { particles: null, surname: '' }
  }
  if (parts.length === 1) {
    return { particles: null, surname: parts[0] }
  }

  let surnameStartIndex = 0
  while (surnameStartIndex < parts.length - 1 && isParticle(parts[surnameStartIndex])) {
    surnameStartIndex++
  }

  if (surnameStartIndex >= parts.length) {
    return {
      particles: parts.slice(0, -1).join(' ') || null,
      surname: parts[parts.length - 1],
    }
  }

  const particles =
    surnameStartIndex > 0 ? parts.slice(0, surnameStartIndex).join(' ') : null
  const surname = parts.slice(surnameStartIndex).join(' ')

  return { particles, surname }
}

function startsWithParticle(value: string): boolean {
  const first = value.split(/\s+/)[0]?.toLowerCase()
  return Boolean(first && NAME_PARTICLES.has(first))
}

function wordCount(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0
}

export function parseCommaSeparatedFullName(fullName: string): {
  firstName: string | null
  lastName: string
} {
  const parts = fullName
    .split(',')
    .map((part) => cleanNamePart(part))
    .filter((part): part is string => Boolean(part))

  if (parts.length === 0) {
    return { firstName: null, lastName: '' }
  }

  if (parts.length === 1) {
    return { firstName: null, lastName: parts[0] }
  }

  const [firstPart, ...rest] = parts
  const secondPart = rest.join(' ').trim()

  // Legacy "Daan, den Ouden" — first name, then last name with particle(s)
  if (startsWithParticle(secondPart)) {
    return { firstName: firstPart, lastName: secondPart }
  }

  // "den Ouden, Daan" — last name with particle(s), then first name
  if (startsWithParticle(firstPart) || (wordCount(firstPart) > 1 && wordCount(secondPart) === 1)) {
    return { firstName: secondPart, lastName: firstPart }
  }

  return parseDisplayFormatCommaName(firstPart, secondPart)
}

function parseDisplayFormatCommaName(
  surnamePart: string,
  firstAndParticlesPart: string,
): {
  firstName: string | null
  lastName: string
} {
  const words = firstAndParticlesPart.split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return { firstName: null, lastName: surnamePart }
  }

  const firstName = words[0]
  const trailingParticles = words.slice(1).join(' ')

  if (trailingParticles) {
    return {
      firstName,
      lastName: `${trailingParticles} ${surnamePart}`.trim(),
    }
  }

  return { firstName, lastName: surnamePart }
}

export function parseSpaceSeparatedFullName(fullName: string): {
  firstName: string | null
  lastName: string
} {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .map((part) => cleanNamePart(part))
    .filter((part): part is string => Boolean(part))

  if (parts.length === 0) {
    return { firstName: null, lastName: '' }
  }

  if (parts.length === 1) {
    return { firstName: null, lastName: parts[0] }
  }

  const [firstPart, ...rest] = parts
  return {
    firstName: firstPart,
    lastName: rest.join(' '),
  }
}

export function formatContactFullName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const first = cleanNamePart(firstName)
  const last = cleanNamePart(lastName)

  if (!last && !first) return ''
  if (!first) {
    const { particles, surname } = splitLastNameParticles(last ?? '')
    if (particles && surname) return `${particles} ${surname}`.trim()
    return last ?? ''
  }
  if (!last) return first

  const { particles, surname } = splitLastNameParticles(last)
  const firstWithParticles = particles ? `${first} ${particles}` : first

  return `${surname}, ${firstWithParticles}`
}

export function resolveContactName(fields: ContactNameFields): ResolvedContactName {
  let firstName = cleanNamePart(fields.firstName)
  let lastName = cleanNamePart(fields.lastName) ?? ''

  const legacySource = [fields.fullName, fields.objectLabel]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find((value) => value.includes(','))

  if (legacySource) {
    const parsed = parseCommaSeparatedFullName(legacySource)
    firstName = firstName ?? parsed.firstName
    if (!lastName) {
      lastName = parsed.lastName
    }
  }

  if (!lastName) {
    const fallback = cleanNamePart(fields.fullName) ?? cleanNamePart(fields.objectLabel) ?? ''
    if (fallback) {
      const parsed = fallback.includes(',')
        ? parseCommaSeparatedFullName(fallback)
        : parseSpaceSeparatedFullName(fallback)
      firstName = firstName ?? parsed.firstName
      lastName = parsed.lastName
    }
  }

  const fullName = formatContactFullName(firstName, lastName)

  return {
    firstName,
    lastName,
    fullName,
    objectLabel: fullName,
  }
}

export function contactDisplayName(fields: ContactNameFields): string {
  const resolved = resolveContactName(fields)
  return resolved.fullName || '—'
}
