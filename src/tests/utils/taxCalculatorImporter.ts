/**
 * Tax-Calculator Policy Importer
 *
 * Imports and converts policy parameters from PSLmodels/Tax-Calculator
 * into TypeScript constants for use in UsTaxes calculations and testing.
 *
 * Tax-Calculator (https://github.com/PSLmodels/Tax-Calculator) provides
 * authoritative tax policy parameters for federal income tax calculations.
 *
 * This module:
 * - Parses Tax-Calculator policy_current_law.json format
 * - Extracts parameters for any tax year (2013-2035+)
 * - Converts to UsTaxes-compatible format
 * - Supports all filing statuses
 */

import { FilingStatus } from 'ustaxes/core/data'

// =============================================================================
// Tax-Calculator Policy Types
// =============================================================================

/**
 * Tax-Calculator stores indexed parameters as arrays by filing status
 * Order: [Single, MFJ, MFS, HOH, W]
 */
type IndexedValue = number | number[]

/**
 * Year-indexed parameter value
 * Format: { "2024": value, "2025": value, ... }
 */
type YearIndexedValue = Record<string, IndexedValue>

/**
 * Tax-Calculator policy parameter structure
 */
interface PolicyParameter {
  title?: string
  description?: string
  value_type?: string
  indexed?: boolean
  value?: YearIndexedValue
}

/**
 * Complete Tax-Calculator policy file structure
 */
interface TaxCalculatorPolicy {
  [paramName: string]: PolicyParameter
}

// =============================================================================
// Extracted Policy Parameters
// =============================================================================

/**
 * Tax bracket configuration for a filing status
 */
export interface TaxBrackets {
  rates: number[] // Tax rates (as decimals, e.g., 0.10, 0.12)
  brackets: number[] // Upper bounds for each bracket
}

/**
 * Standard deduction and exemption amounts
 */
export interface DeductionAmounts {
  standardDeduction: number
  personalExemption: number
  additionalStandardDeduction: number // For 65+ or blind
  dependentExemption: number
}

/**
 * EITC parameters
 */
export interface EITCParameters {
  maxCredit: number[] // By number of children (0, 1, 2, 3+)
  phaseInRate: number[] // Phase-in rates
  phaseOutStart: number[] // Phase-out start (Single/HOH)
  phaseOutStartMFJ: number[] // Phase-out start (MFJ)
  phaseOutRate: number[] // Phase-out rates
  maxInvestmentIncome: number
}

/**
 * Child Tax Credit parameters
 */
export interface CTCParameters {
  maxCreditPerChild: number
  maxCreditOtherDependents: number
  phaseOutStart: number // Single/HOH
  phaseOutStartMFJ: number // MFJ
  phaseOutRate: number // $50 per $1000 over threshold
  refundableLimit: number // ACTC limit
  refundableRate: number // ACTC phase-in rate
}

/**
 * AMT parameters
 */
export interface AMTParameters {
  exemptionAmount: number
  phaseOutStart: number
  phaseOutRate: number
  rate1: number // 26%
  rate2: number // 28%
  rate1Threshold: number // Threshold for higher AMT rate
}

/**
 * Capital gains parameters
 */
export interface CapitalGainsParameters {
  rate0Threshold: number // 0% rate threshold
  rate15Threshold: number // 15% rate threshold
  rate20Threshold: number // 20% rate (everything above)
  collectiblesRate: number // 28% for collectibles
  niitRate: number // 3.8% Net Investment Income Tax
  niitThreshold: number
}

/**
 * Social Security parameters
 */
export interface SocialSecurityParameters {
  wageBase: number // Maximum wages subject to SS tax
  taxRate: number // 6.2% employee share
  selfEmploymentRate: number // 12.4% self-employment
}

/**
 * Medicare parameters
 */
export interface MedicareParameters {
  taxRate: number // 1.45% employee share
  additionalTaxRate: number // 0.9% additional Medicare
  additionalTaxThreshold: number // Single threshold
  additionalTaxThresholdMFJ: number // MFJ threshold
}

/**
 * Complete tax parameters for a given year and filing status
 */
export interface TaxParameters {
  year: number
  filingStatus: FilingStatus
  brackets: TaxBrackets
  deductions: DeductionAmounts
  eitc: EITCParameters
  ctc: CTCParameters
  amt: AMTParameters
  capitalGains: CapitalGainsParameters
  socialSecurity: SocialSecurityParameters
  medicare: MedicareParameters
  // Additional limits
  saltCap: number
  qbiDeductionRate: number
  studentLoanInterestMax: number
  iraContributionLimit: number
  roth401kContributionLimit: number
  hsaContributionLimitSingle: number
  hsaContributionLimitFamily: number
}

// =============================================================================
// Filing Status Mapping
// =============================================================================

/**
 * Tax-Calculator filing status index order
 * 0: Single, 1: MFJ, 2: MFS, 3: HOH, 4: Widow(er)
 */
const filingStatusIndex: Record<FilingStatus, number> = {
  [FilingStatus.S]: 0,
  [FilingStatus.MFJ]: 1,
  [FilingStatus.MFS]: 2,
  [FilingStatus.HOH]: 3,
  [FilingStatus.W]: 4
}

/**
 * Get value for a specific filing status from indexed array
 */
function getIndexedValue(
  value: IndexedValue,
  filingStatus: FilingStatus,
  defaultValue = 0
): number {
  if (typeof value === 'number') {
    return value
  }
  if (Array.isArray(value)) {
    const index = filingStatusIndex[filingStatus]
    return value[index] ?? defaultValue
  }
  return defaultValue
}

/**
 * Get parameter value for a specific year
 */
function getYearValue(
  param: PolicyParameter | undefined,
  year: number,
  filingStatus: FilingStatus,
  defaultValue = 0
): number {
  if (!param?.value) return defaultValue

  // Find the applicable year (use most recent year <= requested year)
  const years = Object.keys(param.value)
    .map(Number)
    .sort((a, b) => a - b)
  let applicableYear = years[0]
  for (const y of years) {
    if (y <= year) {
      applicableYear = y
    } else {
      break
    }
  }

  const yearValue = param.value[String(applicableYear)]
  if (yearValue === undefined) return defaultValue

  return getIndexedValue(yearValue, filingStatus, defaultValue)
}

/**
 * Get array value for a specific year (e.g., bracket thresholds)
 */
function getYearArrayValue(
  param: PolicyParameter | undefined,
  year: number,
  defaultValue: number[] = []
): number[] {
  if (!param?.value) return defaultValue

  const years = Object.keys(param.value)
    .map(Number)
    .sort((a, b) => a - b)
  let applicableYear = years[0]
  for (const y of years) {
    if (y <= year) {
      applicableYear = y
    } else {
      break
    }
  }

  const yearValue = param.value[String(applicableYear)]
  if (yearValue === undefined) return defaultValue
  if (Array.isArray(yearValue)) return yearValue 
  return [yearValue ]
}

// =============================================================================
// Parameter Extraction Functions
// =============================================================================

/**
 * Extract tax brackets for a filing status
 */
function extractBrackets(
  policy: TaxCalculatorPolicy,
  year: number,
  filingStatus: FilingStatus
): TaxBrackets {
  // Tax-Calculator parameter names for brackets
  const rateParams = [
    'II_rt1',
    'II_rt2',
    'II_rt3',
    'II_rt4',
    'II_rt5',
    'II_rt6',
    'II_rt7'
  ]
  const bracketParams = [
    'II_brk1',
    'II_brk2',
    'II_brk3',
    'II_brk4',
    'II_brk5',
    'II_brk6'
  ]

  const rates = rateParams
    .map((param) => getYearValue(policy[param], year, filingStatus, 0))
    .filter((r) => r > 0)

  const brackets = bracketParams
    .map((param) => getYearValue(policy[param], year, filingStatus, Infinity))
    .filter((b) => b < Infinity)

  return { rates, brackets }
}

/**
 * Extract standard deduction and exemption amounts
 */
function extractDeductions(
  policy: TaxCalculatorPolicy,
  year: number,
  filingStatus: FilingStatus
): DeductionAmounts {
  return {
    standardDeduction: getYearValue(policy['STD'], year, filingStatus, 0),
    personalExemption: getYearValue(policy['II_em'], year, filingStatus, 0),
    additionalStandardDeduction: getYearValue(
      policy['STD_Aged'],
      year,
      filingStatus,
      0
    ),
    dependentExemption: getYearValue(policy['II_em'], year, filingStatus, 0)
  }
}

/**
 * Extract EITC parameters
 */
function extractEITC(
  policy: TaxCalculatorPolicy,
  year: number,
  filingStatus: FilingStatus
): EITCParameters {
  const isMFJ = filingStatus === FilingStatus.MFJ

  return {
    maxCredit: [
      getYearValue(policy['EITC_c'], year, FilingStatus.S, 0), // 0 children
      getYearValue(policy['EITC_c'], year, FilingStatus.S, 0), // 1 child
      getYearValue(policy['EITC_c'], year, FilingStatus.S, 0), // 2 children
      getYearValue(policy['EITC_c'], year, FilingStatus.S, 0) // 3+ children
    ],
    phaseInRate: getYearArrayValue(
      policy['EITC_prt'],
      year,
      [0.0765, 0.34, 0.4, 0.45]
    ),
    phaseOutStart: getYearArrayValue(
      policy['EITC_ps'],
      year,
      [9800, 21900, 21900, 21900]
    ),
    phaseOutStartMFJ: getYearArrayValue(
      policy['EITC_ps'],
      year,
      [16500, 28500, 28500, 28500]
    ),
    phaseOutRate: getYearArrayValue(
      policy['EITC_prt'],
      year,
      [0.0765, 0.1598, 0.2106, 0.2106]
    ),
    maxInvestmentIncome: getYearValue(
      policy['EITC_InvestIncome_c'],
      year,
      filingStatus,
      11000
    )
  }
}

/**
 * Extract Child Tax Credit parameters
 */
function extractCTC(
  policy: TaxCalculatorPolicy,
  year: number,
  filingStatus: FilingStatus
): CTCParameters {
  const isMFJ = filingStatus === FilingStatus.MFJ

  return {
    maxCreditPerChild: getYearValue(policy['CTC_c'], year, filingStatus, 2000),
    maxCreditOtherDependents: getYearValue(
      policy['ODC_c'],
      year,
      filingStatus,
      500
    ),
    phaseOutStart: getYearValue(policy['CTC_ps'], year, FilingStatus.S, 200000),
    phaseOutStartMFJ: getYearValue(
      policy['CTC_ps'],
      year,
      FilingStatus.MFJ,
      400000
    ),
    phaseOutRate: 0.05, // $50 per $1000
    refundableLimit: getYearValue(policy['ACTC_c'], year, filingStatus, 1600),
    refundableRate: getYearValue(policy['ACTC_rt'], year, filingStatus, 0.15)
  }
}

/**
 * Extract AMT parameters
 */
function extractAMT(
  policy: TaxCalculatorPolicy,
  year: number,
  filingStatus: FilingStatus
): AMTParameters {
  return {
    exemptionAmount: getYearValue(policy['AMT_em'], year, filingStatus, 85000),
    phaseOutStart: getYearValue(policy['AMT_prt'], year, filingStatus, 609000),
    phaseOutRate: 0.25,
    rate1: getYearValue(policy['AMT_rt1'], year, filingStatus, 0.26),
    rate2: getYearValue(policy['AMT_rt2'], year, filingStatus, 0.28),
    rate1Threshold: getYearValue(policy['AMT_brk1'], year, filingStatus, 220700)
  }
}

/**
 * Extract capital gains parameters
 */
function extractCapitalGains(
  policy: TaxCalculatorPolicy,
  year: number,
  filingStatus: FilingStatus
): CapitalGainsParameters {
  return {
    rate0Threshold: getYearValue(policy['CG_brk1'], year, filingStatus, 47025),
    rate15Threshold: getYearValue(
      policy['CG_brk2'],
      year,
      filingStatus,
      518900
    ),
    rate20Threshold: getYearValue(
      policy['CG_brk3'],
      year,
      filingStatus,
      Infinity
    ),
    collectiblesRate: 0.28,
    niitRate: getYearValue(policy['NIIT_rt'], year, filingStatus, 0.038),
    niitThreshold: getYearValue(policy['NIIT_thd'], year, filingStatus, 200000)
  }
}

/**
 * Extract Social Security parameters
 */
function extractSocialSecurity(
  policy: TaxCalculatorPolicy,
  year: number
): SocialSecurityParameters {
  return {
    wageBase: getYearValue(
      policy['SS_Earnings_c'],
      year,
      FilingStatus.S,
      168600
    ),
    taxRate: 0.062, // 6.2%
    selfEmploymentRate: 0.124 // 12.4%
  }
}

/**
 * Extract Medicare parameters
 */
function extractMedicare(
  policy: TaxCalculatorPolicy,
  year: number,
  filingStatus: FilingStatus
): MedicareParameters {
  return {
    taxRate: 0.0145, // 1.45%
    additionalTaxRate: 0.009, // 0.9%
    additionalTaxThreshold: getYearValue(
      policy['AMEDT_thd'],
      year,
      FilingStatus.S,
      200000
    ),
    additionalTaxThresholdMFJ: getYearValue(
      policy['AMEDT_thd'],
      year,
      FilingStatus.MFJ,
      250000
    )
  }
}

// =============================================================================
// Main Export Functions
// =============================================================================

/**
 * Parse Tax-Calculator policy JSON and extract parameters for a given year
 *
 * @param policyJson - Raw JSON string or parsed policy object
 * @param year - Tax year to extract parameters for
 * @param filingStatus - Filing status
 * @returns Complete tax parameters for the year and filing status
 */
export function parseTaxCalculatorPolicy(
  policyJson: string | TaxCalculatorPolicy,
  year: number,
  filingStatus: FilingStatus
): TaxParameters {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const policy: TaxCalculatorPolicy =
    typeof policyJson === 'string' ? JSON.parse(policyJson) : policyJson

  return {
    year,
    filingStatus,
    brackets: extractBrackets(policy, year, filingStatus),
    deductions: extractDeductions(policy, year, filingStatus),
    eitc: extractEITC(policy, year, filingStatus),
    ctc: extractCTC(policy, year, filingStatus),
    amt: extractAMT(policy, year, filingStatus),
    capitalGains: extractCapitalGains(policy, year, filingStatus),
    socialSecurity: extractSocialSecurity(policy, year),
    medicare: extractMedicare(policy, year, filingStatus),
    saltCap: getYearValue(
      policy['ID_StateLocalTax_hc'],
      year,
      filingStatus,
      10000
    ),
    qbiDeductionRate: getYearValue(
      policy['PT_qbid_rt'],
      year,
      filingStatus,
      0.2
    ),
    studentLoanInterestMax: getYearValue(
      policy['ID_Charity_crt_all'],
      year,
      filingStatus,
      2500
    ),
    iraContributionLimit: 7000, // Not typically in Tax-Calculator
    roth401kContributionLimit: 23000, // Not typically in Tax-Calculator
    hsaContributionLimitSingle: 4150, // Not typically in Tax-Calculator
    hsaContributionLimitFamily: 8300 // Not typically in Tax-Calculator
  }
}

/**
 * Get tax brackets for all filing statuses for a given year
 *
 * @param policyJson - Raw JSON string or parsed policy object
 * @param year - Tax year
 * @returns Map of filing status to tax brackets
 */
export function getAllBrackets(
  policyJson: string | TaxCalculatorPolicy,
  year: number
): Record<FilingStatus, TaxBrackets> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const policy: TaxCalculatorPolicy =
    typeof policyJson === 'string' ? JSON.parse(policyJson) : policyJson

  return {
    [FilingStatus.S]: extractBrackets(policy, year, FilingStatus.S),
    [FilingStatus.MFJ]: extractBrackets(policy, year, FilingStatus.MFJ),
    [FilingStatus.MFS]: extractBrackets(policy, year, FilingStatus.MFS),
    [FilingStatus.HOH]: extractBrackets(policy, year, FilingStatus.HOH),
    [FilingStatus.W]: extractBrackets(policy, year, FilingStatus.W)
  }
}

/**
 * Generate TypeScript constants from Tax-Calculator policy
 *
 * @param policyJson - Raw JSON string or parsed policy object
 * @param year - Tax year
 * @returns TypeScript code string with tax parameter constants
 */
export function generateTypeScriptConstants(
  policyJson: string | TaxCalculatorPolicy,
  year: number
): string {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const policy: TaxCalculatorPolicy =
    typeof policyJson === 'string' ? JSON.parse(policyJson) : policyJson

  const params: Record<FilingStatus, TaxParameters> = {
    [FilingStatus.S]: parseTaxCalculatorPolicy(policy, year, FilingStatus.S),
    [FilingStatus.MFJ]: parseTaxCalculatorPolicy(
      policy,
      year,
      FilingStatus.MFJ
    ),
    [FilingStatus.MFS]: parseTaxCalculatorPolicy(
      policy,
      year,
      FilingStatus.MFS
    ),
    [FilingStatus.HOH]: parseTaxCalculatorPolicy(
      policy,
      year,
      FilingStatus.HOH
    ),
    [FilingStatus.W]: parseTaxCalculatorPolicy(policy, year, FilingStatus.W)
  }

  return `/**
 * Tax Parameters for ${year}
 * Generated from Tax-Calculator policy
 */

import { FilingStatus } from 'ustaxes/core/data'

export const TAX_YEAR = ${year}

export const taxBrackets = {
  rates: [${params[FilingStatus.S].brackets.rates.join(', ')}],
  status: {
    [FilingStatus.S]: { brackets: [${params[
      FilingStatus.S
    ].brackets.brackets.join(', ')}] },
    [FilingStatus.MFJ]: { brackets: [${params[
      FilingStatus.MFJ
    ].brackets.brackets.join(', ')}] },
    [FilingStatus.MFS]: { brackets: [${params[
      FilingStatus.MFS
    ].brackets.brackets.join(', ')}] },
    [FilingStatus.HOH]: { brackets: [${params[
      FilingStatus.HOH
    ].brackets.brackets.join(', ')}] },
    [FilingStatus.W]: { brackets: [${params[
      FilingStatus.W
    ].brackets.brackets.join(', ')}] }
  }
}

export const standardDeduction = {
  [FilingStatus.S]: ${params[FilingStatus.S].deductions.standardDeduction},
  [FilingStatus.MFJ]: ${params[FilingStatus.MFJ].deductions.standardDeduction},
  [FilingStatus.MFS]: ${params[FilingStatus.MFS].deductions.standardDeduction},
  [FilingStatus.HOH]: ${params[FilingStatus.HOH].deductions.standardDeduction},
  [FilingStatus.W]: ${params[FilingStatus.W].deductions.standardDeduction}
}

export const socialSecurity = {
  wageBase: ${params[FilingStatus.S].socialSecurity.wageBase},
  taxRate: ${params[FilingStatus.S].socialSecurity.taxRate}
}

export const capitalGainsBrackets = {
  [FilingStatus.S]: {
    rate0Threshold: ${params[FilingStatus.S].capitalGains.rate0Threshold},
    rate15Threshold: ${params[FilingStatus.S].capitalGains.rate15Threshold}
  },
  [FilingStatus.MFJ]: {
    rate0Threshold: ${params[FilingStatus.MFJ].capitalGains.rate0Threshold},
    rate15Threshold: ${params[FilingStatus.MFJ].capitalGains.rate15Threshold}
  },
  [FilingStatus.MFS]: {
    rate0Threshold: ${params[FilingStatus.MFS].capitalGains.rate0Threshold},
    rate15Threshold: ${params[FilingStatus.MFS].capitalGains.rate15Threshold}
  },
  [FilingStatus.HOH]: {
    rate0Threshold: ${params[FilingStatus.HOH].capitalGains.rate0Threshold},
    rate15Threshold: ${params[FilingStatus.HOH].capitalGains.rate15Threshold}
  },
  [FilingStatus.W]: {
    rate0Threshold: ${params[FilingStatus.W].capitalGains.rate0Threshold},
    rate15Threshold: ${params[FilingStatus.W].capitalGains.rate15Threshold}
  }
}

export const childTaxCredit = {
  maxCreditPerChild: ${params[FilingStatus.S].ctc.maxCreditPerChild},
  phaseOutStart: {
    [FilingStatus.S]: ${params[FilingStatus.S].ctc.phaseOutStart},
    [FilingStatus.MFJ]: ${params[FilingStatus.MFJ].ctc.phaseOutStartMFJ},
    [FilingStatus.MFS]: ${params[FilingStatus.MFS].ctc.phaseOutStart},
    [FilingStatus.HOH]: ${params[FilingStatus.HOH].ctc.phaseOutStart},
    [FilingStatus.W]: ${params[FilingStatus.W].ctc.phaseOutStart}
  }
}

export const amt = {
  exemption: {
    [FilingStatus.S]: ${params[FilingStatus.S].amt.exemptionAmount},
    [FilingStatus.MFJ]: ${params[FilingStatus.MFJ].amt.exemptionAmount},
    [FilingStatus.MFS]: ${params[FilingStatus.MFS].amt.exemptionAmount},
    [FilingStatus.HOH]: ${params[FilingStatus.HOH].amt.exemptionAmount},
    [FilingStatus.W]: ${params[FilingStatus.W].amt.exemptionAmount}
  },
  phaseOutStart: {
    [FilingStatus.S]: ${params[FilingStatus.S].amt.phaseOutStart},
    [FilingStatus.MFJ]: ${params[FilingStatus.MFJ].amt.phaseOutStart},
    [FilingStatus.MFS]: ${params[FilingStatus.MFS].amt.phaseOutStart},
    [FilingStatus.HOH]: ${params[FilingStatus.HOH].amt.phaseOutStart},
    [FilingStatus.W]: ${params[FilingStatus.W].amt.phaseOutStart}
  }
}
`
}

/**
 * List available years in a Tax-Calculator policy file
 *
 * @param policyJson - Raw JSON string or parsed policy object
 * @returns Array of available years
 */
export function getAvailableYears(
  policyJson: string | TaxCalculatorPolicy
): number[] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const policy: TaxCalculatorPolicy =
    typeof policyJson === 'string' ? JSON.parse(policyJson) : policyJson

  const years = new Set<number>()

  for (const param of Object.values(policy)) {
    if (param.value) {
      for (const year of Object.keys(param.value)) {
        years.add(Number(year))
      }
    }
  }

  return Array.from(years).sort((a, b) => a - b)
}

/**
 * Compare parameters between two years
 *
 * @param policyJson - Raw JSON string or parsed policy object
 * @param year1 - First year
 * @param year2 - Second year
 * @param filingStatus - Filing status
 * @returns Object showing differences
 */
export function compareYears(
  policyJson: string | TaxCalculatorPolicy,
  year1: number,
  year2: number,
  filingStatus: FilingStatus
): Record<
  string,
  { year1: number; year2: number; change: number; percentChange: string }
> {
  const params1 = parseTaxCalculatorPolicy(policyJson, year1, filingStatus)
  const params2 = parseTaxCalculatorPolicy(policyJson, year2, filingStatus)

  const differences: Record<
    string,
    { year1: number; year2: number; change: number; percentChange: string }
  > = {}

  // Compare key numeric values
  const comparisons: Array<[string, number, number]> = [
    [
      'standardDeduction',
      params1.deductions.standardDeduction,
      params2.deductions.standardDeduction
    ],
    [
      'ssWageBase',
      params1.socialSecurity.wageBase,
      params2.socialSecurity.wageBase
    ],
    ['amtExemption', params1.amt.exemptionAmount, params2.amt.exemptionAmount],
    ['ctcMax', params1.ctc.maxCreditPerChild, params2.ctc.maxCreditPerChild],
    [
      'capitalGains0%Threshold',
      params1.capitalGains.rate0Threshold,
      params2.capitalGains.rate0Threshold
    ]
  ]

  for (const [name, val1, val2] of comparisons) {
    if (val1 !== val2) {
      const change = val2 - val1
      const percentChange =
        val1 !== 0 ? ((change / val1) * 100).toFixed(2) + '%' : 'N/A'
      differences[name] = { year1: val1, year2: val2, change, percentChange }
    }
  }

  return differences
}

// Export types
export type {
  TaxCalculatorPolicy,
  PolicyParameter,
  YearIndexedValue,
  IndexedValue
}
