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
  type EnergyImprovementType,
  type AdoptedChild,
  type ForeignEarnedIncomeInfo,
  type HealthInsuranceMarketplaceInfo,
  type IraContribution,
  type RothConversion,
  type LocalTaxInfo,
  W2Box12Code,
  IraPlanType,
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
  type ParentTaxInfo,
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
  adjustedTotalIncome?: number
  distributionDeduction?: number
  exemption?: number
  beneficiaryCount?: number
  requiredForms?: string[]
  hazardFlags?: string[]
  corporateTaxAdjustments?: Array<{
    code: string
    description: string
    amount?: number
    effect: 'income_increase' | 'deduction_disallowance'
  }>
  complianceAlerts?: Array<{
    code: string
    severity: 'info' | 'warning' | 'error'
    description: string
  }>
  schedules: string[]
}

export interface OwnerAllocation {
  name: string
  ownershipPct: number
  ordinaryIncome: number
  netRentalIncome: number
  interestIncome: number
  dividendIncome: number
  qualifiedDividends: number
  capitalGains: number
  otherIncome: number
  section179Deduction: number
  otherDeductions: number
  taxExemptInterest: number
  cashDistributions: number
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

const resolvePersonRole = (
  value: unknown
): PersonRole.PRIMARY | PersonRole.SPOUSE => {
  const normalized = toStr(value).toLowerCase().trim()
  return normalized === 'spouse' || normalized === 'secondary'
    ? PersonRole.SPOUSE
    : PersonRole.PRIMARY
}

const parse1099BTerm = (value: unknown): 'short' | 'long' | 'unknown' => {
  const normalized = toStr(value).toLowerCase().trim()
  if (normalized.startsWith('s')) return 'short'
  if (normalized.startsWith('l')) return 'long'
  return 'unknown'
}

const buildRawItemizedDeductions = (facts: FactsRecord) => {
  const d = asRecord(facts.itemizedDeductions)
  const raw = {
    medicalAndDental: toNum(
      d.medicalAndDental ??
        d.medicalDental ??
        d.medicalExpenses ??
        facts.medicalAndDental ??
        facts.medicalExpenses
    ),
    stateAndLocalTaxes: toNum(
      d.stateAndLocalTaxes ??
        d.stateLocalIncomeTax ??
        d.stateTax ??
        d.stateTaxes ??
        d.stateIncomeTaxes ??
        d.salesTaxes ??
        facts.stateAndLocalTaxes ??
        facts.stateIncomeTaxes ??
        facts.stateTaxes
    ),
    isSalesTax: toBool(
      d.isSalesTax ?? d.useSalesTax ?? d.salesTaxElection ?? facts.isSalesTax
    ),
    stateAndLocalRealEstateTaxes: toNum(
      d.stateAndLocalRealEstateTaxes ??
        d.realEstateTaxes ??
        d.propertyTaxes ??
        facts.realEstateTaxes ??
        facts.propertyTaxes
    ),
    stateAndLocalPropertyTaxes: toNum(
      d.stateAndLocalPropertyTaxes ??
        d.personalPropertyTaxes ??
        facts.personalPropertyTaxes
    ),
    interest8a: toNum(
      d.interest8a ??
        d.mortgageInterest ??
        d.homeMortgageInterest ??
        facts.mortgageInterest
    ),
    interest8b: toNum(
      d.interest8b ?? d.pointsNotReported ?? d.points ?? facts.pointsNotReported
    ),
    interest8c: toNum(
      d.interest8c ??
        d.mortgageInsurancePremiums ??
        d.homeEquityInterest ??
        facts.homeEquityInterest
    ),
    interest8d: toNum(d.interest8d ?? facts.interest8d),
    investmentInterest: toNum(
      d.investmentInterest ?? d.marginInterest ?? facts.investmentInterest
    ),
    charityCashCheck: toNum(
      d.charityCashCheck ??
        d.charityCash ??
        d.cashContributions ??
        d.charitableContributions ??
        facts.charityCashCheck ??
        facts.cashContributions
    ),
    charityOther: toNum(
      d.charityOther ??
        d.charityNonCash ??
        d.noncashContributionsTotal ??
        facts.charityOther ??
        facts.charityNonCash
    ),
    casualtyLosses: toNum(
      d.casualtyLosses ?? facts.casualtyLosses ?? facts.disasterLosses
    ),
    otherDeductions: toNum(
      d.otherDeductions ??
        d.miscellaneousDeductions ??
        facts.otherDeductions ??
        facts.miscellaneousDeductions
    )
  }

  const hasAnyValue =
    raw.isSalesTax ||
    Object.entries(raw).some(
      ([key, value]) => key !== 'isSalesTax' && typeof value === 'number' && value > 0
    )

  return hasAnyValue ? raw : undefined
}

const normalizeVisaStatus = (value: unknown) => {
  const normalized = toStr(value).toUpperCase().replace(/[^A-Z0-9]/g, '')
  const supported = new Set([
    'F1',
    'J1',
    'M1',
    'Q1',
    'H1B',
    'L1',
    'O1',
    'TN'
  ])
  return supported.has(normalized) ? normalized : 'other'
}

type FdapIncomeCategory =
  | 'dividends'
  | 'interest'
  | 'rents'
  | 'royalties'
  | 'gambling'
  | 'socialSecurity'
  | 'capitalGains'
  | 'otherIncome'

const classifyScheduleNecIncomeType = (
  value: unknown
): FdapIncomeCategory => {
  const normalized = toStr(value).toLowerCase()
  if (normalized.includes('dividend')) return 'dividends'
  if (normalized.includes('interest')) return 'interest'
  if (normalized.includes('rent')) return 'rents'
  if (normalized.includes('royalt')) return 'royalties'
  if (normalized.includes('gambl')) return 'gambling'
  if (normalized.includes('social security')) return 'socialSecurity'
  if (normalized.includes('capital')) return 'capitalGains'
  return 'otherIncome'
}

const normalizeTreatyRate = (value: unknown): number | undefined => {
  const rate = toNum(value)
  if (rate <= 0) return undefined
  return rate > 1 ? rate / 100 : rate
}

const buildNonresidentAlienReturn = (
  facts: FactsRecord,
  rawItemizedDeductions?: ReturnType<typeof buildRawItemizedDeductions>
) => {
  const explicit = asRecord(facts.nonresidentAlienReturn)
  if (Object.keys(explicit).length > 0) {
    return explicit
  }

  const nonresidentProfile = asRecord(facts.nonresidentProfile)
  const foreignSummary = asRecord(facts.foreignSummary)
  const scheduleOi = asRecord(facts.nonresidentScheduleOi)
  const scheduleNecItems = asArray<Record<string, unknown>>(
    facts.nonresidentScheduleNecItems
  )
  const treatyClaims = asArray<Record<string, unknown>>(facts.treatyClaims)
  const confirmedTreatyClaims = treatyClaims.filter((claim) =>
    toBool(claim.confirmed ?? true)
  )

  const hasNonresidentActivity =
    toBool(nonresidentProfile.hasData) ||
    toBool(nonresidentProfile.requires1040NR) ||
    toBool(foreignSummary.requires1040NR) ||
    scheduleNecItems.length > 0 ||
    Object.keys(scheduleOi).length > 0

  if (!hasNonresidentActivity) {
    return undefined
  }

  const w2Records = asArray<Record<string, unknown>>(facts.w2Records)
  const form1099Records = asArray<Record<string, unknown>>(facts.form1099Records)
  const businessRecords = asArray<Record<string, unknown>>(facts.businessRecords)
  const rentalProperties = asArray<Record<string, unknown>>(facts.rentalProperties)
  const taxLots = asArray<Record<string, unknown>>(facts.taxLots)
  const unemploymentRecords = asArray<Record<string, unknown>>(
    facts.unemploymentRecords
  )
  const socialSecurityRecords = asArray<Record<string, unknown>>(
    facts.socialSecurityRecords
  )

  const eciWages = w2Records.reduce(
    (sum, record) => sum + toNum(record.box1Wages),
    0
  )
  const eciBusinessIncome = businessRecords.reduce((sum, record) => {
    const entityType = toStr(record.entityType)
    const isScheduleCRecord =
      entityType === 'schedule_c' ||
      (!entityType &&
        (record.income != null ||
          record.businessDescription != null ||
          record.principalBusinessCode != null))
    if (!isScheduleCRecord) return sum
    if (record.netBusinessIncome != null) {
      return sum + toNum(record.netBusinessIncome)
    }
    const incomeRecord = asRecord(record.income)
    const expenseRecord = asRecord(record.expenses)
    const income =
      toNum(record.grossReceipts) +
      toNum(record.otherIncome) +
      toNum(incomeRecord.grossReceipts) +
      toNum(incomeRecord.otherIncome)
    const expenses =
      toNum(record.totalExpenses) +
      toNum(record.cogs) +
      toNum(record.homeOfficeDeduction) +
      Object.values(expenseRecord).reduce<number>(
        (total, value) => total + toNum(value),
        0
      )
    return sum + Math.max(0, income - expenses)
  }, 0)
  const eciPartnershipIncome = businessRecords.reduce((sum, record) => {
    const entityType = toStr(record.entityType)
    const isK1Record =
      entityType === 'k1_entity' ||
      (!entityType &&
        (record.k1Box1 != null ||
          record.ordinaryIncome != null ||
          record.guaranteedPayments != null))
    if (!isK1Record) return sum
    return (
      sum +
      toNum(record.ordinaryIncome) +
      toNum(record.rentalIncome) +
      toNum(record.guaranteedPayments)
    )
  }, 0)
  const eciRentalIncome = rentalProperties.reduce(
    (sum, property) => sum + toNum(property.netIncomeLoss),
    0
  )
  const taxLotNetCapitalGain = taxLots.reduce(
    (sum, lot) => sum + (toNum(lot.proceeds) - toNum(lot.costBasis)),
    0
  )
  const form1099BNetCapitalGain = form1099Records.reduce((sum, record) => {
    const type = toStr(record.type).toUpperCase().replace('-', '')
    if (type !== '1099B' && type !== 'B') return sum
    const shortTermGain =
      toNum(record.shortTermProceeds) - toNum(record.shortTermCostBasis)
    const longTermGain =
      toNum(record.longTermProceeds) - toNum(record.longTermCostBasis)
    return sum + shortTermGain + longTermGain
  }, 0)
  const eciCapitalGains =
    form1099BNetCapitalGain !== 0 ? form1099BNetCapitalGain : taxLotNetCapitalGain

  const fdapIncome = {
    dividends: 0,
    interest: 0,
    rents: 0,
    royalties: 0,
    gambling: 0,
    socialSecurity: 0,
    capitalGains: 0,
    otherIncome: 0
  }

  for (const item of scheduleNecItems) {
    const category = classifyScheduleNecIncomeType(item.incomeType)
    fdapIncome[category] += toNum(item.grossAmount)
  }

  for (const record of form1099Records) {
    const type = toStr(record.type).toUpperCase().replace('-', '')
    if (type === '1099DIV' || type === 'DIV') {
      fdapIncome.dividends += toNum(
        record.ordinaryDividends ?? record.dividends ?? record.amount
      )
    } else if (type === '1099INT' || type === 'INT') {
      fdapIncome.interest += toNum(record.amount)
    } else if (type === '1099SSA' || type === 'SSA') {
      fdapIncome.socialSecurity += toNum(record.amount)
    } else if (type === '1099MISC' || type === 'MISC') {
      const notes = toStr(record.notes).toLowerCase()
      if (notes.includes('royalt')) {
        fdapIncome.royalties += toNum(record.amount)
      } else if (notes.includes('rent')) {
        fdapIncome.rents += toNum(record.amount)
      } else {
        fdapIncome.otherIncome += toNum(record.amount)
      }
    }
  }

  const firstTreatyClaim = confirmedTreatyClaims[0] ?? treatyClaims[0] ?? {}
  const scheduleNecTreatyRates = scheduleNecItems
    .map((item) =>
      normalizeTreatyRate(item.treatyRate ?? item.reducedTreatyRate)
    )
    .filter((rate): rate is number => rate !== undefined)
  const uniqueScheduleNecTreatyRates = Array.from(
    new Set(scheduleNecTreatyRates.map((rate) => rate.toFixed(6)))
  ).map((rate) => Number(rate))
  const treatyBenefitAmountFromClaims = confirmedTreatyClaims.reduce(
    (sum, claim) => sum + toNum(claim.exemptAmount ?? claim.treatyBenefitAmount),
    0
  )
  const reducedTreatyRate =
    normalizeTreatyRate(
      scheduleOi.reducedTreatyRate ??
        scheduleOi.treatyRate ??
        firstTreatyClaim.reducedTreatyRate ??
        firstTreatyClaim.reducedRate ??
        firstTreatyClaim.treatyRate
    ) ??
    (uniqueScheduleNecTreatyRates.length === 1
      ? uniqueScheduleNecTreatyRates[0]
      : undefined)
  const nrItemized =
    Object.keys(asRecord(scheduleOi.itemizedDeductions)).length > 0
      ? asRecord(scheduleOi.itemizedDeductions)
      : scheduleOi
  const itemizedDeductions = {
    stateTaxes:
      toNum(nrItemized.stateTaxes) ||
      toNum(nrItemized.stateAndLocalTaxes) ||
      toNum(rawItemizedDeductions?.stateAndLocalTaxes) +
        toNum(rawItemizedDeductions?.stateAndLocalRealEstateTaxes) +
        toNum(rawItemizedDeductions?.stateAndLocalPropertyTaxes),
    charitableContributions:
      toNum(nrItemized.charitableContributions) ||
      toNum(rawItemizedDeductions?.charityCashCheck) +
        toNum(rawItemizedDeductions?.charityOther),
    casualtyLosses:
      toNum(nrItemized.casualtyLosses) ||
      toNum(rawItemizedDeductions?.casualtyLosses),
    otherDeductions:
      toNum(nrItemized.otherDeductions) ||
      toNum(rawItemizedDeductions?.otherDeductions)
  }

  const totalWithholding =
    w2Records.reduce((sum, record) => sum + toNum(record.box2FederalWithheld), 0) +
    form1099Records.reduce(
      (sum, record) =>
        sum + toNum(record.federalWithheld ?? record.federalTaxWithheld),
      0
    ) +
    unemploymentRecords.reduce(
      (sum, record) => sum + toNum(record.federalWithheld),
      0
    ) +
    socialSecurityRecords.reduce(
      (sum, record) => sum + toNum(record.federalWithheld),
      0
    )

  return {
    nonresidentInfo: {
      countryOfCitizenship: toStr(
        nonresidentProfile.countryOfCitizenship ??
          scheduleOi.countryOfCitizenship ??
          scheduleOi.countryOfResidence
      ),
      countryOfResidence: toStr(
        scheduleOi.countryOfResidence ??
          scheduleOi.countryOfTaxResidence ??
          nonresidentProfile.countryOfCitizenship
      ),
      visaType: normalizeVisaStatus(
        nonresidentProfile.visaType ?? scheduleOi.visaType
      ),
      dateEnteredUS: toDate(
        scheduleOi.dateEnteredUS ??
          scheduleOi.firstDateEnteredUS ??
          nonresidentProfile.dateEnteredUS
      ),
      daysInUSThisYear: toNum(nonresidentProfile.daysInUS2024),
      daysInUSPriorYear: toNum(nonresidentProfile.daysInUS2023),
      daysInUS2YearsPrior: toNum(nonresidentProfile.daysInUS2022),
      claimsTaxTreaty: toBool(
        nonresidentProfile.hasTreaty ??
          (treatyClaims.length > 0 || reducedTreatyRate !== undefined)
      ),
      treatyCountry: toStr(
        nonresidentProfile.treatyCountry ??
          firstTreatyClaim.country ??
          scheduleOi.treatyCountry
      ),
      treatyArticle: toStr(
        nonresidentProfile.treatyArticle ??
          firstTreatyClaim.articleNumber ??
          scheduleOi.treatyArticle
      ),
      treatyBenefitAmount: toNum(
        scheduleOi.treatyBenefitAmount ??
          scheduleOi.treatyExemptAmount ??
          firstTreatyClaim.exemptAmount ??
          treatyBenefitAmountFromClaims
      ),
      reducedTreatyRate,
      hasEffectivelyConnectedIncome:
        eciWages +
          eciBusinessIncome +
          eciPartnershipIncome +
          eciRentalIncome +
          eciCapitalGains >
        0,
      hasFDAPIncome: Object.values(fdapIncome).some((amount) => amount > 0),
      fdapIncome
    },
    effectivelyConnectedIncome: {
      wages: eciWages,
      businessIncome: eciBusinessIncome,
      scholarshipIncome: toNum(scheduleOi.scholarshipIncome),
      treatyExemptScholarship: toNum(
        scheduleOi.treatyExemptScholarship ?? scheduleOi.scholarshipTreatyExempt
      ),
      capitalGains: eciCapitalGains,
      rentalIncome: eciRentalIncome,
      partnershipIncome: eciPartnershipIncome,
      otherIncome: toNum(
        scheduleOi.otherEffectivelyConnectedIncome ??
          scheduleOi.otherEciIncome ??
          scheduleOi.otherIncome
      )
    },
    itemizedDeductions,
    taxWithheld:
      toNum(scheduleOi.taxWithheld) ||
      toNum(asRecord(facts.incomeSummary).totalW2Withholding) +
        toNum(asRecord(facts.incomeSummary).total1099FederalWithholding) +
        totalWithholding,
    estimatedTaxPayments: toNum(
      scheduleOi.estimatedTaxPayments ?? facts.estimatedTaxPayments
    )
  }
}

const buildInvestmentAssets = (facts: FactsRecord): Asset<Date>[] => {
  const taxLotAssets = asArray<Record<string, unknown>>(facts.taxLots).flatMap(
    (lot, index) => {
      const proceeds = toNum(lot.proceeds)
      const costBasis = toNum(lot.costBasis)
      if (proceeds === 0 && costBasis === 0) return []
      return [
        {
          name: toStr(lot.asset ?? lot.security ?? `Tax lot ${index + 1}`),
          positionType: 'Security',
          openDate: toDate(lot.acquisitionDate ?? lot.acquired),
          closeDate: toDate(lot.saleDate ?? lot.sold),
          openPrice: costBasis,
          openFee: 0,
          closePrice: proceeds,
          closeFee: 0,
          quantity: 1
        } satisfies Asset<Date>
      ]
    }
  )

  const brokerAssets = asArray<Record<string, unknown>>(facts.form1099Records).flatMap(
    (record, recordIndex) => {
      const type = toStr(record.type).toUpperCase().replace('-', '')
      if (type !== '1099B' && type !== 'B') return []

      const transactions = asArray<Record<string, unknown>>(
        record.transactions ?? asRecord(record.amounts).transactions
      )

      const syntheticDatesForTerm = (term: 'short' | 'long' | 'unknown') => {
        const saleDate = new Date('2025-12-31')
        const acquisitionDate =
          term === 'long' ? new Date('2024-01-01') : new Date('2025-01-01')
        return { acquisitionDate, saleDate }
      }

      const transactionAssets = transactions.flatMap((transaction, txIndex) => {
        const proceeds = toNum(transaction.proceeds)
        const costBasis = toNum(
          transaction.costBasis ?? transaction.basis ?? transaction.cost
        )
        if (proceeds === 0 && costBasis === 0) return []
        const term = parse1099BTerm(
          transaction.term ??
            transaction.shortTermLongTerm ??
            transaction.holdingPeriod
        )
        const dates = syntheticDatesForTerm(term)
        return [
          {
            name: toStr(
              transaction.description ??
                transaction.security ??
                `${toStr(record.payer) || '1099-B'} transaction ${txIndex + 1}`
            ),
            positionType: 'Security',
            openDate: transaction.dateAcquired
              ? toDate(transaction.dateAcquired)
              : dates.acquisitionDate,
            closeDate: transaction.dateSold
              ? toDate(transaction.dateSold)
              : dates.saleDate,
            openPrice: costBasis,
            openFee: 0,
            closePrice: proceeds,
            closeFee: 0,
            quantity: 1
          } satisfies Asset<Date>
        ]
      })

      if (transactionAssets.length > 0) {
        return transactionAssets
      }

      const summaryRows = [
        {
          label: 'short-term',
          proceeds: toNum(
            record.shortTermProceeds ?? asRecord(record.amounts).shortTermProceeds
          ),
          costBasis: toNum(
            record.shortTermCostBasis ??
              asRecord(record.amounts).shortTermCostBasis
          ),
          term: 'short' as const
        },
        {
          label: 'long-term',
          proceeds: toNum(
            record.longTermProceeds ?? asRecord(record.amounts).longTermProceeds
          ),
          costBasis: toNum(
            record.longTermCostBasis ?? asRecord(record.amounts).longTermCostBasis
          ),
          term: 'long' as const
        }
      ]

      return summaryRows.flatMap((row) => {
        if (row.proceeds === 0 && row.costBasis === 0) return []
        const dates = syntheticDatesForTerm(row.term)
        return [
          {
            name: `${toStr(record.payer) || `1099-B ${recordIndex + 1}`} ${row.label}`,
            positionType: 'Security',
            openDate: dates.acquisitionDate,
            closeDate: dates.saleDate,
            openPrice: row.costBasis,
            openFee: 0,
            closePrice: row.proceeds,
            closeFee: 0,
            quantity: 1
          } satisfies Asset<Date>
        ]
      })
    }
  )

  return [...taxLotAssets, ...brokerAssets]
}

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

const adaptW2Box12 = (
  record: Record<string, unknown>
): IncomeW2['box12'] | undefined => {
  const result: Partial<Record<W2Box12Code, number>> = {}
  const rawBox12 = asRecord(record.box12)
  const rawBox12Codes = asArray<Record<string, unknown>>(record.box12Codes)
  const singleCode = toStr(record.box12Code ?? record.box12aCode).toUpperCase()
  const singleAmount = toNum(record.box12Amount ?? record.box12a)

  for (const [rawCode, rawAmount] of Object.entries(rawBox12)) {
    const code = rawCode.toUpperCase() as W2Box12Code
    const amount = toNum(rawAmount)
    if (amount > 0) {
      result[code] = amount
    }
  }

  for (const entry of rawBox12Codes) {
    const code = toStr(entry.code).toUpperCase() as W2Box12Code
    const amount = toNum(entry.amount)
    if (code && amount > 0) {
      result[code] = amount
    }
  }

  if (singleCode && singleAmount > 0) {
    result[singleCode as W2Box12Code] = singleAmount
  }

  return Object.keys(result).length > 0
    ? (result as IncomeW2['box12'])
    : undefined
}

const adaptW2s = (facts: FactsRecord): IncomeW2[] => {
  const records = asArray<Record<string, unknown>>(facts.w2Records)
  return records.map((r) => ({
    occupation: toStr(r.employerName),
    income: toNum(r.box1Wages),
    medicareIncome: toNum(r.medicareWages ?? r.box5 ?? r.box1Wages),
    fedWithholding: toNum(r.box2FederalWithheld ?? r.box2),
    ssWages: toNum(r.socialSecurityWages ?? r.box3 ?? r.box1Wages),
    ssWithholding: toNum(r.socialSecurityWithheld ?? r.box4),
    medicareWithholding: toNum(r.medicareWithheld ?? r.box6),
    employer: r.ein
      ? { EIN: toStr(r.ein), employerName: toStr(r.employerName) }
      : undefined,
    personRole:
      toStr(r.owner) === 'spouse' ? PersonRole.SPOUSE : PersonRole.PRIMARY,
    state: undefined,
    stateWages: toNum(r.stateWages ?? r.box16) || undefined,
    stateWithholding: toNum(r.stateWithheld ?? r.box17) || undefined,
    box11NonqualifiedPlans:
      toNum(r.box11NonqualifiedPlans ?? r.box11) || undefined,
    box12: adaptW2Box12(r)
  }))
}

const adapt1099s = (facts: FactsRecord): Supported1099[] => {
  const records = asArray<Record<string, unknown>>(facts.form1099Records)
  return records.flatMap((r): Supported1099[] => {
    const type = toStr(r.type).toUpperCase().replace('-', '')
    const payer = toStr(r.payer)
    const amount = toNum(r.amount)
    const personRole = resolvePersonRole(r.owner ?? r.personRole)
    const amounts = asRecord(r.amounts)

    switch (type) {
      case 'INT':
      case '1099INT':
        {
          const taxExemptInterest = toNum(
            r.taxExemptInterest ?? amounts.taxExemptInterest ?? r.box8
          )
          const foreignTaxPaid = toNum(
            r.foreignTaxPaid ?? amounts.foreignTaxPaid ?? r.box6
          )
        return [
          {
            payer,
            type: Income1099Type.INT,
            form: {
              income: amount,
              taxExemptInterest:
                taxExemptInterest > 0 ? taxExemptInterest : undefined,
              foreignTaxPaid: foreignTaxPaid > 0 ? foreignTaxPaid : undefined
            } as F1099IntData,
            personRole
          }
        ]
        }
      case 'DIV':
      case '1099DIV':
        {
          const dividends = toNum(
            r.ordinaryDividends ?? r.dividends ?? amounts.ordinaryDividends ?? amount
          )
          const qualifiedDividends = toNum(
            r.qualifiedDividends ?? amounts.qualifiedDividends
          )
          const totalCapitalGainsDistributions = toNum(
            r.totalCapitalGainsDistributions ??
              r.capitalGainDistributions ??
              amounts.totalCapitalGainsDistributions ??
              amounts.capitalGainDistributions
          )
          const section199ADividends = toNum(
            r.section199ADividends ?? amounts.section199ADividends
          )
          const exemptInterestDividends = toNum(
            r.exemptInterestDividends ??
              amounts.exemptInterestDividends ??
              r.box12
          )
          const foreignTaxPaid = toNum(
            r.foreignTaxPaid ?? amounts.foreignTaxPaid ?? r.box7
          )
        return [
          {
            payer,
            type: Income1099Type.DIV,
            form: {
              dividends,
              qualifiedDividends,
              totalCapitalGainsDistributions,
              section199ADividends:
                section199ADividends > 0 ? section199ADividends : undefined,
              exemptInterestDividends:
                exemptInterestDividends > 0
                  ? exemptInterestDividends
                  : undefined,
              foreignTaxPaid: foreignTaxPaid > 0 ? foreignTaxPaid : undefined
            } as F1099DivData,
            personRole
          }
        ]
        }
      case 'B':
      case '1099B':
        {
          const transactions = asArray<Record<string, unknown>>(
            r.transactions ?? amounts.transactions
          ).map((transaction) => ({
            term: parse1099BTerm(
              transaction.term ??
                transaction.shortTermLongTerm ??
                transaction.holdingPeriod
            ),
            proceeds: toNum(transaction.proceeds),
            costBasis: toNum(
              transaction.costBasis ?? transaction.basis ?? transaction.cost
            )
          }))
          const shortTermProceeds =
            transactions
              .filter((transaction) => transaction.term === 'short')
              .reduce((sum, transaction) => sum + transaction.proceeds, 0) ||
            toNum(
              r.shortTermProceeds ??
                amounts.shortTermProceeds ??
                (parse1099BTerm(r.term) === 'short' ? amount : 0)
            )
          const shortTermCostBasis =
            transactions
              .filter((transaction) => transaction.term === 'short')
              .reduce((sum, transaction) => sum + transaction.costBasis, 0) ||
            toNum(r.shortTermCostBasis ?? amounts.shortTermCostBasis)
          const longTermProceeds =
            transactions
              .filter((transaction) => transaction.term === 'long')
              .reduce((sum, transaction) => sum + transaction.proceeds, 0) ||
            toNum(
              r.longTermProceeds ??
                amounts.longTermProceeds ??
                (parse1099BTerm(r.term) !== 'short' ? amount : 0)
            )
          const longTermCostBasis =
            transactions
              .filter((transaction) => transaction.term === 'long')
              .reduce((sum, transaction) => sum + transaction.costBasis, 0) ||
            toNum(r.longTermCostBasis ?? amounts.longTermCostBasis)
        return [
          {
            payer,
            type: Income1099Type.B,
            form: {
              shortTermProceeds,
              shortTermCostBasis,
              longTermProceeds,
              longTermCostBasis
            } as F1099BData,
            personRole
          }
        ]
        }
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
              federalIncomeTaxWithheld: toNum(r.federalWithheld),
              section409ADeferrals: toNum(r.section409ADeferrals),
              nonqualifiedDeferredComp: toNum(r.nonqualifiedDeferredComp)
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
              federalIncomeTaxWithheld: toNum(r.federalWithheld),
              taxableGrants: toNum(r.taxableGrants)
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

  // Adapt dedicated unemployment records into 1099-G entries for the main 1040 flow.
  // These records come from the TaxFlow unemployment screen and should participate
  // in both AGI and withholding totals even when they were not entered through
  // the generic 1099 hub.
  const unemploymentRecords = asArray<Record<string, unknown>>(
    facts.unemploymentRecords
  )
  const unemployment1099s: Supported1099[] = unemploymentRecords
    .filter((r) => toNum(r.amount ?? r.unemploymentAmount) > 0)
    .map((r) => ({
      payer: toStr(r.payer ?? r.payerName ?? 'State Labor Department'),
      type: Income1099Type.G as const,
      form: {
        unemploymentCompensation: toNum(r.amount ?? r.unemploymentAmount),
        federalIncomeTaxWithheld: toNum(
          r.federalWithheld ?? r.unemploymentWithheld
        )
      } as F1099GData,
      personRole: PersonRole.PRIMARY as const
    }))

  // Merge all 1099s
  const all1099s = [...adapt1099s(facts), ...ssa1099s, ...unemployment1099s]

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
  const qbiData = asRecord(facts.qbiDeductionData)
  const qbiDeductionData: QbiDeductionData | undefined =
    qbiData && Object.keys(qbiData).length > 0
      ? {
          priorYearQualifiedBusinessLossCarryforward: toNum(
            qbiData.priorYearQualifiedBusinessLossCarryforward
          ),
          reitDividends: toNum(qbiData.reitDividends),
          ptpIncome: toNum(qbiData.ptpIncome),
          ptpLossCarryforward: toNum(qbiData.ptpLossCarryforward),
          dpadReduction: toNum(qbiData.dpadReduction)
        }
      : undefined

  // Adapt itemized deductions (Schedule A — SALT, mortgage interest, charity, etc.)
  // SALT cap ($40,000 for TY2025, $20,000 MFS) is enforced by the engine via ScheduleA.ts
  const rawItemizedDeductions = buildRawItemizedDeductions(facts)
  const itemizedDeductions: ItemizedDeductions | undefined = (() => {
    if (!rawItemizedDeductions) return undefined
    return {
      medicalAndDental: rawItemizedDeductions.medicalAndDental,
      stateAndLocalTaxes: rawItemizedDeductions.stateAndLocalTaxes,
      isSalesTax: rawItemizedDeductions.isSalesTax,
      stateAndLocalRealEstateTaxes:
        rawItemizedDeductions.stateAndLocalRealEstateTaxes,
      stateAndLocalPropertyTaxes:
        rawItemizedDeductions.stateAndLocalPropertyTaxes,
      interest8a: rawItemizedDeductions.interest8a,
      interest8b: rawItemizedDeductions.interest8b,
      interest8c: rawItemizedDeductions.interest8c,
      interest8d: rawItemizedDeductions.interest8d,
      investmentInterest: rawItemizedDeductions.investmentInterest,
      charityCashCheck: rawItemizedDeductions.charityCashCheck,
      charityOther: rawItemizedDeductions.charityOther,
      casualtyLosses: rawItemizedDeductions.casualtyLosses,
      otherDeductions: rawItemizedDeductions.otherDeductions
    }
  })()
  const nonresidentAlienReturn = buildNonresidentAlienReturn(
    facts,
    rawItemizedDeductions
  )

  // Adapt Schedule C businesses
  // If explicit businessRecords exist, use them; otherwise synthesize from 1099-NEC records
  const businesses = (() => {
    const explicit = asArray<Record<string, unknown>>(facts.businessRecords)
    if (explicit.length > 0) {
      return explicit.map((b) => {
        const inc = asRecord(b.income) ?? {}
        const exp = asRecord(b.expenses) ?? {}
        return {
          name: toStr(b.name ?? b.businessName ?? 'Business'),
          ein: toStr(b.ein) || undefined,
          principalBusinessCode: toStr(
            b.naicsCode ?? b.principalBusinessCode ?? '999999'
          ),
          businessDescription: toStr(
            b.businessDescription ?? b.description ?? 'Services'
          ),
          accountingMethod: (toStr(b.accountingMethod) || 'cash') as
            | 'cash'
            | 'accrual'
            | 'other',
          materialParticipation: toBool(b.materialParticipation ?? true),
          startedOrAcquired: toBool(b.startedOrAcquired ?? false),
          madePaymentsRequiring1099: toBool(
            b.madePaymentsRequiring1099 ?? false
          ),
          filed1099s: toBool(b.filed1099s ?? false),
          income: {
            grossReceipts: toNum(
              inc.grossReceipts ?? inc.revenue ?? b.grossReceipts ?? 0
            ),
            returns: toNum(inc.returns ?? 0),
            otherIncome: toNum(inc.otherIncome ?? 0)
          },
          expenses: {
            advertising: toNum(exp.advertising ?? 0),
            carAndTruck: toNum(exp.carAndTruck ?? exp.vehicle ?? 0),
            commissions: toNum(exp.commissions ?? 0),
            contractLabor: toNum(exp.contractLabor ?? 0),
            depletion: toNum(exp.depletion ?? 0),
            depreciation: toNum(exp.depreciation ?? 0),
            employeeBenefits: toNum(
              exp.employeeBenefits ?? exp.employeeBenefit ?? exp.benefits ?? 0
            ),
            insurance: toNum(exp.insurance ?? 0),
            interestMortgage: toNum(
              exp.interestMortgage ?? exp.mortgageInterest ?? 0
            ),
            interestOther: toNum(exp.interestOther ?? exp.interest ?? 0),
            legal: toNum(exp.legal ?? 0),
            office: toNum(exp.office ?? exp.officeExpense ?? 0),
            pensionPlans: toNum(exp.pensionPlans ?? exp.pension ?? 0),
            rentVehicles: toNum(exp.rentVehicles ?? exp.rentMachinery ?? 0),
            rentOther: toNum(exp.rentOther ?? exp.rentLease ?? exp.rent ?? 0),
            repairs: toNum(exp.repairs ?? 0),
            supplies: toNum(exp.supplies ?? 0),
            taxes: toNum(exp.taxes ?? 0),
            travel: toNum(exp.travel ?? 0),
            deductibleMeals: toNum(exp.deductibleMeals ?? exp.meals ?? 0),
            utilities: toNum(exp.utilities ?? 0),
            wages: toNum(exp.wages ?? 0),
            otherExpenses: toNum(exp.otherExpenses ?? exp.other ?? 0)
          },
          homeOfficeDeduction: toNum(b.homeOfficeDeduction) || undefined,
          qbiW2Wages: toNum(b.qbiW2Wages ?? b.qbiWages) || undefined,
          qbiUbia: toNum(b.qbiUbia ?? b.qbiProperty) || undefined,
          qbiAggregationGroup:
            toStr(b.qbiAggregationGroup ?? b.aggregationGroup) || undefined,
          qbiHasAggregationElection:
            toBool(
              b.qbiHasAggregationElection ?? b.hasAggregationElection ?? false
            ) || undefined,
          qbiIsCooperative:
            toBool(
              b.qbiIsCooperative ??
                b.isCooperative ??
                b.isAgriculturalOrHorticulturalCooperative ??
                false
            ) || undefined,
          isSpecifiedServiceTradeOrBusiness: toBool(
            b.isSpecifiedServiceTradeOrBusiness ?? b.isSSTB ?? false
          ),
          personRole: (toStr(b.owner) === 'spouse'
            ? PersonRole.SPOUSE
            : PersonRole.PRIMARY) as PersonRole
        }
      })
    }
    // Synthesize Schedule C entries from 1099-NEC records so that self-employment
    // income (AGI, SE tax, QBI deduction) flows correctly through the engine
    const necIncome = all1099s
      .filter((r) => r.type === Income1099Type.NEC)
      .reduce(
        (sum, r) =>
          sum +
          ((r.form as { nonemployeeCompensation?: number })
            .nonemployeeCompensation ?? 0),
        0
      )
    if (necIncome > 0) {
      return [
        {
          name: 'Self-Employment',
          principalBusinessCode: '999999',
          businessDescription: 'Freelance / Contract Work',
          accountingMethod: 'cash' as const,
          materialParticipation: true,
          startedOrAcquired: false,
          madePaymentsRequiring1099: false,
          filed1099s: false,
          income: { grossReceipts: necIncome, returns: 0, otherIncome: 0 },
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
          },
          personRole: PersonRole.PRIMARY as PersonRole
        }
      ]
    }
    return undefined
  })()

  // Adapt farm business (Schedule F)
  const farmBusiness = (() => {
    const fb = asRecord(facts.farmBusiness)
    if (!fb || Object.keys(fb).length === 0) return undefined
    const inc = asRecord(fb.income) ?? {}
    const exp = asRecord(fb.expenses) ?? {}
    return {
      name: toStr(fb.name ?? fb.farmName ?? 'Farm'),
      ein: toStr(fb.ein) || undefined,
      accountingMethod: (toStr(fb.accountingMethod) || 'cash') as
        | 'cash'
        | 'accrual',
      income: {
        salesLivestock: toNum(inc.salesLivestock ?? inc.livestock ?? 0),
        salesCrops: toNum(inc.salesCrops ?? inc.crops ?? 0),
        cooperativeDistributions: toNum(
          inc.cooperativeDistributions ?? inc.coop ?? 0
        ),
        agriculturalPayments: toNum(
          inc.agriculturalPayments ?? inc.govPayments ?? 0
        ),
        cccLoans: toNum(inc.cccLoans ?? 0),
        cropInsurance: toNum(inc.cropInsurance ?? 0),
        customHireIncome: toNum(inc.customHireIncome ?? inc.customHire ?? 0),
        otherIncome: toNum(inc.otherIncome ?? inc.other ?? 0)
      },
      expenses: {
        carTruck: toNum(exp.carTruck ?? exp.vehicle ?? 0),
        chemicals: toNum(exp.chemicals ?? 0),
        conservation: toNum(exp.conservation ?? 0),
        customHire: toNum(exp.customHire ?? 0),
        depreciation: toNum(exp.depreciation ?? 0),
        employeeBenefit: toNum(exp.employeeBenefit ?? exp.benefits ?? 0),
        feed: toNum(exp.feed ?? 0),
        fertilizers: toNum(exp.fertilizers ?? 0),
        freight: toNum(exp.freight ?? 0),
        fuel: toNum(exp.fuel ?? exp.gasoline ?? 0),
        insurance: toNum(exp.insurance ?? 0),
        interest: toNum(exp.interest ?? exp.mortgageInterest ?? 0),
        labor: toNum(exp.labor ?? exp.laborHired ?? 0),
        pensionPlans: toNum(exp.pensionPlans ?? exp.pension ?? 0),
        rentLease: toNum(exp.rentLease ?? exp.rentMachinery ?? 0),
        repairs: toNum(exp.repairs ?? 0),
        seeds: toNum(exp.seeds ?? 0),
        storage: toNum(exp.storage ?? 0),
        supplies: toNum(exp.supplies ?? 0),
        taxes: toNum(exp.taxes ?? 0),
        utilities: toNum(exp.utilities ?? 0),
        veterinary: toNum(exp.veterinary ?? 0),
        otherExpenses: toNum(exp.otherExpenses ?? exp.other ?? 0)
      },
      livestockCost: toNum(fb.livestockCost) || undefined,
      mortgageInterest: toNum(fb.mortgageInterest) || undefined,
      otherInterest: toNum(fb.otherInterest) || undefined
    }
  })()

  // Adapt household employees (Schedule H — nanny tax)
  const householdEmployees = (() => {
    const employees = asArray<Record<string, unknown>>(facts.householdEmployees)
    if (employees.length === 0) return undefined
    return employees.map((e) => ({
      name: toStr(e.name ?? e.employeeName ?? 'Employee'),
      ssn: toStr(e.ssn ?? e.employeeSsn ?? '').replace(/\D/g, ''),
      cashWages: toNum(e.cashWages ?? e.wages ?? 0),
      federalWithholding: toNum(e.federalWithholding ?? e.federalTax ?? 0),
      stateWithholding: toNum(e.stateWithholding ?? e.stateTax ?? 0),
      socialSecurityWithheld: toNum(
        e.socialSecurityWithheld ?? e.ssWithheld ?? 0
      ),
      medicareWithheld: toNum(e.medicareWithheld ?? e.medicareWH ?? 0)
    }))
  })()

  // ─── Schedule E rental properties ─────────────────────────────────────────
  const realEstate = (() => {
    const properties = asArray<Record<string, unknown>>(facts.rentalProperties)
    if (properties.length === 0) return []
    return properties.map((p) => {
      const addr = asRecord(p.address) ?? {}
      const exp = asRecord(p.expenses) ?? {}
      const addrObj: Address = {
        address: toStr(addr.street ?? addr.address ?? p.streetAddress),
        city: toStr(addr.city ?? p.city),
        state: mapStateCode(toStr(addr.state ?? p.state)) as State | undefined,
        zip: toStr(addr.zip ?? addr.postalCode ?? p.zip)
      }
      return {
        address: addrObj,
        rentalDays: toNum(p.rentalDays ?? p.daysRented ?? 365),
        personalUseDays: toNum(p.personalUseDays ?? 0),
        rentReceived: toNum(p.rentReceived ?? p.grossRents ?? p.income ?? 0),
        propertyType: ([
          'singleFamily',
          'multiFamily',
          'vacation',
          'commercial',
          'land',
          'selfRental',
          'other'
        ].includes(toStr(p.propertyType))
          ? toStr(p.propertyType)
          : 'singleFamily') as
          | 'singleFamily'
          | 'multiFamily'
          | 'vacation'
          | 'commercial'
          | 'land'
          | 'selfRental'
          | 'other',
        qualifiedJointVenture: toBool(p.qualifiedJointVenture ?? false),
        expenses: {
          advertising: toNum(exp.advertising ?? 0) || undefined,
          auto: toNum(exp.auto ?? exp.carAndTruck ?? 0) || undefined,
          cleaning:
            toNum(exp.cleaning ?? exp.cleaningMaintenance ?? 0) || undefined,
          commissions: toNum(exp.commissions ?? 0) || undefined,
          insurance: toNum(exp.insurance ?? 0) || undefined,
          legal: toNum(exp.legal ?? exp.legalProfessional ?? 0) || undefined,
          management:
            toNum(exp.management ?? exp.managementFees ?? 0) || undefined,
          mortgage:
            toNum(exp.mortgage ?? exp.mortgageInterest ?? 0) || undefined,
          otherInterest: toNum(exp.otherInterest ?? 0) || undefined,
          repairs: toNum(exp.repairs ?? 0) || undefined,
          supplies: toNum(exp.supplies ?? 0) || undefined,
          taxes: toNum(exp.taxes ?? exp.propertyTaxes ?? 0) || undefined,
          utilities: toNum(exp.utilities ?? 0) || undefined,
          depreciation: toNum(exp.depreciation ?? 0) || undefined,
          other: toNum(exp.other ?? exp.otherExpenses ?? 0) || undefined
        },
        activeParticipation: toBool(p.activeParticipation ?? false) || undefined,
        priorYearPassiveLossCarryover:
          toNum(
            p.priorYearPassiveLossCarryover ?? p.passiveLossCarryover ?? 0
          ) || undefined
      }
    })
  })()

  const scheduleEPage2 = (() => {
    const raw = asRecord(facts.scheduleEPage2)
    const hasValue = [
      raw.royaltyExpenses,
      raw.estateTrustIncomeLoss,
      raw.remicIncomeLoss,
      raw.farmRentalIncomeLoss,
      raw.activeParticipationRentalRealEstate,
      raw.mfsLivedApartAllYear,
      raw.priorYearRentalRealEstateLosses,
      raw.priorYearOtherPassiveLosses
    ].some((value) => value !== undefined && value !== null && value !== '')

    if (!hasValue) return undefined

    return {
      royaltyExpenses: toNum(raw.royaltyExpenses) || undefined,
      estateTrustIncomeLoss: toNum(raw.estateTrustIncomeLoss) || undefined,
      remicIncomeLoss: toNum(raw.remicIncomeLoss) || undefined,
      farmRentalIncomeLoss: toNum(raw.farmRentalIncomeLoss) || undefined,
      activeParticipationRentalRealEstate:
        toBool(raw.activeParticipationRentalRealEstate) || undefined,
      mfsLivedApartAllYear: toBool(raw.mfsLivedApartAllYear) || undefined,
      priorYearRentalRealEstateLosses:
        toNum(raw.priorYearRentalRealEstateLosses) || undefined,
      priorYearOtherPassiveLosses:
        toNum(raw.priorYearOtherPassiveLosses) || undefined
    }
  })()

  // ─── Estimated tax payments (Form 2210 / F1040-ES) ────────────────────────
  const estimatedTaxes = (() => {
    const payments = asArray<Record<string, unknown>>(
      facts.estimatedTaxPayments
    )
    if (payments.length > 0) {
      return payments.map((p) => ({
        label: toStr(p.label ?? p.quarter ?? 'Estimated Payment'),
        payment: toNum(p.payment ?? p.amount ?? 0)
      }))
    }
    const total = toNum(facts.estimatedTaxPaid ?? facts.estimatedPayments)
    if (total > 0) return [{ label: 'Estimated Tax Paid', payment: total }]
    return []
  })()

  // ─── Form 1098-E student loan interest ───────────────────────────────────
  const f1098es = (() => {
    const records = asArray<Record<string, unknown>>(
      facts.studentLoanRecords ?? facts.f1098eRecords
    )
    if (records.length > 0) {
      return records.map((r) => ({
        lender: toStr(r.lender ?? r.lenderName ?? 'Student Loan Servicer'),
        interest: toNum(
          r.interest ?? r.interestPaid ?? r.studentLoanInterest ?? 0
        )
      }))
    }
    const interest = toNum(facts.studentLoanInterest)
    if (interest > 0) return [{ lender: 'Student Loan Servicer', interest }]
    return []
  })()

  // ─── Form 3921 ISO stock option exercises ────────────────────────────────
  const f3921s = (() => {
    const records = asArray<Record<string, unknown>>(
      facts.f3921Records ?? facts.isoExercises
    )
    return records.map((r) => ({
      name: toStr(r.name ?? r.companyName ?? 'Employer'),
      personRole: (toStr(r.owner) === 'spouse'
        ? PersonRole.SPOUSE
        : PersonRole.PRIMARY) as PersonRole.PRIMARY | PersonRole.SPOUSE,
      exercisePricePerShare: toNum(
        r.exercisePricePerShare ?? r.exercisePrice ?? 0
      ),
      fmv: toNum(r.fmv ?? r.fairMarketValue ?? 0),
      numShares: toNum(r.numShares ?? r.shares ?? 0)
    }))
  })()

  // ─── Schedule K-1 (Form 1065) partnerships ───────────────────────────────
  const scheduleK1Form1065s = (() => {
    const records = asArray<Record<string, unknown>>(
      facts.k1Records ?? facts.partnershipK1s
    )
    return records.map((r) => ({
      personRole: (toStr(r.owner) === 'spouse'
        ? PersonRole.SPOUSE
        : PersonRole.PRIMARY) as PersonRole.PRIMARY | PersonRole.SPOUSE,
      partnershipName: toStr(r.partnershipName ?? r.name ?? 'Partnership'),
      partnershipEin: toStr(r.partnershipEin ?? r.ein ?? '').replace(/\D/g, ''),
      partnerOrSCorp: (toStr(r.partnerOrSCorp) === 'S' ? 'S' : 'P') as
        | 'P'
        | 'S',
      isForeign: toBool(r.isForeign ?? false),
      isPassive: toBool(r.isPassive ?? false),
      ordinaryBusinessIncome: toNum(
        r.ordinaryBusinessIncome ?? r.ordinaryIncome ?? 0
      ),
      netRentalRealEstateIncome:
        toNum(r.netRentalRealEstateIncome ?? 0) || undefined,
      otherNetRentalIncome: toNum(r.otherNetRentalIncome ?? 0) || undefined,
      royalties: toNum(r.royalties ?? 0) || undefined,
      interestIncome: toNum(r.interestIncome ?? 0),
      guaranteedPaymentsForServices: toNum(
        r.guaranteedPaymentsForServices ?? r.guaranteedPayments ?? 0
      ),
      guaranteedPaymentsForCapital: toNum(r.guaranteedPaymentsForCapital ?? 0),
      selfEmploymentEarningsA: toNum(
        r.selfEmploymentEarningsA ?? r.seEarnings ?? 0
      ),
      selfEmploymentEarningsB: toNum(r.selfEmploymentEarningsB ?? 0),
      selfEmploymentEarningsC: toNum(r.selfEmploymentEarningsC ?? 0),
      distributionsCodeAAmount: toNum(
        r.distributionsCodeAAmount ?? r.distributions ?? 0
      ),
      section199AQBI: toNum(r.section199AQBI ?? r.qbiIncome ?? 0),
      section199AW2Wages: toNum(r.section199AW2Wages ?? 0) || undefined,
      section199AUbia: toNum(r.section199AUbia ?? 0) || undefined,
      section199AAggregationGroup:
        toStr(r.section199AAggregationGroup ?? r.aggregationGroup) || undefined,
      section199AHasAggregationElection:
        toBool(
          r.section199AHasAggregationElection ??
            r.hasAggregationElection ??
            false
        ) || undefined,
      isAgriculturalOrHorticulturalCooperative:
        toBool(
          r.isAgriculturalOrHorticulturalCooperative ??
            r.isCooperative ??
            false
        ) || undefined,
      isSpecifiedServiceTradeOrBusiness:
        toBool(r.isSpecifiedServiceTradeOrBusiness ?? r.isSSTB ?? false) ||
        undefined,
      priorYearUnallowedLoss:
        toNum(r.priorYearUnallowedLoss ?? r.passiveLossCarryover ?? 0) ||
        undefined
    }))
  })()

  // ─── Form 8889 Health Savings Accounts ──────────────────────────────────
  const healthSavingsAccounts = (() => {
    const accounts = asArray<Record<string, unknown>>(facts.hsaAccounts)
    const year = new Date().getFullYear()
    return accounts.map((a) => ({
      label: toStr(a.label ?? a.bankName ?? 'HSA'),
      coverageType: (toStr(a.coverageType) === 'family'
        ? 'family'
        : 'self-only') as 'self-only' | 'family',
      contributions: toNum(a.contributions ?? a.contributionAmount ?? 0),
      personRole: (toStr(a.owner) === 'spouse'
        ? PersonRole.SPOUSE
        : PersonRole.PRIMARY) as PersonRole.PRIMARY | PersonRole.SPOUSE,
      startDate: toDate(a.startDate) ?? new Date(`${year}-01-01`),
      endDate: toDate(a.endDate) ?? new Date(`${year}-12-31`),
      totalDistributions: toNum(a.totalDistributions ?? a.distributions ?? 0),
      qualifiedDistributions: toNum(
        a.qualifiedDistributions ?? a.qualifiedAmount ?? 0
      )
    }))
  })()

  // ─── Form 8606 / 1099-R IRA accounts ────────────────────────────────────
  const individualRetirementArrangements = (() => {
    const accounts = asArray<Record<string, unknown>>(facts.iraAccounts)
    return accounts.map((a) => {
      const planTypeStr = toStr(a.planType ?? a.accountType).toLowerCase()
      let planType: IraPlanType = IraPlanType.IRA
      if (planTypeStr.includes('roth')) planType = IraPlanType.RothIRA
      else if (planTypeStr.includes('sep')) planType = IraPlanType.SepIRA
      else if (planTypeStr.includes('simple')) planType = IraPlanType.SimpleIRA
      return {
        payer: toStr(
          a.payer ?? a.financialInstitution ?? a.custodian ?? 'IRA Custodian'
        ),
        personRole: (toStr(a.owner) === 'spouse'
          ? PersonRole.SPOUSE
          : PersonRole.PRIMARY) as PersonRole.PRIMARY | PersonRole.SPOUSE,
        grossDistribution: toNum(a.grossDistribution ?? a.distributions ?? 0),
        taxableAmount: toNum(a.taxableAmount ?? 0),
        taxableAmountNotDetermined: toBool(
          a.taxableAmountNotDetermined ?? false
        ),
        totalDistribution: toBool(a.totalDistribution ?? false),
        federalIncomeTaxWithheld: toNum(
          a.federalIncomeTaxWithheld ?? a.federalWithheld ?? 0
        ),
        planType,
        contributions: toNum(a.contributions ?? a.contributionAmount ?? 0),
        rolloverContributions: toNum(a.rolloverContributions ?? 0),
        rothIraConversion: toNum(a.rothIraConversion ?? a.rothConversion ?? 0),
        recharacterizedContributions: toNum(
          a.recharacterizedContributions ?? 0
        ),
        requiredMinimumDistributions: toNum(
          a.requiredMinimumDistributions ?? a.rmd ?? 0
        ),
        lateContributions: toNum(a.lateContributions ?? 0),
        repayments: toNum(a.repayments ?? 0)
      }
    })
  })()

  const schedule8812EarnedIncomeAdjustments = (() => {
    const raw = asRecord(facts.schedule8812EarnedIncomeAdjustments)
    const result = {
      scholarshipGrantsNotOnW2: toNum(
        raw.scholarshipGrantsNotOnW2 ?? facts.scholarshipGrantsNotOnW2
      ),
      penalIncome: toNum(raw.penalIncome ?? facts.penalIncome),
      nonqualifiedDeferredCompensation: toNum(
        raw.nonqualifiedDeferredCompensation ??
          facts.nonqualifiedDeferredCompensation
      ),
      medicaidWaiverPaymentsExcludedFromIncome: toNum(
        raw.medicaidWaiverPaymentsExcludedFromIncome ??
          facts.medicaidWaiverPaymentsExcludedFromIncome
      ),
      includeMedicaidWaiverInEarnedIncome: toBool(
        raw.includeMedicaidWaiverInEarnedIncome ??
          facts.includeMedicaidWaiverInEarnedIncome
      )
    }

    return Object.values(result).some((value) =>
      typeof value === 'boolean' ? value : value > 0
    )
      ? result
      : undefined
  })()

  const otherFederalWithholdingCredits = (() => {
    const records = asArray<Record<string, unknown>>(
      facts.otherFederalWithholdingCredits
    )
    if (records.length === 0) return undefined

    const credits = records
      .map((record) => {
        const rawSource = toStr(record.source)
        const source: NonNullable<
          Information['otherFederalWithholdingCredits']
        >[number]['source'] =
          rawSource === 'W2G' ||
          rawSource === 'Schedule K-1' ||
          rawSource === '1042-S' ||
          rawSource === '8805' ||
          rawSource === '8288-A'
            ? rawSource
            : 'other'

        return {
          source,
          amount: toNum(record.amount),
          description: toStr(record.description) || undefined
        }
      })
      .filter((record) => record.amount > 0)

    return credits.length > 0 ? credits : undefined
  })()

  const form8879 = (() => {
    const raw = asRecord(facts.form8879)
    return Object.keys(raw).length > 0 ? raw : undefined
  })()

  // ─── IRA contribution deductibility (Form 8606, F8880) ──────────────────
  const iraContributions: IraContribution[] | undefined = (() => {
    const records = asArray<Record<string, unknown>>(facts.iraContributions)
    if (records.length === 0) return undefined
    return records.map((r) => ({
      personRole: (toStr(r.owner) === 'spouse'
        ? PersonRole.SPOUSE
        : PersonRole.PRIMARY) as PersonRole.PRIMARY | PersonRole.SPOUSE,
      traditionalContributions: toNum(
        r.traditionalContributions ?? r.contributions ?? 0
      ),
      traditionalDeductibleAmount: toNum(
        r.traditionalDeductibleAmount ?? r.deductibleAmount ?? 0
      ),
      rothContributions: toNum(r.rothContributions ?? r.rothAmount ?? 0)
    }))
  })()

  // ─── Roth IRA conversions (Form 8606) ───────────────────────────────────
  const rothConversions: RothConversion[] | undefined = (() => {
    const records = asArray<Record<string, unknown>>(facts.rothConversions)
    if (records.length === 0) return undefined
    return records.map((r) => ({
      personRole: (toStr(r.owner) === 'spouse'
        ? PersonRole.SPOUSE
        : PersonRole.PRIMARY) as PersonRole.PRIMARY | PersonRole.SPOUSE,
      amount: toNum(r.amount ?? r.conversionAmount ?? 0),
      taxableAmount: toNum(r.taxableAmount ?? r.amount ?? 0),
      year: toNum(r.year ?? new Date().getFullYear())
    }))
  })()

  // ─── Form 2441 dependent care providers ─────────────────────────────────
  const dependentCareProviders: DependentCareProvider[] | undefined = (() => {
    const providers = asArray<Record<string, unknown>>(
      facts.dependentCareProviders
    )
    if (providers.length === 0) return undefined
    return providers.map((p) => ({
      name: toStr(p.name ?? p.providerName ?? 'Care Provider'),
      address: toStr(p.address ?? ''),
      tin: toStr(p.tin ?? p.ssn ?? p.ein ?? '').replace(/\D/g, ''),
      amountPaid: toNum(p.amountPaid ?? p.amount ?? 0)
    }))
  })()

  const dependentCareExpenses: number | undefined = (() => {
    const amount = toNum(facts.dependentCareExpenses)
    if (amount > 0) return amount
    const providers = asArray<Record<string, unknown>>(
      facts.dependentCareProviders
    )
    const total = providers.reduce(
      (sum, p) => sum + toNum(p.amountPaid ?? p.amount ?? 0),
      0
    )
    return total > 0 ? total : undefined
  })()

  // ─── Form 8863 education expenses ───────────────────────────────────────
  const educationExpenses: EducationExpense[] | undefined = (() => {
    const expenses = asArray<Record<string, unknown>>(facts.educationExpenses)
    if (expenses.length === 0) return undefined
    return expenses.map((e) => ({
      studentName: toStr(e.studentName ?? e.name ?? ''),
      studentSsn: toStr(e.studentSsn ?? e.ssn ?? '').replace(/\D/g, ''),
      institutionName: toStr(
        e.institutionName ?? e.schoolName ?? e.institution ?? ''
      ),
      institutionEin: toStr(e.institutionEin ?? e.ein ?? '') || undefined,
      institutionAddress: toStr(e.institutionAddress ?? '') || undefined,
      qualifiedExpenses: toNum(
        e.qualifiedExpenses ?? e.tuition ?? e.expenses ?? 0
      ),
      scholarshipsReceived: toNum(
        e.scholarshipsReceived ?? e.scholarships ?? 0
      ),
      isHalfTimeStudent: toBool(e.isHalfTimeStudent ?? e.halfTime ?? true),
      isFirstFourYears: toBool(e.isFirstFourYears ?? e.firstFourYears ?? true),
      hasConviction: toBool(e.hasConviction ?? false),
      creditType: (toStr(e.creditType) === 'LLC' ? 'LLC' : 'AOTC') as
        | 'AOTC'
        | 'LLC',
      personRole: (() => {
        const role = toStr(e.personRole ?? e.owner)
        if (role === 'spouse') return PersonRole.SPOUSE
        if (role === 'dependent') return PersonRole.DEPENDENT
        return PersonRole.PRIMARY
      })()
    }))
  })()

  // ─── Form 5695 energy improvements ──────────────────────────────────────
  const energyImprovements: EnergyImprovement[] | undefined = (() => {
    const improvements = asArray<Record<string, unknown>>(
      facts.energyImprovements
    )
    if (improvements.length === 0) return undefined
    const validTypes = new Set([
      'insulation',
      'exteriorDoors',
      'windows',
      'centralAirConditioner',
      'waterHeater',
      'furnace',
      'heatPump',
      'biomassStove',
      'homeEnergyAudit'
    ])
    return improvements.map((i) => {
      const rawType = toStr(i.type ?? i.improvementType ?? 'insulation')
      return {
        type: (validTypes.has(rawType)
          ? rawType
          : 'insulation') as EnergyImprovementType,
        cost: toNum(i.cost ?? i.amount ?? 0),
        dateInstalled: toDate(i.dateInstalled ?? i.installDate) ?? new Date()
      }
    })
  })()

  // ─── Form 5695 clean energy + home improvements (from form_5695 / residential-energy) ─
  const cleanEnergyProperties = asArray<Record<string, unknown>>(
    facts.cleanEnergyProperties
  ).filter((p) => toNum(p.cost) > 0)
  const homeImprovements = asArray<Record<string, unknown>>(
    facts.homeImprovements
  ).filter((p) => toNum(p.cost) > 0)

  // ─── Form 8839 adopted children ─────────────────────────────────────────
  const adoptedChildren: AdoptedChild[] | undefined = (() => {
    const children = asArray<Record<string, unknown>>(facts.adoptedChildren)
    if (children.length === 0) return undefined
    return children.map((c) => ({
      name: toStr(c.name ?? c.childName ?? ''),
      ssn: toStr(c.ssn ?? '').replace(/\D/g, ''),
      birthYear: toNum(
        c.birthYear ?? c.yearOfBirth ?? new Date().getFullYear() - 5
      ),
      disabledChild: toBool(c.disabledChild ?? c.disabled ?? false),
      foreignChild: toBool(c.foreignChild ?? c.isForeign ?? false),
      specialNeedsChild: toBool(c.specialNeedsChild ?? c.specialNeeds ?? false),
      qualifiedExpenses: toNum(
        c.qualifiedExpenses ?? c.adoptionExpenses ?? c.expenses ?? 0
      ),
      priorYearExpenses: toNum(c.priorYearExpenses ?? c.previousExpenses ?? 0),
      adoptionFinalized: toBool(c.adoptionFinalized ?? c.finalized ?? false),
      yearAdoptionBegan: toNum(
        c.yearAdoptionBegan ?? c.yearBegan ?? new Date().getFullYear()
      )
    }))
  })()

  // ─── Local city/municipal tax (LocalCityTax page) ───────────────────────
  const localTaxInfo: LocalTaxInfo | undefined = (() => {
    const raw = asRecord(facts.localTaxInfo)
    if (!raw || Object.keys(raw).length === 0) return undefined
    const nycBorough = toStr(raw.nycBorough)
    const validBoroughs = [
      'Manhattan',
      'Brooklyn',
      'Queens',
      'Bronx',
      'Staten Island'
    ]
    return {
      residenceCity: toStr(raw.residenceCity ?? raw.city) || undefined,
      residenceState:
        mapStateCode(toStr(raw.residenceState ?? raw.state)) || undefined,
      isResident: toBool(raw.isResident ?? true),
      workCity: toStr(raw.workCity) || undefined,
      workState: mapStateCode(toStr(raw.workState)) || undefined,
      worksInDifferentCity: toBool(raw.worksInDifferentCity ?? false),
      localWithholding: toNum(
        raw.localWithholding ?? raw.localTaxWithheld ?? 0
      ),
      workCityWithholding: toNum(raw.workCityWithholding ?? 0) || undefined,
      estimatedPayments: toNum(raw.estimatedPayments ?? 0) || undefined,
      otherMunicipalTaxPaid: toNum(raw.otherMunicipalTaxPaid ?? 0) || undefined,
      ohioSchoolDistrict: toStr(raw.ohioSchoolDistrict) || undefined,
      ohioSchoolDistrictNumber:
        toStr(raw.ohioSchoolDistrictNumber) || undefined,
      nycBorough: (validBoroughs.includes(nycBorough)
        ? nycBorough
        : undefined) as
        | 'Manhattan'
        | 'Brooklyn'
        | 'Queens'
        | 'Bronx'
        | 'Staten Island'
        | undefined,
      philadelphiaWageTaxAccountNumber:
        toStr(raw.philadelphiaWageTaxAccountNumber) || undefined
    }
  })()

  // ─── Form 2555 foreign earned income exclusion ───────────────────────────
  const foreignEarnedIncome: ForeignEarnedIncomeInfo | undefined = (() => {
    const raw = asRecord(facts.foreignEarnedIncome)
    if (!raw || !toStr(raw.foreignCountry)) return undefined
    return {
      foreignCountry: toStr(raw.foreignCountry),
      foreignAddress: toStr(raw.foreignAddress ?? raw.address ?? ''),
      employerName: toStr(raw.employerName) || undefined,
      employerAddress: toStr(raw.employerAddress) || undefined,
      employerIsForeign: toBool(raw.employerIsForeign ?? false),
      foreignEarnedWages: toNum(raw.foreignEarnedWages ?? raw.wages ?? 0),
      foreignEarnedSelfEmployment: toNum(
        raw.foreignEarnedSelfEmployment ?? raw.selfEmployment ?? 0
      ),
      foreignHousingAmount: toNum(
        raw.foreignHousingAmount ?? raw.housingAmount ?? 0
      ),
      qualifyingTest: (toStr(raw.qualifyingTest) === 'physicalPresence'
        ? 'physicalPresence'
        : 'bonaFideResident') as 'bonaFideResident' | 'physicalPresence',
      taxHomeCountry: toStr(raw.taxHomeCountry ?? raw.foreignCountry),
      residenceStartDate: toDate(raw.residenceStartDate) || undefined,
      residenceEndDate: toDate(raw.residenceEndDate) || undefined,
      physicalPresenceDays:
        toNum(raw.physicalPresenceDays ?? raw.daysAbroad) || undefined,
      physicalPresenceStartDate:
        toDate(raw.physicalPresenceStartDate) || undefined,
      physicalPresenceEndDate: toDate(raw.physicalPresenceEndDate) || undefined
    }
  })()

  // ─── Form 8962 ACA marketplace health insurance ─────────────────────────
  const healthInsuranceMarketplace:
    | HealthInsuranceMarketplaceInfo[]
    | undefined = (() => {
    const records = asArray<Record<string, unknown>>(
      facts.marketplaceInsurance ?? facts.aca1095a
    )
    if (records.length === 0) return undefined
    const year = new Date().getFullYear()
    const makeMonthly = (val: unknown): number[] => {
      const arr = asArray<unknown>(val)
      if (arr.length === 12) return arr.map((v) => toNum(v))
      const scalar = toNum(val)
      return Array(12).fill(Math.round((scalar / 12) * 100) / 100)
    }
    return records.map((r) => ({
      policyNumber: toStr(r.policyNumber ?? r.policy ?? ''),
      coverageStartDate:
        toDate(r.coverageStartDate ?? r.startDate) ?? new Date(`${year}-01-01`),
      coverageEndDate:
        toDate(r.coverageEndDate ?? r.endDate) ?? new Date(`${year}-12-31`),
      enrollmentPremiums: makeMonthly(
        r.enrollmentPremiums ?? r.monthlyPremiums ?? r.annualPremium
      ),
      slcsp: makeMonthly(r.slcsp ?? r.secondLowestCostPlan ?? r.slcspPremiums),
      advancePayments: makeMonthly(
        r.advancePayments ?? r.aptcPayments ?? r.monthlyAptc
      ),
      coverageFamily: toNum(r.coverageFamily ?? r.coveredPersons ?? 1),
      sharedPolicyAllocation: toNum(r.sharedPolicyAllocation) || undefined
    }))
  })()

  // Build the Information object
  const info: Information = {
    f1099s: all1099s,
    w2s: adaptW2s(facts),
    realEstate,
    estimatedTaxes,
    f1098es,
    f3921s,
    scheduleK1Form1065s,
    itemizedDeductions,
    taxPayer: {
      filingStatus,
      primaryPerson,
      spouse,
      dependents
    },
    questions: {},
    credits,
    stateResidencies: adaptStateResidencies(facts),
    healthSavingsAccounts,
    individualRetirementArrangements,
    schedule8812EarnedIncomeAdjustments,
    otherFederalWithholdingCredits,
    appliedToNextYearEstimatedTax:
      toNum(
        facts.appliedToNextYearEstimatedTax ??
          facts.refundAppliedToNextYearEstimatedTax
      ) > 0
        ? toNum(
            facts.appliedToNextYearEstimatedTax ??
              facts.refundAppliedToNextYearEstimatedTax
          )
        : undefined,
    form8879,
    // OBBBA fields
    overtimeIncome,
    tipIncome,
    autoLoanInterest,
    trumpSavingsAccounts,
    // QBI
    qbiDeductionData,
    scheduleEPage2,
    // Schedule C / Schedule F / Schedule H
    businesses,
    farmBusiness,
    householdEmployees,
    // Form 8615 (Kiddie Tax)
    parentInfo: adaptParentInfo(facts),
    // Form 8379 (Injured Spouse)
    injuredSpouse: adaptInjuredSpouse(facts),
    // Form 2210 (Underpayment of estimated tax)
    priorYearTax: toNum(facts.priorYearTax),
    // Form 4137 (Unreported tip income)
    unreportedTipIncome: toNum(facts.unreportedTipIncome),
    // Form 8919 (Uncollected SS/Medicare on wages)
    uncollectedSSTaxWages: adaptUncollectedSSTaxWages(facts),
    // Form 8801 (AMT credit carryforward)
    priorYearAmtCredit: toNum(facts.priorYearAmtCredit),
    priorYearAmtCreditCarryforward: toNum(facts.priorYearAmtCreditCarryforward),
    // Form 8283 (Noncash charitable contributions)
    noncashContributions: adaptNoncashContributions(facts),
    // Schedule R (Credit for Elderly or Disabled)
    disabilityIncome: toNum(facts.disabilityIncome) || undefined,
    nontaxablePensionIncome: toNum(facts.nontaxablePensionIncome) || undefined,
    // Form 8829 (Business Use of Home) - from first Schedule C business with home office
    homeOffice: adaptHomeOffice(facts),
    // Form 2441 Dependent Care
    dependentCareProviders,
    dependentCareExpenses,
    // Form 8863 Education Credits
    educationExpenses,
    // Form 5695 Energy Credits
    energyImprovements,
    cleanEnergyProperties:
      cleanEnergyProperties.length > 0 ? cleanEnergyProperties : undefined,
    homeImprovements:
      homeImprovements.length > 0 ? homeImprovements : undefined,
    // Form 8839 Adoption Credit
    adoptedChildren,
    // Local city/municipal tax
    localTaxInfo,
    // Form 2555 Foreign Earned Income Exclusion
    foreignEarnedIncome,
    // Form 8962 ACA Premium Tax Credit
    healthInsuranceMarketplace,
    // Form 8606 IRA contribution deductibility
    iraContributions,
    // Form 8606 Roth IRA conversions
    rothConversions,
    // Schedule 1 additional adjustments
    educatorExpenses:
      toNum(facts.educatorExpenses) > 0
        ? toNum(facts.educatorExpenses)
        : undefined,
    alimonyReceived:
      toNum(facts.alimonyReceived) > 0
        ? toNum(facts.alimonyReceived)
        : undefined,
    alimonyPaid:
      toNum(facts.alimonyPaid) > 0 ? toNum(facts.alimonyPaid) : undefined,
    selfEmployedHealthInsuranceDeduction:
      toNum(facts.selfEmployedHealthInsuranceDeduction) > 0
        ? toNum(facts.selfEmployedHealthInsuranceDeduction)
        : undefined,
    priorYearCapitalLossCarryoverShortTerm:
      toNum(facts.priorYearCapitalLossCarryoverShortTerm) > 0
        ? toNum(facts.priorYearCapitalLossCarryoverShortTerm)
        : undefined,
    priorYearCapitalLossCarryoverLongTerm:
      toNum(facts.priorYearCapitalLossCarryoverLongTerm) > 0
        ? toNum(facts.priorYearCapitalLossCarryoverLongTerm)
        : undefined,
    passiveActivityLossAllowance:
      toNum(facts.passiveActivityLossAllowance) > 0
        ? toNum(facts.passiveActivityLossAllowance)
        : undefined,
    nonresidentAlienReturn
  }

  return info
}

const adaptUncollectedSSTaxWages = (
  facts: FactsRecord
): Record<string, unknown>[] | undefined => {
  const records = asArray<Record<string, unknown>>(
    facts.uncollectedSSTaxWages ?? facts.form8919Records
  )
  if (records.length === 0) return undefined
  return records
    .filter((r) => toNum(r.wagesReceived ?? r.wages ?? 0) > 0)
    .map((r) => ({
      employerName: toStr(r.employerName ?? r.employer ?? 'Employer'),
      employerEIN: toStr(r.employerEIN ?? r.ein ?? '').replace(/\D/g, ''),
      wagesReceived: toNum(r.wagesReceived ?? r.wages ?? 0),
      reasonCode:
        (toStr(r.reasonCode ?? r.reason ?? 'A') as 'A' | 'C' | 'G' | 'H') || 'A'
    }))
}

const adaptHomeOffice = (
  facts: FactsRecord
): Record<string, unknown> | undefined => {
  const records = asArray<Record<string, unknown>>(facts.businessRecords)
  const withHome = records.find(
    (r) =>
      Boolean(r.homeOffice) &&
      toNum(r.homeOfficeSqFt ?? r.homeOfficeSqft ?? 0) > 0
  )
  if (!withHome) return undefined
  const sqFt = toNum(withHome.homeOfficeSqFt ?? withHome.homeOfficeSqft ?? 0)
  const totalSqFt = toNum(withHome.homeSqFt ?? withHome.homeSqft ?? 1) || 1
  const method = String(withHome.homeOfficeMethod ?? 'simplified').toLowerCase()
  const isRegular = method === 'regular'
  const parseDate = (v: unknown): Date => {
    if (!v || typeof v !== 'string') return new Date()
    const d = new Date(v)
    return isNaN(d.getTime()) ? new Date() : d
  }
  return {
    method: isRegular ? 'regular' : 'simplified',
    totalSquareFeet: totalSqFt,
    businessSquareFeet: sqFt,
    mortgageInterest: isRegular
      ? toNum(withHome.homeOfficeMortgageInterest ?? 0)
      : 0,
    realEstateTaxes: isRegular
      ? toNum(withHome.homeOfficeRealEstateTaxes ?? 0)
      : 0,
    insurance: isRegular ? toNum(withHome.homeOfficeInsurance ?? 0) : 0,
    utilities: isRegular ? toNum(withHome.homeOfficeUtilities ?? 0) : 0,
    repairs: isRegular ? toNum(withHome.homeOfficeRepairs ?? 0) : 0,
    otherExpenses: isRegular ? toNum(withHome.homeOfficeOther ?? 0) : 0,
    homeValue: isRegular ? toNum(withHome.homeOfficeHomeValue ?? 0) : 0,
    landValue: isRegular ? toNum(withHome.homeOfficeLandValue ?? 0) : 0,
    homePurchaseDate: isRegular
      ? parseDate(withHome.homeOfficePurchaseDate)
      : new Date(),
    priorDepreciation: isRegular
      ? toNum(withHome.homeOfficePriorDepreciation ?? 0)
      : 0
  }
}

const adaptNoncashContributions = (
  facts: FactsRecord
): Record<string, unknown> | undefined => {
  const raw = asRecord(facts.noncashContributions ?? facts.form8283Data)
  if (!raw) return undefined
  const sectionA = asArray<Record<string, unknown>>(
    raw.sectionADonations ?? raw.donations ?? []
  )
  const sectionB = asArray<Record<string, unknown>>(raw.sectionBDonations ?? [])
  const vehicles = asArray<Record<string, unknown>>(raw.vehicleDonations ?? [])
  if (sectionA.length === 0 && sectionB.length === 0 && vehicles.length === 0)
    return undefined
  const mapDonation = (d: Record<string, unknown>) => ({
    description: toStr(d.description ?? d.doneeName ?? 'Property'),
    propertyType: toStr(d.propertyType ?? d.type ?? 'other'),
    doneeName: toStr(d.doneeName ?? d.organization ?? ''),
    doneeAddress: toStr(d.doneeAddress ?? ''),
    dateAcquired: toDate(d.dateAcquired) ?? new Date(),
    howAcquired: toStr(d.howAcquired ?? 'purchase'),
    dateContributed: toDate(d.dateContributed) ?? new Date(),
    fairMarketValue: toNum(d.fairMarketValue ?? d.fmv ?? 0),
    costOrBasis: toNum(d.costOrBasis ?? d.basis ?? 0),
    condition: toStr(d.condition ?? 'good'),
    isPartialInterest: toBool(d.isPartialInterest ?? false)
  })
  return {
    sectionADonations: sectionA.map(mapDonation),
    sectionBDonations: sectionB.map(mapDonation),
    vehicleDonations: vehicles.map((v) => ({
      vehicleDescription: toStr(v.vehicleDescription ?? v.description ?? ''),
      vehicleIdentificationNumber: toStr(v.vin ?? v.vehicleId ?? ''),
      dateContributed: toDate(v.dateContributed) ?? new Date(),
      grossProceeds: toNum(v.grossProceeds ?? 0),
      fairMarketValue: toNum(v.fairMarketValue ?? 0),
      deductionClaimed: toNum(v.deductionClaimed ?? 0),
      form1098CAttached: toBool(v.form1098CAttached ?? false)
    })),
    hasConservationEasement: toBool(raw.hasConservationEasement ?? false)
  }
}

const adaptParentInfo = (facts: FactsRecord): ParentTaxInfo | undefined => {
  const raw = asRecord(facts.parentInfo)
  if (
    !raw ||
    (toNum(raw.taxableIncome) === 0 &&
      toNum(raw.taxLiability) === 0 &&
      !toStr(raw.ssn))
  )
    return undefined
  return {
    name: toStr(raw.name) || 'Parent',
    ssn: toStr(raw.ssn).replace(/\D/g, ''),
    filingStatus: mapFilingStatus(toStr(raw.filingStatus)),
    taxableIncome: toNum(raw.taxableIncome),
    taxLiability: toNum(raw.taxLiability)
  }
}

const adaptInjuredSpouse = (
  facts: FactsRecord
): Record<string, unknown> | undefined => {
  const raw = asRecord(facts.injuredSpouse)
  if (!raw) return undefined
  const injuredRole =
    toStr(raw.injuredSpouse).toLowerCase() === 'spouse'
      ? PersonRole.SPOUSE
      : PersonRole.PRIMARY
  return {
    injuredSpouse: injuredRole,
    spouseHasPastDueChildSupport: toBool(raw.spouseHasPastDueChildSupport),
    spouseHasPastDueFederalDebt: toBool(raw.spouseHasPastDueFederalDebt),
    spouseHasPastDueStateDebt: toBool(raw.spouseHasPastDueStateDebt),
    isInCommunityPropertyState: toBool(raw.isInCommunityPropertyState),
    communityPropertyState: toStr(raw.communityPropertyState) || undefined
  }
}

// ─── Business entity fact adapters ──────────────────────────────────────────

const BUSINESS_FORM_TYPES = new Set(['1120', '1120-S', '1065', '1041', '990'])

export const isBusinessFormType = (formType: string): boolean =>
  BUSINESS_FORM_TYPES.has(formType)

export type BusinessFormSupportLevel =
  | 'self_service_supported'
  | 'expert_required'
  | 'unsupported'

export interface BusinessFormCapability {
  formType: string
  supportLevel: BusinessFormSupportLevel
  computeSupported: boolean
  submitSupported: boolean
  reviewSupported: boolean
  expertRequired: boolean
  reasonCode?: string
  reason?: string
  guidance: string
}

const BUSINESS_FORM_CAPABILITIES: Record<string, BusinessFormCapability> = {
  '1120': {
    formType: '1120',
    supportLevel: 'self_service_supported',
    computeSupported: true,
    submitSupported: true,
    reviewSupported: true,
    expertRequired: false,
    guidance:
      'Form 1120 is supported in the Cloudflare backend when entity income, deductions, and officer/payment details are provided.'
  },
  '1120-S': {
    formType: '1120-S',
    supportLevel: 'self_service_supported',
    computeSupported: true,
    submitSupported: true,
    reviewSupported: true,
    expertRequired: false,
    guidance:
      'Form 1120-S is supported in the Cloudflare backend when the return includes entity facts plus shareholder ownership data.'
  },
  '1065': {
    formType: '1065',
    supportLevel: 'self_service_supported',
    computeSupported: true,
    submitSupported: true,
    reviewSupported: true,
    expertRequired: false,
    guidance:
      'Form 1065 is supported in the Cloudflare backend when the return includes entity facts plus partner allocation data.'
  },
  '1041': {
    formType: '1041',
    supportLevel: 'self_service_supported',
    computeSupported: true,
    submitSupported: true,
    reviewSupported: true,
    expertRequired: false,
    guidance:
      'Form 1041 is supported in the Cloudflare backend when fiduciary, beneficiary, income, and distribution facts are provided.'
  },
  '990': {
    formType: '990',
    supportLevel: 'expert_required',
    computeSupported: false,
    submitSupported: false,
    reviewSupported: true,
    expertRequired: true,
    reasonCode: 'FORM_990_EXPERT_REQUIRED',
    reason:
      'Form 990 family returns still require expert preparation in the Cloudflare production path.',
    guidance:
      'TaxFlow can identify nonprofit filings, but Form 990 self-service computation and submission are not implemented in backend-cloudflare yet.'
  }
}

export const getBusinessFormCapability = (
  formType: string
): BusinessFormCapability => {
  const capability = BUSINESS_FORM_CAPABILITIES[formType]
  if (capability) {
    return capability
  }

  return {
    formType,
    supportLevel: 'unsupported',
    computeSupported: false,
    submitSupported: false,
    reviewSupported: false,
    expertRequired: false,
    reasonCode: 'UNSUPPORTED_BUSINESS_FORM',
    reason: `Unsupported business form type: ${formType}`,
    guidance:
      'This business return type is not supported by the Cloudflare backend.'
  }
}

const describeNonprofitExpertGuidance = (facts: FactsRecord): string => {
  const income = asRecord(facts.income)
  const balanceSheet = asRecord(facts.balanceSheet)
  const grossReceipts = toNum(
    facts.grossReceipts ??
      facts.totalRevenue ??
      income?.grossReceipts ??
      income?.grossReceiptsOrSales ??
      income?.totalRevenue ??
      0
  )
  const totalAssets = toNum(
    facts.totalAssets ?? balanceSheet?.totalAssets ?? balanceSheet?.assets ?? 0
  )

  if (grossReceipts > 0 && grossReceipts <= 50_000) {
    return 'Form 990 family returns still require expert preparation in the Cloudflare production path. Based on the provided facts, this organization may qualify to submit Form 990-N if its gross receipts are normally $50,000 or less.'
  }

  if (grossReceipts > 0 && grossReceipts < 200_000 && totalAssets > 0) {
    if (totalAssets < 500_000) {
      return 'Form 990 family returns still require expert preparation in the Cloudflare production path. Based on the provided facts, this organization fits the Form 990-EZ size thresholds because gross receipts are under $200,000 and year-end total assets are under $500,000.'
    }

    return 'Form 990 family returns still require expert preparation in the Cloudflare production path. Gross receipts are under $200,000, but the provided year-end total assets are at or above $500,000, so the organization may need the full Form 990 instead of Form 990-EZ.'
  }

  return 'Form 990 family returns still require expert preparation in the Cloudflare production path. TaxFlow can identify nonprofit filings, but Form 990 self-service computation and submission are not implemented in backend-cloudflare yet.'
}

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
  const employerOwnedLifeInsurance = asRecord(
    facts.employerOwnedLifeInsurance ?? facts.corporateLifeInsurance
  )
  const corporateDeferredCompensation = asRecord(
    facts.corporateDeferredCompensation ??
      facts.nonqualifiedDeferredCompensationCorporate
  )
  const rabbiTrust = asRecord(facts.rabbiTrust)
  const form8925 = asRecord(facts.form8925 ?? facts.eoliCompliance)
  const generalBusinessCreditsRecord = (() => {
    const raw = asRecord(facts.generalBusinessCredits)
    const candidate = asRecord(raw.creditComponents)
    const source = Object.keys(candidate).length > 0 ? candidate : raw
    const entries = Object.entries(source)
      .map(([key, value]) => [key, toNum(value)] as const)
      .filter(([, value]) => value > 0)
    return entries.length > 0 ? Object.fromEntries(entries) : undefined
  })()

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
    employerOwnedLifeInsurance:
      Object.keys(employerOwnedLifeInsurance).length > 0
        ? {
            premiumsPaid: toNum(employerOwnedLifeInsurance.premiumsPaid),
            claimedPremiumDeduction: toNum(
              employerOwnedLifeInsurance.claimedPremiumDeduction ??
                employerOwnedLifeInsurance.premiumsClaimedAsDeduction
            ),
            policyCashValue: toNum(employerOwnedLifeInsurance.policyCashValue),
            interestExpenseDisallowance: toNum(
              employerOwnedLifeInsurance.interestExpenseDisallowance ??
                employerOwnedLifeInsurance.allocableInterestDisallowance
            ),
            deathBenefitReceived: toNum(
              employerOwnedLifeInsurance.deathBenefitReceived
            ),
            investmentInContract: toNum(
              employerOwnedLifeInsurance.investmentInContract ??
                employerOwnedLifeInsurance.policyBasis
            ),
            cashSurrenderValue: toNum(
              employerOwnedLifeInsurance.cashSurrenderValue
            ),
            surrenderedForCash: toBool(
              employerOwnedLifeInsurance.surrenderedForCash
            ),
            isEmployerOwnedPolicy: toBool(
              employerOwnedLifeInsurance.isEmployerOwnedPolicy ?? true
            ),
            corporationIsDirectOrIndirectBeneficiary: toBool(
              employerOwnedLifeInsurance.corporationIsDirectOrIndirectBeneficiary ??
                employerOwnedLifeInsurance.isCorporationBeneficiary ??
                true
            ),
            validNoticeAndConsent: toBool(
              employerOwnedLifeInsurance.validNoticeAndConsent ??
                employerOwnedLifeInsurance.hasValidConsentForAll
            ),
            insuredWasEmployeeWithin12MonthsOfDeath: toBool(
              employerOwnedLifeInsurance.insuredWasEmployeeWithin12MonthsOfDeath
            ),
            insuredWasDirectorOrHighlyCompedAtIssue: toBool(
              employerOwnedLifeInsurance.insuredWasDirectorOrHighlyCompedAtIssue
            ),
            proceedsPaidToFamilyOrUsedForEquityPurchase: toBool(
              employerOwnedLifeInsurance.proceedsPaidToFamilyOrUsedForEquityPurchase
            ),
            issuedAfterAugust172006: toBool(
              employerOwnedLifeInsurance.issuedAfterAugust172006 ?? true
            )
          }
        : undefined,
    corporateDeferredCompensation:
      Object.keys(corporateDeferredCompensation).length > 0
        ? {
            claimedCurrentYearDeduction: toNum(
              corporateDeferredCompensation.claimedCurrentYearDeduction ??
                corporateDeferredCompensation.currentYearDeductionClaimed
            ),
            employeeIncomeInclusion: toNum(
              corporateDeferredCompensation.employeeIncomeInclusion
            ),
            stockCompIncomeInclusion: toNum(
              corporateDeferredCompensation.stockCompIncomeInclusion
            ),
            section409AFailureInclusion: toNum(
              corporateDeferredCompensation.section409AFailureInclusion
            ),
            claimedSection83iDeferral: toBool(
              corporateDeferredCompensation.claimedSection83iDeferral
            ),
            excludedEmployeeForSection83i: toBool(
              corporateDeferredCompensation.excludedEmployeeForSection83i
            )
          }
        : undefined,
    rabbiTrust:
      Object.keys(rabbiTrust).length > 0
        ? {
            contributions: toNum(rabbiTrust.contributions),
            contributionsClaimedAsDeduction: toNum(
              rabbiTrust.contributionsClaimedAsDeduction ??
                rabbiTrust.currentYearDeductionClaimed
            ),
            subjectToGeneralCreditors: toBool(
              rabbiTrust.subjectToGeneralCreditors ?? true
            ),
            isOffshore: toBool(rabbiTrust.isOffshore),
            hasFinancialHealthTrigger: toBool(
              rabbiTrust.hasFinancialHealthTrigger
            )
          }
        : undefined,
    form8925:
      Object.keys(form8925).length > 0
        ? {
            filed: toBool(form8925.filed),
            employeeCount: toNum(form8925.employeeCount),
            insuredCount: toNum(form8925.insuredCount),
            totalInsuranceInForce: toNum(form8925.totalInsuranceInForce)
          }
        : undefined,
    taxableIncome: 0, // Computed by the form
    taxBeforeCredits: 0, // Computed by the form
    foreignTaxCredit: toNum(facts.foreignTaxCredit),
    generalBusinessCredits: generalBusinessCreditsRecord,
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
        address:
          s.address != null
            ? adaptAddress(asRecord(s.address))
            : undefined,
        ownershipPercentage: toNum(s.ownershipPercentage ?? s.ownershipPct),
        stockOwned: toNum(s.stockOwned ?? s.shares),
        dateAcquired: toStr(s.dateAcquired) || undefined,
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
        address:
          p.address != null
            ? adaptAddress(asRecord(p.address))
            : undefined,
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
        endingCapitalAccount: toNum(p.endingCapitalAccount),
        share179Deduction: toNum(p.share179Deduction) || undefined,
        shareOtherDeductions: toNum(p.shareOtherDeductions) || undefined
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
      const detailedAssets = buildInvestmentAssets(facts)
      const rawInfo = adaptFactsToInformation(facts)
      const info: Information = {
        ...rawInfo,
        f1099s:
          detailedAssets.length > 0
            ? rawInfo.f1099s.filter((entry) => entry.type !== Income1099Type.B)
            : rawInfo.f1099s
      }
      const assets: Asset<Date>[] = detailedAssets
      const result = create1040(info, assets)

      if (isLeft(result)) {
        return {
          success: false,
          errors: result.left.map(String)
        }
      }

      if (isRight(result)) {
        const [f1040, schedules] = result.right as [F1040, Form[]]
        const f1040nr =
          f1040.f1040nr && f1040.f1040nr.isNeeded() ? f1040.f1040nr : undefined
        const useNonresidentBranch = Boolean(
          info.nonresidentAlienReturn && f1040nr
        )
        const agi = useNonresidentBranch
          ? f1040nr!.totalEffectivelyConnectedIncome() + f1040nr!.totalFDAPIncome()
          : f1040.l11()
        const taxableIncome = useNonresidentBranch
          ? f1040nr!.taxableIncome() + f1040nr!.totalFDAPIncome()
          : f1040.l15()
        const totalTax = useNonresidentBranch ? f1040nr!.totalTax() : f1040.l24()
        const totalPayments = useNonresidentBranch
          ? f1040nr!.totalPayments()
          : f1040.l33()
        const refund = useNonresidentBranch
          ? Math.max(0, f1040nr!.refund())
          : Math.max(0, f1040.l34() ?? 0)
        const amountOwed = useNonresidentBranch
          ? Math.max(0, f1040nr!.amountOwed())
          : Math.max(0, f1040.l37() ?? 0)
        const effectiveTaxRate =
          agi > 0 ? Math.round((totalTax / agi) * 10000) / 10000 : 0

        // Compute state returns
        const stateResults = this.computeStateReturns(f1040)
        const scheduleTags = new Set([
          f1040.tag,
          ...schedules.map((s) => s.tag),
          ...(useNonresidentBranch ? ['f1040nr'] : [])
        ])

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
          schedules: Array.from(scheduleTags),
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
      const capability = getBusinessFormCapability(formType)
      if (!capability.computeSupported) {
        return {
          success: false,
          errors: [
            formType === '990'
              ? describeNonprofitExpertGuidance(facts)
              : capability.reason ?? `Unsupported business form type: ${formType}`
          ]
        }
      }
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
            errors: [getBusinessFormCapability(formType).guidance]
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
    const corporateTaxAdjustments = [
      {
        code: 'COLI_PREMIUM_DISALLOWANCE_264A1',
        description:
          'Premiums on employer-owned life insurance are nondeductible when the corporation is directly or indirectly the beneficiary.',
        amount: form.nondeductibleColiPremiums(),
        effect: 'deduction_disallowance' as const
      },
      {
        code: 'INTEREST_DISALLOWANCE_264F',
        description:
          'Interest expense allocable to unborrowed policy cash value is disallowed to the extent supplied in the Section 264(f) adjustment input.',
        amount: form.section264fInterestDisallowance(),
        effect: 'deduction_disallowance' as const
      },
      {
        code: 'TAXABLE_DEATH_BENEFIT_101J',
        description:
          'Employer-owned life insurance proceeds become taxable to the extent the Section 101(j) exclusion is not available.',
        amount: form.taxableEmployerOwnedLifeInsuranceDeathBenefit(),
        effect: 'income_increase' as const
      },
      {
        code: 'CASH_SURRENDER_GAIN_P525',
        description:
          'Cash surrender proceeds above investment in the contract are treated as taxable income.',
        amount: form.lifeInsuranceSurrenderGain(),
        effect: 'income_increase' as const
      },
      {
        code: 'NQDC_DEDUCTION_DISALLOWANCE_404A5',
        description:
          'Deferred compensation deduction is limited to the amount currently includible in employee income.',
        amount: form.disallowedDeferredCompensationDeduction(),
        effect: 'deduction_disallowance' as const
      },
      {
        code: 'RABBI_TRUST_FUNDING_DISALLOWANCE',
        description:
          'Rabbi trust funding does not create a current deduction in the absence of matching employee income inclusion.',
        amount: form.disallowedRabbiTrustFundingDeduction(),
        effect: 'deduction_disallowance' as const
      }
    ].filter((item) => (item.amount ?? 0) > 0)
    const requiredForms = Array.from(
      new Set([
        ...(form.requiresForm8925() ? ['8925'] : [])
      ])
    )
    const complianceAlerts = [
      form.requiresForm8925() && !form.form8925()?.filed
        ? {
            code: 'FORM_8925_REQUIRED',
            severity: 'warning' as const,
            description:
              'Employer-owned life insurance appears to require Form 8925 reporting, but the filing flag is not set.'
          }
        : null,
      form.taxableEmployerOwnedLifeInsuranceDeathBenefit() > 0
        ? {
            code: 'SECTION_101J_TAXABLE_PROCEEDS',
            severity: 'warning' as const,
            description:
              'The supplied Section 101(j) facts leave part of the death benefit taxable at the corporate level.'
          }
        : null,
      form.hasRabbiTrust409AHazard()
        ? {
            code: 'RABBI_TRUST_409A_HAZARD',
            severity: 'warning' as const,
            description:
              'The supplied rabbi trust facts indicate a Section 409A(b) hazard because assets are offshore, restricted by financial health, or not exposed to general creditors.'
          }
        : null,
      form.hasSection83iExcludedEmployeeRisk()
        ? {
            code: 'SECTION_83I_EXCLUDED_EMPLOYEE',
            severity: 'warning' as const,
            description:
              'A Section 83(i) deferral was flagged for an excluded employee. The current corporate model treats this as a review issue, not an automatic tax adjustment.'
          }
        : null
    ].filter((item): item is NonNullable<typeof item> => item !== null)
    const hazardFlags = complianceAlerts.map((alert) => alert.code)

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
      requiredForms,
      hazardFlags,
      corporateTaxAdjustments,
      complianceAlerts,
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
        qualifiedDividends: alloc.qualifiedDividends,
        capitalGains:
          alloc.netShortTermCapitalGain + alloc.netLongTermCapitalGain,
        otherIncome: alloc.otherIncome,
        section179Deduction: alloc.section179Deduction,
        otherDeductions: alloc.otherDeductions,
        taxExemptInterest: alloc.taxExemptInterest,
        cashDistributions: alloc.cashDistributions,
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
        qualifiedDividends: alloc.qualifiedDividends,
        capitalGains:
          alloc.netShortTermCapitalGain + alloc.netLongTermCapitalGain,
        otherIncome: alloc.otherIncome,
        section179Deduction: alloc.section179Deduction,
        otherDeductions: alloc.otherDeductions,
        taxExemptInterest: alloc.taxExemptInterest,
        cashDistributions: alloc.cashDistributions,
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
      adjustedTotalIncome: result.adjustedTotalIncome,
      distributionDeduction: result.distributionDeduction,
      exemption: result.exemption,
      beneficiaryCount: info.beneficiaries.length,
      schedules: ['f1041']
    }
  }
}
