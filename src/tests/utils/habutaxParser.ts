/**
 * HabuTax INI Parser
 *
 * Parses .habutax INI format files and converts them to the UsTaxes
 * Information interface for integration testing.
 *
 * HabuTax uses sections like:
 * - [1040] - Main form data (filing status, basic info)
 * - [w-2:N] - W-2 forms (N = index starting from 0)
 * - [1099-int:N] - 1099-INT forms
 * - [1099-div:N] - 1099-DIV forms
 * - [1099-b:N] - 1099-B forms
 * - [schedule-a] - Itemized deductions
 * - [schedule-c:N] - Business income
 */

/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import {
  Information,
  TaxPayer,
  PrimaryPerson,
  Spouse,
  Dependent,
  Address,
  FilingStatus,
  PersonRole,
  IncomeW2,
  Supported1099,
  Income1099Type,
  F1099IntData,
  F1099DivData,
  F1099BData,
  AccountType,
  Refund,
  State,
  Employer,
  StateResidency,
  EstimatedTaxPayments,
  F1098e,
  ItemizedDeductions,
  HealthSavingsAccount
} from 'ustaxes/core/data'

// =============================================================================
// INI Parsing Types
// =============================================================================

interface IniSection {
  [key: string]: string
}

interface ParsedIni {
  [section: string]: IniSection
}

// =============================================================================
// INI Parser
// =============================================================================

/**
 * Parse INI format string into sections and key-value pairs
 */
function parseIni(content: string): ParsedIni {
  const result: ParsedIni = {}
  let currentSection = ''

  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
      continue
    }

    // Check for section header [section-name]
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/)
    if (sectionMatch) {
      currentSection = sectionMatch[1].toLowerCase()
      result[currentSection] = {}
      continue
    }

    // Parse key = value pairs
    const keyValueMatch = trimmed.match(/^([^=]+)=(.*)$/)
    if (keyValueMatch && currentSection) {
      const key = keyValueMatch[1].trim().toLowerCase()
      const value = keyValueMatch[2].trim()
      result[currentSection][key] = value
    }
  }

  return result
}

/**
 * Get string value from section
 */
function getString(
  section: IniSection | undefined,
  key: string
): string | undefined {
  if (!section) return undefined
  return section[key.toLowerCase()]
}

/**
 * Get number value from section
 */
function getNumber(
  section: IniSection | undefined,
  key: string,
  defaultValue = 0
): number {
  if (!section) return defaultValue
  const value = section[key.toLowerCase()]
  if (value === undefined) return defaultValue
  const parsed = parseFloat(value.replace(/[$,]/g, ''))
  return isNaN(parsed) ? defaultValue : parsed
}

/**
 * Get boolean value from section
 */
function getBoolean(
  section: IniSection | undefined,
  key: string,
  defaultValue = false
): boolean {
  if (!section) return defaultValue
  const value = section[key.toLowerCase()]
  if (value === undefined) return defaultValue
  return (
    value.toLowerCase() === 'true' ||
    value === '1' ||
    value.toLowerCase() === 'yes'
  )
}

/**
 * Get date value from section
 */
function getDate(section: IniSection | undefined, key: string): Date {
  if (!section) return new Date()
  const value = section[key.toLowerCase()]
  if (!value) return new Date()

  // Try parsing various date formats
  // YYYY-MM-DD, MM/DD/YYYY, etc.
  const date = new Date(value)
  return isNaN(date.getTime()) ? new Date() : date
}

// =============================================================================
// State Validation
// =============================================================================

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

function isValidState(state: string | undefined): state is State {
  if (!state) return false
  return validStates.includes(state.toUpperCase() as State)
}

function normalizeState(state: string | undefined): State | undefined {
  if (!state) return undefined
  const upper = state.toUpperCase()
  return isValidState(upper) ? upper : undefined
}

// =============================================================================
// Section Parsers
// =============================================================================

/**
 * Parse filing status from string
 */
function parseFilingStatus(
  status: string | undefined
): FilingStatus | undefined {
  if (!status) return undefined

  const normalized = status.toUpperCase().replace(/[^A-Z]/g, '')

  const statusMap: Record<string, FilingStatus> = {
    SINGLE: FilingStatus.S,
    S: FilingStatus.S,
    MARRIEDFILINGJOINTLY: FilingStatus.MFJ,
    MARRIEDJOINT: FilingStatus.MFJ,
    MFJ: FilingStatus.MFJ,
    MARRIEDFILINGSEPARATELY: FilingStatus.MFS,
    MARRIEDSEPARATE: FilingStatus.MFS,
    MFS: FilingStatus.MFS,
    HEADOFHOUSEHOLD: FilingStatus.HOH,
    HEAD: FilingStatus.HOH,
    HOH: FilingStatus.HOH,
    QUALIFYINGWIDOWER: FilingStatus.W,
    QUALIFYINGWIDOW: FilingStatus.W,
    WIDOW: FilingStatus.W,
    WIDOWER: FilingStatus.W,
    W: FilingStatus.W
  }

  return statusMap[normalized]
}

/**
 * Parse the [1040] section for main filer info
 */
function parse1040Section(ini: ParsedIni): {
  filingStatus: FilingStatus | undefined
  primaryPerson: PrimaryPerson | undefined
  spouse: Spouse | undefined
  stateResidencies: StateResidency[]
} {
  const section = ini['1040']
  if (!section) {
    return {
      filingStatus: undefined,
      primaryPerson: undefined,
      spouse: undefined,
      stateResidencies: []
    }
  }

  const filingStatus = parseFilingStatus(
    getString(section, 'filing_status') ?? getString(section, 'status')
  )

  // Parse primary filer
  const address: Address = {
    address:
      getString(section, 'address') ?? getString(section, 'street') ?? '',
    aptNo: getString(section, 'apt') ?? getString(section, 'apartment'),
    city: getString(section, 'city') ?? '',
    state: normalizeState(getString(section, 'state')),
    zip: getString(section, 'zip') ?? getString(section, 'zipcode')
  }

  const primaryPerson: PrimaryPerson = {
    firstName:
      getString(section, 'first_name') ??
      getString(section, 'tp_first_name') ??
      '',
    lastName:
      getString(section, 'last_name') ??
      getString(section, 'tp_last_name') ??
      '',
    ssid: (
      getString(section, 'ssn') ??
      getString(section, 'tp_ssn') ??
      ''
    ).replace(/-/g, ''),
    role: PersonRole.PRIMARY,
    isBlind: getBoolean(section, 'blind') || getBoolean(section, 'tp_blind'),
    dateOfBirth:
      getDate(section, 'dob') ||
      getDate(section, 'date_of_birth') ||
      getDate(section, 'tp_dob'),
    address,
    isTaxpayerDependent: getBoolean(section, 'claimed_as_dependent')
  }

  // Parse spouse if MFJ or MFS
  let spouse: Spouse | undefined
  if (
    getString(section, 'spouse_first_name') ||
    getString(section, 'sp_first_name')
  ) {
    spouse = {
      firstName:
        getString(section, 'spouse_first_name') ??
        getString(section, 'sp_first_name') ??
        '',
      lastName:
        getString(section, 'spouse_last_name') ??
        getString(section, 'sp_last_name') ??
        '',
      ssid: (
        getString(section, 'spouse_ssn') ??
        getString(section, 'sp_ssn') ??
        ''
      ).replace(/-/g, ''),
      role: PersonRole.SPOUSE,
      isBlind:
        getBoolean(section, 'spouse_blind') || getBoolean(section, 'sp_blind'),
      dateOfBirth: getDate(section, 'spouse_dob') || getDate(section, 'sp_dob'),
      isTaxpayerDependent: false
    }
  }

  // Parse state residency
  const residencyState = normalizeState(getString(section, 'state'))
  const stateResidencies: StateResidency[] = residencyState
    ? [{ state: residencyState }]
    : []

  return {
    filingStatus,
    primaryPerson,
    spouse,
    stateResidencies
  }
}

/**
 * Parse all [dependent:N] sections
 */
function parseDependents(ini: ParsedIni): Dependent[] {
  const dependents: Dependent[] = []

  // Look for dependent:0, dependent:1, etc.
  for (let i = 0; i < 20; i++) {
    const section = ini[`dependent:${i}`] || ini[`dependent-${i}`]
    if (!section) continue

    dependents.push({
      firstName:
        getString(section, 'first_name') ??
        getString(section, 'name')?.split(' ')[0] ??
        '',
      lastName:
        getString(section, 'last_name') ??
        getString(section, 'name')?.split(' ').slice(1).join(' ') ??
        '',
      ssid: (getString(section, 'ssn') ?? '').replace(/-/g, ''),
      role: PersonRole.DEPENDENT,
      isBlind: getBoolean(section, 'blind'),
      dateOfBirth: getDate(section, 'dob') || getDate(section, 'date_of_birth'),
      relationship: getString(section, 'relationship') ?? 'child',
      qualifyingInfo: {
        numberOfMonths: getNumber(section, 'months_lived', 12),
        isStudent: getBoolean(section, 'student')
      }
    })
  }

  return dependents
}

/**
 * Parse all [w-2:N] or [w2:N] sections
 */
function parseW2s(ini: ParsedIni): IncomeW2[] {
  const w2s: IncomeW2[] = []

  // Look for w-2:0, w-2:1, etc. or w2:0, w2:1, etc.
  for (let i = 0; i < 20; i++) {
    const section =
      ini[`w-2:${i}`] || ini[`w2:${i}`] || ini[`w-2-${i}`] || ini[`w2-${i}`]
    if (!section) continue

    const employer: Employer | undefined = getString(section, 'employer')
      ? {
          EIN: getString(section, 'ein') ?? getString(section, 'employer_ein'),
          employerName:
            getString(section, 'employer') ??
            getString(section, 'employer_name'),
          address: {
            address: getString(section, 'employer_address') ?? '',
            city: getString(section, 'employer_city') ?? '',
            state: normalizeState(getString(section, 'employer_state')),
            zip: getString(section, 'employer_zip')
          }
        }
      : undefined

    const isSpouse =
      getBoolean(section, 'spouse') ||
      getString(section, 'who')?.toLowerCase() === 'spouse'

    w2s.push({
      occupation: getString(section, 'occupation') ?? 'Employee',
      income:
        getNumber(section, 'wages') ||
        getNumber(section, 'box1') ||
        getNumber(section, 'income'),
      medicareIncome:
        getNumber(section, 'medicare_wages') ||
        getNumber(section, 'box5') ||
        getNumber(section, 'wages'),
      fedWithholding:
        getNumber(section, 'federal_withholding') ||
        getNumber(section, 'box2') ||
        getNumber(section, 'fed_withheld'),
      ssWages:
        getNumber(section, 'ss_wages') ||
        getNumber(section, 'box3') ||
        getNumber(section, 'social_security_wages'),
      ssWithholding:
        getNumber(section, 'ss_withholding') ||
        getNumber(section, 'box4') ||
        getNumber(section, 'social_security_withheld'),
      medicareWithholding:
        getNumber(section, 'medicare_withholding') ||
        getNumber(section, 'box6') ||
        getNumber(section, 'medicare_withheld'),
      employer,
      personRole: isSpouse ? PersonRole.SPOUSE : PersonRole.PRIMARY,
      state: normalizeState(
        getString(section, 'state') ?? getString(section, 'box15')
      ),
      stateWages:
        getNumber(section, 'state_wages') ||
        getNumber(section, 'box16') ||
        undefined,
      stateWithholding:
        getNumber(section, 'state_withholding') ||
        getNumber(section, 'box17') ||
        undefined
    })
  }

  return w2s
}

/**
 * Parse all [1099-int:N] sections
 */
function parse1099Ints(ini: ParsedIni): Supported1099[] {
  const forms: Supported1099[] = []

  for (let i = 0; i < 20; i++) {
    const section =
      ini[`1099-int:${i}`] || ini[`1099int:${i}`] || ini[`1099-int-${i}`]
    if (!section) continue

    const isSpouse =
      getBoolean(section, 'spouse') ||
      getString(section, 'who')?.toLowerCase() === 'spouse'

    forms.push({
      payer:
        getString(section, 'payer') ??
        getString(section, 'bank') ??
        'Unknown Bank',
      type: Income1099Type.INT,
      form: {
        income:
          getNumber(section, 'interest') ||
          getNumber(section, 'box1') ||
          getNumber(section, 'amount')
      } as F1099IntData,
      personRole: isSpouse ? PersonRole.SPOUSE : PersonRole.PRIMARY
    })
  }

  return forms
}

/**
 * Parse all [1099-div:N] sections
 */
function parse1099Divs(ini: ParsedIni): Supported1099[] {
  const forms: Supported1099[] = []

  for (let i = 0; i < 20; i++) {
    const section =
      ini[`1099-div:${i}`] || ini[`1099div:${i}`] || ini[`1099-div-${i}`]
    if (!section) continue

    const isSpouse =
      getBoolean(section, 'spouse') ||
      getString(section, 'who')?.toLowerCase() === 'spouse'

    forms.push({
      payer:
        getString(section, 'payer') ??
        getString(section, 'broker') ??
        'Unknown Broker',
      type: Income1099Type.DIV,
      form: {
        dividends:
          getNumber(section, 'ordinary_dividends') ||
          getNumber(section, 'box1a') ||
          getNumber(section, 'dividends'),
        qualifiedDividends:
          getNumber(section, 'qualified_dividends') ||
          getNumber(section, 'box1b'),
        totalCapitalGainsDistributions:
          getNumber(section, 'capital_gains') || getNumber(section, 'box2a')
      } as F1099DivData,
      personRole: isSpouse ? PersonRole.SPOUSE : PersonRole.PRIMARY
    })
  }

  return forms
}

/**
 * Parse all [1099-b:N] sections
 */
function parse1099Bs(ini: ParsedIni): Supported1099[] {
  const forms: Supported1099[] = []

  for (let i = 0; i < 20; i++) {
    const section =
      ini[`1099-b:${i}`] || ini[`1099b:${i}`] || ini[`1099-b-${i}`]
    if (!section) continue

    const isSpouse =
      getBoolean(section, 'spouse') ||
      getString(section, 'who')?.toLowerCase() === 'spouse'

    forms.push({
      payer:
        getString(section, 'payer') ??
        getString(section, 'broker') ??
        'Unknown Broker',
      type: Income1099Type.B,
      form: {
        shortTermProceeds:
          getNumber(section, 'short_term_proceeds') ||
          getNumber(section, 'st_proceeds'),
        shortTermCostBasis:
          getNumber(section, 'short_term_basis') ||
          getNumber(section, 'st_basis'),
        longTermProceeds:
          getNumber(section, 'long_term_proceeds') ||
          getNumber(section, 'lt_proceeds'),
        longTermCostBasis:
          getNumber(section, 'long_term_basis') ||
          getNumber(section, 'lt_basis')
      } as F1099BData,
      personRole: isSpouse ? PersonRole.SPOUSE : PersonRole.PRIMARY
    })
  }

  return forms
}

/**
 * Parse [schedule-a] section for itemized deductions
 */
function parseScheduleA(ini: ParsedIni): ItemizedDeductions | undefined {
  const section = ini['schedule-a'] || ini['schedulea'] || ini['schedule_a']
  if (!section) return undefined

  // Check if user is itemizing
  const isItemizing =
    getBoolean(section, 'itemize') ||
    getNumber(section, 'medical') > 0 ||
    getNumber(section, 'state_local_taxes') > 0 ||
    getNumber(section, 'mortgage_interest') > 0 ||
    getNumber(section, 'charity') > 0

  if (!isItemizing) return undefined

  return {
    medicalAndDental:
      getNumber(section, 'medical') || getNumber(section, 'medical_dental'),
    stateAndLocalTaxes:
      getNumber(section, 'state_local_taxes') ||
      getNumber(section, 'salt') ||
      getNumber(section, 'state_income_tax'),
    isSalesTax: getBoolean(section, 'sales_tax'),
    stateAndLocalRealEstateTaxes:
      getNumber(section, 'real_estate_taxes') ||
      getNumber(section, 'property_tax'),
    stateAndLocalPropertyTaxes: getNumber(section, 'personal_property_tax'),
    interest8a:
      getNumber(section, 'mortgage_interest') ||
      getNumber(section, 'home_mortgage_interest'),
    interest8b:
      getNumber(section, 'mortgage_points') ||
      getNumber(section, 'points_paid'),
    interest8c: 0,
    interest8d: 0,
    investmentInterest: getNumber(section, 'investment_interest'),
    charityCashCheck:
      getNumber(section, 'charity_cash') ||
      getNumber(section, 'charitable_cash') ||
      getNumber(section, 'charity'),
    charityOther:
      getNumber(section, 'charity_noncash') ||
      getNumber(section, 'charitable_noncash')
  }
}

/**
 * Parse [bank] section for refund info
 */
function parseRefund(ini: ParsedIni): Refund | undefined {
  const section = ini['bank'] || ini['refund'] || ini['direct_deposit']
  if (!section) return undefined

  const routingNumber =
    getString(section, 'routing') ?? getString(section, 'routing_number')
  const accountNumber =
    getString(section, 'account') ?? getString(section, 'account_number')

  if (!routingNumber || !accountNumber) return undefined

  const accountTypeStr =
    getString(section, 'account_type') ?? getString(section, 'type')
  const accountType =
    accountTypeStr?.toLowerCase() === 'savings'
      ? AccountType.savings
      : AccountType.checking

  return {
    routingNumber,
    accountNumber,
    accountType
  }
}

/**
 * Parse [estimated] section for estimated tax payments
 */
function parseEstimatedPayments(ini: ParsedIni): EstimatedTaxPayments[] {
  const section =
    ini['estimated'] || ini['estimated_tax'] || ini['estimated-payments']
  if (!section) return []

  const payments: EstimatedTaxPayments[] = []

  // Try quarter-based keys
  const q1 = getNumber(section, 'q1') || getNumber(section, 'quarter1')
  const q2 = getNumber(section, 'q2') || getNumber(section, 'quarter2')
  const q3 = getNumber(section, 'q3') || getNumber(section, 'quarter3')
  const q4 = getNumber(section, 'q4') || getNumber(section, 'quarter4')

  if (q1 > 0) payments.push({ label: 'Q1 Estimated Payment', payment: q1 })
  if (q2 > 0) payments.push({ label: 'Q2 Estimated Payment', payment: q2 })
  if (q3 > 0) payments.push({ label: 'Q3 Estimated Payment', payment: q3 })
  if (q4 > 0) payments.push({ label: 'Q4 Estimated Payment', payment: q4 })

  // Also check for total
  const total = getNumber(section, 'total') || getNumber(section, 'amount')
  if (total > 0 && payments.length === 0) {
    payments.push({ label: 'Estimated Tax Payment', payment: total })
  }

  return payments
}

/**
 * Parse [1098-e] sections for student loan interest
 */
function parseF1098es(ini: ParsedIni): F1098e[] {
  const forms: F1098e[] = []

  // Check single section first
  const singleSection = ini['1098-e'] || ini['1098e'] || ini['student-loan']
  if (singleSection) {
    const interest =
      getNumber(singleSection, 'interest') ||
      getNumber(singleSection, 'box1') ||
      getNumber(singleSection, 'amount')
    if (interest > 0) {
      forms.push({
        lender:
          getString(singleSection, 'lender') ??
          getString(singleSection, 'servicer') ??
          'Student Loan Servicer',
        interest
      })
    }
  }

  // Check indexed sections
  for (let i = 0; i < 10; i++) {
    const section = ini[`1098-e:${i}`] || ini[`1098e:${i}`]
    if (!section) continue

    const interest =
      getNumber(section, 'interest') ||
      getNumber(section, 'box1') ||
      getNumber(section, 'amount')
    if (interest > 0) {
      forms.push({
        lender:
          getString(section, 'lender') ??
          getString(section, 'servicer') ??
          'Student Loan Servicer',
        interest
      })
    }
  }

  return forms
}

/**
 * Parse [hsa] section for health savings account
 */
function parseHSA(ini: ParsedIni): HealthSavingsAccount[] {
  const section = ini['hsa'] || ini['health-savings']
  if (!section) return []

  const contributions =
    getNumber(section, 'contributions') || getNumber(section, 'amount')
  if (contributions <= 0) return []

  const coverageType = getString(section, 'coverage')?.toLowerCase()
  const taxYear = getNumber(section, 'year', new Date().getFullYear())

  const isSpouse =
    getBoolean(section, 'spouse') ||
    getString(section, 'who')?.toLowerCase() === 'spouse'

  return [
    {
      label: getString(section, 'label') ?? 'HSA Account',
      coverageType: coverageType === 'family' ? 'family' : 'self-only',
      contributions,
      personRole: isSpouse ? PersonRole.SPOUSE : PersonRole.PRIMARY,
      startDate: new Date(taxYear, 0, 1),
      endDate: new Date(taxYear, 11, 31),
      totalDistributions: getNumber(section, 'distributions'),
      qualifiedDistributions:
        getNumber(section, 'qualified_distributions') ||
        getNumber(section, 'distributions')
    }
  ]
}

// =============================================================================
// Main Export Functions
// =============================================================================

/**
 * Parse a HabuTax INI file into UsTaxes Information format
 *
 * @param iniContent - Raw INI file content as string
 * @returns Information object compatible with UsTaxes
 */
export function parseHabutax(iniContent: string): Information {
  const ini = parseIni(iniContent)

  const { filingStatus, primaryPerson, spouse, stateResidencies } =
    parse1040Section(ini)
  const dependents = parseDependents(ini)

  const taxPayer: TaxPayer = {
    filingStatus,
    primaryPerson,
    spouse,
    dependents,
    contactEmail: getString(ini['1040'], 'email'),
    contactPhoneNumber: getString(ini['1040'], 'phone')
  }

  // Combine all 1099 forms
  const f1099s: Supported1099[] = [
    ...parse1099Ints(ini),
    ...parse1099Divs(ini),
    ...parse1099Bs(ini)
  ]

  return {
    f1099s,
    w2s: parseW2s(ini),
    realEstate: [],
    estimatedTaxes: parseEstimatedPayments(ini),
    f1098es: parseF1098es(ini),
    f3921s: [],
    scheduleK1Form1065s: [],
    itemizedDeductions: parseScheduleA(ini),
    refund: parseRefund(ini),
    taxPayer,
    questions: {
      CRYPTO:
        getBoolean(ini['1040'], 'crypto') ||
        getBoolean(ini['1040'], 'virtual_currency'),
      FOREIGN_ACCOUNT_EXISTS: getBoolean(ini['1040'], 'foreign_accounts'),
      FINCEN_114: getBoolean(ini['1040'], 'fbar'),
      FINCEN_114_ACCOUNT_COUNTRY: getString(ini['1040'], 'foreign_country'),
      FOREIGN_TRUST_RELATIONSHIP: getBoolean(ini['1040'], 'foreign_trust'),
      LIVE_APART_FROM_SPOUSE: getBoolean(ini['1040'], 'live_apart')
    },
    credits: [],
    stateResidencies,
    healthSavingsAccounts: parseHSA(ini),
    individualRetirementArrangements: []
  }
}

/**
 * Parse multiple HabuTax INI files
 *
 * @param iniContents - Array of INI file contents
 * @returns Array of Information objects
 */
export function parseMultipleHabutax(iniContents: string[]): Information[] {
  return iniContents.map(parseHabutax)
}

/**
 * Validate that a HabuTax file has minimum required data
 *
 * @param iniContent - Raw INI file content
 * @returns Object with isValid flag and any error messages
 */
export function validateHabutax(iniContent: string): {
  isValid: boolean
  errors: string[]
} {
  const ini = parseIni(iniContent)
  const errors: string[] = []

  const section1040 = ini['1040']
  if (!section1040) {
    errors.push('Missing [1040] section')
  } else {
    if (
      !getString(section1040, 'first_name') &&
      !getString(section1040, 'tp_first_name')
    ) {
      errors.push('Missing taxpayer first name')
    }
    if (
      !getString(section1040, 'last_name') &&
      !getString(section1040, 'tp_last_name')
    ) {
      errors.push('Missing taxpayer last name')
    }
    if (!getString(section1040, 'ssn') && !getString(section1040, 'tp_ssn')) {
      errors.push('Missing taxpayer SSN')
    }
    if (
      !getString(section1040, 'filing_status') &&
      !getString(section1040, 'status')
    ) {
      errors.push('Missing filing status')
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Get list of sections found in a HabuTax file
 *
 * @param iniContent - Raw INI file content
 * @returns Array of section names
 */
export function getHabutaxSections(iniContent: string): string[] {
  const ini = parseIni(iniContent)
  return Object.keys(ini)
}

// Export types for external use
export type { ParsedIni, IniSection }
