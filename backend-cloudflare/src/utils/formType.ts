import type { ReturnFormType } from '../domain/types'

const FORM_TYPE_ALIASES = new Map<string, ReturnFormType>([
  ['1040', '1040'],
  ['1040nr', '1040-NR'],
  ['1040ss', '1040-SS'],
  ['4868', '4868']
])

export const normalizeReturnFormType = (value: string): string =>
  value.trim().toLowerCase().replaceAll('-', '').replaceAll('_', '')

export const isValidReturnFormType = (value: string): value is ReturnFormType =>
  FORM_TYPE_ALIASES.has(normalizeReturnFormType(value))

export const canonicalReturnFormType = (value: string): ReturnFormType => {
  const canonical = FORM_TYPE_ALIASES.get(normalizeReturnFormType(value))
  if (!canonical) {
    throw new Error(`Unsupported return form type: ${value}`)
  }
  return canonical
}
