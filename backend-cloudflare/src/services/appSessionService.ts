import { z } from 'zod'

import type { ArtifactStore } from '../adapters/artifactStore'
import type { TaxRepository } from '../adapters/repository'
import type { Env } from '../domain/env'
import type {
  AppUserClaims
} from '../utils/appAuth'
import type { ReturnFormType, SubmissionPayload } from '../domain/types'
import { ApiService } from './apiService'
import { resolveStateProfile } from '../data/stateProfiles'
import { HttpError } from '../utils/http'
import { nowIso } from '../utils/time'

type FilingPhase =
  | 'my_info'
  | 'income'
  | 'deductions'
  | 'credits'
  | 'state'
  | 'review'
  | 'file'

export type FilingLifecycleStatus =
  | 'draft'
  | 'review_required'
  | 'signed'
  | 'queued'
  | 'pending'
  | 'received'
  | 'processing'
  | 'accepted'
  | 'accepted_with_alerts'
  | 'rejected'
  | 'failed'
  | 'retrying'
  | 'print_and_mail'

export interface FilingSessionSnapshot {
  name: string
  taxYear: number
  filingStatus: string
  formType: ReturnFormType | '1040-SS'
  currentPhase: FilingPhase
  lastScreen?: string
  completionPct: number
  estimatedRefund?: number | null
  completedScreens: string[]
  screenData: Record<string, Record<string, unknown>>
  checklistState: Record<string, string>
  entities: Record<string, unknown>
}

interface FilingSessionRow {
  id: string
  user_id: string
  local_session_id: string | null
  tax_year: number
  filing_status: string
  form_type: string
  lifecycle_status: FilingLifecycleStatus
  name: string
  current_phase: FilingPhase
  last_screen: string | null
  completion_pct: number
  estimated_refund: number | null
  tax_return_id: string | null
  latest_submission_id: string | null
  metadata_key: string
  facts_key: string | null
  created_at: string
  updated_at: string
}

interface SessionEntityRow {
  id: string
  filing_session_id: string
  entity_type: string
  entity_key: string
  status: string
  label: string | null
  data_key: string
  created_at: string
  updated_at: string
}

interface DocumentRow {
  id: string
  filing_session_id: string
  name: string
  mime_type: string
  status: string
  cluster: string
  cluster_confidence: number
  pages: number
  artifact_key: string | null
  metadata_key: string
  created_at: string
  updated_at: string
}

interface ReviewFindingRow {
  id: string
  filing_session_id: string
  code: string
  severity: 'warning' | 'error'
  title: string
  message: string
  fix_path: string | null
  fix_label: string | null
  acknowledged: number
  metadata_key: string | null
  created_at: string
  updated_at: string
}

const filingSessionCreateSchema = z.object({
  localSessionId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  taxYear: z.number().int().min(2024).max(2050).default(2025),
  filingStatus: z.string().min(2).default('single'),
  formType: z.enum(['1040', '1040-NR', '1040-SS', '4868']).default('1040'),
  currentPhase: z
    .enum(['my_info', 'income', 'deductions', 'credits', 'state', 'review', 'file'])
    .default('my_info'),
  lastScreen: z.string().optional(),
  completionPct: z.number().min(0).max(100).default(0),
  estimatedRefund: z.number().nullable().optional(),
  completedScreens: z.array(z.string()).default([]),
  screenData: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
  checklistState: z.record(z.string(), z.string()).default({}),
  entities: z.record(z.string(), z.unknown()).default({})
})

const filingSessionPatchSchema = filingSessionCreateSchema.partial().extend({
  lifecycleStatus: z
    .enum([
      'draft',
      'review_required',
      'signed',
      'queued',
      'pending',
      'received',
      'processing',
      'accepted',
      'accepted_with_alerts',
      'rejected',
      'failed',
      'retrying',
      'print_and_mail'
    ])
    .optional()
})

const entitySchema = z.object({
  status: z.string().min(2).default('in_progress'),
  label: z.string().optional(),
  data: z.record(z.string(), z.unknown()).default({})
})

const documentCreateSchema = z.object({
  name: z.string().min(1),
  mimeType: z.string().min(1),
  status: z
    .enum(['processing', 'extracted', 'ambiguous', 'needs_review', 'ocr_failed', 'confirmed'])
    .default('processing'),
  cluster: z
    .enum(['w2', '1099', 'investment', 'prior_return', 'irs_notice', 'foreign', 'unknown'])
    .default('unknown'),
  clusterConfidence: z.number().min(0).max(1).default(0),
  pages: z.number().int().min(1).default(1),
  contentBase64: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({})
})

const documentPatchSchema = documentCreateSchema.partial()

const signSchema = z.object({
  intentStatement: z.string().min(1),
  signerName: z.string().min(1),
  factsOverride: z.record(z.string(), z.unknown()).optional()
})

const submitSchema = z.object({
  idempotencyKey: z.string().uuid().optional(),
  factsOverride: z.record(z.string(), z.unknown()).optional(),
  payloadOverride: z.record(z.string(), z.unknown()).optional()
})

const stateTransferSchema = z.object({
  stateCode: z.string().length(2),
  attested: z.boolean().refine((value) => value === true)
})

const printMailSchema = z.object({
  reason: z.string().min(2).optional(),
  markMailed: z.boolean().optional()
})

const PRINT_MAIL_ADDRESS_GROUPS: Array<{
  states: string[]
  withPayment: string[]
  withoutPayment: string[]
}> = [
  {
    states: ['CA', 'OR', 'WA', 'AK', 'HI'],
    withPayment: ['Internal Revenue Service', 'P.O. Box 802501', 'Cincinnati, OH 45280-2501'],
    withoutPayment: ['Department of the Treasury', 'Internal Revenue Service', 'Fresno, CA 93888-0002']
  },
  {
    states: ['TX', 'OK', 'AR', 'LA', 'MS'],
    withPayment: ['Internal Revenue Service', 'P.O. Box 1214', 'Charlotte, NC 28201-1214'],
    withoutPayment: ['Department of the Treasury', 'Internal Revenue Service', 'Austin, TX 73301-0002']
  },
  {
    states: ['NY', 'NJ', 'CT', 'MA', 'NH', 'VT', 'ME', 'RI'],
    withPayment: ['Internal Revenue Service', 'P.O. Box 37008', 'Hartford, CT 06176-7008'],
    withoutPayment: ['Department of the Treasury', 'Internal Revenue Service', 'Kansas City, MO 64999-0002']
  }
]

const DEFAULT_PRINT_MAIL_ADDRESS = {
  withPayment: ['Internal Revenue Service', 'P.O. Box 931000', 'Louisville, KY 40293-1000'],
  withoutPayment: ['Department of the Treasury', 'Internal Revenue Service', 'Kansas City, MO 64999-0002']
}

const resolvePrintMailAddress = (stateCode: string, withPayment: boolean) => {
  const normalized = stateCode.toUpperCase()
  const matched =
    PRINT_MAIL_ADDRESS_GROUPS.find((group) => group.states.includes(normalized)) ??
    null
  const lines = matched
    ? withPayment
      ? matched.withPayment
      : matched.withoutPayment
    : withPayment
      ? DEFAULT_PRINT_MAIL_ADDRESS.withPayment
      : DEFAULT_PRINT_MAIL_ADDRESS.withoutPayment

  return {
    stateCode: normalized || 'UNKNOWN',
    withPayment,
    lines,
    verificationUrl: 'https://www.irs.gov/filing/where-to-file-paper-tax-returns-with-or-without-a-payment'
  }
}

const toSnapshot = (row: FilingSessionRow, snapshot: FilingSessionSnapshot) => ({
  id: row.id,
  userId: row.user_id,
  localSessionId: row.local_session_id ?? undefined,
  taxYear: row.tax_year,
  filingStatus: row.filing_status,
  formType: row.form_type,
  lifecycleStatus: row.lifecycle_status,
  name: row.name,
  currentPhase: row.current_phase,
  lastScreen: row.last_screen ?? undefined,
  completionPct: row.completion_pct,
  estimatedRefund: row.estimated_refund,
  taxReturnId: row.tax_return_id ?? undefined,
  latestSubmissionId: row.latest_submission_id ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  snapshot
})

const defaultSnapshot = (input: z.infer<typeof filingSessionCreateSchema>): FilingSessionSnapshot => ({
  name: input.name ?? `${input.taxYear} Tax Return`,
  taxYear: input.taxYear,
  filingStatus: input.filingStatus,
  formType: input.formType,
  currentPhase: input.currentPhase,
  lastScreen: input.lastScreen,
  completionPct: input.completionPct,
  estimatedRefund: input.estimatedRefund ?? null,
  completedScreens: input.completedScreens,
  screenData: input.screenData,
  checklistState: input.checklistState,
  entities: input.entities
})

const requireScreen = (
  snapshot: FilingSessionSnapshot,
  screenPath: string
): Record<string, unknown> => snapshot.screenData[screenPath] ?? {}

interface SessionEntitySnapshot {
  id: string
  entityType: string
  entityKey: string
  status: string
  label: string | null
  data: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

interface RejectionRepairError {
  code: string
  category:
    | 'identity'
    | 'schema_xml'
    | 'dependent_conflict'
    | 'agi_mismatch'
    | 'ip_pin'
    | 'math'
    | 'technical'
  priority: 1 | 2 | 3
  title: string
  description: string
  fixPath: string
  fixLabel: string
  canEfile: boolean
}

const FORM_1099_TYPES = new Set([
  '1099_int',
  '1099_div',
  '1099_misc',
  '1099_r',
  '1099_b',
  '1099_nec',
  '1099_k',
  '1099_g',
  '1099_ssa'
])

const FEIE_LIMITS: Record<number, number> = {
  2024: 126500,
  2025: 130000
}

const FBAR_THRESHOLD = 10000
const FATCA_SINGLE_THRESHOLD = 50000

const qbiThresholdForStatus = (filingStatus: string): number => {
  const normalized = filingStatus.toLowerCase()
  if (
    normalized === 'mfj' ||
    normalized === 'married_filing_jointly' ||
    normalized === 'qss' ||
    normalized === 'qualifying_surviving_spouse'
  ) {
    return 394600
  }
  return 197300
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

const toText = (value: unknown): string =>
  typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)

const toMoney = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

const countCompleted = (items: Array<{ isComplete: boolean }>): number =>
  items.filter((item) => item.isComplete).length

const buildStatusFromCollection = (
  items: Array<{ isComplete: boolean }>,
  optional = true
): 'not_started' | 'in_progress' | 'complete' | 'skipped' => {
  if (items.length === 0) {
    return optional ? 'skipped' : 'not_started'
  }
  if (items.every((item) => item.isComplete)) {
    return 'complete'
  }
  return 'in_progress'
}

const mergeCollectionById = <T extends { id: string }>(
  screenItems: T[],
  entityItems: T[]
): T[] => {
  const merged = new Map<string, T>()
  for (const item of screenItems) {
    merged.set(item.id, item)
  }
  for (const item of entityItems) {
    merged.set(item.id, item)
  }
  return Array.from(merged.values())
}

const sumRecordValues = (record: Record<string, unknown>): number =>
  Object.values(record).reduce<number>((sum, value) => sum + toMoney(value), 0)

const getQBIWorksheetEntities = (snapshot: FilingSessionSnapshot) =>
  asArray<Record<string, unknown>>(requireScreen(snapshot, '/qbi-worksheet').entities).map(
    (entity) => ({
      id: toText(entity.id) || crypto.randomUUID(),
      name: toText(entity.name),
      type: toText(entity.type),
      netIncome: toMoney(entity.netIncome),
      w2Wages: toMoney(entity.w2Wages),
      ubia: toMoney(entity.ubia),
      isSSTB: Boolean(entity.isSSTB),
      qbiAmount: toMoney(entity.qbiAmount),
      w2Limitation: toMoney(entity.w2Limitation),
      finalDeduction: toMoney(entity.finalDeduction),
      status: toText(entity.status) || 'not_started',
      warnings: asArray<string>(entity.warnings),
      isComplete: toText(entity.status) === 'complete'
    })
  )

const getBusinessRecords = (
  entities: SessionEntitySnapshot[]
) =>
  entities
    .filter(
      (entity) => entity.entityType === 'schedule_c' || entity.entityType === 'k1_entity'
    )
    .map((entity) => {
      const data = asRecord(entity.data)
      const expenses = asRecord(data.expenses)
      const totalExpenses = sumRecordValues(expenses)
      const homeOffice = Boolean(data.homeOffice)
      const homeOfficeSqFt = toMoney(data.homeOfficeSqFt)
      const homeSqFt = toMoney(data.homeSqFt)
      const homeOfficePct =
        homeOffice && homeOfficeSqFt > 0 && homeSqFt > 0
          ? Math.min(1, homeOfficeSqFt / homeSqFt)
          : 0
      const grossReceipts = toMoney(data.grossIncome ?? data.grossReceipts)
      const ordinaryIncome = toMoney(data.k1Box1 ?? data.ordinaryIncome)
      const rentalIncome = toMoney(data.k1Box2 ?? data.rentalIncome)
      const interestIncome = toMoney(data.k1Box3 ?? data.interestIncome)
      const guaranteedPayments = toMoney(data.guaranteedPayments)
      const qbiWages = toMoney(data.qbiWages ?? data.w2Wages)
      const qbiProperty = toMoney(data.qbiProperty ?? data.ubia)
      const netBusinessIncome =
        entity.entityType === 'schedule_c'
          ? grossReceipts - toMoney(data.cogs) - totalExpenses
          : ordinaryIncome + rentalIncome + guaranteedPayments
      const qbiBaseIncome =
        entity.entityType === 'schedule_c'
          ? Math.max(0, netBusinessIncome)
          : Boolean(data.qbiEligible ?? true)
            ? Math.max(0, ordinaryIncome)
            : 0

      return {
        id: entity.id,
        entityType: entity.entityType,
        businessType: toText(data.businessType || entity.entityType),
        name: toText(data.name ?? data.entityName ?? entity.label),
        ein: toText(data.ein),
        naicsCode: toText(data.naicsCode),
        grossReceipts,
        cogs: toMoney(data.cogs),
        totalExpenses,
        expenses,
        ordinaryIncome,
        rentalIncome,
        interestIncome,
        dividendIncome: toMoney(data.dividendIncome),
        capitalGainLoss: toMoney(data.capitalGainLoss),
        guaranteedPayments,
        section179: toMoney(data.section179),
        qbiEligible: Boolean(data.qbiEligible ?? true),
        qbiWages,
        qbiProperty,
        homeOffice,
        homeOfficePct,
        netBusinessIncome,
        selfEmploymentIncome:
          entity.entityType === 'schedule_c'
            ? Math.max(0, netBusinessIncome)
            : Math.max(0, guaranteedPayments),
        qbiBaseIncome,
        passiveLoss: toMoney(data.passiveLoss),
        atRiskBasis: toMoney(data.atRiskBasis),
        isComplete: Boolean(
          (data.name ?? data.entityName ?? entity.label) &&
            (grossReceipts ||
              ordinaryIncome ||
              rentalIncome ||
              guaranteedPayments ||
              totalExpenses)
        )
      }
    })

const getBusinessSummary = (
  snapshot: FilingSessionSnapshot,
  businessRecords: ReturnType<typeof getBusinessRecords>,
  qbiWorksheetEntities: ReturnType<typeof getQBIWorksheetEntities>
) => {
  const filingStatus = toText(snapshot.filingStatus || 'single')
  const threshold = qbiThresholdForStatus(filingStatus)
  const qbiWorksheetDeduction = qbiWorksheetEntities.reduce(
    (sum, entity) => sum + entity.finalDeduction,
    0
  )
  const qbiBaseIncome = businessRecords.reduce(
    (sum, record) => sum + record.qbiBaseIncome,
    0
  )
  const tentativeQBIDeduction = qbiBaseIncome * 0.2
  const estimatedSETax = businessRecords.reduce(
    (sum, record) => sum + record.selfEmploymentIncome * 0.9235 * 0.153,
    0
  )

  return {
    recordCount: businessRecords.length,
    completeCount: countCompleted(businessRecords),
    scheduleCCount: businessRecords.filter((record) => record.entityType === 'schedule_c')
      .length,
    k1Count: businessRecords.filter((record) => record.entityType === 'k1_entity').length,
    grossReceiptsTotal: businessRecords.reduce(
      (sum, record) => sum + record.grossReceipts,
      0
    ),
    totalExpenses: businessRecords.reduce(
      (sum, record) => sum + record.totalExpenses,
      0
    ),
    netBusinessIncome: businessRecords.reduce(
      (sum, record) => sum + record.netBusinessIncome,
      0
    ),
    selfEmploymentIncome: businessRecords.reduce(
      (sum, record) => sum + record.selfEmploymentIncome,
      0
    ),
    estimatedSETax,
    estimatedSEDeduction: estimatedSETax / 2,
    qbiEligibleCount: businessRecords.filter((record) => record.qbiEligible).length,
    qbiThreshold: threshold,
    qbiBaseIncome,
    qbiTentativeDeduction: tentativeQBIDeduction,
    qbiWorksheetCount: qbiWorksheetEntities.length,
    qbiWorksheetDeduction,
    finalQBIDeduction:
      qbiWorksheetEntities.length > 0 ? qbiWorksheetDeduction : tentativeQBIDeduction,
    sstbCount: qbiWorksheetEntities.filter((entity) => entity.isSSTB).length,
    wageLimitedCount: qbiWorksheetEntities.filter((entity) => entity.w2Limitation > 0)
      .length,
    homeOfficeCount: businessRecords.filter((record) => record.homeOffice).length,
    section179Total: businessRecords.reduce(
      (sum, record) => sum + record.section179,
      0
    ),
    passiveLossTotal: businessRecords.reduce(
      (sum, record) => sum + record.passiveLoss,
      0
    )
  }
}

const getRentalProperties = (entities: SessionEntitySnapshot[]) =>
  entities
    .filter((entity) => entity.entityType === 'rental_property')
    .map((entity) => {
      const data = asRecord(entity.data)
      const expenses = asRecord(data.expenses)
      const expenseTotal = sumRecordValues(expenses)
      const grossRents = toMoney(data.grossRents)
      const daysRented = toMoney(data.daysRented)
      const daysPersonalUse = toMoney(data.daysPersonal ?? data.daysPersonalUse)
      const purchasePrice = toMoney(data.purchasePrice)
      const explicitDepreciation = toMoney(data.depreciation)
      const estimatedDepreciation =
        explicitDepreciation ||
        (purchasePrice > 0 ? Math.max(0, purchasePrice * 0.8) / 27.5 : 0)
      const vacationHome =
        daysPersonalUse > 14 && daysRented > 0 && daysPersonalUse > daysRented * 0.1
      const rentalUseRatio =
        daysRented + daysPersonalUse > 0
          ? daysRented / (daysRented + daysPersonalUse)
          : 1
      const deductibleExpenses = vacationHome
        ? Math.min(grossRents, (expenseTotal + estimatedDepreciation) * rentalUseRatio)
        : expenseTotal + estimatedDepreciation
      const netIncomeLoss = grossRents - deductibleExpenses

      return {
        id: entity.id,
        address: toText(data.address ?? entity.label),
        propertyType: toText(data.type ?? data.propertyType),
        grossRents,
        expenses,
        expenseTotal,
        depreciation: estimatedDepreciation,
        purchasePrice,
        purchaseYear: toText(data.purchaseYear),
        priorDepreciation: toMoney(data.priorDepreciation),
        daysRented,
        daysPersonalUse,
        rentalUseRatio,
        vacationHome,
        deductibleExpenses,
        netIncomeLoss,
        isPassive: Boolean(data.isPassive ?? true),
        passiveLossCarryover: toMoney(data.passiveLossCarryover),
        isComplete: Boolean(
          (data.address ?? entity.label) &&
            (grossRents || expenseTotal || daysRented || daysPersonalUse)
        )
      }
    })

const getRentalSummary = (
  rentalProperties: ReturnType<typeof getRentalProperties>
) => ({
  propertyCount: rentalProperties.length,
  completeCount: countCompleted(rentalProperties),
  grossRentsTotal: rentalProperties.reduce(
    (sum, property) => sum + property.grossRents,
    0
  ),
  expenseTotal: rentalProperties.reduce(
    (sum, property) => sum + property.expenseTotal,
    0
  ),
  depreciationTotal: rentalProperties.reduce(
    (sum, property) => sum + property.depreciation,
    0
  ),
  deductibleExpensesTotal: rentalProperties.reduce(
    (sum, property) => sum + property.deductibleExpenses,
    0
  ),
  scheduleENetIncome: rentalProperties.reduce(
    (sum, property) => sum + property.netIncomeLoss,
    0
  ),
  vacationHomeCount: rentalProperties.filter((property) => property.vacationHome).length,
  passivePropertyCount: rentalProperties.filter((property) => property.isPassive).length,
  passiveLossCarryoverTotal: rentalProperties.reduce(
    (sum, property) => sum + property.passiveLossCarryover,
    0
  )
})

const getForeignIncomeRecords = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const screen = requireScreen(snapshot, '/foreign-income')
  const form = asRecord(screen.form)
  const screenRecords =
    screen.hasForeignIncome === true ||
    form.foreignCountry ||
    form.foreignEarnedIncome ||
    form.foreignTaxPaid
      ? [
          {
            id: 'foreign-income-primary',
            country: toText(form.foreignCountry),
            foreignEarnedIncome: toMoney(form.foreignEarnedIncome),
            exclusionMethod: toText(form.exclusionMethod || 'bona-fide'),
            daysAbroad: toMoney(form.daysAbroad),
            foreignTaxPaid: toMoney(form.foreignTaxPaid),
            foreignTaxCountry: toText(form.foreignTaxCountry),
            isComplete: Boolean(form.foreignCountry && form.foreignEarnedIncome)
          }
        ]
      : []

  const entityRecords = entities
    .filter((entity) => entity.entityType === 'foreign_income_record')
    .map((entity) => ({
      id: entity.id,
      country: toText(entity.data.foreignCountry ?? entity.data.country ?? entity.label),
      foreignEarnedIncome: toMoney(
        entity.data.foreignEarnedIncome ?? entity.data.amount
      ),
      exclusionMethod: toText(entity.data.exclusionMethod || 'bona-fide'),
      daysAbroad: toMoney(entity.data.daysAbroad),
      foreignTaxPaid: toMoney(entity.data.foreignTaxPaid),
      foreignTaxCountry: toText(entity.data.foreignTaxCountry),
      isComplete: Boolean(
        (entity.data.foreignCountry ?? entity.data.country ?? entity.label) &&
          (entity.data.foreignEarnedIncome ?? entity.data.amount ?? entity.data.foreignTaxPaid)
      )
    }))

  return mergeCollectionById(screenRecords, entityRecords)
}

const getForeignAccounts = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const screen = requireScreen(snapshot, '/foreign-income')
  const form = asRecord(screen.form)
  const screenAccounts =
    screen.hasForeignAccounts === true || form.foreignAccountBalance
      ? [
          {
            id: 'foreign-account-primary',
            country: toText(form.foreignCountry),
            institution: 'Foreign account',
            accountType: 'bank',
            maxBalanceUSD: toMoney(form.foreignAccountBalance),
            currency: 'USD',
            fbarRequired: toMoney(form.foreignAccountBalance) > FBAR_THRESHOLD,
            fatcaRequired: toMoney(form.foreignAccountBalance) > FATCA_SINGLE_THRESHOLD,
            isComplete: Boolean(form.foreignCountry && form.foreignAccountBalance)
          }
        ]
      : []

  const entityAccounts = entities
    .filter((entity) => entity.entityType === 'foreign_account')
    .map((entity) => ({
      id: entity.id,
      country: toText(entity.data.country ?? entity.data.foreignCountry),
      institution: toText(entity.data.institution ?? entity.label),
      accountType: toText(entity.data.accountType || 'bank'),
      maxBalanceUSD: toMoney(
        entity.data.maxBalanceUSD ?? entity.data.foreignAccountBalance
      ),
      currency: toText(entity.data.currency || 'USD'),
      fbarRequired: Boolean(
        entity.data.fbarRequired ??
          toMoney(entity.data.maxBalanceUSD ?? entity.data.foreignAccountBalance) >
            FBAR_THRESHOLD
      ),
      fatcaRequired: Boolean(entity.data.fatcaRequired),
      isComplete: Boolean(
        (entity.data.country ?? entity.data.foreignCountry) &&
          (entity.data.maxBalanceUSD ?? entity.data.foreignAccountBalance)
      )
    }))

  return mergeCollectionById(screenAccounts, entityAccounts)
}

const getTreatyClaims = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const foreignIncome = asRecord(requireScreen(snapshot, '/foreign-income').form)
  const nonresident = requireScreen(snapshot, '/nonresident')
  const screenClaims =
    foreignIncome.treatyCountry || (nonresident.hasTreaty === true && nonresident.treatyCountry)
      ? [
          {
            id: 'treaty-claim-primary',
            country: toText(nonresident.treatyCountry || foreignIncome.treatyCountry),
            articleNumber: toText(nonresident.treatyArticle),
            incomeType: toText(nonresident.treatyBenefit || 'Treaty benefit'),
            exemptAmount: 0,
            confirmed: true,
            isComplete: Boolean(nonresident.treatyCountry || foreignIncome.treatyCountry)
          }
        ]
      : []

  const entityClaims = entities
    .filter((entity) => entity.entityType === 'treaty_claim')
    .map((entity) => ({
      id: entity.id,
      country: toText(entity.data.country ?? entity.data.treatyCountry ?? entity.label),
      articleNumber: toText(entity.data.articleNumber ?? entity.data.treatyArticle),
      incomeType: toText(entity.data.incomeType ?? entity.data.treatyBenefit),
      exemptAmount: toMoney(entity.data.exemptAmount),
      confirmed: Boolean(entity.data.confirmed ?? true),
      isComplete: Boolean(
        (entity.data.country ?? entity.data.treatyCountry ?? entity.label) &&
          (entity.data.articleNumber ?? entity.data.treatyArticle ?? entity.data.treatyBenefit)
      )
    }))

  return mergeCollectionById(screenClaims, entityClaims)
}

const getNonresidentProfile = (snapshot: FilingSessionSnapshot) => {
  const data = requireScreen(snapshot, '/nonresident')
  const daysInUS2024 = toMoney(data.daysInUS2024)
  const daysInUS2023 = toMoney(data.daysInUS2023)
  const daysInUS2022 = toMoney(data.daysInUS2022)
  const sptScore = daysInUS2024 + Math.floor(daysInUS2023 / 3) + Math.floor(daysInUS2022 / 6)
  const passedSPT = daysInUS2024 >= 31 && sptScore >= 183
  const hasData = Object.keys(data).length > 0

  return {
    hasData,
    visaType: toText(data.visaType),
    countryOfCitizenship: toText(data.countryOfCitizenship),
    daysInUS2024,
    daysInUS2023,
    daysInUS2022,
    sptScore,
    passedSPT,
    isDualStatus: Boolean(data.isDualStatus),
    dualStatusDate: toText(data.dualStatusDate),
    hasTreaty: data.hasTreaty === true,
    treatyCountry: toText(data.treatyCountry),
    treatyArticle: toText(data.treatyArticle),
    treatyBenefit: toText(data.treatyBenefit),
    hasITIN: data.hasITIN === true,
    itin: toText(data.itin),
    hasForeignAccounts: data.hasForeignAccounts === true,
    foreignAccountMax: toMoney(data.foreignAccountMax),
    requires1040NR: hasData && !passedSPT,
    isComplete: hasData
      ? Boolean(
          data.visaType &&
            data.countryOfCitizenship &&
            (daysInUS2024 || daysInUS2023 || daysInUS2022)
        )
      : false
  }
}

const getIntlAdvancedData = (snapshot: FilingSessionSnapshot) => ({
  feie: requireScreen(snapshot, '/intl-advanced/feie'),
  ftc: requireScreen(snapshot, '/intl-advanced/ftc'),
  scheduleNec: requireScreen(snapshot, '/intl-advanced/schedule-nec'),
  scheduleOi: requireScreen(snapshot, '/intl-advanced/schedule-oi')
})

const getForeignSummary = (
  snapshot: FilingSessionSnapshot,
  foreignIncomeRecords: ReturnType<typeof getForeignIncomeRecords>,
  foreignAccounts: ReturnType<typeof getForeignAccounts>,
  treatyClaims: ReturnType<typeof getTreatyClaims>,
  nonresidentProfile: ReturnType<typeof getNonresidentProfile>,
  intlAdvancedData: ReturnType<typeof getIntlAdvancedData>
) => {
  const totalForeignEarnedIncome = foreignIncomeRecords.reduce(
    (sum, record) => sum + record.foreignEarnedIncome,
    0
  )
  const totalForeignTaxPaid = foreignIncomeRecords.reduce(
    (sum, record) => sum + record.foreignTaxPaid,
    0
  )
  const totalForeignAccountBalance = foreignAccounts.reduce(
    (sum, account) => sum + account.maxBalanceUSD,
    0
  )
  const feieLimit = FEIE_LIMITS[snapshot.taxYear] ?? FEIE_LIMITS[2025]
  const feieState = asRecord(intlAdvancedData.feie)
  const ftcState = asRecord(intlAdvancedData.ftc)
  const scheduleNecItems = asArray<Record<string, unknown>>(
    asRecord(intlAdvancedData.scheduleNec).items
  )
  const scheduleOiState = asRecord(intlAdvancedData.scheduleOi)
  const feieMethod =
    toText(feieState.qualMethod) ||
    foreignIncomeRecords[0]?.exclusionMethod ||
    'bona-fide'
  const physicalPresenceDays = Math.max(
    toMoney(feieState.ppDays),
    ...foreignIncomeRecords.map((record) => record.daysAbroad),
    0
  )
  const housingCosts = toMoney(feieState.housingCosts)
  const baseHousingAmount = feieLimit * 0.16
  const maxHousingAmount = feieLimit * 0.3
  const housingExclusionEstimate = Math.max(
    0,
    Math.min(housingCosts, maxHousingAmount) - baseHousingAmount
  )
  const feieQualified =
    feieMethod === 'physical'
      ? physicalPresenceDays >= 330
      : totalForeignEarnedIncome > 0 || feieState.qualMethod === 'bona-fide'
  const mfjLike =
    toText(snapshot.filingStatus).toLowerCase() === 'mfj' ||
    toText(snapshot.filingStatus).toLowerCase() === 'married_filing_jointly'
  const form1116Threshold = mfjLike ? 600 : 300

  return {
    foreignIncomeCount: foreignIncomeRecords.length,
    foreignIncomeCompleteCount: countCompleted(foreignIncomeRecords),
    totalForeignEarnedIncome,
    totalForeignTaxPaid,
    foreignAccountCount: foreignAccounts.length,
    foreignAccountCompleteCount: countCompleted(foreignAccounts),
    totalForeignAccountBalance,
    treatyClaimCount: treatyClaims.length,
    treatyClaimCompleteCount: countCompleted(treatyClaims),
    fbarRequired:
      totalForeignAccountBalance > FBAR_THRESHOLD ||
      foreignAccounts.some((account) => account.fbarRequired) ||
      nonresidentProfile.foreignAccountMax > FBAR_THRESHOLD,
    fatcaRequired:
      totalForeignAccountBalance > FATCA_SINGLE_THRESHOLD ||
      foreignAccounts.some((account) => account.fatcaRequired),
    feieMethod,
    feieQualified,
    feieLimit,
    feieExclusionEstimate: feieQualified
      ? Math.min(totalForeignEarnedIncome, feieLimit)
      : 0,
    housingExclusionEstimate,
    physicalPresenceDays,
    directForeignTaxCreditEligible:
      totalForeignTaxPaid > 0 && totalForeignTaxPaid <= form1116Threshold,
    requiresForm1116:
      totalForeignTaxPaid > form1116Threshold ||
      asArray<Record<string, unknown>>(ftcState.categories).length > 0,
    requires1040NR: nonresidentProfile.requires1040NR,
    dualStatus: nonresidentProfile.isDualStatus,
    scheduleNecIncomeTotal: scheduleNecItems.reduce(
      (sum, item) => sum + toMoney(item.grossAmount),
      0
    ),
    scheduleNecTaxTotal: scheduleNecItems.reduce(
      (sum, item) => sum + toMoney(item.netTax),
      0
    ),
    scheduleOiRequired:
      nonresidentProfile.hasData ||
      treatyClaims.length > 0 ||
      Object.keys(scheduleOiState).length > 0,
    hasActivity:
      foreignIncomeRecords.length > 0 ||
      foreignAccounts.length > 0 ||
      treatyClaims.length > 0 ||
      nonresidentProfile.hasData
  }
}

const getW2Records = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const screenW2 = asArray<Record<string, unknown>>(requireScreen(snapshot, '/w2').w2s).map(
    (record) => ({
      id: toText(record.id) || crypto.randomUUID(),
      employerName: toText(record.employerName),
      ein: toText(record.ein),
      box1Wages: toMoney(record.box1),
      box2FederalWithheld: toMoney(record.box2),
      box12Code: toText(record.box12aCode),
      box12Amount: toMoney(record.box12a),
      stateWages: toMoney(record.box16),
      stateWithheld: toMoney(record.box17),
      owner: toText(record.owner) || 'taxpayer',
      isComplete: Boolean(record.employerName && record.ein && record.box1)
    })
  )

  const entityW2 = entities
    .filter((entity) => entity.entityType === 'w2')
    .map((entity) => ({
      id: entity.id,
      employerName: toText(entity.data.employerName),
      ein: toText(entity.data.ein),
      box1Wages: toMoney(entity.data.box1Wages),
      box2FederalWithheld: toMoney(entity.data.box2FederalWithheld),
      box12Code: '',
      box12Amount: 0,
      stateWages: toMoney(entity.data.stateWages),
      stateWithheld: toMoney(entity.data.stateWithheld),
      owner: toText(entity.data.owner) || 'taxpayer',
      isComplete: Boolean(entity.data.employerName && entity.data.ein && entity.data.box1Wages)
    }))

  return mergeCollectionById(screenW2, entityW2)
}

const get1099Records = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const screen1099 = asArray<Record<string, unknown>>(requireScreen(snapshot, '/1099').records).map(
    (record) => ({
      id: toText(record.id) || crypto.randomUUID(),
      type: toText(record.type),
      payer: toText(record.payer),
      amount: toMoney(record.amount),
      federalWithheld: toMoney(record.federalWithheld),
      stateWithheld: toMoney(record.stateWithheld),
      notes: toText(record.notes),
      isComplete: Boolean(record.type && record.payer && record.amount)
    })
  )

  const entity1099 = entities
    .filter((entity) => FORM_1099_TYPES.has(entity.entityType))
    .map((entity) => ({
      id: entity.id,
      type: entity.entityType.replace('_', '-').toUpperCase(),
      payer: toText(entity.data.payerName ?? entity.data.payer),
      amount: toMoney(asRecord(entity.data.amounts).amount ?? entity.data.amount),
      federalWithheld: toMoney(entity.data.federalWithheld),
      stateWithheld: toMoney(entity.data.stateWithheld),
      notes: toText(entity.data.notes),
      isComplete: Boolean(
        (entity.data.payerName ?? entity.data.payer) &&
          (asRecord(entity.data.amounts).amount ?? entity.data.amount ?? entity.data.federalWithheld)
      )
    }))

  return mergeCollectionById(screen1099, entity1099)
}

const getDependents = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const screenDependents = asArray<Record<string, unknown>>(
    requireScreen(snapshot, '/household').dependents
  ).map((dependent) => ({
    id: toText(dependent.id) || crypto.randomUUID(),
    name: toText(dependent.name),
    dob: toText(dependent.dob),
    relationship: toText(dependent.relationship),
    ssn: toText(dependent.ssn),
    months: toText(dependent.months),
    isComplete: Boolean(
      dependent.name && dependent.dob && dependent.relationship && dependent.ssn
    )
  }))

  const entityDependents = entities
    .filter((entity) => entity.entityType === 'dependent')
    .map((entity) => ({
      id: entity.id,
      name: `${toText(entity.data.firstName)} ${toText(entity.data.lastName)}`.trim(),
      dob: toText(entity.data.dob),
      relationship: toText(entity.data.relationship),
      ssn: toText(entity.data.ssn),
      months: toText(entity.data.monthsLivedWithYou),
      isComplete: Boolean(
        entity.data.firstName &&
          entity.data.lastName &&
          entity.data.dob &&
          entity.data.relationship &&
          entity.data.ssn
      )
    }))

  return mergeCollectionById(screenDependents, entityDependents)
}

const getSpouse = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const spouseScreen = requireScreen(snapshot, '/spouse')
  const spouseEntity = entities.find((entity) => entity.entityType === 'spouse')
  const spouseData = spouseEntity?.data ?? spouseScreen
  const hasSpouse =
    spouseScreen.hasSpouse === true ||
    Boolean(spouseEntity) ||
    ['mfj', 'mfs'].includes(toText(spouseScreen.filingStatus).toLowerCase())

  if (!hasSpouse) {
    return null
  }

  return {
    id: spouseEntity?.id ?? 'spouse-primary',
    firstName: toText(spouseData.firstName),
    lastName: toText(spouseData.lastName),
    ssn: toText(spouseData.ssn),
    dob: toText(spouseData.dob),
    occupation: toText(spouseData.occupation),
    filingStatus: toText(spouseData.filingStatus ?? spouseScreen.filingStatus),
    nonresident: Boolean(spouseData.nonresident),
    spouseDeceased: Boolean(
      spouseData.spouseDeceased ?? spouseData.deceased ?? spouseScreen.spouseDeceased
    ),
    isComplete: Boolean(
      spouseData.firstName &&
        spouseData.lastName &&
        spouseData.dob &&
        (spouseData.spouseDeceased || spouseData.deceased || spouseData.ssn)
    )
  }
}

const getUnemploymentRecords = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const screen = requireScreen(snapshot, '/unemployment-ss')
  const form = asRecord(screen.form)
  const screenRecords =
    screen.hasUnemployment === true || form.unemploymentAmount || form.unemploymentWithheld
      ? [
          {
            id: 'unemployment-primary',
            amount: toMoney(form.unemploymentAmount),
            federalWithheld: toMoney(form.unemploymentWithheld),
            repaidAmount: toMoney(form.repaidAmount),
            isComplete: Boolean(form.unemploymentAmount)
          }
        ]
      : []

  const entityRecords = entities
    .filter((entity) => entity.entityType === 'unemployment_record')
    .map((entity) => ({
      id: entity.id,
      amount: toMoney(entity.data.amount ?? entity.data.unemploymentAmount),
      federalWithheld: toMoney(
        entity.data.federalWithheld ?? entity.data.unemploymentWithheld
      ),
      repaidAmount: toMoney(entity.data.repaidAmount),
      isComplete: Boolean(entity.data.amount ?? entity.data.unemploymentAmount)
    }))

  return mergeCollectionById(screenRecords, entityRecords)
}

const getSocialSecurityRecords = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const screen = requireScreen(snapshot, '/unemployment-ss')
  const form = asRecord(screen.form)
  const screenRecords =
    screen.hasSS === true || form.ssGrossAmount || form.ssWithheld
      ? [
          {
            id: 'ssa-primary',
            grossAmount: toMoney(form.ssGrossAmount),
            federalWithheld: toMoney(form.ssWithheld),
            otherIncome: toMoney(form.otherIncome),
            filingStatus: toText(form.filingStatus || snapshot.filingStatus),
            taxableEstimate: toMoney(form.ssTaxableAmount),
            isComplete: Boolean(form.ssGrossAmount)
          }
        ]
      : []

  const entityRecords = entities
    .filter((entity) => entity.entityType === 'ssa_record')
    .map((entity) => ({
      id: entity.id,
      grossAmount: toMoney(entity.data.grossAmount ?? entity.data.ssGrossAmount),
      federalWithheld: toMoney(entity.data.federalWithheld ?? entity.data.ssWithheld),
      otherIncome: toMoney(entity.data.otherIncome),
      filingStatus: toText(entity.data.filingStatus),
      taxableEstimate: toMoney(
        entity.data.taxableEstimate ?? entity.data.ssTaxableAmount
      ),
      isComplete: Boolean(entity.data.grossAmount ?? entity.data.ssGrossAmount)
    }))

  return mergeCollectionById(screenRecords, entityRecords)
}

const getTaxLots = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const screenLots = asArray<Record<string, unknown>>(
    requireScreen(snapshot, '/investments').trades
  ).map((record) => ({
    id: toText(record.id) || crypto.randomUUID(),
    asset: toText(record.asset),
    securityType: toText(record.type),
    acquisitionDate: toText(record.acquired),
    saleDate: toText(record.sold),
    proceeds: toMoney(record.proceeds),
    costBasis: toMoney(record.basis),
    source: 'investments_screen',
    isComplete: Boolean(
      record.asset && record.type && record.acquired && record.sold && record.proceeds
    )
  }))

  const entityLots = entities
    .filter((entity) => entity.entityType === 'tax_lot')
    .map((entity) => ({
      id: entity.id,
      asset: toText(entity.data.security ?? entity.data.asset),
      securityType: toText(entity.data.securityType ?? entity.data.type),
      acquisitionDate: toText(entity.data.acquisitionDate ?? entity.data.acquired),
      saleDate: toText(entity.data.saleDate ?? entity.data.sold),
      proceeds: toMoney(entity.data.proceeds),
      costBasis: toMoney(entity.data.costBasis ?? entity.data.basis),
      source: toText(entity.data.source ?? 'entity'),
      isComplete: Boolean(
        (entity.data.security ?? entity.data.asset) &&
          (entity.data.proceeds ?? entity.data.costBasis)
      )
    }))

  return mergeCollectionById(screenLots, entityLots)
}

const getCryptoAccounts = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const screenAccounts = asArray<Record<string, unknown>>(
    requireScreen(snapshot, '/crypto').exchanges
  )
    .filter((record) => record.name || record.status || record.txCount)
    .map((record) => ({
      id: toText(record.id) || crypto.randomUUID(),
      name: toText(record.name),
      status: toText(record.status) || 'none',
      txCount: Number(record.txCount ?? 0),
      source: 'crypto_screen',
      isComplete: Boolean(record.name)
    }))

  const entityAccounts = entities
    .filter((entity) => entity.entityType === 'crypto_account')
    .map((entity) => ({
      id: entity.id,
      name: toText(entity.data.name),
      status: toText(entity.data.status || 'none'),
      txCount: Number(entity.data.txCount ?? 0),
      source: toText(entity.data.source ?? 'entity'),
      isComplete: Boolean(entity.data.name)
    }))

  return mergeCollectionById(screenAccounts, entityAccounts)
}

const getInvestmentSummary = (
  taxLots: ReturnType<typeof getTaxLots>,
  cryptoAccounts: ReturnType<typeof getCryptoAccounts>
) => {
  const realizedGains = taxLots.reduce((sum, lot) => {
    const gain = lot.proceeds - lot.costBasis
    return gain > 0 ? sum + gain : sum
  }, 0)
  const realizedLosses = taxLots.reduce((sum, lot) => {
    const gain = lot.proceeds - lot.costBasis
    return gain < 0 ? sum + gain : sum
  }, 0)

  return {
    taxLotCount: taxLots.length,
    taxLotCompleteCount: countCompleted(taxLots),
    cryptoAccountCount: cryptoAccounts.length,
    cryptoAccountCompleteCount: countCompleted(cryptoAccounts),
    realizedGains,
    realizedLosses: Math.abs(realizedLosses),
    netCapitalGain: realizedGains + realizedLosses,
    longTermCount: taxLots.filter((lot) => {
      if (!lot.acquisitionDate || !lot.saleDate) return false
      return (
        new Date(lot.saleDate).getTime() - new Date(lot.acquisitionDate).getTime() >
        365 * 24 * 60 * 60 * 1000
      )
    }).length
  }
}

const getCreditSummary = (
  snapshot: FilingSessionSnapshot,
  dependents: ReturnType<typeof getDependents>
) => {
  const creditsState = requireScreen(snapshot, '/credits-v2')
  const credits = asArray<Record<string, unknown>>(creditsState.credits)
  const entities = credits.flatMap((credit) =>
    asArray<Record<string, unknown>>(credit.entities).map((entity) => ({
      creditId: toText(credit.id),
      creditTitle: toText(credit.title ?? credit.shortName),
      status: toText(entity.status),
      name:
        toText(entity.name) ||
        toText(entity.studentName) ||
        toText(entity.providerName) ||
        toText(entity.vehicleMake),
      isComplete:
        toText(entity.status) === 'complete' ||
        toText(entity.status) === 'eligible'
    }))
  )

  const eligibleCredits = credits.filter((credit) => toText(credit.status) === 'eligible')
  const maybeCredits = credits.filter((credit) => toText(credit.status) === 'maybe')
  const blockedCredits = credits.filter((credit) => toText(credit.status) === 'blocked')
  const estimatedTotal = credits.reduce(
    (sum, credit) => sum + toMoney(credit.estimatedAmount),
    0
  )

  return {
    credits,
    creditEntities: entities,
    summary: {
      eligibleCount: eligibleCredits.length,
      maybeCount: maybeCredits.length,
      blockedCount: blockedCredits.length,
      estimatedTotal,
      dependentCount: dependents.length
    }
  }
}

const getIncomeSummary = (
  w2Records: ReturnType<typeof getW2Records>,
  form1099Records: ReturnType<typeof get1099Records>,
  unemploymentRecords: ReturnType<typeof getUnemploymentRecords>,
  socialSecurityRecords: ReturnType<typeof getSocialSecurityRecords>
) => {
  const totalsByType = form1099Records.reduce<Record<string, number>>((acc, record) => {
    acc[record.type] = (acc[record.type] ?? 0) + record.amount
    return acc
  }, {})

  return {
    w2Count: w2Records.length,
    w2CompleteCount: countCompleted(w2Records),
    totalW2Wages: w2Records.reduce((sum, record) => sum + record.box1Wages, 0),
    totalW2Withholding: w2Records.reduce(
      (sum, record) => sum + record.box2FederalWithheld,
      0
    ),
    form1099Count: form1099Records.length,
    form1099CompleteCount: countCompleted(form1099Records),
    total1099Amount: form1099Records.reduce((sum, record) => sum + record.amount, 0),
    total1099FederalWithholding: form1099Records.reduce(
      (sum, record) => sum + record.federalWithheld,
      0
    ),
    unemploymentCount: unemploymentRecords.length,
    unemploymentCompleteCount: countCompleted(unemploymentRecords),
    totalUnemployment: unemploymentRecords.reduce(
      (sum, record) => sum + record.amount,
      0
    ),
    totalUnemploymentWithholding: unemploymentRecords.reduce(
      (sum, record) => sum + record.federalWithheld,
      0
    ),
    socialSecurityCount: socialSecurityRecords.length,
    socialSecurityCompleteCount: countCompleted(socialSecurityRecords),
    totalSocialSecurityGross: socialSecurityRecords.reduce(
      (sum, record) => sum + record.grossAmount,
      0
    ),
    totalSocialSecurityTaxableEstimate: socialSecurityRecords.reduce(
      (sum, record) => sum + record.taxableEstimate,
      0
    ),
    totalsByType
  }
}

const toFacts = (
  row: FilingSessionRow,
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
): Record<string, unknown> => {
  const taxpayer = requireScreen(snapshot, '/taxpayer-profile')
  const residency = requireScreen(snapshot, '/residency')
  const w2 = requireScreen(snapshot, '/w2')
  const status = String(
    taxpayer.filingStatus ?? snapshot.filingStatus ?? row.filing_status ?? 'single'
  )

  const primaryTin = String(
    taxpayer.ssn ??
      taxpayer.primarySsn ??
      (w2.primaryTIN as string | undefined) ??
      ''
  )
    .replace(/\D/g, '')

  const residenceState = String(
    (taxpayer.address as Record<string, unknown> | undefined)?.state ??
      residency.state ??
      'CA'
  ).toLowerCase()

  const w2Records = getW2Records(snapshot, entities)
  const form1099Records = get1099Records(snapshot, entities)
  const dependents = getDependents(snapshot, entities)
  const spouse = getSpouse(snapshot, entities)
  const unemploymentRecords = getUnemploymentRecords(snapshot, entities)
  const socialSecurityRecords = getSocialSecurityRecords(snapshot, entities)
  const taxLots = getTaxLots(snapshot, entities)
  const cryptoAccounts = getCryptoAccounts(snapshot, entities)
  const businessRecords = getBusinessRecords(entities)
  const qbiWorksheetEntities = getQBIWorksheetEntities(snapshot)
  const businessSummary = getBusinessSummary(snapshot, businessRecords, qbiWorksheetEntities)
  const rentalProperties = getRentalProperties(entities)
  const rentalSummary = getRentalSummary(rentalProperties)
  const foreignIncomeRecords = getForeignIncomeRecords(snapshot, entities)
  const foreignAccounts = getForeignAccounts(snapshot, entities)
  const treatyClaims = getTreatyClaims(snapshot, entities)
  const nonresidentProfile = getNonresidentProfile(snapshot)
  const intlAdvancedData = getIntlAdvancedData(snapshot)
  const foreignSummary = getForeignSummary(
    snapshot,
    foreignIncomeRecords,
    foreignAccounts,
    treatyClaims,
    nonresidentProfile,
    intlAdvancedData
  )
  const creditSummary = getCreditSummary(snapshot, dependents)
  const incomeSummary = getIncomeSummary(
    w2Records,
    form1099Records,
    unemploymentRecords,
    socialSecurityRecords
  )
  const investmentSummary = getInvestmentSummary(taxLots, cryptoAccounts)

  return {
    primaryTIN: primaryTin,
    taxflowSessionId: row.id,
    filingStatus: status,
    spouse,
    w2Records,
    form1099Records,
    unemploymentRecords,
    socialSecurityRecords,
    taxLots,
    cryptoAccounts,
    businessRecords,
    qbiWorksheetEntities,
    rentalProperties,
    foreignIncomeRecords,
    foreignAccounts,
    treatyClaims,
    nonresidentProfile,
    dependents,
    incomeSummary,
    investmentSummary,
    businessSummary,
    rentalSummary,
    foreignSummary,
    creditSummary: creditSummary.summary,
    '/taxYear': {
      $type: 'gov.irs.factgraph.persisters.IntWrapper',
      item: snapshot.taxYear
    },
    '/filingStatus': {
      $type: 'gov.irs.factgraph.persisters.EnumWrapper',
      item: {
        value: [status],
        enumOptionsPath: '/filingStatusOptions'
      }
    },
    '/filerResidenceAndIncomeState': {
      $type: 'gov.irs.factgraph.persisters.EnumWrapper',
      item: {
        value: [residenceState],
        enumOptionsPath: '/scopedStateOptions'
      }
    },
    '/filers/#primary/isPrimaryFiler': {
      $type: 'gov.irs.factgraph.persisters.BooleanWrapper',
      item: true
    },
    ...(primaryTin
      ? {
          '/filers/#primary/tin': {
            $type: 'gov.irs.factgraph.persisters.TinWrapper',
            item: {
              area: primaryTin.slice(0, 3),
              group: primaryTin.slice(3, 5),
              serial: primaryTin.slice(5, 9)
            }
          }
        }
      : {}),
    '/address': {
      $type: 'gov.irs.factgraph.persisters.AddressWrapper',
      item: {
        streetAddress: String(
          (taxpayer.address as Record<string, unknown> | undefined)?.line1 ?? ''
        ),
        city: String(
          (taxpayer.address as Record<string, unknown> | undefined)?.city ?? ''
        ),
        stateOrProvence: String(
          (taxpayer.address as Record<string, unknown> | undefined)?.state ?? ''
        ),
        postalCode: String(
          (taxpayer.address as Record<string, unknown> | undefined)?.zip ?? ''
        )
      }
    }
  }
}

const toSubmissionPayload = (
  row: FilingSessionRow,
  snapshot: FilingSessionSnapshot,
  facts: Record<string, unknown>
): SubmissionPayload => {
  const review = requireScreen(snapshot, '/review-confirm')
  const efile = requireScreen(snapshot, '/efile-wizard')
  const taxpayer = requireScreen(snapshot, '/taxpayer-profile')
  const primaryTIN = String(facts.primaryTIN ?? taxpayer.ssn ?? '').replace(/\D/g, '')
  const filingStatus = String(
    taxpayer.filingStatus ?? snapshot.filingStatus ?? row.filing_status
  )
  const incomeSummary = asRecord(facts.incomeSummary)
  const investmentSummary = asRecord(facts.investmentSummary)
  const businessSummary = asRecord(facts.businessSummary)
  const rentalSummary = asRecord(facts.rentalSummary)
  const foreignSummary = asRecord(facts.foreignSummary)
  const creditSummary = asRecord(facts.creditSummary)
  const dependents = asArray<Record<string, unknown>>(facts.dependents)
  const spouse = asRecord(facts.spouse)

  const refund = Number(review.totalRefund ?? snapshot.estimatedRefund ?? 0)
  const federalRefund = Number(review.federalRefund ?? refund)
  const totalTax = Number(review.totalTax ?? 0)
  const totalPayments = Number(review.totalPayments ?? federalRefund + totalTax)
  const amountOwed = Math.max(0, totalTax - totalPayments)

  return {
    taxYear: snapshot.taxYear,
    primaryTIN: primaryTIN || undefined,
    filingStatus,
    formType: (snapshot.formType === '1040-SS'
      ? '1040-SS'
      : snapshot.formType) as SubmissionPayload['formType'],
    form1040: {
      totalTax,
      totalPayments,
      refund: amountOwed > 0 ? 0 : Math.max(0, refund),
      amountOwed
    },
    forms: {
      w2s: facts.w2Records,
      forms1099: facts.form1099Records,
      unemployment: facts.unemploymentRecords,
      socialSecurity: facts.socialSecurityRecords,
      spouse,
      investments: {
        taxLots: facts.taxLots,
        cryptoAccounts: facts.cryptoAccounts,
        summary: investmentSummary
      },
      business: {
        records: facts.businessRecords,
        qbiWorksheet: facts.qbiWorksheetEntities,
        summary: businessSummary
      },
      rental: {
        properties: facts.rentalProperties,
        summary: rentalSummary
      },
      international: {
        foreignIncomeRecords: facts.foreignIncomeRecords,
        foreignAccounts: facts.foreignAccounts,
        treatyClaims: facts.treatyClaims,
        nonresidentProfile: facts.nonresidentProfile,
        summary: foreignSummary
      },
      dependents,
      credits: creditSummary
    },
    metadata: {
      source: 'taxflow-app-v1',
      filingSessionId: row.id,
      localSessionId: row.local_session_id ?? undefined,
      priorYearAgi: taxpayer.priorYearAgi,
      ipPin: taxpayer.ipPin ?? efile.ipPin,
      signerName: efile.signatureText ?? undefined,
      bankLast4: String(efile.account ?? '').slice(-4) || undefined,
      incomeSummary,
      investmentSummary,
      businessSummary,
      rentalSummary,
      foreignSummary,
      creditSummary,
      dependentCount: dependents.length,
      spouse,
      unemploymentCount: asArray(facts.unemploymentRecords).length,
      socialSecurityCount: asArray(facts.socialSecurityRecords).length,
      businessCount: asArray(facts.businessRecords).length,
      rentalPropertyCount: asArray(facts.rentalProperties).length,
      foreignIncomeCount: asArray(facts.foreignIncomeRecords).length,
      foreignAccountCount: asArray(facts.foreignAccounts).length
    }
  }
}

const buildChecklist = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[],
  findings: ReviewFindingRow[]
) => {
  const w2Records = getW2Records(snapshot, entities)
  const form1099Records = get1099Records(snapshot, entities)
  const dependents = getDependents(snapshot, entities)
  const spouse = getSpouse(snapshot, entities)
  const unemploymentRecords = getUnemploymentRecords(snapshot, entities)
  const socialSecurityRecords = getSocialSecurityRecords(snapshot, entities)
  const taxLots = getTaxLots(snapshot, entities)
  const cryptoAccounts = getCryptoAccounts(snapshot, entities)
  const businessRecords = getBusinessRecords(entities)
  const qbiWorksheetEntities = getQBIWorksheetEntities(snapshot)
  const rentalProperties = getRentalProperties(entities)
  const foreignIncomeRecords = getForeignIncomeRecords(snapshot, entities)
  const foreignAccounts = getForeignAccounts(snapshot, entities)
  const treatyClaims = getTreatyClaims(snapshot, entities)
  const nonresidentProfile = getNonresidentProfile(snapshot)
  const creditSummary = getCreditSummary(snapshot, dependents)

  const itemFromScreen = (
    id: string,
    screenPath: string,
    fallbackLabel: string,
    opts?: { optional?: boolean; completeWhen?: (data: Record<string, unknown>) => boolean }
  ) => {
    const data = requireScreen(snapshot, screenPath)
    const hasData = Object.keys(data).length > 0
    const isComplete = opts?.completeWhen ? opts.completeWhen(data) : hasData
    return {
      status: isComplete ? 'complete' : hasData ? 'in_progress' : opts?.optional ? 'skipped' : 'not_started',
      sublabel: hasData ? fallbackLabel : undefined,
      warnings: [] as Array<Record<string, unknown>>
    }
  }

  return {
    items: {
      'taxpayer-profile': itemFromScreen('taxpayer-profile', '/taxpayer-profile', 'Taxpayer profile saved'),
      spouse: {
        status: spouse ? (spouse.isComplete ? 'complete' : 'in_progress') : 'skipped',
        sublabel: spouse
          ? `${spouse.firstName} ${spouse.lastName}`.trim() || 'Spouse information started'
          : undefined,
        warnings: findings
          .filter((finding) => finding.code === 'SPOUSE-INCOMPLETE')
          .map((finding) => ({ message: finding.message, level: finding.severity }))
      },
      household: {
        status: buildStatusFromCollection(dependents, true),
        sublabel:
          dependents.length > 0
            ? `${countCompleted(dependents)}/${dependents.length} dependents complete`
            : undefined,
        warnings: findings
          .filter((finding) => finding.code.startsWith('DEPENDENT'))
          .map((finding) => ({ message: finding.message, level: finding.severity }))
      },
      residency: itemFromScreen('residency', '/residency', 'Residency information saved'),
      w2s: {
        status: buildStatusFromCollection(w2Records, true),
        sublabel:
          w2Records.length > 0
            ? `${countCompleted(w2Records)}/${w2Records.length} W-2 records complete`
            : undefined,
        warnings: findings
          .filter((finding) => finding.code === 'W2-INCOMPLETE')
          .map((finding) => ({ message: finding.message, level: finding.severity }))
      },
      '1099s': {
        status: buildStatusFromCollection(form1099Records, true),
        sublabel:
          form1099Records.length > 0
            ? `${countCompleted(form1099Records)}/${form1099Records.length} 1099 records complete`
            : undefined,
        warnings: findings
          .filter((finding) => finding.code === '1099-INCOMPLETE')
          .map((finding) => ({ message: finding.message, level: finding.severity }))
      },
      investments: {
        status:
          taxLots.length > 0 || cryptoAccounts.length > 0
            ? taxLots.every((item) => item.isComplete) &&
              cryptoAccounts.every((item) => item.isComplete)
              ? 'complete'
              : 'in_progress'
            : 'skipped',
        sublabel:
          taxLots.length > 0 || cryptoAccounts.length > 0
            ? `${taxLots.length} sales, ${cryptoAccounts.length} crypto accounts`
            : undefined,
        warnings: findings
          .filter((finding) => finding.code === 'INVESTMENT-INCOMPLETE')
          .map((finding) => ({ message: finding.message, level: finding.severity }))
      },
      rental: {
        status: buildStatusFromCollection(rentalProperties, true),
        sublabel:
          rentalProperties.length > 0
            ? `${countCompleted(rentalProperties)}/${rentalProperties.length} rental properties complete`
            : undefined,
        warnings: findings
          .filter((finding) => finding.code === 'RENTAL-INCOMPLETE')
          .map((finding) => ({ message: finding.message, level: finding.severity }))
      },
      business: {
        status: buildStatusFromCollection(businessRecords, true),
        sublabel:
          businessRecords.length > 0
            ? `${countCompleted(businessRecords)}/${businessRecords.length} businesses complete`
            : undefined,
        warnings: findings
          .filter(
            (finding) =>
              finding.code === 'BUSINESS-INCOMPLETE' || finding.code === 'QBI-REVIEW'
          )
          .map((finding) => ({ message: finding.message, level: finding.severity }))
      },
      retirement: itemFromScreen('retirement', '/ira-retirement', 'Retirement income reviewed', { optional: true }),
      'unemployment-ss': {
        status:
          unemploymentRecords.length > 0 || socialSecurityRecords.length > 0
            ? unemploymentRecords.every((item) => item.isComplete) &&
              socialSecurityRecords.every((item) => item.isComplete)
              ? 'complete'
              : 'in_progress'
            : 'skipped',
        sublabel:
          unemploymentRecords.length > 0 || socialSecurityRecords.length > 0
            ? `${unemploymentRecords.length} unemployment, ${socialSecurityRecords.length} SSA`
            : undefined,
        warnings: findings
          .filter(
            (finding) =>
              finding.code === 'UNEMPLOYMENT-INCOMPLETE' ||
              finding.code === 'SSA-INCOMPLETE'
          )
          .map((finding) => ({ message: finding.message, level: finding.severity }))
      },
      'foreign-income': {
        status:
          foreignIncomeRecords.length > 0 ||
          foreignAccounts.length > 0 ||
          treatyClaims.length > 0 ||
          nonresidentProfile.hasData
            ? foreignIncomeRecords.every((item) => item.isComplete) &&
              foreignAccounts.every((item) => item.isComplete) &&
              treatyClaims.every((item) => item.isComplete) &&
              (!nonresidentProfile.hasData || nonresidentProfile.isComplete)
              ? 'complete'
              : 'in_progress'
            : 'skipped',
        sublabel:
          foreignIncomeRecords.length > 0 ||
          foreignAccounts.length > 0 ||
          treatyClaims.length > 0 ||
          nonresidentProfile.hasData
            ? `${foreignIncomeRecords.length} income records, ${foreignAccounts.length} accounts`
            : undefined,
        warnings: findings
          .filter(
            (finding) =>
              finding.code === 'FOREIGN-INCOMPLETE' ||
              finding.code === 'NONRESIDENT-INCOMPLETE'
          )
          .map((finding) => ({ message: finding.message, level: finding.severity }))
      },
      hsa: itemFromScreen('hsa', '/hsa', 'HSA reviewed', { optional: true }),
      ctc: {
        status:
          creditSummary.summary.eligibleCount > 0 ||
          creditSummary.summary.maybeCount > 0 ||
          creditSummary.summary.blockedCount > 0
            ? 'complete'
            : itemFromScreen('ctc', '/credits-v2', 'Credits reviewed', { optional: true })
                .status,
        sublabel:
          creditSummary.summary.eligibleCount > 0 ||
          creditSummary.summary.maybeCount > 0 ||
          creditSummary.summary.blockedCount > 0
            ? `${creditSummary.summary.eligibleCount} eligible, ${creditSummary.summary.maybeCount} maybe, ${creditSummary.summary.blockedCount} blocked`
            : undefined,
        warnings: findings
          .filter((finding) => finding.code.startsWith('CREDIT'))
          .map((finding) => ({ message: finding.message, level: finding.severity }))
      },
      'your-taxes': itemFromScreen('your-taxes', '/your-taxes', 'Tax details reviewed', { optional: true }),
      'state-tax': itemFromScreen('state-tax', '/state-tax', 'State filing reviewed', { optional: true }),
      'review-confirm': itemFromScreen('review-confirm', '/review-confirm', 'Review confirmed'),
      'efile-wizard': itemFromScreen('efile-wizard', '/efile-wizard', 'E-file steps completed', { optional: true })
    },
    collections: {
      w2s: {
        total: w2Records.length,
        complete: countCompleted(w2Records)
      },
      forms1099: {
        total: form1099Records.length,
        complete: countCompleted(form1099Records)
      },
      dependents: {
        total: dependents.length,
        complete: countCompleted(dependents)
      },
      creditEntities: {
        total: creditSummary.creditEntities.length,
        complete: countCompleted(creditSummary.creditEntities)
      },
      investments: {
        total: taxLots.length + cryptoAccounts.length,
        complete: countCompleted(taxLots) + countCompleted(cryptoAccounts)
      },
      business: {
        total: businessRecords.length + qbiWorksheetEntities.length,
        complete: countCompleted(businessRecords) + countCompleted(qbiWorksheetEntities)
      },
      rentalProperties: {
        total: rentalProperties.length,
        complete: countCompleted(rentalProperties)
      },
      international: {
        total:
          foreignIncomeRecords.length +
          foreignAccounts.length +
          treatyClaims.length +
          (nonresidentProfile.hasData ? 1 : 0),
        complete:
          countCompleted(foreignIncomeRecords) +
          countCompleted(foreignAccounts) +
          countCompleted(treatyClaims) +
          (nonresidentProfile.isComplete ? 1 : 0)
      },
      unemploymentAndSs: {
        total: unemploymentRecords.length + socialSecurityRecords.length,
        complete:
          countCompleted(unemploymentRecords) + countCompleted(socialSecurityRecords)
      }
    },
    ui: {
      filingPathTreeCollapsed:
        Boolean(
          (requireScreen(snapshot, '/checklist').ui as Record<string, unknown> | undefined)
            ?.filingPathTreeCollapsed
        ) || false
    }
  }
}

const buildReview = (
  snapshot: FilingSessionSnapshot,
  findings: ReviewFindingRow[],
  entities: SessionEntitySnapshot[]
) => {
  const taxpayer = requireScreen(snapshot, '/taxpayer-profile')
  const efile = requireScreen(snapshot, '/efile-wizard')
  const w2Records = getW2Records(snapshot, entities)
  const form1099Records = get1099Records(snapshot, entities)
  const dependents = getDependents(snapshot, entities)
  const spouse = getSpouse(snapshot, entities)
  const unemploymentRecords = getUnemploymentRecords(snapshot, entities)
  const socialSecurityRecords = getSocialSecurityRecords(snapshot, entities)
  const taxLots = getTaxLots(snapshot, entities)
  const cryptoAccounts = getCryptoAccounts(snapshot, entities)
  const businessRecords = getBusinessRecords(entities)
  const qbiWorksheetEntities = getQBIWorksheetEntities(snapshot)
  const businessSummary = getBusinessSummary(snapshot, businessRecords, qbiWorksheetEntities)
  const rentalProperties = getRentalProperties(entities)
  const rentalSummary = getRentalSummary(rentalProperties)
  const foreignIncomeRecords = getForeignIncomeRecords(snapshot, entities)
  const foreignAccounts = getForeignAccounts(snapshot, entities)
  const treatyClaims = getTreatyClaims(snapshot, entities)
  const nonresidentProfile = getNonresidentProfile(snapshot)
  const intlAdvancedData = getIntlAdvancedData(snapshot)
  const foreignSummary = getForeignSummary(
    snapshot,
    foreignIncomeRecords,
    foreignAccounts,
    treatyClaims,
    nonresidentProfile,
    intlAdvancedData
  )
  const creditSummary = getCreditSummary(snapshot, dependents)
  const investmentSummary = getInvestmentSummary(taxLots, cryptoAccounts)
  const sections = [
    {
      id: 'filing-info',
      title: 'Filing information',
      rows: [
        {
          label: 'Filing status',
          value: String(taxpayer.filingStatus ?? snapshot.filingStatus).toUpperCase(),
          editPath: '/taxpayer-profile',
          editLabel: 'Edit'
        },
        {
          label: 'Taxpayer',
          value: `${String(taxpayer.firstName ?? '')} ${String(taxpayer.lastName ?? '')}`.trim() || 'Not entered',
          editPath: '/taxpayer-profile',
          editLabel: 'Edit',
          hasError: !taxpayer.firstName || !taxpayer.lastName
        },
        {
          label: 'Prior-year AGI',
          value: taxpayer.priorYearAgi ? `$${Number(taxpayer.priorYearAgi).toLocaleString()}` : 'Not entered',
          editPath: '/taxpayer-profile',
          editLabel: 'Edit',
          hasWarning: !taxpayer.priorYearAgi
        },
        {
          label: 'Spouse',
          value: spouse
            ? `${spouse.firstName} ${spouse.lastName}`.trim() || 'Spouse started'
            : 'No spouse entered',
          editPath: '/spouse',
          editLabel: 'Edit',
          hasWarning: Boolean(spouse && !spouse.isComplete)
        }
      ],
      warnings: findings.map((finding) => ({
        id: finding.id,
        level: finding.severity,
        message: finding.message,
        editPath: finding.fix_path ?? '/checklist',
        editLabel: finding.fix_label ?? 'Review'
      }))
    },
    {
      id: 'income',
      title: 'Income summary',
      rows: [
        {
          label: 'W-2 records',
          value: w2Records.length > 0 ? `${countCompleted(w2Records)}/${w2Records.length} complete` : 'None entered',
          editPath: '/w2',
          editLabel: 'Edit'
        },
        {
          label: 'W-2 wages',
          value: `$${w2Records.reduce((sum, record) => sum + record.box1Wages, 0).toLocaleString()}`,
          editPath: '/w2',
          editLabel: 'Edit'
        },
        {
          label: '1099 records',
          value:
            form1099Records.length > 0
              ? `${countCompleted(form1099Records)}/${form1099Records.length} complete`
              : 'None entered',
          editPath: '/1099',
          editLabel: 'Edit'
        },
        {
          label: '1099 income total',
          value: `$${form1099Records.reduce((sum, record) => sum + record.amount, 0).toLocaleString()}`,
          editPath: '/1099',
          editLabel: 'Edit'
        },
        {
          label: 'Unemployment compensation',
          value: `$${unemploymentRecords.reduce((sum, record) => sum + record.amount, 0).toLocaleString()}`,
          editPath: '/unemployment-ss',
          editLabel: 'Edit'
        },
        {
          label: 'Social Security benefits',
          value: `$${socialSecurityRecords.reduce((sum, record) => sum + record.grossAmount, 0).toLocaleString()}`,
          editPath: '/unemployment-ss',
          editLabel: 'Edit'
        }
      ],
      warnings: findings
        .filter(
          (finding) =>
            finding.code === 'W2-INCOMPLETE' ||
            finding.code === '1099-INCOMPLETE' ||
            finding.code === 'UNEMPLOYMENT-INCOMPLETE' ||
            finding.code === 'SSA-INCOMPLETE'
        )
        .map((finding) => ({
          id: finding.id,
          level: finding.severity,
          message: finding.message,
          editPath: finding.fix_path ?? '/income',
          editLabel: finding.fix_label ?? 'Review'
        }))
    },
    {
      id: 'investments',
      title: 'Investments and crypto',
      rows: [
        {
          label: 'Investment sales',
          value:
            taxLots.length > 0
              ? `${countCompleted(taxLots)}/${taxLots.length} complete`
              : 'No sales entered',
          editPath: '/investments',
          editLabel: 'Edit'
        },
        {
          label: 'Connected crypto accounts',
          value:
            cryptoAccounts.length > 0
              ? `${countCompleted(cryptoAccounts)}/${cryptoAccounts.length} complete`
              : 'No crypto accounts entered',
          editPath: '/crypto',
          editLabel: 'Edit'
        },
        {
          label: 'Net capital gain/loss',
          value: `$${investmentSummary.netCapitalGain.toLocaleString()}`,
          editPath: '/investments',
          editLabel: 'Review'
        }
      ],
      warnings: findings
        .filter((finding) => finding.code === 'INVESTMENT-INCOMPLETE')
        .map((finding) => ({
          id: finding.id,
          level: finding.severity,
          message: finding.message,
          editPath: finding.fix_path ?? '/investments',
          editLabel: finding.fix_label ?? 'Review'
        }))
    },
    {
      id: 'business',
      title: 'Business income and QBI',
      rows: [
        {
          label: 'Businesses / K-1s',
          value:
            businessRecords.length > 0
              ? `${countCompleted(businessRecords)}/${businessRecords.length} complete`
              : 'No businesses entered',
          editPath: '/business-k1',
          editLabel: 'Edit'
        },
        {
          label: 'Net business income',
          value: `$${businessSummary.netBusinessIncome.toLocaleString()}`,
          editPath: '/business-k1',
          editLabel: 'Edit'
        },
        {
          label: 'Estimated SE tax',
          value: `$${businessSummary.estimatedSETax.toLocaleString()}`,
          editPath: '/business-k1',
          editLabel: 'Review'
        },
        {
          label: 'QBI deduction',
          value: `$${businessSummary.finalQBIDeduction.toLocaleString()}`,
          editPath: '/qbi-worksheet',
          editLabel: 'Review'
        }
      ],
      warnings: findings
        .filter(
          (finding) =>
            finding.code === 'BUSINESS-INCOMPLETE' || finding.code === 'QBI-REVIEW'
        )
        .map((finding) => ({
          id: finding.id,
          level: finding.severity,
          message: finding.message,
          editPath: finding.fix_path ?? '/business-k1',
          editLabel: finding.fix_label ?? 'Review'
        }))
    },
    {
      id: 'rental',
      title: 'Rental properties',
      rows: [
        {
          label: 'Rental properties',
          value:
            rentalProperties.length > 0
              ? `${countCompleted(rentalProperties)}/${rentalProperties.length} complete`
              : 'No rentals entered',
          editPath: '/rental',
          editLabel: 'Edit'
        },
        {
          label: 'Gross rents',
          value: `$${rentalSummary.grossRentsTotal.toLocaleString()}`,
          editPath: '/rental',
          editLabel: 'Edit'
        },
        {
          label: 'Deductible expenses',
          value: `$${rentalSummary.deductibleExpensesTotal.toLocaleString()}`,
          editPath: '/rental',
          editLabel: 'Review'
        },
        {
          label: 'Schedule E net',
          value: `$${rentalSummary.scheduleENetIncome.toLocaleString()}`,
          editPath: '/rental',
          editLabel: 'Review'
        }
      ],
      warnings: findings
        .filter((finding) => finding.code === 'RENTAL-INCOMPLETE')
        .map((finding) => ({
          id: finding.id,
          level: finding.severity,
          message: finding.message,
          editPath: finding.fix_path ?? '/rental',
          editLabel: finding.fix_label ?? 'Review'
        }))
    },
    {
      id: 'international',
      title: 'International and nonresident',
      rows: [
        {
          label: 'Foreign earned income',
          value: `$${foreignSummary.totalForeignEarnedIncome.toLocaleString()}`,
          editPath: '/foreign-income',
          editLabel: 'Edit'
        },
        {
          label: 'FEIE exclusion estimate',
          value: `$${foreignSummary.feieExclusionEstimate.toLocaleString()}`,
          editPath: '/intl-advanced',
          editLabel: 'Review'
        },
        {
          label: 'Foreign tax paid',
          value: `$${foreignSummary.totalForeignTaxPaid.toLocaleString()}`,
          editPath: '/foreign-income',
          editLabel: 'Edit'
        },
        {
          label: 'International filing path',
          value: foreignSummary.requires1040NR
            ? '1040-NR'
            : foreignSummary.dualStatus
              ? 'Dual-status'
              : foreignSummary.hasActivity
                ? '1040 with foreign schedules'
                : 'No international activity',
          editPath: '/nonresident',
          editLabel: 'Review'
        }
      ],
      warnings: findings
        .filter(
          (finding) =>
            finding.code === 'FOREIGN-INCOMPLETE' ||
            finding.code === 'NONRESIDENT-INCOMPLETE' ||
            finding.code === 'FBAR-REMINDER'
        )
        .map((finding) => ({
          id: finding.id,
          level: finding.severity,
          message: finding.message,
          editPath: finding.fix_path ?? '/foreign-income',
          editLabel: finding.fix_label ?? 'Review'
        }))
    },
    {
      id: 'household-credits',
      title: 'Dependents and credits',
      rows: [
        {
          label: 'Dependents',
          value:
            dependents.length > 0
              ? `${countCompleted(dependents)}/${dependents.length} complete`
              : 'No dependents entered',
          editPath: '/household',
          editLabel: 'Edit'
        },
        {
          label: 'Eligible credits',
          value: String(creditSummary.summary.eligibleCount),
          editPath: '/credits-v2',
          editLabel: 'Review'
        },
        {
          label: 'Estimated credit total',
          value: `$${creditSummary.summary.estimatedTotal.toLocaleString()}`,
          editPath: '/credits-v2',
          editLabel: 'Review'
        }
      ],
      warnings: findings
        .filter((finding) => finding.code.startsWith('DEPENDENT') || finding.code.startsWith('CREDIT'))
        .map((finding) => ({
          id: finding.id,
          level: finding.severity,
          message: finding.message,
          editPath: finding.fix_path ?? '/credits-v2',
          editLabel: finding.fix_label ?? 'Review'
        }))
    },
    {
      id: 'file',
      title: 'Ready to file',
      subtotal: {
        label: 'Estimated refund',
        value: `$${Number(snapshot.estimatedRefund ?? 0).toLocaleString()}`,
        isPositive: (snapshot.estimatedRefund ?? 0) >= 0
      },
      rows: [
        {
          label: 'Routing number',
          value: String(efile.routing ?? 'Not entered'),
          editPath: '/efile-wizard',
          editLabel: 'Edit',
          hasWarning: !efile.routing
        },
        {
          label: 'Account number',
          value: String(efile.account ? `••••${String(efile.account).slice(-4)}` : 'Paper check'),
          editPath: '/efile-wizard',
          editLabel: 'Edit'
        },
        {
          label: 'Signature',
          value: String(efile.signatureText ?? 'Not signed'),
          editPath: '/efile-wizard',
          editLabel: 'Edit',
          hasError: !efile.signatureText
        }
      ],
      warnings: []
    }
  ]

  return {
    sections,
    acknowledgedWarnings: {}
  }
}

const toFindingRows = (
  sessionId: string,
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
): ReviewFindingRow[] => {
  const taxpayer = requireScreen(snapshot, '/taxpayer-profile')
  const efile = requireScreen(snapshot, '/efile-wizard')
  const w2Records = getW2Records(snapshot, entities)
  const form1099Records = get1099Records(snapshot, entities)
  const dependents = getDependents(snapshot, entities)
  const spouse = getSpouse(snapshot, entities)
  const unemploymentRecords = getUnemploymentRecords(snapshot, entities)
  const socialSecurityRecords = getSocialSecurityRecords(snapshot, entities)
  const taxLots = getTaxLots(snapshot, entities)
  const cryptoAccounts = getCryptoAccounts(snapshot, entities)
  const businessRecords = getBusinessRecords(entities)
  const qbiWorksheetEntities = getQBIWorksheetEntities(snapshot)
  const businessSummary = getBusinessSummary(snapshot, businessRecords, qbiWorksheetEntities)
  const rentalProperties = getRentalProperties(entities)
  const foreignIncomeRecords = getForeignIncomeRecords(snapshot, entities)
  const foreignAccounts = getForeignAccounts(snapshot, entities)
  const treatyClaims = getTreatyClaims(snapshot, entities)
  const nonresidentProfile = getNonresidentProfile(snapshot)
  const intlAdvancedData = getIntlAdvancedData(snapshot)
  const foreignSummary = getForeignSummary(
    snapshot,
    foreignIncomeRecords,
    foreignAccounts,
    treatyClaims,
    nonresidentProfile,
    intlAdvancedData
  )
  const creditSummary = getCreditSummary(snapshot, dependents)
  const now = nowIso()
  const findings: ReviewFindingRow[] = []

  if (!taxpayer.firstName || !taxpayer.lastName || !taxpayer.ssn) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'TAXPAYER-ID',
      severity: 'error',
      title: 'Complete taxpayer identity',
      message: 'Taxpayer name and SSN are required before filing.',
      fix_path: '/taxpayer-profile',
      fix_label: 'Complete taxpayer profile',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (!taxpayer.priorYearAgi) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'PRIOR-YEAR-AGI',
      severity: 'warning',
      title: 'Prior-year AGI missing',
      message:
        'Prior-year AGI is recommended for e-file identity verification. Enter $0 if you did not file last year.',
      fix_path: '/efile-wizard?step=identity&field=prior_year_agi',
      fix_label: 'Add prior-year AGI',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (spouse && !spouse.isComplete) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'SPOUSE-INCOMPLETE',
      severity: 'warning',
      title: 'Finish spouse details',
      message: 'Your spouse record is missing a name, date of birth, or identifying information.',
      fix_path: '/spouse',
      fix_label: 'Complete spouse info',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (!efile.signatureText) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'SIGNATURE-MISSING',
      severity: 'error',
      title: 'Form 8879 signature required',
      message: 'You must sign the return before we can transmit it to the IRS.',
      fix_path: '/efile-wizard',
      fix_label: 'Sign return',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (w2Records.some((record) => !record.isComplete)) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'W2-INCOMPLETE',
      severity: 'warning',
      title: 'Finish your W-2 entries',
      message: 'One or more W-2 forms are missing an employer name, EIN, or wages.',
      fix_path: '/w2',
      fix_label: 'Complete W-2 details',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (form1099Records.some((record) => !record.isComplete)) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: '1099-INCOMPLETE',
      severity: 'warning',
      title: 'Finish your 1099 entries',
      message: 'One or more 1099 forms are missing a payer or amount.',
      fix_path: '/1099',
      fix_label: 'Complete 1099 details',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (unemploymentRecords.some((record) => !record.isComplete)) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'UNEMPLOYMENT-INCOMPLETE',
      severity: 'warning',
      title: 'Finish unemployment details',
      message: 'Your unemployment record is missing the benefit amount.',
      fix_path: '/unemployment-ss',
      fix_label: 'Complete unemployment details',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (socialSecurityRecords.some((record) => !record.isComplete)) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'SSA-INCOMPLETE',
      severity: 'warning',
      title: 'Finish Social Security details',
      message: 'Your Social Security record is missing the gross benefit amount.',
      fix_path: '/unemployment-ss',
      fix_label: 'Complete Social Security details',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (taxLots.some((record) => !record.isComplete) || cryptoAccounts.some((record) => !record.isComplete)) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'INVESTMENT-INCOMPLETE',
      severity: 'warning',
      title: 'Finish investment or crypto details',
      message: 'An investment sale or crypto account is missing required details.',
      fix_path: '/investments',
      fix_label: 'Complete investment details',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (businessRecords.some((record) => !record.isComplete)) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'BUSINESS-INCOMPLETE',
      severity: 'warning',
      title: 'Finish business income details',
      message: 'A Schedule C or K-1 record is missing business name or income details.',
      fix_path: '/business-k1',
      fix_label: 'Complete business details',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (businessSummary.recordCount > 0 && businessSummary.qbiEligibleCount > 0 && qbiWorksheetEntities.length === 0) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'QBI-REVIEW',
      severity: 'warning',
      title: 'Review the QBI deduction',
      message: 'Your business income may qualify for the Section 199A deduction. Review the QBI worksheet before filing.',
      fix_path: '/qbi-worksheet',
      fix_label: 'Review QBI worksheet',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (rentalProperties.some((property) => !property.isComplete)) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'RENTAL-INCOMPLETE',
      severity: 'warning',
      title: 'Finish rental property details',
      message: 'A rental property is missing an address, rent amount, or expense details.',
      fix_path: '/rental',
      fix_label: 'Complete rental details',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (
    foreignIncomeRecords.some((record) => !record.isComplete) ||
    foreignAccounts.some((account) => !account.isComplete) ||
    treatyClaims.some((claim) => !claim.isComplete)
  ) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'FOREIGN-INCOMPLETE',
      severity: 'warning',
      title: 'Finish international details',
      message: 'Foreign income, account, or treaty data is missing country, amount, or classification details.',
      fix_path: '/foreign-income',
      fix_label: 'Complete foreign details',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (nonresidentProfile.hasData && !nonresidentProfile.isComplete) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'NONRESIDENT-INCOMPLETE',
      severity: 'warning',
      title: 'Finish nonresident residency details',
      message: 'Your nonresident profile is missing visa, citizenship, or day-count details needed to determine the filing path.',
      fix_path: '/nonresident',
      fix_label: 'Complete nonresident details',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (foreignSummary.fbarRequired) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'FBAR-REMINDER',
      severity: 'warning',
      title: 'Separate FBAR filing may be required',
      message: 'Your foreign account balances indicate that FinCEN Form 114 may need to be filed separately from your tax return.',
      fix_path: '/foreign-income',
      fix_label: 'Review FBAR requirements',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (dependents.some((dependent) => !dependent.isComplete)) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'DEPENDENT-INCOMPLETE',
      severity: 'error',
      title: 'Finish dependent details',
      message: 'A dependent is missing a name, date of birth, relationship, or SSN.',
      fix_path: '/household',
      fix_label: 'Complete dependent info',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (
    dependents.length > 0 &&
    creditSummary.summary.eligibleCount === 0 &&
    creditSummary.summary.maybeCount === 0 &&
    creditSummary.summary.blockedCount === 0
  ) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'CREDIT-REVIEW',
      severity: 'warning',
      title: 'Review family credits',
      message:
        'You added dependents, but no credits have been reviewed yet. Check CTC, EITC, and care credits before filing.',
      fix_path: '/credits-v2',
      fix_label: 'Review credits',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (creditSummary.summary.blockedCount > 0) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'CREDIT-BLOCKED',
      severity: 'warning',
      title: 'Resolve blocked credits',
      message: 'At least one credit is marked blocked and needs more information before filing.',
      fix_path: '/credits-v2',
      fix_label: 'Resolve credit issues',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  return findings
}

export class AppSessionService {
  constructor(
    private readonly env: Env,
    private readonly repository: TaxRepository,
    private readonly artifacts: ArtifactStore,
    private readonly apiService: ApiService
  ) {}

  async upsertUser(user: AppUserClaims): Promise<void> {
    const now = nowIso()
    await this.env.USTAXES_DB
      .prepare(
        `INSERT INTO users (id, email, tin, display_name, created_at, updated_at, last_login_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
           email = excluded.email,
           tin = excluded.tin,
           display_name = excluded.display_name,
           updated_at = excluded.updated_at,
           last_login_at = excluded.last_login_at`
      )
      .bind(user.sub, user.email, user.tin ?? null, user.displayName ?? null, now, now, now)
      .run()
  }

  async getAuthenticatedUser(user: AppUserClaims) {
    await this.upsertUser(user)
    return {
      id: user.sub,
      email: user.email,
      tin: user.tin ?? null,
      displayName: user.displayName ?? null
    }
  }

  async createFilingSession(rawBody: unknown, user: AppUserClaims) {
    await this.upsertUser(user)
    const body = filingSessionCreateSchema.parse(rawBody ?? {})
    const id = crypto.randomUUID()
    const now = nowIso()
    const metadataKey = `filing-sessions/${id}/snapshot.json`
    const snapshot = defaultSnapshot(body)
    await this.artifacts.putJson(metadataKey, snapshot)

    await this.env.USTAXES_DB
      .prepare(
        `INSERT INTO filing_sessions (
          id, user_id, local_session_id, tax_year, filing_status, form_type,
          lifecycle_status, name, current_phase, last_screen, completion_pct,
          estimated_refund, metadata_key, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'draft', ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`
      )
      .bind(
        id,
        user.sub,
        body.localSessionId ?? null,
        snapshot.taxYear,
        snapshot.filingStatus,
        snapshot.formType,
        snapshot.name,
        snapshot.currentPhase,
        snapshot.lastScreen ?? null,
        snapshot.completionPct,
        snapshot.estimatedRefund ?? null,
        metadataKey,
        now,
        now
      )
      .run()

    const row = await this.getSessionRow(id, user.sub)
    if (!row) {
      throw new HttpError(500, 'Failed to create filing session')
    }
    return {
      filingSession: toSnapshot(row, snapshot)
    }
  }

  async getFilingSession(sessionId: string, user: AppUserClaims) {
    const row = await this.requireSession(sessionId, user.sub)
    const snapshot = await this.getSnapshot(row)
    return {
      filingSession: toSnapshot(row, snapshot)
    }
  }

  async patchFilingSession(
    sessionId: string,
    rawBody: unknown,
    user: AppUserClaims
  ) {
    const row = await this.requireSession(sessionId, user.sub)
    const current = await this.getSnapshot(row)
    const patch = filingSessionPatchSchema.parse(rawBody ?? {})
    const snapshot: FilingSessionSnapshot = {
      ...current,
      ...patch,
      name: patch.name ?? current.name,
      taxYear: patch.taxYear ?? current.taxYear,
      filingStatus: patch.filingStatus ?? current.filingStatus,
      formType: (patch.formType ?? current.formType) as FilingSessionSnapshot['formType'],
      currentPhase: (patch.currentPhase ?? current.currentPhase) as FilingPhase,
      lastScreen: patch.lastScreen ?? current.lastScreen,
      completionPct: patch.completionPct ?? current.completionPct,
      estimatedRefund: patch.estimatedRefund ?? current.estimatedRefund,
      completedScreens: patch.completedScreens ?? current.completedScreens,
      screenData: patch.screenData ?? current.screenData,
      checklistState: patch.checklistState ?? current.checklistState,
      entities: patch.entities ?? current.entities
    }
    await this.artifacts.putJson(row.metadata_key, snapshot)
    const lifecycle = patch.lifecycleStatus ?? row.lifecycle_status
    const now = nowIso()
    await this.env.USTAXES_DB
      .prepare(
        `UPDATE filing_sessions
         SET tax_year = ?1,
             filing_status = ?2,
             form_type = ?3,
             lifecycle_status = ?4,
             name = ?5,
             current_phase = ?6,
             last_screen = ?7,
             completion_pct = ?8,
             estimated_refund = ?9,
             updated_at = ?10
         WHERE id = ?11`
      )
      .bind(
        snapshot.taxYear,
        snapshot.filingStatus,
        snapshot.formType,
        lifecycle,
        snapshot.name,
        snapshot.currentPhase,
        snapshot.lastScreen ?? null,
        snapshot.completionPct,
        snapshot.estimatedRefund ?? null,
        now,
        sessionId
      )
      .run()

    const updated = await this.requireSession(sessionId, user.sub)
    return {
      filingSession: toSnapshot(updated, snapshot)
    }
  }

  private async loadSessionEntities(
    sessionId: string
  ): Promise<SessionEntitySnapshot[]> {
    const result = await this.env.USTAXES_DB
      .prepare(
        `SELECT id, filing_session_id, entity_type, entity_key, status, label, data_key, created_at, updated_at
         FROM session_entities
         WHERE filing_session_id = ?1
         ORDER BY updated_at DESC`
      )
      .bind(sessionId)
      .all<SessionEntityRow>()

    return Promise.all(
      (result.results ?? []).map(async (row) => ({
        id: row.id,
        entityType: row.entity_type,
        entityKey: row.entity_key,
        status: row.status,
        label: row.label,
        data:
          (await this.artifacts.getJson<Record<string, unknown>>(row.data_key)) ?? {},
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    )
  }

  async listEntities(sessionId: string, user: AppUserClaims) {
    await this.requireSession(sessionId, user.sub)
    return { entities: await this.loadSessionEntities(sessionId) }
  }

  async putEntity(
    sessionId: string,
    entityType: string,
    entityId: string,
    rawBody: unknown,
    user: AppUserClaims
  ) {
    await this.requireSession(sessionId, user.sub)
    const body = entitySchema.parse(rawBody ?? {})
    const now = nowIso()
    const dataKey = `filing-sessions/${sessionId}/entities/${entityType}/${entityId}.json`
    await this.artifacts.putJson(dataKey, body.data)
    await this.env.USTAXES_DB
      .prepare(
        `INSERT INTO session_entities (
          id, filing_session_id, entity_type, entity_key, status, label, data_key, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        ON CONFLICT(filing_session_id, entity_type, entity_key) DO UPDATE SET
          status = excluded.status,
          label = excluded.label,
          data_key = excluded.data_key,
          updated_at = excluded.updated_at`
      )
      .bind(entityId, sessionId, entityType, entityId, body.status, body.label ?? null, dataKey, now, now)
      .run()

    return {
      entity: {
        id: entityId,
        entityType,
        entityKey: entityId,
        status: body.status,
        label: body.label ?? null,
        data: body.data,
        updatedAt: now
      }
    }
  }

  async deleteEntity(
    sessionId: string,
    entityType: string,
    entityId: string,
    user: AppUserClaims
  ) {
    await this.requireSession(sessionId, user.sub)
    await this.env.USTAXES_DB
      .prepare(
        `DELETE FROM session_entities
         WHERE filing_session_id = ?1 AND entity_type = ?2 AND entity_key = ?3`
      )
      .bind(sessionId, entityType, entityId)
      .run()
    return { deleted: true }
  }

  async createDocument(
    sessionId: string,
    rawBody: unknown,
    user: AppUserClaims
  ) {
    await this.requireSession(sessionId, user.sub)
    const body = documentCreateSchema.parse(rawBody ?? {})
    const id = crypto.randomUUID()
    const now = nowIso()
    const artifactKey = body.contentBase64
      ? `filing-sessions/${sessionId}/documents/${id}/content.json`
      : null
    const metadataKey = `filing-sessions/${sessionId}/documents/${id}/metadata.json`
    if (artifactKey) {
      await this.artifacts.putJson(artifactKey, {
        contentBase64: body.contentBase64,
        mimeType: body.mimeType
      })
    }
    await this.artifacts.putJson(metadataKey, body.metadata)
    await this.env.USTAXES_DB
      .prepare(
        `INSERT INTO documents (
          id, filing_session_id, name, mime_type, status, cluster, cluster_confidence,
          pages, artifact_key, metadata_key, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
      )
      .bind(
        id,
        sessionId,
        body.name,
        body.mimeType,
        body.status,
        body.cluster,
        body.clusterConfidence,
        body.pages,
        artifactKey,
        metadataKey,
        now,
        now
      )
      .run()

    return this.getDocument(sessionId, id, user)
  }

  async getDocument(sessionId: string, documentId: string, user: AppUserClaims) {
    await this.requireSession(sessionId, user.sub)
    const row = await this.env.USTAXES_DB
      .prepare(
        `SELECT id, filing_session_id, name, mime_type, status, cluster, cluster_confidence, pages, artifact_key, metadata_key, created_at, updated_at
         FROM documents WHERE filing_session_id = ?1 AND id = ?2`
      )
      .bind(sessionId, documentId)
      .first<DocumentRow>()
    if (!row) {
      throw new HttpError(404, 'Document not found')
    }
    return {
      document: {
        id: row.id,
        name: row.name,
        mimeType: row.mime_type,
        status: row.status,
        cluster: row.cluster,
        clusterConfidence: row.cluster_confidence,
        pages: row.pages,
        metadata:
          (await this.artifacts.getJson<Record<string, unknown>>(row.metadata_key)) ??
          {},
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    }
  }

  async patchDocument(
    sessionId: string,
    documentId: string,
    rawBody: unknown,
    user: AppUserClaims
  ) {
    await this.requireSession(sessionId, user.sub)
    const current = await this.getDocument(sessionId, documentId, user)
    const patch = documentPatchSchema.parse(rawBody ?? {})
    const metadata = {
      ...(current.document.metadata as Record<string, unknown>),
      ...(patch.metadata ?? {})
    }
    const row = await this.env.USTAXES_DB
      .prepare(
        `SELECT metadata_key FROM documents WHERE filing_session_id = ?1 AND id = ?2`
      )
      .bind(sessionId, documentId)
      .first<{ metadata_key: string }>()
    if (!row) {
      throw new HttpError(404, 'Document not found')
    }
    await this.artifacts.putJson(row.metadata_key, metadata)
    await this.env.USTAXES_DB
      .prepare(
        `UPDATE documents
         SET status = COALESCE(?1, status),
             cluster = COALESCE(?2, cluster),
             cluster_confidence = COALESCE(?3, cluster_confidence),
             pages = COALESCE(?4, pages),
             updated_at = ?5
         WHERE filing_session_id = ?6 AND id = ?7`
      )
      .bind(
        patch.status ?? null,
        patch.cluster ?? null,
        patch.clusterConfidence ?? null,
        patch.pages ?? null,
        nowIso(),
        sessionId,
        documentId
      )
      .run()
    return this.getDocument(sessionId, documentId, user)
  }

  async getChecklist(sessionId: string, user: AppUserClaims) {
    const row = await this.requireSession(sessionId, user.sub)
    const snapshot = await this.getSnapshot(row)
    const entities = await this.loadSessionEntities(row.id)
    const findings = await this.syncReviewFindings(row.id, snapshot, entities)
    return {
      checklist: buildChecklist(snapshot, entities, findings),
      findings: findings.map((finding) => ({
        id: finding.id,
        severity: finding.severity,
        message: finding.message,
        fixPath: finding.fix_path,
        fixLabel: finding.fix_label
      }))
    }
  }

  async getReview(sessionId: string, user: AppUserClaims) {
    const row = await this.requireSession(sessionId, user.sub)
    const snapshot = await this.getSnapshot(row)
    const entities = await this.loadSessionEntities(row.id)
    const findings = await this.syncReviewFindings(row.id, snapshot, entities)
    return {
      review: buildReview(snapshot, findings, entities)
    }
  }

  async syncReturn(sessionId: string, user: AppUserClaims) {
    const row = await this.requireSession(sessionId, user.sub)
    const snapshot = await this.getSnapshot(row)
    const entities = await this.loadSessionEntities(row.id)
    const facts = toFacts(row, snapshot, entities)
    let taxReturnId = row.tax_return_id
    let factsKey = row.facts_key
    if (!taxReturnId) {
      const created = await this.apiService.createReturn({
        taxYear: snapshot.taxYear,
        filingStatus: snapshot.filingStatus,
        facts,
        ownerId: user.sub,
        ownerTin: String(facts.primaryTIN ?? '') || user.tin,
        formType: snapshot.formType === '1040-SS' ? '1040-SS' : snapshot.formType
      })
      taxReturnId = created.taxReturn.id
      factsKey = created.taxReturn.factsKey
    } else if (factsKey) {
      await this.artifacts.putJson(factsKey, facts)
    }

    const newFactsKey = factsKey ?? `returns/${taxReturnId}/facts.json`
    if (!factsKey && taxReturnId) {
      await this.artifacts.putJson(newFactsKey, facts)
      await this.repository.updateTaxReturnFactsKey(taxReturnId, newFactsKey)
    }

    await this.env.USTAXES_DB
      .prepare(
        `UPDATE filing_sessions
         SET tax_return_id = ?1, facts_key = ?2, updated_at = ?3
         WHERE id = ?4`
      )
      .bind(taxReturnId, newFactsKey, nowIso(), sessionId)
      .run()

    return {
      taxReturnId,
      facts
    }
  }

  async sign(sessionId: string, rawBody: unknown, user: AppUserClaims) {
    const row = await this.requireSession(sessionId, user.sub)
    const body = signSchema.parse(rawBody ?? {})
    const snapshot = await this.getSnapshot(row)
    await this.syncReturn(sessionId, user)
    const signedAt = nowIso()
    const signKey = `filing-sessions/${sessionId}/signature/${signedAt}.json`
    await this.artifacts.putJson(signKey, {
      signerName: body.signerName,
      intentStatement: body.intentStatement,
      signedAt
    })
    await this.patchFilingSession(
      sessionId,
      {
        lifecycleStatus: 'signed',
        screenData: {
          ...snapshot.screenData,
          '/efile-wizard': {
            ...(snapshot.screenData['/efile-wizard'] ?? {}),
            signatureText: body.signerName,
            agreed8879: true
          }
        }
      },
      user
    )
    return {
      signed: true,
      signedAt,
      signKey
    }
  }

  async submit(sessionId: string, rawBody: unknown, user: AppUserClaims) {
    const row = await this.requireSession(sessionId, user.sub)
    const body = submitSchema.parse(rawBody ?? {})
    const syncResult = await this.syncReturn(sessionId, user)
    const refreshed = await this.requireSession(sessionId, user.sub)
    const snapshot = await this.getSnapshot(refreshed)
    const entities = await this.loadSessionEntities(refreshed.id)
    const facts = body.factsOverride ?? toFacts(refreshed, snapshot, entities)
    const payload = {
      ...toSubmissionPayload(refreshed, snapshot, facts),
      ...(body.payloadOverride ?? {})
    } as SubmissionPayload
    const result = await this.apiService.submitReturn(syncResult.taxReturnId, {
      idempotencyKey: body.idempotencyKey,
      payload
    })
    await this.env.USTAXES_DB
      .prepare(
        `UPDATE filing_sessions
         SET latest_submission_id = ?1, lifecycle_status = 'queued', updated_at = ?2
         WHERE id = ?3`
      )
      .bind(result.submission.id, nowIso(), sessionId)
      .run()

    return {
      submission: result.submission,
      taxReturnId: syncResult.taxReturnId
    }
  }

  async getSubmission(sessionId: string, user: AppUserClaims) {
    const row = await this.requireSession(sessionId, user.sub)
    if (!row.latest_submission_id) {
      return {
        submission: null
      }
    }
    const submission = await this.apiService.getSubmission(row.latest_submission_id)
    const ack = await this.apiService.getSubmissionAck(row.latest_submission_id)
    const payload = await this.apiService.getSubmissionPayload(row.latest_submission_id)
    const rejectionErrors = this.buildRejectionRepairErrors(
      ack.ack?.rejectionCodes ?? [],
      payload.payload ?? null
    )
    const lifecycleStatus = this.toLifecycleStatus(
      submission.submission.status,
      ack.ack,
      rejectionErrors
    )

    await this.env.USTAXES_DB
      .prepare(
        `UPDATE filing_sessions
         SET lifecycle_status = ?1, updated_at = ?2
         WHERE id = ?3`
      )
      .bind(lifecycleStatus, nowIso(), sessionId)
      .run()

    return {
      submission: {
        ...submission.submission,
        lifecycleStatus,
        ack: ack.ack,
        events: submission.events,
        rejectionErrors,
        canRetry:
          submission.submission.status === 'rejected' ||
          submission.submission.status === 'failed',
        retryEndpoint: `/app/v1/filing-sessions/${sessionId}/submission/retry`
      }
    }
  }

  async retrySubmission(sessionId: string, user: AppUserClaims) {
    const row = await this.requireSession(sessionId, user.sub)
    if (!row.latest_submission_id) {
      throw new HttpError(409, 'No submission is available to retry')
    }
    const result = await this.apiService.retrySubmission(row.latest_submission_id)
    await this.env.USTAXES_DB
      .prepare(
        `UPDATE filing_sessions
         SET lifecycle_status = 'retrying', updated_at = ?1
         WHERE id = ?2`
      )
      .bind(nowIso(), sessionId)
      .run()
    return {
      ...result,
      lifecycleStatus: 'retrying' as const
    }
  }

  async getPrintMailPacket(sessionId: string, user: AppUserClaims) {
    const row = await this.requireSession(sessionId, user.sub)
    const snapshot = await this.getSnapshot(row)
    const entities = await this.loadSessionEntities(row.id)
    const taxpayer = requireScreen(snapshot, '/taxpayer-profile')
    const spouse = getSpouse(snapshot, entities)
    const review = requireScreen(snapshot, '/review-confirm')
    const printMail = requireScreen(snapshot, '/print-mail')
    const facts = toFacts(row, snapshot, entities)
    const amountOwed = Math.max(
      0,
      Number(review.totalTax ?? 0) - Number(review.totalPayments ?? 0)
    )
    const address = resolvePrintMailAddress(
      toText(asRecord(taxpayer.address).state ?? 'CA'),
      amountOwed > 0
    )
    const attachments = [
      'Signed Form 1040 (and all included schedules)',
      'Copy B of each W-2',
      'Any 1099 showing federal withholding'
    ]
    if (amountOwed > 0) {
      attachments.push(
        "Check or money order payable to 'United States Treasury' with SSN and tax year noted"
      )
    }

    const checklist = [
      'Print the full return single-sided on plain white paper.',
      'Sign and date the return.',
      spouse && snapshot.filingStatus.toLowerCase() === 'mfj'
        ? 'Make sure both spouses sign the return.'
        : 'Confirm all required taxpayer signatures are present.',
      'Attach W-2s and any withholding 1099s to the front of the return.',
      amountOwed > 0
        ? 'Include your payment voucher and check or money order.'
        : 'No payment is required unless your return balance changes before mailing.',
      'Mail using certified mail or an equivalent tracked delivery service.'
    ]

    const packet = {
      filingSessionId: row.id,
      generatedAt: nowIso(),
      packetStatus: printMail.mailedAt ? 'mailed' : 'ready',
      reason: toText(printMail.reason || 'not_specified'),
      taxYear: snapshot.taxYear,
      formType: snapshot.formType,
      filingStatus: snapshot.filingStatus,
      taxpayer: {
        firstName: toText(taxpayer.firstName),
        lastName: toText(taxpayer.lastName),
        address: asRecord(taxpayer.address)
      },
      spouse,
      returnSummary: {
        totalTax: Number(review.totalTax ?? 0),
        totalPayments: Number(review.totalPayments ?? 0),
        refund: Number(review.totalRefund ?? snapshot.estimatedRefund ?? 0),
        amountOwed
      },
      mailingAddress: address,
      attachments,
      checklist,
      coverLetter: [
        `Tax year: ${snapshot.taxYear}`,
        `Filer: ${toText(taxpayer.firstName)} ${toText(taxpayer.lastName)}`.trim(),
        spouse
          ? `Spouse: ${spouse.firstName} ${spouse.lastName}`.trim()
          : 'Spouse: none',
        `Filing status: ${snapshot.filingStatus.toUpperCase()}`,
        amountOwed > 0
          ? `Amount enclosed: $${amountOwed.toLocaleString()}`
          : 'No payment enclosed.',
        `Mail to: ${address.lines.join(', ')}`,
        'Verify the mailing address against the latest IRS where-to-file guidance before sending.'
      ].join('\n'),
      factsSummary: {
        spousePresent: Boolean(spouse),
        dependentCount: asArray(facts.dependents).length,
        w2Count: asArray(facts.w2Records).length,
        form1099Count: asArray(facts.form1099Records).length
      },
      verificationUrl: address.verificationUrl
    }

    const packetKey = `filing-sessions/${sessionId}/print-mail/packet.json`
    await this.artifacts.putJson(packetKey, packet)

    return {
      printMail: {
        ...packet,
        packetKey
      }
    }
  }

  async updatePrintMailPacket(
    sessionId: string,
    rawBody: unknown,
    user: AppUserClaims
  ) {
    const row = await this.requireSession(sessionId, user.sub)
    const body = printMailSchema.parse(rawBody ?? {})
    const snapshot = await this.getSnapshot(row)
    const nextPrintMail = {
      ...(snapshot.screenData['/print-mail'] ?? {}),
      ...(body.reason ? { reason: body.reason } : {}),
      ...(body.markMailed ? { mailedAt: nowIso() } : {})
    }

    await this.patchFilingSession(
      sessionId,
      {
        lifecycleStatus: 'print_and_mail',
        lastScreen: '/print-mail',
        screenData: {
          ...snapshot.screenData,
          '/print-mail': nextPrintMail
        }
      },
      user
    )

    return this.getPrintMailPacket(sessionId, user)
  }

  async getStateTransfer(sessionId: string, user: AppUserClaims) {
    const row = await this.requireSession(sessionId, user.sub)
    const snapshot = await this.getSnapshot(row)
    const stateCode = String(
      ((snapshot.screenData['/taxpayer-profile']?.address as Record<string, unknown> | undefined)?.state ??
        snapshot.screenData['/state-tax']?.stateCode ??
        'CA')
    ).toUpperCase()
    const profile = resolveStateProfile(this.env, stateCode)
    return {
      stateTransfer: {
        stateCode,
        profile,
        taxReturnId: row.tax_return_id,
        latestSubmissionId: row.latest_submission_id,
        acceptedOnly: profile?.acceptedOnly ?? false
      }
    }
  }

  async authorizeStateTransfer(
    sessionId: string,
    rawBody: unknown,
    user: AppUserClaims
  ) {
    const row = await this.requireSession(sessionId, user.sub)
    const body = stateTransferSchema.parse(rawBody ?? {})
    const id = crypto.randomUUID()
    const authorizationCode = crypto.randomUUID()
    const metadataKey = `filing-sessions/${sessionId}/state-transfer/${authorizationCode}.json`
    const now = nowIso()
    await this.artifacts.putJson(metadataKey, {
      authorizationCode,
      stateCode: body.stateCode.toUpperCase(),
      filingSessionId: sessionId,
      latestSubmissionId: row.latest_submission_id,
      createdAt: now
    })
    await this.env.USTAXES_DB
      .prepare(
        `INSERT INTO state_transfer_authorizations (
          id, filing_session_id, state_code, authorization_code, submission_id, status, metadata_key, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, 'authorized', ?6, ?7, ?8)`
      )
      .bind(
        id,
        sessionId,
        body.stateCode.toUpperCase(),
        authorizationCode,
        row.latest_submission_id ?? null,
        metadataKey,
        now,
        now
      )
      .run()

    return {
      authorizationCode,
      stateCode: body.stateCode.toUpperCase()
    }
  }

  private async getSessionRow(id: string, userId: string): Promise<FilingSessionRow | null> {
    return (
      (await this.env.USTAXES_DB
        .prepare(
          `SELECT id, user_id, local_session_id, tax_year, filing_status, form_type, lifecycle_status, name,
                  current_phase, last_screen, completion_pct, estimated_refund, tax_return_id, latest_submission_id,
                  metadata_key, facts_key, created_at, updated_at
           FROM filing_sessions
           WHERE id = ?1 AND user_id = ?2`
        )
        .bind(id, userId)
        .first<FilingSessionRow>()) ?? null
    )
  }

  private async requireSession(id: string, userId: string): Promise<FilingSessionRow> {
    const row = await this.getSessionRow(id, userId)
    if (!row) {
      throw new HttpError(404, 'Filing session not found')
    }
    return row
  }

  private async getSnapshot(row: FilingSessionRow): Promise<FilingSessionSnapshot> {
    return (
      (await this.artifacts.getJson<FilingSessionSnapshot>(row.metadata_key)) ?? {
        name: row.name,
        taxYear: row.tax_year,
        filingStatus: row.filing_status,
        formType: row.form_type as FilingSessionSnapshot['formType'],
        currentPhase: row.current_phase,
        lastScreen: row.last_screen ?? undefined,
        completionPct: row.completion_pct,
        estimatedRefund: row.estimated_refund,
        completedScreens: [],
        screenData: {},
        checklistState: {},
        entities: {}
      }
    )
  }

  private async syncReviewFindings(
    sessionId: string,
    snapshot: FilingSessionSnapshot,
    entities: SessionEntitySnapshot[]
  ): Promise<ReviewFindingRow[]> {
    const findings = toFindingRows(sessionId, snapshot, entities)
    await this.env.USTAXES_DB
      .prepare(`DELETE FROM review_findings WHERE filing_session_id = ?1`)
      .bind(sessionId)
      .run()

    for (const finding of findings) {
      await this.env.USTAXES_DB
        .prepare(
          `INSERT INTO review_findings (
            id, filing_session_id, code, severity, title, message, fix_path, fix_label, acknowledged, metadata_key, created_at, updated_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
        )
        .bind(
          finding.id,
          finding.filing_session_id,
          finding.code,
          finding.severity,
          finding.title,
          finding.message,
          finding.fix_path,
          finding.fix_label,
          finding.acknowledged,
          finding.metadata_key,
          finding.created_at,
          finding.updated_at
        )
        .run()
    }

    return findings
  }

  private toLifecycleStatus(
    status: string,
    ack: { rejectionCodes?: string[] } | null,
    rejectionErrors: RejectionRepairError[] = []
  ): FilingLifecycleStatus {
    if (status === 'accepted' && ack?.rejectionCodes?.length) {
      return 'accepted_with_alerts'
    }
    if (status === 'queued') return 'queued'
    if (status === 'processing') return 'processing'
    if (status === 'accepted') return 'accepted'
    if (status === 'rejected') {
      return rejectionErrors.some((error) => error.canEfile === false)
        ? 'print_and_mail'
        : 'rejected'
    }
    if (status === 'failed') return 'failed'
    return 'pending'
  }

  private buildRejectionRepairErrors(
    rejectionCodes: string[],
    payload: SubmissionPayload | null
  ): RejectionRepairError[] {
    const codeMap: Record<string, RejectionRepairError> = {
      'IND-031': {
        code: 'IND-031',
        category: 'identity',
        priority: 1,
        title: 'Taxpayer SSN is missing or invalid',
        description:
          'The primary taxpayer TIN did not pass identity validation. Confirm the SSN on the taxpayer profile and prior-year identity step.',
        fixPath: '/taxpayer-profile',
        fixLabel: 'Fix taxpayer SSN',
        canEfile: true
      },
      'R0000-058': {
        code: 'R0000-058',
        category: 'schema_xml',
        priority: 1,
        title: 'Filing status is invalid',
        description:
          'The filing status in the transmitted return is not valid. Revisit the filing-status decision and taxpayer profile.',
        fixPath: '/household',
        fixLabel: 'Review filing status',
        canEfile: true
      },
      'R0000-902': {
        code: 'R0000-902',
        category: 'technical',
        priority: 2,
        title: 'Submission payload failed processing',
        description:
          'The backend payload could not be processed cleanly. Review the filing summary and resubmit after saving.',
        fixPath: '/review-confirm',
        fixLabel: 'Review filing summary',
        canEfile: true
      },
      'R0000-905': {
        code: 'R0000-905',
        category: 'technical',
        priority: 2,
        title: 'IRS transport rejected the submission',
        description:
          'The submission was rejected before acceptance. Retry after reviewing the return and fixing any flagged issues.',
        fixPath: '/efile-wizard',
        fixLabel: 'Retry submission',
        canEfile: true
      },
      'F1040-PMT-NEG': {
        code: 'F1040-PMT-NEG',
        category: 'math',
        priority: 1,
        title: 'Payments cannot be negative',
        description:
          'The return includes a negative total-payments amount. Review withholding, estimates, and refund/owed entries.',
        fixPath: '/review-confirm',
        fixLabel: 'Review totals',
        canEfile: true
      },
      'F1040-TOTALS-MISSING': {
        code: 'F1040-TOTALS-MISSING',
        category: 'math',
        priority: 1,
        title: 'Form 1040 totals are missing',
        description:
          'Total tax and total payments must be present before filing. Open the review summary and confirm the computed totals.',
        fixPath: '/review-confirm',
        fixLabel: 'Add totals',
        canEfile: true
      },
      'F1040-RFND-MISMATCH': {
        code: 'F1040-RFND-MISMATCH',
        category: 'math',
        priority: 1,
        title: 'Refund does not reconcile',
        description:
          'The refund amount does not match the submitted tax and payment totals. Review withholding, estimated payments, and refund setup.',
        fixPath: '/review-confirm',
        fixLabel: 'Fix refund totals',
        canEfile: true
      },
      'F1040-BAL-DOUBLE': {
        code: 'F1040-BAL-DOUBLE',
        category: 'math',
        priority: 1,
        title: 'Refund and amount owed both entered',
        description:
          'A return cannot show both a positive refund and a positive amount owed. Review the final totals and payment method.',
        fixPath: '/review-confirm',
        fixLabel: 'Resolve balance',
        canEfile: true
      },
      'ATS-TAX-MISMATCH': {
        code: 'ATS-TAX-MISMATCH',
        category: 'math',
        priority: 2,
        title: 'Backend tax totals do not match scenario expectations',
        description:
          'The transmitted totals differ from expected ATS values. Review return math and scenario assumptions before retrying.',
        fixPath: '/review-confirm',
        fixLabel: 'Review return math',
        canEfile: true
      }
    }

    return rejectionCodes.map((code) => {
      const known = codeMap[code]
      if (known) {
        return known
      }

      return {
        code,
        category: 'technical',
        priority: 3,
        title: code,
        description:
          typeof payload?.metadata?.signerName === 'string'
            ? `Submission for ${payload.metadata.signerName} was rejected. Review the return and resubmit.`
            : 'Submission was rejected. Review the return and resubmit.',
        fixPath: '/review-confirm',
        fixLabel: 'Review return',
        canEfile: true
      }
    })
  }
}
