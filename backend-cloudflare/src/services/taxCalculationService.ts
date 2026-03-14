/**
 * Tax Calculation Service
 *
 * Bridges the taxflow backend facts (screen-centric flat records) to the
 * UsTaxes tax engine (strongly-typed Information interface), runs the
 * engine, and returns computed tax results.
 *
 * All federal tax math rules (standard deduction, brackets, CTC, SALT cap,
 * QBID, AMT, NIIT, etc.) are honored wholly via create1040() and the form
 * implementations in UsTaxes/src/forms/Y2025/. The single source of truth
 * for rule documentation is docs/MATH_RULES_INDEX.md; parameters live in
 * UsTaxes/src/forms/Y2025/data/federal.ts. Keep both in sync when law changes.
 */

import {
  type Information,
  type IncomeW2,
  type Supported1099,
  type Dependent,
  type Spouse,
  type PrimaryPerson,
  type Address,
  type Refund,
  type EstimatedTaxPayments,
  type ScheduleK1Form1065,
  type Property,
  type ItemizedDeductions,
  type HealthSavingsAccount,
  type Ira,
  type F1098e,
  type F3921,
  type Credit,
  type StateResidency,
  type OvertimeIncome,
  type TipIncome,
  type AutoLoanInterest,
  type TrumpSavingsAccount,
  type QbiDeductionData,
  type DependentCareProvider,
  type EducationExpense,
  type EnergyImprovement,
  type Asset,
  type F1099IntData,
  type F1099DivData,
  type F1099BData,
  type F1099RData,
  type F1099SSAData,
  type F1099NECData,
  type F1099MISCData,
  type F1099GData,
  type Form1120Data,
  type Form1120SData,
  type Form1065Data,
  type ScheduleKItems,
  type SCorpShareholder,
  type PartnerInfo,
  type State,
  FilingStatus,
  PersonRole,
  Income1099Type,
  PlanType1099,
  AccountType
} from 'ustaxes/core/data'
import { create1040 } from 'ustaxes/forms/Y2025/irsForms/Main'
import { isLeft, isRight } from 'ustaxes/core/util'
import type F1040 from 'ustaxes/forms/Y2025/irsForms/F1040'
import type Form from 'ustaxes/core/irsForms/Form'
import { createStateReturn } from 'ustaxes/forms/Y2025/stateForms'
import F1120 from 'ustaxes/forms/Y2025/irsForms/F1120'
import F1120S from 'ustaxes/forms/Y2025/irsForms/F1120S'
import F1065 from 'ustaxes/forms/Y2025/irsForms/F1065'
import type { Form1041Info } from 'ustaxes/forms/Y2025/irsForms/F1041'

// ─── Result types ────────────────────────────────────────────────────────────

export interface TaxCalculationResult {
  success: true
  taxYear: number
  filingStatus: string
  agi: number
  taxableIncome: number
  totalTax: number
  totalPayments: number
  refund: number
  amountOwed: number
  effectiveTaxRate: number
  marginalTaxRate: number
  schedules: string[]
}

export interface TaxCalculationError {
  success: false
  errors: string[]
}

export type TaxCalcOutcome = TaxCalculationResult | TaxCalculationError

export interface BusinessEntityResult {
  success: true
  taxYear: number
  formType: string
  entityName: string
  totalIncome: number
  totalDeductions: number
  taxableIncome: number
  totalTax: number
  totalPayments: number
  amountOwed: number
  overpayment: number
  effectiveTaxRate: number
  /** For pass-through entities: per-owner allocation breakdown */
  ownerAllocations?: OwnerAllocation[]
  schedules: string[]
}

export interface OwnerAllocation {
  name: string
  ownershipPct: number
  ordinaryIncome: number
  netRentalIncome: number
  interestIncome: number
  dividendIncome: number
  capitalGains: number
  otherIncome: number
  section179Deduction: number
  otherDeductions: number
  selfEmploymentEarnings: number
}

export type BusinessCalcOutcome = BusinessEntityResult | TaxCalculationError

export interface StateCalculationResult {
  state: string
  stateName: string
  stateTax: number
  stateRefund: number
  stateAmountOwed: number
  stateWithholding: number
  stateTaxableIncome: number
  effectiveStateRate: number
}

export interface TaxCalcWithStateResult extends TaxCalculationResult {
  stateResults?: StateCalculationResult[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const toNum = (v: unknown): number => {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[,$]/g, ''))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

const toStr = (v: unknown): string => (v == null ? '' : String(v))

const toDate = (v: unknown): Date => {
  if (v instanceof Date) return v
  if (typeof v === 'string' && v) {
    const d = new Date(v)
    if (!isNaN(d.getTime())) return d
  }
  return new Date('2000-01-01')
}

const toBool = (v: unknown): boolean => Boolean(v)

const asRecord = (v: unknown): Record<string, unknown> =>
  v != null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}

const asArray = <T = unknown>(v: unknown): T[] =>
  Array.isArray(v) ? (v as T[]) : []

// ─── Filing status mapping ───────────────────────────────────────────────────

const mapFilingStatus = (status: string): FilingStatus => {
  const normalized = toStr(status).toLowerCase().trim()
  const map: Record<string, FilingStatus> = {
    single: FilingStatus.S,
    s: FilingStatus.S,
    mfj: FilingStatus.MFJ,
    'married filing jointly': FilingStatus.MFJ,
    married_filing_jointly: FilingStatus.MFJ,
    mfs: FilingStatus.MFS,
    'married filing separately': FilingStatus.MFS,
    married_filing_separately: FilingStatus.MFS,
    hoh: FilingStatus.HOH,
    'head of household': FilingStatus.HOH,
    head_of_household: FilingStatus.HOH,
    w: FilingStatus.W,
    widow: FilingStatus.W,
    'qualifying widow(er)': FilingStatus.W,
    qualifying_surviving_spouse: FilingStatus.W
  }
  return map[normalized] ?? FilingStatus.S
}

// ─── Facts → Information adapter ─────────────────────────────────────────────

type FactsRecord = Record<string, unknown>

const adaptW2s = (facts: FactsRecord): IncomeW2[] => {
  const records = asArray<Record<string, unknown>>(facts.w2Records)
  return records.map((r) => ({
    occupation: toStr(r.employerName),
    income: toNum(r.box1Wages),
    medicareIncome: toNum(r.box1Wages), // Typically same as box 1 unless specified
    fedWithholding: toNum(r.box2FederalWithheld),
    ssWages: toNum(r.box1Wages), // Box 3, defaulting to box 1
    ssWithholding: 0,
    medicareWithholding: 0,
    employer: r.ein
      ? { EIN: toStr(r.ein), employerName: toStr(r.employerName) }
      : undefined,
    personRole:
      toStr(r.owner) === 'spouse' ? PersonRole.SPOUSE : PersonRole.PRIMARY,
    state: undefined,
    stateWages: toNum(r.stateWages) || undefined,
    stateWithholding: toNum(r.stateWithheld) || undefined
  }))
}

const adapt1099s = (facts: FactsRecord): Supported1099[] => {
  const records = asArray<Record<string, unknown>>(facts.form1099Records)
  return records.flatMap((r): Supported1099[] => {
    const type = toStr(r.type).toUpperCase().replace('-', '')
    const payer = toStr(r.payer)
    const amount = toNum(r.amount)
    const personRole = PersonRole.PRIMARY

    switch (type) {
      case 'INT':
      case '1099INT':
        return [
          {
            payer,
            type: Income1099Type.INT,
            form: { income: amount } as F1099IntData,
            personRole
          }
        ]
      case 'DIV':
      case '1099DIV':
        return [
          {
            payer,
            type: Income1099Type.DIV,
            form: {
              dividends: amount,
              qualifiedDividends: 0,
              totalCapitalGainsDistributions: 0
            } as F1099DivData,
            personRole
          }
        ]
      case 'B':
      case '1099B':
        return [
          {
            payer,
            type: Income1099Type.B,
            form: {
              shortTermProceeds: 0,
              shortTermCostBasis: 0,
              longTermProceeds: amount,
              longTermCostBasis: 0
            } as F1099BData,
            personRole
          }
        ]
      case 'R':
      case '1099R':
        return [
          {
            payer,
            type: Income1099Type.R,
            form: {
              grossDistribution: amount,
              taxableAmount: amount,
              federalIncomeTaxWithheld: toNum(r.federalWithheld),
              planType: PlanType1099.IRA
            } as F1099RData,
            personRole
          }
        ]
      case 'SSA':
      case '1099SSA':
        return [
          {
            payer,
            type: Income1099Type.SSA,
            form: {
              netBenefits: amount,
              federalIncomeTaxWithheld: toNum(r.federalWithheld)
            } as F1099SSAData,
            personRole
          }
        ]
      case 'NEC':
      case '1099NEC':
        return [
          {
            payer,
            type: Income1099Type.NEC,
            form: {
              nonemployeeCompensation: amount,
              federalIncomeTaxWithheld: toNum(r.federalWithheld)
            } as F1099NECData,
            personRole
          }
        ]
      case 'MISC':
      case '1099MISC':
        return [
          {
            payer,
            type: Income1099Type.MISC,
            form: {
              otherIncome: amount,
              federalIncomeTaxWithheld: toNum(r.federalWithheld)
            } as F1099MISCData,
            personRole
          }
        ]
      case 'G':
      case '1099G':
        return [
          {
            payer,
            type: Income1099Type.G,
            form: {
              unemploymentCompensation: amount,
              federalIncomeTaxWithheld: toNum(r.federalWithheld)
            } as F1099GData,
            personRole
          }
        ]
      default:
        // Unrecognized 1099 type — treat as INT (interest)
        if (amount > 0) {
          return [
            {
              payer,
              type: Income1099Type.INT,
              form: { income: amount } as F1099IntData,
              personRole
            }
          ]
        }
        return []
    }
  })
}

const adaptDependents = (facts: FactsRecord): Dependent[] => {
  const records = asArray<Record<string, unknown>>(facts.dependents)
  return records.map((r) => {
    const name = toStr(r.name).split(' ')
    return {
      firstName: name[0] || 'Dependent',
      lastName: name.slice(1).join(' ') || '',
      ssid: toStr(r.ssn).replace(/\D/g, ''),
      role: PersonRole.DEPENDENT,
      isBlind: false,
      dateOfBirth: toDate(r.dob),
      relationship: toStr(r.relationship) || 'child',
      qualifyingInfo: {
        numberOfMonths: toNum(r.months) || 12,
        isStudent: false
      }
    }
  })
}

const adaptSpouse = (
  facts: FactsRecord,
  filingStatus: FilingStatus
): Spouse | undefined => {
  const spouseData = asRecord(facts.spouse)
  if (
    !spouseData.firstName &&
    filingStatus !== FilingStatus.MFJ &&
    filingStatus !== FilingStatus.MFS
  ) {
    return undefined
  }
  return {
    firstName: toStr(spouseData.firstName) || 'Spouse',
    lastName: toStr(spouseData.lastName) || '',
    ssid: toStr(spouseData.ssn).replace(/\D/g, ''),
    role: PersonRole.SPOUSE,
    isBlind: false,
    dateOfBirth: toDate(spouseData.dob),
    isTaxpayerDependent: false
  }
}

const adaptPrimaryPerson = (facts: FactsRecord): PrimaryPerson => {
  // Try to extract from facts directly. The primary person info might
  // be embedded in the taxpayer screen data or in the facts root.
  const address: Address = {
    address: '',
    city: '',
    state: undefined,
    zip: ''
  }

  // Extract TIN and use for SSN
  const primaryTin = toStr(facts.primaryTIN).replace(/\D/g, '')

  // Use actual DOB from taxpayer profile for senior standard deduction calc
  const dob = toDate(facts.primaryDob)

  return {
    firstName: toStr(facts.primaryFirstName) || 'Taxpayer',
    lastName: toStr(facts.primaryLastName) || '',
    ssid: primaryTin,
    role: PersonRole.PRIMARY,
    isBlind: false,
    dateOfBirth: dob,
    address,
    isTaxpayerDependent: false
  }
}

const adaptAddress = (facts: FactsRecord): Address => {
  const addrWrapper = asRecord(facts['/address'])
  const item = asRecord(addrWrapper.item)
  return {
    address: toStr(item.streetAddress),
    city: toStr(item.city),
    state: undefined, // State enum mapping would go here
    zip: toStr(item.postalCode)
  }
}

// ─── State residency mapping ─────────────────────────────────────────────────

const US_STATE_CODES: Set<string> = new Set([
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
])

const mapStateCode = (code: string): State | undefined => {
  const upper = code.toUpperCase().trim()
  // Handle full state names for common states
  const nameMap: Record<string, string> = {
    california: 'CA',
    'new york': 'NY',
    texas: 'TX',
    florida: 'FL',
    illinois: 'IL',
    massachusetts: 'MA',
    virginia: 'VA',
    'new jersey': 'NJ',
    pennsylvania: 'PA',
    ohio: 'OH',
    georgia: 'GA',
    'north carolina': 'NC',
    michigan: 'MI',
    washington: 'WA',
    arizona: 'AZ',
    colorado: 'CO',
    maryland: 'MD',
    minnesota: 'MN',
    connecticut: 'CT',
    oregon: 'OR',
    indiana: 'IN'
  }
  const mapped = nameMap[code.toLowerCase().trim()] ?? upper
  return US_STATE_CODES.has(mapped) ? (mapped as State) : undefined
}

const adaptStateResidencies = (facts: FactsRecord): StateResidency[] => {
  const residencies: StateResidency[] = []

  // Try facts.filerResidenceAndIncomeState (Direct File format)
  const stateWrapper = asRecord(facts['/filerResidenceAndIncomeState'])
  const stateItem = asRecord(stateWrapper.item)
  const stateValues = asArray<string>(stateItem.value)
  if (stateValues.length > 0) {
    const state = mapStateCode(stateValues[0])
    if (state) residencies.push({ state })
  }

  // Fallback: try facts.residenceState or facts.state
  if (residencies.length === 0) {
    const stateStr = toStr(
      facts.residenceState || facts.state || facts.filerState
    )
    if (stateStr) {
      const state = mapStateCode(stateStr)
      if (state) residencies.push({ state })
    }
  }

  // Fallback: try address state
  if (residencies.length === 0) {
    const addrWrapper = asRecord(facts['/address'])
    const addrItem = asRecord(addrWrapper.item)
    const addrState = toStr(addrItem.stateOrProvence)
    if (addrState) {
      const state = mapStateCode(addrState)
      if (state) residencies.push({ state })
    }
  }

  return residencies
}

// ─── Main adapter ────────────────────────────────────────────────────────────

export const adaptFactsToInformation = (facts: FactsRecord): Information => {
  const filingStatus = mapFilingStatus(toStr(facts.filingStatus))
  const dependents = adaptDependents(facts)
  const spouse = adaptSpouse(facts, filingStatus)
  const primaryPerson = adaptPrimaryPerson(facts)
  primaryPerson.address = adaptAddress(facts)

  // Adapt SSA records into 1099-SSA entries
  const ssaRecords = asArray<Record<string, unknown>>(
    facts.socialSecurityRecords
  )
  const ssa1099s: Supported1099[] = ssaRecords
    .filter((r) => toNum(r.grossAmount) > 0)
    .map((r) => ({
      payer: 'Social Security Administration',
      type: Income1099Type.SSA as const,
      form: {
        netBenefits: toNum(r.grossAmount),
        federalIncomeTaxWithheld: toNum(r.federalWithheld)
      } as F1099SSAData,
      personRole: PersonRole.PRIMARY as const
    }))

  // Merge all 1099s
  const all1099s = [...adapt1099s(facts), ...ssa1099s]

  // Adapt OBBBA fields
  const overtimeIncome: OvertimeIncome | undefined = (() => {
    const data = asRecord(facts.overtimeIncome)
    if (data.amount || data.overtimeAmount) {
      return {
        amount: toNum(data.amount ?? data.overtimeAmount),
        employerName: toStr(data.employerName)
      }
    }
    return undefined
  })()

  const tipIncome: TipIncome | undefined = (() => {
    const data = asRecord(facts.tipIncome)
    if (data.amount || data.tipAmount) {
      return {
        amount: toNum(data.amount ?? data.tipAmount),
        employerName: toStr(data.employerName)
      }
    }
    return undefined
  })()

  const autoLoanInterest: AutoLoanInterest | undefined = (() => {
    const data = asRecord(facts.autoLoanInterest)
    if (data.amount || data.interestPaid) {
      return {
        amount: toNum(data.amount ?? data.interestPaid),
        domesticManufacture: toBool(
          data.domesticManufacture ?? data.usManufactured ?? true
        ),
        lenderName: toStr(data.lenderName),
        vehicleMake: toStr(data.vehicleMake),
        vehicleModel: toStr(data.vehicleModel),
        vehicleYear: toNum(data.vehicleYear) || undefined
      }
    }
    return undefined
  })()

  const trumpSavingsAccounts: TrumpSavingsAccount[] | undefined = (() => {
    const accounts = asArray<Record<string, unknown>>(
      facts.trumpSavingsAccounts
    )
    if (accounts.length === 0) return undefined
    return accounts.map((a) => ({
      beneficiaryName: toStr(a.beneficiaryName),
      beneficiarySSN: toStr(a.beneficiarySSN ?? a.beneficiarySsn).replace(
        /\D/g,
        ''
      ),
      beneficiaryDateOfBirth: toDate(
        a.beneficiaryDateOfBirth ?? a.beneficiaryDob
      ),
      beneficiaryIsCitizen: toBool(a.beneficiaryIsCitizen ?? true),
      contributionAmount: toNum(
        a.contributionAmount ?? a.annualContribution ?? a.contribution
      ),
      governmentContribution: toNum(a.governmentContribution),
      fairMarketValue:
        toNum(a.fairMarketValue ?? a.accountBalance) || undefined,
      accountNumber: toStr(a.accountNumber) || undefined,
      custodianName: toStr(a.custodianName) || undefined,
      custodianEIN: toStr(a.custodianEIN) || undefined
    }))
  })()

  // Adapt credit summary
  const creditSummary = asRecord(facts.creditSummary)
  const credits: Credit[] = []
  // Credits are handled by the form system based on the data provided

  // Adapt QBI data
  const qbiData = asRecord(facts.qbiWorksheetEntities)
  const qbiDeductionData: QbiDeductionData | undefined =
    qbiData && Object.keys(qbiData).length > 0
      ? (qbiData as unknown as QbiDeductionData)
      : undefined

  // Build the Information object
  const info: Information = {
    f1099s: all1099s,
    w2s: adaptW2s(facts),
    realEstate: [], // Rental properties handled separately
    estimatedTaxes: [],
    f1098es: [],
    f3921s: [],
    scheduleK1Form1065s: [],
    itemizedDeductions: undefined,
    taxPayer: {
      filingStatus,
      primaryPerson,
      spouse,
      dependents
    },
    questions: {},
    credits,
    stateResidencies: adaptStateResidencies(facts),
    healthSavingsAccounts: [],
    individualRetirementArrangements: [],
    // OBBBA fields
    overtimeIncome,
    tipIncome,
    autoLoanInterest,
    trumpSavingsAccounts,
    // QBI
    qbiDeductionData
  }

  return info
}

// ─── Business entity fact adapters ──────────────────────────────────────────

const BUSINESS_FORM_TYPES = new Set(['1120', '1120-S', '1065', '1041', '990'])

export const isBusinessFormType = (formType: string): boolean =>
  BUSINESS_FORM_TYPES.has(formType)

const defaultBusinessEntity = (facts: FactsRecord) => ({
  entityName: toStr(facts.entityName) || 'Business Entity',
  ein: toStr(facts.ein).replace(/\D/g, ''),
  entityType: toStr(facts.entityType) || 'C-Corporation',
  dateIncorporated: toDate(facts.dateIncorporated),
  stateOfIncorporation: undefined,
  address: {
    address: toStr(facts.streetAddress),
    city: toStr(facts.city),
    state: undefined,
    zip: toStr(facts.zip)
  },
  principalBusinessActivity: toStr(facts.naicsCode) || '999999',
  principalProductOrService: toStr(facts.productOrService) || 'Services',
  accountingMethod:
    (toStr(facts.accountingMethod) as 'cash' | 'accrual' | 'other') || 'cash',
  taxYear: toNum(facts.taxYear) || 2025,
  isFiscalYear: toBool(facts.isFiscalYear),
  fiscalYearEnd: toStr(facts.fiscalYearEnd) || undefined,
  totalAssets: toNum(facts.totalAssets),
  numberOfEmployees: toNum(facts.numberOfEmployees) || undefined
})

const adaptFactsToForm1120Data = (facts: FactsRecord): Form1120Data => {
  const income = asRecord(facts.income)
  const deductions = asRecord(facts.deductions)
  const specialDeductions = asRecord(facts.specialDeductions)

  return {
    entity: defaultBusinessEntity(facts) as Form1120Data['entity'],
    income: {
      grossReceiptsOrSales: toNum(
        income.grossReceiptsOrSales ?? facts.grossReceipts
      ),
      returnsAndAllowances: toNum(income.returnsAndAllowances),
      costOfGoodsSold: toNum(income.costOfGoodsSold ?? facts.costOfGoodsSold),
      dividendIncome: toNum(income.dividendIncome),
      interestIncome: toNum(income.interestIncome),
      grossRents: toNum(income.grossRents),
      grossRoyalties: toNum(income.grossRoyalties),
      capitalGainNetIncome: toNum(income.capitalGainNetIncome),
      netGainFromSaleOfAssets: toNum(income.netGainFromSaleOfAssets),
      otherIncome: toNum(income.otherIncome)
    },
    deductions: {
      compensationOfOfficers: toNum(deductions.compensationOfOfficers),
      salariesAndWages: toNum(deductions.salariesAndWages),
      repairsAndMaintenance: toNum(deductions.repairsAndMaintenance),
      badDebts: toNum(deductions.badDebts),
      rents: toNum(deductions.rents),
      taxesAndLicenses: toNum(deductions.taxesAndLicenses),
      interest: toNum(deductions.interest),
      charitableContributions: toNum(deductions.charitableContributions),
      depreciation: toNum(deductions.depreciation),
      depletion: toNum(deductions.depletion),
      advertising: toNum(deductions.advertising),
      pensionPlans: toNum(deductions.pensionPlans),
      employeeBenefits: toNum(deductions.employeeBenefits),
      domesticProductionDeduction: toNum(
        deductions.domesticProductionDeduction
      ),
      otherDeductions: toNum(deductions.otherDeductions)
    },
    specialDeductions: {
      dividendsReceivedDeduction: toNum(
        specialDeductions.dividendsReceivedDeduction
      ),
      dividendsFromAffiliated: toNum(specialDeductions.dividendsFromAffiliated),
      dividendsOnDebtFinancedStock: toNum(
        specialDeductions.dividendsOnDebtFinancedStock
      ),
      dividendsOnCertainPreferred: toNum(
        specialDeductions.dividendsOnCertainPreferred
      ),
      foreignDividends: toNum(specialDeductions.foreignDividends),
      nol: toNum(specialDeductions.nol)
    },
    taxableIncome: 0, // Computed by the form
    taxBeforeCredits: 0, // Computed by the form
    foreignTaxCredit: toNum(facts.foreignTaxCredit),
    generalBusinessCredits: undefined,
    priorYearMinimumTax: toNum(facts.priorYearMinimumTax),
    estimatedTaxPayments: toNum(facts.estimatedTaxPayments),
    extensionPayment: toNum(facts.extensionPayment),
    priorYearOverpayment: toNum(facts.priorYearOverpayment),
    accumulatedEarnings: toNum(facts.accumulatedEarnings),
    personalHoldingCompanyTax: toNum(facts.personalHoldingCompanyTax)
  }
}

const defaultScheduleK = (facts: FactsRecord): ScheduleKItems => {
  const k = asRecord(facts.scheduleK)
  return {
    ordinaryBusinessIncome: toNum(k.ordinaryBusinessIncome),
    netRentalRealEstateIncome: toNum(k.netRentalRealEstateIncome),
    otherNetRentalIncome: toNum(k.otherNetRentalIncome),
    interestIncome: toNum(k.interestIncome),
    dividendIncome: toNum(k.dividendIncome),
    qualifiedDividends: toNum(k.qualifiedDividends),
    royalties: toNum(k.royalties),
    netShortTermCapitalGain: toNum(k.netShortTermCapitalGain),
    netLongTermCapitalGain: toNum(k.netLongTermCapitalGain),
    collectibles28Gain: toNum(k.collectibles28Gain),
    unrecaptured1250Gain: toNum(k.unrecaptured1250Gain),
    net1231Gain: toNum(k.net1231Gain),
    otherIncome: toNum(k.otherIncome),
    section179Deduction: toNum(k.section179Deduction),
    otherDeductions: toNum(k.otherDeductions),
    charitableContributions: toNum(k.charitableContributions),
    lowIncomeHousingCredit: toNum(k.lowIncomeHousingCredit),
    otherCredits: toNum(k.otherCredits),
    netEarningsSE: toNum(k.netEarningsSE),
    taxExemptInterest: toNum(k.taxExemptInterest),
    otherTaxExemptIncome: toNum(k.otherTaxExemptIncome),
    nondeductibleExpenses: toNum(k.nondeductibleExpenses),
    cashDistributions: toNum(k.cashDistributions),
    propertyDistributions: toNum(k.propertyDistributions),
    section199AQBI: toNum(k.section199AQBI)
  }
}

const adaptFactsToForm1120SData = (facts: FactsRecord): Form1120SData => {
  const income = asRecord(facts.income)
  const deductions = asRecord(facts.deductions)
  const shareholders = asArray<Record<string, unknown>>(facts.shareholders)

  return {
    entity: defaultBusinessEntity(facts) as Form1120SData['entity'],
    income: {
      grossReceiptsOrSales: toNum(
        income.grossReceiptsOrSales ?? facts.grossReceipts
      ),
      returnsAndAllowances: toNum(income.returnsAndAllowances),
      costOfGoodsSold: toNum(income.costOfGoodsSold ?? facts.costOfGoodsSold),
      netGainFromSaleOfAssets: toNum(income.netGainFromSaleOfAssets),
      otherIncome: toNum(income.otherIncome),
      interestIncome: toNum(income.interestIncome),
      dividendIncome: toNum(income.dividendIncome),
      grossRents: toNum(income.grossRents),
      grossRoyalties: toNum(income.grossRoyalties)
    },
    deductions: {
      compensation: toNum(
        deductions.compensation ?? deductions.compensationOfOfficers
      ),
      salariesAndWages: toNum(deductions.salariesAndWages),
      repairsAndMaintenance: toNum(deductions.repairsAndMaintenance),
      badDebts: toNum(deductions.badDebts),
      rents: toNum(deductions.rents),
      taxesAndLicenses: toNum(deductions.taxesAndLicenses),
      interest: toNum(deductions.interest),
      depreciation: toNum(deductions.depreciation),
      depletion: toNum(deductions.depletion),
      advertising: toNum(deductions.advertising),
      pensionPlans: toNum(deductions.pensionPlans),
      employeeBenefits: toNum(deductions.employeeBenefits),
      otherDeductions: toNum(deductions.otherDeductions)
    },
    shareholders: shareholders.map(
      (s): SCorpShareholder => ({
        name: toStr(s.name),
        ssn: toStr(s.ssn ?? s.tin).replace(/\D/g, ''),
        ownershipPercentage: toNum(s.ownershipPercentage ?? s.ownershipPct),
        stockOwned: toNum(s.stockOwned ?? s.shares),
        isOfficer: toBool(s.isOfficer),
        compensation: toNum(s.compensation) || undefined
      })
    ),
    scheduleK: defaultScheduleK(facts),
    builtInGainsTax: toNum(facts.builtInGainsTax) || undefined,
    excessPassiveIncomeTax: toNum(facts.excessPassiveIncomeTax) || undefined,
    estimatedTaxPayments: toNum(facts.estimatedTaxPayments)
  }
}

const adaptFactsToForm1065Data = (facts: FactsRecord): Form1065Data => {
  const income = asRecord(facts.income)
  const deductions = asRecord(facts.deductions)
  const partners = asArray<Record<string, unknown>>(facts.partners)
  const liabilities = asRecord(facts.liabilitiesAtYearEnd)

  return {
    entity: defaultBusinessEntity(facts) as Form1065Data['entity'],
    income: {
      grossReceiptsOrSales: toNum(
        income.grossReceiptsOrSales ?? facts.grossReceipts
      ),
      returnsAndAllowances: toNum(income.returnsAndAllowances),
      costOfGoodsSold: toNum(income.costOfGoodsSold ?? facts.costOfGoodsSold),
      ordinaryIncome: toNum(income.ordinaryIncome),
      netFarmProfit: toNum(income.netFarmProfit),
      netGainFromSaleOfAssets: toNum(income.netGainFromSaleOfAssets),
      otherIncome: toNum(income.otherIncome),
      interestIncome: toNum(income.interestIncome),
      dividendIncome: toNum(income.dividendIncome),
      grossRents: toNum(income.grossRents),
      grossRoyalties: toNum(income.grossRoyalties),
      net1231Gain: toNum(income.net1231Gain)
    },
    deductions: {
      salariesAndWages: toNum(deductions.salariesAndWages),
      guaranteedPaymentsToPartners: toNum(
        deductions.guaranteedPaymentsToPartners
      ),
      repairsAndMaintenance: toNum(deductions.repairsAndMaintenance),
      badDebts: toNum(deductions.badDebts),
      rents: toNum(deductions.rents),
      taxesAndLicenses: toNum(deductions.taxesAndLicenses),
      interest: toNum(deductions.interest),
      depreciation: toNum(deductions.depreciation),
      depletion: toNum(deductions.depletion),
      retirementPlans: toNum(deductions.retirementPlans),
      employeeBenefits: toNum(deductions.employeeBenefits),
      otherDeductions: toNum(deductions.otherDeductions)
    },
    partners: partners.map(
      (p): PartnerInfo => ({
        name: toStr(p.name),
        tin: toStr(p.tin ?? p.ssn).replace(/\D/g, ''),
        tinType: toStr(p.tinType) === 'EIN' ? 'EIN' : 'SSN',
        isGeneralPartner: toBool(p.isGeneralPartner ?? true),
        isLimitedPartner: toBool(p.isLimitedPartner),
        isDomestic: toBool(p.isDomestic ?? true),
        profitSharingPercent: toNum(p.profitSharingPercent ?? p.profitPct),
        lossSharingPercent: toNum(
          p.lossSharingPercent ??
            p.lossPct ??
            p.profitSharingPercent ??
            p.profitPct
        ),
        capitalSharingPercent: toNum(
          p.capitalSharingPercent ??
            p.capitalPct ??
            p.profitSharingPercent ??
            p.profitPct
        ),
        beginningCapitalAccount: toNum(p.beginningCapitalAccount),
        capitalContributed: toNum(p.capitalContributed),
        currentYearIncrease: toNum(p.currentYearIncrease),
        withdrawalsDistributions: toNum(p.withdrawalsDistributions),
        endingCapitalAccount: toNum(p.endingCapitalAccount)
      })
    ),
    scheduleK: defaultScheduleK(facts),
    numberOfGeneralPartners: partners.filter((p) =>
      toBool(p.isGeneralPartner ?? true)
    ).length,
    numberOfLimitedPartners: partners.filter((p) => toBool(p.isLimitedPartner))
      .length,
    liabilitiesAtYearEnd: {
      recourse: toNum(liabilities.recourse),
      nonrecourse: toNum(liabilities.nonrecourse),
      qualifiedNonrecourse: toNum(liabilities.qualifiedNonrecourse)
    },
    capitalAccountMethod:
      (toStr(facts.capitalAccountMethod) as
        | 'tax'
        | 'GAAP'
        | 'section704b'
        | 'other') || 'tax'
  }
}

/** Adapt facts into the Form1041Info structure used by the trust/estate form */
const adaptFactsToForm1041Info = (facts: FactsRecord): Form1041Info => {
  const income = asRecord(facts.income)
  const deductions = asRecord(facts.deductions)
  const fiduciary = asRecord(facts.fiduciary)
  const beneficiaries = asArray<Record<string, unknown>>(facts.beneficiaries)

  return {
    entityType: (toStr(facts.entityType) ||
      'complexTrust') as Form1041Info['entityType'],
    entityName: toStr(facts.entityName) || 'Estate/Trust',
    ein: toStr(facts.ein).replace(/\D/g, ''),
    dateCreated: toDate(facts.dateCreated),
    isFinalReturn: toBool(facts.isFinalReturn),
    fiduciary: {
      name: toStr(fiduciary.name),
      title: toStr(fiduciary.title),
      address: toStr(fiduciary.address),
      ein: toStr(fiduciary.ein),
      phone: toStr(fiduciary.phone)
    },
    beneficiaries: beneficiaries.map((b) => ({
      name: toStr(b.name),
      tin: toStr(b.tin ?? b.ssn).replace(/\D/g, ''),
      address: toStr(b.address),
      percentageShare: toNum(b.percentageShare ?? b.share),
      isContingent: toBool(b.isContingent),
      ordinaryIncome: toNum(b.ordinaryIncome),
      qualifiedDividends: toNum(b.qualifiedDividends),
      capitalGains: toNum(b.capitalGains),
      otherIncome: toNum(b.otherIncome),
      deductions: toNum(b.deductions),
      credits: toNum(b.credits)
    })),
    income: {
      interest: toNum(income.interest),
      ordinaryDividends: toNum(income.ordinaryDividends),
      qualifiedDividends: toNum(income.qualifiedDividends),
      businessIncome: toNum(income.businessIncome),
      capitalGainShortTerm: toNum(income.capitalGainShortTerm),
      capitalGainLongTerm: toNum(income.capitalGainLongTerm),
      rents: toNum(income.rents),
      royalties: toNum(income.royalties),
      farmIncome: toNum(income.farmIncome),
      otherIncome: toNum(income.otherIncome)
    },
    deductions: {
      interestExpense: toNum(deductions.interestExpense),
      taxes: toNum(deductions.taxes),
      fiduciaryFees: toNum(deductions.fiduciaryFees),
      charitableDeduction: toNum(deductions.charitableDeduction),
      attorneyFees: toNum(deductions.attorneyFees),
      accountantFees: toNum(deductions.accountantFees),
      otherDeductions: toNum(deductions.otherDeductions)
    },
    requiredDistributions: toNum(facts.requiredDistributions),
    otherDistributions: toNum(facts.otherDistributions),
    section645Election: toBool(facts.section645Election),
    section663bElection: toBool(facts.section663bElection),
    estimatedTaxPayments: toNum(facts.estimatedTaxPayments),
    withholding: toNum(facts.withholding)
  }
}

// ─── Trust/Estate tax computation (standalone, mirrors F1041 logic) ──────────

const TRUST_BRACKETS_2025 = [
  { limit: 3150, rate: 0.1 },
  { limit: 11450, rate: 0.24 },
  { limit: 15650, rate: 0.35 },
  { limit: Infinity, rate: 0.37 }
]

const EXEMPTION_AMOUNTS: Record<string, number> = {
  decedentEstate: 600,
  simpleTrust: 300,
  complexTrust: 100,
  grantorTrust: 0,
  bankruptcyEstate: 0,
  pooledIncomeFund: 0,
  qsst: 300,
  esbt: 100
}

const computeTrustTax = (info: Form1041Info) => {
  const totalIncome =
    info.income.interest +
    info.income.ordinaryDividends +
    info.income.businessIncome +
    info.income.capitalGainShortTerm +
    info.income.capitalGainLongTerm +
    info.income.rents +
    info.income.royalties +
    info.income.farmIncome +
    info.income.otherIncome

  const totalDeductions =
    info.deductions.interestExpense +
    info.deductions.taxes +
    info.deductions.fiduciaryFees +
    info.deductions.charitableDeduction +
    info.deductions.attorneyFees +
    info.deductions.accountantFees +
    info.deductions.otherDeductions

  const adjustedTotalIncome = Math.max(0, totalIncome - totalDeductions)

  // Income distribution deduction
  const isSimpleTrust = info.entityType === 'simpleTrust'
  const distributionDeduction = isSimpleTrust
    ? adjustedTotalIncome
    : Math.min(
        adjustedTotalIncome,
        info.requiredDistributions + info.otherDistributions
      )

  const exemption = EXEMPTION_AMOUNTS[info.entityType] ?? 100
  const taxableIncome = Math.max(
    0,
    adjustedTotalIncome - distributionDeduction - exemption
  )

  // Compute tax using compressed brackets
  let tax = 0
  let previousLimit = 0
  for (const bracket of TRUST_BRACKETS_2025) {
    const taxableInBracket =
      Math.min(taxableIncome, bracket.limit) - previousLimit
    if (taxableInBracket > 0) {
      tax += taxableInBracket * bracket.rate
    }
    previousLimit = bracket.limit
    if (taxableIncome <= bracket.limit) break
  }
  tax = Math.round(tax)

  const totalPayments = info.estimatedTaxPayments + info.withholding
  const amountOwed = Math.max(0, tax - totalPayments)
  const overpayment = Math.max(0, totalPayments - tax)

  return {
    totalIncome,
    totalDeductions,
    adjustedTotalIncome,
    distributionDeduction,
    exemption,
    taxableIncome,
    tax,
    totalPayments,
    amountOwed,
    overpayment
  }
}

// ─── Tax Calculation Service ─────────────────────────────────────────────────

export class TaxCalculationService {
  /** Individual (1040-family) tax calculation with optional state returns */
  calculate(facts: FactsRecord): TaxCalcOutcome {
    try {
      const info = adaptFactsToInformation(facts)
      const assets: Asset<Date>[] = []
      const result = create1040(info, assets)

      if (isLeft(result)) {
        return {
          success: false,
          errors: result.left.map(String)
        }
      }

      if (isRight(result)) {
        const [f1040, schedules] = result.right as [F1040, Form[]]
        const agi = f1040.l11()
        const taxableIncome = f1040.l15()
        const totalTax = f1040.l24()
        const totalPayments = f1040.l33()
        const refund = Math.max(0, f1040.l34() ?? 0)
        const amountOwed = Math.max(0, f1040.l37() ?? 0)
        const effectiveTaxRate =
          agi > 0 ? Math.round((totalTax / agi) * 10000) / 10000 : 0

        // Compute state returns
        const stateResults = this.computeStateReturns(f1040)

        const calcResult: TaxCalcWithStateResult = {
          success: true,
          taxYear: 2025,
          filingStatus: toStr(facts.filingStatus),
          agi,
          taxableIncome,
          totalTax,
          totalPayments,
          refund,
          amountOwed,
          effectiveTaxRate,
          marginalTaxRate: 0,
          schedules: [f1040.tag, ...schedules.map((s) => s.tag)],
          stateResults: stateResults.length > 0 ? stateResults : undefined
        }

        return calcResult
      }

      return {
        success: false,
        errors: ['Unexpected return type from tax engine']
      }
    } catch (err) {
      return {
        success: false,
        errors: [err instanceof Error ? err.message : 'Tax calculation failed']
      }
    }
  }

  /** Compute state tax returns from a completed F1040 */
  private computeStateReturns(f1040: F1040): StateCalculationResult[] {
    try {
      const stateResult = createStateReturn(f1040)

      if (isLeft(stateResult)) {
        // No state filing required or not supported — not an error
        return []
      }

      if (isRight(stateResult)) {
        const stateForms = stateResult.right
        return stateForms.map((form) => {
          // Extract state tax info by calling known line methods
          // State forms follow varying patterns, so we use duck typing
          const stateForm = form as unknown as Record<string, unknown>
          const stateTax = this.extractStateTax(stateForm)
          const stateRefund = this.extractStateRefund(stateForm)
          const stateAmountOwed = this.extractStateAmountOwed(stateForm)
          const stateWithholding = this.extractStateWithholding(stateForm)
          const stateTaxableIncome = this.extractStateTaxableIncome(
            stateForm,
            f1040
          )

          return {
            state: form.state,
            stateName: form.formName,
            stateTax,
            stateRefund,
            stateAmountOwed,
            stateWithholding,
            stateTaxableIncome,
            effectiveStateRate:
              stateTaxableIncome > 0
                ? Math.round((stateTax / stateTaxableIncome) * 10000) / 10000
                : 0
          }
        })
      }

      return []
    } catch {
      // State calculation failure shouldn't block federal return
      return []
    }
  }

  /** Extract total state tax from a state form (duck-typed) */
  private extractStateTax(form: Record<string, unknown>): number {
    // IL: l14 (total tax before credits) or l25 (total tax + other)
    // CA: l27 (total tax)
    // Try common patterns
    for (const method of ['l25', 'l27', 'l14', 'l21']) {
      if (typeof form[method] === 'function') {
        const val = (form[method] as () => unknown)()
        if (typeof val === 'number' && val >= 0) return val
      }
    }
    return 0
  }

  /** Extract state refund */
  private extractStateRefund(form: Record<string, unknown>): number {
    for (const method of ['l33', 'l36', 'l31', 'l34']) {
      if (typeof form[method] === 'function') {
        const val = (form[method] as () => unknown)()
        if (typeof val === 'number' && val > 0) return val
      }
    }
    return 0
  }

  /** Extract state amount owed */
  private extractStateAmountOwed(form: Record<string, unknown>): number {
    for (const method of ['l32', 'l35', 'payment']) {
      if (typeof form[method] === 'function') {
        const val = (form[method] as () => unknown)()
        if (typeof val === 'number' && val > 0) return val
      }
    }
    return 0
  }

  /** Extract state withholding */
  private extractStateWithholding(form: Record<string, unknown>): number {
    if (
      typeof (form as { methods?: { stateWithholding?: () => number } }).methods
        ?.stateWithholding === 'function'
    ) {
      return (
        form as { methods: { stateWithholding: () => number } }
      ).methods.stateWithholding()
    }
    return 0
  }

  /** Extract state taxable income */
  private extractStateTaxableIncome(
    form: Record<string, unknown>,
    f1040: F1040
  ): number {
    // IL: l11 (net income), CA: l18 (taxable income)
    for (const method of ['l18', 'l11', 'l9']) {
      if (typeof form[method] === 'function') {
        const val = (form[method] as () => unknown)()
        if (typeof val === 'number' && val > 0) return val
      }
    }
    // Fallback to federal AGI
    return f1040.l11()
  }

  // ─── Public form-specific entry points ─────────────────────────────────

  /** C-Corp (Form 1120): 21% flat corporate tax rate */
  calculateF1120(facts: FactsRecord): BusinessCalcOutcome {
    try {
      return this.calculateCCorp(facts)
    } catch (err) {
      return {
        success: false,
        errors: [
          err instanceof Error ? err.message : 'F1120 calculation failed'
        ]
      }
    }
  }

  /** S-Corp (Form 1120-S): pass-through with per-shareholder allocations */
  calculateF1120S(facts: FactsRecord): BusinessCalcOutcome {
    try {
      return this.calculateSCorp(facts)
    } catch (err) {
      return {
        success: false,
        errors: [
          err instanceof Error ? err.message : 'F1120-S calculation failed'
        ]
      }
    }
  }

  /** Partnership (Form 1065): pass-through with per-partner allocations */
  calculateF1065(facts: FactsRecord): BusinessCalcOutcome {
    try {
      return this.calculatePartnership(facts)
    } catch (err) {
      return {
        success: false,
        errors: [
          err instanceof Error ? err.message : 'F1065 calculation failed'
        ]
      }
    }
  }

  /** Trust/Estate (Form 1041): compressed tax brackets */
  calculateF1041(facts: FactsRecord): BusinessCalcOutcome {
    try {
      return this.calculateEstateTrust(facts)
    } catch (err) {
      return {
        success: false,
        errors: [
          err instanceof Error ? err.message : 'F1041 calculation failed'
        ]
      }
    }
  }

  /** Dispatch method: routes to the correct entity calculation by formType */
  calculateEntity(facts: FactsRecord, formType: string): BusinessCalcOutcome {
    return this.calculateBusinessEntity(formType, facts)
  }

  /** Business entity tax calculation (1120, 1120-S, 1065, 1041) */
  calculateBusinessEntity(
    formType: string,
    facts: FactsRecord
  ): BusinessCalcOutcome {
    try {
      switch (formType) {
        case '1120':
          return this.calculateCCorp(facts)
        case '1120-S':
          return this.calculateSCorp(facts)
        case '1065':
          return this.calculatePartnership(facts)
        case '1041':
          return this.calculateEstateTrust(facts)
        default:
          return {
            success: false,
            errors: [`Unsupported business form type: ${formType}`]
          }
      }
    } catch (err) {
      return {
        success: false,
        errors: [
          err instanceof Error
            ? err.message
            : 'Business entity tax calculation failed'
        ]
      }
    }
  }

  // ─── C-Corp (Form 1120) ─────────────────────────────────────────────────

  private calculateCCorp(facts: FactsRecord): BusinessCalcOutcome {
    const data = adaptFactsToForm1120Data(facts)
    const form = new F1120(data)

    const totalIncome = form.l11()
    const totalDeductions = form.l27()
    const taxableIncome = form.l30()
    const totalTax = form.l35()
    const totalPayments = form.totalPayments()
    const amountOwed = form.l38()
    const overpayment = form.l39()
    const effectiveTaxRate =
      totalIncome > 0 ? Math.round((totalTax / totalIncome) * 10000) / 10000 : 0

    return {
      success: true,
      taxYear: data.entity.taxYear,
      formType: '1120',
      entityName: data.entity.entityName,
      totalIncome,
      totalDeductions,
      taxableIncome,
      totalTax,
      totalPayments,
      amountOwed,
      overpayment,
      effectiveTaxRate,
      schedules: [form.tag]
    }
  }

  // ─── S-Corp (Form 1120-S) ───────────────────────────────────────────────

  private calculateSCorp(facts: FactsRecord): BusinessCalcOutcome {
    const data = adaptFactsToForm1120SData(facts)
    const form = new F1120S(data)

    const totalIncome = form.l6()
    const totalDeductions = form.l20()
    const ordinaryBusinessIncome = form.l21()
    const totalTax = form.totalTax()
    const totalPayments = form.l23d()
    const amountOwed = form.l25()
    const overpayment = form.l26()
    const effectiveTaxRate =
      totalIncome > 0 ? Math.round((totalTax / totalIncome) * 10000) / 10000 : 0

    // Build per-shareholder allocations
    const ownerAllocations: OwnerAllocation[] = data.shareholders.map((sh) => {
      const alloc = form.shareholderAllocation(sh)
      return {
        name: sh.name,
        ownershipPct: sh.ownershipPercentage,
        ordinaryIncome: alloc.ordinaryBusinessIncome,
        netRentalIncome:
          alloc.netRentalRealEstateIncome + alloc.otherNetRentalIncome,
        interestIncome: alloc.interestIncome,
        dividendIncome: alloc.dividendIncome,
        capitalGains:
          alloc.netShortTermCapitalGain + alloc.netLongTermCapitalGain,
        otherIncome: alloc.otherIncome,
        section179Deduction: alloc.section179Deduction,
        otherDeductions: alloc.otherDeductions,
        selfEmploymentEarnings: 0 // S-Corp shareholders don't have SE
      }
    })

    return {
      success: true,
      taxYear: data.entity.taxYear,
      formType: '1120-S',
      entityName: data.entity.entityName,
      totalIncome,
      totalDeductions,
      taxableIncome: ordinaryBusinessIncome,
      totalTax,
      totalPayments,
      amountOwed,
      overpayment,
      effectiveTaxRate,
      ownerAllocations,
      schedules: [form.tag]
    }
  }

  // ─── Partnership (Form 1065) ────────────────────────────────────────────

  private calculatePartnership(facts: FactsRecord): BusinessCalcOutcome {
    const data = adaptFactsToForm1065Data(facts)
    const form = new F1065(data)

    const totalIncome = form.l8()
    const totalDeductions = form.l21()
    const ordinaryBusinessIncome = form.l22()

    // Partnerships have no entity-level tax
    const totalTax = 0
    const totalPayments = 0
    const amountOwed = 0
    const overpayment = 0

    // Build per-partner allocations
    const ownerAllocations: OwnerAllocation[] = data.partners.map((partner) => {
      const alloc = form.partnerAllocation(partner)
      return {
        name: partner.name,
        ownershipPct: partner.profitSharingPercent,
        ordinaryIncome: alloc.ordinaryBusinessIncome,
        netRentalIncome:
          alloc.netRentalRealEstateIncome + alloc.otherNetRentalIncome,
        interestIncome: alloc.interestIncome,
        dividendIncome: alloc.dividendIncome,
        capitalGains:
          alloc.netShortTermCapitalGain + alloc.netLongTermCapitalGain,
        otherIncome: alloc.otherIncome,
        section179Deduction: alloc.section179Deduction,
        otherDeductions: alloc.otherDeductions,
        selfEmploymentEarnings: alloc.netEarningsSE
      }
    })

    return {
      success: true,
      taxYear: data.entity.taxYear,
      formType: '1065',
      entityName: data.entity.entityName,
      totalIncome,
      totalDeductions,
      taxableIncome: ordinaryBusinessIncome,
      totalTax,
      totalPayments,
      amountOwed,
      overpayment,
      effectiveTaxRate: 0,
      ownerAllocations,
      schedules: [form.tag]
    }
  }

  // ─── Estate/Trust (Form 1041) ───────────────────────────────────────────

  private calculateEstateTrust(facts: FactsRecord): BusinessCalcOutcome {
    const info = adaptFactsToForm1041Info(facts)
    const result = computeTrustTax(info)

    const effectiveTaxRate =
      result.totalIncome > 0
        ? Math.round((result.tax / result.totalIncome) * 10000) / 10000
        : 0

    return {
      success: true,
      taxYear: toNum(facts.taxYear) || 2025,
      formType: '1041',
      entityName: info.entityName,
      totalIncome: result.totalIncome,
      totalDeductions: result.totalDeductions,
      taxableIncome: result.taxableIncome,
      totalTax: result.tax,
      totalPayments: result.totalPayments,
      amountOwed: result.amountOwed,
      overpayment: result.overpayment,
      effectiveTaxRate,
      schedules: ['f1041']
    }
  }
}
