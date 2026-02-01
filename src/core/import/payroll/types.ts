/**
 * Shared types and utilities for payroll/W-2 import parsers
 *
 * Provides common interfaces for W-2 data import from various
 * payroll providers (ADP, Paychex, Gusto, etc.)
 */

import { IncomeW2, State } from 'ustaxes/core/data'

/**
 * Raw W-2 import data before conversion to application format
 */
export interface W2ImportData {
  // Employee information
  employeeSSN?: string
  employeeName?: string
  employeeAddress?: string

  // Employer information
  employerEIN: string
  employerName: string
  employerAddress?: string

  // Box 1-11 (Income and Tax)
  wages: number // Box 1: Wages, tips, other compensation
  federalWithholding: number // Box 2: Federal income tax withheld
  ssWages?: number // Box 3: Social security wages
  ssTax?: number // Box 4: Social security tax withheld
  medicareWages?: number // Box 5: Medicare wages and tips
  medicareTax?: number // Box 6: Medicare tax withheld
  ssTips?: number // Box 7: Social security tips
  allocatedTips?: number // Box 8: Allocated tips
  // Box 9 is blank
  dependentCareBenefits?: number // Box 10: Dependent care benefits
  nonQualifiedPlans?: number // Box 11: Nonqualified plans

  // Box 12 (Various codes and amounts)
  box12?: Array<{
    code: string // A through HH
    amount: number
  }>

  // Box 13 (Checkboxes)
  statutoryEmployee?: boolean
  retirementPlan?: boolean
  thirdPartySickPay?: boolean

  // Box 14 (Other)
  box14Description?: string
  box14Amount?: number

  // State tax information (Box 15-17)
  stateCode?: State
  stateEmployerID?: string
  stateWages?: number
  stateTax?: number

  // Local tax information (Box 18-20)
  localWages?: number
  localTax?: number
  localityName?: string

  // Additional metadata
  taxYear?: number
  source?: string // Which payroll provider
}

/**
 * Result of parsing a payroll export
 */
export interface PayrollParseResult {
  w2s: W2ImportData[]
  errors: { row: number; message: string }[]
  warnings: string[]
}

/**
 * Interface for payroll parsers
 */
export interface PayrollParser {
  /**
   * Get the payroll provider name
   */
  getProviderName(): string

  /**
   * Check if this parser can handle the given content
   */
  canParse(content: string, headers: string[]): boolean

  /**
   * Parse the content into W2 import data
   */
  parse(content: string): PayrollParseResult

  /**
   * Convert W2ImportData to the application's IncomeW2 format
   */
  toIncomeW2(data: W2ImportData): IncomeW2
}

/**
 * Parse and format SSN (remove dashes, validate)
 */
export function parseSSN(ssn: string): string | undefined {
  if (!ssn) return undefined

  // Remove dashes, spaces, and other non-digits
  const cleaned = ssn.replace(/\D/g, '')

  // Validate length
  if (cleaned.length !== 9) return undefined

  // Basic validation - first digit can't be 9 (except for ITINs which start with 9)
  // and can't be all zeros in any section
  const area = cleaned.slice(0, 3)
  const group = cleaned.slice(3, 5)
  const serial = cleaned.slice(5, 9)

  if (area === '000' || group === '00' || serial === '0000') {
    return undefined
  }

  // Return with dashes for display purposes
  return cleaned
}

/**
 * Parse and format EIN (remove dashes, validate)
 */
export function parseEIN(ein: string): string | undefined {
  if (!ein) return undefined

  // Remove dashes, spaces, and other non-digits
  const cleaned = ein.replace(/\D/g, '')

  // Validate length
  if (cleaned.length !== 9) return undefined

  // EINs start with valid prefixes (not 07, 08, 09, 17, 18, 19, 28, 29, 49, 69, 70, 78, 79, 89)
  const prefix = parseInt(cleaned.slice(0, 2), 10)
  const invalidPrefixes = [7, 8, 9, 17, 18, 19, 28, 29, 49, 69, 70, 78, 79, 89]
  if (invalidPrefixes.includes(prefix)) {
    return undefined
  }

  // Return formatted
  return cleaned
}

/**
 * Parse money string to number
 */
export function parseMoney(value: string): number {
  if (!value || value.trim() === '') return 0

  // Remove currency symbols, commas, spaces
  let cleaned = value.trim().replace(/[$,\s]/g, '')

  // Handle parentheses for negative numbers
  const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')')
  if (isNegative) {
    cleaned = cleaned.slice(1, -1)
  }

  const num = parseFloat(cleaned)
  if (isNaN(num)) return 0

  return isNegative ? -num : num
}

/**
 * Format SSN for display (XXX-XX-XXXX)
 */
export function formatSSN(ssn: string): string {
  const cleaned = ssn.replace(/\D/g, '')
  if (cleaned.length !== 9) return ssn

  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5, 9)}`
}

/**
 * Format EIN for display (XX-XXXXXXX)
 */
export function formatEIN(ein: string): string {
  const cleaned = ein.replace(/\D/g, '')
  if (cleaned.length !== 9) return ein

  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 9)}`
}

/**
 * Mask SSN for display (XXX-XX-1234)
 */
export function maskSSN(ssn: string): string {
  const cleaned = ssn.replace(/\D/g, '')
  if (cleaned.length !== 9) return '***-**-****'

  return `***-**-${cleaned.slice(5, 9)}`
}

/**
 * Validate state code
 */
export function isValidState(code: string): code is State {
  const validStates: State[] = [
    'AL',
    'AK',
    'AZ',
    'AR',
    'CA',
    'CO',
    'CT',
    'DE',
    'DC',
    'FL',
    'GA',
    'HI',
    'ID',
    'IL',
    'IN',
    'IA',
    'KS',
    'KY',
    'LA',
    'ME',
    'MD',
    'MA',
    'MI',
    'MN',
    'MS',
    'MO',
    'MT',
    'NE',
    'NV',
    'NH',
    'NJ',
    'NM',
    'NY',
    'NC',
    'ND',
    'OH',
    'OK',
    'OR',
    'PA',
    'RI',
    'SC',
    'SD',
    'TN',
    'TX',
    'UT',
    'VT',
    'VA',
    'WA',
    'WV',
    'WI',
    'WY'
  ]
  return validStates.includes(code.toUpperCase() as State)
}

/**
 * Box 12 code descriptions
 */
export const BOX_12_CODES: Record<string, string> = {
  A: 'Uncollected social security or RRTA tax on tips',
  B: 'Uncollected Medicare tax on tips',
  C: 'Taxable cost of group-term life insurance over $50,000',
  D: 'Elective deferrals to 401(k)',
  E: 'Elective deferrals to 403(b)',
  F: 'Elective deferrals to 408(k)(6) SEP',
  G: 'Elective deferrals to 457(b)',
  H: 'Elective deferrals to 501(c)(18)(D)',
  J: 'Nontaxable sick pay',
  K: '20% excise tax on excess golden parachute',
  L: 'Substantiated employee business expense reimbursements',
  M: 'Uncollected social security or RRTA tax on group-term life insurance',
  N: 'Uncollected Medicare tax on group-term life insurance',
  P: 'Excludable moving expense reimbursements',
  Q: 'Nontaxable combat pay',
  R: 'Employer contributions to Archer MSA',
  S: 'Employee salary reduction contributions to SIMPLE',
  T: 'Adoption benefits',
  V: 'Income from exercise of nonstatutory stock options',
  W: 'Employer contributions to HSA',
  Y: 'Deferrals under 409A nonqualified deferred compensation',
  Z: 'Income under 409A nonqualified deferred compensation',
  AA: 'Designated Roth contributions to 401(k)',
  BB: 'Designated Roth contributions to 403(b)',
  DD: 'Cost of employer-sponsored health coverage',
  EE: 'Designated Roth contributions to 457(b)',
  FF: 'Permitted benefits under qualified small employer HRA',
  GG: 'Income from qualified equity grants under 83(i)',
  HH: 'Aggregate deferrals under 83(i)'
}

/**
 * Get description for Box 12 code
 */
export function getBox12Description(code: string): string {
  return BOX_12_CODES[code.toUpperCase()] || 'Unknown code'
}

/**
 * Combine multiple W2s from same employer (for multi-state)
 */
export function combineW2s(w2s: W2ImportData[]): W2ImportData[] {
  // Group by employer EIN
  const byEmployer = new Map<string, W2ImportData[]>()

  for (const w2 of w2s) {
    const key = w2.employerEIN || 'unknown'
    const existing = byEmployer.get(key) || []
    existing.push(w2)
    byEmployer.set(key, existing)
  }

  // For employers with multiple entries, check if they're multi-state
  const result: W2ImportData[] = []

  for (const [, employerW2s] of Array.from(byEmployer.entries())) {
    const w2List = employerW2s
    if (w2List.length === 1) {
      result.push(w2List[0])
    } else {
      // Check if wages are the same (multi-state) or different (multiple W2s)
      const wages = w2List[0].wages
      const allSameWages = w2List.every((w: W2ImportData) => w.wages === wages)

      if (allSameWages) {
        // Multi-state W2 - combine state info
        const combined: W2ImportData = { ...w2List[0] }
        // For now, just use the first one - UI will need to handle multi-state
        result.push(combined)
      } else {
        // Separate W2s from same employer
        result.push(...w2List)
      }
    }
  }

  return result
}
