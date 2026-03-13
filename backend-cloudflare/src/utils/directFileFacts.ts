import { canonicalReturnFormType } from './formType'
import { normalizeFilingStatus } from './filingStatus'
import type { ReturnFormType, SubmissionStatus } from '../domain/types'

export type DirectFileFacts = Record<string, unknown>

interface FactNode {
  item?: unknown
  value?: unknown
}

const asObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const getFactNode = (facts: DirectFileFacts, path: string): FactNode | null => {
  const fact = asObject(facts[path])
  if (!fact) {
    return null
  }
  return {
    item: fact.item,
    value: fact.value
  }
}

const getFactItem = (facts: DirectFileFacts, path: string): unknown =>
  getFactNode(facts, path)?.item

const extractEnumValue = (item: unknown): string | null => {
  const record = asObject(item)
  if (!record) {
    if (typeof item === 'string') {
      return item
    }
    return null
  }

  const value = record.value
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0]
  }
  if (typeof value === 'string') {
    return value
  }

  return null
}

const normalizeTin = (value: string): string => value.replace(/\D/g, '')

const extractTinFromItem = (item: unknown): string | null => {
  if (typeof item === 'string') {
    const normalized = normalizeTin(item)
    return normalized.length > 0 ? normalized : null
  }

  const record = asObject(item)
  if (!record) {
    return null
  }

  if (typeof record.area === 'string') {
    const group = typeof record.group === 'string' ? record.group : ''
    const serial =
      typeof record.serial === 'string'
        ? record.serial
        : typeof record.suffix === 'string'
        ? record.suffix
        : ''
    return normalizeTin(`${record.area}${group}${serial}`)
  }

  if (typeof record.prefix === 'string' && typeof record.suffix === 'string') {
    return normalizeTin(`${record.prefix}${record.suffix}`)
  }

  if (typeof record.id === 'string') {
    return normalizeTin(record.id)
  }

  return null
}

export const extractTaxYearFromFacts = (
  facts: DirectFileFacts
): number | null => {
  const value = getFactItem(facts, '/taxYear')
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  const wrapped = asObject(value)
  if (
    wrapped &&
    typeof wrapped.year === 'number' &&
    Number.isFinite(wrapped.year)
  ) {
    return wrapped.year
  }

  return null
}

export const extractFilingStatusFromFacts = (
  facts: DirectFileFacts
): string | null => {
  const filingStatus = extractEnumValue(getFactItem(facts, '/filingStatus'))
  if (filingStatus) {
    return normalizeFilingStatus(filingStatus)
  }

  const maritalStatus = extractEnumValue(getFactItem(facts, '/maritalStatus'))
  if (maritalStatus) {
    return normalizeFilingStatus(maritalStatus)
  }

  return null
}

export const extractFormTypeFromFacts = (
  facts: DirectFileFacts
): ReturnFormType | null => {
  const maybeFormType =
    extractEnumValue(getFactItem(facts, '/formType')) ??
    (typeof getFactItem(facts, '/formType') === 'string'
      ? String(getFactItem(facts, '/formType'))
      : null)

  if (!maybeFormType) {
    return null
  }

  try {
    return canonicalReturnFormType(maybeFormType)
  } catch {
    return null
  }
}

export const extractPrimaryTinFromFacts = (
  facts: DirectFileFacts
): string | null => {
  const primaryFilerPaths = Object.entries(facts)
    .filter(
      ([path]) =>
        path.startsWith('/filers/#') && path.endsWith('/isPrimaryFiler')
    )
    .filter(([, value]) => {
      const fact = asObject(value)
      return fact?.item === true
    })
    .map(([path]) => path.replace('/isPrimaryFiler', '/tin'))

  for (const path of primaryFilerPaths) {
    const tin = extractTinFromItem(getFactItem(facts, path))
    if (tin) {
      return tin
    }
  }

  const fallbackTinPaths = Object.keys(facts)
    .filter((path) => path.startsWith('/filers/#') && path.endsWith('/tin'))
    .sort((left, right) => left.localeCompare(right))

  for (const path of fallbackTinPaths) {
    const tin = extractTinFromItem(getFactItem(facts, path))
    if (tin) {
      return tin
    }
  }

  return null
}

export const extractStateCodeFromFacts = (
  facts: DirectFileFacts
): string | null => {
  const residenceState = extractEnumValue(
    getFactItem(facts, '/filerResidenceAndIncomeState')
  )
  if (residenceState) {
    return residenceState.toUpperCase()
  }

  const address = asObject(getFactItem(facts, '/address'))
  const stateValue = address?.stateOrProvence
  if (typeof stateValue === 'string' && stateValue.trim().length > 0) {
    return stateValue.trim().toUpperCase()
  }

  return null
}

export const toDirectFileStatus = (status: SubmissionStatus): string => {
  if (status === 'accepted') return 'Accepted'
  if (status === 'rejected') return 'Rejected'
  if (status === 'failed') return 'Rejected'
  if (status === 'processing') return 'Processing'
  if (status === 'queued') return 'Pending'
  return 'Draft'
}

export const directFileStatusTranslationKey = (
  status: SubmissionStatus
): string => `status.${status}`
