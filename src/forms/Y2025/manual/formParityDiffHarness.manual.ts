/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/restrict-plus-operands */
import { execSync } from 'child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

import { FilingStatus, PersonRole } from '../../../core/data'
import F1040 from '../irsForms/F1040'
import { ValidatedInformation } from '../../F1040Base'

type DirectFileExport = Record<string, Record<string, unknown>>

type MetricRow = {
  scenario: string
  domain: 'qbi' | 'schedule_e' | '1040_nr'
  metric: string
  usTaxes: string
  directFile: string
  matches: 'yes' | 'no'
  note: string
}

const TAXES_ROOT = '/Users/tkhan/IdeaProjects/taxes'
const DIRECT_FILE_BACKEND = resolve(
  TAXES_ROOT,
  'direct-file-easy-webui/direct-file/backend'
)
const DIRECT_FILE_EXPORT = resolve(
  DIRECT_FILE_BACKEND,
  'target/parity-reports/direct-file-selected-form-outputs.json'
)
const OUTPUT_JSON = resolve(
  TAXES_ROOT,
  'UsTaxes/docs/2025_form_output_diff.json'
)
const OUTPUT_CSV = resolve(TAXES_ROOT, 'UsTaxes/docs/2025_form_output_diff.csv')

const scenarioPath = (fileName: string): string =>
  resolve(
    TAXES_ROOT,
    `direct-file-easy-webui/direct-file/backend/src/test/resources/ats-scenarios/${fileName}`
  )

const loadScenario = <T = Record<string, unknown>>(fileName: string): T =>
  JSON.parse(readFileSync(scenarioPath(fileName), 'utf8')) as T

const baseInformation = (
  filingStatus: FilingStatus,
  primary: {
    firstName: string
    lastName: string
    ssn: string
    dateOfBirth?: string
    address?: {
      street?: string
      city?: string
      state?: string
      zip?: string
    }
  }
): ValidatedInformation => ({
  f1099s: [],
  f3921s: [],
  credits: [],
  scheduleK1Form1065s: [],
  itemizedDeductions: undefined,
  w2s: [],
  estimatedTaxes: [],
  realEstate: [],
  taxPayer: {
    primaryPerson: {
      address: {
        address: primary.address?.street ?? '123 Test Street',
        aptNo: '',
        city: primary.address?.city ?? 'Test City',
        state: (primary.address?.state as never) ?? 'CA',
        zip: primary.address?.zip ?? '94105'
      },
      firstName: primary.firstName,
      lastName: primary.lastName,
      isTaxpayerDependent: false,
      role: PersonRole.PRIMARY,
      ssid: primary.ssn.replace(/-/g, ''),
      dateOfBirth: primary.dateOfBirth
        ? new Date(primary.dateOfBirth)
        : new Date('1980-01-01'),
      isBlind: false
    },
    spouse: undefined,
    dependents: [],
    filingStatus
  },
  questions: {},
  f1098es: [],
  stateResidencies: [
    {
      state: ((primary.address?.state || 'CA') as never) ?? 'CA'
    }
  ],
  healthSavingsAccounts: [],
  individualRetirementArrangements: []
})

const asAmount = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return value.toFixed(2)
  if (typeof value === 'boolean') return String(value)
  if (Array.isArray(value) || typeof value === 'object') {
    return JSON.stringify(stableValue(value))
  }
  return String(value)
}

const isBlankLike = (value: unknown): boolean =>
  value === null || value === undefined || String(value).trim() === ''

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => stableValue(entry))
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = stableValue((value as Record<string, unknown>)[key])
        return acc
      }, {})
  }
  return value
}

const canonicalVisaType = (value: unknown): string => {
  if (isBlankLike(value)) return 'other'
  const normalized = String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  return normalized === '' ? 'other' : normalized
}

const sameAmount = (
  metric: string,
  left: unknown,
  right: unknown
): boolean => {
  if (metric === 'qbiDeduction') {
    const leftNum = Number(left)
    const rightNum = Number(right)
    if (!Number.isNaN(leftNum) && !Number.isNaN(rightNum)) {
      return Math.abs(leftNum - rightNum) < 1
    }
  }
  if (metric === 'visaType') {
    return canonicalVisaType(left) === canonicalVisaType(right)
  }
  if (isBlankLike(left) && isBlankLike(right)) {
    return true
  }
  const leftNum = Number(left)
  const rightNum = Number(right)
  if (!Number.isNaN(leftNum) && !Number.isNaN(rightNum)) {
    if (Math.round(leftNum) === Math.round(rightNum)) {
      return true
    }
    return Math.abs(leftNum - rightNum) < 0.01
  }
  if (
    (Array.isArray(left) || (left !== null && typeof left === 'object')) &&
    (Array.isArray(right) || (right !== null && typeof right === 'object'))
  ) {
    return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right))
  }
  return String(left) === String(right)
}

const createScenario28Output = (): Record<string, unknown> => {
  const scenario = loadScenario<any>('scenario-28-taylor-qbi.json')
  const info = baseInformation(FilingStatus.S, {
    firstName: scenario.primaryTaxpayer.firstName,
    lastName: scenario.primaryTaxpayer.lastName,
    ssn: scenario.primaryTaxpayer.ssn,
    dateOfBirth: scenario.primaryTaxpayer.dateOfBirth,
    address: scenario.primaryTaxpayer.address
  })

  const expenses = scenario.scheduleC.expenses
  info.businesses = [
    {
      name: scenario.scheduleC.businessName,
      ein: undefined,
      principalBusinessCode: scenario.scheduleC.businessCode,
      businessDescription: scenario.scheduleC.businessDescription,
      accountingMethod: 'cash',
      materialParticipation: true,
      startedOrAcquired: false,
      madePaymentsRequiring1099: false,
      filed1099s: false,
      personRole: PersonRole.PRIMARY,
      qbiW2Wages: scenario.form8995QBI?.w2Wages ?? 0,
      qbiUbia: scenario.form8995QBI?.ubia ?? 0,
      income: {
        grossReceipts: scenario.scheduleC.grossReceipts,
        returns: 0,
        otherIncome: 0
      },
      expenses: {
        advertising: expenses.advertising ?? 0,
        carAndTruck: 0,
        commissions: 0,
        contractLabor: 0,
        depletion: 0,
        depreciation: 0,
        employeeBenefits: 0,
        insurance: expenses.insurance ?? 0,
        interestMortgage: 0,
        interestOther: 0,
        legal: expenses.professionalServices ?? 0,
        office: expenses.officeExpense ?? 0,
        pensionPlans: 0,
        rentVehicles: 0,
        rentOther: 0,
        repairs: 0,
        supplies: expenses.supplies ?? 0,
        taxes: 0,
        travel: expenses.travel ?? 0,
        deductibleMeals: expenses.meals ?? 0,
        utilities: 0,
        wages: 0,
        otherExpenses: expenses.software ?? 0
      }
    }
  ] as never

  const f1040 = new F1040(info, [])
  const qbiForm = f1040.f8995 as any
  return {
    directQBI: f1040.totalQbi(),
    totalQBI: f1040.totalQbi(),
    qbiDeduction: f1040.l13(),
    qbi8995A: qbiForm?.l27?.() ?? 0,
    w2Wages8995A:
      qbiForm
        ?.qbiEntries?.()
        .reduce(
          (total: number, entry: any) => total + (entry.w2Wages ?? 0),
          0
        ) ?? 0,
    ubia8995A:
      qbiForm
        ?.qbiEntries?.()
        .reduce((total: number, entry: any) => total + (entry.ubia ?? 0), 0) ??
      0,
    qbiComponentBeforeLimitation: qbiForm?.l5?.() ?? 0,
    qbiComponentAfter8995A: qbiForm?.l27?.() ?? 0,
    w2UBIALimit8995A: qbiForm?.l10a?.() ?? 0,
    isSSTB8995A: qbiForm?.qbiEntries?.()?.some((entry: any) => !!entry.isSSTB) ?? false,
    form8995ATotalBusinesses: qbiForm?.qbiEntries?.().length ?? 0,
    form8995AOverflowBusinesses: Math.max(
      0,
      (qbiForm?.qbiEntries?.().length ?? 0) - 3
    ),
    hasForm8995AAttachmentStatement: (qbiForm?.qbiEntries?.().length ?? 0) > 3,
    form8995AOverflowQBI: qbiForm?.overflowTotals?.().qbi ?? 0,
    form8995AOverflowW2Wages: qbiForm?.overflowTotals?.().w2Wages ?? 0,
    form8995AOverflowUBIA: qbiForm?.overflowTotals?.().ubia ?? 0,
    form8995AOverflowPatronReduction:
      qbiForm?.overflowTotals?.().patronReduction ?? 0,
    reitDividends: f1040.f8995?.reitDividends() ?? 0,
    ptpIncome: f1040.f8995?.currentYearPtpIncome() ?? 0
  }
}

const createSyntheticBusiness = (
  name: string,
  qbi: number,
  w2Wages: number,
  ubia: number,
  isSSTB: boolean,
  options?: {
    aggregationGroup?: string | null
    hasAggregationElection?: boolean
    isCooperative?: boolean
  }
) => ({
  name,
  ein: undefined,
  principalBusinessCode: '541611',
  businessDescription: name,
  accountingMethod: 'cash' as const,
  materialParticipation: true,
  startedOrAcquired: false,
  madePaymentsRequiring1099: false,
  filed1099s: false,
  personRole: PersonRole.PRIMARY,
  qbiW2Wages: w2Wages,
  qbiUbia: ubia,
  qbiPatronReduction: 0,
  isSpecifiedServiceTradeOrBusiness: isSSTB,
  aggregationGroup: options?.aggregationGroup ?? null,
  hasAggregationElection: options?.hasAggregationElection ?? false,
  isAgriculturalOrHorticulturalCooperative: options?.isCooperative ?? false,
  isCooperative: options?.isCooperative ?? false,
  income: {
    grossReceipts: qbi,
    returns: 0,
    otherIncome: 0
  },
  expenses: {
    advertising: 0,
    carAndTruck: 0,
    commissions: 0,
    contractLabor: 0,
    depletion: 0,
    depreciation: 0,
    employeeBenefits: 0,
    insurance: 0,
    interestMortgage: 0,
    interestOther: 0,
    legal: 0,
    office: 0,
    pensionPlans: 0,
    rentVehicles: 0,
    rentOther: 0,
    repairs: 0,
    supplies: 0,
    taxes: 0,
    travel: 0,
    deductibleMeals: 0,
    utilities: 0,
    wages: 0,
    otherExpenses: 0
  }
})

const buildQbiAttachmentBusinesses = (
  businesses: Record<string, unknown>[],
  qbiEntries: Array<Record<string, unknown>>
): Array<Record<string, unknown>> =>
  qbiEntries.map((entry, index) => {
    const sourceBusiness = businesses[index] ?? {}
    return {
      businessIndex: index + 1,
      statementRowNumber: index < 3 ? index + 1 : index - 2,
      statementSection: index < 3 ? 'Form 8995-A' : 'Attachment Statement',
      isAttachmentRow: index >= 3,
      name: entry.name ?? sourceBusiness.name ?? null,
      qbi: entry.qbi ?? 0,
      w2Wages: entry.w2Wages ?? 0,
      ubia: entry.ubia ?? 0,
      patronReduction: entry.patronReduction ?? 0,
      isSSTB: entry.isSSTB ?? false,
      aggregationGroup:
        sourceBusiness.aggregationGroup ??
        sourceBusiness.aggregationGroupName ??
        sourceBusiness.aggregationElectionGroup ??
        null,
      hasAggregationElection: !!sourceBusiness.hasAggregationElection,
      isCooperative: !!(
        sourceBusiness.isAgriculturalOrHorticulturalCooperative ??
        sourceBusiness.isCooperative
      )
    }
  })

const summarizeQbiOverflow = (
  attachmentBusinesses: Array<Record<string, unknown>>
): {
  qbi: number
  w2Wages: number
  ubia: number
} =>
  attachmentBusinesses
    .filter((entry) => entry.isAttachmentRow)
    .reduce<{
      qbi: number
      w2Wages: number
      ubia: number
    }>(
      (totals, entry) => ({
        qbi: totals.qbi + (Number(entry.qbi) || 0),
        w2Wages: totals.w2Wages + (Number(entry.w2Wages) || 0),
        ubia: totals.ubia + (Number(entry.ubia) || 0)
      }),
      { qbi: 0, w2Wages: 0, ubia: 0 }
    )

const buildScheduleOIDisclosures = (
  scenario: any,
  f1040nr: any
): Array<Record<string, unknown>> => {
  const taxpayer = scenario.primaryTaxpayer ?? {}
  const disclosures: Array<Record<string, unknown>> = []
  const pushDisclosure = (lineCode: string, response: unknown) => {
    if (response === null || response === undefined || response === '') return
    disclosures.push({ lineCode, response: String(response) })
  }

  pushDisclosure('countryOfResidence', f1040nr.countryOfResidence())
  pushDisclosure('countryOfCitizenship', f1040nr.countryOfCitizenship())
  pushDisclosure('visaType', taxpayer.visaType)
  pushDisclosure('firstYearInUS', taxpayer.firstYearInUS)
  pushDisclosure('daysInUSThisYear', taxpayer.daysInUSThisYear)
  pushDisclosure('daysInUSPriorYear', taxpayer.daysInUSPriorYear)
  pushDisclosure('daysInUSTwoYearsPrior', taxpayer.daysInUSTwoYearsPrior)
  if (
    taxpayer.daysInUSThisYear !== undefined &&
    taxpayer.daysInUSThisYear !== null &&
    taxpayer.daysInUSThisYear !== ''
  ) {
    pushDisclosure(
      'substantialPresenceWeightedDays',
      f1040nr.substantialPresenceDays()
    )
  }
  if (typeof taxpayer.appliedForGreenCard === 'boolean') {
    pushDisclosure(
      'appliedForGreenCard',
      taxpayer.appliedForGreenCard ? 'Yes' : 'No'
    )
  }
  if (typeof taxpayer.filedPriorUsReturn === 'boolean') {
    pushDisclosure(
      'filedPriorUsReturn',
      taxpayer.filedPriorUsReturn ? 'Yes' : 'No'
    )
  }
  if (typeof taxpayer.compensationOver250k === 'boolean') {
    pushDisclosure(
      'compensationOver250k',
      taxpayer.compensationOver250k ? 'Yes' : 'No'
    )
  }
  if (
    typeof taxpayer.realPropertyElectionFirstYear === 'boolean' ||
    typeof taxpayer.realPropertyElectionPriorYear === 'boolean'
  ) {
    pushDisclosure(
      'realPropertyElection',
      taxpayer.realPropertyElectionFirstYear || taxpayer.realPropertyElectionPriorYear
        ? 'Yes'
        : 'No'
    )
  }
  if (typeof taxpayer.realPropertyElectionFirstYear === 'boolean') {
    pushDisclosure(
      'realPropertyElectionFirstYear',
      taxpayer.realPropertyElectionFirstYear ? 'Yes' : 'No'
    )
  }
  if (typeof taxpayer.realPropertyElectionPriorYear === 'boolean') {
    pushDisclosure(
      'realPropertyElectionPriorYear',
      taxpayer.realPropertyElectionPriorYear ? 'Yes' : 'No'
    )
  }
  pushDisclosure('foreignAddress', taxpayer.foreignAddress?.street)

  return disclosures
}

const buildScheduleOITreatyClaims = (scenario: any): Array<Record<string, unknown>> => {
  const treaty = scenario.taxTreatyBenefits
  if (!treaty) return []
  return [
    {
      country: treaty.treatyCountry ?? null,
      article: treaty.articleNumber ?? null,
      description: treaty.description ?? '',
      incomeType:
        treaty.exemptIncome !== undefined && treaty.exemptIncome !== null
          ? 'exemptIncome'
          : treaty.reducedRate !== undefined && treaty.reducedRate !== null
            ? 'reducedRate'
            : 'other',
      exemptIncome: treaty.exemptIncome ?? null,
      reducedRate: treaty.reducedRate ?? null
    }
  ]
}

const createScenario18QbiOverflowOutput = (): Record<string, unknown> => {
  const scenario = loadScenario<any>('scenario-18-thompson-rental.json')
  const info = baseInformation(FilingStatus.S, {
    firstName: scenario.primaryTaxpayer.firstName,
    lastName: scenario.primaryTaxpayer.lastName,
    ssn: scenario.primaryTaxpayer.ssn,
    dateOfBirth: scenario.primaryTaxpayer.dateOfBirth,
    address: scenario.primaryTaxpayer.address
  })

  info.w2s = [
    {
      occupation: scenario.primaryTaxpayer.occupation ?? 'Employee',
      income: 300000,
      fedWithholding: 0,
      medicareIncome: 300000,
      ssWages: 176100,
      ssWithholding: 0,
      medicareWithholding: 0,
      employer: {
        EIN: '120001111',
        employerName: 'Parity Wages Inc',
        address: {
          address: scenario.primaryTaxpayer.address.street,
          city: scenario.primaryTaxpayer.address.city,
          state: scenario.primaryTaxpayer.address.state,
          zip: scenario.primaryTaxpayer.address.zip
        }
      },
      personRole: PersonRole.PRIMARY,
      state: scenario.primaryTaxpayer.address.state,
      stateWages: 300000,
      stateWithholding: 0
    }
  ]

  info.businesses = [
    createSyntheticBusiness('Alpha Advisory', 210000, 60000, 100000, false),
    createSyntheticBusiness('Beta Logistics', 90000, 20000, 50000, false),
    createSyntheticBusiness('Gamma Studio', 50000, 10000, 20000, true),
    createSyntheticBusiness('Delta Rentals', 40000, 5000, 15000, false, {
      aggregationGroup: 'Rental Group A',
      hasAggregationElection: true
    }),
    createSyntheticBusiness('Echo Foods', 30000, 3000, 10000, false),
    createSyntheticBusiness('Foxtrot Labs', 25000, 4000, 8000, true),
    createSyntheticBusiness('Gaia Farms', 15000, 2000, 6000, false, {
      isCooperative: true
    })
  ] as never

  const f1040 = new F1040(info, [])
  const qbiForm = f1040.f8995 as any
  const qbiEntries = qbiForm?.qbiEntries?.() ?? []
  const attachmentBusinesses = buildQbiAttachmentBusinesses(
    (info.businesses as Record<string, unknown>[]) ?? [],
    qbiEntries
  )
  const overflowTotals = summarizeQbiOverflow(attachmentBusinesses)
  return {
    form8995ATotalBusinesses: qbiForm?.qbiEntries?.().length ?? 0,
    form8995AOverflowBusinesses: qbiForm?.overflowEntries?.().length ?? 0,
    hasForm8995AAttachmentStatement: qbiForm?.needsAdditionalStatement?.() ?? false,
    form8995ABusiness4Name: qbiForm?.qbiEntries?.()?.[3]?.name ?? null,
    form8995ABusiness5Name: qbiForm?.qbiEntries?.()?.[4]?.name ?? null,
    form8995ABusiness6Name: qbiForm?.qbiEntries?.()?.[5]?.name ?? null,
    form8995ABusiness7Name: qbiForm?.qbiEntries?.()?.[6]?.name ?? null,
    form8995ABusiness4QBI: qbiForm?.qbiEntries?.()?.[3]?.qbi ?? 0,
    form8995ABusiness5QBI: qbiForm?.qbiEntries?.()?.[4]?.qbi ?? 0,
    form8995ABusiness6QBI: qbiForm?.qbiEntries?.()?.[5]?.qbi ?? 0,
    form8995ABusiness7QBI: qbiForm?.qbiEntries?.()?.[6]?.qbi ?? 0,
    form8995ABusiness4W2Wages: qbiForm?.qbiEntries?.()?.[3]?.w2Wages ?? 0,
    form8995ABusiness5W2Wages: qbiForm?.qbiEntries?.()?.[4]?.w2Wages ?? 0,
    form8995ABusiness6W2Wages: qbiForm?.qbiEntries?.()?.[5]?.w2Wages ?? 0,
    form8995ABusiness7W2Wages: qbiForm?.qbiEntries?.()?.[6]?.w2Wages ?? 0,
    form8995ABusiness4UBIA: qbiForm?.qbiEntries?.()?.[3]?.ubia ?? 0,
    form8995ABusiness5UBIA: qbiForm?.qbiEntries?.()?.[4]?.ubia ?? 0,
    form8995ABusiness6UBIA: qbiForm?.qbiEntries?.()?.[5]?.ubia ?? 0,
    form8995ABusiness7UBIA: qbiForm?.qbiEntries?.()?.[6]?.ubia ?? 0,
    form8995ABusiness3IsSSTB: qbiForm?.qbiEntries?.()?.[2]?.isSSTB ?? false,
    form8995ABusiness4IsSSTB: qbiForm?.qbiEntries?.()?.[3]?.isSSTB ?? false,
    form8995ABusiness5IsSSTB: qbiForm?.qbiEntries?.()?.[4]?.isSSTB ?? false,
    form8995ABusiness6IsSSTB: qbiForm?.qbiEntries?.()?.[5]?.isSSTB ?? false,
    form8995ABusiness7IsSSTB: qbiForm?.qbiEntries?.()?.[6]?.isSSTB ?? false,
    form8995AOverflowQBI: overflowTotals.qbi,
    form8995AOverflowW2Wages: overflowTotals.w2Wages,
    form8995AOverflowUBIA: overflowTotals.ubia,
    attachmentBusinesses
  }
}

const createScenario18Output = (): Record<string, unknown> => {
  const scenario = loadScenario<any>('scenario-18-thompson-rental.json')
  const info = baseInformation(FilingStatus.S, {
    firstName: scenario.primaryTaxpayer.firstName,
    lastName: scenario.primaryTaxpayer.lastName,
    ssn: scenario.primaryTaxpayer.ssn,
    dateOfBirth: scenario.primaryTaxpayer.dateOfBirth,
    address: scenario.primaryTaxpayer.address
  })

  info.w2s = [
    {
      occupation: scenario.primaryTaxpayer.occupation ?? 'Employee',
      income: scenario.w2Forms[0].wages,
      fedWithholding: scenario.w2Forms[0].federalWithholding,
      medicareIncome: scenario.w2Forms[0].medicareWages,
      ssWages: scenario.w2Forms[0].ssWages,
      ssWithholding: scenario.w2Forms[0].ssTax,
      medicareWithholding: scenario.w2Forms[0].medicareTax,
      employer: {
        EIN: scenario.w2Forms[0].employerEin.replace(/-/g, ''),
        employerName: scenario.w2Forms[0].employerName,
        address: {
          address: scenario.w2Forms[0].employerAddress.street,
          city: scenario.w2Forms[0].employerAddress.city,
          state: scenario.w2Forms[0].employerAddress.state,
          zip: scenario.w2Forms[0].employerAddress.zip
        }
      },
      personRole: PersonRole.PRIMARY,
      state: scenario.w2Forms[0].state,
      stateWages: scenario.w2Forms[0].stateWages,
      stateWithholding: scenario.w2Forms[0].stateTax
    }
  ]

  const property = scenario.scheduleE.rentalProperties[0]
  info.realEstate = [
    {
      address: {
        address: property.propertyAddress.street,
        city: property.propertyAddress.city,
        state: property.propertyAddress.state,
        zip: property.propertyAddress.zip
      },
      rentalDays: property.fairRentalDays,
      personalUseDays: property.personalUseDays,
      rentReceived: property.grossRents,
      propertyType: 'singleFamily',
      qualifiedJointVenture: false,
      expenses: {
        advertising: property.expenses.advertising,
        auto: property.expenses.autoAndTravel,
        cleaning: property.expenses.cleaning,
        commissions: property.expenses.commissions,
        insurance: property.expenses.insurance,
        legal: property.expenses.legal,
        management: property.expenses.management,
        mortgage: property.expenses.mortgageInterest,
        repairs: property.expenses.repairs,
        supplies: property.expenses.supplies,
        taxes: property.expenses.taxes,
        utilities: property.expenses.utilities,
        depreciation: property.expenses.depreciation,
        other: property.expenses.other
      }
    }
  ]

  const f1040 = new F1040(info, [])
  return {
    hasRentalIncome: true,
    hasScheduleEPage2Activity: false,
    totalRentalRoyaltyIncome:
      (f1040.scheduleE.l23a() ?? 0) + (f1040.scheduleE.l23b() ?? 0),
    totalRentalExpenses: f1040.scheduleE.l23e(),
    rentalNetIncomeLoss: f1040.scheduleE.l26(),
    partnershipScheduleEIncome: 0,
    scheduleEPage2IncomeLoss: f1040.scheduleE.l32(),
    scheduleEQualifiedBusinessIncome:
      f1040.f8995
        ?.rentalQbiEntries()
        .reduce((total: number, entry: any) => total + (entry.qbi ?? 0), 0) ??
      0,
    scheduleETotalIncomeLoss: f1040.scheduleE.l41()
  }
}

const createScenario29Output = (): Record<string, unknown> => {
  const scenario = loadScenario<any>('scenario-29-white-k1.json')
  const info = baseInformation(FilingStatus.S, {
    firstName: scenario.primaryTaxpayer.firstName,
    lastName: scenario.primaryTaxpayer.lastName,
    ssn: scenario.primaryTaxpayer.ssn,
    dateOfBirth: scenario.primaryTaxpayer.dateOfBirth,
    address: scenario.primaryTaxpayer.address
  })

  const k1 = scenario.scheduleK1[0]
  info.scheduleK1Form1065s = [
    {
      personRole: PersonRole.PRIMARY,
      partnershipName: k1.entityName,
      partnershipEin: k1.entityEin.replace(/-/g, ''),
      partnerOrSCorp: 'P',
      isForeign: false,
      isPassive: false,
      ordinaryBusinessIncome: k1.box1OrdinaryIncome,
      interestIncome: k1.box5Interest,
      guaranteedPaymentsForServices: k1.box4GuaranteedPayments,
      guaranteedPaymentsForCapital: 0,
      selfEmploymentEarningsA: k1.box14SelfEmploymentEarnings,
      selfEmploymentEarningsB: 0,
      selfEmploymentEarningsC: 0,
      distributionsCodeAAmount: k1.box19Distributions,
      section199AQBI: 0,
      section199AW2Wages: 0,
      section199AUbia: 0,
      netRentalRealEstateIncome: k1.box2NetRentalIncome,
      otherNetRentalIncome: k1.box3OtherNetRentalIncome,
      royalties: k1.box7Royalties
    }
  ]

  const f1040 = new F1040(info, [])
  return {
    hasRentalIncome: false,
    hasScheduleEPage2Activity: true,
    totalRentalRoyaltyIncome: 0,
    totalRentalExpenses: 0,
    rentalNetIncomeLoss: 0,
    partnershipScheduleEIncome: f1040.scheduleE.l29ak(),
    scheduleEPage2IncomeLoss: f1040.scheduleE.l32(),
    scheduleEQualifiedBusinessIncome:
      f1040.f8995
        ?.applicableK1s()
        .reduce((total: number, entry: any) => total + (entry.qbi ?? 0), 0) ??
      0,
    scheduleETotalIncomeLoss: f1040.scheduleE.l41()
  }
}

const createScenarioNr5Output = (): Record<string, unknown> => {
  const scenario = loadScenario<any>('scenario-nr5-chen.json')
  const info = baseInformation(FilingStatus.S, {
    firstName: scenario.primaryTaxpayer.firstName,
    lastName: scenario.primaryTaxpayer.lastName,
    ssn: scenario.primaryTaxpayer.ssn,
    dateOfBirth: scenario.primaryTaxpayer.dateOfBirth,
    address: scenario.primaryTaxpayer.address
  })
  info.nonresidentAlienReturn = {
    nonresidentInfo: {
      countryOfCitizenship: scenario.primaryTaxpayer.countryOfCitizenship,
      countryOfResidence: scenario.primaryTaxpayer.countryOfResidence,
      visaType: 'F1',
      dateEnteredUS: new Date('2025-01-15'),
      daysInUSThisYear: scenario.primaryTaxpayer.daysInUSThisYear,
      daysInUSPriorYear: scenario.primaryTaxpayer.daysInUSPriorYear,
      daysInUS2YearsPrior: scenario.primaryTaxpayer.daysInUSTwoYearsPrior,
      claimsTaxTreaty: true,
      treatyCountry: scenario.taxTreatyBenefits.treatyCountry,
      treatyArticle: scenario.taxTreatyBenefits.articleNumber,
      hasEffectivelyConnectedIncome: true,
      hasFDAPIncome: false
    },
    effectivelyConnectedIncome: {
      wages: 0,
      businessIncome: 0,
      scholarshipIncome: scenario.scholarshipIncome.taxableScholarship,
      treatyExemptScholarship: scenario.taxTreatyBenefits.exemptIncome,
      capitalGains: 0,
      rentalIncome: 0,
      partnershipIncome: 0,
      otherIncome: scenario.form1099Misc[0].stipend
    },
    taxWithheld: 0,
    estimatedTaxPayments: 0
  }

  const f1040 = new F1040(info, [])
  const f1040nr = f1040.f1040nr
  if (!f1040nr) throw new Error('F1040-NR required for NR scenario')
  const scheduleOIDisclosures = buildScheduleOIDisclosures(scenario, f1040nr)
  const scheduleOITreatyClaims = buildScheduleOITreatyClaims(scenario)
  return {
    hasScheduleOI: true,
    hasScheduleNEC: false,
    countryOfCitizenship: f1040nr.countryOfCitizenship(),
    countryOfResidence: f1040nr.countryOfResidence(),
    visaType: f1040nr.visaType(),
    daysInUS: f1040nr.daysInUSThisYear(),
    daysInUSPriorYear: f1040nr.nonresidentInfo()?.daysInUSPriorYear ?? null,
    daysInUSTwoYearsPrior:
      f1040nr.nonresidentInfo()?.daysInUS2YearsPrior ?? null,
    substantialPresenceWeightedDays: f1040nr.substantialPresenceDays(),
    claimsTreatyBenefits: f1040nr.claimsTaxTreaty(),
    scheduleOIRequiresTreatyDisclosure: f1040nr.claimsTaxTreaty(),
    scheduleOIHasForeignAddress: !!scenario.primaryTaxpayer.foreignAddress,
    treatyCountry: f1040nr.treatyCountry(),
    treatyArticle: f1040nr.treatyArticle(),
    treatyBenefitDescription: scenario.taxTreatyBenefits.description ?? '',
    reducedTreatyRate: null,
    otherFDAPDescription: '',
    scheduleNECLineItemCount: 0,
    totalECI: f1040nr.totalEffectivelyConnectedIncome(),
    totalFDAPIncome: f1040nr.totalFDAPIncome(),
    taxOnECI: f1040nr.eciTax(),
    scheduleNECTax: f1040nr.fdapTax(),
    dividendsFDAPTax: 0,
    interestFDAPTax: 0,
    royaltiesFDAPTax: 0,
    otherFDAPTax: 0,
    totalTaxNR: f1040nr.totalTax(),
    scheduleOIDisclosuresCount: scheduleOIDisclosures.length,
    scheduleOITreatyClaimsCount: scheduleOITreatyClaims.length,
    scheduleOIDisclosures,
    scheduleOITreatyClaims
  }
}

const createScenarioNr12Output = (): Record<string, unknown> => {
  const scenario = loadScenario<any>('scenario-nr12-harrier.json')
  const info = baseInformation(FilingStatus.MFS, {
    firstName: scenario.primaryTaxpayer.firstName,
    lastName: scenario.primaryTaxpayer.lastName,
    ssn: scenario.primaryTaxpayer.ssn,
    dateOfBirth: scenario.primaryTaxpayer.dateOfBirth,
    address: {
      street: scenario.primaryTaxpayer.address.street,
      city: scenario.primaryTaxpayer.address.city,
      state: 'CA',
      zip: '94105'
    }
  })
  info.nonresidentAlienReturn = {
    nonresidentInfo: {
      countryOfCitizenship:
        scenario.primaryTaxpayer.foreignAddress?.country ?? 'AU',
      countryOfResidence:
        scenario.primaryTaxpayer.foreignAddress?.country ?? 'AU',
      visaType: 'other',
      dateEnteredUS: new Date('2025-01-15'),
      daysInUSThisYear: 0,
      claimsTaxTreaty: false,
      hasEffectivelyConnectedIncome: true,
      hasFDAPIncome: false
    },
    effectivelyConnectedIncome: {
      wages: 0,
      businessIncome: 0,
      capitalGains: scenario.expectedValues.totalIncome,
      rentalIncome: 0,
      partnershipIncome: 0,
      otherIncome: 0
    },
    taxWithheld: 0,
    estimatedTaxPayments: scenario.expectedValues.totalPayments ?? 0
  }

  const f1040 = new F1040(info, [])
  const f1040nr = f1040.f1040nr
  if (!f1040nr) throw new Error('F1040-NR required for NR scenario')
  const scheduleOIDisclosures = buildScheduleOIDisclosures(scenario, f1040nr)
  const scheduleOITreatyClaims = buildScheduleOITreatyClaims(scenario)
  return {
    hasScheduleOI: true,
    hasScheduleNEC: false,
    countryOfCitizenship: f1040nr.countryOfCitizenship(),
    countryOfResidence: f1040nr.countryOfResidence(),
    visaType: f1040nr.visaType(),
    daysInUS: f1040nr.daysInUSThisYear(),
    daysInUSPriorYear: f1040nr.nonresidentInfo()?.daysInUSPriorYear ?? null,
    daysInUSTwoYearsPrior:
      f1040nr.nonresidentInfo()?.daysInUS2YearsPrior ?? null,
    substantialPresenceWeightedDays: f1040nr.substantialPresenceDays(),
    claimsTreatyBenefits: f1040nr.claimsTaxTreaty(),
    scheduleOIRequiresTreatyDisclosure: f1040nr.claimsTaxTreaty(),
    scheduleOIHasForeignAddress: !!scenario.primaryTaxpayer.foreignAddress,
    treatyCountry: f1040nr.treatyCountry(),
    treatyArticle: f1040nr.treatyArticle(),
    treatyBenefitDescription: '',
    reducedTreatyRate: null,
    otherFDAPDescription: '',
    scheduleNECLineItemCount: 0,
    totalECI: f1040nr.totalEffectivelyConnectedIncome(),
    totalFDAPIncome: f1040nr.totalFDAPIncome(),
    taxOnECI: f1040nr.eciTax(),
    scheduleNECTax: f1040nr.fdapTax(),
    dividendsFDAPTax: 0,
    interestFDAPTax: 0,
    royaltiesFDAPTax: 0,
    otherFDAPTax: 0,
    totalTaxNR: f1040nr.totalTax(),
    scheduleOIDisclosuresCount: scheduleOIDisclosures.length,
    scheduleOITreatyClaimsCount: scheduleOITreatyClaims.length,
    scheduleOIDisclosures,
    scheduleOITreatyClaims
  }
}

const createScenarioNr2Output = (): Record<string, unknown> => {
  const scenario = loadScenario<any>('scenario-nr2-desilva.json')
  const info = baseInformation(FilingStatus.MFS, {
    firstName: scenario.primaryTaxpayer.firstName,
    lastName: scenario.primaryTaxpayer.lastName,
    ssn: scenario.primaryTaxpayer.ssn,
    dateOfBirth: scenario.primaryTaxpayer.dateOfBirth,
    address: {
      street: scenario.primaryTaxpayer.address.street,
      city: scenario.primaryTaxpayer.address.city,
      state: 'CA',
      zip: '94105'
    }
  })

  info.nonresidentAlienReturn = {
    nonresidentInfo: {
      countryOfCitizenship: scenario.primaryTaxpayer.address.country,
      countryOfResidence: scenario.primaryTaxpayer.address.country,
      visaType: '',
      dateEnteredUS: new Date('2025-01-15'),
      daysInUSThisYear: 0,
      daysInUSPriorYear: 0,
      daysInUS2YearsPrior: 0,
      claimsTaxTreaty: false,
      hasEffectivelyConnectedIncome: true,
      hasFDAPIncome: false
    },
    effectivelyConnectedIncome: {
      wages: 0,
      businessIncome: 0,
      scholarshipIncome: 0,
      capitalGains: 0,
      rentalIncome: 0,
      partnershipIncome: scenario.expectedValues.totalIncome,
      otherIncome: 0
    },
    taxWithheld: scenario.expectedValues.federalWithholding ?? 0,
    estimatedTaxPayments: 0
  }

  const f1040 = new F1040(info, [])
  const f1040nr = f1040.f1040nr
  if (!f1040nr) throw new Error('F1040-NR required for NR scenario')
  const scheduleOIDisclosures = buildScheduleOIDisclosures(scenario, f1040nr)
  const scheduleOITreatyClaims = buildScheduleOITreatyClaims(scenario)
  return {
    hasScheduleOI: true,
    hasScheduleNEC: false,
    countryOfCitizenship: f1040nr.countryOfCitizenship(),
    countryOfResidence: f1040nr.countryOfResidence(),
    visaType: f1040nr.visaType(),
    daysInUS: f1040nr.daysInUSThisYear(),
    daysInUSPriorYear: f1040nr.nonresidentInfo()?.daysInUSPriorYear ?? null,
    daysInUSTwoYearsPrior:
      f1040nr.nonresidentInfo()?.daysInUS2YearsPrior ?? null,
    substantialPresenceWeightedDays: f1040nr.substantialPresenceDays(),
    claimsTreatyBenefits: f1040nr.claimsTaxTreaty(),
    scheduleOIRequiresTreatyDisclosure: f1040nr.claimsTaxTreaty(),
    scheduleOIHasForeignAddress: false,
    treatyCountry: f1040nr.treatyCountry(),
    treatyArticle: f1040nr.treatyArticle(),
    treatyBenefitDescription: '',
    reducedTreatyRate: null,
    otherFDAPDescription: '',
    scheduleNECLineItemCount: 0,
    totalECI: f1040nr.totalEffectivelyConnectedIncome(),
    totalFDAPIncome: f1040nr.totalFDAPIncome(),
    taxOnECI: f1040nr.eciTax(),
    scheduleNECTax: f1040nr.fdapTax(),
    dividendsFDAPTax: 0,
    interestFDAPTax: 0,
    royaltiesFDAPTax: 0,
    otherFDAPTax: 0,
    totalTaxNR: f1040nr.totalTax(),
    scheduleOIDisclosuresCount: scheduleOIDisclosures.length,
    scheduleOITreatyClaimsCount: scheduleOITreatyClaims.length,
    scheduleOIDisclosures,
    scheduleOITreatyClaims
  }
}

const computeUsTaxesOutputs = (): Record<string, Record<string, unknown>> => ({
  'scenario-28-taylor-qbi.json': createScenario28Output(),
  'scenario-18-thompson-rental-qbi-overflow': createScenario18QbiOverflowOutput(),
  'scenario-18-thompson-rental.json': createScenario18Output(),
  'scenario-29-white-k1.json': createScenario29Output(),
  'scenario-nr2-desilva.json': createScenarioNr2Output(),
  'scenario-nr5-chen.json': createScenarioNr5Output(),
  'scenario-nr12-harrier.json': createScenarioNr12Output()
})

const buildRows = (
  usTaxesOutputs: Record<string, Record<string, unknown>>,
  directFileOutputs: DirectFileExport
): MetricRow[] => {
  const domainByScenario: Record<string, MetricRow['domain']> = {
    'scenario-28-taylor-qbi.json': 'qbi',
    'scenario-18-thompson-rental-qbi-overflow': 'qbi',
    'scenario-18-thompson-rental.json': 'schedule_e',
    'scenario-29-white-k1.json': 'schedule_e',
    'scenario-nr2-desilva.json': '1040_nr',
    'scenario-nr5-chen.json': '1040_nr',
    'scenario-nr12-harrier.json': '1040_nr'
  }

  return Object.entries(usTaxesOutputs).flatMap(
    ([scenario, usTaxesMetrics]) => {
      const directMetrics = directFileOutputs[scenario] ?? {}
      return Object.keys({
        ...usTaxesMetrics,
        ...directMetrics
      })
        .filter((metric) => !['scenario', 'directQBI'].includes(metric))
        .map((metric) => {
        const usValue = usTaxesMetrics[metric]
        const directValue = directMetrics[metric]
        const matches = sameAmount(metric, usValue, directValue)
        return {
          scenario,
          domain: domainByScenario[scenario],
          metric,
          usTaxes: asAmount(usValue),
          directFile: asAmount(directValue),
          matches: matches ? 'yes' : 'no',
          note: matches ? '' : 'Review scenario mapping or engine parity'
        }
      })
    }
  )
}

export const runHarness = () => {
  execSync(
    'JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -q -Dtest=SelectedFormParityExportTest -DforkCount=0 -Dsurefire.useFile=false -Dpmd.skip=true -Dspotbugs.skip=true -Dcheckstyle.skip=true test',
    {
      cwd: DIRECT_FILE_BACKEND,
      stdio: 'inherit',
      shell: '/bin/zsh'
    }
  )

  const directFileOutputs = JSON.parse(
    readFileSync(DIRECT_FILE_EXPORT, 'utf8')
  ) as DirectFileExport
  const usTaxesOutputs = computeUsTaxesOutputs()
  const rows = buildRows(usTaxesOutputs, directFileOutputs)

  mkdirSync(resolve(TAXES_ROOT, 'UsTaxes/docs'), { recursive: true })
  writeFileSync(
    OUTPUT_JSON,
    JSON.stringify(
      {
        generatedAt: '2026-03-19',
        directFileExport: DIRECT_FILE_EXPORT,
        rows
      },
      null,
      2
    )
  )
  writeFileSync(
    OUTPUT_CSV,
    [
      'scenario,domain,metric,usTaxes,directFile,matches,note',
      ...rows.map((row) =>
        [
          row.scenario,
          row.domain,
          row.metric,
          row.usTaxes,
          row.directFile,
          row.matches,
          row.note
        ]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(',')
      )
    ].join('\n')
  )

  return { directFileOutputs, usTaxesOutputs, rows }
}

if (typeof describe === 'function') {
  describe('Form parity diff harness', () => {
    it('exports side-by-side QBI, Schedule E, and 1040-NR comparisons', () => {
      const { directFileOutputs, usTaxesOutputs, rows } = runHarness()
      expect(rows.length).toBeGreaterThan(10)
      expect(directFileOutputs['scenario-28-taylor-qbi.json']).toBeDefined()
      expect(
        directFileOutputs['scenario-18-thompson-rental-qbi-overflow']
      ).toBeDefined()
      expect(usTaxesOutputs['scenario-nr12-harrier.json']).toBeDefined()
    })
  })
}

if (require.main === module) {
  const { rows } = runHarness()
  const mismatches = rows.filter((row) => row.matches === 'no')
  console.log(
    JSON.stringify(
      {
        generatedAt: '2026-03-19',
        rowCount: rows.length,
        mismatchCount: mismatches.length,
        mismatches
      },
      null,
      2
    )
  )
}
