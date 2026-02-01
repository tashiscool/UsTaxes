import {
  Information,
  InformationDateString,
  TaxYear,
  TaxYears,
  IncomeW2,
  Employer,
  Dependent,
  DependentDateString,
  PrimaryPerson,
  PrimaryPersonDateString,
  Spouse,
  SpouseDateString,
  Refund,
  StateResidency,
  PersonRole
} from 'ustaxes/core/data'
import * as validators from 'ustaxes/core/data/validate'

/* eslint-disable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars */

/**
 * Represents the result of validating prior year data
 */
export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Represents the structural data that can be carried forward
 */
export interface CarryForwardData {
  // Personal information (names, addresses, SSNs)
  primaryPerson?: PrimaryPersonDateString
  spouse?: SpouseDateString
  dependents: DependentDateString[]

  // Employer information (just structure, no amounts)
  employers: Employer[]

  // Bank information for refund
  refund?: Refund

  // State residency
  stateResidencies: StateResidency[]

  // Contact information
  contactPhoneNumber?: string
  contactEmail?: string
}

/**
 * Preview of data that will be imported
 */
export interface ImportPreview {
  sourceYear: TaxYear
  targetYear: TaxYear
  carryForwardData: CarryForwardData
  fieldsToImport: string[]
  fieldsSkipped: string[]
}

/**
 * Get the numeric year value from a TaxYear key
 */
export const getTaxYearValue = (year: TaxYear): number => {
  return TaxYears[year]
}

/**
 * Get valid prior years that can be imported from
 */
export const getValidPriorYears = (currentYear: TaxYear): TaxYear[] => {
  const currentYearValue = getTaxYearValue(currentYear)
  const allYears = Object.keys(TaxYears).filter((key) =>
    isNaN(Number(key))
  ) as TaxYear[]

  return allYears.filter((year) => getTaxYearValue(year) < currentYearValue)
}

/**
 * Validates that the JSON data matches the Information interface structure
 */
export const validatePriorYearData = (data: unknown): ValidationResult => {
  const errors: string[] = []
  const warnings: string[] = []

  if (data === null || data === undefined) {
    return {
      isValid: false,
      errors: ['Data is null or undefined'],
      warnings: []
    }
  }

  if (typeof data !== 'object') {
    return {
      isValid: false,
      errors: ['Data is not an object'],
      warnings: []
    }
  }

  const info = data as Record<string, unknown>

  // Check for required fields
  if (!info.taxPayer) {
    errors.push('Missing taxPayer field')
  } else {
    const taxPayer = info.taxPayer as Record<string, unknown>
    if (!Array.isArray(taxPayer.dependents)) {
      warnings.push('dependents field is missing or not an array')
    }
  }

  // Check for common Information fields
  const expectedFields = [
    'f1099s',
    'w2s',
    'realEstate',
    'estimatedTaxes',
    'f1098es',
    'taxPayer',
    'questions',
    'stateResidencies',
    'healthSavingsAccounts',
    'credits'
  ]

  const presentFields = expectedFields.filter((field) => field in info)
  if (presentFields.length < 5) {
    warnings.push(
      `Only ${presentFields.length}/${expectedFields.length} expected fields found. ` +
        `This may not be a valid UsTaxes export file.`
    )
  }

  // Try to validate with the schema validator if available
  try {
    const infoDateString = info as unknown as InformationDateString
    validators.information(infoDateString)
    if (validators.information.errors) {
      warnings.push(
        ...validators.information.errors.map(
          (e) => `Schema warning: ${e.instancePath} ${e.message ?? ''}`
        )
      )
    }
  } catch (e) {
    // Schema validation failed, but we can still try to extract data
    warnings.push(
      'Full schema validation failed, but partial import may be possible'
    )
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Strips income amounts from a W2, keeping only structural/employer data
 */
const stripW2Amounts = (w2: IncomeW2): Employer | undefined => {
  return w2.employer
}

/**
 * Strips sensitive date information, converting to string format
 */
const personToDateString = <P extends { dateOfBirth: Date | string }>(
  person: P
): P & { dateOfBirth: string } => {
  const dateOfBirth =
    person.dateOfBirth instanceof Date
      ? person.dateOfBirth.toISOString()
      : person.dateOfBirth
  return { ...person, dateOfBirth }
}

/**
 * Extracts structural data from prior year Information
 * This includes names, addresses, employers (without amounts), bank info
 */
export const extractCarryForwardData = (
  info: Information | InformationDateString
): CarryForwardData => {
  // Extract employers from W2s (just structure, no amounts)
  const employers: Employer[] = (info.w2s ?? [])
    .map(stripW2Amounts)
    .filter((e): e is Employer => e !== undefined)

  // Extract primary person info
  let primaryPerson: PrimaryPersonDateString | undefined
  if (info.taxPayer.primaryPerson) {
    const pp = info.taxPayer.primaryPerson
    primaryPerson = {
      ...personToDateString(pp as PrimaryPerson<Date | string>),
      address: pp.address,
      isTaxpayerDependent: pp.isTaxpayerDependent,
      role: PersonRole.PRIMARY,
      isStudent: pp.isStudent,
      ein: pp.ein
    }
  }

  // Extract spouse info
  let spouse: SpouseDateString | undefined
  if (info.taxPayer.spouse) {
    const sp = info.taxPayer.spouse
    spouse = {
      ...personToDateString(sp as Spouse<Date | string>),
      isTaxpayerDependent: sp.isTaxpayerDependent,
      role: PersonRole.SPOUSE
    }
  }

  // Extract dependents
  const dependents: DependentDateString[] = (
    info.taxPayer.dependents ?? []
  ).map((dep) => ({
    ...personToDateString(dep as Dependent<Date | string>),
    relationship: dep.relationship,
    qualifyingInfo: dep.qualifyingInfo,
    role: PersonRole.DEPENDENT
  }))

  return {
    primaryPerson,
    spouse,
    dependents,
    employers,
    refund: info.refund,
    stateResidencies: info.stateResidencies ?? [],
    contactPhoneNumber: info.taxPayer.contactPhoneNumber,
    contactEmail: info.taxPayer.contactEmail
  }
}

/**
 * Creates an import preview showing what data will be imported
 */
export const createImportPreview = (
  sourceData: Information | InformationDateString,
  sourceYear: TaxYear,
  targetYear: TaxYear
): ImportPreview => {
  const carryForwardData = extractCarryForwardData(sourceData)

  const fieldsToImport: string[] = []
  const fieldsSkipped: string[] = []

  // Track what's being imported
  if (carryForwardData.primaryPerson) {
    fieldsToImport.push('Primary Taxpayer Information')
  }
  if (carryForwardData.spouse) {
    fieldsToImport.push('Spouse Information')
  }
  if (carryForwardData.dependents.length > 0) {
    fieldsToImport.push(`${carryForwardData.dependents.length} Dependent(s)`)
  }
  if (carryForwardData.employers.length > 0) {
    fieldsToImport.push(`${carryForwardData.employers.length} Employer(s)`)
  }
  if (carryForwardData.refund) {
    fieldsToImport.push('Bank Account Information')
  }
  if (carryForwardData.stateResidencies.length > 0) {
    fieldsToImport.push('State Residency')
  }
  if (carryForwardData.contactPhoneNumber || carryForwardData.contactEmail) {
    fieldsToImport.push('Contact Information')
  }

  // Track what's being skipped (dollar amounts)
  const w2Count = sourceData.w2s.length ?? 0
  if (w2Count > 0) {
    fieldsSkipped.push(`W2 Income Amounts (${w2Count} form(s))`)
  }
  const f1099Count = sourceData.f1099s.length ?? 0
  if (f1099Count > 0) {
    fieldsSkipped.push(`1099 Income (${f1099Count} form(s))`)
  }
  const estimatedTaxCount = sourceData.estimatedTaxes.length ?? 0
  if (estimatedTaxCount > 0) {
    fieldsSkipped.push(`Estimated Tax Payments (${estimatedTaxCount})`)
  }
  if (sourceData.itemizedDeductions) {
    fieldsSkipped.push('Itemized Deduction Amounts')
  }
  const hsaCount = sourceData.healthSavingsAccounts.length ?? 0
  if (hsaCount > 0) {
    fieldsSkipped.push(`HSA Contribution Amounts (${hsaCount})`)
  }
  const iraCount = sourceData.individualRetirementArrangements.length ?? 0
  if (iraCount > 0) {
    fieldsSkipped.push(`IRA Information (${iraCount})`)
  }

  return {
    sourceYear,
    targetYear,
    carryForwardData,
    fieldsToImport,
    fieldsSkipped
  }
}

/**
 * Maps and transforms prior year data for import into the target year.
 * Handles any schema differences between years.
 */
export const mapPriorYearData = (
  carryForwardData: CarryForwardData,
  targetYear: TaxYear
): Partial<InformationDateString> => {
  // For now, the schema is relatively stable across years
  // Future versions may need year-specific mappings

  const result: Partial<InformationDateString> = {
    taxPayer: {
      primaryPerson: carryForwardData.primaryPerson,
      spouse: carryForwardData.spouse,
      dependents: carryForwardData.dependents,
      contactPhoneNumber: carryForwardData.contactPhoneNumber,
      contactEmail: carryForwardData.contactEmail
    },
    refund: carryForwardData.refund,
    stateResidencies: carryForwardData.stateResidencies,
    // Initialize empty arrays for income data (not carried forward)
    w2s: [],
    f1099s: [],
    estimatedTaxes: [],
    f1098es: [],
    f3921s: [],
    scheduleK1Form1065s: [],
    realEstate: [],
    healthSavingsAccounts: [],
    credits: [],
    individualRetirementArrangements: [],
    questions: {}
  }

  return result
}

/**
 * Creates W2 entries with employer info but zero amounts
 */
export const createEmptyW2sFromEmployers = (
  employers: Employer[],
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE = PersonRole.PRIMARY
): IncomeW2[] => {
  return employers.map((employer) => ({
    occupation: '',
    income: 0,
    medicareIncome: 0,
    fedWithholding: 0,
    ssWages: 0,
    ssWithholding: 0,
    medicareWithholding: 0,
    employer,
    personRole
  }))
}

/**
 * Parses JSON string and extracts prior year data
 */
export const parsePriorYearJson = (
  jsonString: string
): { data: InformationDateString | null; error: string | null } => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed: Record<string, unknown> = JSON.parse(jsonString)

    // Handle case where the JSON might be wrapped in a year key
    // e.g., { "Y2024": { ... } } or just { ... }
    let data: unknown = parsed

    // Check if this is a full state export with year keys
    const yearKeys = Object.keys(TaxYears).filter((k) => isNaN(Number(k)))
    for (const yearKey of yearKeys) {
      if (parsed[yearKey] && typeof parsed[yearKey] === 'object') {
        // This looks like a full state export, use the specific year data
        data = parsed[yearKey]
        break
      }
    }

    return { data: data as InformationDateString, error: null }
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : 'Failed to parse JSON'
    }
  }
}

/**
 * Detects which tax year the data belongs to based on content or metadata
 */
export const detectSourceYear = (jsonString: string): TaxYear | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed: Record<string, unknown> = JSON.parse(jsonString)

    // Check if this is a full state export with year keys
    const yearKeys = Object.keys(TaxYears).filter((k) =>
      isNaN(Number(k))
    ) as TaxYear[]

    // Find the year with the most data
    let bestYear: TaxYear | null = null
    let bestScore = 0

    for (const yearKey of yearKeys) {
      if (parsed[yearKey] && typeof parsed[yearKey] === 'object') {
        const yearData = parsed[yearKey] as Record<string, unknown>
        let score = 0

        // Score based on populated fields
        if (yearData.taxPayer) score += 10
        if (Array.isArray(yearData.w2s) && yearData.w2s.length > 0) score += 5
        if (Array.isArray(yearData.f1099s) && yearData.f1099s.length > 0)
          score += 5
        if (yearData.refund) score += 3

        if (score > bestScore) {
          bestScore = score
          bestYear = yearKey
        }
      }
    }

    return bestYear
  } catch {
    return null
  }
}
