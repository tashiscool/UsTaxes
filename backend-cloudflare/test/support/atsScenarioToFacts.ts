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
  primaryTaxpayer: { ssn: string; dateOfBirth: string }
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
  form1099Rs: Array<Record<string, unknown>>
  expectedValues?: {
    agi?: number
    taxableIncome?: number
    totalTax?: number
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

  return {
    primaryTIN: (scenario.primaryTaxpayer?.ssn ?? '123456789').replace(
      /\D/g,
      ''
    ),
    filingStatus,
    spouse: scenario.spouse ? { id: 'spouse-ats', isComplete: true } : null,
    w2Records,
    form1099Records: [],
    unemploymentRecords: [],
    socialSecurityRecords: [],
    taxLots: [],
    cryptoAccounts: [],
    businessRecords: [],
    qbiWorksheetEntities: {},
    rentalProperties: [],
    foreignIncomeRecords: [],
    foreignAccounts: [],
    treatyClaims: [],
    nonresidentProfile: null,
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
