/**
 * Fact Graph Parser for IRS Direct File Format
 *
 * Parses the IRS Direct File fact graph JSON format and converts it
 * to the UsTaxes Information interface for integration testing.
 *
 * The fact graph format uses wrapper types for values:
 * - StringWrapper: { value: string }
 * - BooleanWrapper: { value: boolean }
 * - TinWrapper: { value: string } (for SSN/EIN)
 * - AddressWrapper: { streetAddress, city, state, zip, etc. }
 * - MoneyWrapper: { value: number } (in cents or dollars)
 */

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
  AccountType,
  Refund,
  State,
  Employer,
  StateResidency,
  HealthSavingsAccount,
  EstimatedTaxPayments,
  F1098e,
  ItemizedDeductions,
  Ira,
  IraPlanType
} from 'ustaxes/core/data'

// =============================================================================
// Fact Graph Wrapper Types
// =============================================================================

interface StringWrapper {
  value: string
}

interface BooleanWrapper {
  value: boolean
}

interface TinWrapper {
  value: string
  areaNumber?: string
  groupNumber?: string
  serialNumber?: string
}

interface MoneyWrapper {
  value: number
  currency?: string
}

interface DateWrapper {
  value: string // ISO date string
  year?: number
  month?: number
  day?: number
}

interface AddressWrapper {
  streetAddress?: StringWrapper
  streetAddress2?: StringWrapper
  city?: StringWrapper
  state?: StringWrapper
  zip?: StringWrapper
  postalCode?: StringWrapper
  country?: StringWrapper
  foreignProvince?: StringWrapper
}

interface PersonWrapper {
  firstName?: StringWrapper
  lastName?: StringWrapper
  middleInitial?: StringWrapper
  ssn?: TinWrapper
  tin?: TinWrapper
  dateOfBirth?: DateWrapper
  isBlind?: BooleanWrapper
  isDeceased?: BooleanWrapper
}

interface FilerWrapper extends PersonWrapper {
  address?: AddressWrapper
  email?: StringWrapper
  phone?: StringWrapper
  occupation?: StringWrapper
  isTaxpayerDependent?: BooleanWrapper
}

interface DependentWrapper extends PersonWrapper {
  relationship?: StringWrapper
  monthsLivedWithYou?: MoneyWrapper
  isStudent?: BooleanWrapper
  isDisabled?: BooleanWrapper
  qualifyingChild?: BooleanWrapper
  qualifyingRelative?: BooleanWrapper
}

interface W2Wrapper {
  employer?: {
    ein?: TinWrapper
    name?: StringWrapper
    address?: AddressWrapper
  }
  wages?: MoneyWrapper
  federalWithholding?: MoneyWrapper
  socialSecurityWages?: MoneyWrapper
  socialSecurityWithholding?: MoneyWrapper
  medicareWages?: MoneyWrapper
  medicareWithholding?: MoneyWrapper
  stateWages?: MoneyWrapper
  stateWithholding?: MoneyWrapper
  state?: StringWrapper
  localWages?: MoneyWrapper
  localWithholding?: MoneyWrapper
  locality?: StringWrapper
  occupation?: StringWrapper
  box12?: Record<string, MoneyWrapper>
}

interface Form1099IntWrapper {
  payer?: StringWrapper
  payerTin?: TinWrapper
  interest?: MoneyWrapper
  earlyWithdrawalPenalty?: MoneyWrapper
  federalWithholding?: MoneyWrapper
  savingsBondInterest?: MoneyWrapper
  investmentExpenses?: MoneyWrapper
}

interface Form1099DivWrapper {
  payer?: StringWrapper
  payerTin?: TinWrapper
  ordinaryDividends?: MoneyWrapper
  qualifiedDividends?: MoneyWrapper
  totalCapitalGains?: MoneyWrapper
  section1202Gains?: MoneyWrapper
  unrecaptured1250Gains?: MoneyWrapper
  section1250Gains?: MoneyWrapper
  collectiblesGains?: MoneyWrapper
  nondividendDistributions?: MoneyWrapper
  federalWithholding?: MoneyWrapper
  investmentExpenses?: MoneyWrapper
  foreignTaxPaid?: MoneyWrapper
  foreignCountry?: StringWrapper
}

interface Form1099RWrapper {
  payer?: StringWrapper
  payerTin?: TinWrapper
  grossDistribution?: MoneyWrapper
  taxableAmount?: MoneyWrapper
  taxableAmountNotDetermined?: BooleanWrapper
  totalDistribution?: BooleanWrapper
  capitalGain?: MoneyWrapper
  federalWithholding?: MoneyWrapper
  employeeContributions?: MoneyWrapper
  netUnrealizedAppreciation?: MoneyWrapper
  distributionCode?: StringWrapper
  iraSimpleSep?: BooleanWrapper
}

interface Form1099SSAWrapper {
  benefits?: MoneyWrapper
  benefitsRepaid?: MoneyWrapper
  federalWithholding?: MoneyWrapper
  netBenefits?: MoneyWrapper
}

interface BankAccountWrapper {
  routingNumber?: StringWrapper
  accountNumber?: StringWrapper
  accountType?: StringWrapper // 'checking' or 'savings'
}

interface FactGraphData {
  // Filing information
  filingStatus?: StringWrapper
  taxYear?: MoneyWrapper

  // Filers
  primaryFiler?: FilerWrapper
  spouse?: FilerWrapper

  // Dependents
  dependents?: DependentWrapper[]

  // Income
  w2s?: W2Wrapper[]
  form1099Ints?: Form1099IntWrapper[]
  form1099Divs?: Form1099DivWrapper[]
  form1099Rs?: Form1099RWrapper[]
  form1099SSAs?: Form1099SSAWrapper[]

  // Bank account for refund
  bankAccount?: BankAccountWrapper

  // State residency
  stateResidency?: StringWrapper

  // Deductions and credits
  itemizedDeductions?: {
    medicalExpenses?: MoneyWrapper
    stateLocalTaxes?: MoneyWrapper
    realEstateTaxes?: MoneyWrapper
    personalPropertyTaxes?: MoneyWrapper
    mortgageInterest?: MoneyWrapper
    charityCash?: MoneyWrapper
    charityNonCash?: MoneyWrapper
  }

  // Estimated tax payments
  estimatedPayments?: Array<{
    amount?: MoneyWrapper
    datePaid?: DateWrapper
  }>

  // HSA
  hsaContributions?: MoneyWrapper
  hsaDistributions?: MoneyWrapper
  hsaCoverageType?: StringWrapper

  // IRA
  iraContributions?: MoneyWrapper
  iraDistributions?: MoneyWrapper

  // Student loan interest
  studentLoanInterest?: MoneyWrapper

  // Questions/responses
  hasCrypto?: BooleanWrapper
  hasForeignAccounts?: BooleanWrapper
  foreignAccountCountry?: StringWrapper
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Unwrap a StringWrapper to get the raw string value
 */
function unwrapString(wrapper: StringWrapper | undefined): string | undefined {
  return wrapper?.value
}

/**
 * Unwrap a BooleanWrapper to get the raw boolean value
 */
function unwrapBoolean(
  wrapper: BooleanWrapper | undefined,
  defaultValue = false
): boolean {
  return wrapper?.value ?? defaultValue
}

/**
 * Unwrap a MoneyWrapper to get the numeric value
 * Assumes values are in dollars (not cents)
 */
function unwrapMoney(
  wrapper: MoneyWrapper | undefined,
  defaultValue = 0
): number {
  return wrapper?.value ?? defaultValue
}

/**
 * Unwrap a TinWrapper to get the SSN/EIN string
 */
function unwrapTin(wrapper: TinWrapper | undefined): string {
  if (!wrapper) return ''

  // If we have component parts, reconstruct
  if (wrapper.areaNumber && wrapper.groupNumber && wrapper.serialNumber) {
    return `${wrapper.areaNumber}${wrapper.groupNumber}${wrapper.serialNumber}`
  }

  // Otherwise use the value directly, removing any dashes
  return (wrapper.value ?? '').replace(/-/g, '')
}

/**
 * Unwrap a DateWrapper to get a Date object
 */
function unwrapDate(wrapper: DateWrapper | undefined): Date {
  if (!wrapper) return new Date()

  if (
    wrapper.year !== undefined &&
    wrapper.month !== undefined &&
    wrapper.day !== undefined
  ) {
    return new Date(wrapper.year, wrapper.month - 1, wrapper.day)
  }

  if (wrapper.value) {
    return new Date(wrapper.value)
  }

  return new Date()
}

/**
 * Convert AddressWrapper to UsTaxes Address
 */
function parseAddress(wrapper: AddressWrapper | undefined): Address {
  if (!wrapper) {
    return {
      address: '',
      city: '',
      state: undefined,
      zip: ''
    }
  }

  const stateStr = unwrapString(wrapper.state)

  return {
    address: unwrapString(wrapper.streetAddress) ?? '',
    aptNo: unwrapString(wrapper.streetAddress2),
    city: unwrapString(wrapper.city) ?? '',
    state: isValidState(stateStr) ? stateStr : undefined,
    zip: unwrapString(wrapper.zip) ?? unwrapString(wrapper.postalCode),
    foreignCountry: unwrapString(wrapper.country),
    province: unwrapString(wrapper.foreignProvince)
  }
}

/**
 * Check if a string is a valid US state code
 */
function isValidState(state: string | undefined): state is State {
  if (!state) return false
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
  return validStates.includes(state as State)
}

/**
 * Parse filing status string to FilingStatus enum
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
    MFJ: FilingStatus.MFJ,
    MARRIEDFILINGSEPARATELY: FilingStatus.MFS,
    MFS: FilingStatus.MFS,
    HEADOFHOUSEHOLD: FilingStatus.HOH,
    HOH: FilingStatus.HOH,
    QUALIFYINGWIDOWER: FilingStatus.W,
    WIDOW: FilingStatus.W,
    WIDOWER: FilingStatus.W,
    W: FilingStatus.W
  }

  return statusMap[normalized]
}

// =============================================================================
// Main Parser Functions
// =============================================================================

/**
 * Parse a primary filer from fact graph format
 */
function parsePrimaryPerson(
  filer: FilerWrapper | undefined
): PrimaryPerson | undefined {
  if (!filer) return undefined

  return {
    firstName: unwrapString(filer.firstName) ?? '',
    lastName: unwrapString(filer.lastName) ?? '',
    ssid: unwrapTin(filer.ssn ?? filer.tin),
    role: PersonRole.PRIMARY,
    isBlind: unwrapBoolean(filer.isBlind),
    dateOfBirth: unwrapDate(filer.dateOfBirth),
    address: parseAddress(filer.address),
    isTaxpayerDependent: unwrapBoolean(filer.isTaxpayerDependent)
  }
}

/**
 * Parse a spouse from fact graph format
 */
function parseSpouse(filer: FilerWrapper | undefined): Spouse | undefined {
  if (!filer) return undefined

  return {
    firstName: unwrapString(filer.firstName) ?? '',
    lastName: unwrapString(filer.lastName) ?? '',
    ssid: unwrapTin(filer.ssn ?? filer.tin),
    role: PersonRole.SPOUSE,
    isBlind: unwrapBoolean(filer.isBlind),
    dateOfBirth: unwrapDate(filer.dateOfBirth),
    isTaxpayerDependent: unwrapBoolean(filer.isTaxpayerDependent)
  }
}

/**
 * Parse dependents from fact graph format
 */
function parseDependents(deps: DependentWrapper[] | undefined): Dependent[] {
  if (!deps) return []

  return deps.map((dep) => ({
    firstName: unwrapString(dep.firstName) ?? '',
    lastName: unwrapString(dep.lastName) ?? '',
    ssid: unwrapTin(dep.ssn ?? dep.tin),
    role: PersonRole.DEPENDENT,
    isBlind: unwrapBoolean(dep.isBlind),
    dateOfBirth: unwrapDate(dep.dateOfBirth),
    relationship: unwrapString(dep.relationship) ?? 'child',
    qualifyingInfo: {
      numberOfMonths: Math.round(unwrapMoney(dep.monthsLivedWithYou, 12)),
      isStudent: unwrapBoolean(dep.isStudent)
    }
  }))
}

/**
 * Parse W-2 forms from fact graph format
 */
function parseW2s(w2s: W2Wrapper[] | undefined): IncomeW2[] {
  if (!w2s) return []

  return w2s.map((w2) => {
    const stateStr = unwrapString(w2.state)
    const employer: Employer | undefined = w2.employer
      ? {
          EIN: unwrapTin(w2.employer.ein),
          employerName: unwrapString(w2.employer.name),
          address: parseAddress(w2.employer.address)
        }
      : undefined

    return {
      occupation: unwrapString(w2.occupation) ?? 'Employee',
      income: unwrapMoney(w2.wages),
      medicareIncome: unwrapMoney(w2.medicareWages),
      fedWithholding: unwrapMoney(w2.federalWithholding),
      ssWages: unwrapMoney(w2.socialSecurityWages),
      ssWithholding: unwrapMoney(w2.socialSecurityWithholding),
      medicareWithholding: unwrapMoney(w2.medicareWithholding),
      employer,
      personRole: PersonRole.PRIMARY,
      state: isValidState(stateStr) ? stateStr : undefined,
      stateWages: unwrapMoney(w2.stateWages) || undefined,
      stateWithholding: unwrapMoney(w2.stateWithholding) || undefined
    }
  })
}

/**
 * Parse 1099-INT forms from fact graph format
 */
function parse1099Ints(
  forms: Form1099IntWrapper[] | undefined
): Supported1099[] {
  if (!forms) return []

  return forms.map((form) => ({
    payer: unwrapString(form.payer) ?? 'Unknown Bank',
    type: Income1099Type.INT as const,
    form: {
      income: unwrapMoney(form.interest)
    } as F1099IntData,
    personRole: PersonRole.PRIMARY as const
  }))
}

/**
 * Parse 1099-DIV forms from fact graph format
 */
function parse1099Divs(
  forms: Form1099DivWrapper[] | undefined
): Supported1099[] {
  if (!forms) return []

  return forms.map((form) => ({
    payer: unwrapString(form.payer) ?? 'Unknown Broker',
    type: Income1099Type.DIV as const,
    form: {
      dividends: unwrapMoney(form.ordinaryDividends),
      qualifiedDividends: unwrapMoney(form.qualifiedDividends),
      totalCapitalGainsDistributions: unwrapMoney(form.totalCapitalGains)
    } as F1099DivData,
    personRole: PersonRole.PRIMARY as const
  }))
}

/**
 * Parse bank account for refund
 */
function parseRefund(
  bankAccount: BankAccountWrapper | undefined
): Refund | undefined {
  if (!bankAccount) return undefined

  const routingNumber = unwrapString(bankAccount.routingNumber)
  const accountNumber = unwrapString(bankAccount.accountNumber)

  if (!routingNumber || !accountNumber) return undefined

  const accountTypeStr = unwrapString(bankAccount.accountType)?.toLowerCase()
  const accountType =
    accountTypeStr === 'savings' ? AccountType.savings : AccountType.checking

  return {
    routingNumber,
    accountNumber,
    accountType
  }
}

/**
 * Parse state residencies
 */
function parseStateResidencies(
  state: StringWrapper | undefined
): StateResidency[] {
  const stateStr = unwrapString(state)
  if (!stateStr || !isValidState(stateStr)) return []
  return [{ state: stateStr }]
}

/**
 * Parse itemized deductions
 */
function parseItemizedDeductions(
  deductions: FactGraphData['itemizedDeductions']
): ItemizedDeductions | undefined {
  if (!deductions) return undefined

  return {
    medicalAndDental: unwrapMoney(deductions.medicalExpenses),
    stateAndLocalTaxes: unwrapMoney(deductions.stateLocalTaxes),
    isSalesTax: false,
    stateAndLocalRealEstateTaxes: unwrapMoney(deductions.realEstateTaxes),
    stateAndLocalPropertyTaxes: unwrapMoney(deductions.personalPropertyTaxes),
    interest8a: unwrapMoney(deductions.mortgageInterest),
    interest8b: 0,
    interest8c: 0,
    interest8d: 0,
    investmentInterest: 0,
    charityCashCheck: unwrapMoney(deductions.charityCash),
    charityOther: unwrapMoney(deductions.charityNonCash)
  }
}

/**
 * Parse estimated tax payments
 */
function parseEstimatedPayments(
  payments: FactGraphData['estimatedPayments']
): EstimatedTaxPayments[] {
  if (!payments) return []

  return payments.map((payment, index) => ({
    label: `Q${index + 1} Payment`,
    payment: unwrapMoney(payment.amount)
  }))
}

/**
 * Parse student loan interest (1098-E)
 */
function parseF1098es(studentLoanInterest: MoneyWrapper | undefined): F1098e[] {
  const interest = unwrapMoney(studentLoanInterest)
  if (interest <= 0) return []

  return [
    {
      lender: 'Student Loan Servicer',
      interest
    }
  ]
}

/**
 * Parse HSA information
 */
function parseHSA(data: FactGraphData): HealthSavingsAccount[] {
  const contributions = unwrapMoney(data.hsaContributions)
  if (contributions <= 0) return []

  const coverageType = unwrapString(data.hsaCoverageType)?.toLowerCase()
  const taxYear = unwrapMoney(data.taxYear, 2024)

  return [
    {
      label: 'HSA Account',
      coverageType: coverageType === 'family' ? 'family' : 'self-only',
      contributions,
      personRole: PersonRole.PRIMARY,
      startDate: new Date(taxYear, 0, 1),
      endDate: new Date(taxYear, 11, 31),
      totalDistributions: unwrapMoney(data.hsaDistributions),
      qualifiedDistributions: unwrapMoney(data.hsaDistributions)
    }
  ]
}

// =============================================================================
// Main Export Functions
// =============================================================================

/**
 * Parse an IRS Direct File fact graph JSON into UsTaxes Information format
 *
 * @param factGraphJson - Raw JSON string or parsed object from IRS Direct File
 * @returns Information object compatible with UsTaxes
 */
export function parseFactGraph(
  factGraphJson: string | FactGraphData
): Information {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const data: FactGraphData =
    typeof factGraphJson === 'string'
      ? JSON.parse(factGraphJson)
      : factGraphJson

  const primaryPerson = parsePrimaryPerson(data.primaryFiler)
  const spouse = parseSpouse(data.spouse)
  const dependents = parseDependents(data.dependents)

  const taxPayer: TaxPayer = {
    filingStatus: parseFilingStatus(unwrapString(data.filingStatus)),
    primaryPerson,
    spouse,
    dependents,
    contactEmail: unwrapString(data.primaryFiler?.email),
    contactPhoneNumber: unwrapString(data.primaryFiler?.phone)
  }

  // Combine all 1099 forms
  const f1099s: Supported1099[] = [
    ...parse1099Ints(data.form1099Ints),
    ...parse1099Divs(data.form1099Divs)
  ]

  return {
    f1099s,
    w2s: parseW2s(data.w2s),
    realEstate: [],
    estimatedTaxes: parseEstimatedPayments(data.estimatedPayments),
    f1098es: parseF1098es(data.studentLoanInterest),
    f3921s: [],
    scheduleK1Form1065s: [],
    itemizedDeductions: parseItemizedDeductions(data.itemizedDeductions),
    refund: parseRefund(data.bankAccount),
    taxPayer,
    questions: {
      CRYPTO: unwrapBoolean(data.hasCrypto),
      FOREIGN_ACCOUNT_EXISTS: unwrapBoolean(data.hasForeignAccounts),
      FINCEN_114: false,
      FINCEN_114_ACCOUNT_COUNTRY: unwrapString(data.foreignAccountCountry),
      FOREIGN_TRUST_RELATIONSHIP: false,
      LIVE_APART_FROM_SPOUSE: false
    },
    credits: [],
    stateResidencies: parseStateResidencies(data.stateResidency),
    healthSavingsAccounts: parseHSA(data),
    individualRetirementArrangements: []
  }
}

/**
 * Parse multiple fact graph files into Information objects
 *
 * @param factGraphs - Array of fact graph JSON strings or objects
 * @returns Array of Information objects
 */
export function parseMultipleFactGraphs(
  factGraphs: Array<string | FactGraphData>
): Information[] {
  return factGraphs.map(parseFactGraph)
}

/**
 * Validate that a fact graph has minimum required data
 *
 * @param data - Parsed fact graph data
 * @returns Object with isValid flag and any error messages
 */
export function validateFactGraph(data: FactGraphData): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!data.primaryFiler) {
    errors.push('Missing primary filer information')
  } else {
    if (!data.primaryFiler.firstName?.value) {
      errors.push('Primary filer missing first name')
    }
    if (!data.primaryFiler.lastName?.value) {
      errors.push('Primary filer missing last name')
    }
    if (!data.primaryFiler.ssn?.value && !data.primaryFiler.tin?.value) {
      errors.push('Primary filer missing SSN/TIN')
    }
  }

  if (!data.filingStatus?.value) {
    errors.push('Missing filing status')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// Export types for external use
export type {
  FactGraphData,
  FilerWrapper,
  W2Wrapper,
  Form1099IntWrapper,
  Form1099DivWrapper
}
