/**
 * Converts IRS ATS scenario JSON (Direct File format) to TaxCalculationService facts.
 *
 * Used by excel1040Parity tests to run our calculation against ATS expected values
 * (which align with Excel1040 / IRS rules). See extracted_formulas/NAMED_RANGES_TAX_RULES.json
 * for the Excel cell mapping of key concepts.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface AtsScenario {
  scenarioId: string
  scenarioName: string
  taxYear: number
  filingStatus: number
  formType?: string
  hasScheduleD?: boolean
  hasForm8949?: boolean
  hasScheduleOI?: boolean
  primaryTaxpayer: {
    ssn: string
    dateOfBirth: string
    countryOfCitizenship?: string
    countryOfResidence?: string
    visaType?: string
    firstYearInUS?: string
    daysInUSThisYear?: number
    daysInUSPriorYear?: number
    daysInUSTwoYearsPrior?: number
    appliedForGreenCard?: boolean
    filedPriorUsReturn?: boolean
    compensationOver250k?: boolean
    realPropertyElectionFirstYear?: boolean
    realPropertyElectionPriorYear?: boolean
    taxTreatyCountry?: string
    address?: {
      street?: string
      city?: string
      state?: string
      zip?: string
      country?: string
    }
    foreignAddress?: {
      street?: string
      city?: string
      province?: string
      postalCode?: string
      country?: string
    }
  }
  spouse: Record<string, unknown> | null
  dependents: Array<{
    firstName?: string
    lastName?: string
    name?: string
    ssn?: string
    dateOfBirth?: string
    relationship?: string
  }>
  w2Forms: Array<{
    wages: number
    federalWithholding: number
    employerName: string
    employerEin: string
    employeeName?: string
  }>
  form1099Misc?: Array<{
    payerName?: string
    payerEin?: string
    otherIncome?: number
    federalWithholding?: number
    scholarshipIncome?: number
    stipend?: number
    description?: string
  }>
  form1099Rs: Array<Record<string, unknown>>
  scholarshipIncome?: {
    totalScholarship?: number
    qualifiedEducationExpenses?: number
    taxableScholarship?: number
  }
  taxTreatyBenefits?: {
    treatyCountry?: string
    articleNumber?: string
    exemptIncome?: number
    description?: string
  }
  expectedValues?: {
    agi?: number
    totalIncome?: number
    taxableIncome?: number
    totalTax?: number
    federalWithholding?: number
    totalPayments?: number
    refund?: number
    amountOwed?: number
  }
}

const filingStatusByCode: Record<number, string> = {
  1: 'single',
  2: 'mfj',
  3: 'mfs',
  4: 'hoh',
  5: 'qss'
}

const asNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : ''

const roundToCents = (value: number): number => Math.round(value * 100) / 100

const isNonresidentScenario = (scenario: AtsScenario): boolean =>
  scenario.formType?.toUpperCase() === '1040-NR' ||
  scenario.scenarioId.toUpperCase().startsWith('NR')

const scenarioCountry = (scenario: AtsScenario): string =>
  asString(
    scenario.primaryTaxpayer.countryOfResidence ??
      scenario.primaryTaxpayer.countryOfCitizenship ??
      scenario.primaryTaxpayer.foreignAddress?.country ??
      scenario.primaryTaxpayer.address?.country
  )

const buildTreatyClaims = (scenario: AtsScenario): Record<string, unknown>[] => {
  const treaty = scenario.taxTreatyBenefits
  if (!treaty) return []
  return [
    {
      id: `treaty-${scenario.scenarioId.toLowerCase()}`,
      country:
        treaty.treatyCountry ??
        scenario.primaryTaxpayer.taxTreatyCountry ??
        scenarioCountry(scenario),
      articleNumber: treaty.articleNumber ?? '',
      exemptAmount: asNumber(treaty.exemptIncome),
      description: treaty.description ?? '',
      confirmed: true,
      isComplete: true
    }
  ]
}

const buildNonresidentProfile = (
  scenario: AtsScenario,
  treatyClaims: Record<string, unknown>[]
): Record<string, unknown> | null => {
  if (!isNonresidentScenario(scenario)) return null

  const primary = scenario.primaryTaxpayer
  const country =
    primary.countryOfResidence ??
    primary.countryOfCitizenship ??
    primary.foreignAddress?.country ??
    primary.address?.country ??
    ''
  const treatyCountry =
    primary.taxTreatyCountry ??
    asString(treatyClaims[0]?.country) ??
    country

  return {
    hasData: true,
    isComplete: true,
    requires1040NR: true,
    countryOfCitizenship:
      primary.countryOfCitizenship ??
      primary.foreignAddress?.country ??
      primary.address?.country ??
      '',
    countryOfResidence: primary.countryOfResidence ?? country,
    visaType: primary.visaType ?? '',
    hasTreaty: treatyClaims.length > 0,
    treatyCountry,
    treatyArticle: asString(treatyClaims[0]?.articleNumber),
    dateEnteredUS: primary.firstYearInUS
      ? `${primary.firstYearInUS}-01-01`
      : undefined,
    daysInUS2024: asNumber(primary.daysInUSThisYear),
    daysInUS2023: asNumber(primary.daysInUSPriorYear),
    daysInUS2022: asNumber(primary.daysInUSTwoYearsPrior),
    appliedForGreenCard: !!primary.appliedForGreenCard,
    filedPriorUsReturn: !!primary.filedPriorUsReturn,
    compensationOver250k: !!primary.compensationOver250k,
    realPropertyElectionFirstYear: !!primary.realPropertyElectionFirstYear,
    realPropertyElectionPriorYear: !!primary.realPropertyElectionPriorYear,
    foreignAddress: primary.foreignAddress ?? null
  }
}

const buildNonresidentScheduleOi = (
  scenario: AtsScenario,
  treatyClaims: Record<string, unknown>[]
): Record<string, unknown> | null => {
  if (!isNonresidentScenario(scenario)) return null

  const primary = scenario.primaryTaxpayer
  const expected = scenario.expectedValues ?? {}
  const treaty = scenario.taxTreatyBenefits
  const scholarship = scenario.scholarshipIncome
  const stipend = (scenario.form1099Misc ?? []).reduce(
    (sum, record) => sum + asNumber(record.stipend),
    0
  )

  return {
    countryOfCitizenship:
      primary.countryOfCitizenship ??
      primary.foreignAddress?.country ??
      primary.address?.country ??
      '',
    countryOfResidence:
      primary.countryOfResidence ??
      primary.foreignAddress?.country ??
      primary.address?.country ??
      '',
    visaType: primary.visaType ?? '',
    firstDateEnteredUS: primary.firstYearInUS
      ? `${primary.firstYearInUS}-01-01`
      : undefined,
    dateEnteredUS: primary.firstYearInUS
      ? `${primary.firstYearInUS}-01-01`
      : undefined,
    daysInUS2025: asNumber(primary.daysInUSThisYear),
    daysInUS2024: asNumber(primary.daysInUSPriorYear),
    daysInUS2023: asNumber(primary.daysInUSTwoYearsPrior),
    appliedForGreenCard: !!primary.appliedForGreenCard,
    filedPriorUsReturn: !!primary.filedPriorUsReturn,
    compensationOver250k: !!primary.compensationOver250k,
    realPropertyElectionFirstYear: !!primary.realPropertyElectionFirstYear,
    realPropertyElectionPriorYear: !!primary.realPropertyElectionPriorYear,
    treatyCountry:
      treaty?.treatyCountry ??
      primary.taxTreatyCountry ??
      asString(treatyClaims[0]?.country),
    treatyArticle:
      treaty?.articleNumber ?? asString(treatyClaims[0]?.articleNumber),
    treatyExemptAmount: asNumber(treaty?.exemptIncome),
    treatyBenefitAmount: asNumber(treaty?.exemptIncome),
    scholarshipIncome: asNumber(scholarship?.taxableScholarship),
    scholarshipTreatyExempt: asNumber(treaty?.exemptIncome),
    otherEffectivelyConnectedIncome: stipend,
    taxWithheld: asNumber(expected.federalWithholding),
    estimatedTaxPayments: Math.max(
      0,
      asNumber(expected.totalPayments) - asNumber(expected.federalWithholding)
    )
  }
}

const buildNonresidentScheduleNecItems = (
  scenario: AtsScenario
): Record<string, unknown>[] => {
  if (!isNonresidentScenario(scenario)) return []

  const expected = scenario.expectedValues ?? {}
  const hasCapitalOrScholarshipFlow =
    !!scenario.hasScheduleD ||
    !!scenario.hasForm8949 ||
    !!scenario.scholarshipIncome ||
    (scenario.form1099Misc ?? []).some(
      (record) =>
        asNumber(record.scholarshipIncome) > 0 || asNumber(record.stipend) > 0
    )

  const totalIncome = asNumber(expected.totalIncome)
  const totalTax = asNumber(expected.totalTax)
  const looksLikePureNec =
    totalIncome > 0 &&
    !hasCapitalOrScholarshipFlow &&
    asNumber(expected.agi) === totalIncome &&
    asNumber(expected.taxableIncome) === totalIncome &&
    Math.abs(roundToCents(totalTax) - roundToCents(totalIncome * 0.3)) < 0.01

  if (!looksLikePureNec) return []

  return [
    {
      id: `nec-${scenario.scenarioId.toLowerCase()}`,
      incomeType: 'Other NEC income',
      grossAmount: totalIncome,
      treatyRate: undefined,
      isComplete: true
    }
  ]
}

const buildSyntheticTaxLots = (
  scenario: AtsScenario
): Record<string, unknown>[] => {
  if (!isNonresidentScenario(scenario)) return []
  const expected = scenario.expectedValues ?? {}
  const totalIncome = asNumber(expected.totalIncome)
  if (
    totalIncome <= 0 ||
    (!scenario.hasScheduleD && !scenario.hasForm8949) ||
    (scenario.w2Forms ?? []).length > 0
  ) {
    return []
  }
  return [
    {
      id: `tax-lot-${scenario.scenarioId.toLowerCase()}`,
      asset: `ATS ${scenario.scenarioId} capital gain`,
      proceeds: totalIncome,
      costBasis: 0,
      acquisitionDate: `${scenario.taxYear - 1}-01-01`,
      saleDate: `${scenario.taxYear}-12-31`,
      isComplete: true
    }
  ]
}

export function atsScenarioToFacts(
  scenario: AtsScenario
): Record<string, unknown> {
  const filingStatus = filingStatusByCode[scenario.filingStatus] ?? 'single'

  const w2Records = (scenario.w2Forms ?? []).map((w2, i) => ({
    id: `w2-ats-${i}`,
    employerName: w2.employerName,
    ein: w2.employerEin,
    box1Wages: w2.wages,
    box2FederalWithheld: w2.federalWithholding,
    owner: 'taxpayer',
    isComplete: true
  }))

  const dependents = (scenario.dependents ?? []).map((dep, i) => {
    const name =
      dep.name ?? `${dep.firstName ?? ''} ${dep.lastName ?? ''}`.trim()
    const parts = name.split(/\s+/)
    return {
      id: `dep-ats-${i}`,
      name: name || `Dependent ${i}`,
      firstName: dep.firstName ?? parts[0] ?? '',
      lastName: dep.lastName ?? parts.slice(1).join(' ') ?? '',
      dob: dep.dateOfBirth ?? '',
      relationship: dep.relationship ?? 'child',
      ssn: (dep.ssn ?? '').replace(/\D/g, ''),
      months: '12',
      isComplete: true
    }
  })

  const form1099Records = (scenario.form1099Misc ?? []).map((record, i) => ({
    id: `1099-misc-ats-${i}`,
    type: '1099-MISC',
    payer: record.payerName ?? `1099-MISC payer ${i + 1}`,
    ein: record.payerEin ?? '',
    amount: asNumber(record.otherIncome),
    federalWithheld: asNumber(record.federalWithholding),
    scholarshipIncome: asNumber(record.scholarshipIncome),
    stipend: asNumber(record.stipend),
    notes: record.description ?? '',
    isComplete: true
  }))

  const treatyClaims = buildTreatyClaims(scenario)
  const nonresidentProfile = buildNonresidentProfile(scenario, treatyClaims)
  const nonresidentScheduleOi = buildNonresidentScheduleOi(scenario, treatyClaims)
  const nonresidentScheduleNecItems = buildNonresidentScheduleNecItems(scenario)
  const taxLots = buildSyntheticTaxLots(scenario)

  return {
    primaryTIN: (scenario.primaryTaxpayer?.ssn ?? '123456789').replace(
      /\D/g,
      ''
    ),
    filingStatus,
    spouse: scenario.spouse ? { id: 'spouse-ats', isComplete: true } : null,
    w2Records,
    form1099Records,
    unemploymentRecords: [],
    socialSecurityRecords: [],
    taxLots,
    cryptoAccounts: [],
    businessRecords: [],
    qbiWorksheetEntities: {},
    rentalProperties: [],
    foreignIncomeRecords: [],
    foreignAccounts: [],
    treatyClaims,
    nonresidentProfile,
    nonresidentScheduleOi,
    nonresidentScheduleNecItems,
    estimatedTaxPayments:
      nonresidentScheduleOi?.estimatedTaxPayments ??
      Math.max(
        0,
        asNumber(scenario.expectedValues?.totalPayments) -
          asNumber(scenario.expectedValues?.federalWithholding)
      ),
    dependents,
    incomeSummary: {},
    investmentSummary: {},
    businessSummary: {},
    rentalSummary: {},
    foreignSummary: {},
    creditSummary: {},
    '/taxYear': {
      $type: 'gov.irs.factgraph.persisters.IntWrapper',
      item: scenario.taxYear ?? 2025
    },
    '/filingStatus': {
      $type: 'gov.irs.factgraph.persisters.EnumWrapper',
      item: { value: [filingStatus], enumOptionsPath: '/filingStatusOptions' }
    },
    '/filerResidenceAndIncomeState': {
      $type: 'gov.irs.factgraph.persisters.EnumWrapper',
      item: { value: ['ca'], enumOptionsPath: '/scopedStateOptions' }
    },
    '/filers/#primary/isPrimaryFiler': {
      $type: 'gov.irs.factgraph.persisters.BooleanWrapper',
      item: true
    },
    '/filers/#primary/tin': {
      $type: 'gov.irs.factgraph.persisters.TinWrapper',
      item: (() => {
        const d = (scenario.primaryTaxpayer?.ssn ?? '123456789').replace(
          /\D/g,
          ''
        )
        const digits = d.length >= 9 ? d : d.padStart(9, '0')
        return {
          area: digits.slice(0, 3),
          group: digits.slice(3, 5),
          serial: digits.slice(5, 9)
        }
      })()
    },
    '/address': {
      $type: 'gov.irs.factgraph.persisters.AddressWrapper',
      item: {
        streetAddress: '123 Main St',
        city: 'Test City',
        stateOrProvence: 'CA',
        postalCode: '90001'
      }
    }
  }
}

const defaultAtsScenarioDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'direct-file-easy-webui',
  'direct-file',
  'backend',
  'src',
  'test',
  'resources',
  'ats-scenarios'
)

export function loadAtsScenario(filename: string): AtsScenario {
  const dir = process.env.DIRECT_FILE_ATS_DIR ?? defaultAtsScenarioDir
  const path = join(dir, filename)
  const content = readFileSync(path, 'utf8')
  return JSON.parse(content) as AtsScenario
}
