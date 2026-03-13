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
    dependents,
    incomeSummary,
    investmentSummary,
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
      creditSummary,
      dependentCount: dependents.length,
      spouse,
      unemploymentCount: asArray(facts.unemploymentRecords).length,
      socialSecurityCount: asArray(facts.socialSecurityRecords).length
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
      rental: itemFromScreen('rental', '/rental', 'Rental property reviewed', { optional: true }),
      business: itemFromScreen('business', '/business-k1', 'Business income reviewed', { optional: true }),
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
      'foreign-income': itemFromScreen('foreign-income', '/foreign-income', 'Foreign income reviewed', { optional: true }),
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
