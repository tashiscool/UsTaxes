/**
 * ATS Scenario to Information Converter
 *
 * This module provides utilities to convert IRS ATS test scenario data
 * into the Information format used by the UsTaxes calculation engine.
 */

import {
  Information,
  FilingStatus,
  PersonRole,
  IncomeW2,
  Person,
  PrimaryPerson,
  Spouse,
  Dependent,
  TaxPayer,
  Address,
  Supported1099,
  Income1099Type,
  F1099IntData,
  F1099DivData,
  F1099RData,
  F1099BData,
  ItemizedDeductions,
  EstimatedTaxPayments,
  Responses,
  StateResidency,
  State,
  Property,
  Employer,
  HealthSavingsAccount,
  Ira,
  F1098e,
  F3921,
  ScheduleK1Form1065,
  Credit,
  PlanType1099
} from 'ustaxes/core/data'

// =============================================================================
// Types for ATS Scenario Input
// =============================================================================

export interface ATSTaxpayer {
  firstName: string
  lastName: string
  ssn: string
  dateOfBirth?: Date
  occupation?: string
  isBlind?: boolean
  address?: {
    address: string
    city: string
    state: State | string
    zip: string
  }
  foreignAddress?: {
    country: string
    province?: string
    postalCode?: string
  }
}

export interface ATSSpouse extends ATSTaxpayer {
  dateOfDeath?: Date
}

export interface ATSDependent {
  firstName: string
  lastName: string
  ssn: string
  dateOfBirth: Date
  relationship: string
  numberOfMonths?: number
  isStudent?: boolean
}

export interface ATSW2 {
  employer: {
    name: string
    ein: string
    address?: {
      address: string
      city: string
      state: State | string
      zip: string
    }
  }
  wages: number
  federalWithholding: number
  ssWages?: number
  ssTax?: number
  medicareWages?: number
  medicareTax?: number
  stateTax?: number
  stateWages?: number
  state?: State
  occupation?: string
  personRole?: PersonRole.PRIMARY | PersonRole.SPOUSE
  box12?: { code: string; amount: number }[]
}

export interface ATS1099Int {
  payer: string
  income: number
  personRole?: PersonRole.PRIMARY | PersonRole.SPOUSE
}

export interface ATS1099Div {
  payer: string
  dividends: number
  qualifiedDividends?: number
  capitalGainsDistributions?: number
  personRole?: PersonRole.PRIMARY | PersonRole.SPOUSE
}

export interface ATS1099R {
  payer: string
  grossDistribution: number
  taxableAmount: number
  federalWithholding?: number
  planType?: PlanType1099
  personRole?: PersonRole.PRIMARY | PersonRole.SPOUSE
}

export interface ATS1099B {
  payer: string
  shortTermProceeds?: number
  shortTermCostBasis?: number
  longTermProceeds?: number
  longTermCostBasis?: number
  personRole?: PersonRole.PRIMARY | PersonRole.SPOUSE
}

export interface ATSItemizedDeductions {
  medicalAndDental?: number
  stateAndLocalTaxes?: number
  realEstateTaxes?: number
  personalPropertyTaxes?: number
  mortgageInterest?: number
  charityCashCheck?: number
  charityOther?: number
}

export interface ATSScheduleC {
  businessName: string
  principalBusinessCode: string
  grossReceipts: number
  totalExpenses: number
  netProfit: number
}

export interface ATSScheduleE {
  properties: {
    address: string
    rentalIncome: number
    expenses: number
  }[]
}

export interface ATSScenarioInput {
  taxYear: number
  filingStatus: FilingStatus
  taxpayer: ATSTaxpayer
  spouse?: ATSSpouse
  dependents?: ATSDependent[]
  w2s?: ATSW2[]
  f1099Ints?: ATS1099Int[]
  f1099Divs?: ATS1099Div[]
  f1099Rs?: ATS1099R[]
  f1099Bs?: ATS1099B[]
  itemizedDeductions?: ATSItemizedDeductions
  estimatedTaxPayments?: { label: string; payment: number }[]
  questions?: Responses
  scheduleC?: ATSScheduleC
  scheduleE?: ATSScheduleE
  // Credits
  childTaxCreditDependents?: number
  earnedIncomeCredit?: boolean
  // Additional fields
  digitalAssets?: boolean
}

export interface ATSExpectedOutput {
  // Form 1040 lines
  line1Wages?: number
  line2aInterest?: number
  line2bTaxableInterest?: number
  line3aQualifiedDividends?: number
  line3bOrdinaryDividends?: number
  line4aIraDistributions?: number
  line4bTaxableIra?: number
  line7CapitalGain?: number
  line8OtherIncome?: number
  line9TotalIncome?: number
  line10Adjustments?: number
  line11Agi?: number
  line12Deduction?: number
  line15TaxableIncome?: number
  line16Tax?: number
  line18TotalTax?: number
  line22TaxAfterCredits?: number
  line24TotalTax?: number
  line25aWithholding?: number
  line33TotalPayments?: number
  line34Overpaid?: number
  line37AmountOwed?: number
  // Schedule specific
  scheduleCNetProfit?: number
  scheduleSETax?: number
  scheduleAItemized?: number
}

// =============================================================================
// Conversion Functions
// =============================================================================

/**
 * Convert address ensuring State type is correct
 */
function convertAddress(addr?: {
  address: string
  city: string
  state: State | string
  zip: string
}): Address | undefined {
  if (!addr) return undefined
  return {
    address: addr.address,
    city: addr.city,
    state: addr.state as State,
    zip: addr.zip
  }
}

/**
 * Convert ATS taxpayer to PrimaryPerson
 */
function convertPrimaryPerson(taxpayer: ATSTaxpayer): PrimaryPerson<Date> {
  return {
    firstName: taxpayer.firstName,
    lastName: taxpayer.lastName,
    ssid: taxpayer.ssn,
    role: PersonRole.PRIMARY,
    isBlind: taxpayer.isBlind ?? false,
    dateOfBirth: taxpayer.dateOfBirth ?? new Date(1980, 0, 1),
    address: taxpayer.address
      ? convertAddress(taxpayer.address)!
      : {
          address: '123 Test Street',
          city: 'Test City',
          state: 'CA' as State,
          zip: '90210'
        },
    isTaxpayerDependent: false
  }
}

/**
 * Convert ATS spouse to Spouse
 */
function convertSpouse(spouse: ATSSpouse): Spouse<Date> {
  return {
    firstName: spouse.firstName,
    lastName: spouse.lastName,
    ssid: spouse.ssn,
    role: PersonRole.SPOUSE,
    isBlind: spouse.isBlind ?? false,
    dateOfBirth: spouse.dateOfBirth ?? new Date(1980, 0, 1),
    isTaxpayerDependent: false
  }
}

/**
 * Convert ATS dependent to Dependent
 */
function convertDependent(dep: ATSDependent): Dependent<Date> {
  return {
    firstName: dep.firstName,
    lastName: dep.lastName,
    ssid: dep.ssn,
    role: PersonRole.DEPENDENT,
    isBlind: false,
    dateOfBirth: dep.dateOfBirth,
    relationship: dep.relationship,
    qualifyingInfo: {
      numberOfMonths: dep.numberOfMonths ?? 12,
      isStudent: dep.isStudent ?? false
    }
  }
}

/**
 * Convert ATS W-2 to IncomeW2
 */
function convertW2(w2: ATSW2): IncomeW2 {
  return {
    occupation: w2.occupation ?? 'Employee',
    income: w2.wages,
    medicareIncome: w2.medicareWages ?? w2.wages,
    fedWithholding: w2.federalWithholding,
    ssWages: w2.ssWages ?? w2.wages,
    ssWithholding: w2.ssTax ?? Math.round(w2.wages * 0.062),
    medicareWithholding: w2.medicareTax ?? Math.round(w2.wages * 0.0145),
    employer: {
      EIN: w2.employer.ein,
      employerName: w2.employer.name,
      address: convertAddress(w2.employer.address)
    },
    personRole: w2.personRole ?? PersonRole.PRIMARY,
    state: w2.state,
    stateWages: w2.stateWages,
    stateWithholding: w2.stateTax
  }
}

/**
 * Convert ATS 1099-INT to Supported1099
 */
function convert1099Int(f: ATS1099Int): Supported1099 {
  return {
    payer: f.payer,
    type: Income1099Type.INT,
    form: {
      income: f.income
    } as F1099IntData,
    personRole: f.personRole ?? PersonRole.PRIMARY
  }
}

/**
 * Convert ATS 1099-DIV to Supported1099
 */
function convert1099Div(f: ATS1099Div): Supported1099 {
  return {
    payer: f.payer,
    type: Income1099Type.DIV,
    form: {
      dividends: f.dividends,
      qualifiedDividends: f.qualifiedDividends ?? 0,
      totalCapitalGainsDistributions: f.capitalGainsDistributions ?? 0
    } as F1099DivData,
    personRole: f.personRole ?? PersonRole.PRIMARY
  }
}

/**
 * Convert ATS 1099-R to Supported1099
 */
function convert1099R(f: ATS1099R): Supported1099 {
  return {
    payer: f.payer,
    type: Income1099Type.R,
    form: {
      grossDistribution: f.grossDistribution,
      taxableAmount: f.taxableAmount,
      federalIncomeTaxWithheld: f.federalWithholding ?? 0,
      planType: f.planType ?? PlanType1099.IRA
    } as F1099RData,
    personRole: f.personRole ?? PersonRole.PRIMARY
  }
}

/**
 * Convert ATS 1099-B to Supported1099
 */
function convert1099B(f: ATS1099B): Supported1099 {
  return {
    payer: f.payer,
    type: Income1099Type.B,
    form: {
      shortTermProceeds: f.shortTermProceeds ?? 0,
      shortTermCostBasis: f.shortTermCostBasis ?? 0,
      longTermProceeds: f.longTermProceeds ?? 0,
      longTermCostBasis: f.longTermCostBasis ?? 0
    } as F1099BData,
    personRole: f.personRole ?? PersonRole.PRIMARY
  }
}

/**
 * Convert ATS itemized deductions to ItemizedDeductions
 */
function convertItemizedDeductions(
  deductions?: ATSItemizedDeductions
): ItemizedDeductions | undefined {
  if (!deductions) return undefined
  return {
    medicalAndDental: deductions.medicalAndDental ?? 0,
    stateAndLocalTaxes: deductions.stateAndLocalTaxes ?? 0,
    stateAndLocalRealEstateTaxes: deductions.realEstateTaxes ?? 0,
    stateAndLocalPropertyTaxes: deductions.personalPropertyTaxes ?? 0,
    interest8a: deductions.mortgageInterest ?? 0,
    interest8b: 0,
    interest8c: 0,
    interest8d: 0,
    charityCashCheck: deductions.charityCashCheck ?? 0,
    charityOther: deductions.charityOther ?? 0
  }
}

// =============================================================================
// Main Conversion Function
// =============================================================================

/**
 * Convert an ATS scenario input to an Information object
 * that can be passed to create1040()
 */
export function atsScenarioToInformation(
  scenario: ATSScenarioInput
): Information<Date> {
  // Build TaxPayer
  const taxPayer: TaxPayer<Date> = {
    primaryPerson: convertPrimaryPerson(scenario.taxpayer),
    spouse: scenario.spouse ? convertSpouse(scenario.spouse) : undefined,
    dependents: (scenario.dependents ?? []).map(convertDependent),
    filingStatus: scenario.filingStatus
  }

  // Build 1099s array
  const f1099s: Supported1099[] = [
    ...(scenario.f1099Ints ?? []).map(convert1099Int),
    ...(scenario.f1099Divs ?? []).map(convert1099Div),
    ...(scenario.f1099Rs ?? []).map(convert1099R),
    ...(scenario.f1099Bs ?? []).map(convert1099B)
  ]

  // Build state residencies
  const stateResidencies: StateResidency[] = []
  if (scenario.taxpayer.address?.state) {
    stateResidencies.push({
      state: scenario.taxpayer.address.state as State
    })
  }

  // Build IRA distributions from 1099-Rs with IRA plan types
  const iraDistributions = (scenario.f1099Rs ?? [])
    .filter((f) => f.planType === PlanType1099.IRA)
    .map((f) => ({
      payer: f.payer,
      personRole: f.personRole ?? PersonRole.PRIMARY,
      grossDistribution: f.grossDistribution,
      taxableAmount: f.taxableAmount,
      taxableAmountNotDetermined: false,
      totalDistribution: false,
      federalIncomeTaxWithheld: f.federalWithholding ?? 0,
      planType: 0, // Traditional IRA
      contributions: 0,
      rolloverContributions: 0,
      fairMarketValue: 0
    }))

  // Build Information object
  const info: Information<Date> = {
    taxPayer,
    w2s: (scenario.w2s ?? []).map(convertW2),
    f1099s,
    realEstate: [],
    estimatedTaxes: scenario.estimatedTaxPayments ?? [],
    f1098es: [],
    f3921s: [],
    scheduleK1Form1065s: [],
    itemizedDeductions: convertItemizedDeductions(scenario.itemizedDeductions),
    questions: scenario.questions ?? {
      CRYPTO: scenario.digitalAssets ?? false,
      FOREIGN_ACCOUNT_EXISTS: false,
      FINCEN_114: false,
      FINCEN_114_ACCOUNT_COUNTRY: undefined,
      FOREIGN_TRUST_RELATIONSHIP: false,
      LIVE_APART_FROM_SPOUSE: false
    },
    credits: [],
    stateResidencies,
    healthSavingsAccounts: [],
    individualRetirementArrangements: iraDistributions
  }

  // Add Schedule C business data if present
  if (scenario.scheduleC) {
    info.businesses = [
      {
        name: scenario.scheduleC.businessName,
        principalBusinessActivity: scenario.scheduleC.principalBusinessCode,
        grossReceipts: scenario.scheduleC.grossReceipts,
        totalExpenses: scenario.scheduleC.totalExpenses,
        netProfitOrLoss: scenario.scheduleC.netProfit
      }
    ]
  }

  return info
}

// =============================================================================
// Comparison Utilities
// =============================================================================

/**
 * Compare calculated form values against expected ATS values
 */
export function compareResults(
  calculated: {
    l1?: () => number
    l2a?: () => number
    l2b?: () => number
    l3a?: () => number
    l3b?: () => number
    l4a?: () => number
    l4b?: () => number
    l7?: () => number
    l8?: () => number
    l9?: () => number
    l10?: () => number
    l11?: () => number
    l12?: () => number
    l15?: () => number
    l16?: () => number
    l18?: () => number
    l22?: () => number
    l24?: () => number
    l25a?: () => number
    l33?: () => number
    l34?: () => number
    l37?: () => number
  },
  expected: ATSExpectedOutput,
  tolerance = 1
): { passed: boolean; discrepancies: string[] } {
  const discrepancies: string[] = []

  const check = (
    name: string,
    calcFn: (() => number | undefined) | undefined,
    expectedVal: number | undefined
  ) => {
    if (expectedVal === undefined) return
    const calcVal = calcFn?.() ?? 0
    if (Math.abs(calcVal - expectedVal) > tolerance) {
      discrepancies.push(
        `${name}: expected ${expectedVal}, got ${calcVal} (diff: ${calcVal - expectedVal})`
      )
    }
  }

  check('Line 1 (Wages)', calculated.l1, expected.line1Wages)
  check('Line 2a (Interest)', calculated.l2a, expected.line2aInterest)
  check('Line 2b (Taxable Interest)', calculated.l2b, expected.line2bTaxableInterest)
  check('Line 3a (Qualified Dividends)', calculated.l3a, expected.line3aQualifiedDividends)
  check('Line 3b (Ordinary Dividends)', calculated.l3b, expected.line3bOrdinaryDividends)
  check('Line 4a (IRA Distributions)', calculated.l4a, expected.line4aIraDistributions)
  check('Line 4b (Taxable IRA)', calculated.l4b, expected.line4bTaxableIra)
  check('Line 7 (Capital Gain)', calculated.l7, expected.line7CapitalGain)
  check('Line 8 (Other Income)', calculated.l8, expected.line8OtherIncome)
  check('Line 9 (Total Income)', calculated.l9, expected.line9TotalIncome)
  check('Line 10 (Adjustments)', calculated.l10, expected.line10Adjustments)
  check('Line 11 (AGI)', calculated.l11, expected.line11Agi)
  check('Line 12 (Deduction)', calculated.l12, expected.line12Deduction)
  check('Line 15 (Taxable Income)', calculated.l15, expected.line15TaxableIncome)
  check('Line 16 (Tax)', calculated.l16, expected.line16Tax)
  check('Line 18 (Total Tax)', calculated.l18, expected.line18TotalTax)
  check('Line 22 (Tax After Credits)', calculated.l22, expected.line22TaxAfterCredits)
  check('Line 24 (Total Tax)', calculated.l24, expected.line24TotalTax)
  check('Line 25a (Withholding)', calculated.l25a, expected.line25aWithholding)
  check('Line 33 (Total Payments)', calculated.l33, expected.line33TotalPayments)
  check('Line 34 (Overpaid)', calculated.l34, expected.line34Overpaid)
  check('Line 37 (Amount Owed)', calculated.l37, expected.line37AmountOwed)

  return {
    passed: discrepancies.length === 0,
    discrepancies
  }
}
