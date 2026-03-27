import { z } from 'zod'
import { PDFDocument } from 'pdf-lib'

import type { ArtifactStore } from '../adapters/artifactStore'
import type { TaxRepository } from '../adapters/repository'
import type { Env } from '../domain/env'
import type { AppUserClaims } from '../utils/appAuth'
import type { ReturnFormType, SubmissionPayload } from '../domain/types'
import { ApiService } from './apiService'
import { create1040PDF as create1040PDF2024 } from 'ustaxes/forms/Y2024/irsForms'
import { create1040PDF as create1040PDF2025 } from 'ustaxes/forms/Y2025/irsForms'
import { isLeft } from 'ustaxes/core/util'
import type { ItemizedDeductions } from 'ustaxes/core/data'
import {
  applyFieldEditsToExtractedDocument,
  extractDocumentFromBytes,
  type ExtractedDocument
} from './documentExtractionService'
import {
  type BusinessEntityResult,
  TaxCalculationService,
  type TaxCalculationResult,
  buildInformationAndAssetsFromFacts,
  getBusinessFormCapability,
  isBusinessFormType
} from './taxCalculationService'
import { resolveStateProfile } from '../data/stateProfiles'
import {
  listStateCapabilities,
  resolveStateCapability,
  type StateCapabilityRecord
} from '../data/stateCapabilities'
import { HttpError } from '../utils/http'
import { hashPayload } from '../utils/hash'
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
  formType: ReturnFormType
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

interface CachedTaxComputation {
  taxSummary?: Record<string, unknown>
  taxCalcErrors?: string[]
  businessFormCapability?: Record<string, unknown>
}

type BusinessReturnCapabilityView = ReturnType<
  typeof getBusinessReturnCapabilityView
>

type FilledPdfGenerator = typeof create1040PDF2024

const TAXFLOW_FRONTEND_URL = 'https://freetaxflow.com'
const PINNED_IRS_FORM_TAGS_BY_YEAR: Record<number, readonly string[]> = {
  2024: [
    'f1040',
    'f1040s1',
    'f1040s2',
    'f1040s3',
    'f1040s8',
    'f1040sa',
    'f1040sb',
    'f1040sd',
    'f1040se',
    'f1040sei',
    'f1040sse',
    'f1040v',
    'f2441',
    'f6251',
    'f8863',
    'f8889',
    'f8949',
    'f8959',
    'f8960',
    'f8962',
    'f8995',
    'f8995a'
  ],
  2025: [
    'f1040',
    'f1040s1',
    'f1040s2',
    'f1040s3',
    'f1040s8',
    'f1040sa',
    'f1040sb',
    'f1040sd',
    'f1040se',
    'f1040sei',
    'f1040sse',
    'f1040v',
    'f2441',
    'f6251',
    'f8283',
    'f8863',
    'f8889',
    'f8949',
    'f8959',
    'f8960',
    'f8962',
    'f8995',
    'f8995a'
  ]
}

const resolveFilledPdfGenerator = (
  taxYear: number,
  formType: ReturnFormType
): FilledPdfGenerator | null => {
  if (formType !== '1040') {
    return null
  }

  if (taxYear === 2024) {
    return create1040PDF2024
  }
  if (taxYear === 2025) {
    return create1040PDF2025
  }
  return null
}

const supportsPinnedIrsTemplates = (
  taxYear: number,
  formType: ReturnFormType
): boolean =>
  formType === '1040' &&
  Array.isArray(PINNED_IRS_FORM_TAGS_BY_YEAR[taxYear]) &&
  PINNED_IRS_FORM_TAGS_BY_YEAR[taxYear].length > 0

const filingSessionCreateSchema = z.object({
  localSessionId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  taxYear: z.number().int().min(2024).max(2050).default(2025),
  filingStatus: z.string().min(2).default('single'),
  formType: z
    .enum([
      '1040',
      '1040-NR',
      '1040-SS',
      '4868',
      '1120',
      '1120-S',
      '1065',
      '1041',
      '990'
    ])
    .default('1040'),
  currentPhase: z
    .enum([
      'my_info',
      'income',
      'deductions',
      'credits',
      'state',
      'review',
      'file'
    ])
    .default('my_info'),
  lastScreen: z.string().optional(),
  completionPct: z.number().min(0).max(100).default(0),
  estimatedRefund: z.number().nullable().optional(),
  completedScreens: z.array(z.string()).default([]),
  screenData: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .default({}),
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
    .enum([
      'processing',
      'extracted',
      'ambiguous',
      'needs_review',
      'ocr_failed',
      'confirmed'
    ])
    .default('processing'),
  cluster: z
    .enum([
      'w2',
      '1099',
      'investment',
      'business',
      'housing',
      'health',
      'education',
      'care',
      'charity',
      'prior_return',
      'irs_notice',
      'foreign',
      'unknown'
    ])
    .default('unknown'),
  clusterConfidence: z.number().min(0).max(1).default(0),
  pages: z.number().int().min(1).default(1),
  contentBase64: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({})
})

const documentBatchCreateSchema = z.object({
  documents: z.array(documentCreateSchema).min(1).max(25)
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

const stateCapabilitiesQuerySchema = z.object({
  taxYear: z.coerce.number().int().min(2024).max(2050).optional(),
  stateCode: z.string().length(2).optional()
})

const previewCalculationSchema = z.object({
  id: z.string().min(1),
  family: z.string().min(1),
  label: z.string().optional(),
  summary: z.string().optional(),
  metrics: z
    .record(
      z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()])
    )
    .default({}),
  editPath: z.string().optional(),
  sourceScreen: z.string().optional(),
  updatedAt: z.string().optional()
})

const previewDiffSchema = z.object({
  calculations: z.array(previewCalculationSchema).max(50).default([])
})

interface ReviewIssue {
  id: string
  code: string
  form: string
  lineFamily: string
  authority: 'backend' | 'ustaxes'
  severity: 'warning' | 'error'
  blocking: boolean
  message: string
  editPath: string | null
  editLabel: string | null
}

interface PreviewCalculationInput {
  id: string
  family: string
  label?: string
  summary?: string
  metrics: Record<string, string | number | boolean | null | undefined>
  editPath?: string
  sourceScreen?: string
  updatedAt?: string
}

interface PreviewDiffEntry {
  id: string
  family: string
  key: string
  localValue: string | number | boolean | null
  authoritativeValue: string | number | boolean | null
  severity: 'warning' | 'error'
  blocking: boolean
  message: string
  editPath: string | null
}

interface BusinessExpertPackage {
  entityType: string
  supportLevel: string
  readiness: string
  reasonCodes: string[]
  requiredForms: string[]
  renderedArtifacts: Array<Record<string, unknown>>
  filledPdfAvailability: {
    available: boolean
    reason: string
  }
  handoffStatus: string
  missingFacts: string[]
  sourceDocuments: Array<{
    id: string
    name: string
    cluster: string
    status: string
    artifactPath: string | null
  }>
  reviewIssues: ReviewIssue[]
}

const PRINT_MAIL_ADDRESS_GROUPS: Array<{
  states: string[]
  withPayment: string[]
  withoutPayment: string[]
}> = [
  {
    states: ['CA', 'OR', 'WA', 'AK', 'HI'],
    withPayment: [
      'Internal Revenue Service',
      'P.O. Box 802501',
      'Cincinnati, OH 45280-2501'
    ],
    withoutPayment: [
      'Department of the Treasury',
      'Internal Revenue Service',
      'Fresno, CA 93888-0002'
    ]
  },
  {
    states: ['TX', 'OK', 'AR', 'LA', 'MS'],
    withPayment: [
      'Internal Revenue Service',
      'P.O. Box 1214',
      'Charlotte, NC 28201-1214'
    ],
    withoutPayment: [
      'Department of the Treasury',
      'Internal Revenue Service',
      'Austin, TX 73301-0002'
    ]
  },
  {
    states: ['NY', 'NJ', 'CT', 'MA', 'NH', 'VT', 'ME', 'RI'],
    withPayment: [
      'Internal Revenue Service',
      'P.O. Box 37008',
      'Hartford, CT 06176-7008'
    ],
    withoutPayment: [
      'Department of the Treasury',
      'Internal Revenue Service',
      'Kansas City, MO 64999-0002'
    ]
  }
]

const DEFAULT_PRINT_MAIL_ADDRESS = {
  withPayment: [
    'Internal Revenue Service',
    'P.O. Box 931000',
    'Louisville, KY 40293-1000'
  ],
  withoutPayment: [
    'Department of the Treasury',
    'Internal Revenue Service',
    'Kansas City, MO 64999-0002'
  ]
}

const resolvePrintMailAddress = (stateCode: string, withPayment: boolean) => {
  const normalized = stateCode.toUpperCase()
  const matched =
    PRINT_MAIL_ADDRESS_GROUPS.find((group) =>
      group.states.includes(normalized)
    ) ?? null
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
    verificationUrl:
      'https://www.irs.gov/filing/where-to-file-paper-tax-returns-with-or-without-a-payment'
  }
}

const toSnapshot = (
  row: FilingSessionRow,
  snapshot: FilingSessionSnapshot
) => ({
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
  businessFormCapability: isBusinessFormType(row.form_type)
    ? getBusinessReturnCapabilityView(snapshot)
    : undefined,
  snapshot
})

const BUSINESS_RETURN_SCALAR_KEYS = [
  'entityName',
  'ein',
  'entityType',
  'streetAddress',
  'city',
  'zip',
  'naicsCode',
  'productOrService',
  'accountingMethod',
  'taxYear',
  'isFiscalYear',
  'totalAssets',
  'grossReceipts',
  'costOfGoodsSold',
  'builtInGainsTax',
  'excessPassiveIncomeTax',
  'estimatedTaxPayments',
  'withholding',
  'dateCreated',
  'isFinalReturn',
  'websiteAddress',
  'principalOfficerName',
  'primaryExemptPurpose',
  'grossReceiptsNormally50kOrLess',
  'hasTerminated',
  'requiredDistributions',
  'otherDistributions',
  'section645Election',
  'section663bElection',
  'organizationType',
  'missionStatement'
] as const

const BUSINESS_RETURN_RECORD_KEYS = [
  'income',
  'deductions',
  'specialDeductions',
  'employerOwnedLifeInsurance',
  'corporateDeferredCompensation',
  'executiveCompensation',
  'rabbiTrust',
  'form8925',
  'scheduleK',
  'liabilitiesAtYearEnd',
  'fiduciary',
  'organization',
  'revenue',
  'expenses',
  'balanceSheet',
  'governance',
  'schedule990A',
  'schedule990B',
  'schedule990C',
  'schedule990D',
  'schedule990F',
  'schedule990G',
  'schedule990I',
  'schedule990J',
  'schedule990K',
  'schedule990L',
  'schedule990M',
  'schedule990N',
  'schedule990O',
  'schedule990R',
  'mailingAddress',
  'principalOfficerAddress'
] as const

const BUSINESS_RETURN_ARRAY_KEYS = [
  'shareholders',
  'partners',
  'beneficiaries',
  'programAccomplishments',
  'officers'
] as const

const hasAnyBusinessReturnKeys = (data: Record<string, unknown>) =>
  BUSINESS_RETURN_SCALAR_KEYS.some((key) => data[key] != null) ||
  BUSINESS_RETURN_RECORD_KEYS.some(
    (key) => Object.keys(asRecord(data[key])).length > 0
  ) ||
  BUSINESS_RETURN_ARRAY_KEYS.some((key) => asArray(data[key]).length > 0)

const mergeNumericFactRecord = (
  base: Record<string, unknown>,
  patch: Record<string, unknown>
) => ({
  ...base,
  ...Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value != null && value !== '')
  )
})

const sumMoneyFields = (
  record: Record<string, unknown>,
  keys: readonly string[]
): number =>
  keys.reduce((sum, key) => sum + toMoney(record[key]), 0)

const formatCurrency = (value: number): string => `$${value.toLocaleString()}`

const toDateText = (value: unknown): string => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleDateString()
  }
  if (typeof value === 'string' && value) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString()
    }
  }
  return ''
}

const formatDateRange = (start: unknown, end: unknown): string => {
  const startText = toDateText(start)
  const endText = toDateText(end)
  if (startText && endText) {
    return `${startText} - ${endText}`
  }
  return startText || endText
}

const formatAddressRecord = (record: Record<string, unknown>): string => {
  const street = toText(
    record.street ?? record.address ?? record.line1 ?? record.mailingStreet
  )
  const city = toText(record.city)
  const state = toText(record.state)
  const zip = toText(record.zip)
  const country = toText(record.country)
  const locality = [city, state, zip].filter(Boolean).join(', ').replace(', ,', ',')
  return [street, locality, country].filter(Boolean).join(', ')
}

const compactRenderedRows = <T extends { value: unknown }>(rows: T[]): T[] =>
  rows.filter((row) => {
    if (typeof row.value === 'string') {
      return row.value.trim().length > 0
    }
    return row.value !== undefined && row.value !== null
  })

const countTruthyEntries = (record: Record<string, unknown>): number =>
  Object.values(record).filter((value) => {
    if (Array.isArray(value)) {
      return value.length > 0
    }

    if (typeof value === 'object' && value !== null) {
      return Object.keys(value as Record<string, unknown>).length > 0
    }

    if (typeof value === 'boolean') {
      return value
    }

    return value !== undefined && value !== null && String(value).trim() !== ''
  }).length

const buildNonprofitSupplementalSections = (
  facts: Record<string, unknown>
): Array<{ title: string; rows: Array<{ label: string; value: string }> }> => {
  const schedule990B = asRecord(facts.schedule990B)
  const schedule990C = asRecord(facts.schedule990C)
  const schedule990D = asRecord(facts.schedule990D)
  const schedule990F = asRecord(facts.schedule990F)
  const schedule990G = asRecord(facts.schedule990G)
  const schedule990I = asRecord(facts.schedule990I)
  const schedule990J = asRecord(facts.schedule990J)
  const schedule990K = asRecord(facts.schedule990K)
  const schedule990L = asRecord(facts.schedule990L)
  const schedule990M = asRecord(facts.schedule990M)
  const schedule990N = asRecord(facts.schedule990N)
  const schedule990O = asRecord(facts.schedule990O)
  const schedule990R = asRecord(facts.schedule990R)

  const sections: Array<{
    title: string
    rows: Array<{ label: string; value: string }>
  }> = []

  const contributors = asArray<Record<string, unknown>>(schedule990B.contributors)
  if (contributors.length > 0) {
    sections.push({
      title: 'Schedule B contributor package',
      rows: compactRenderedRows([
        { label: 'Major contributors', value: String(contributors.length) },
        { label: 'Largest contributor', value: toText(contributors[0]?.name) },
        {
          label: 'Largest contribution',
          value:
            toMoney(contributors[0]?.totalContributions) > 0
              ? formatCurrency(toMoney(contributors[0]?.totalContributions))
              : ''
        }
      ])
    })
  }

  if (Object.keys(schedule990C).length > 0) {
    sections.push({
      title: 'Schedule C lobbying package',
      rows: compactRenderedRows([
        {
          label: 'Political campaign expenses',
          value:
            toMoney(schedule990C.directPoliticalCampaignExpenses) > 0
              ? formatCurrency(toMoney(schedule990C.directPoliticalCampaignExpenses))
              : ''
        },
        {
          label: '501(h) election',
          value: schedule990C.made501hElection ? 'Yes' : ''
        },
        {
          label: 'Lobbying expense total',
          value:
            toMoney(schedule990C.totalLobbyingExpenses) > 0
              ? formatCurrency(toMoney(schedule990C.totalLobbyingExpenses))
              : ''
        }
      ])
    })
  }

  if (Object.keys(schedule990D).length > 0) {
    sections.push({
      title: 'Schedule D financial schedules package',
      rows: compactRenderedRows([
        {
          label: 'Donor advised funds',
          value: String(
            asArray<Record<string, unknown>>(schedule990D.donorAdvisedFunds).length
          )
        },
        {
          label: 'Endowment ending balance',
          value:
            toMoney(asRecord(schedule990D.endowmentFunds).endingBalance) > 0
              ? formatCurrency(
                  toMoney(asRecord(schedule990D.endowmentFunds).endingBalance)
                )
              : ''
        }
      ])
    })
  }

  if (Object.keys(schedule990F).length > 0) {
    sections.push({
      title: 'Schedule F foreign activities package',
      rows: compactRenderedRows([
        {
          label: 'Countries of activity',
          value:
            toMoney(schedule990F.numberOfCountries) > 0
              ? String(toMoney(schedule990F.numberOfCountries))
              : ''
        },
        {
          label: 'Foreign offices',
          value: String(
            asArray<Record<string, unknown>>(schedule990F.foreignOffices).length
          )
        }
      ])
    })
  }

  if (Object.keys(schedule990G).length > 0) {
    sections.push({
      title: 'Schedule G fundraising package',
      rows: compactRenderedRows([
        {
          label: 'Professional fundraisers',
          value: String(
            asArray<Record<string, unknown>>(schedule990G.professionalFundraisers)
              .length
          )
        },
        {
          label: 'Fundraising events',
          value: String(
            asArray<Record<string, unknown>>(schedule990G.fundraisingEvents).length
          )
        },
        {
          label: 'Gaming activities',
          value: String(
            asArray<Record<string, unknown>>(schedule990G.gamingActivities).length
          )
        }
      ])
    })
  }

  if (Object.keys(schedule990I).length > 0) {
    sections.push({
      title: 'Schedule I grants package',
      rows: compactRenderedRows([
        {
          label: 'Organization grants',
          value: String(
            asArray<Record<string, unknown>>(schedule990I.organizationGrants).length
          )
        },
        {
          label: 'Individual grants',
          value: String(
            asArray<Record<string, unknown>>(schedule990I.individualGrants).length
          )
        }
      ])
    })
  }

  if (Object.keys(schedule990J).length > 0) {
    sections.push({
      title: 'Schedule J compensation package',
      rows: compactRenderedRows([
        {
          label: 'Compensation committee',
          value: schedule990J.usedCompensationCommittee ? 'Yes' : ''
        },
        {
          label: 'Compensated persons',
          value: String(
            asArray<Record<string, unknown>>(schedule990J.compensatedPersons).length
          )
        }
      ])
    })
  }

  if (Object.keys(schedule990K).length > 0) {
    sections.push({
      title: 'Schedule K bond package',
      rows: compactRenderedRows([
        {
          label: 'Tax-exempt bond issues',
          value: String(
            asArray<Record<string, unknown>>(schedule990K.bondIssues).length
          )
        },
        {
          label: 'Private business use percent',
          value:
            toMoney(schedule990K.privateBusinessUsePercent) > 0
              ? `${toMoney(schedule990K.privateBusinessUsePercent)}%`
              : ''
        }
      ])
    })
  }

  if (Object.keys(schedule990L).length > 0) {
    sections.push({
      title: 'Schedule L interested-person package',
      rows: compactRenderedRows([
        {
          label: 'Excess benefit transactions',
          value: String(
            asArray<Record<string, unknown>>(schedule990L.excessBenefitTransactions)
              .length
          )
        },
        {
          label: 'Loans to interested persons',
          value: String(asArray<Record<string, unknown>>(schedule990L.loans).length)
        },
        {
          label: 'Business transactions',
          value: String(
            asArray<Record<string, unknown>>(schedule990L.businessTransactions)
              .length
          )
        }
      ])
    })
  }

  if (Object.keys(schedule990M).length > 0) {
    sections.push({
      title: 'Schedule M noncash-contributions package',
      rows: compactRenderedRows([
        {
          label: 'Noncash contribution categories',
          value:
            countTruthyEntries(asRecord(schedule990M.contributions)) > 0
              ? String(countTruthyEntries(asRecord(schedule990M.contributions)))
              : ''
        }
      ])
    })
  }

  if (Object.keys(schedule990N).length > 0) {
    sections.push({
      title: 'Schedule N termination package',
      rows: compactRenderedRows([
        {
          label: 'Asset dispositions',
          value: String(
            asArray<Record<string, unknown>>(schedule990N.assetDispositions).length
          )
        },
        {
          label: 'Disposition percent',
          value:
            toMoney(schedule990N.dispositionPercent) > 0
              ? `${toMoney(schedule990N.dispositionPercent)}%`
              : ''
        }
      ])
    })
  }

  if (Object.keys(schedule990O).length > 0) {
    sections.push({
      title: 'Schedule O supplemental package',
      rows: compactRenderedRows([
        {
          label: 'Supplemental explanations',
          value: String(
            asArray<Record<string, unknown>>(schedule990O.explanations).length
          )
        },
        {
          label: 'Mission statement supplement',
          value: toText(schedule990O.missionStatement)
        }
      ])
    })
  }

  if (Object.keys(schedule990R).length > 0) {
    sections.push({
      title: 'Schedule R related-organizations package',
      rows: compactRenderedRows([
        {
          label: 'Related exempt organizations',
          value: String(
            asArray<Record<string, unknown>>(schedule990R.relatedExemptOrgs).length
          )
        },
        {
          label: 'Related partnerships',
          value: String(
            asArray<Record<string, unknown>>(schedule990R.relatedPartnerships).length
          )
        },
        {
          label: 'Related corporations and trusts',
          value: String(
            asArray<Record<string, unknown>>(schedule990R.relatedCorpsAndTrusts)
              .length
          )
        },
        {
          label: 'Related-organization transactions',
          value: String(
            asArray<Record<string, unknown>>(schedule990R.transactions).length
          )
        }
      ])
    })
  }

  return sections.filter((section) => section.rows.length > 0)
}

const buildNonprofitRenderedPreview = (
  facts: Record<string, unknown>,
  nonprofitReturnHint: '990N' | '990EZ' | null
) => {
  const organization = asRecord(facts.organization)
  const revenue = asRecord(facts.revenue)
  const expenses = asRecord(facts.expenses)
  const balanceSheet = asRecord(facts.balanceSheet)
  const governance = asRecord(facts.governance)
  const officers = asArray<Record<string, unknown>>(facts.officers)
  const programAccomplishments = asArray<Record<string, unknown>>(
    facts.programAccomplishments
  )
  const supplementalScheduleSections = buildNonprofitSupplementalSections(facts)
  const organizationName = toText(
    organization.name ?? facts.entityName ?? facts.organizationName
  )

  if (!organizationName) {
    return undefined
  }

  const suggestedForm: '990' | '990EZ' | '990N' =
    nonprofitReturnHint === '990N'
      ? '990N'
      : nonprofitReturnHint === '990EZ'
      ? '990EZ'
      : '990'

  if (suggestedForm === '990N') {
    const mailingAddress = formatAddressRecord(asRecord(facts.mailingAddress))
    const principalOfficerAddress = formatAddressRecord(
      asRecord(facts.principalOfficerAddress)
    )
    const taxYear = formatDateRange(facts.taxYearBeginning, facts.taxYearEnding)
    const doingBusinessAs = toText(
      facts.doingBusinessAs ?? organization.doingBusinessAs
    )
    const grossReceipts = toMoney(facts.grossReceipts)
    return {
      suggestedForm,
      organizationName,
      doingBusinessAs,
      principalOfficerName: toText(facts.principalOfficerName),
      websiteAddress: toText(
        facts.websiteAddress ?? organization.website ?? facts.website
      ),
      mailingAddress,
      principalOfficerAddress,
      taxYear,
      grossReceipts,
      grossReceiptsNormally50kOrLess:
        Boolean(facts.grossReceiptsNormally50kOrLess) ||
        grossReceipts <= 50_000,
      hasTerminated: Boolean(facts.hasTerminated),
      renderedSections: [
        {
          title: 'Nonprofit filing identity',
          rows: compactRenderedRows([
            { label: 'Rendered organization', value: organizationName },
            { label: 'Rendered EIN', value: toText(facts.ein ?? organization.ein) },
            { label: 'Doing business as', value: doingBusinessAs },
            {
              label: 'Website',
              value: toText(
                facts.websiteAddress ?? organization.website ?? facts.website
              )
            },
            { label: 'Mailing address', value: mailingAddress },
            { label: 'Principal officer', value: toText(facts.principalOfficerName) },
            { label: 'Principal officer address', value: principalOfficerAddress },
            { label: 'Tax year', value: taxYear }
          ])
        },
        {
          title: 'Nonprofit filing eligibility',
          rows: compactRenderedRows([
            {
              label: 'Rendered gross receipts',
              value: grossReceipts > 0 ? formatCurrency(grossReceipts) : ''
            },
            {
              label: 'Rendered filing variant',
              value: '990-N'
            },
            {
              label: 'Gross receipts eligibility',
              value:
                Boolean(facts.grossReceiptsNormally50kOrLess) ||
                grossReceipts <= 50_000
                  ? 'Normally $50,000 or less'
                  : 'Above e-postcard threshold'
            },
            {
              label: 'Termination status',
              value: Boolean(facts.hasTerminated) ? 'Terminated' : 'Active'
            }
          ])
        }
      ]
    }
  }

  if (suggestedForm === '990EZ') {
    const renderedRevenueTotal =
      sumMoneyFields(revenue, [
        'contributions',
        'programServiceRevenue',
        'membershipDues',
        'investmentIncome',
        'saleOfAssets',
        'specialEventsGross',
        'otherRevenue'
      ]) - toMoney(revenue.specialEventsExpenses)
    const totalRevenue = renderedRevenueTotal || toMoney(facts.grossReceipts)
    const totalExpenses = sumMoneyFields(expenses, [
      'grantsAndSimilar',
      'benefitsPaid',
      'salariesAndCompensation',
      'professionalFees',
      'occupancy',
      'printing',
      'otherExpenses'
    ])
    const renderedNetAssetsEndOfYear = Math.max(
      0,
      sumMoneyFields(balanceSheet, [
        'endingCash',
        'endingLandBuildings',
        'endingOtherAssets'
      ]) - toMoney(balanceSheet.endingLiabilities)
    )
    const netAssetsEndOfYear =
      renderedNetAssetsEndOfYear || toMoney(facts.totalAssets)
    const websiteAddress = toText(
      facts.websiteAddress ?? organization.website ?? facts.website
    )
    const filingPeriod = formatDateRange(
      facts.fiscalYearStart,
      facts.fiscalYearEnd
    )
    const firstProgram = toText(programAccomplishments[0]?.description)
    const firstProgramExpenses = toMoney(programAccomplishments[0]?.expenses)
    const firstProgramGrants = toMoney(programAccomplishments[0]?.grants)
    const leadOfficer = toText(officers[0]?.name)
    const leadOfficerTitle = toText(officers[0]?.title)
    const leadOfficerHours = toMoney(officers[0]?.hoursPerWeek)
    const leadOfficerCompensation = toMoney(officers[0]?.compensation)
    const totalAssetsEndOfYear = sumMoneyFields(balanceSheet, [
      'endingCash',
      'endingLandBuildings',
      'endingOtherAssets'
    ])
    const changeInNetAssets = totalRevenue - totalExpenses

    return {
      suggestedForm,
      organizationName,
      totalRevenue,
      totalExpenses,
      netAssetsEndOfYear,
      totalAssetsEndOfYear,
      changeInNetAssets,
      primaryExemptPurpose: toText(
        facts.primaryExemptPurpose ?? facts.missionStatement
      ),
      officerCount: officers.length,
      programCount: programAccomplishments.length,
      websiteAddress,
      filingPeriod,
      renderedSections: [
        {
          title: 'Nonprofit filing identity',
          rows: compactRenderedRows([
            { label: 'Rendered organization', value: organizationName },
            { label: 'Rendered EIN', value: toText(facts.ein ?? organization.ein) },
            {
              label: 'Exemption type',
              value: toText(facts.exemptionType ?? organization.exemptionType)
            },
            { label: 'Website', value: websiteAddress },
            { label: 'Filing period', value: filingPeriod }
          ])
        },
        {
          title: 'Nonprofit financial package',
          rows: compactRenderedRows([
            {
              label: 'Rendered total revenue',
              value: totalRevenue > 0 ? formatCurrency(totalRevenue) : ''
            },
            {
              label: 'Rendered total expenses',
              value: totalExpenses > 0 ? formatCurrency(totalExpenses) : ''
            },
            {
              label: 'Rendered net assets',
              value:
                netAssetsEndOfYear > 0
                  ? formatCurrency(netAssetsEndOfYear)
                  : ''
            },
            {
              label: 'Rendered total assets',
              value:
                totalAssetsEndOfYear > 0
                  ? formatCurrency(totalAssetsEndOfYear)
                  : ''
            },
            {
              label: 'Rendered ending liabilities',
              value:
                toMoney(balanceSheet.endingLiabilities) > 0
                  ? formatCurrency(toMoney(balanceSheet.endingLiabilities))
                  : ''
            },
            {
              label: 'Rendered change in net assets',
              value: changeInNetAssets !== 0 ? formatCurrency(changeInNetAssets) : ''
            },
            {
              label: 'Special events net',
              value:
                toMoney(revenue.specialEventsGross) ||
                toMoney(revenue.specialEventsExpenses)
                  ? formatCurrency(
                      toMoney(revenue.specialEventsGross) -
                        toMoney(revenue.specialEventsExpenses)
                    )
                  : ''
            }
          ])
        },
        {
          title: 'Nonprofit program package',
          rows: compactRenderedRows([
            {
              label: 'Primary exempt purpose',
              value: toText(facts.primaryExemptPurpose ?? facts.missionStatement)
            },
            { label: 'Program accomplishments', value: String(programAccomplishments.length) },
            { label: 'Lead accomplishment', value: firstProgram },
            {
              label: 'Lead accomplishment expenses',
              value:
                firstProgramExpenses > 0 ? formatCurrency(firstProgramExpenses) : ''
            },
            {
              label: 'Lead accomplishment grants',
              value:
                firstProgramGrants > 0 ? formatCurrency(firstProgramGrants) : ''
            },
            {
              label: 'Rendered filing variant',
              value: '990-EZ'
            }
          ])
        },
        {
          title: 'Nonprofit people package',
          rows: compactRenderedRows([
            { label: 'Officer count', value: String(officers.length) },
            { label: 'Lead officer', value: leadOfficer },
            { label: 'Lead officer title', value: leadOfficerTitle },
            {
              label: 'Lead officer hours',
              value: leadOfficerHours > 0 ? String(leadOfficerHours) : ''
            },
            {
              label: 'Lead officer compensation',
              value:
                leadOfficerCompensation > 0
                  ? formatCurrency(leadOfficerCompensation)
                  : ''
            }
          ])
        },
        ...supplementalScheduleSections
      ]
    }
  }

  const totalRevenue =
    toMoney(facts.grossReceipts) ||
    sumMoneyFields(revenue, [
      'contributions',
      'programServiceRevenue',
      'membershipDues',
      'investmentIncome',
      'netRentalIncome',
      'netGainFromSales',
      'fundraisingEvents',
      'otherRevenue'
    ])
  const totalExpenses = sumMoneyFields(expenses, [
    'grants',
    'benefitsPaid',
    'salariesAndWages',
    'employeeBenefits',
    'payrollTaxes',
    'managementFees',
    'legalFees',
    'accountingFees',
    'professionalFundraising',
    'advertising',
    'officeExpenses',
    'occupancy',
    'travel',
    'depreciation',
    'insurance',
    'otherExpenses'
  ])
  const renderedNetAssetsEndOfYear = sumMoneyFields(balanceSheet, [
    'unrestrictedNetAssets',
    'temporarilyRestricted',
    'permanentlyRestricted'
  ])
  const netAssetsEndOfYear =
    renderedNetAssetsEndOfYear || toMoney(facts.totalAssets)
  const websiteAddress = toText(
    facts.websiteAddress ?? organization.website ?? facts.website
  )
  const filingPeriod = formatDateRange(
    facts.fiscalYearStart,
    facts.fiscalYearEnd
  )
  const firstProgram = toText(programAccomplishments[0]?.description)
  const leadProgramCount = programAccomplishments.length
  const leadOfficer = toText(officers[0]?.name)
  const leadOfficerTitle = toText(officers[0]?.title)
  const totalEmployees = toMoney(governance.totalEmployees)
  const totalVolunteers = toMoney(governance.totalVolunteers)
  const changeInNetAssets = totalRevenue - totalExpenses
  const totalLiabilitiesEndOfYear = sumMoneyFields(balanceSheet, [
    'accountsPayable',
    'grantsPayable',
    'deferredRevenue',
    'taxExemptBonds',
    'mortgages',
    'otherLiabilities'
  ])

  return {
    suggestedForm,
    organizationName,
    totalRevenue,
    totalExpenses,
    netAssetsEndOfYear,
    changeInNetAssets,
    totalLiabilitiesEndOfYear,
    missionStatement: toText(facts.missionStatement),
    programCount: programAccomplishments.length,
    officerCount: officers.length,
    votingMemberCount: toMoney(governance.numberOfVotingMembers),
    independentMemberCount: toMoney(governance.numberOfIndependentMembers),
    websiteAddress,
    filingPeriod,
    renderedSections: [
      {
        title: 'Nonprofit filing identity',
        rows: compactRenderedRows([
          { label: 'Rendered organization', value: organizationName },
          { label: 'Rendered EIN', value: toText(facts.ein ?? organization.ein) },
          {
            label: 'Exemption type',
            value: toText(
              organization.exemptionType ?? facts.exemptionType ?? '501c3'
            )
          },
          { label: 'Website', value: websiteAddress },
          { label: 'Filing period', value: filingPeriod }
        ])
      },
      {
        title: 'Nonprofit financial package',
        rows: compactRenderedRows([
          {
            label: 'Rendered total revenue',
            value: totalRevenue > 0 ? formatCurrency(totalRevenue) : ''
          },
          {
            label: 'Rendered total expenses',
            value: totalExpenses > 0 ? formatCurrency(totalExpenses) : ''
          },
          {
            label: 'Rendered contributions',
            value:
              toMoney(revenue.contributions) > 0
                ? formatCurrency(toMoney(revenue.contributions))
                : ''
          },
          {
            label: 'Rendered program service revenue',
            value:
              toMoney(revenue.programServiceRevenue) > 0
                ? formatCurrency(toMoney(revenue.programServiceRevenue))
                : ''
          },
          {
            label: 'Rendered grants expense',
            value:
              toMoney(expenses.grants) > 0
                ? formatCurrency(toMoney(expenses.grants))
                : ''
          },
          {
            label: 'Rendered salaries and payroll',
            value:
              sumMoneyFields(expenses, [
                'salariesAndWages',
                'employeeBenefits',
                'payrollTaxes'
              ]) > 0
                ? formatCurrency(
                    sumMoneyFields(expenses, [
                      'salariesAndWages',
                      'employeeBenefits',
                      'payrollTaxes'
                    ])
                  )
                : ''
          },
          {
            label: 'Rendered net assets',
            value:
              netAssetsEndOfYear > 0
                ? formatCurrency(netAssetsEndOfYear)
                : ''
          },
          {
            label: 'Rendered total liabilities',
            value:
              totalLiabilitiesEndOfYear > 0
                ? formatCurrency(totalLiabilitiesEndOfYear)
                : ''
          },
          {
            label: 'Rendered change in net assets',
            value: changeInNetAssets !== 0 ? formatCurrency(changeInNetAssets) : ''
          }
        ])
      },
      {
        title: 'Nonprofit governance package',
        rows: compactRenderedRows([
          { label: 'Mission statement', value: toText(facts.missionStatement) },
          {
            label: 'Voting members',
            value: String(toMoney(governance.numberOfVotingMembers))
          },
          {
            label: 'Independent members',
            value: String(toMoney(governance.numberOfIndependentMembers))
          },
          {
            label: 'Employees',
            value: totalEmployees > 0 ? String(totalEmployees) : ''
          },
          {
            label: 'Volunteers',
            value: totalVolunteers > 0 ? String(totalVolunteers) : ''
          },
          {
            label: 'Conflict policy',
            value: governance.hasWrittenConflictPolicy ? 'Yes' : 'No'
          },
          {
            label: 'Whistleblower policy',
            value: governance.hasWhistleblowerPolicy ? 'Yes' : 'No'
          },
          {
            label: 'Document retention policy',
            value: governance.hasDocumentRetentionPolicy ? 'Yes' : 'No'
          },
          {
            label: 'Compensation process',
            value: governance.hasCompensationProcess ? 'Yes' : 'No'
          }
        ])
      },
      {
        title: 'Nonprofit program and people package',
        rows: compactRenderedRows([
          { label: 'Program accomplishments', value: String(leadProgramCount) },
          { label: 'Lead accomplishment', value: firstProgram },
          { label: 'Officer count', value: String(officers.length) },
          { label: 'Lead officer', value: leadOfficer },
          { label: 'Lead officer title', value: leadOfficerTitle },
          {
            label: 'Rendered filing variant',
            value: '990'
          }
        ])
      },
      ...supplementalScheduleSections
    ]
  }
}

const deriveBusinessEntityWorkflowFacts = (
  snapshot: FilingSessionSnapshot,
  data: Record<string, unknown>
): Record<string, unknown> => {
  const workflowEntities = asArray<Record<string, unknown>>(data.entities)
  if (workflowEntities.length === 0) {
    return {}
  }

  const normalizedEntities = workflowEntities.map((entity, index) => ({
    entityName: toText(entity.entityName ?? entity.name),
    ein: toText(entity.ein).replace(/\D/g, ''),
    ownershipPct: Math.max(
      0,
      Math.min(100, toMoney(entity.ownershipPct ?? entity.ownershipPercentage))
    ),
    ordinaryIncome: toMoney(entity.ordinaryIncome),
    guaranteedPayments: toMoney(entity.guaranteedPayments),
    section179: toMoney(entity.section179),
    charitableContrib: toMoney(entity.charitableContrib),
    selfEmployedHealthIns: toMoney(entity.selfEmployedHealthIns),
    ownerName: toText(entity.ownerName) || `Primary owner ${index + 1}`,
    ownerTin: toText(entity.ownerTin ?? entity.ssn ?? entity.tin).replace(
      /\D/g,
      ''
    )
  }))

  const firstEntity =
    normalizedEntities.find((entity) => entity.entityName || entity.ein) ??
    normalizedEntities[0]
  const defaultPct = Math.round((100 / normalizedEntities.length) * 100) / 100
  const totalOrdinaryIncome = normalizedEntities.reduce(
    (sum, entity) => sum + entity.ordinaryIncome,
    0
  )
  const totalGuaranteedPayments = normalizedEntities.reduce(
    (sum, entity) => sum + entity.guaranteedPayments,
    0
  )
  const totalOtherDeductions = normalizedEntities.reduce(
    (sum, entity) =>
      sum +
      entity.section179 +
      entity.charitableContrib +
      entity.selfEmployedHealthIns,
    0
  )
  const grossReceipts = Math.max(
    0,
    totalOrdinaryIncome +
      totalOtherDeductions +
      (snapshot.formType === '1065' ? totalGuaranteedPayments : 0)
  )
  const owners = normalizedEntities.map((entity) => ({
    name: entity.ownerName,
    ssn: entity.ownerTin,
    tin: entity.ownerTin,
    ownershipPercentage:
      entity.ownershipPct > 0 ? entity.ownershipPct : defaultPct,
    ownershipPct: entity.ownershipPct > 0 ? entity.ownershipPct : defaultPct,
    profitSharingPercent:
      entity.ownershipPct > 0 ? entity.ownershipPct : defaultPct,
    lossSharingPercent:
      entity.ownershipPct > 0 ? entity.ownershipPct : defaultPct,
    capitalSharingPercent:
      entity.ownershipPct > 0 ? entity.ownershipPct : defaultPct,
    isGeneralPartner: true,
    isDomestic: true
  }))

  return {
    entityName: firstEntity.entityName,
    ein: firstEntity.ein,
    entityType:
      snapshot.formType === '1120-S'
        ? 'S-Corporation'
        : snapshot.formType === '1065'
        ? 'Partnership'
        : snapshot.formType === '1120'
        ? 'C-Corporation'
        : undefined,
    grossReceipts,
    income: {
      grossReceiptsOrSales: grossReceipts,
      ordinaryIncome: totalOrdinaryIncome,
      otherIncome: 0
    },
    deductions: {
      otherDeductions: totalOtherDeductions,
      ...(snapshot.formType === '1065'
        ? { guaranteedPaymentsToPartners: totalGuaranteedPayments }
        : {})
    },
    ...(snapshot.formType === '1120-S' ? { shareholders: owners } : {}),
    ...(snapshot.formType === '1065' ? { partners: owners } : {})
  }
}

const extractBusinessReturnFacts = (
  snapshot: FilingSessionSnapshot
): Record<string, unknown> => {
  const extracted: Record<string, unknown> = {}
  for (const data of Object.values(snapshot.screenData ?? {})) {
    const derivedWorkflowFacts = deriveBusinessEntityWorkflowFacts(
      snapshot,
      data
    )
    if (
      !hasAnyBusinessReturnKeys(data) &&
      Object.keys(derivedWorkflowFacts).length === 0
    ) {
      continue
    }
    const mergedSource: Record<string, unknown> = {
      ...derivedWorkflowFacts,
      ...data,
      income: mergeNumericFactRecord(
        asRecord(derivedWorkflowFacts.income),
        asRecord(data.income)
      ),
      deductions: mergeNumericFactRecord(
        asRecord(derivedWorkflowFacts.deductions),
        asRecord(data.deductions)
      ),
      specialDeductions: mergeNumericFactRecord(
        asRecord(derivedWorkflowFacts.specialDeductions),
        asRecord(data.specialDeductions)
      )
    }
    for (const key of BUSINESS_RETURN_SCALAR_KEYS) {
      if (mergedSource[key] != null && mergedSource[key] !== '') {
        extracted[key] = mergedSource[key]
      }
    }
    for (const key of BUSINESS_RETURN_RECORD_KEYS) {
      const value = asRecord(mergedSource[key])
      if (Object.keys(value).length > 0) {
        extracted[key] = mergeNumericFactRecord(asRecord(extracted[key]), value)
      }
    }
    for (const key of BUSINESS_RETURN_ARRAY_KEYS) {
      const value = asArray(mergedSource[key])
      if (value.length > 0) {
        extracted[key] = value
      }
    }
  }
  return extracted
}

const hasFactInput = (
  record: Record<string, unknown>,
  keys: readonly string[]
) =>
  keys.some((key) => {
    const value = record[key]
    return value !== undefined && value !== null && value !== ''
  })

const getBusinessReturnCapabilityView = (snapshot: FilingSessionSnapshot) => {
  const capability = getBusinessFormCapability(snapshot.formType)
  const facts = extractBusinessReturnFacts(snapshot)
  const income = asRecord(facts.income)
  const deductions = asRecord(facts.deductions)
  const fiduciary = asRecord(facts.fiduciary)
  const entityName = toText(facts.entityName)
  const ein = toText(facts.ein).replace(/\D/g, '')
  const shareholders = asArray(facts.shareholders)
  const partners = asArray(facts.partners)
  const beneficiaries = asArray(facts.beneficiaries)

  const missingInputs = ['entityName', 'ein'].filter((key) => {
    if (key === 'entityName') return !entityName
    if (key === 'ein') return ein.length !== 9
    return false
  })

  if (
    !hasFactInput(income, [
      'grossReceiptsOrSales',
      'ordinaryIncome',
      'interestIncome',
      'dividendIncome',
      'grossRents',
      'grossRoyalties',
      'businessIncome',
      'rents',
      'royalties',
      'farmIncome',
      'otherIncome'
    ]) &&
    facts.grossReceipts == null
  ) {
    missingInputs.push('income')
  }

  if (Object.keys(deductions).length === 0) {
    missingInputs.push('deductions')
  }

  if (snapshot.formType === '1120-S' && shareholders.length === 0) {
    missingInputs.push('shareholders')
  }
  if (snapshot.formType === '1065' && partners.length === 0) {
    missingInputs.push('partners')
  }
  if (
    snapshot.formType === '1041' &&
    (!toText(fiduciary.name) || beneficiaries.length === 0)
  ) {
    missingInputs.push('fiduciary_or_beneficiaries')
  }

  const hasMinimumData = missingInputs.length === 0
  const readiness =
    capability.supportLevel === 'expert_required'
      ? 'expert_required'
      : hasMinimumData
      ? 'ready'
      : 'needs_input'

  const grossReceipts = toMoney(facts.grossReceipts)
  const totalAssets = toMoney(facts.totalAssets)
  const nonprofitReturnHint =
    snapshot.formType === '990' && grossReceipts > 0
      ? grossReceipts <= 50_000
        ? '990N'
        : grossReceipts < 200_000 && totalAssets > 0 && totalAssets < 500_000
        ? '990EZ'
        : null
      : null
  const smallNonprofitHint = nonprofitReturnHint === '990N'
  const nonprofitRenderedPreview =
    snapshot.formType === '990'
      ? buildNonprofitRenderedPreview(facts, nonprofitReturnHint)
      : undefined

  return {
    ...capability,
    hasMinimumData,
    readiness,
    missingInputs,
    smallNonprofitHint,
    nonprofitReturnHint,
    nonprofitRenderedPreview
  }
}

const defaultSnapshot = (
  input: z.infer<typeof filingSessionCreateSchema>
): FilingSessionSnapshot => ({
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

const makeSessionEntityRowId = (
  sessionId: string,
  entityType: string,
  entityId: string
) => `${sessionId}:${entityType}:${entityId}`

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

const asArray = <T>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : []

const toText = (value: unknown): string =>
  typeof value === 'string'
    ? value
    : value === undefined || value === null
    ? ''
    : String(value)

const toMoney = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

const uniqueStrings = (values: Array<string | null | undefined>): string[] =>
  Array.from(
    new Set(
      values
        .map((value) => toText(value).trim().toLowerCase())
        .filter(Boolean)
    )
  )

const baseFormTypeToPdfTag = (formType: ReturnFormType): string | null => {
  if (formType === '1040') {
    return 'f1040'
  }
  return null
}

const derivedPdfTagsFromFacts = (
  facts: Record<string, unknown>,
  computedSummary: Record<string, unknown>
): string[] => {
  const hasSchedule1Inputs =
    asArray<Record<string, unknown>>(facts.studentLoanRecords).length > 0 ||
    asArray<Record<string, unknown>>(facts.unemploymentRecords).length > 0
  const hasScheduleAInputs =
    Object.keys(asRecord(facts.itemizedDeductions)).length > 0
  const hasScheduleEInputs =
    asArray<Record<string, unknown>>(facts.rentalProperties).length > 0 ||
    asArray<Record<string, unknown>>(facts.k1Records).length > 0 ||
    asArray<Record<string, unknown>>(facts.form1099Records).some((record) => {
      const type = toText(record.type).toUpperCase()
      return (
        (type === 'MISC' || type === '1099-MISC' || type === '1099_MISC') &&
        (toMoney(record.rents) > 0 || toMoney(record.royalties) > 0)
      )
    })
  const hasScheduleDInputs = asArray<Record<string, unknown>>(facts.taxLots).length > 0

  return uniqueStrings([
    ...asArray<string>(computedSummary.schedules),
    hasSchedule1Inputs ? 'f1040s1' : null,
    hasScheduleAInputs ? 'f1040sa' : null,
    Object.keys(asRecord(facts.noncashContributions)).length > 0 ? 'f8283' : null,
    asArray<Record<string, unknown>>(facts.marketplaceInsurance).length > 0 ||
    asArray<Record<string, unknown>>(facts.aca1095a).length > 0
      ? 'f8962'
      : null,
    asArray<Record<string, unknown>>(facts.educationExpenses).length > 0
      ? 'f8863'
      : null,
    asArray<Record<string, unknown>>(facts.dependentCareProviders).length > 0 ||
    toMoney(facts.dependentCareExpenses) > 0
      ? 'f2441'
      : null,
    hasScheduleEInputs ? 'f1040se' : null,
    hasScheduleDInputs ? 'f1040sd' : null,
    hasScheduleDInputs ? 'f8949' : null
  ])
}

const buildRequiredPinnedPdfTags = (
  snapshot: FilingSessionSnapshot,
  computedSummary: Record<string, unknown>,
  facts: Record<string, unknown>
): string[] =>
  uniqueStrings([
    baseFormTypeToPdfTag(snapshot.formType),
    ...derivedPdfTagsFromFacts(facts, computedSummary)
  ])

const missingPinnedPdfTags = (
  taxYear: number,
  formType: ReturnFormType,
  requiredTags: string[]
): string[] => {
  if (!supportsPinnedIrsTemplates(taxYear, formType)) {
    return requiredTags
  }
  const supported = new Set(PINNED_IRS_FORM_TAGS_BY_YEAR[taxYear] ?? [])
  return requiredTags.filter((tag) => !supported.has(tag))
}

const supportsFilledPdfTemplateSet = (
  taxYear: number,
  formType: ReturnFormType,
  requiredTags: string[]
): boolean =>
  resolveFilledPdfGenerator(taxYear, formType) != null &&
  missingPinnedPdfTags(taxYear, formType, requiredTags).length === 0

const normalizeSearchCandidate = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}.$%-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const buildSearchCandidates = (label: string, value: unknown): string[] => {
  const valueText = toText(value).trim()
  const numericCandidate = valueText.replace(/[^0-9.-]/g, '')
  const labelCandidate = label
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(box|line|page)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return uniqueStrings([
    valueText,
    numericCandidate.length >= 2 ? numericCandidate : null,
    labelCandidate
  ]).filter((candidate) => candidate.length >= 2)
}

const buildSourceSnippet = (
  sourceText: string,
  label: string,
  value: unknown
): {
  sourceSnippet?: string
  sourceMatchText?: string
} => {
  if (!sourceText.trim()) {
    return {}
  }

  const lines = sourceText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
  const candidates = buildSearchCandidates(label, value)

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeSearchCandidate(candidate)
    if (!normalizedCandidate) {
      continue
    }
    const lineIndex = lines.findIndex((line) =>
      normalizeSearchCandidate(line).includes(normalizedCandidate)
    )
    if (lineIndex >= 0) {
      return {
        sourceSnippet: lines
          .slice(Math.max(0, lineIndex - 1), Math.min(lines.length, lineIndex + 2))
          .join('\n'),
        sourceMatchText: candidate
      }
    }
  }

  return {}
}

const extractDocumentSourceTextSample = (
  extracted: ExtractedDocument
): string => {
  const raw = asRecord(extracted.raw)
  return (
    toText(raw.textSample) ||
    toText(raw.rawText) ||
    toText(raw.text) ||
    ''
  ).trim()
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

const decodeBase64Content = (value: string): Uint8Array | null => {
  try {
    const normalized = value.includes(',') ? value.split(',').pop() ?? '' : value
    const binary = atob(normalized)
    return Uint8Array.from(binary, (char) => char.charCodeAt(0))
  } catch {
    return null
  }
}

const inferDocumentClusterFromExtraction = (
  extracted: ExtractedDocument
):
  | 'w2'
  | '1099'
  | 'investment'
  | 'business'
  | 'housing'
  | 'health'
  | 'education'
  | 'care'
  | 'charity'
  | 'unknown' => {
  if (extracted.documentType === 'w2') {
    return 'w2'
  }
  if (
    extracted.documentType === '1099-int' ||
    extracted.documentType === '1099-div' ||
    extracted.documentType === '1099-misc' ||
    extracted.documentType === '1099-nec' ||
    extracted.documentType === '1099-r' ||
    extracted.documentType === '1099-g' ||
    extracted.documentType === '1099-ssa'
  ) {
    return '1099'
  }
  if (extracted.documentType === '1099-b') {
    return 'investment'
  }
  if (extracted.documentType === 'brokerage-summary') {
    return 'investment'
  }
  if (extracted.documentType === '1098-mortgage') {
    return 'housing'
  }
  if (extracted.documentType === '1095-a') {
    return 'health'
  }
  if (
    extracted.documentType === '1098-e' ||
    extracted.documentType === '1098-t' ||
    extracted.documentType === 'tuition-ledger'
  ) {
    return 'education'
  }
  if (extracted.documentType === 'k-1') {
    return 'business'
  }
  if (extracted.documentType === 'childcare') {
    return 'care'
  }
  if (
    extracted.documentType === 'charity-receipt' ||
    extracted.documentType === '1098-c'
  ) {
    return 'charity'
  }
  return 'unknown'
}

const buildDocumentFieldsFromExtraction = (
  extracted: ExtractedDocument
): Array<Record<string, unknown>> => {
  const sourceTextSample = extractDocumentSourceTextSample(extracted)
  const makeField = (
    label: string,
    value: unknown,
    confidence: number,
    flagReason?: string
  ) => {
    if (value === undefined || value === null || value === '') {
      return null
    }
    const showValue =
      typeof value === 'number' ? formatCurrency(value) : toText(value)
    const snippet = buildSourceSnippet(sourceTextSample, label, showValue)
    return {
      label,
      value: showValue,
      confidence,
      source: 'AI extraction',
      ...(snippet.sourceSnippet ? { sourceSnippet: snippet.sourceSnippet } : {}),
      ...(snippet.sourceMatchText
        ? { sourceMatchText: snippet.sourceMatchText }
        : {}),
      ...(flagReason ? { flagged: true, flagReason } : {})
    }
  }

  const confidence = extracted.confidence

  switch (extracted.documentType) {
    case 'w2':
      return [
        makeField('Employer name', extracted.w2?.employerName, confidence),
        makeField('Employer EIN', extracted.w2?.ein, confidence),
        makeField('Wages (Box 1)', extracted.w2?.box1Wages, confidence),
        makeField(
          'Federal tax withheld (Box 2)',
          extracted.w2?.box2FedWithholding,
          confidence
        ),
        makeField(
          'State wages (Box 16)',
          extracted.w2?.box16StateWages,
          confidence
        ),
        makeField(
          'State withholding (Box 17)',
          extracted.w2?.box17StateWithholding,
          confidence
        )
      ].filter(Boolean) as Array<Record<string, unknown>>
    case '1099-int':
      return [
        makeField('Payer name', extracted.form1099Int?.payerName, confidence),
        makeField(
          'Interest income (Box 1)',
          extracted.form1099Int?.interestIncome,
          confidence
        ),
        makeField(
          'Federal tax withheld (Box 4)',
          extracted.form1099Int?.federalTaxWithheld,
          confidence
        ),
        makeField(
          'Tax-exempt interest (Box 8)',
          extracted.form1099Int?.taxExemptInterest,
          confidence
        )
      ].filter(Boolean) as Array<Record<string, unknown>>
    case '1099-div':
      return [
        makeField('Payer name', extracted.form1099Div?.payerName, confidence),
        makeField(
          'Ordinary dividends (Box 1a)',
          extracted.form1099Div?.ordinaryDividends,
          confidence
        ),
        makeField(
          'Qualified dividends (Box 1b)',
          extracted.form1099Div?.qualifiedDividends,
          confidence
        ),
        makeField(
          'Capital gain distributions (Box 2a)',
          extracted.form1099Div?.capitalGainDistributions,
          confidence
        ),
        makeField(
          'Federal tax withheld (Box 4)',
          extracted.form1099Div?.federalTaxWithheld,
          confidence
        )
      ].filter(Boolean) as Array<Record<string, unknown>>
    case '1099-nec':
      return [
        makeField('Payer name', extracted.form1099Nec?.payerName, confidence),
        makeField(
          'Nonemployee compensation (Box 1)',
          extracted.form1099Nec?.nonemployeeCompensation,
          confidence
        ),
        makeField(
          'Federal tax withheld (Box 4)',
          extracted.form1099Nec?.federalTaxWithheld,
          confidence
        )
      ].filter(Boolean) as Array<Record<string, unknown>>
    case '1099-misc':
      return [
        makeField('Payer name', extracted.form1099Misc?.payerName, confidence),
        makeField('Rents (Box 1)', extracted.form1099Misc?.rents, confidence),
        makeField(
          'Royalties (Box 2)',
          extracted.form1099Misc?.royalties,
          confidence
        ),
        makeField(
          'Other income (Box 3)',
          extracted.form1099Misc?.otherIncome,
          confidence
        ),
        makeField(
          'Federal tax withheld (Box 4)',
          extracted.form1099Misc?.federalTaxWithheld,
          confidence
        ),
        makeField(
          'Section 409A deferrals (Box 12)',
          extracted.form1099Misc?.section409ADeferrals,
          confidence
        ),
        makeField(
          'Nonqualified deferred comp (Box 15)',
          extracted.form1099Misc?.nonqualifiedDeferredComp,
          confidence
        )
      ].filter(Boolean) as Array<Record<string, unknown>>
    case '1099-r':
      return [
        makeField('Payer name', extracted.form1099R?.payerName, confidence),
        makeField(
          'Gross distribution (Box 1)',
          extracted.form1099R?.grossDistribution,
          confidence
        ),
        makeField(
          'Taxable amount (Box 2a)',
          extracted.form1099R?.taxableAmount,
          confidence
        ),
        makeField(
          'Federal tax withheld (Box 4)',
          extracted.form1099R?.federalTaxWithheld,
          confidence
        ),
        makeField(
          'Distribution code',
          extracted.form1099R?.distributionCode,
          confidence
        )
      ].filter(Boolean) as Array<Record<string, unknown>>
    case '1099-g':
      return [
        makeField('Payer name', extracted.form1099G?.payerName, confidence),
        makeField(
          'Unemployment compensation (Box 1)',
          extracted.form1099G?.unemploymentCompensation,
          confidence
        ),
        makeField(
          'State refund (Box 2)',
          extracted.form1099G?.stateRefund,
          confidence
        ),
        makeField(
          'Federal tax withheld (Box 4)',
          extracted.form1099G?.federalTaxWithheld,
          confidence
        )
      ].filter(Boolean) as Array<Record<string, unknown>>
    case '1099-ssa':
      return [
        makeField('Payer name', extracted.form1099Ssa?.payerName, confidence),
        makeField(
          'Benefits paid (Box 5)',
          extracted.form1099Ssa?.benefitsPaid,
          confidence
        ),
        makeField(
          'Federal tax withheld (Box 6)',
          extracted.form1099Ssa?.federalTaxWithheld,
          confidence
        ),
        makeField(
          'Medicare Part B premiums',
          extracted.form1099Ssa?.medicarePartBPremiums,
          confidence
        )
      ].filter(Boolean) as Array<Record<string, unknown>>
    case '1099-b':
    case 'brokerage-summary':
      return [
        makeField('Broker / payer', extracted.form1099B?.payerName, confidence),
        makeField(
          'Document variant',
          extracted.form1099B?.documentVariant,
          confidence
        ),
        makeField(
          'Short-term proceeds',
          extracted.form1099B?.shortTermProceeds,
          confidence
        ),
        makeField(
          'Short-term cost basis',
          extracted.form1099B?.shortTermCostBasis,
          confidence
        ),
        makeField(
          'Long-term proceeds',
          extracted.form1099B?.longTermProceeds,
          confidence
        ),
        makeField(
          'Long-term cost basis',
          extracted.form1099B?.longTermCostBasis,
          confidence
        ),
        makeField(
          'Detected sales rows',
          extracted.form1099B?.transactions?.length,
          confidence
        )
      ].filter(Boolean) as Array<Record<string, unknown>>
    case '1098-e':
      return [
        makeField('Lender', extracted.form1098E?.lenderName, confidence),
        makeField(
          'Student loan interest',
          extracted.form1098E?.studentLoanInterest,
          confidence
        )
      ].filter(Boolean) as Array<Record<string, unknown>>
    case '1098-t':
    case 'tuition-ledger':
      return [
        makeField(
          'Institution',
          extracted.form1098T?.institutionName,
          confidence
        ),
        makeField(
          'Student name',
          extracted.form1098T?.studentName,
          confidence
        ),
        makeField(
          'Qualified tuition (Box 1)',
          extracted.form1098T?.qualifiedTuitionExpenses,
          confidence
        ),
        makeField(
          'Scholarships and grants (Box 5)',
          extracted.form1098T?.scholarshipsOrGrants,
          confidence
        ),
        makeField(
          'Prior-year adjustment (Box 4)',
          extracted.form1098T?.adjustmentsFromPriorYear,
          confidence
        ),
        makeField(
          'Books and required materials',
          extracted.form1098T?.booksAndMaterials,
          confidence
        ),
        makeField(
          'Payments received',
          extracted.form1098T?.paymentsReceived,
          confidence
        )
      ].filter(Boolean) as Array<Record<string, unknown>>
    case '1095-a':
      return [
        makeField('Policy number', extracted.form1095A?.policyNumber, confidence),
        makeField(
          'People covered',
          extracted.form1095A?.coveredPersons,
          confidence
        ),
        makeField(
          'Enrollment premiums',
          extracted.form1095A?.annualEnrollmentPremium,
          confidence
        ),
        makeField('SLCSP', extracted.form1095A?.annualSlcsp, confidence),
        makeField(
          'Advance premium tax credit',
          extracted.form1095A?.annualAdvancePayment,
          confidence
        )
      ].filter(Boolean) as Array<Record<string, unknown>>
    case '1098-mortgage':
      return [
        makeField('Lender', extracted.mortgage1098?.lenderName, confidence),
        makeField(
          'Mortgage interest',
          extracted.mortgage1098?.mortgageInterest,
          confidence
        ),
        makeField(
          'Property taxes',
          extracted.mortgage1098?.propertyTaxes,
          confidence
        ),
        makeField('Points', extracted.mortgage1098?.points, confidence),
        makeField(
          'Mortgage insurance premiums',
          extracted.mortgage1098?.mortgageInsurancePremiums,
          confidence
        )
      ].filter(Boolean) as Array<Record<string, unknown>>
    case 'k-1':
      return [
        makeField('Entity name', extracted.scheduleK1?.issuerName, confidence),
        makeField('Entity EIN', extracted.scheduleK1?.issuerEin, confidence),
        makeField(
          'K-1 type',
          extracted.scheduleK1?.businessType,
          confidence
        ),
        makeField(
          'Ordinary business income (Box 1)',
          extracted.scheduleK1?.ordinaryBusinessIncome,
          confidence
        ),
        makeField(
          'Rental real estate income (Box 2)',
          extracted.scheduleK1?.rentalRealEstateIncome,
          confidence
        ),
        makeField(
          'Guaranteed payments (Box 4)',
          extracted.scheduleK1?.guaranteedPayments,
          confidence
        ),
        makeField(
          'Interest income (Box 5)',
          extracted.scheduleK1?.interestIncome,
          confidence
        ),
        makeField(
          'Royalties (Box 7)',
          extracted.scheduleK1?.royalties,
          confidence
        ),
        makeField(
          'Section 199A QBI',
          extracted.scheduleK1?.section199AQBI,
          confidence
        )
      ].filter(Boolean) as Array<Record<string, unknown>>
    case 'childcare':
      return [
        makeField(
          'Care provider',
          extracted.childcareStatement?.providerName,
          confidence
        ),
        makeField(
          'Provider TIN',
          extracted.childcareStatement?.providerTin,
          confidence
        ),
        makeField(
          'Amount paid',
          extracted.childcareStatement?.amountPaid,
          confidence
        ),
        makeField(
          'Address',
          extracted.childcareStatement?.address,
          confidence
        )
      ].filter(Boolean) as Array<Record<string, unknown>>
    case 'charity-receipt':
    case '1098-c':
      return [
        makeField('Donee', extracted.charityReceipt?.doneeName, confidence),
        makeField(
          'Cash contribution',
          extracted.charityReceipt?.cashContribution,
          confidence
        ),
        makeField(
          'Noncash contribution',
          extracted.charityReceipt?.noncashContribution,
          confidence
        ),
        makeField(
          'Deduction claimed',
          extracted.charityReceipt?.deductionClaimed,
          confidence
        ),
        makeField(
          'Gross proceeds',
          extracted.charityReceipt?.grossProceeds,
          confidence
        ),
        makeField(
          'Property description',
          extracted.charityReceipt?.propertyDescription,
          confidence
        )
      ].filter(Boolean) as Array<Record<string, unknown>>
    default:
      return []
  }
}

type ImportedExtractedEntity = {
  entityType: string
  entityId: string
  status: string
  label: string
  data: Record<string, unknown>
}

type DocumentInterviewGuidance = {
  title: string
  summary: string
  actionPath: string
  actionLabel: string
  bullets: string[]
  branch?: string
}

type DocumentPrefillSummary = {
  prefillsReturnDraft: boolean
  entityCount: number
  entityLabels: string[]
  affectedForms: string[]
  taxImpactSummary: string
}

type DocumentReconciliationSummary = {
  status: 'matched' | 'needs_review' | 'missing_related'
  headline: string
  bullets: string[]
  actionPath?: string
  actionLabel?: string
}

type DocumentContext = {
  snapshot?: FilingSessionSnapshot | null
  entities?: SessionEntitySnapshot[]
  documents?: Array<{
    id: string
    name: string
    metadata: Record<string, unknown>
  }>
  currentDocumentId?: string
}

type DocumentBatchSummary = {
  documentCount: number
  prefilledDocumentCount: number
  needsReviewCount: number
  confirmedCount: number
  affectedForms: string[]
}

const normalizeMatchingText = (value: unknown): string =>
  toText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

const buildImportEntityId = (prefix: string, parts: unknown[]): string => {
  const normalizedParts = parts
    .map(normalizeMatchingText)
    .filter((value) => value.length > 0)
    .slice(0, 4)
  return normalizedParts.length > 0
    ? `${prefix}-${normalizedParts.join('-')}`
    : `${prefix}-${crypto.randomUUID()}`
}

const getTaxpayerCandidate = (snapshot?: FilingSessionSnapshot | null) => {
  if (!snapshot) return null
  const taxpayer = requireScreen(snapshot, '/taxpayer-profile')
  const firstName = toText(taxpayer.firstName)
  const lastName = toText(taxpayer.lastName)
  const fullName = `${firstName} ${lastName}`.trim()
  if (!fullName) return null
  return {
    role: 'taxpayer' as const,
    id: 'taxpayer-primary',
    name: fullName,
    ssn: toText(taxpayer.ssn).replace(/\D/g, '')
  }
}

const matchEducationHouseholdMember = (
  studentName: unknown,
  snapshot?: FilingSessionSnapshot | null,
  entities: SessionEntitySnapshot[] = []
) => {
  const normalizedStudent = normalizeMatchingText(studentName)
  if (!normalizedStudent || !snapshot) return null

  const candidates = [
    getTaxpayerCandidate(snapshot),
    ...(() => {
      const spouse = getSpouse(snapshot, entities)
      if (!spouse) return []
      return [
        {
          role: 'spouse' as const,
          id: spouse.id,
          name: `${spouse.firstName} ${spouse.lastName}`.trim(),
          ssn: toText(spouse.ssn).replace(/\D/g, '')
        }
      ]
    })(),
    ...getDependents(snapshot, entities).map((dependent) => ({
      role: 'dependent' as const,
      id: dependent.id,
      name: toText(dependent.name),
      ssn: toText(dependent.ssn).replace(/\D/g, '')
    }))
  ].filter(
    (
      candidate
    ): candidate is {
      role: 'taxpayer' | 'spouse' | 'dependent'
      id: string
      name: string
      ssn: string
    } => Boolean(candidate && candidate.name)
  )

  return (
    candidates.find(
      (candidate) => normalizeMatchingText(candidate.name) === normalizedStudent
    ) ?? null
  )
}

const getReconciliationDocuments = (
  documents: DocumentContext['documents'] = [],
  currentDocumentId?: string
) =>
  documents.filter((document) => document.id !== currentDocumentId)

const getDocumentExtraction = (
  document: { metadata: Record<string, unknown> } | null | undefined
): ExtractedDocument | null => {
  const extraction = asRecord(document?.metadata?.extraction)
  return toText(extraction.documentType)
    ? (extraction as unknown as ExtractedDocument)
    : null
}

const sumBrokerLotsForReconciliation = (
  entities: SessionEntitySnapshot[],
  brokerName: string,
  excludeDocumentId?: string
) =>
  entities
    .filter((entity) => entity.entityType === 'tax_lot')
    .filter((entity) => Boolean(entity.data.summaryOnly) === false)
    .filter((entity) => {
      const sourceDocumentId = toText(entity.data.sourceDocumentId)
      return !excludeDocumentId || sourceDocumentId !== excludeDocumentId
    })
    .filter(
      (entity) =>
        normalizeMatchingText(entity.data.sourceBrokerName ?? entity.label) ===
        normalizeMatchingText(brokerName)
    )
    .reduce(
      (totals, entity) => ({
        proceeds: totals.proceeds + toMoney(entity.data.proceeds),
        costBasis:
          totals.costBasis +
          toMoney(entity.data.costBasis ?? entity.data.basis),
        lotCount: totals.lotCount + 1
      }),
      { proceeds: 0, costBasis: 0, lotCount: 0 }
    )

const buildDocumentReconciliationSummary = (
  extracted: ExtractedDocument,
  context: DocumentContext = {}
): DocumentReconciliationSummary | null => {
  const snapshot = context.snapshot ?? undefined
  const entities = context.entities ?? []
  const relatedDocuments = getReconciliationDocuments(
    context.documents,
    context.currentDocumentId
  )

  if (extracted.documentType === '1098-t' || extracted.documentType === 'tuition-ledger') {
    const studentName = toText(extracted.form1098T?.studentName || 'the student')
    const institutionName = toText(
      extracted.form1098T?.institutionName || 'the school'
    )
    const matchedStudent = matchEducationHouseholdMember(
      extracted.form1098T?.studentName,
      snapshot,
      entities
    )
    const counterpartTypes =
      extracted.documentType === '1098-t'
        ? ['tuition-ledger']
        : ['1098-t']
    const counterpart = relatedDocuments.find((document) => {
      const relatedExtraction = getDocumentExtraction(document)
      if (!relatedExtraction) return false
      if (!counterpartTypes.includes(relatedExtraction.documentType)) return false
      return (
        normalizeMatchingText(relatedExtraction.form1098T?.studentName) ===
          normalizeMatchingText(studentName) ||
        normalizeMatchingText(relatedExtraction.form1098T?.institutionName) ===
          normalizeMatchingText(institutionName)
      )
    })
    const counterpartExtraction = counterpart ? getDocumentExtraction(counterpart) : null
    const currentQualifiedExpenses =
      toMoney(extracted.form1098T?.qualifiedTuitionExpenses) +
      (extracted.documentType === 'tuition-ledger'
        ? toMoney(extracted.form1098T?.booksAndMaterials)
        : 0)
    const counterpartQualifiedExpenses =
      toMoney(counterpartExtraction?.form1098T?.qualifiedTuitionExpenses) +
      (counterpartExtraction?.documentType === 'tuition-ledger'
        ? toMoney(counterpartExtraction?.form1098T?.booksAndMaterials)
        : 0)

    const bullets = [
      matchedStudent
        ? `Matched ${studentName} to your ${matchedStudent.role === 'dependent' ? 'dependent' : matchedStudent.role}: ${matchedStudent.name}.`
        : `We could not confidently match ${studentName} to the taxpayer, spouse, or dependents yet.`
    ]

    if (counterpart && counterpartExtraction) {
      const difference = Math.abs(
        currentQualifiedExpenses - counterpartQualifiedExpenses
      )
      bullets.push(
        difference <= 1
          ? `This ${extracted.documentType === '1098-t' ? '1098-T' : 'tuition ledger'} lines up with ${counterpart.name}.`
          : `${counterpart.name} differs by ${formatCurrency(
              difference
            )}; review tuition, books, and scholarship offsets before finalizing Form 8863.`
      )
      return {
        status: difference <= 1 && matchedStudent ? 'matched' : 'needs_review',
        headline:
          difference <= 1
            ? 'Education documents are lining up cleanly'
            : 'Education documents need one reconciliation check',
        bullets,
        actionPath: '/education-care?tab=education',
        actionLabel: 'Review education details'
      }
    }

    bullets.push(
      extracted.documentType === '1098-t'
        ? 'Upload a bursar or tuition ledger if books, required supplies, or payment timing are missing from the 1098-T.'
        : 'Upload the matching 1098-T if you have it so we can reconcile school billing against the tax form.'
    )
    return {
      status: matchedStudent ? 'missing_related' : 'needs_review',
      headline: 'Education credit support can be tightened',
      bullets,
      actionPath: '/education-care?tab=education',
      actionLabel: 'Review education details'
    }
  }

  if (
    extracted.documentType === '1099-b' ||
    extracted.documentType === 'brokerage-summary'
  ) {
    const brokerName = toText(extracted.form1099B?.payerName || 'this broker')
    const documentTotals = {
      proceeds:
        toMoney(extracted.form1099B?.shortTermProceeds) +
        toMoney(extracted.form1099B?.longTermProceeds),
      costBasis:
        toMoney(extracted.form1099B?.shortTermCostBasis) +
        toMoney(extracted.form1099B?.longTermCostBasis)
    }
    const detailedLots = sumBrokerLotsForReconciliation(
      entities,
      brokerName,
      context.currentDocumentId
    )
    const difference = Math.abs(documentTotals.proceeds - detailedLots.proceeds)

    if (detailedLots.lotCount > 0) {
      return {
        status: difference <= 1 ? 'matched' : 'needs_review',
        headline:
          difference <= 1
            ? 'Broker totals match your imported sale lots'
            : 'Broker totals do not match your imported sale lots yet',
        bullets: [
          `${brokerName} currently has ${detailedLots.lotCount} detailed lot${
            detailedLots.lotCount === 1 ? '' : 's'
          } in the draft return.`,
          difference <= 1
            ? `The detailed lots tie to ${formatCurrency(
                detailedLots.proceeds
              )} of proceeds.`
            : `The detailed lots total ${formatCurrency(
                detailedLots.proceeds
              )} of proceeds vs ${formatCurrency(
                documentTotals.proceeds
              )} on this summary.`
        ],
        actionPath: '/investments',
        actionLabel: 'Review investment lots'
      }
    }

    return {
      status:
        extracted.form1099B?.transactions &&
        extracted.form1099B.transactions.length > 0
          ? 'matched'
          : 'missing_related',
      headline:
        extracted.form1099B?.transactions &&
        extracted.form1099B.transactions.length > 0
          ? 'Detailed brokerage sales were imported'
          : 'Broker summary imported, but detailed lots are still missing',
      bullets: [
        extracted.form1099B?.transactions &&
        extracted.form1099B.transactions.length > 0
          ? `We imported ${extracted.form1099B.transactions.length} sale rows from ${brokerName}.`
          : `We imported the high-level ${brokerName} totals, but not line-by-line sale lots yet.`,
        'Review the investment workbench to confirm term, basis, wash sales, and Form 8949 treatment.'
      ],
      actionPath: '/investments',
      actionLabel: 'Review investment lots'
    }
  }

  return null
}

const normalizeK1BusinessType = (
  value: unknown
): 'k1-partnership' | 'k1-scorp' | 'k1-trust' => {
  const normalized = toText(value).toLowerCase()
  if (
    normalized.includes('s-corp') ||
    normalized.includes('s_corp') ||
    normalized.includes('k1-scorp')
  ) {
    return 'k1-scorp'
  }
  if (
    normalized.includes('trust') ||
    normalized.includes('estate') ||
    normalized.includes('k1-trust')
  ) {
    return 'k1-trust'
  }
  return 'k1-partnership'
}

const buildDocumentInterviewGuidance = (
  extracted: ExtractedDocument
): DocumentInterviewGuidance | null => {
  switch (extracted.documentType) {
    case '1098-t':
    case 'tuition-ledger': {
      const studentName = toText(extracted.form1098T?.studentName || 'the student')
      const institutionName = toText(
        extracted.form1098T?.institutionName || 'the school'
      )
      return {
        title: 'Finish the education credit interview',
        summary:
          'We imported the 1098-T amounts, but the credit still depends on the student profile and whether this should flow to AOTC or Lifetime Learning Credit.',
        actionPath: '/education-care?tab=education',
        actionLabel: 'Review education credit details',
        branch: 'education-credit',
        bullets: [
          `Confirm whether ${studentName} is the taxpayer, spouse, or a dependent.`,
          `Review ${institutionName} expenses against books, supplies, and scholarships before we finalize Form 8863.`,
          extracted.documentType === 'tuition-ledger'
            ? 'Use the ledger to confirm books, required supplies, and payment timing that may not appear on the 1098-T itself.'
            : 'If books or required supplies are missing from the 1098-T, upload the tuition ledger so we can reconcile them automatically.',
          'Answer the AOTC vs LLC eligibility questions, including first four years, half-time status, and any felony-drug-conviction disqualification.'
        ]
      }
    }
    case 'k-1': {
      const normalizedType = normalizeK1BusinessType(
        extracted.scheduleK1?.businessType
      )
      const branchLabel =
        normalizedType === 'k1-scorp'
          ? 'S-corp'
          : normalizedType === 'k1-trust'
          ? 'trust / estate'
          : 'partnership'

      return {
        title: `Finish the ${branchLabel} K-1 interview`,
        summary:
          'We imported the headline K-1 amounts, but we still need the branch-specific questions that drive passive-loss, basis, QBI, and beneficiary/shareholder treatment.',
        actionPath: '/business-k1',
        actionLabel: `Review ${branchLabel} K-1 details`,
        branch: normalizedType,
        bullets: [
          `Confirm that this is a ${branchLabel} K-1 so we route it through the right checklist and review package.`,
          normalizedType === 'k1-scorp'
            ? 'Review shareholder basis, distributions, and any officer-compensation or Section 199A wage details.'
            : normalizedType === 'k1-trust'
            ? 'Review beneficiary/trust items, DNI-style allocations, and any foreign or fiduciary detail that does not show up in the headline boxes.'
            : 'Review passive-vs-nonpassive treatment, guaranteed payments, self-employment earnings, and any at-risk or prior-year loss carryovers.',
          'Finish any QBI follow-up so Schedule E, Schedule SE, and the 199A worksheet stay aligned.'
        ]
      }
    }
    case '1099-b':
    case 'brokerage-summary': {
      const brokerName = toText(extracted.form1099B?.payerName || 'the broker')
      return {
        title: 'Reconcile your investment sales',
        summary:
          extracted.documentType === 'brokerage-summary'
            ? 'We imported the broker summary totals, but we still want to line them up against detailed sale lots before Form 8949 is final.'
            : 'We imported the investment sales we found, but you should still confirm lot-level basis, term, and any wash-sale adjustments.',
        actionPath: '/investments',
        actionLabel: 'Review investment lots',
        branch: 'investment-sales',
        bullets: [
          `Confirm whether ${brokerName} is already represented by detailed 1099-B lot imports or manual lot entries.`,
          'Review term, basis, and wash-sale treatment for every lot that will flow to Form 8949 and Schedule D.',
          'If this is only a brokerage summary, add or confirm the detailed lots so the return does not rely on summary-only proceeds.'
        ]
      }
    }
    default:
      return null
  }
}

const buildDocumentPrefillSummary = (
  extracted: ExtractedDocument,
  importedEntities: ImportedExtractedEntity[]
): DocumentPrefillSummary => {
  const entityLabels = uniqueStrings(
    importedEntities.map((entity) => entity.label || entity.entityType)
  )

  const makeSummary = (
    affectedForms: string[],
    taxImpactSummary: string
  ): DocumentPrefillSummary => ({
    prefillsReturnDraft: importedEntities.length > 0,
    entityCount: importedEntities.length,
    entityLabels,
    affectedForms,
    taxImpactSummary
  })

  switch (extracted.documentType) {
    case 'w2':
      return makeSummary(
        ['Form 1040', 'State return'],
        'Draft wages and withholding now flow into your return estimate.'
      )
    case '1099-int':
      return makeSummary(
        ['Form 1040', 'Schedule B'],
        'Draft interest income now feeds your federal return totals.'
      )
    case '1099-div':
      return makeSummary(
        ['Form 1040', 'Schedule B', 'Qualified dividends worksheet'],
        'Draft dividend income now feeds your return and dividend tax worksheets.'
      )
    case '1099-nec':
      return makeSummary(
        ['Schedule C', 'Schedule SE', 'Form 1040'],
        'Draft self-employment income now feeds the business income estimate.'
      )
    case '1099-misc':
      return makeSummary(
        ['Schedule 1', 'Schedule E', 'Form 1040'],
        'Draft rent, royalty, and other income now flows into your return.'
      )
    case '1099-r':
      return makeSummary(
        ['Form 1040', 'Retirement income'],
        'Draft retirement income and withholding now affect your return estimate.'
      )
    case '1099-g':
      return makeSummary(
        ['Schedule 1', 'Form 1040'],
        'Draft unemployment and state refund amounts now affect your return estimate.'
      )
    case '1099-ssa':
      return makeSummary(
        ['Form 1040', 'Social Security worksheet'],
        'Draft Social Security benefits now feed the taxable-benefits calculation.'
      )
    case '1099-b':
    case 'brokerage-summary':
      return makeSummary(
        ['Schedule D', 'Form 8949', 'Form 1040'],
        extracted.documentType === 'brokerage-summary'
          ? 'Draft brokerage totals now feed capital gain estimates until you reconcile them against detailed lots.'
          : 'Draft sale details now feed capital gain and loss calculations.'
      )
    case '1098-e':
      return makeSummary(
        ['Schedule 1', 'Form 1040'],
        'Draft student loan interest now feeds the adjustment calculation.'
      )
    case '1098-t':
    case 'tuition-ledger':
      return makeSummary(
        ['Form 8863', 'Form 1040'],
        extracted.documentType === 'tuition-ledger'
          ? 'Draft tuition, books, and scholarship details now feed your education credit estimate.'
          : 'Draft education credits now feed your return estimate.'
      )
    case '1095-a':
      return makeSummary(
        ['Form 8962', 'Form 1040'],
        'Draft marketplace coverage now feeds the premium tax credit calculation.'
      )
    case '1098-mortgage':
      return makeSummary(
        ['Schedule A'],
        'Draft mortgage interest and property tax amounts now feed itemized deductions.'
      )
    case 'childcare':
      return makeSummary(
        ['Form 2441', 'Form 1040'],
        'Draft dependent care costs now feed the child and dependent care credit.'
      )
    case 'charity-receipt':
    case '1098-c':
      return makeSummary(
        ['Schedule A', 'Form 8283'],
        'Draft charitable contributions now feed your itemized deduction packet.'
      )
    case 'k-1':
      return makeSummary(
        ['Schedule E', 'QBI worksheets', 'Form 1040'],
        'Draft K-1 income now feeds rental, pass-through, and QBI calculations.'
      )
    default:
      return makeSummary([], 'We extracted this document, but it is not prefilling the draft return yet.')
  }
}

const buildDocumentBatchSummary = (
  documents: Array<{
    status: string
    metadata?: Record<string, unknown>
  }>
): DocumentBatchSummary => {
  const affectedForms = uniqueStrings(
    documents.flatMap((document) => {
      const prefillSummary = asRecord(document.metadata?.prefillSummary)
      return asArray<string>(prefillSummary.affectedForms).filter(
        (form): form is string => typeof form === 'string' && form.length > 0
      )
    })
  )

  return {
    documentCount: documents.length,
    prefilledDocumentCount: documents.filter((document) => {
      const prefillSummary = asRecord(document.metadata?.prefillSummary)
      return prefillSummary.prefillsReturnDraft === true
    }).length,
    needsReviewCount: documents.filter((document) =>
      ['needs_review', 'ambiguous', 'ocr_failed'].includes(document.status)
    ).length,
    confirmedCount: documents.filter(
      (document) => document.status === 'confirmed'
    ).length,
    affectedForms
  }
}

const buildEducationExpenseEntityId = (
  extracted: ExtractedDocument,
  matchedStudent: ReturnType<typeof matchEducationHouseholdMember>
) =>
  buildImportEntityId('education-expense', [
    matchedStudent?.role,
    matchedStudent?.name ?? extracted.form1098T?.studentName,
    extracted.form1098T?.institutionName
  ])

const buildEntitiesFromDocumentExtraction = (
  documentId: string,
  documentName: string,
  extracted: ExtractedDocument,
  context: Pick<DocumentContext, 'snapshot' | 'entities'> = {}
): ImportedExtractedEntity[] => {
  switch (extracted.documentType) {
    case 'w2':
      if (
        !extracted.w2?.employerName ||
        !extracted.w2?.ein ||
        extracted.w2.box1Wages == null
      ) {
        return []
      }
      return [{
        entityType: 'w2',
        entityId: documentId,
        status: 'review_needed',
        label: extracted.w2.employerName || documentName,
        data: {
          employerName: extracted.w2.employerName,
          ein: extracted.w2.ein,
          box1Wages: extracted.w2.box1Wages,
          box2FederalWithheld: extracted.w2.box2FedWithholding,
          box12Codes: extracted.w2.box12Codes,
          stateWages: extracted.w2.box16StateWages,
          stateWithheld: extracted.w2.box17StateWithholding,
          sourceDocumentId: documentId,
          sourceDocumentName: documentName,
          extractionConfidence: extracted.confidence
        }
      }]
    case '1099-int':
      if (
        !extracted.form1099Int?.payerName ||
        extracted.form1099Int.interestIncome == null
      ) {
        return []
      }
      return [{
        entityType: '1099_int',
        entityId: documentId,
        status: 'review_needed',
        label: extracted.form1099Int.payerName || documentName,
        data: {
          payerName: extracted.form1099Int.payerName,
          amount: extracted.form1099Int.interestIncome,
          federalWithheld: extracted.form1099Int.federalTaxWithheld,
          taxExemptInterest: extracted.form1099Int.taxExemptInterest,
          foreignTaxPaid: extracted.form1099Int.foreignTaxPaid,
          owner: extracted.form1099Int.owner ?? 'taxpayer',
          sourceDocumentId: documentId,
          sourceDocumentName: documentName,
          extractionConfidence: extracted.confidence
        }
      }]
    case '1099-div':
      if (
        !extracted.form1099Div?.payerName ||
        extracted.form1099Div.ordinaryDividends == null
      ) {
        return []
      }
      return [{
        entityType: '1099_div',
        entityId: documentId,
        status: 'review_needed',
        label: extracted.form1099Div.payerName || documentName,
        data: {
          payerName: extracted.form1099Div.payerName,
          amount: extracted.form1099Div.ordinaryDividends,
          qualifiedDividends: extracted.form1099Div.qualifiedDividends,
          capitalGainDistributions:
            extracted.form1099Div.capitalGainDistributions,
          section199ADividends: extracted.form1099Div.section199ADividends,
          exemptInterestDividends:
            extracted.form1099Div.exemptInterestDividends,
          foreignTaxPaid: extracted.form1099Div.foreignTaxPaid,
          federalWithheld: extracted.form1099Div.federalTaxWithheld,
          owner: extracted.form1099Div.owner ?? 'taxpayer',
          sourceDocumentId: documentId,
          sourceDocumentName: documentName,
          extractionConfidence: extracted.confidence
        }
      }]
    case '1099-nec':
      if (
        !extracted.form1099Nec?.payerName ||
        extracted.form1099Nec.nonemployeeCompensation == null
      ) {
        return []
      }
      return [{
        entityType: '1099_nec',
        entityId: documentId,
        status: 'review_needed',
        label: extracted.form1099Nec.payerName || documentName,
        data: {
          payerName: extracted.form1099Nec.payerName,
          amount: extracted.form1099Nec.nonemployeeCompensation,
          federalWithheld: extracted.form1099Nec.federalTaxWithheld,
          owner: extracted.form1099Nec.owner ?? 'taxpayer',
          sourceDocumentId: documentId,
          sourceDocumentName: documentName,
          extractionConfidence: extracted.confidence
        }
      }]
    case '1099-misc': {
      const rents = toMoney(extracted.form1099Misc?.rents)
      const royalties = toMoney(extracted.form1099Misc?.royalties)
      const otherIncome = toMoney(extracted.form1099Misc?.otherIncome)
      const federalWithheld = toMoney(
        extracted.form1099Misc?.federalTaxWithheld
      )
      const deferredComp = toMoney(
        extracted.form1099Misc?.nonqualifiedDeferredComp
      )
      const totalAmount = rents + royalties + otherIncome
      if (
        !extracted.form1099Misc?.payerName ||
        (totalAmount <= 0 &&
          federalWithheld <= 0 &&
          deferredComp <= 0 &&
          toMoney(extracted.form1099Misc?.section409ADeferrals) <= 0)
      ) {
        return []
      }
      return [{
        entityType: '1099_misc',
        entityId: documentId,
        status: 'review_needed',
        label: extracted.form1099Misc.payerName || documentName,
        data: {
          payerName: extracted.form1099Misc.payerName,
          amount: totalAmount,
          rents: extracted.form1099Misc.rents,
          royalties: extracted.form1099Misc.royalties,
          otherIncome: extracted.form1099Misc.otherIncome,
          federalWithheld: extracted.form1099Misc.federalTaxWithheld,
          section409ADeferrals: extracted.form1099Misc.section409ADeferrals,
          nonqualifiedDeferredComp:
            extracted.form1099Misc.nonqualifiedDeferredComp,
          amounts: {
            rents: extracted.form1099Misc.rents,
            royalties: extracted.form1099Misc.royalties,
            otherIncome: extracted.form1099Misc.otherIncome
          },
          owner: extracted.form1099Misc.owner ?? 'taxpayer',
          sourceDocumentId: documentId,
          sourceDocumentName: documentName,
          extractionConfidence: extracted.confidence
        }
      }]
    }
    case '1099-r':
      if (
        !extracted.form1099R?.payerName ||
        extracted.form1099R.grossDistribution == null
      ) {
        return []
      }
      return [{
        entityType: '1099_r',
        entityId: documentId,
        status: 'review_needed',
        label: extracted.form1099R.payerName || documentName,
        data: {
          payerName: extracted.form1099R.payerName,
          amount: extracted.form1099R.grossDistribution,
          taxableAmount: extracted.form1099R.taxableAmount,
          federalWithheld: extracted.form1099R.federalTaxWithheld,
          distributionCode: extracted.form1099R.distributionCode,
          iraSepSimple: extracted.form1099R.iraSepSimple,
          owner: extracted.form1099R.owner ?? 'taxpayer',
          sourceDocumentId: documentId,
          sourceDocumentName: documentName,
          extractionConfidence: extracted.confidence
        }
      }]
    case '1099-g':
      if (extracted.form1099G?.unemploymentCompensation == null) {
        return []
      }
      return [{
        entityType: 'unemployment_record',
        entityId: documentId,
        status: 'review_needed',
        label: extracted.form1099G.payerName || documentName,
        data: {
          payerName: extracted.form1099G.payerName,
          amount: extracted.form1099G.unemploymentCompensation,
          federalWithheld: extracted.form1099G.federalTaxWithheld,
          stateWithheld: extracted.form1099G.stateTaxWithheld,
          sourceDocumentId: documentId,
          sourceDocumentName: documentName,
          extractionConfidence: extracted.confidence
        }
      }]
    case '1099-ssa':
      if (extracted.form1099Ssa?.benefitsPaid == null) {
        return []
      }
      return [{
        entityType: 'ssa_record',
        entityId: documentId,
        status: 'review_needed',
        label: extracted.form1099Ssa.payerName || documentName,
        data: {
          payerName: extracted.form1099Ssa.payerName,
          grossAmount: extracted.form1099Ssa.benefitsPaid,
          federalWithheld: extracted.form1099Ssa.federalTaxWithheld,
          medicarePartBPremiums: extracted.form1099Ssa.medicarePartBPremiums,
          sourceDocumentId: documentId,
          sourceDocumentName: documentName,
          extractionConfidence: extracted.confidence
        }
      }]
    case '1099-b':
    case 'brokerage-summary': {
      const shortTermProceeds = toMoney(extracted.form1099B?.shortTermProceeds)
      const longTermProceeds = toMoney(extracted.form1099B?.longTermProceeds)
      const totalProceeds = shortTermProceeds + longTermProceeds
      if (!extracted.form1099B?.payerName || totalProceeds <= 0) {
        return []
      }
      const brokerName = extracted.form1099B.payerName || documentName
      const transactionLots: ImportedExtractedEntity[] =
        extracted.form1099B.transactions?.reduce<ImportedExtractedEntity[]>(
          (acc, transaction, index) => {
            const proceeds = toMoney(transaction.proceeds)
            const costBasis = toMoney(transaction.costBasis)
            if (proceeds <= 0 && costBasis <= 0) {
              return acc
            }
            const term =
              transaction.term === 'short' ||
              transaction.term === 'long' ||
              transaction.term === 'unknown'
                ? transaction.term
                : 'unknown'
            acc.push({
              entityType: 'tax_lot',
              entityId: `${documentId}-lot-${index + 1}`,
              status: 'review_needed',
              label: transaction.description || `${brokerName} sale ${index + 1}`,
              data: {
                security:
                  transaction.description || `${brokerName} sale ${index + 1}`,
                securityType: 'brokerage',
                proceeds,
                costBasis,
                term,
                source:
                  extracted.documentType === 'brokerage-summary'
                    ? 'document_brokerage_summary_transaction'
                    : 'document_1099_b_transaction',
                sourceBrokerName: brokerName,
                summaryOnly: false,
                sourceDocumentId: documentId,
                sourceDocumentName: documentName,
                extractionConfidence: extracted.confidence
              }
            })
            return acc
          },
          []
        ) ?? []

      const fallbackSummaryLot: ImportedExtractedEntity[] =
        transactionLots.length === 0
          ? [
              {
                entityType: 'tax_lot',
                entityId: `${documentId}-summary`,
                status: 'review_needed',
                label: brokerName,
                data: {
                  security: brokerName,
                  securityType: 'brokerage',
                  proceeds: totalProceeds,
                  costBasis:
                    toMoney(extracted.form1099B.shortTermCostBasis) +
                    toMoney(extracted.form1099B.longTermCostBasis),
                  shortTermProceeds: extracted.form1099B.shortTermProceeds,
                  shortTermCostBasis: extracted.form1099B.shortTermCostBasis,
                  longTermProceeds: extracted.form1099B.longTermProceeds,
                  longTermCostBasis: extracted.form1099B.longTermCostBasis,
                  source:
                    extracted.documentType === 'brokerage-summary'
                      ? 'document_brokerage_summary'
                      : 'document_1099_b_summary',
                  sourceBrokerName: brokerName,
                  summaryOnly: true,
                  sourceDocumentId: documentId,
                  sourceDocumentName: documentName,
                  extractionConfidence: extracted.confidence
                }
              }
            ]
          : []

      return [
        {
          entityType: '1099_b',
          entityId: documentId,
          status: 'review_needed',
          label: brokerName,
          data: {
            payerName: brokerName,
            shortTermProceeds: extracted.form1099B.shortTermProceeds,
            shortTermCostBasis: extracted.form1099B.shortTermCostBasis,
            longTermProceeds: extracted.form1099B.longTermProceeds,
            longTermCostBasis: extracted.form1099B.longTermCostBasis,
            federalWithheld: extracted.form1099B.federalTaxWithheld,
            documentVariant: extracted.form1099B.documentVariant,
            owner: extracted.form1099B.owner ?? 'taxpayer',
            sourceDocumentId: documentId,
            sourceDocumentName: documentName,
            extractionConfidence: extracted.confidence
          }
        },
        ...transactionLots,
        ...fallbackSummaryLot
      ]
    }
    case '1098-e':
      if (extracted.form1098E?.studentLoanInterest == null) {
        return []
      }
      return [{
        entityType: 'student_loan_interest',
        entityId: documentId,
        status: 'review_needed',
        label: extracted.form1098E.lenderName || documentName,
        data: {
          lenderName: extracted.form1098E.lenderName,
          interestPaid: extracted.form1098E.studentLoanInterest,
          sourceDocumentId: documentId,
          sourceDocumentName: documentName,
          extractionConfidence: extracted.confidence
        }
      }]
    case '1098-t':
    case 'tuition-ledger': {
      const matchedStudent = matchEducationHouseholdMember(
        extracted.form1098T?.studentName,
        context.snapshot,
        context.entities ?? []
      )
      const entityId = buildEducationExpenseEntityId(extracted, matchedStudent)
      const qualifiedExpenses = toMoney(
        extracted.form1098T?.qualifiedTuitionExpenses
      )
      const booksAndMaterials = toMoney(extracted.form1098T?.booksAndMaterials)
      const scholarships = toMoney(extracted.form1098T?.scholarshipsOrGrants)
      if (
        !extracted.form1098T?.institutionName &&
        !extracted.form1098T?.studentName &&
        qualifiedExpenses <= 0 &&
        booksAndMaterials <= 0 &&
        scholarships <= 0
      ) {
        return []
      }
      return [{
        entityType: 'education_expense',
        entityId,
        status: 'review_needed',
        label:
          matchedStudent?.name ||
          extracted.form1098T?.studentName ||
          extracted.form1098T?.institutionName ||
          documentName,
        data: {
          studentName:
            matchedStudent?.name || extracted.form1098T?.studentName,
          studentSsn: matchedStudent?.ssn,
          matchedHouseholdMemberId: matchedStudent?.id,
          matchedHouseholdMemberRole: matchedStudent?.role,
          institutionName: extracted.form1098T?.institutionName,
          qualifiedExpenses:
            extracted.documentType === 'tuition-ledger'
              ? qualifiedExpenses + booksAndMaterials
              : qualifiedExpenses,
          tuitionAmount: qualifiedExpenses,
          booksAndMaterials,
          paymentsReceived: extracted.form1098T?.paymentsReceived,
          scholarshipsReceived: scholarships,
          priorYearAdjustment: extracted.form1098T?.adjustmentsFromPriorYear,
          form1098TQualifiedExpenses:
            extracted.documentType === '1098-t' ? qualifiedExpenses : undefined,
          form1098TScholarships:
            extracted.documentType === '1098-t' ? scholarships : undefined,
          form1098TPriorYearAdjustment:
            extracted.documentType === '1098-t'
              ? extracted.form1098T?.adjustmentsFromPriorYear
              : undefined,
          tuitionLedgerQualifiedExpenses:
            extracted.documentType === 'tuition-ledger'
              ? qualifiedExpenses
              : undefined,
          tuitionLedgerBooksAndMaterials:
            extracted.documentType === 'tuition-ledger'
              ? booksAndMaterials
              : undefined,
          tuitionLedgerScholarships:
            extracted.documentType === 'tuition-ledger' ? scholarships : undefined,
          tuitionLedgerPaymentsReceived:
            extracted.documentType === 'tuition-ledger'
              ? extracted.form1098T?.paymentsReceived
              : undefined,
          importNeedsEducationInterview: true,
          creditType: 'AOTC',
          personRole: matchedStudent?.role ?? 'dependent',
          isHalfTimeStudent: true,
          isFirstFourYears: true,
          hasConviction: false,
          documentVariant:
            extracted.form1098T?.documentVariant ?? extracted.documentType,
          sourceDocumentIds: [documentId],
          sourceDocumentTypes: [extracted.documentType],
          sourceDocumentId: documentId,
          sourceDocumentName: documentName,
          extractionConfidence: extracted.confidence
        }
      }]
    }
    case '1095-a':
      if (
        extracted.form1095A?.annualEnrollmentPremium == null &&
        extracted.form1095A?.annualAdvancePayment == null &&
        extracted.form1095A?.annualSlcsp == null
      ) {
        return []
      }
      return [{
        entityType: 'aca_1095a',
        entityId: documentId,
        status: 'review_needed',
        label: extracted.form1095A.policyNumber || 'Marketplace coverage',
        data: {
          has1095A: true,
          entryMode: 'annual',
          policyNumber: extracted.form1095A.policyNumber,
          coverageStart: extracted.form1095A.coverageStart,
          coverageEnd: extracted.form1095A.coverageEnd,
          coveredPersons: extracted.form1095A.coveredPersons ?? 1,
          annualEnrollmentPremium:
            extracted.form1095A.annualEnrollmentPremium ?? 0,
          annualSLCSP: extracted.form1095A.annualSlcsp ?? 0,
          annualAPTC: extracted.form1095A.annualAdvancePayment ?? 0,
          sourceDocumentId: documentId,
          sourceDocumentName: documentName,
          extractionConfidence: extracted.confidence
        }
      }]
    case '1098-mortgage':
      if (extracted.mortgage1098?.mortgageInterest == null) {
        return []
      }
      return [{
        entityType: 'itemized_deductions',
        entityId: documentId,
        status: 'review_needed',
        label: extracted.mortgage1098.lenderName || documentName,
        data: {
          mortgageInterest: extracted.mortgage1098.mortgageInterest,
          propertyTaxes: extracted.mortgage1098.propertyTaxes,
          points: extracted.mortgage1098.points,
          mortgageInsurancePremiums:
            extracted.mortgage1098.mortgageInsurancePremiums,
          sourceDocumentId: documentId,
          sourceDocumentName: documentName,
          extractionConfidence: extracted.confidence
        }
      }]
    case 'childcare':
      if (
        !extracted.childcareStatement?.providerName ||
        extracted.childcareStatement.amountPaid == null
      ) {
        return []
      }
      return [{
        entityType: 'care_provider',
        entityId: documentId,
        status: 'review_needed',
        label: extracted.childcareStatement.providerName || documentName,
        data: {
          providerName: extracted.childcareStatement.providerName,
          ein: extracted.childcareStatement.providerTin,
          ssn: extracted.childcareStatement.providerTin,
          address: extracted.childcareStatement.address,
          amountPaid: extracted.childcareStatement.amountPaid,
          providerType: 'daycare',
          sourceDocumentId: documentId,
          sourceDocumentName: documentName,
          extractionConfidence: extracted.confidence
        }
      }]
    case 'charity-receipt':
    case '1098-c': {
      const cashContribution = toMoney(extracted.charityReceipt?.cashContribution)
      const noncashContribution = toMoney(
        extracted.charityReceipt?.noncashContribution ??
          extracted.charityReceipt?.deductionClaimed
      )
      const entities: ImportedExtractedEntity[] = []
      if (cashContribution > 0) {
        entities.push({
          entityType: 'itemized_deductions',
          entityId: `${documentId}-schedule-a`,
          status: 'review_needed',
          label: extracted.charityReceipt?.doneeName || documentName,
          data: {
            charityCashCheck: cashContribution,
            sourceDocumentId: documentId,
            sourceDocumentName: documentName,
            extractionConfidence: extracted.confidence
          }
        })
      }
      if (
        noncashContribution > 0 ||
        Boolean(extracted.charityReceipt?.form1098CAttached)
      ) {
        entities.push({
          entityType: 'form_8283',
          entityId: `${documentId}-8283`,
          status: 'review_needed',
          label: extracted.charityReceipt?.doneeName || documentName,
          data: {
            sectionADonations:
              noncashContribution > 0
                ? [
                    {
                      donee: extracted.charityReceipt?.doneeName || '',
                      description:
                        extracted.charityReceipt?.propertyDescription ||
                        'Noncash contribution',
                      fairMarketValue: noncashContribution,
                      deductionClaimed:
                        extracted.charityReceipt?.deductionClaimed ??
                        noncashContribution
                    }
                  ]
                : [],
            vehicleDonations:
              extracted.documentType === '1098-c'
                ? [
                    {
                      donee: extracted.charityReceipt?.doneeName || '',
                      description:
                        extracted.charityReceipt?.propertyDescription ||
                        'Vehicle donation',
                      grossProceeds:
                        extracted.charityReceipt?.grossProceeds ?? undefined,
                      deductionClaimed:
                        extracted.charityReceipt?.deductionClaimed ??
                        noncashContribution,
                      form1098CAttached: true
                    }
                  ]
                : [],
            sourceDocumentId: documentId,
            sourceDocumentName: documentName,
            extractionConfidence: extracted.confidence
          }
        })
      }
      return entities
    }
    case 'k-1': {
      const ordinaryBusinessIncome = toMoney(
        extracted.scheduleK1?.ordinaryBusinessIncome
      )
      const rentalIncome = toMoney(extracted.scheduleK1?.rentalRealEstateIncome)
      const royalties = toMoney(extracted.scheduleK1?.royalties)
      const guaranteedPayments = toMoney(
        extracted.scheduleK1?.guaranteedPayments
      )
      const interestIncome = toMoney(extracted.scheduleK1?.interestIncome)
      if (
        !extracted.scheduleK1?.issuerName &&
        !extracted.scheduleK1?.issuerEin &&
        ordinaryBusinessIncome <= 0 &&
        rentalIncome <= 0 &&
        royalties <= 0 &&
        guaranteedPayments <= 0 &&
        interestIncome <= 0
      ) {
        return []
      }
      return [{
        entityType: 'k1_entity',
        entityId: documentId,
        status: 'review_needed',
        label: extracted.scheduleK1?.issuerName || documentName,
        data: {
          name: extracted.scheduleK1?.issuerName,
          entityName: extracted.scheduleK1?.issuerName,
          ein: extracted.scheduleK1?.issuerEin,
          businessType: normalizeK1BusinessType(
            extracted.scheduleK1?.businessType
          ),
          sourceK1Type: extracted.scheduleK1?.businessType ?? 'partnership',
          ordinaryBusinessIncome: extracted.scheduleK1?.ordinaryBusinessIncome,
          rentalIncome: extracted.scheduleK1?.rentalRealEstateIncome,
          otherNetRentalIncome: extracted.scheduleK1?.otherRentalIncome,
          royalties: extracted.scheduleK1?.royalties,
          interestIncome: extracted.scheduleK1?.interestIncome,
          guaranteedPayments: extracted.scheduleK1?.guaranteedPayments,
          section199AQBI: extracted.scheduleK1?.section199AQBI,
          section199AW2Wages: extracted.scheduleK1?.section199AW2Wages,
          section199AUbia: extracted.scheduleK1?.section199AUbia,
          isPassive: true,
          sourceDocumentId: documentId,
          sourceDocumentName: documentName,
          extractionConfidence: extracted.confidence
        }
      }]
    }
    default:
      return []
  }
}

const mergeImportedEntityData = (
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> => {
  const merged: Record<string, unknown> = { ...existing }
  const nonAdditiveNumberKeys = new Set([
    'coveredPersons',
    'coverageFamily',
    'sharedAllocationPct',
    'sharedPolicyAllocation',
    'qualifiedExpenses',
    'tuitionAmount',
    'scholarshipsReceived',
    'priorYearAdjustment',
    'booksAndMaterials',
    'paymentsReceived',
    'form1098TQualifiedExpenses',
    'form1098TScholarships',
    'form1098TPriorYearAdjustment',
    'tuitionLedgerQualifiedExpenses',
    'tuitionLedgerBooksAndMaterials',
    'tuitionLedgerScholarships',
    'tuitionLedgerPaymentsReceived',
    'shortTermProceeds',
    'shortTermCostBasis',
    'longTermProceeds',
    'longTermCostBasis',
    'proceeds',
    'costBasis',
    'interestPaid',
    'studentLoanInterest',
    'annualEnrollmentPremium',
    'annualSLCSP',
    'annualAPTC',
    'annualAdvancePayment'
  ])
  const maxNumberKeys = new Set(['extractionConfidence'])

  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue
    const current = merged[key]

    if (Array.isArray(current) || Array.isArray(value)) {
      const currentArray = Array.isArray(current) ? current : []
      const nextArray = Array.isArray(value) ? value : []
      const seen = new Set<string>()
      merged[key] = [...currentArray, ...nextArray].filter((entry) => {
        const fingerprint =
          typeof entry === 'string'
            ? entry
            : JSON.stringify(entry ?? null)
        if (seen.has(fingerprint)) {
          return false
        }
        seen.add(fingerprint)
        return true
      })
      continue
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      const currentNumber =
        typeof current === 'number' && Number.isFinite(current) ? current : 0
      if (maxNumberKeys.has(key)) {
        merged[key] = Math.max(currentNumber, value)
        continue
      }
      if (nonAdditiveNumberKeys.has(key)) {
        merged[key] = value || currentNumber
        continue
      }
      merged[key] = currentNumber + value
      continue
    }

    if (typeof value === 'boolean') {
      merged[key] = Boolean(current) || value
      continue
    }

    if (typeof value === 'string') {
      merged[key] = value || (typeof current === 'string' ? current : '')
      continue
    }

    if (
      value &&
      typeof value === 'object' &&
      current &&
      typeof current === 'object' &&
      !Array.isArray(value) &&
      !Array.isArray(current)
    ) {
      merged[key] = mergeImportedEntityData(
        current as Record<string, unknown>,
        value as Record<string, unknown>
      )
      continue
    }

    merged[key] = value
  }

  const hasEducationSourceAmounts =
    [
      merged.form1098TQualifiedExpenses,
      merged.form1098TScholarships,
      merged.form1098TPriorYearAdjustment,
      merged.tuitionLedgerQualifiedExpenses,
      merged.tuitionLedgerBooksAndMaterials,
      merged.tuitionLedgerScholarships,
      merged.tuitionLedgerPaymentsReceived
    ].some((value) => value !== undefined)

  if (hasEducationSourceAmounts) {
    const form1098TQualifiedExpenses = toMoney(merged.form1098TQualifiedExpenses)
    const tuitionLedgerQualifiedExpenses = toMoney(
      merged.tuitionLedgerQualifiedExpenses
    )
    const tuitionLedgerBooksAndMaterials = toMoney(
      merged.tuitionLedgerBooksAndMaterials
    )
    merged.qualifiedExpenses = Math.max(
      form1098TQualifiedExpenses,
      tuitionLedgerQualifiedExpenses + tuitionLedgerBooksAndMaterials,
      toMoney(merged.qualifiedExpenses)
    )
    merged.booksAndMaterials = Math.max(
      tuitionLedgerBooksAndMaterials,
      toMoney(merged.booksAndMaterials)
    )
    merged.scholarshipsReceived = Math.max(
      toMoney(merged.form1098TScholarships),
      toMoney(merged.tuitionLedgerScholarships),
      toMoney(merged.scholarshipsReceived)
    )
    merged.priorYearAdjustment = Math.max(
      toMoney(merged.form1098TPriorYearAdjustment),
      toMoney(merged.priorYearAdjustment)
    )
    merged.paymentsReceived = Math.max(
      toMoney(merged.tuitionLedgerPaymentsReceived),
      toMoney(merged.paymentsReceived)
    )
  }

  return merged
}

const sumRecordValues = (record: Record<string, unknown>): number =>
  Object.values(record).reduce<number>((sum, value) => sum + toMoney(value), 0)

const getQBIWorksheetEntities = (snapshot: FilingSessionSnapshot) =>
  asArray<Record<string, unknown>>(
    requireScreen(snapshot, '/qbi-worksheet').entities
  ).map((entity) => ({
    id: toText(entity.id) || crypto.randomUUID(),
    name: toText(entity.name),
    type: toText(entity.type),
    netIncome: toMoney(entity.netIncome),
    w2Wages: toMoney(entity.w2Wages),
    ubia: toMoney(entity.ubia),
    isSSTB: Boolean(entity.isSSTB),
    patronReduction: toMoney(
      entity.patronReduction ?? entity.qbiPatronReduction
    ),
    aggregationGroup: toText(entity.aggregationGroup),
    hasAggregationElection: Boolean(entity.hasAggregationElection),
    isCooperative: Boolean(
      entity.isCooperative ?? entity.isAgriculturalOrHorticulturalCooperative
    ),
    qbiAmount: toMoney(entity.qbiAmount),
    w2Limitation: toMoney(entity.w2Limitation),
    finalDeduction: toMoney(entity.finalDeduction),
    status: toText(entity.status) || 'not_started',
    warnings: asArray<string>(entity.warnings),
    isComplete: toText(entity.status) === 'complete'
  }))

const getQbiDeductionData = (snapshot: FilingSessionSnapshot) => {
  const screen = requireScreen(snapshot, '/qbi-worksheet')
  const data = asRecord(screen.qbiDeductionData)
  const fallbackMoney = (key: string) => toMoney(screen[key])

  const qbiDeductionData = {
    priorYearQualifiedBusinessLossCarryforward: toMoney(
      data.priorYearQualifiedBusinessLossCarryforward ??
        fallbackMoney('priorYearQualifiedBusinessLossCarryforward')
    ),
    reitDividends: toMoney(
      data.reitDividends ?? fallbackMoney('reitDividends')
    ),
    ptpIncome: toMoney(data.ptpIncome ?? fallbackMoney('ptpIncome')),
    ptpLossCarryforward: toMoney(
      data.ptpLossCarryforward ?? fallbackMoney('ptpLossCarryforward')
    ),
    dpadReduction: toMoney(
      data.dpadReduction ?? fallbackMoney('dpadReduction')
    )
  }

  return Object.values(qbiDeductionData).some((value) => value !== 0)
    ? qbiDeductionData
    : undefined
}

const getBusinessRecords = (entities: SessionEntitySnapshot[]) =>
  entities
    .filter(
      (entity) =>
        entity.entityType === 'schedule_c' || entity.entityType === 'k1_entity'
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

      // Simplified home office deduction: $5/sq ft, max 300 sq ft = $1,500
      const homeOfficeDeduction =
        homeOffice && homeOfficeSqFt > 0 ? Math.min(homeOfficeSqFt, 300) * 5 : 0

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
        homeOfficeMethod: toText(data.homeOfficeMethod ?? 'simplified'),
        homeOfficePct,
        homeOfficeSqFt,
        homeSqFt,
        homeOfficeMortgageInterest: toMoney(
          data.homeOfficeMortgageInterest ?? 0
        ),
        homeOfficeRealEstateTaxes: toMoney(data.homeOfficeRealEstateTaxes ?? 0),
        homeOfficeInsurance: toMoney(data.homeOfficeInsurance ?? 0),
        homeOfficeUtilities: toMoney(data.homeOfficeUtilities ?? 0),
        homeOfficeRepairs: toMoney(data.homeOfficeRepairs ?? 0),
        homeOfficeOther: toMoney(data.homeOfficeOther ?? 0),
        homeOfficeHomeValue: toMoney(data.homeOfficeHomeValue ?? 0),
        homeOfficeLandValue: toMoney(data.homeOfficeLandValue ?? 0),
        homeOfficePurchaseDate: toText(data.homeOfficePurchaseDate ?? ''),
        homeOfficePriorDepreciation: toMoney(
          data.homeOfficePriorDepreciation ?? 0
        ),
        homeOfficeDeduction,
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

const getK1Records = (entities: SessionEntitySnapshot[]) =>
  entities
    .filter((entity) => entity.entityType === 'k1_entity')
    .map((entity) => {
      const data = asRecord(entity.data)
      const normalizedBusinessType = normalizeK1BusinessType(data.businessType)
      return {
        id: entity.id,
        partnershipName: toText(data.name ?? data.entityName ?? entity.label),
        partnershipEin: toText(data.ein),
        partnerOrSCorp:
          normalizedBusinessType === 'k1-scorp'
            ? 'S'
            : 'P',
        k1Category:
          normalizedBusinessType === 'k1-scorp'
            ? 's_corp'
            : normalizedBusinessType === 'k1-trust'
            ? 'trust'
            : 'partnership',
        businessType: normalizedBusinessType,
        isForeign: Boolean(data.isForeign),
        isPassive: Boolean(data.isPassive ?? true),
        ordinaryBusinessIncome: toMoney(
          data.ordinaryBusinessIncome ?? data.ordinaryIncome ?? data.k1Box1
        ),
        netRentalRealEstateIncome: toMoney(
          data.netRentalRealEstateIncome ?? data.rentalIncome ?? data.k1Box2
        ),
        otherNetRentalIncome: toMoney(data.otherNetRentalIncome),
        royalties: toMoney(data.royalties ?? data.k1Box3),
        interestIncome: toMoney(data.interestIncome ?? data.k1Box4),
        guaranteedPaymentsForServices: toMoney(
          data.guaranteedPaymentsForServices ?? data.guaranteedPayments
        ),
        guaranteedPaymentsForCapital: toMoney(
          data.guaranteedPaymentsForCapital
        ),
        selfEmploymentEarningsA: toMoney(
          data.selfEmploymentEarningsA ??
            data.seEarnings ??
            data.selfEmploymentEarnings
        ),
        selfEmploymentEarningsB: toMoney(data.selfEmploymentEarningsB),
        selfEmploymentEarningsC: toMoney(data.selfEmploymentEarningsC),
        distributionsCodeAAmount: toMoney(data.distributionsCodeAAmount),
        section199AQBI: toMoney(data.section199AQBI ?? data.qbiIncome),
        section199AW2Wages: toMoney(
          data.section199AW2Wages ?? data.qbiWages
        ),
        section199AUbia: toMoney(data.section199AUbia ?? data.qbiProperty),
        section199APatronReduction: toMoney(
          data.section199APatronReduction ?? data.qbiPatronReduction
        ),
        isSpecifiedServiceTradeOrBusiness: Boolean(
          data.isSpecifiedServiceTradeOrBusiness ?? data.isSSTB ?? false
        ),
        priorYearUnallowedLoss: toMoney(
          data.priorYearUnallowedLoss ?? data.passiveLossCarryover
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
    scheduleCCount: businessRecords.filter(
      (record) => record.entityType === 'schedule_c'
    ).length,
    k1Count: businessRecords.filter(
      (record) => record.entityType === 'k1_entity'
    ).length,
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
    qbiEligibleCount: businessRecords.filter((record) => record.qbiEligible)
      .length,
    qbiThreshold: threshold,
    qbiBaseIncome,
    qbiTentativeDeduction: tentativeQBIDeduction,
    qbiWorksheetCount: qbiWorksheetEntities.length,
    qbiWorksheetDeduction,
    finalQBIDeduction:
      qbiWorksheetEntities.length > 0
        ? qbiWorksheetDeduction
        : tentativeQBIDeduction,
    sstbCount: qbiWorksheetEntities.filter((entity) => entity.isSSTB).length,
    wageLimitedCount: qbiWorksheetEntities.filter(
      (entity) => entity.w2Limitation > 0
    ).length,
    homeOfficeCount: businessRecords.filter((record) => record.homeOffice)
      .length,
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

const getQbiDetail = (
  snapshot: FilingSessionSnapshot,
  qbiWorksheetEntities: ReturnType<typeof getQBIWorksheetEntities>,
  qbiDeductionData?: ReturnType<typeof getQbiDeductionData>
) => {
  const filingStatus = toText(snapshot.filingStatus || 'single')
  const thresholdStart = qbiThresholdForStatus(filingStatus)
  const thresholdRange =
    filingStatus === 'mfj' || filingStatus === 'w' ? 100000 : 50000
  const visibleEntities = qbiWorksheetEntities.slice(0, 3)
  const overflowEntities = qbiWorksheetEntities.slice(3)
  const overflowTotals = overflowEntities.reduce(
    (totals, entity) => ({
      qbiAmount: totals.qbiAmount + entity.qbiAmount,
      w2Wages: totals.w2Wages + entity.w2Wages,
      ubia: totals.ubia + entity.ubia,
      w2Limitation: totals.w2Limitation + entity.w2Limitation,
      finalDeduction: totals.finalDeduction + entity.finalDeduction
    }),
    {
      qbiAmount: 0,
      w2Wages: 0,
      ubia: 0,
      w2Limitation: 0,
      finalDeduction: 0
    }
  )
  const carryforwards = qbiDeductionData ?? {
    priorYearQualifiedBusinessLossCarryforward: 0,
    reitDividends: 0,
    ptpIncome: 0,
    ptpLossCarryforward: 0,
    dpadReduction: 0
  }
  const overflowStatementEntries = overflowEntities.map((entity, index) => {
    const patronReduction = toMoney(entity.patronReduction)
    const tentativeDeduction = toMoney(entity.qbiAmount) * 0.2
    const deductionBeforePatronReduction = toMoney(entity.finalDeduction) + patronReduction
    return {
      ...entity,
      statementRowNumber: index + 1,
      statementSection: 'Form 8995-A additional statement',
      isAttachmentRow: true,
      patronReduction,
      tentativeDeduction,
      deductionBeforePatronReduction,
      limitationReduction: Math.max(
        0,
        tentativeDeduction - deductionBeforePatronReduction
      )
    }
  })
  const attachmentStatement = {
    required:
      overflowStatementEntries.length > 0 ||
      qbiWorksheetEntities.some((entity) => entity.isSSTB) ||
      Object.values(carryforwards).some((value) => toMoney(value) !== 0),
    statementTitle: 'Form 8995-A additional statement',
    visibleBusinessCount: visibleEntities.length,
    overflowBusinessCount: overflowEntities.length,
    totalBusinessCount: qbiWorksheetEntities.length,
    aggregationElectionCount: qbiWorksheetEntities.filter(
      (entity) => entity.hasAggregationElection
    ).length,
    cooperativeCount: qbiWorksheetEntities.filter((entity) => entity.isCooperative)
      .length,
    thresholdStart,
    thresholdEnd: thresholdStart + thresholdRange,
    overflowTotals,
    carryforwards,
    overflowStatementDeduction: overflowStatementEntries.reduce(
      (sum, entry) => sum + toMoney(entry.finalDeduction),
      0
    ),
    overflowStatementEntries
  }

  return {
    filingStatus,
    thresholdStart,
    thresholdEnd: thresholdStart + thresholdRange,
    formPreference:
      qbiWorksheetEntities.length > 3 ||
      qbiWorksheetEntities.some(
        (entity) => entity.isSSTB || entity.w2Wages > 0 || entity.ubia > 0
      )
        ? '8995A'
        : '8995',
    visibleEntities,
    overflowEntities,
    overflowTotals,
    overflowStatementEntries,
    needsAdditionalStatement: overflowEntities.length > 0,
    additionalStatementDeduction: overflowTotals.finalDeduction,
    sstbCount: qbiWorksheetEntities.filter((entity) => entity.isSSTB).length,
    wageLimitedCount: qbiWorksheetEntities.filter(
      (entity) => entity.w2Limitation > 0
    ).length,
    carryforwards,
    attachmentStatement
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
        daysPersonalUse > 14 &&
        daysRented > 0 &&
        daysPersonalUse > daysRented * 0.1
      const rentalUseRatio =
        daysRented + daysPersonalUse > 0
          ? daysRented / (daysRented + daysPersonalUse)
          : 1
      const deductibleExpenses = vacationHome
        ? Math.min(
            grossRents,
            (expenseTotal + estimatedDepreciation) * rentalUseRatio
          )
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
        activeParticipation: Boolean(data.activeParticipation ?? false),
        passiveLossCarryover: toMoney(data.passiveLossCarryover),
        priorYearPassiveLossCarryover: toMoney(
          data.priorYearPassiveLossCarryover ?? data.passiveLossCarryover
        ),
        isComplete: Boolean(
          (data.address ?? entity.label) &&
            (grossRents || expenseTotal || daysRented || daysPersonalUse)
        )
      }
    })

const getRentalSummary = (
  rentalProperties: ReturnType<typeof getRentalProperties>,
  k1Records: ReturnType<typeof getK1Records>
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
  vacationHomeCount: rentalProperties.filter(
    (property) => property.vacationHome
  ).length,
  passivePropertyCount: rentalProperties.filter(
    (property) => property.isPassive
  ).length,
  passiveLossCarryoverTotal: rentalProperties.reduce(
    (sum, property) => sum + property.passiveLossCarryover,
    0
  ),
  k1Count: k1Records.length,
  k1RentalIncomeTotal: k1Records.reduce(
    (sum, record) =>
      sum +
      toMoney(record.netRentalRealEstateIncome) +
      toMoney(record.otherNetRentalIncome),
    0
  ),
  k1RoyaltyIncomeTotal: k1Records.reduce(
    (sum, record) => sum + toMoney(record.royalties),
    0
  ),
  scheduleEPage2NetIncome: k1Records.reduce(
    (sum, record) =>
      sum +
      toMoney(record.ordinaryBusinessIncome) +
      toMoney(record.netRentalRealEstateIncome) +
      toMoney(record.otherNetRentalIncome) +
      toMoney(record.royalties) +
      toMoney(record.guaranteedPaymentsForServices) +
      toMoney(record.guaranteedPaymentsForCapital),
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
      country: toText(
        entity.data.foreignCountry ?? entity.data.country ?? entity.label
      ),
      foreignEarnedIncome: toMoney(
        entity.data.foreignEarnedIncome ?? entity.data.amount
      ),
      exclusionMethod: toText(entity.data.exclusionMethod || 'bona-fide'),
      daysAbroad: toMoney(entity.data.daysAbroad),
      foreignTaxPaid: toMoney(entity.data.foreignTaxPaid),
      foreignTaxCountry: toText(entity.data.foreignTaxCountry),
      isComplete: Boolean(
        (entity.data.foreignCountry ?? entity.data.country ?? entity.label) &&
          (entity.data.foreignEarnedIncome ??
            entity.data.amount ??
            entity.data.foreignTaxPaid)
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
            fatcaRequired:
              toMoney(form.foreignAccountBalance) > FATCA_SINGLE_THRESHOLD,
            isComplete: Boolean(
              form.foreignCountry && form.foreignAccountBalance
            )
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
          toMoney(
            entity.data.maxBalanceUSD ?? entity.data.foreignAccountBalance
          ) > FBAR_THRESHOLD
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
  const foreignIncome = asRecord(
    requireScreen(snapshot, '/foreign-income').form
  )
  const nonresident = requireScreen(snapshot, '/nonresident')
  const screenClaims =
    foreignIncome.treatyCountry ||
    (nonresident.hasTreaty === true && nonresident.treatyCountry)
      ? [
          {
            id: 'treaty-claim-primary',
            country: toText(
              nonresident.treatyCountry || foreignIncome.treatyCountry
            ),
            articleNumber: toText(nonresident.treatyArticle),
            incomeType: toText(nonresident.treatyBenefit || 'Treaty benefit'),
            exemptAmount: 0,
            reducedTreatyRate: toMoney(nonresident.reducedTreatyRate),
            confirmed: true,
            isComplete: Boolean(
              nonresident.treatyCountry || foreignIncome.treatyCountry
            )
          }
        ]
      : []

  const entityClaims = entities
    .filter((entity) => entity.entityType === 'treaty_claim')
    .map((entity) => ({
      id: entity.id,
      country: toText(
        entity.data.country ?? entity.data.treatyCountry ?? entity.label
      ),
      articleNumber: toText(
        entity.data.articleNumber ?? entity.data.treatyArticle
      ),
      incomeType: toText(entity.data.incomeType ?? entity.data.treatyBenefit),
      exemptAmount: toMoney(entity.data.exemptAmount),
      reducedTreatyRate: toMoney(
        entity.data.reducedTreatyRate ??
          entity.data.reducedRate ??
          entity.data.treatyRate
      ),
      confirmed: Boolean(entity.data.confirmed ?? true),
      isComplete: Boolean(
        (entity.data.country ?? entity.data.treatyCountry ?? entity.label) &&
          (entity.data.articleNumber ??
            entity.data.treatyArticle ??
            entity.data.treatyBenefit)
      )
    }))

  return mergeCollectionById(screenClaims, entityClaims)
}

const getNonresidentProfile = (snapshot: FilingSessionSnapshot) => {
  const data = requireScreen(snapshot, '/nonresident')
  const daysInUS2024 = toMoney(data.daysInUS2024)
  const daysInUS2023 = toMoney(data.daysInUS2023)
  const daysInUS2022 = toMoney(data.daysInUS2022)
  const sptScore =
    daysInUS2024 + Math.floor(daysInUS2023 / 3) + Math.floor(daysInUS2022 / 6)
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
  const parseBox12 = (value: unknown) => {
    const result: Record<string, number> = {}

    const entries = asArray<Record<string, unknown>>(value)
    if (entries.length > 0) {
      for (const entry of entries) {
        const code = toText(entry.code).toUpperCase()
        const amount = toMoney(entry.amount)
        if (code && amount > 0) {
          result[code] = amount
        }
      }
    } else {
      for (const [rawCode, rawAmount] of Object.entries(asRecord(value))) {
        const code = rawCode.toUpperCase()
        const amount = toMoney(rawAmount)
        if (code && amount > 0) {
          result[code] = amount
        }
      }
    }

    return Object.keys(result).length > 0 ? result : undefined
  }

  const screenW2 = asArray<Record<string, unknown>>(
    requireScreen(snapshot, '/w2').w2s
  ).map((record) => ({
    id: toText(record.id) || crypto.randomUUID(),
    employerName: toText(record.employerName),
    ein: toText(record.ein),
    box1Wages: toMoney(record.box1),
    box2FederalWithheld: toMoney(record.box2),
    socialSecurityWages: toMoney(record.box3),
    socialSecurityWithheld: toMoney(record.box4),
    medicareWages: toMoney(record.box5),
    medicareWithheld: toMoney(record.box6),
    box12Code: toText(record.box12aCode),
    box12Amount: toMoney(record.box12a),
    box12:
      parseBox12(record.box12Codes) ??
      parseBox12(record.box12) ??
      (toText(record.box12aCode) && toMoney(record.box12a) > 0
        ? {
            [toText(record.box12aCode).toUpperCase()]: toMoney(record.box12a)
          }
        : undefined),
    stateWages: toMoney(record.box16),
    stateWithheld: toMoney(record.box17),
    owner: toText(record.owner) || 'taxpayer',
    isComplete: Boolean(record.employerName && record.ein && record.box1)
  }))

  const entityW2 = entities
    .filter((entity) => entity.entityType === 'w2')
    .map((entity) => {
      const d = entity.data
      const wages = toMoney(d.box1Wages ?? d.box1 ?? d.wages)
      const fedWithheld = toMoney(
        d.box2FederalWithheld ?? d.box2 ?? d.federalWithholding
      )
      const stWages = toMoney(d.stateWages ?? d.box16 ?? d.stateIncome)
      const stWithheld = toMoney(
        d.stateWithheld ?? d.box17 ?? d.stateWithholding
      )
      const employer = toText(d.employerName ?? d.employer)
      return {
        id: entity.id,
        employerName: employer,
        ein: toText(d.ein),
        box1Wages: wages,
        box2FederalWithheld: fedWithheld,
        socialSecurityWages: toMoney(d.socialSecurityWages ?? d.box3),
        socialSecurityWithheld: toMoney(d.socialSecurityWithheld ?? d.box4),
        medicareWages: toMoney(d.medicareWages ?? d.box5),
        medicareWithheld: toMoney(d.medicareWithheld ?? d.box6),
        box12Code: toText(d.box12Code ?? d.box12aCode) || '',
        box12Amount: toMoney(d.box12Amount ?? d.box12a),
        box12:
          parseBox12(d.box12Codes) ??
          parseBox12(d.box12) ??
          ((toText(d.box12Code ?? d.box12aCode) || '') &&
          toMoney(d.box12Amount ?? d.box12a) > 0
            ? {
                [toText(d.box12Code ?? d.box12aCode).toUpperCase()]:
                  toMoney(d.box12Amount ?? d.box12a)
              }
            : undefined),
        stateWages: stWages,
        stateWithheld: stWithheld,
        owner: toText(d.owner) || 'taxpayer',
        isComplete: Boolean(employer && d.ein && wages > 0)
      }
    })

  return mergeCollectionById(screenW2, entityW2)
}

const getW2Box12UncollectedTaxTotal = (w2Records: Record<string, unknown>[]) =>
  w2Records.reduce((sum, record) => {
    const box12 = asRecord(record.box12)
    return (
      sum +
      toMoney(box12.A) +
      toMoney(box12.B) +
      toMoney(box12.M) +
      toMoney(box12.N)
    )
  }, 0)

const get1099Records = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const normalize1099BTransactions = (value: unknown) =>
    asArray<Record<string, unknown>>(value)
      .map((transaction) => {
        const term = toText(
          transaction.term ??
            transaction.shortTermLongTerm ??
            transaction.holdingPeriod
        ).toLowerCase()

        return {
          description: toText(transaction.description ?? transaction.security),
          dateAcquired: toText(
            transaction.dateAcquired ?? transaction.acquired ?? ''
          ),
          dateSold: toText(transaction.dateSold ?? transaction.sold ?? ''),
          proceeds: toMoney(transaction.proceeds),
          costBasis: toMoney(
            transaction.costBasis ?? transaction.basis ?? transaction.cost
          ),
          washSaleLossDisallowed: toMoney(
            transaction.washSaleLossDisallowed ?? transaction.washSale ?? 0
          ),
          federalTaxWithheld: toMoney(
            transaction.federalTaxWithheld ?? transaction.withholding ?? 0
          ),
          term:
            term.startsWith('s')
              ? 'short'
              : term.startsWith('l')
              ? 'long'
              : 'unknown'
        }
      })
      .filter(
        (transaction) =>
          transaction.proceeds > 0 ||
          transaction.costBasis > 0 ||
          transaction.washSaleLossDisallowed > 0
      )

  const build1099Record = (record: Record<string, unknown>) => {
    const rawAmounts = asRecord(record.amounts)
    const transactions = normalize1099BTransactions(
      record.transactions ?? rawAmounts.transactions
    )
    const type = toText(record.type)
    const normalizedType = type.toUpperCase()
    const shortTermProceeds =
      transactions
        .filter((transaction) => transaction.term === 'short')
        .reduce((sum, transaction) => sum + transaction.proceeds, 0) ||
      toMoney(rawAmounts.shortTermProceeds ?? record.shortTermProceeds)
    const shortTermCostBasis =
      transactions
        .filter((transaction) => transaction.term === 'short')
        .reduce((sum, transaction) => sum + transaction.costBasis, 0) ||
      toMoney(
        rawAmounts.shortTermCostBasis ??
          record.shortTermCostBasis ??
          rawAmounts.shortTermBasis
      )
    const longTermProceeds =
      transactions
        .filter((transaction) => transaction.term === 'long')
        .reduce((sum, transaction) => sum + transaction.proceeds, 0) ||
      toMoney(rawAmounts.longTermProceeds ?? record.longTermProceeds)
    const longTermCostBasis =
      transactions
        .filter((transaction) => transaction.term === 'long')
        .reduce((sum, transaction) => sum + transaction.costBasis, 0) ||
      toMoney(
        rawAmounts.longTermCostBasis ??
          record.longTermCostBasis ??
          rawAmounts.longTermBasis
      )
    const ordinaryDividends = toMoney(
      rawAmounts.ordinaryDividends ??
        rawAmounts.dividends ??
        rawAmounts.amount ??
        record.ordinaryDividends ??
        record.dividends ??
        record.amount
    )
    const qualifiedDividends = toMoney(
      rawAmounts.qualifiedDividends ??
        record.qualifiedDividends ??
        record.box1b
    )
    const taxExemptInterest = toMoney(
      rawAmounts.taxExemptInterest ??
        record.taxExemptInterest ??
        record.box8
    )
    const capitalGainDistributions = toMoney(
      rawAmounts.capitalGainDistributions ??
        rawAmounts.totalCapitalGainsDistributions ??
        record.capitalGainDistributions ??
        record.totalCapitalGainsDistributions ??
        record.box2a
    )
    const exemptInterestDividends = toMoney(
      rawAmounts.exemptInterestDividends ??
        record.exemptInterestDividends ??
        record.box12
    )
    const section199ADividends = toMoney(
      rawAmounts.section199ADividends ??
        record.section199ADividends ??
        record.box5
    )
    const foreignTaxPaid = toMoney(
      rawAmounts.foreignTaxPaid ??
        record.foreignTaxPaid ??
        record.box6 ??
        record.box7
    )
    const rents = toMoney(rawAmounts.rents ?? record.rents ?? record.box1)
    const royalties = toMoney(
      rawAmounts.royalties ?? record.royalties ?? record.box2
    )
    const otherIncome = toMoney(
      rawAmounts.otherIncome ?? record.otherIncome ?? record.box3
    )
    const section409ADeferrals = toMoney(
      rawAmounts.section409ADeferrals ??
        record.section409ADeferrals ??
        record.box12
    )
    const nonqualifiedDeferredComp = toMoney(
      rawAmounts.nonqualifiedDeferredComp ??
        record.nonqualifiedDeferredComp ??
        record.box15
    )
    const scalarAmount = toMoney(rawAmounts.amount ?? record.amount)
    const amount =
      normalizedType === '1099-DIV' || normalizedType === 'DIV'
        ? ordinaryDividends
        : normalizedType === '1099-B' || normalizedType === 'B'
        ? shortTermProceeds + longTermProceeds || scalarAmount
        : normalizedType === '1099-MISC' || normalizedType === 'MISC'
        ? rents + royalties + otherIncome || scalarAmount
        : scalarAmount
    // 1099-B gross proceeds are useful for detail review, but they should not
    // inflate generic "total 1099 income" summaries that are meant to reflect
    // income-like amounts rather than brokerage turnover.
    const summaryAmount =
      normalizedType === '1099-B' || normalizedType === 'B' ? 0 : amount

    return {
      id: toText(record.id) || crypto.randomUUID(),
      type,
      payer: toText(record.payer ?? record.payerName),
      amount,
      summaryAmount,
      federalWithheld: toMoney(
        record.federalWithheld ??
          rawAmounts.federalWithheld ??
          record.federalTaxWithheld
      ),
      stateWithheld: toMoney(
        record.stateWithheld ??
          rawAmounts.stateWithheld ??
          record.stateTaxWithheld
      ),
      notes: toText(record.notes),
      owner: toText(record.owner) || 'taxpayer',
      taxExemptInterest,
      qualifiedDividends,
      capitalGainDistributions,
      exemptInterestDividends,
      section199ADividends,
      foreignTaxPaid,
      rents,
      royalties,
      otherIncome,
      section409ADeferrals,
      nonqualifiedDeferredComp,
      shortTermProceeds,
      shortTermCostBasis,
      longTermProceeds,
      longTermCostBasis,
      transactions,
      isComplete: Boolean(
        (record.type || record.payer || record.payerName) &&
          ((normalizedType === '1099-B' || normalizedType === 'B'
            ? shortTermProceeds + longTermProceeds
            : amount) ||
            record.federalWithheld ||
            record.stateWithheld)
      )
    }
  }

  const screen1099 = asArray<Record<string, unknown>>(
    requireScreen(snapshot, '/1099').records
  ).map(build1099Record)

  const entity1099 = entities
    .filter((entity) => FORM_1099_TYPES.has(entity.entityType))
    .map((entity) =>
      build1099Record({
        id: entity.id,
        type: entity.entityType.replace('_', '-').toUpperCase(),
        payer: entity.data.payerName ?? entity.data.payer,
        payerName: entity.data.payerName,
        amounts: entity.data.amounts,
        amount: entity.data.amount,
        federalWithheld:
          entity.data.federalWithheld ?? entity.data.federalTaxWithheld,
        stateWithheld: entity.data.stateWithheld,
        notes: entity.data.notes,
        owner: entity.data.owner,
        qualifiedDividends: entity.data.qualifiedDividends,
        capitalGainDistributions:
          entity.data.capitalGainDistributions ??
          entity.data.totalCapitalGainsDistributions,
        section199ADividends: entity.data.section199ADividends,
        rents: entity.data.rents,
        royalties: entity.data.royalties,
        otherIncome: entity.data.otherIncome,
        section409ADeferrals: entity.data.section409ADeferrals,
        nonqualifiedDeferredComp: entity.data.nonqualifiedDeferredComp,
        shortTermProceeds: entity.data.shortTermProceeds,
        shortTermCostBasis: entity.data.shortTermCostBasis,
        longTermProceeds: entity.data.longTermProceeds,
        longTermCostBasis: entity.data.longTermCostBasis,
        transactions: entity.data.transactions
      })
    )

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
      name: `${toText(entity.data.firstName)} ${toText(
        entity.data.lastName
      )}`.trim(),
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
      spouseData.spouseDeceased ??
        spouseData.deceased ??
        spouseScreen.spouseDeceased
    ),
    isComplete: Boolean(
      spouseData.firstName &&
        spouseData.lastName &&
        spouseData.dob &&
        (spouseData.spouseDeceased || spouseData.deceased || spouseData.ssn)
    )
  }
}

const parseDateInput = (value: unknown) => {
  const text = toText(value)
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

const isAgeAtLeastByYearEnd = (
  value: unknown,
  minimumAge: number,
  taxYear: number
) => {
  const dateOfBirth = parseDateInput(value)
  if (!dateOfBirth) return false

  const yearEnd = new Date(Date.UTC(taxYear, 11, 31))
  let age = yearEnd.getUTCFullYear() - dateOfBirth.getUTCFullYear()
  const hasBirthdayPassed =
    yearEnd.getUTCMonth() > dateOfBirth.getUTCMonth() ||
    (yearEnd.getUTCMonth() === dateOfBirth.getUTCMonth() &&
      yearEnd.getUTCDate() >= dateOfBirth.getUTCDate())
  if (!hasBirthdayPassed) {
    age -= 1
  }
  return age >= minimumAge
}

const get1040SrEligibility = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const taxpayer = requireScreen(snapshot, '/taxpayer-profile')
  const spouse = getSpouse(snapshot, entities)
  const primaryEligible = isAgeAtLeastByYearEnd(taxpayer.dob, 65, snapshot.taxYear)
  const spouseEligible =
    spouse !== null && isAgeAtLeastByYearEnd(spouse.dob, 65, snapshot.taxYear)
  return {
    primaryEligible,
    spouseEligible,
    eligibleFilerCount: Number(primaryEligible) + Number(spouseEligible),
    taxpayerDobKnown: Boolean(parseDateInput(taxpayer.dob)),
    spouseDobKnown: spouse ? Boolean(parseDateInput(spouse.dob)) : true
  }
}

const calcSchedule1APhaseoutDeduction = (
  amount: number,
  agi: number,
  isMFJ: boolean,
  cap: number,
  thresholdSingle: number,
  thresholdMFJ: number,
  reductionPerThousand: number
) => {
  const capped = Math.min(amount, cap)
  const threshold = isMFJ ? thresholdMFJ : thresholdSingle
  if (agi <= threshold) return capped
  const excess = agi - threshold
  const reduction = Math.floor(excess / 1000) * reductionPerThousand
  return Math.max(0, capped - reduction)
}

const calcSchedule1ASeniorDeduction = (
  qualifyingSeniorCount: number,
  agi: number,
  isMFJ: boolean
) => {
  if (qualifyingSeniorCount <= 0) return 0
  const baseAmount = qualifyingSeniorCount * 6000
  const threshold = isMFJ ? 150000 : 75000
  if (agi <= threshold) return baseAmount
  return Math.max(0, baseAmount - (agi - threshold) * 0.06)
}

const getSchedule1AData = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[],
  authoritativeAgi?: number | null
) => {
  const screen = requireScreen(snapshot, '/schedule-1a')
  const entity = entities.find((e) => e.entityType === 'schedule_1a')
  const source = asRecord(entity?.data ?? screen)
  const taxpayer = requireScreen(snapshot, '/taxpayer-profile')
  const spouse = getSpouse(snapshot, entities)
  const isMFJ = snapshot.filingStatus === 'mfj'
  const enteredAgi =
    source.estimatedAGI != null && source.estimatedAGI !== ''
      ? toMoney(source.estimatedAGI)
      : undefined
  const agi = toMoney(authoritativeAgi ?? enteredAgi ?? 0)
  const tipAmount =
    toMoney(source.employeeTipAmount) + toMoney(source.selfEmployedTipAmount)
  const overtimeAmount = toMoney(source.overtimeAmount)
  const autoLoanInterestPaid = toMoney(source.autoLoanInterestPaid)
  const vehicleAssembledInUS =
    source.vehicleAssembledInUS === true ||
    source.vehicleAssembledInUS === 'yes'
  const vehiclePersonalUse =
    source.vehiclePersonalUse === true || source.vehiclePersonalUse === 'yes'
  const taxpayerSenior =
    isAgeAtLeastByYearEnd(taxpayer.dob, 65, snapshot.taxYear) ||
    source.taxpayerAge65 === true
  const spouseSenior =
    (spouse !== null &&
      isAgeAtLeastByYearEnd(spouse.dob, 65, snapshot.taxYear)) ||
    source.spouseAge65 === true
  const qualifyingSeniorCount = Number(taxpayerSenior) + Number(spouseSenior)
  const tipsDeduction =
    source.hasTips === true
      ? calcSchedule1APhaseoutDeduction(
          tipAmount,
          agi,
          isMFJ,
          25000,
          150000,
          300000,
          100
        )
      : 0
  const overtimeDeduction =
    source.hasOvertime === true
      ? calcSchedule1APhaseoutDeduction(
          overtimeAmount,
          agi,
          isMFJ,
          isMFJ ? 25000 : 12500,
          150000,
          300000,
          100
        )
      : 0
  const autoLoanDeduction =
    source.hasAutoLoan === true && vehicleAssembledInUS && vehiclePersonalUse
      ? calcSchedule1APhaseoutDeduction(
          autoLoanInterestPaid,
          agi,
          isMFJ,
          10000,
          100000,
          200000,
          200
        )
      : 0
  const seniorDeduction = calcSchedule1ASeniorDeduction(
    qualifyingSeniorCount,
    agi,
    isMFJ
  )
  const hasResponse =
    source.hasTips != null ||
    source.hasOvertime != null ||
    source.hasAutoLoan != null ||
    source.taxpayerAge65 != null ||
    source.spouseAge65 != null ||
    enteredAgi != null ||
    tipAmount > 0 ||
    overtimeAmount > 0 ||
    autoLoanInterestPaid > 0
  const isComplete =
    hasResponse &&
    (source.hasTips !== true || tipAmount > 0) &&
    (source.hasOvertime !== true || overtimeAmount > 0) &&
    (source.hasAutoLoan !== true ||
      (autoLoanInterestPaid > 0 &&
        source.vehicleAssembledInUS != null &&
        source.vehiclePersonalUse != null))

  return {
    hasResponse,
    isComplete,
    tipAmount,
    overtimeAmount,
    autoLoanInterestPaid,
    tipsDeduction,
    overtimeDeduction,
    autoLoanDeduction,
    seniorDeduction,
    totalDeduction:
      tipsDeduction + overtimeDeduction + autoLoanDeduction + seniorDeduction,
    qualifyingSeniorCount,
    isMFJ,
    agi
  }
}

const getUnemploymentRecords = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const screen = requireScreen(snapshot, '/unemployment-ss')
  const form = asRecord(screen.form)
  const screenRecords =
    screen.hasUnemployment === true ||
    form.unemploymentAmount ||
    form.unemploymentWithheld
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
      grossAmount: toMoney(
        entity.data.grossAmount ?? entity.data.ssGrossAmount
      ),
      federalWithheld: toMoney(
        entity.data.federalWithheld ?? entity.data.ssWithheld
      ),
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
      record.asset &&
        record.type &&
        record.acquired &&
        record.sold &&
        record.proceeds
    )
  }))

  const entityLots = entities
    .filter((entity) => entity.entityType === 'tax_lot')
    .map((entity) => ({
      id: entity.id,
      asset: toText(entity.data.security ?? entity.data.asset),
      securityType: toText(entity.data.securityType ?? entity.data.type),
      acquisitionDate: toText(
        entity.data.acquisitionDate ?? entity.data.acquired
      ),
      saleDate: toText(entity.data.saleDate ?? entity.data.sold),
      proceeds: toMoney(entity.data.proceeds),
      costBasis: toMoney(entity.data.costBasis ?? entity.data.basis),
      source: toText(entity.data.source ?? 'entity'),
      sourceBrokerName: toText(
        entity.data.sourceBrokerName ?? entity.data.payerName
      ),
      summaryOnly: Boolean(entity.data.summaryOnly),
      isComplete: Boolean(
        (entity.data.security ?? entity.data.asset) &&
          (entity.data.proceeds ?? entity.data.costBasis)
      )
    }))

  const brokersWithDetailedLots = new Set(
    entityLots
      .filter(
        (lot) =>
          lot.summaryOnly !== true &&
          lot.sourceBrokerName &&
          lot.source.startsWith('document_')
      )
      .map((lot) => normalizeMatchingText(lot.sourceBrokerName))
      .filter((value) => value.length > 0)
  )

  return mergeCollectionById(
    screenLots,
    entityLots.filter((lot) => {
      if (!lot.summaryOnly) return true
      const brokerKey = normalizeMatchingText(lot.sourceBrokerName)
      return !brokerKey || !brokersWithDetailedLots.has(brokerKey)
    })
  )
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
        new Date(lot.saleDate).getTime() -
          new Date(lot.acquisitionDate).getTime() >
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

  const eligibleCredits = credits.filter(
    (credit) => toText(credit.status) === 'eligible'
  )
  const maybeCredits = credits.filter(
    (credit) => toText(credit.status) === 'maybe'
  )
  const blockedCredits = credits.filter(
    (credit) => toText(credit.status) === 'blocked'
  )
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

// ── OBBBA 2025 data extraction ──────────────────────────────────────────────

const getObbbaData = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  // Extract from the /obbba screen data (set by the OBBBA provisions page)
  const obbbaScreen = requireScreen(snapshot, '/obbba')

  // Also check /income-workbench for backward compatibility
  const incomeScreen = requireScreen(snapshot, '/income-workbench')

  // ── Overtime income: screen data + entity records ──────────────────────────
  const screenOvertimeAmount = toMoney(
    obbbaScreen.overtimeAmount ?? incomeScreen.overtimeAmount
  )
  const screenOvertimeIncome =
    screenOvertimeAmount > 0
      ? {
          amount: screenOvertimeAmount,
          employerName: toText(
            obbbaScreen.overtimeEmployerName ??
              incomeScreen.overtimeEmployerName
          )
        }
      : undefined

  const entityOvertime = entities.find(
    (entity) => entity.entityType === 'obbba_overtime'
  )
  const entityOvertimeIncome = entityOvertime
    ? {
        amount: toMoney(
          entityOvertime.data.amount ?? entityOvertime.data.overtimeAmount
        ),
        employerName: toText(entityOvertime.data.employerName)
      }
    : undefined
  // Entity record takes priority when it has a nonzero amount
  let overtimeIncome =
    entityOvertimeIncome && entityOvertimeIncome.amount > 0
      ? entityOvertimeIncome
      : screenOvertimeIncome

  // ── Tip income: screen data + entity records ───────────────────────────────
  const screenTipAmount = toMoney(
    obbbaScreen.tipAmount ?? incomeScreen.tipAmount
  )
  const screenTipIncome =
    screenTipAmount > 0
      ? {
          amount: screenTipAmount,
          employerName: toText(
            obbbaScreen.tipEmployerName ?? incomeScreen.tipEmployerName
          )
        }
      : undefined

  const entityTip = entities.find(
    (entity) => entity.entityType === 'obbba_tips'
  )
  const entityTipIncome = entityTip
    ? {
        amount: toMoney(entityTip.data.amount ?? entityTip.data.tipAmount),
        employerName: toText(entityTip.data.employerName)
      }
    : undefined
  let tipIncome =
    entityTipIncome && entityTipIncome.amount > 0
      ? entityTipIncome
      : screenTipIncome

  // ── Auto loan interest: screen data + entity records ───────────────────────
  const screenAutoLoanAmount = toMoney(
    obbbaScreen.autoLoanInterestAmount ?? obbbaScreen.autoLoanInterest
  )
  const screenAutoLoanInterest =
    screenAutoLoanAmount > 0
      ? {
          amount: screenAutoLoanAmount,
          domesticManufacture:
            obbbaScreen.autoLoanDomesticManufacture !== false &&
            obbbaScreen.autoLoanDomesticManufacture !== 'no',
          lenderName: toText(obbbaScreen.autoLoanLenderName),
          vehicleMake: toText(obbbaScreen.autoLoanVehicleMake),
          vehicleModel: toText(obbbaScreen.autoLoanVehicleModel),
          vehicleYear: toMoney(obbbaScreen.autoLoanVehicleYear) || undefined
        }
      : undefined

  const entityAutoLoan = entities.find(
    (entity) => entity.entityType === 'obbba_auto_loan'
  )
  let entityAutoLoanInterest = entityAutoLoan
    ? {
        amount: toMoney(
          entityAutoLoan.data.amount ?? entityAutoLoan.data.interestPaid
        ),
        domesticManufacture:
          entityAutoLoan.data.domesticManufacture !== false &&
          entityAutoLoan.data.domesticManufacture !== 'no',
        lenderName: toText(entityAutoLoan.data.lenderName),
        vehicleMake: toText(entityAutoLoan.data.vehicleMake),
        vehicleModel: toText(entityAutoLoan.data.vehicleModel),
        vehicleYear: toMoney(entityAutoLoan.data.vehicleYear) || undefined
      }
    : undefined
  let autoLoanInterest =
    entityAutoLoanInterest && entityAutoLoanInterest.amount > 0
      ? entityAutoLoanInterest
      : screenAutoLoanInterest

  // ── Schedule 1-A entity (unified OBBBA page): fallback when obbba_* entities absent ─
  const schedule1AEntity = entities.find((e) => e.entityType === 'schedule_1a')
  const schedule1AScreen = requireScreen(snapshot, '/schedule-1a')
  if (schedule1AEntity?.data || Object.keys(schedule1AScreen).length > 0) {
    const d = (schedule1AEntity?.data ?? schedule1AScreen) as Record<
      string,
      unknown
    >
    const otAmt = toMoney(d.overtimeAmount ?? 0)
    const tipAmt =
      toMoney(d.employeeTipAmount ?? 0) + toMoney(d.selfEmployedTipAmount ?? 0)
    const autoAmt = toMoney(d.autoLoanInterestPaid ?? 0)
    const vehUS =
      d.vehicleAssembledInUS !== false && d.vehicleAssembledInUS !== 'no'
    const vehPersonal =
      d.vehiclePersonalUse !== false && d.vehiclePersonalUse !== 'no'
    if (otAmt > 0 && !overtimeIncome) {
      overtimeIncome = {
        amount: otAmt,
        employerName: toText(d.overtimeEmployerName ?? '')
      }
    }
    if (tipAmt > 0 && !tipIncome) {
      tipIncome = {
        amount: tipAmt,
        employerName: toText(d.tipEmployerName ?? '')
      }
    }
    if (autoAmt > 0 && vehUS && vehPersonal && !autoLoanInterest) {
      autoLoanInterest = {
        amount: autoAmt,
        domesticManufacture: true,
        lenderName: toText(d.autoLoanLenderName ?? ''),
        vehicleMake: toText(d.vehicleMake ?? ''),
        vehicleModel: toText(d.vehicleModel ?? ''),
        vehicleYear: toMoney(d.vehicleYear) || undefined
      }
    }
  }

  // ── Trump Savings Accounts: screen data array + entity records ─────────────
  const screenAccounts = asArray<Record<string, unknown>>(
    obbbaScreen.trumpSavingsAccounts
  ).map((a) => ({
    id: toText(a.id) || crypto.randomUUID(),
    beneficiaryName: toText(a.beneficiaryName),
    beneficiarySSN: toText(a.beneficiarySSN),
    beneficiaryDateOfBirth: toText(a.beneficiaryDateOfBirth),
    beneficiaryIsCitizen: a.beneficiaryIsCitizen !== false,
    contributionAmount: toMoney(a.contributionAmount),
    accountNumber: toText(a.accountNumber)
  }))

  const entityAccounts = entities
    .filter((entity) => entity.entityType === 'trump_savings_account')
    .map((entity) => ({
      id: entity.id,
      beneficiaryName: toText(entity.data.beneficiaryName),
      beneficiarySSN: toText(entity.data.beneficiarySSN),
      beneficiaryDateOfBirth: toText(entity.data.beneficiaryDateOfBirth),
      beneficiaryIsCitizen: entity.data.beneficiaryIsCitizen !== false,
      contributionAmount: toMoney(entity.data.contributionAmount),
      accountNumber: toText(entity.data.accountNumber)
    }))

  const allAccounts = mergeCollectionById(screenAccounts, entityAccounts)
  const trumpSavingsAccounts =
    allAccounts.length > 0
      ? allAccounts.map((a) => ({
          beneficiaryName: a.beneficiaryName,
          beneficiarySSN: a.beneficiarySSN,
          beneficiaryDateOfBirth: a.beneficiaryDateOfBirth,
          beneficiaryIsCitizen: a.beneficiaryIsCitizen,
          contributionAmount: a.contributionAmount,
          accountNumber: a.accountNumber
        }))
      : undefined

  return {
    overtimeIncome,
    tipIncome,
    autoLoanInterest,
    trumpSavingsAccounts
  }
}

/** Student loan interest (1098-E) from student_loan_interest entity or /student-loan screen */
const getStudentLoanData = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const screen = requireScreen(snapshot, '/student-loan')
  const entityRecords = entities
    .filter((entity) => entity.entityType === 'student_loan_interest')
    .map((entity) => {
      const d = asRecord(entity.data)
      const interest = toMoney(d.interestPaid ?? d.interest ?? 0)
      return interest > 0
        ? {
            id: entity.id,
            lender: toText(d.lenderName ?? 'Student Loan Servicer'),
            interest,
            interestPaid: interest
          }
        : null
    })
    .filter(
      (
        item
      ): item is {
        id: string
        lender: string
        interest: number
        interestPaid: number
      } => item !== null
    )

  if (entityRecords.length > 0) {
    return entityRecords
  }

  const d = asRecord(screen)
  const interest = toMoney(d.interestPaid ?? d.interest ?? 0)
  if (interest <= 0) return undefined
  return [
    {
      id: 'student-loan-interest-primary',
      lender: toText(d.lenderName ?? 'Student Loan Servicer'),
      interest,
      interestPaid: interest
    }
  ]
}

/** ACA marketplace insurance from aca_1095a entities or /marketplace-insurance screen */
const getMarketplaceInsuranceData = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const makeMonthly = (value: unknown) => {
    const array = asArray<unknown>(value)
    if (array.length === 12) {
      return array.map((item) => toMoney(item))
    }
    const scalar = toMoney(value)
    return Array(12).fill(Math.round((scalar / 12) * 100) / 100)
  }

  const mapRecord = (id: string, raw: Record<string, unknown>) => {
    const entryMode = toText(raw.entryMode).toLowerCase()
    const annualEnrollment = toMoney(
      raw.annualEnrollmentPremium ?? raw.enrollmentPremiums ?? raw.annualPremium
    )
    const annualSlcsp = toMoney(
      raw.annualSLCSP ?? raw.annualSlcsp ?? raw.slcsp ?? raw.secondLowestCostPlan
    )
    const annualAptc = toMoney(
      raw.annualAPTC ?? raw.annualAdvancePayment ?? raw.advancePayments
    )
    const monthlyEnrollment =
      entryMode === 'monthly'
        ? makeMonthly(raw.monthlyEnrollment)
        : makeMonthly(annualEnrollment)
    const monthlySlcsp =
      entryMode === 'monthly'
        ? makeMonthly(raw.monthlySLCSP ?? raw.monthlySlcsp)
        : makeMonthly(annualSlcsp)
    const monthlyAptc =
      entryMode === 'monthly'
        ? makeMonthly(raw.monthlyAPTC)
        : makeMonthly(annualAptc)

    const hasAnyValue =
      monthlyEnrollment.some((value) => value > 0) ||
      monthlySlcsp.some((value) => value > 0) ||
      monthlyAptc.some((value) => value > 0)

    if (!hasAnyValue) {
      return null
    }

    return {
      id,
      policyNumber: toText(raw.policyNumber),
      coverageStartDate: toText(
        raw.coverageStart ?? raw.coverageStartDate ?? `${snapshot.taxYear}-01-01`
      ),
      coverageEndDate: toText(
        raw.coverageEnd ?? raw.coverageEndDate ?? `${snapshot.taxYear}-12-31`
      ),
      enrollmentPremiums: monthlyEnrollment,
      slcsp: monthlySlcsp,
      advancePayments: monthlyAptc,
      coverageFamily: toMoney(raw.coveredPersons ?? raw.coverageFamily ?? 1),
      sharedPolicyAllocation: toMoney(
        raw.sharedAllocationPct ?? raw.sharedPolicyAllocation
      )
    }
  }

  const entityRecords = entities
    .filter((entity) => entity.entityType === 'aca_1095a')
    .map((entity) => mapRecord(entity.id, asRecord(entity.data)))
    .filter(
      (
        item
      ): item is {
        id: string
        policyNumber: string
        coverageStartDate: string
        coverageEndDate: string
        enrollmentPremiums: number[]
        slcsp: number[]
        advancePayments: number[]
        coverageFamily: number
        sharedPolicyAllocation: number
      } => item !== null
    )

  if (entityRecords.length > 0) {
    return entityRecords
  }

  const screen = requireScreen(snapshot, '/marketplace-insurance')
  const screenRecord = mapRecord('aca-primary', asRecord(screen))
  return screenRecord ? [screenRecord] : undefined
}

/** Dependent care providers and expenses from care_provider entities or /education-care screen */
const getDependentCareData = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const providerEntities = entities
    .filter((entity) => entity.entityType === 'care_provider')
    .map((entity) => {
      const data = asRecord(entity.data)
      const amountPaid = toMoney(data.amountPaid ?? data.amount ?? 0)
      return {
        id: entity.id,
        name: toText(data.providerName ?? data.name),
        address: [
          toText(data.address),
          [toText(data.city), toText(data.state), toText(data.zip)]
            .filter(Boolean)
            .join(' ')
            .trim()
        ]
          .filter(Boolean)
          .join(', '),
        tin: toText(data.tin ?? data.ein ?? data.ssn).replace(/\D/g, ''),
        amountPaid
      }
    })
    .filter((provider) => provider.name || provider.amountPaid > 0)

  const screen = requireScreen(snapshot, '/education-care')
  const form = asRecord(screen.form)
  const screenExpenses = toMoney(
    form.dependentCareExpenses ??
      screen.dependentCareExpenses ??
      screen.childcareExpenses
  )

  const entityExpenses = providerEntities.reduce(
    (sum, provider) => sum + provider.amountPaid,
    0
  )

  return {
    providers: providerEntities.length > 0 ? providerEntities : undefined,
    expenses:
      entityExpenses > 0
        ? entityExpenses
        : screenExpenses > 0
        ? screenExpenses
        : undefined
  }
}

/** Form 8863 education expenses from education_expense entities or /education-care screen */
const getEducationExpensesData = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[],
  dependents: Array<Record<string, unknown>>,
  taxpayer: Record<string, unknown>
) => {
  const entityExpenses = entities
    .filter((entity) => entity.entityType === 'education_expense')
    .map((entity) => {
      const data = asRecord(entity.data)
      const qualifiedExpenses = toMoney(
        data.qualifiedExpenses ?? data.tuition ?? data.expenses
      )
      const scholarshipsReceived = toMoney(
        data.scholarshipsReceived ?? data.scholarships
      )
      const creditTypeValue = toText(data.creditType).toUpperCase()
      return {
        id: entity.id,
        studentName: toText(data.studentName ?? data.name),
        studentSsn: toText(data.studentSsn ?? data.ssn).replace(/\D/g, ''),
        institutionName: toText(
          data.institutionName ?? data.schoolName ?? data.institution
        ),
        institutionEin: toText(data.institutionEin ?? data.ein),
        qualifiedExpenses,
        scholarshipsReceived,
        isHalfTimeStudent: data.isHalfTimeStudent !== false,
        isFirstFourYears: data.isFirstFourYears !== false,
        hasConviction: Boolean(data.hasConviction ?? false),
        creditType:
          creditTypeValue === 'LLC'
            ? 'LLC'
            : creditTypeValue === 'AOTC'
              ? 'AOTC'
              : null,
        personRole: (() => {
          const role = toText(data.personRole ?? data.owner).toLowerCase()
          if (role === 'spouse') return 'spouse'
          if (role === 'dependent') return 'dependent'
          return 'taxpayer'
        })()
      }
    })
    .filter(
      (expense) =>
        expense.creditType &&
        (expense.qualifiedExpenses > 0 ||
          expense.scholarshipsReceived > 0 ||
          Boolean(expense.institutionName))
    )

  if (entityExpenses.length > 0) {
    return entityExpenses
  }

  const screen = requireScreen(snapshot, '/education-care')
  const form = asRecord(screen.form)
  const tuitionPaid = toMoney(form.tuitionPaid ?? screen.tuitionPaid)
  const scholarshipReceived = toMoney(
    form.scholarshipReceived ?? screen.scholarshipReceived
  )
  if (tuitionPaid <= 0 && scholarshipReceived <= 0) {
    return undefined
  }

  const creditTypeValue = toText(form.creditType).toLowerCase()
  if (creditTypeValue !== 'aotc' && creditTypeValue !== 'llc') {
    return undefined
  }

  const firstDependent = dependents[0]
  const studentName =
    toText(firstDependent?.name) ||
    `${toText(taxpayer.firstName)} ${toText(taxpayer.lastName)}`.trim()

  return [
    {
      id: 'education-expense-primary',
      studentName,
      studentSsn: toText(firstDependent?.ssn).replace(/\D/g, ''),
      institutionName: 'Institution from Form 1098-T',
      institutionEin: '',
      qualifiedExpenses: tuitionPaid,
      scholarshipsReceived: scholarshipReceived,
      isHalfTimeStudent: true,
      isFirstFourYears: creditTypeValue !== 'llc',
      hasConviction: false,
      creditType: creditTypeValue === 'llc' ? 'LLC' : 'AOTC',
      personRole: firstDependent ? 'dependent' : 'taxpayer'
    }
  ]
}

/** IRA contribution deductibility from dedicated deduction entity/screen or /ira-retirement fallback */
const getIRAContributionsData = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const entity = entities.find(
    (e) => e.entityType === 'ira_contribution_deduction'
  )
  const retirementEntity = entities.find((e) => e.entityType === 'ira_distribution')
  const screen = requireScreen(snapshot, '/ira-contribution')
  const retirementScreen = asRecord(requireScreen(snapshot, '/ira-retirement').form)
  const source =
    entity?.data ??
    (Object.keys(screen).length > 0 ? screen : undefined) ??
    retirementEntity?.data ??
    retirementScreen
  const d = source as Record<string, unknown>
  const traditional = toMoney(
    d.traditionalAmount ??
      d.traditionalContribution ??
      d.contributionAmount ??
      0
  )
  const roth = toMoney(d.rothAmount ?? d.rothContribution ?? 0)
  const deductible = toMoney(
    d.deductibleAmount ?? d.traditionalDeductibleAmount ?? 0
  )
  if (traditional <= 0 && roth <= 0) return undefined
  return [
    {
      owner: toText(d.owner ?? 'primary'),
      traditionalContributions: traditional,
      traditionalDeductibleAmount:
        traditional > 0 ? (deductible > 0 ? deductible : traditional) : 0,
      rothContributions: roth
    }
  ]
}

/** IRA/1099-R distribution facts from ira_distribution entity or /ira-retirement screen */
const getIRAAccountsData = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const screenState = requireScreen(snapshot, '/ira-retirement')
  const screenForm = asRecord(screenState.form)
  const screenSections = asRecord(screenState.sections)

  const screenAccounts =
    Boolean(
      screenSections.pension ||
        screenSections.rmd ||
        screenSections.conversion ||
        screenForm.pensionIncome ||
        screenForm.pensionTaxable ||
        screenForm.rmdAmount ||
        screenForm.rmdTaken ||
        screenForm.conversionAmount ||
        screenForm.traditionalContribution ||
        screenForm.rothContribution
    )
      ? [
          {
            id: 'retirement-primary',
            owner: 'primary',
            accountType:
              toMoney(screenForm.rothContribution ?? 0) > 0 ||
              toMoney(screenForm.conversionAmount ?? 0) > 0
                ? 'roth'
                : 'traditional',
            grossDistribution: toMoney(
              screenForm.pensionIncome ??
                screenForm.rmdTaken ??
                screenForm.conversionAmount
            ),
            taxableAmount: toMoney(
              screenForm.pensionTaxable ??
                screenForm.rmdTaken ??
                screenForm.conversionAmount
            ),
            federalIncomeTaxWithheld: toMoney(
              screenForm.federalWithheld ?? 0
            ),
            requiredMinimumDistributions: toMoney(
              screenForm.rmdAmount ?? 0
            ),
            rothIraConversion: toMoney(screenForm.conversionAmount ?? 0),
            contributions:
              toMoney(screenForm.traditionalContribution ?? 0) +
              toMoney(screenForm.rothContribution ?? 0),
            nonDeductibleBasis: toMoney(
              screenForm.nonDeductibleBasis ?? 0
            ),
            priorBasis: toMoney(screenForm.priorBasis ?? 0),
            taxableAmountNotDetermined: false,
            totalDistribution: toMoney(
              screenForm.pensionIncome ??
                screenForm.rmdTaken ??
                screenForm.conversionAmount
            )
              ? true
              : false
          }
        ]
      : []

  const entityAccounts = entities
    .filter((entity) => entity.entityType === 'ira_distribution')
    .map((entity) => ({
      id: entity.id,
      owner: toText(entity.data.owner ?? 'primary'),
      accountType: toText(
        entity.data.accountType ??
          (toMoney(entity.data.rothContribution ?? 0) > 0 ||
          toMoney(entity.data.rothConversion ?? entity.data.conversionAmount ?? 0) > 0
            ? 'roth'
            : 'traditional')
      ),
      grossDistribution: toMoney(
        entity.data.grossDistribution ??
          entity.data.pensionIncome ??
          entity.data.rmdTaken ??
          entity.data.conversionAmount
      ),
      taxableAmount: toMoney(
        entity.data.taxableAmount ??
          entity.data.pensionTaxable ??
          entity.data.rmdTaken ??
          entity.data.conversionAmount
      ),
      federalIncomeTaxWithheld: toMoney(
        entity.data.federalIncomeTaxWithheld ?? entity.data.federalWithheld
      ),
      requiredMinimumDistributions: toMoney(
        entity.data.requiredMinimumDistributions ??
          entity.data.rmd ??
          entity.data.rmdAmount
      ),
      rothIraConversion: toMoney(
        entity.data.rothIraConversion ??
          entity.data.rothConversion ??
          entity.data.conversionAmount
      ),
      contributions: toMoney(
        entity.data.contributions ??
          entity.data.contributionAmount ??
          entity.data.traditionalContribution
      ) + toMoney(entity.data.rothContribution ?? 0),
      nonDeductibleBasis: toMoney(entity.data.nonDeductibleBasis ?? 0),
      priorBasis: toMoney(entity.data.priorBasis ?? 0),
      taxableAmountNotDetermined: Boolean(
        entity.data.taxableAmountNotDetermined
      ),
      totalDistribution: Boolean(
        entity.data.totalDistribution ??
          toMoney(
            entity.data.grossDistribution ??
              entity.data.pensionIncome ??
              entity.data.rmdTaken ??
              entity.data.conversionAmount
          )
      )
    }))

  return mergeCollectionById(screenAccounts, entityAccounts)
}

/** Form 5695: clean energy + home improvements from form_5695 entity or /residential-energy screen */
const getForm5695Data = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const entity = entities.find((e) => e.entityType === 'form_5695')
  const screen = requireScreen(snapshot, '/residential-energy')
  const d = (entity?.data ?? screen) as Record<string, unknown>
  const p = (v: unknown) => toMoney(v)
  const year = new Date().getFullYear()
  const date = new Date(`${year}-06-15`)
  const cleanEnergy: Record<string, unknown>[] = []
  if (d.hasSolarElectric && p(d.solarElectricCost) > 0) {
    cleanEnergy.push({
      type: 'solarElectric',
      cost: p(d.solarElectricCost),
      dateInstalled: date
    })
  }
  if (d.hasSolarWaterHeating && p(d.solarWaterCost) > 0) {
    cleanEnergy.push({
      type: 'solarWaterHeating',
      cost: p(d.solarWaterCost),
      dateInstalled: date
    })
  }
  if (d.hasWindEnergy && p(d.windCost) > 0) {
    cleanEnergy.push({
      type: 'smallWind',
      cost: p(d.windCost),
      dateInstalled: date
    })
  }
  if (d.hasGeothermal && p(d.geothermalCost) > 0) {
    cleanEnergy.push({
      type: 'geothermal',
      cost: p(d.geothermalCost),
      dateInstalled: date
    })
  }
  if (d.hasBatteryStorage && p(d.batteryCost) > 0) {
    cleanEnergy.push({
      type: 'batteryStorage',
      cost: p(d.batteryCost),
      dateInstalled: date
    })
  }
  if (d.hasFuelCell && p(d.fuelCellCost) > 0) {
    cleanEnergy.push({
      type: 'fuelCell',
      cost: p(d.fuelCellCost),
      dateInstalled: date,
      fuelCellKwCapacity: p(d.fuelCellKW)
    })
  }
  const homeImprovements: Record<string, unknown>[] = []
  if (d.hasInsulation && p(d.insulationCost) > 0) {
    homeImprovements.push({
      type: 'insulation',
      cost: p(d.insulationCost),
      dateInstalled: date
    })
  }
  if (d.hasWindows && p(d.windowsCost) > 0) {
    homeImprovements.push({
      type: 'windowsSkylights',
      cost: p(d.windowsCost),
      dateInstalled: date
    })
  }
  if (d.hasDoors && p(d.doorsCost) > 0) {
    homeImprovements.push({
      type: 'exteriorDoors',
      cost: p(d.doorsCost),
      dateInstalled: date,
      doorCount: toMoney(d.doorsCount)
    })
  }
  if (d.hasCentralAC && p(d.centralACCost) > 0) {
    homeImprovements.push({
      type: 'centralAC',
      cost: p(d.centralACCost),
      dateInstalled: date
    })
  }
  if (d.hasWaterHeater && p(d.waterHeaterCost) > 0) {
    homeImprovements.push({
      type: 'waterHeater',
      cost: p(d.waterHeaterCost),
      dateInstalled: date
    })
  }
  if (d.hasHeatPumpWaterHeater && p(d.heatPumpWaterHeaterCost) > 0) {
    homeImprovements.push({
      type: 'heatPumpWaterHeater',
      cost: p(d.heatPumpWaterHeaterCost),
      dateInstalled: date
    })
  }
  if (d.hasHeatPumpHVAC && p(d.heatPumpHVACCost) > 0) {
    homeImprovements.push({
      type: 'heatPump',
      cost: p(d.heatPumpHVACCost),
      dateInstalled: date
    })
  }
  if (d.hasEnergyAudit && p(d.energyAuditCost) > 0) {
    homeImprovements.push({
      type: 'homeEnergyAudit',
      cost: p(d.energyAuditCost),
      dateInstalled: date
    })
  }
  if (cleanEnergy.length === 0 && homeImprovements.length === 0)
    return undefined
  return { cleanEnergyProperties: cleanEnergy, homeImprovements }
}

/** Educator expenses (Schedule 1 Line 11) from educator_expenses entity or /educator-expenses screen */
const getEducatorExpensesData = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const entity = entities.find((e) => e.entityType === 'educator_expenses')
  const screen = requireScreen(snapshot, '/educator-expenses')
  const d = (entity?.data ?? screen) as Record<string, unknown>
  const total = toMoney(d.totalDeduction ?? 0)
  return total > 0 ? total : undefined
}

/** Alimony received/paid (Schedule 1 Lines 2a/19a) from alimony entity or /alimony screen */
const getAlimonyData = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const entity = entities.find((e) => e.entityType === 'alimony')
  const screen = requireScreen(snapshot, '/alimony')
  const d = (entity?.data ?? screen) as Record<string, unknown>
  const received = toMoney(d.alimonyReceived ?? 0)
  const paid = toMoney(d.alimonyPaid ?? 0)
  if (received <= 0 && paid <= 0) return undefined
  return { alimonyReceived: received, alimonyPaid: paid }
}

/** Self-employed health insurance (Schedule 1 Line 17) from se_health_insurance entity */
const getSEHealthInsuranceData = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const entity = entities.find((e) => e.entityType === 'se_health_insurance')
  const screen = requireScreen(snapshot, '/se-health-insurance')
  const d = (entity?.data ?? screen) as Record<string, unknown>
  const deduction = toMoney(d.deductibleAmount ?? 0)
  return deduction > 0 ? deduction : undefined
}

/** Capital loss carryover from capital_loss_carryover entity */
const getCapitalLossCarryoverData = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const entity = entities.find((e) => e.entityType === 'capital_loss_carryover')
  const screen = requireScreen(snapshot, '/capital-loss-carryover')
  const d = (entity?.data ?? screen) as Record<string, unknown>
  const st = toMoney(d.shortTermCarryover ?? 0)
  const lt = toMoney(d.longTermCarryover ?? 0)
  if (st <= 0 && lt <= 0) return undefined
  return { shortTerm: st, longTerm: lt }
}

/** Passive activity loss allowance from passive_activity_loss entity */
const getPassiveActivityLossData = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
) => {
  const entity = entities.find((e) => e.entityType === 'passive_activity_loss')
  const screen = requireScreen(snapshot, '/passive-activity-loss')
  const d = (entity?.data ?? screen) as Record<string, unknown>
  const allowance = toMoney(d.allowableLoss ?? 0)
  return allowance > 0 ? allowance : undefined
}

const getScheduleEPage2Data = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[],
  rentalProperties: ReturnType<typeof getRentalProperties>,
  k1Records: ReturnType<typeof getK1Records>
) => {
  const entity = entities.find((e) => e.entityType === 'passive_activity_loss')
  const screen = requireScreen(snapshot, '/passive-activity-loss')
  const d = (entity?.data ?? screen) as Record<string, unknown>
  const priorYearUnallowedLoss = toMoney(d.priorYearUnallowedLoss ?? 0)
  const hasRentalActivity =
    rentalProperties.length > 0 ||
    toMoney(d.totalRentalIncome ?? 0) > 0 ||
    toMoney(d.totalRentalExpenses ?? 0) > 0
  const hasOtherPassiveActivity =
    k1Records.some((record) => record.isPassive) ||
    toMoney(d.otherPassiveIncome ?? 0) > 0 ||
    toMoney(d.otherPassiveLoss ?? 0) > 0

  const fallbackRentalCarryover =
    priorYearUnallowedLoss > 0 && hasRentalActivity && !hasOtherPassiveActivity
      ? priorYearUnallowedLoss
      : undefined
  const fallbackOtherCarryover =
    priorYearUnallowedLoss > 0 && hasOtherPassiveActivity && !hasRentalActivity
      ? priorYearUnallowedLoss
      : undefined

  const hasValue =
    Boolean(d.activelyParticipated) ||
    fallbackRentalCarryover !== undefined ||
    fallbackOtherCarryover !== undefined

  if (!hasValue) {
    return undefined
  }

  return {
    activeParticipationRentalRealEstate: Boolean(
      d.activelyParticipated ?? false
    ),
    priorYearRentalRealEstateLosses: fallbackRentalCarryover,
    priorYearOtherPassiveLosses: fallbackOtherCarryover
  }
}

const getIncomeSummary = (
  w2Records: ReturnType<typeof getW2Records>,
  form1099Records: ReturnType<typeof get1099Records>,
  unemploymentRecords: ReturnType<typeof getUnemploymentRecords>,
  socialSecurityRecords: ReturnType<typeof getSocialSecurityRecords>,
  iraAccounts: Array<Record<string, unknown>>
) => {
  const totalsByType = form1099Records.reduce<Record<string, number>>(
    (acc, record) => {
      acc[record.type] = (acc[record.type] ?? 0) + record.summaryAmount
      return acc
    },
    {}
  )

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
    total1099Amount: form1099Records.reduce(
      (sum, record) => sum + record.summaryAmount,
      0
    ),
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
    retirementAccountCount: iraAccounts.length,
    totalRetirementDistributions: iraAccounts.reduce(
      (sum, record) => sum + toMoney(record.grossDistribution),
      0
    ),
    totalRetirementWithholding: iraAccounts.reduce(
      (sum, record) => sum + toMoney(record.federalIncomeTaxWithheld),
      0
    ),
    totalsByType
  }
}

/** Form 8615 (Kiddie Tax): parent info from kiddie_tax entity for create1040 parentInfo */
const getParentInfoFromKiddieTax = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
): Record<string, unknown> | undefined => {
  const entity = entities.find((e) => e.entityType === 'kiddie_tax')
  const data = entity?.data as Record<string, unknown> | undefined
  if (!data?.parentsTaxableIncome && !data?.parentsAGI) return undefined
  const filingStatus = toText(
    data.parentsFilingStatus ?? data.filingStatus ?? 'single'
  )
  return {
    name: toText(data.parentName ?? 'Parent'),
    ssn: toText(data.parentSSN ?? data.parentsSSN ?? '').replace(/\D/g, ''),
    filingStatus: filingStatus.toLowerCase(),
    taxableIncome: toMoney(data.parentsTaxableIncome ?? data.parentsAGI ?? 0),
    taxLiability: toMoney(
      data.parentTaxLiability ?? data.parentsTaxLiability ?? 0
    )
  }
}

/** Form 8379 (Injured Spouse): allocation info from injured_spouse_allocation entity */
const getInjuredSpouseInfo = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
): Record<string, unknown> | undefined => {
  const entity = entities.find(
    (e) => e.entityType === 'injured_spouse_allocation'
  )
  const data = entity?.data as Record<string, unknown> | undefined
  if (
    !data ||
    (toMoney(data.totalInjuredIncome ?? 0) === 0 &&
      toMoney(data.injuredWithholding ?? 0) === 0 &&
      toMoney(data.injuredEstimatedPayments ?? 0) === 0)
  )
    return undefined
  const debtTypes = (data.debtTypes as string[] | undefined) ?? []
  return {
    injuredSpouse:
      (data.injuredSpouseRole as string) === 'spouse' ? 'spouse' : 'primary',
    spouseHasPastDueChildSupport: debtTypes.includes('child_support'),
    spouseHasPastDueFederalDebt:
      debtTypes.includes('federal_tax') ||
      debtTypes.includes('federal') ||
      debtTypes.includes('federal_nontax'),
    spouseHasPastDueStateDebt:
      debtTypes.includes('state_tax') ||
      debtTypes.includes('state') ||
      debtTypes.includes('state_income_tax') ||
      debtTypes.includes('state_unemployment'),
    isInCommunityPropertyState: Boolean(data.isInCommunityPropertyState),
    communityPropertyState: toText(data.communityPropertyState)
  }
}

/** Form 2210: prior year tax from underpayment entity, /underpayment screen, or prior-year-import */
const getPriorYearTax = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
): number | undefined => {
  const entity = entities.find((e) => e.entityType === 'underpayment_data')
  const fromEntity = entity?.data as Record<string, unknown> | undefined
  if (fromEntity?.priorYearTax != null) return toMoney(fromEntity.priorYearTax)
  const underpaymentScreen = requireScreen(snapshot, '/underpayment') as Record<
    string,
    unknown
  >
  const prior = underpaymentScreen.priorYearTax
  if (prior != null && prior !== '')
    return toMoney(Number(String(prior).replace(/[^\d.]/g, '')) || 0)
  const priorYearForm = requireScreen(snapshot, '/prior-year-import') as Record<
    string,
    unknown
  >
  const form = priorYearForm.form as Record<string, unknown> | undefined
  const priorYearTaxFromImport = form?.priorYearTax
  if (priorYearTaxFromImport != null && priorYearTaxFromImport !== '')
    return toMoney(
      Number(String(priorYearTaxFromImport).replace(/[^\d.]/g, '')) || 0
    )
  return undefined
}

/** Form 4137: unreported tip income from entity or screen */
const getUnreportedTipIncome = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
): number | undefined => {
  const entity = entities.find((e) => e.entityType === 'form_4137')
  const fromEntity = entity?.data as Record<string, unknown> | undefined
  if (fromEntity?.hasUnreportedTips === false) return undefined
  if (fromEntity?.unreportedTips != null)
    return toMoney(fromEntity.unreportedTips)
  const screen = requireScreen(snapshot, '/form-4137') as Record<
    string,
    unknown
  >
  if (screen.hasUnreportedTips === false) return undefined
  const amount = screen.unreportedTips ?? screen.unreportedTipIncome
  if (amount != null && amount !== '')
    return toMoney(Number(String(amount).replace(/[^\d.]/g, '')) || 0)
  return undefined
}

/** Form 8919: uncollected SS/Medicare wages from entities or screen */
const getUncollectedSSTaxWages = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
): Record<string, unknown>[] => {
  const entityList = entities.filter((e) => e.entityType === 'form_8919')
  if (entityList.some((e) => (e.data as Record<string, unknown>)?.hasUncollectedWages === false))
    return []
  if (entityList.length > 0) {
    return entityList.map((e) => {
      const d = e.data as Record<string, unknown>
      return {
        employerName: toText(d.employerName ?? d.employer),
        employerEIN: toText(d.employerEIN ?? d.ein).replace(/\D/g, ''),
        wagesReceived: toMoney(d.wagesReceived ?? d.wages ?? 0),
        reasonCode: toText(d.reasonCode ?? d.reason ?? 'A')
      }
    })
  }
  const screen = requireScreen(snapshot, '/form-8919') as Record<
    string,
    unknown
  >
  if (screen.hasUncollectedWages === false) return []
  const employers = asArray<Record<string, unknown>>(
    screen.employers ?? screen.records ?? []
  )
  return employers
    .filter((r) => toMoney(r.wagesReceived ?? r.wages ?? 0) > 0)
    .map((r) => ({
      employerName: toText(r.employerName ?? r.employer),
      employerEIN: toText(r.employerEIN ?? r.ein).replace(/\D/g, ''),
      wagesReceived: toMoney(r.wagesReceived ?? r.wages ?? 0),
      reasonCode: toText(r.reasonCode ?? r.reason ?? 'A')
    }))
}

/** Form 8801: AMT credit carryforward from entity or screen */
const getAmtCreditData = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
): { priorYearAmtCredit?: number; priorYearAmtCreditCarryforward?: number } => {
  const entity = entities.find((e) => e.entityType === 'form_8801')
  const fromEntity = entity?.data as Record<string, unknown> | undefined
  if (fromEntity) {
    if (fromEntity.hasAmtCredit === false) return {}
    return {
      priorYearAmtCredit:
        fromEntity.priorYearAmtCredit != null
          ? toMoney(fromEntity.priorYearAmtCredit)
          : undefined,
      priorYearAmtCreditCarryforward:
        fromEntity.priorYearAmtCreditCarryforward != null
          ? toMoney(fromEntity.priorYearAmtCreditCarryforward)
          : undefined
    }
  }
  const screen = requireScreen(snapshot, '/form-8801') as Record<
    string,
    unknown
  >
  if (screen.hasAmtCredit === false) return {}
  const prior = screen.priorYearAmtCredit ?? screen.amtCredit
  const carryforward =
    screen.priorYearAmtCreditCarryforward ?? screen.carryforward
  return {
    priorYearAmtCredit:
      prior != null && prior !== ''
        ? toMoney(Number(String(prior).replace(/[^\d.]/g, '')) || 0)
        : undefined,
    priorYearAmtCreditCarryforward:
      carryforward != null && carryforward !== ''
        ? toMoney(Number(String(carryforward).replace(/[^\d.]/g, '')) || 0)
        : undefined
  }
}

const normalizeOtherFederalWithholdingCredit = (
  record: Record<string, unknown>
): Record<string, unknown> | undefined => {
  const rawSource = toText(record.source)
  const source =
    rawSource === 'W2G' ||
    rawSource === 'Schedule K-1' ||
    rawSource === '1042-S' ||
    rawSource === '8805' ||
    rawSource === '8288-A'
      ? rawSource
      : 'other'
  const amount = toMoney(record.amount)
  if (amount <= 0) return undefined

  return {
    source,
    amount,
    description: toText(
      record.description ??
        record.label ??
        record.payerName ??
        record.casinoName ??
        record.typeOfWager
    )
  }
}

const getSchedule8812CollectionFidelityData = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
): {
  schedule8812EarnedIncomeAdjustments?: Record<string, unknown>
  otherFederalWithholdingCredits?: Record<string, unknown>[]
} => {
  const screen = requireScreen(snapshot, '/schedule-8812-adjustments')
  const entity = entities.find(
    (candidate) => candidate.entityType === 'schedule_8812_adjustments'
  )
  const data = (entity?.data ?? screen) as Record<string, unknown>

  const schedule8812EarnedIncomeAdjustments = {
    scholarshipGrantsNotOnW2: toMoney(
      data.scholarshipGrantsNotOnW2 ??
        data.taxableScholarshipGrantsNotOnW2 ??
        data.scholarshipGrants
    ),
    penalIncome: toMoney(data.penalIncome),
    nonqualifiedDeferredCompensation: toMoney(
      data.nonqualifiedDeferredCompensation ??
        data.nonqualifiedDeferredComp ??
        data.section409ADeferrals
    ),
    medicaidWaiverPaymentsExcludedFromIncome: toMoney(
      data.medicaidWaiverPaymentsExcludedFromIncome ??
        data.medicaidWaiverPayments
    ),
    includeMedicaidWaiverInEarnedIncome: Boolean(
      data.includeMedicaidWaiverInEarnedIncome ??
        data.includeMedicaidWaiverPaymentsInEarnedIncome
    )
  }

  const explicitCredits = asArray<Record<string, unknown>>(
    data.otherFederalWithholdingCredits
  )
  const screenW2gRecords = asArray<Record<string, unknown>>(
    screen.w2gRecords ?? screen.w2gs
  )
  const entityW2gRecords = entities
    .filter((candidate) => candidate.entityType === 'w2g')
    .map((candidate) => asRecord(candidate.data))

  const otherFederalWithholdingCredits = [
    ...explicitCredits,
    ...screenW2gRecords.map((record) => ({
      source: 'W2G',
      amount:
        record.amount ??
        record.federalIncomeTaxWithheld ??
        record.federalWithheld ??
        record.withholding,
      description:
        record.description ??
        record.payerName ??
        record.casinoName ??
        record.typeOfWager
    })),
    ...entityW2gRecords.map((record) => ({
      source: 'W2G',
      amount:
        record.amount ??
        record.federalIncomeTaxWithheld ??
        record.federalWithheld ??
        record.withholding,
      description:
        record.description ??
        record.payerName ??
        record.casinoName ??
        record.typeOfWager
    }))
  ]
    .map((record) => normalizeOtherFederalWithholdingCredit(record))
    .filter(
      (record): record is Record<string, unknown> => record !== undefined
    )

  const hasAdjustments = Object.values(schedule8812EarnedIncomeAdjustments).some(
    (value) => (typeof value === 'boolean' ? value : value > 0)
  )

  return {
    schedule8812EarnedIncomeAdjustments: hasAdjustments
      ? schedule8812EarnedIncomeAdjustments
      : undefined,
    otherFederalWithholdingCredits:
      otherFederalWithholdingCredits.length > 0
        ? otherFederalWithholdingCredits
        : undefined
  }
}

const getForm8879Data = (
  snapshot: FilingSessionSnapshot,
  taxpayer: Record<string, unknown>,
  spouse: Record<string, unknown> | null
): Record<string, unknown> | undefined => {
  const efile = requireScreen(snapshot, '/efile-wizard')
  const identity = asRecord(efile.identityData)
  const signature = asRecord(efile.signatureData)
  const signatureTimestamp = toText(
    signature.signatureTimestamp ?? efile.signatureTimestamp ?? efile.signedAt
  )
  const consent = Boolean(
    signature.form8879Consent ?? efile.form8879Consent ?? efile.agreed8879
  )
  const taxpayerPIN = toText(
    signature.primaryPIN ?? efile.primaryPIN ?? efile.taxpayerPIN
  )
  const spousePIN = toText(signature.spousePIN ?? efile.spousePIN)
  const signatureText = toText(signature.signatureText ?? efile.signatureText)

  if (!consent && !taxpayerPIN && !spousePIN && !signatureText) {
    return undefined
  }

  return {
    form8879Consent: consent,
    agreed8879: consent,
    signatureText,
    signatureTimestamp: signatureTimestamp || undefined,
    taxpayerName: `${toText(taxpayer.firstName)} ${toText(
      taxpayer.lastName
    )}`.trim(),
    taxpayerSSN: toText(taxpayer.ssn).replace(/\D/g, ''),
    spouseName: spouse
      ? `${toText(spouse.firstName)} ${toText(spouse.lastName)}`.trim()
      : undefined,
    spouseSSN: spouse ? toText(spouse.ssn).replace(/\D/g, '') : undefined,
    taxpayerPIN,
    spousePIN: spousePIN || undefined,
    primaryPriorYearAGI: toMoney(
      identity.primaryPriorYearAGI ??
        efile.primaryPriorYearAGI ??
        efile.priorYearAgi ??
        taxpayer.priorYearAgi
    ),
    primaryPriorYearPIN: toText(
      identity.primaryPriorYearPIN ?? efile.primaryPriorYearPIN
    ),
    spousePriorYearAGI: toMoney(
      identity.spousePriorYearAGI ?? efile.spousePriorYearAGI
    ),
    spousePriorYearPIN: toText(
      identity.spousePriorYearPIN ?? efile.spousePriorYearPIN
    ),
    primaryIPPIN: toText(identity.primaryIPPIN ?? efile.primaryIPPIN),
    spouseIPPIN: toText(identity.spouseIPPIN ?? efile.spouseIPPIN),
    selfSelectPIN: !Boolean(signature.practitionerPIN ?? efile.practitionerPIN),
    practitionerPIN: Boolean(
      signature.practitionerPIN ?? efile.practitionerPIN
    ),
    eroFirmName: toText(efile.eroFirmName ?? 'TaxFlow Self-Service'),
    eroAddress: toText(efile.eroAddress),
    eroEIN: toText(efile.eroEIN).replace(/\D/g, ''),
    eroPIN: toText(efile.eroPIN)
  }
}

const getThirdPartyDesigneeData = (
  snapshot: FilingSessionSnapshot
): Record<string, unknown> | undefined => {
  const efile = requireScreen(snapshot, '/efile-wizard')
  const raw = asRecord(efile.thirdPartyDesignee)
  const authorizeDiscussion = Boolean(
    raw.authorizeDiscussion ??
      raw.authorized ??
      raw.enabled ??
      efile.thirdPartyDesigneeAuthorized
  )
  const name = toText(raw.name ?? efile.thirdPartyDesigneeName)
  const phone = toText(raw.phone ?? efile.thirdPartyDesigneePhone).replace(
    /\D/g,
    ''
  )
  const pin = toText(raw.pin ?? efile.thirdPartyDesigneePin).replace(/\D/g, '')

  if (!authorizeDiscussion && !name && !phone && !pin) {
    return undefined
  }

  return {
    authorizeDiscussion,
    name: name || undefined,
    phone: phone || undefined,
    pin: pin || undefined
  }
}

/** Schedule R: disability income and nontaxable pension from entity or /schedule-r screen */
const getScheduleRData = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
): { disabilityIncome?: number; nontaxablePensionIncome?: number } => {
  const entity = entities.find((e) => e.entityType === 'schedule_r')
  const fromEntity = entity?.data as Record<string, unknown> | undefined
  if (fromEntity) {
    const disabilityIncome =
      fromEntity.disabilityIncome != null
        ? toMoney(fromEntity.disabilityIncome)
        : undefined
    const nontaxablePensionIncome =
      fromEntity.nontaxablePensionIncome != null
        ? toMoney(fromEntity.nontaxablePensionIncome)
        : undefined
    if (
      disabilityIncome !== undefined ||
      nontaxablePensionIncome !== undefined
    ) {
      return { disabilityIncome, nontaxablePensionIncome }
    }
  }
  const screen = requireScreen(snapshot, '/schedule-r') as Record<
    string,
    unknown
  >
  if (!screen || Object.keys(screen).length === 0) return {}
  const disabilityIncome =
    screen.disabilityIncome != null && screen.disabilityIncome !== ''
      ? toMoney(
          Number(String(screen.disabilityIncome).replace(/[^\d.]/g, '')) || 0
        )
      : undefined
  const nontaxablePensionIncome =
    screen.nontaxablePensionIncome != null &&
    screen.nontaxablePensionIncome !== ''
      ? toMoney(
          Number(
            String(screen.nontaxablePensionIncome).replace(/[^\d.]/g, '')
          ) || 0
        )
      : undefined
  return { disabilityIncome, nontaxablePensionIncome }
}

/** Form 8283: noncash charitable contributions from entity or screen */
const getNoncashContributions = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
): Record<string, unknown> | undefined => {
  const entityData = entities
    .filter((entity) => entity.entityType === 'form_8283')
    .map((entity) => asRecord(entity.data))

  if (entityData.length > 0) {
    const combined = {
      sectionADonations: entityData.flatMap((item) =>
        asArray<Record<string, unknown>>(item.sectionADonations)
      ),
      sectionBDonations: entityData.flatMap((item) =>
        asArray<Record<string, unknown>>(item.sectionBDonations)
      ),
      vehicleDonations: entityData.flatMap((item) =>
        asArray<Record<string, unknown>>(item.vehicleDonations)
      )
    }
    if (
      combined.sectionADonations.length > 0 ||
      combined.sectionBDonations.length > 0 ||
      combined.vehicleDonations.length > 0
    ) {
      return combined
    }
  }

  const screen = requireScreen(snapshot, '/form-8283') as Record<
    string,
    unknown
  >
  if (!screen || Object.keys(screen).length === 0) return undefined
  const sectionA = asArray<Record<string, unknown>>(
    screen.sectionADonations ?? screen.donations ?? []
  )
  const sectionB = asArray<Record<string, unknown>>(
    screen.sectionBDonations ?? []
  )
  const vehicles = asArray<Record<string, unknown>>(
    screen.vehicleDonations ?? []
  )
  if (sectionA.length === 0 && sectionB.length === 0 && vehicles.length === 0)
    return undefined
  return {
    sectionADonations: sectionA,
    sectionBDonations: sectionB,
    vehicleDonations: vehicles
  }
}

const getItemizedDeductions = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[],
  noncashContributions?: Record<string, unknown>
): ItemizedDeductions | undefined => {
  const entityDataList = entities
    .filter(
      (item) =>
        item.entityType === 'itemized_deductions' ||
        item.entityType === 'schedule_a'
    )
    .map((item) => asRecord(item.data))
  const screenCandidates = [
    requireScreen(snapshot, '/deductions'),
    requireScreen(snapshot, '/schedule-a'),
    asRecord(requireScreen(snapshot, '/your-taxes').itemizedDeductions)
  ]
  const screenData =
    screenCandidates.find((candidate) => Object.keys(candidate).length > 0) ??
    {}
  const nestedScreenForm = asRecord(screenData.form)
  const sources =
    entityDataList.length > 0
      ? entityDataList
      : [
          Object.keys(nestedScreenForm).length > 0
            ? { ...screenData, ...nestedScreenForm }
            : screenData
        ]

  const noncashTotal = (() => {
    const contributions = asRecord(noncashContributions)
    const buckets = [
      ...asArray<Record<string, unknown>>(contributions.sectionADonations),
      ...asArray<Record<string, unknown>>(contributions.sectionBDonations),
      ...asArray<Record<string, unknown>>(contributions.vehicleDonations)
    ]
    return buckets.reduce((sum, item) => {
      const deduction = toMoney(item.deductionClaimed)
      const fallback = toMoney(item.fairMarketValue)
      return sum + (deduction || fallback)
    }, 0)
  })()

  const sumCandidateValues = (...keys: string[]) =>
    sources.reduce((sum, source) => {
      for (const key of keys) {
        if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
          sum += toMoney(source[key])
          break
        }
      }
      return sum
    }, 0)

  const someCandidateBoolean = (...keys: string[]) =>
    sources.some((source) => keys.some((key) => Boolean(source[key])))

  const firstCandidateText = (...keys: string[]) =>
    toText(
      sources
        .map((source) => keys.map((key) => toText(source[key])).find(Boolean))
        .find(Boolean)
    )

  const deductions = {
    medicalAndDental: sumCandidateValues(
      'medicalAndDental',
      'medicalDental',
      'medicalExpenses',
      'unreimbursedMedical'
    ),
    stateAndLocalTaxes: sumCandidateValues(
      'stateAndLocalTaxes',
      'stateLocalIncomeTax',
      'stateTaxes',
      'stateTax',
      'stateIncomeTaxes',
      'salesTaxes'
    ),
    isSalesTax: someCandidateBoolean('isSalesTax', 'useSalesTax', 'salesTaxElection'),
    stateAndLocalRealEstateTaxes: sumCandidateValues(
      'stateAndLocalRealEstateTaxes',
      'realEstateTaxes',
      'propertyTaxesRealEstate'
    ),
    stateAndLocalPropertyTaxes: sumCandidateValues(
      'stateAndLocalPropertyTaxes',
      'personalPropertyTaxes',
      'vehiclePropertyTaxes'
    ),
    otherTaxes: sumCandidateValues(
      'otherTaxes',
      'scheduleAOtherTaxes',
      'line6OtherTaxes'
    ),
    otherTaxesDescription: firstCandidateText(
      'otherTaxesDescription',
      'otherTaxesLabel',
      'scheduleAOtherTaxesDescription'
    ),
    interest8a: sumCandidateValues(
      'interest8a',
      'mortgageInterest',
      'homeMortgageInterest',
      'mortgageInterestReported'
    ),
    interest8b: sumCandidateValues('interest8b', 'pointsNotReported', 'points'),
    interest8c: sumCandidateValues(
      'interest8c',
      'mortgageInsurancePremiums',
      'homeEquityInterest'
    ),
    interest8d: sumCandidateValues('interest8d'),
    investmentInterest: sumCandidateValues('investmentInterest', 'marginInterest'),
    charityCashCheck: sumCandidateValues(
      'charityCashCheck',
      'charityCash',
      'cashContributions',
      'charitableContributionsCash'
    ),
    charityOther: Math.max(
      sumCandidateValues(
        'charityOther',
        'charityNonCash',
        'noncashContributionsTotal',
        'charitableContributionsNoncash'
      ),
      noncashTotal
    ),
    casualtyLosses: sumCandidateValues('casualtyLosses'),
    otherDeductions: sumCandidateValues(
      'otherDeductions',
      'miscellaneousDeductions'
    )
  }

  const hasAnyValue =
    deductions.isSalesTax ||
    Object.entries(deductions).some(
      ([key, value]) => key !== 'isSalesTax' && typeof value === 'number' && value > 0
    )

  return hasAnyValue ? deductions : undefined
}

const EMPTY_ITEMIZED_DEDUCTIONS: ItemizedDeductions = {
  medicalAndDental: 0,
  stateAndLocalTaxes: 0,
  isSalesTax: false,
  stateAndLocalRealEstateTaxes: 0,
  stateAndLocalPropertyTaxes: 0,
  otherTaxes: 0,
  otherTaxesDescription: '',
  interest8a: 0,
  interest8b: 0,
  interest8c: 0,
  interest8d: 0,
  investmentInterest: 0,
  charityCashCheck: 0,
  charityOther: 0,
  casualtyLosses: 0,
  otherDeductions: 0
}

const toFacts = (
  row: FilingSessionRow,
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[]
): Record<string, unknown> => {
  const taxpayer = requireScreen(snapshot, '/taxpayer-profile')
  const residency = requireScreen(snapshot, '/residency')
  const efile = requireScreen(snapshot, '/efile-wizard')
  const w2 = requireScreen(snapshot, '/w2')
  const status = String(
    taxpayer.filingStatus ??
      snapshot.filingStatus ??
      row.filing_status ??
      'single'
  )

  const primaryTin = String(
    taxpayer.ssn ??
      taxpayer.primarySsn ??
      (w2.primaryTIN as string | undefined) ??
      ''
  ).replace(/\D/g, '')

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
  const iraAccounts = getIRAAccountsData(snapshot, entities)
  const taxLots = getTaxLots(snapshot, entities)
  const cryptoAccounts = getCryptoAccounts(snapshot, entities)
  const businessRecords = getBusinessRecords(entities)
  const k1Records = getK1Records(entities)
  const qbiWorksheetEntities = getQBIWorksheetEntities(snapshot)
  const qbiDeductionData = getQbiDeductionData(snapshot)
  const businessSummary = getBusinessSummary(
    snapshot,
    businessRecords,
    qbiWorksheetEntities
  )
  const qbiDetail = getQbiDetail(
    snapshot,
    qbiWorksheetEntities,
    qbiDeductionData
  )
  const rentalProperties = getRentalProperties(entities)
  const rentalSummary = getRentalSummary(rentalProperties, k1Records)
  const scheduleEPage2 = getScheduleEPage2Data(
    snapshot,
    entities,
    rentalProperties,
    k1Records
  )
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
  const studentLoanRecords = getStudentLoanData(snapshot, entities)
  const marketplaceInsurance = getMarketplaceInsuranceData(snapshot, entities)
  const dependentCareData = getDependentCareData(snapshot, entities)
  const educationExpenses = getEducationExpensesData(
    snapshot,
    entities,
    dependents,
    taxpayer
  )
  const iraContributionsData = getIRAContributionsData(snapshot, entities)
  const iraAccountsData = getIRAAccountsData(snapshot, entities)
  const form5695Data = getForm5695Data(snapshot, entities)
  const creditSummary = getCreditSummary(snapshot, dependents)
  const incomeSummary = getIncomeSummary(
    w2Records,
    form1099Records,
    unemploymentRecords,
    socialSecurityRecords,
    iraAccountsData ?? []
  )
  const investmentSummary = getInvestmentSummary(taxLots, cryptoAccounts)

  // OBBBA 2025 provisions
  const obbbaData = getObbbaData(snapshot, entities)

  // Educator, alimony, SE health, capital loss, passive activity
  const educatorExpenses = getEducatorExpensesData(snapshot, entities)
  const alimonyData = getAlimonyData(snapshot, entities)
  const seHealthInsurance = getSEHealthInsuranceData(snapshot, entities)
  const capitalLossCarryover = getCapitalLossCarryoverData(snapshot, entities)
  const passiveActivityLoss = getPassiveActivityLossData(snapshot, entities)

  // Form 8615 (Kiddie Tax) — parent info for child's unearned income
  const parentInfo = getParentInfoFromKiddieTax(snapshot, entities)
  // Form 8379 (Injured Spouse) — MFJ refund allocation
  const injuredSpouse = getInjuredSpouseInfo(snapshot, entities)
  // Form 2210 — prior year tax for underpayment penalty
  const priorYearTax = getPriorYearTax(snapshot, entities)
  // Form 4137 — unreported tip income
  const unreportedTipIncome = getUnreportedTipIncome(snapshot, entities)
  // Form 8919 — uncollected SS/Medicare wages
  const uncollectedSSTaxWages = getUncollectedSSTaxWages(snapshot, entities)
  // Form 8801 — AMT credit carryforward
  const amtCreditData = getAmtCreditData(snapshot, entities)
  const schedule8812Fidelity = getSchedule8812CollectionFidelityData(
    snapshot,
    entities
  )
  // Form 8283 — noncash charitable contributions
  const noncashContributions = getNoncashContributions(snapshot, entities)
  const itemizedDeductions = getItemizedDeductions(
    snapshot,
    entities,
    noncashContributions
  )
  // Schedule R — Credit for Elderly or Disabled
  const scheduleRData = getScheduleRData(snapshot, entities)
  const businessReturnFacts = extractBusinessReturnFacts(snapshot)
  const scheduleNecState = asRecord(intlAdvancedData.scheduleNec)
  const scheduleOiState = asRecord(intlAdvancedData.scheduleOi)
  const form8879 = getForm8879Data(snapshot, taxpayer, spouse)
  const thirdPartyDesignee = getThirdPartyDesigneeData(snapshot)

  return {
    ...businessReturnFacts,
    primaryTIN: primaryTin,
    primaryDob: toText(taxpayer.dob),
    primaryFirstName: toText(taxpayer.firstName),
    primaryLastName: toText(taxpayer.lastName),
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
    k1Records,
    qbiWorksheetEntities,
    qbiDeductionData,
    qbiDetail,
    rentalProperties,
    scheduleEPage2,
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
    itemizedDeductions,
    nonresidentScheduleNecItems: asArray<Record<string, unknown>>(
      scheduleNecState.items
    ),
    nonresidentScheduleOi: scheduleOiState,
    schedule8812EarnedIncomeAdjustments:
      schedule8812Fidelity.schedule8812EarnedIncomeAdjustments,
    otherFederalWithholdingCredits:
      schedule8812Fidelity.otherFederalWithholdingCredits,
    appliedToNextYearEstimatedTax: toMoney(
      efile.appliedToNextYearEstimatedTax ??
        efile.refundAppliedToNextYearEstimatedTax
    ),
    thirdPartyDesignee,
    form8879,
    creditSummary: creditSummary.summary,
    // OBBBA 2025 fields
    overtimeIncome: obbbaData.overtimeIncome,
    tipIncome: obbbaData.tipIncome,
    autoLoanInterest: obbbaData.autoLoanInterest,
    trumpSavingsAccounts: obbbaData.trumpSavingsAccounts,
    // Student loan, IRA contribution, Form 5695
    studentLoanRecords,
    marketplaceInsurance,
    aca1095a: marketplaceInsurance,
    educationExpenses,
    dependentCareProviders: dependentCareData.providers,
    dependentCareExpenses: dependentCareData.expenses,
    iraContributions: iraContributionsData,
    iraAccounts: iraAccountsData,
    cleanEnergyProperties: form5695Data?.cleanEnergyProperties,
    homeImprovements: form5695Data?.homeImprovements,
    educatorExpenses,
    alimonyReceived: alimonyData?.alimonyReceived,
    alimonyPaid: alimonyData?.alimonyPaid,
    selfEmployedHealthInsuranceDeduction: seHealthInsurance,
    priorYearCapitalLossCarryoverShortTerm: capitalLossCarryover?.shortTerm,
    priorYearCapitalLossCarryoverLongTerm: capitalLossCarryover?.longTerm,
    passiveActivityLossAllowance: passiveActivityLoss,
    parentInfo,
    injuredSpouse,
    priorYearTax,
    unreportedTipIncome,
    uncollectedSSTaxWages,
    priorYearAmtCredit: amtCreditData.priorYearAmtCredit,
    priorYearAmtCreditCarryforward:
      amtCreditData.priorYearAmtCreditCarryforward,
    noncashContributions,
    disabilityIncome: scheduleRData.disabilityIncome,
    nontaxablePensionIncome: scheduleRData.nontaxablePensionIncome,
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
  facts: Record<string, unknown>,
  taxCalcResult?: TaxCalculationResult,
  bizCalcResult?: BusinessEntityResult
): SubmissionPayload => {
  const review = requireScreen(snapshot, '/review-confirm')
  const efile = requireScreen(snapshot, '/efile-wizard')
  const taxpayer = requireScreen(snapshot, '/taxpayer-profile')
  const primaryTIN = String(facts.primaryTIN ?? taxpayer.ssn ?? '').replace(
    /\D/g,
    ''
  )
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

  // Prefer engine-computed values; fall back to frontend-provided values
  // For business entities, use bizCalcResult; for individuals, use taxCalcResult
  const totalTax =
    bizCalcResult?.totalTax ??
    taxCalcResult?.totalTax ??
    Number(review.totalTax ?? 0)
  const totalPayments =
    bizCalcResult?.totalPayments ??
    taxCalcResult?.totalPayments ??
    Number(review.totalPayments ?? 0)
  const refund = bizCalcResult
    ? Math.max(0, bizCalcResult.overpayment)
    : taxCalcResult?.refund ??
      Number(review.totalRefund ?? snapshot.estimatedRefund ?? 0)
  const amountOwed =
    bizCalcResult?.amountOwed ??
    taxCalcResult?.amountOwed ??
    Math.max(0, totalTax - totalPayments)

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
        k1Records: facts.k1Records,
        qbiWorksheet: facts.qbiWorksheetEntities,
        qbiDeductionData: facts.qbiDeductionData,
        qbiDetail: facts.qbiDetail,
        qbiAttachmentStatement: asRecord(facts.qbiDetail).attachmentStatement,
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
      credits: creditSummary,
      ...(bizCalcResult
        ? {
            businessEntity: {
              formType: bizCalcResult.formType,
              entityName: bizCalcResult.entityName,
              totalIncome: bizCalcResult.totalIncome,
              totalDeductions: bizCalcResult.totalDeductions,
              taxableIncome: bizCalcResult.taxableIncome,
              adjustedTotalIncome: bizCalcResult.adjustedTotalIncome,
              distributionDeduction: bizCalcResult.distributionDeduction,
              exemption: bizCalcResult.exemption,
              beneficiaryCount: bizCalcResult.beneficiaryCount,
              effectiveTaxRate: bizCalcResult.effectiveTaxRate,
              requiredForms: bizCalcResult.requiredForms,
              hazardFlags: bizCalcResult.hazardFlags,
              corporateTaxAdjustments: bizCalcResult.corporateTaxAdjustments,
              complianceAlerts: bizCalcResult.complianceAlerts,
              ownerAllocations: bizCalcResult.ownerAllocations,
              schedules: bizCalcResult.schedules
            }
          }
        : {})
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
      qbiDetail: facts.qbiDetail,
      rentalSummary,
      foreignSummary,
      creditSummary,
      dependentCount: dependents.length,
      spouse,
      unemploymentCount: asArray(facts.unemploymentRecords).length,
      socialSecurityCount: asArray(facts.socialSecurityRecords).length,
      businessCount: asArray(facts.businessRecords).length,
      k1Count: asArray(facts.k1Records).length,
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
  const businessReturnCapability = isBusinessFormType(snapshot.formType)
    ? getBusinessReturnCapabilityView(snapshot)
    : null
  const w2Records = getW2Records(snapshot, entities)
  const form1099Records = get1099Records(snapshot, entities)
  const dependents = getDependents(snapshot, entities)
  const spouse = getSpouse(snapshot, entities)
  const unemploymentRecords = getUnemploymentRecords(snapshot, entities)
  const socialSecurityRecords = getSocialSecurityRecords(snapshot, entities)
  const iraAccounts = getIRAAccountsData(snapshot, entities)
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
  const unreportedTipIncome = getUnreportedTipIncome(snapshot, entities) ?? 0
  const uncollectedSSTaxWages = getUncollectedSSTaxWages(snapshot, entities)
  const amtCreditData = getAmtCreditData(snapshot, entities)
  const form4137Screen = requireScreen(snapshot, '/form-4137')
  const form8919Screen = requireScreen(snapshot, '/form-8919')
  const form8801Screen = requireScreen(snapshot, '/form-8801')
  const schedule1AData = getSchedule1AData(snapshot, entities)
  const form1040SrEligibility = get1040SrEligibility(snapshot, entities)
  const form8919TotalWages = uncollectedSSTaxWages.reduce(
    (sum, record) => sum + toMoney(record.wagesReceived),
    0
  )
  const form8801TrackedTotal =
    toMoney(amtCreditData.priorYearAmtCredit) +
    toMoney(amtCreditData.priorYearAmtCreditCarryforward)

  const itemFromScreen = (
    id: string,
    screenPath: string,
    fallbackLabel: string,
    opts?: {
      optional?: boolean
      completeWhen?: (data: Record<string, unknown>) => boolean
    }
  ) => {
    const data = requireScreen(snapshot, screenPath)
    const hasData = Object.keys(data).length > 0
    const isComplete = opts?.completeWhen ? opts.completeWhen(data) : hasData
    return {
      status: isComplete
        ? 'complete'
        : hasData
        ? 'in_progress'
        : opts?.optional
        ? 'skipped'
        : 'not_started',
      sublabel: hasData ? fallbackLabel : undefined,
      warnings: [] as Array<Record<string, unknown>>
    }
  }

  return {
    items: {
      'taxpayer-profile': itemFromScreen(
        'taxpayer-profile',
        '/taxpayer-profile',
        'Taxpayer profile saved'
      ),
      spouse: {
        status: spouse
          ? spouse.isComplete
            ? 'complete'
            : 'in_progress'
          : 'skipped',
        sublabel: spouse
          ? `${spouse.firstName} ${spouse.lastName}`.trim() ||
            'Spouse information started'
          : undefined,
        warnings: findings
          .filter((finding) => finding.code === 'SPOUSE-INCOMPLETE')
          .map((finding) => ({
            message: finding.message,
            level: finding.severity
          }))
      },
      household: {
        status: buildStatusFromCollection(dependents, true),
        sublabel:
          dependents.length > 0
            ? `${countCompleted(dependents)}/${
                dependents.length
              } dependents complete`
            : undefined,
        warnings: findings
          .filter((finding) => finding.code.startsWith('DEPENDENT'))
          .map((finding) => ({
            message: finding.message,
            level: finding.severity
          }))
      },
      residency: itemFromScreen(
        'residency',
        '/residency',
        'Residency information saved'
      ),
      'form-1040-sr': {
        status:
          form1040SrEligibility.eligibleFilerCount > 0
            ? 'complete'
            : form1040SrEligibility.taxpayerDobKnown &&
              form1040SrEligibility.spouseDobKnown
            ? 'skipped'
            : 'in_progress',
        sublabel:
          form1040SrEligibility.eligibleFilerCount > 0
            ? `${form1040SrEligibility.eligibleFilerCount} filer${
                form1040SrEligibility.eligibleFilerCount === 1 ? '' : 's'
              } qualify for Form 1040-SR`
            : form1040SrEligibility.taxpayerDobKnown &&
              form1040SrEligibility.spouseDobKnown
            ? 'Standard Form 1040 remains appropriate'
            : 'Add date of birth details to confirm senior-form eligibility',
        warnings: []
      },
      w2s: {
        status: buildStatusFromCollection(w2Records, true),
        sublabel:
          w2Records.length > 0
            ? `${countCompleted(w2Records)}/${
                w2Records.length
              } W-2 records complete`
            : undefined,
        warnings: findings
          .filter((finding) => finding.code === 'W2-INCOMPLETE')
          .map((finding) => ({
            message: finding.message,
            level: finding.severity
          }))
      },
      '1099s': {
        status: buildStatusFromCollection(form1099Records, true),
        sublabel:
          form1099Records.length > 0
            ? `${countCompleted(form1099Records)}/${
                form1099Records.length
              } 1099 records complete`
            : undefined,
        warnings: findings
          .filter((finding) => finding.code === '1099-INCOMPLETE')
          .map((finding) => ({
            message: finding.message,
            level: finding.severity
          }))
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
          .map((finding) => ({
            message: finding.message,
            level: finding.severity
          }))
      },
      rental: {
        status: buildStatusFromCollection(rentalProperties, true),
        sublabel:
          rentalProperties.length > 0
            ? `${countCompleted(rentalProperties)}/${
                rentalProperties.length
              } rental properties complete`
            : undefined,
        warnings: findings
          .filter((finding) => finding.code === 'RENTAL-INCOMPLETE')
          .map((finding) => ({
            message: finding.message,
            level: finding.severity
          }))
      },
      business: {
        status: businessReturnCapability
          ? businessReturnCapability.supportLevel === 'expert_required'
            ? 'in_progress'
            : businessReturnCapability.hasMinimumData
            ? 'complete'
            : 'in_progress'
          : buildStatusFromCollection(businessRecords, true),
        sublabel: businessReturnCapability
          ? businessReturnCapability.supportLevel === 'expert_required'
            ? businessReturnCapability.nonprofitReturnHint === '990N'
              ? 'Expert-required: this nonprofit may qualify for 990-N, but Form 990 self-service is not available here yet'
              : businessReturnCapability.nonprofitReturnHint === '990EZ'
              ? 'Expert-required: this nonprofit fits the 990-EZ size thresholds, but Form 990-family self-service is not available here yet'
              : 'Expert-required: Form 990 self-service is not available in the production backend'
            : businessReturnCapability.hasMinimumData
            ? `${snapshot.formType} entity return facts are ready for calculation`
            : `${snapshot.formType} is supported, but core entity return facts are still missing`
          : businessRecords.length > 0
          ? `${countCompleted(businessRecords)}/${
              businessRecords.length
            } businesses complete`
          : undefined,
        warnings: findings
          .filter(
            (finding) =>
              finding.code === 'BUSINESS-INCOMPLETE' ||
              finding.code === 'QBI-REVIEW' ||
              finding.code === 'BUSINESS-ENTITY-RETURN-INCOMPLETE' ||
              finding.code === 'BUSINESS-FORM-EXPERT-REQUIRED'
          )
          .map((finding) => ({
            message: finding.message,
            level: finding.severity
          }))
      },
      retirement: itemFromScreen(
        'retirement',
        '/ira-retirement',
        'Retirement income reviewed',
        { optional: true }
      ),
      'schedule-1a': {
        status: schedule1AData.isComplete
          ? 'complete'
          : schedule1AData.hasResponse
          ? 'in_progress'
          : 'skipped',
        sublabel:
          schedule1AData.totalDeduction > 0
            ? `$${schedule1AData.totalDeduction.toLocaleString()} tracked`
            : schedule1AData.hasResponse
            ? 'No Schedule 1-A deductions claimed'
            : undefined,
        warnings: findings
          .filter((finding) => finding.code === 'SCHEDULE1A-INCOMPLETE')
          .map((finding) => ({
            message: finding.message,
            level: finding.severity
          }))
      },
      'form-4137': {
        status:
          form4137Screen.hasUnreportedTips === false
            ? 'skipped'
            : unreportedTipIncome > 0
            ? 'complete'
            : form4137Screen.hasUnreportedTips === true ||
              Object.keys(form4137Screen).length > 0
            ? 'in_progress'
            : 'skipped',
        sublabel:
          unreportedTipIncome > 0
            ? `$${unreportedTipIncome.toLocaleString()} entered`
            : undefined,
        warnings: findings
          .filter((finding) => finding.code === 'FORM4137-INCOMPLETE')
          .map((finding) => ({
            message: finding.message,
            level: finding.severity
          }))
      },
      'form-8919': {
        status:
          form8919Screen.hasUncollectedWages === false
            ? 'skipped'
            : form8919TotalWages > 0
            ? 'complete'
            : form8919Screen.hasUncollectedWages === true ||
              Object.keys(form8919Screen).length > 0
            ? 'in_progress'
            : 'skipped',
        sublabel:
          form8919TotalWages > 0
            ? `${uncollectedSSTaxWages.length} wage record${
                uncollectedSSTaxWages.length === 1 ? '' : 's'
              }`
            : undefined,
        warnings: findings
          .filter((finding) => finding.code === 'FORM8919-INCOMPLETE')
          .map((finding) => ({
            message: finding.message,
            level: finding.severity
          }))
      },
      'form-8801': {
        status:
          form8801Screen.hasAmtCredit === false
            ? 'skipped'
            : form8801TrackedTotal > 0
            ? 'complete'
            : form8801Screen.hasAmtCredit === true ||
              Object.keys(form8801Screen).length > 0
            ? 'in_progress'
            : 'skipped',
        sublabel:
          form8801TrackedTotal > 0
            ? `$${form8801TrackedTotal.toLocaleString()} tracked`
            : undefined,
        warnings: findings
          .filter((finding) => finding.code === 'FORM8801-INCOMPLETE')
          .map((finding) => ({
            message: finding.message,
            level: finding.severity
          }))
      },
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
          .map((finding) => ({
            message: finding.message,
            level: finding.severity
          }))
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
          .map((finding) => ({
            message: finding.message,
            level: finding.severity
          }))
      },
      hsa: itemFromScreen('hsa', '/hsa', 'HSA reviewed', { optional: true }),
      ctc: {
        status:
          creditSummary.summary.eligibleCount > 0 ||
          creditSummary.summary.maybeCount > 0 ||
          creditSummary.summary.blockedCount > 0
            ? 'complete'
            : itemFromScreen('ctc', '/credits-v2', 'Credits reviewed', {
                optional: true
              }).status,
        sublabel:
          creditSummary.summary.eligibleCount > 0 ||
          creditSummary.summary.maybeCount > 0 ||
          creditSummary.summary.blockedCount > 0
            ? `${creditSummary.summary.eligibleCount} eligible, ${creditSummary.summary.maybeCount} maybe, ${creditSummary.summary.blockedCount} blocked`
            : undefined,
        warnings: findings
          .filter((finding) => finding.code.startsWith('CREDIT'))
          .map((finding) => ({
            message: finding.message,
            level: finding.severity
          }))
      },
      'your-taxes': itemFromScreen(
        'your-taxes',
        '/your-taxes',
        'Tax details reviewed',
        { optional: true }
      ),
      'state-tax': itemFromScreen(
        'state-tax',
        '/state-tax',
        'State filing reviewed',
        { optional: true }
      ),
      'review-confirm': itemFromScreen(
        'review-confirm',
        '/review-confirm',
        'Review confirmed'
      ),
      'efile-wizard': itemFromScreen(
        'efile-wizard',
        '/efile-wizard',
        'E-file steps completed',
        { optional: true }
      )
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
        complete:
          countCompleted(businessRecords) + countCompleted(qbiWorksheetEntities)
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
          countCompleted(unemploymentRecords) +
          countCompleted(socialSecurityRecords)
      }
    },
    ui: {
      filingPathTreeCollapsed:
        Boolean(
          (
            requireScreen(snapshot, '/checklist').ui as
              | Record<string, unknown>
              | undefined
          )?.filingPathTreeCollapsed
        ) || false
    },
    businessReturnCapability: businessReturnCapability ?? undefined
  }
}

const buildReview = (
  snapshot: FilingSessionSnapshot,
  findings: ReviewFindingRow[],
  entities: SessionEntitySnapshot[]
) => {
  const businessReturnCapability = isBusinessFormType(snapshot.formType)
    ? getBusinessReturnCapabilityView(snapshot)
    : null
  const taxpayer = requireScreen(snapshot, '/taxpayer-profile')
  const efile = requireScreen(snapshot, '/efile-wizard')
  const w2Records = getW2Records(snapshot, entities)
  const form1099Records = get1099Records(snapshot, entities)
  const dependents = getDependents(snapshot, entities)
  const spouse = getSpouse(snapshot, entities)
  const unemploymentRecords = getUnemploymentRecords(snapshot, entities)
  const socialSecurityRecords = getSocialSecurityRecords(snapshot, entities)
  const iraAccounts = getIRAAccountsData(snapshot, entities)
  const taxLots = getTaxLots(snapshot, entities)
  const cryptoAccounts = getCryptoAccounts(snapshot, entities)
  const businessRecords = getBusinessRecords(entities)
  const k1Records = getK1Records(entities)
  const qbiWorksheetEntities = getQBIWorksheetEntities(snapshot)
  const businessSummary = getBusinessSummary(
    snapshot,
    businessRecords,
    qbiWorksheetEntities
  )
  const rentalProperties = getRentalProperties(entities)
  const rentalSummary = getRentalSummary(rentalProperties, k1Records)
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
  const unreportedTipIncome = getUnreportedTipIncome(snapshot, entities) ?? 0
  const uncollectedSSTaxWages = getUncollectedSSTaxWages(snapshot, entities)
  const form8919TotalWages = uncollectedSSTaxWages.reduce(
    (sum, record) => sum + toMoney(record.wagesReceived),
    0
  )
  const w2Box12UncollectedTaxTotal = getW2Box12UncollectedTaxTotal(w2Records)
  const amtCreditData = getAmtCreditData(snapshot, entities)
  const schedule8812Fidelity = getSchedule8812CollectionFidelityData(
    snapshot,
    entities
  )
  const form8879 = getForm8879Data(snapshot, taxpayer, spouse)
  const thirdPartyDesignee = getThirdPartyDesigneeData(snapshot)
  const form8801TrackedTotal =
    toMoney(amtCreditData.priorYearAmtCredit) +
    toMoney(amtCreditData.priorYearAmtCreditCarryforward)
  const sections = [
    ...(businessReturnCapability
      ? [
          {
            id: 'business-entity-return',
            title: 'Business entity return status',
            rows: [
              {
                label: 'Return type',
                value: snapshot.formType,
                editPath: '/situation',
                editLabel: 'Review'
              },
              {
                label: 'Support level',
                value:
                  businessReturnCapability.supportLevel ===
                  'self_service_supported'
                    ? 'Self-service supported'
                    : businessReturnCapability.supportLevel ===
                      'expert_required'
                    ? 'Expert-required'
                    : 'Unsupported',
                editPath:
                  businessReturnCapability.supportLevel === 'expert_required'
                    ? '/situation'
                    : '/business-entity',
                editLabel:
                  businessReturnCapability.supportLevel === 'expert_required'
                    ? 'Review support'
                    : 'Complete facts',
                hasWarning:
                  businessReturnCapability.supportLevel !==
                  'self_service_supported'
              },
              {
                label: 'Readiness',
                value:
                  businessReturnCapability.readiness === 'ready'
                    ? 'Ready for calculation'
                    : businessReturnCapability.readiness === 'expert_required'
                    ? 'Handled by expert workflow'
                    : 'Missing required entity facts',
                editPath:
                  businessReturnCapability.supportLevel === 'expert_required'
                    ? '/situation'
                    : '/business-entity',
                editLabel: 'Review'
              },
              {
                label: 'Missing inputs',
                value:
                  businessReturnCapability.missingInputs.length > 0
                    ? businessReturnCapability.missingInputs.join(', ')
                    : 'None',
                editPath: '/business-entity',
                editLabel: 'Edit',
                hasError:
                  businessReturnCapability.supportLevel ===
                    'self_service_supported' &&
                  !businessReturnCapability.hasMinimumData
              },
              ...(businessReturnCapability.nonprofitRenderedPreview
                ? [
                    {
                      label: 'Suggested nonprofit form',
                      value:
                        businessReturnCapability.nonprofitRenderedPreview
                          .suggestedForm,
                      editPath: '/business-entity',
                      editLabel: 'Review'
                    },
                    {
                      label: 'Rendered organization',
                      value:
                        businessReturnCapability.nonprofitRenderedPreview
                          .organizationName,
                      editPath: '/business-entity',
                      editLabel: 'Edit'
                    },
                    ...(Number(
                      businessReturnCapability.nonprofitRenderedPreview
                        .totalRevenue ?? 0
                    ) > 0
                      ? [
                          {
                            label: 'Rendered total revenue',
                            value: `$${Number(
                              businessReturnCapability.nonprofitRenderedPreview
                                .totalRevenue ?? 0
                            ).toLocaleString()}`,
                            editPath: '/business-entity',
                            editLabel: 'Edit'
                          }
                        ]
                      : []),
                    ...(Number(
                      businessReturnCapability.nonprofitRenderedPreview
                        .netAssetsEndOfYear ?? 0
                    ) > 0
                      ? [
                          {
                            label: 'Rendered net assets',
                            value: `$${Number(
                              businessReturnCapability.nonprofitRenderedPreview
                                .netAssetsEndOfYear ?? 0
                            ).toLocaleString()}`,
                            editPath: '/business-entity',
                            editLabel: 'Edit'
                          }
                        ]
                      : []),
                    ...(businessReturnCapability.nonprofitRenderedPreview
                      .principalOfficerName
                      ? [
                          {
                            label: 'Principal officer',
                            value:
                              businessReturnCapability.nonprofitRenderedPreview
                                .principalOfficerName,
                            editPath: '/business-entity',
                            editLabel: 'Edit'
                          }
                        ]
                      : [])
                  ]
                : [])
            ],
            warnings: findings
              .filter(
                (finding) =>
                  finding.code === 'BUSINESS-ENTITY-RETURN-INCOMPLETE' ||
                  finding.code === 'BUSINESS-FORM-EXPERT-REQUIRED'
              )
              .map((finding) => ({
                id: finding.id,
                level: finding.severity,
                message: finding.message,
                editPath: finding.fix_path ?? '/business-entity',
                editLabel: finding.fix_label ?? 'Review'
              }))
          }
        ]
      : []),
    ...((businessReturnCapability?.nonprofitRenderedPreview?.renderedSections as
      | Array<{ title: string; rows: Array<{ label: string; value: string }> }>
      | undefined)?.map((section, index) => ({
      id: `nonprofit-rendered-package-${index + 1}`,
      title: section.title,
      rows: section.rows.map((row) => ({
        label: row.label,
        value: row.value,
        editPath: '/business-entity',
        editLabel: 'Edit'
      })),
      warnings: []
    })) ?? []),
    {
      id: 'filing-info',
      title: 'Filing information',
      rows: [
        {
          label: 'Filing status',
          value: String(
            taxpayer.filingStatus ?? snapshot.filingStatus
          ).toUpperCase(),
          editPath: '/taxpayer-profile',
          editLabel: 'Edit'
        },
        {
          label: 'Taxpayer',
          value:
            `${String(taxpayer.firstName ?? '')} ${String(
              taxpayer.lastName ?? ''
            )}`.trim() || 'Not entered',
          editPath: '/taxpayer-profile',
          editLabel: 'Edit',
          hasError: !taxpayer.firstName || !taxpayer.lastName
        },
        {
          label: 'Prior-year AGI',
          value: taxpayer.priorYearAgi
            ? `$${Number(taxpayer.priorYearAgi).toLocaleString()}`
            : 'Not entered',
          editPath: '/taxpayer-profile',
          editLabel: 'Edit',
          hasWarning: !taxpayer.priorYearAgi
        },
        {
          label: 'Spouse',
          value: spouse
            ? `${spouse.firstName} ${spouse.lastName}`.trim() ||
              'Spouse started'
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
          value:
            w2Records.length > 0
              ? `${countCompleted(w2Records)}/${w2Records.length} complete`
              : 'None entered',
          editPath: '/w2',
          editLabel: 'Edit'
        },
        {
          label: 'W-2 wages',
          value: `$${w2Records
            .reduce((sum, record) => sum + record.box1Wages, 0)
            .toLocaleString()}`,
          editPath: '/w2',
          editLabel: 'Edit'
        },
        {
          label: '1099 records',
          value:
            form1099Records.length > 0
              ? `${countCompleted(form1099Records)}/${
                  form1099Records.length
                } complete`
              : 'None entered',
          editPath: '/1099',
          editLabel: 'Edit'
        },
        {
          label: '1099 income total',
          value: `$${form1099Records
            .reduce((sum, record) => sum + record.amount, 0)
            .toLocaleString()}`,
          editPath: '/1099',
          editLabel: 'Edit'
        },
        {
          label: 'Unemployment compensation',
          value: `$${unemploymentRecords
            .reduce((sum, record) => sum + record.amount, 0)
            .toLocaleString()}`,
          editPath: '/unemployment-ss',
          editLabel: 'Edit'
        },
        {
          label: 'Social Security benefits',
          value: `$${socialSecurityRecords
            .reduce((sum, record) => sum + record.grossAmount, 0)
            .toLocaleString()}`,
          editPath: '/unemployment-ss',
          editLabel: 'Edit'
        },
        {
          label: 'Retirement distributions',
          value: `$${iraAccounts
            .reduce(
              (sum: number, record: Record<string, unknown>) =>
                sum + toMoney(record.grossDistribution),
              0
            )
            .toLocaleString()}`,
          editPath: '/ira-retirement',
          editLabel: 'Edit'
        },
        ...(unreportedTipIncome > 0
          ? [
              {
                label: 'Unreported tip income (Form 4137)',
                value: `$${unreportedTipIncome.toLocaleString()}`,
                editPath: '/form-4137',
                editLabel: 'Edit'
              }
            ]
          : []),
        ...(form8919TotalWages > 0
          ? [
              {
                label: 'Uncollected SS/Medicare wages (Form 8919)',
                value: `$${form8919TotalWages.toLocaleString()}`,
                editPath: '/form-8919',
                editLabel: 'Edit'
              }
            ]
          : []),
        ...(w2Box12UncollectedTaxTotal > 0
          ? [
              {
                label: 'W-2 box 12 uncollected payroll tax',
                value: `$${w2Box12UncollectedTaxTotal.toLocaleString()}`,
                editPath: '/income/w2',
                editLabel: 'Edit'
              }
            ]
          : [])
      ],
      warnings: findings
        .filter(
          (finding) =>
            finding.code === 'W2-INCOMPLETE' ||
            finding.code === '1099-INCOMPLETE' ||
            finding.code === 'UNEMPLOYMENT-INCOMPLETE' ||
            finding.code === 'SSA-INCOMPLETE' ||
            finding.code === 'FORM4137-INCOMPLETE' ||
            finding.code === 'FORM8919-INCOMPLETE'
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
              ? `${countCompleted(cryptoAccounts)}/${
                  cryptoAccounts.length
                } complete`
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
              ? `${countCompleted(businessRecords)}/${
                  businessRecords.length
                } complete`
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
            finding.code === 'BUSINESS-INCOMPLETE' ||
            finding.code === 'QBI-REVIEW'
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
              ? `${countCompleted(rentalProperties)}/${
                  rentalProperties.length
                } complete`
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
        },
        ...(schedule8812Fidelity.schedule8812EarnedIncomeAdjustments ||
        schedule8812Fidelity.otherFederalWithholdingCredits
          ? [
              {
                label: 'Schedule 8812 special-case inputs',
                value: [
                  schedule8812Fidelity.schedule8812EarnedIncomeAdjustments
                    ? 'earned-income adjustments'
                    : '',
                  schedule8812Fidelity.otherFederalWithholdingCredits
                    ? `${schedule8812Fidelity.otherFederalWithholdingCredits.length} withholding source${
                        schedule8812Fidelity.otherFederalWithholdingCredits
                          .length === 1
                          ? ''
                          : 's'
                      }`
                    : ''
                ]
                  .filter(Boolean)
                  .join(', '),
                editPath: '/schedule-8812-adjustments',
                editLabel: 'Review'
              }
            ]
          : []),
        ...(form8801TrackedTotal > 0
          ? [
              {
                label: 'Prior-year AMT credit inputs',
                value:
                  toMoney(amtCreditData.priorYearAmtCreditCarryforward) > 0
                    ? `$${toMoney(
                        amtCreditData.priorYearAmtCredit
                      ).toLocaleString()} current + $${toMoney(
                        amtCreditData.priorYearAmtCreditCarryforward
                      ).toLocaleString()} carryforward`
                    : `$${toMoney(
                        amtCreditData.priorYearAmtCredit
                      ).toLocaleString()}`,
                editPath: '/form-8801',
                editLabel: 'Review'
              }
            ]
          : [])
      ],
      warnings: findings
        .filter(
          (finding) =>
            finding.code.startsWith('DEPENDENT') ||
            finding.code.startsWith('CREDIT') ||
            finding.code === 'FORM8801-INCOMPLETE'
        )
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
          value: String(
            efile.account
              ? `••••${String(efile.account).slice(-4)}`
              : 'Paper check'
          ),
          editPath: '/efile-wizard',
          editLabel: 'Edit'
        },
        {
          label: 'Signature',
          value: String(efile.signatureText ?? 'Not signed'),
          editPath: '/efile-wizard',
          editLabel: 'Edit',
          hasError: !efile.signatureText
        },
        {
          label: 'Form 8879 consent',
          value:
            form8879?.form8879Consent || form8879?.agreed8879
              ? 'Confirmed'
              : 'Not confirmed',
          editPath: '/efile-wizard',
          editLabel: 'Edit',
          hasError: !form8879?.form8879Consent && !form8879?.agreed8879
        },
        {
          label: 'Primary PIN',
          value: form8879?.taxpayerPIN
            ? `••••${String(form8879.taxpayerPIN).slice(-1)}`
            : 'Not entered',
          editPath: '/efile-wizard',
          editLabel: 'Edit'
        },
        {
          label: 'Third-party designee',
          value: thirdPartyDesignee?.authorizeDiscussion
            ? toText(thirdPartyDesignee.name) || 'Authorized'
            : 'No',
          editPath: '/efile-wizard',
          editLabel: 'Edit',
          hasWarning:
            Boolean(thirdPartyDesignee?.authorizeDiscussion) &&
            (!toText(thirdPartyDesignee?.name) ||
              !toText(thirdPartyDesignee?.phone) ||
              !toText(thirdPartyDesignee?.pin))
        },
        ...(spouse
          ? [
              {
                label: 'Spouse PIN',
                value: form8879?.spousePIN
                  ? `••••${String(form8879.spousePIN).slice(-1)}`
                  : 'Not entered',
                editPath: '/efile-wizard',
                editLabel: 'Edit'
              }
            ]
          : [])
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
  const businessSummary = getBusinessSummary(
    snapshot,
    businessRecords,
    qbiWorksheetEntities
  )
  const businessReturnCapability = isBusinessFormType(snapshot.formType)
    ? getBusinessReturnCapabilityView(snapshot)
    : null
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
  const form4137Screen = requireScreen(snapshot, '/form-4137')
  const form8919Screen = requireScreen(snapshot, '/form-8919')
  const form8801Screen = requireScreen(snapshot, '/form-8801')
  const schedule1AData = getSchedule1AData(snapshot, entities)
  const unreportedTipIncome = getUnreportedTipIncome(snapshot, entities) ?? 0
  const uncollectedSSTaxWages = getUncollectedSSTaxWages(snapshot, entities)
  const amtCreditData = getAmtCreditData(snapshot, entities)
  const noncashContributions = getNoncashContributions(snapshot, entities)
  const itemizedDeductions = getItemizedDeductions(
    snapshot,
    entities,
    noncashContributions
  )
  const yourTaxesScreen = requireScreen(snapshot, '/your-taxes')
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
      message:
        'Your spouse record is missing a name, date of birth, or identifying information.',
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
      message:
        'One or more W-2 forms are missing an employer name, EIN, or wages.',
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
      message:
        'Your Social Security record is missing the gross benefit amount.',
      fix_path: '/unemployment-ss',
      fix_label: 'Complete Social Security details',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (form4137Screen.hasUnreportedTips === true && unreportedTipIncome <= 0) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'FORM4137-INCOMPLETE',
      severity: 'warning',
      title: 'Add your unreported tip amount',
      message:
        'You marked that you had unreported tips, but the amount is still missing.',
      fix_path: '/form-4137',
      fix_label: 'Complete Form 4137',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (
    form8919Screen.hasUncollectedWages === true &&
    uncollectedSSTaxWages.length === 0
  ) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'FORM8919-INCOMPLETE',
      severity: 'warning',
      title: 'Add Form 8919 wage details',
      message:
        'You marked that you had wages without Social Security or Medicare withholding, but the employer wage records are still missing.',
      fix_path: '/form-8919',
      fix_label: 'Complete Form 8919',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (
    form8801Screen.hasAmtCredit === true &&
    toMoney(amtCreditData.priorYearAmtCredit) <= 0 &&
    toMoney(amtCreditData.priorYearAmtCreditCarryforward) <= 0
  ) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'FORM8801-INCOMPLETE',
      severity: 'warning',
      title: 'Add your prior-year AMT credit',
      message:
        'You marked that you have prior-year AMT credit, but the credit or carryforward amount is still missing.',
      fix_path: '/form-8801',
      fix_label: 'Complete Form 8801',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (schedule1AData.hasResponse && !schedule1AData.isComplete) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'SCHEDULE1A-INCOMPLETE',
      severity: 'warning',
      title: 'Finish Schedule 1-A details',
      message:
        'One or more Schedule 1-A deductions is missing the amount or eligibility detail needed to calculate the deduction.',
      fix_path: '/schedule-1a',
      fix_label: 'Complete Schedule 1-A',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (
    taxLots.some((record) => !record.isComplete) ||
    cryptoAccounts.some((record) => !record.isComplete)
  ) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'INVESTMENT-INCOMPLETE',
      severity: 'warning',
      title: 'Finish investment or crypto details',
      message:
        'An investment sale or crypto account is missing required details.',
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
      message:
        'A Schedule C or K-1 record is missing business name or income details.',
      fix_path: '/business-k1',
      fix_label: 'Complete business details',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (
    businessSummary.recordCount > 0 &&
    businessSummary.qbiEligibleCount > 0 &&
    qbiWorksheetEntities.length === 0
  ) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'QBI-REVIEW',
      severity: 'warning',
      title: 'Review the QBI deduction',
      message:
        'Your business income may qualify for the Section 199A deduction. Review the QBI worksheet before filing.',
      fix_path: '/qbi-worksheet',
      fix_label: 'Review QBI worksheet',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (
    qbiWorksheetEntities.some(
      (entity) => !entity.isComplete || entity.warnings.length > 0
    )
  ) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'QBI-INCOMPLETE',
      severity: 'warning',
      title: 'Finish QBI limitation details',
      message:
        'At least one QBI business still needs SSTB, wage, or UBIA review before the Section 199A deduction is final.',
      fix_path: '/qbi-worksheet',
      fix_label: 'Review QBI details',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (itemizedDeductions && Object.values(itemizedDeductions).some(Boolean)) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'SCHEDULEA-REVIEW',
      severity: 'warning',
      title: 'Review itemized deductions',
      message:
        'Mortgage interest, SALT, charity, or other itemized deductions are present. Review Schedule A before filing.',
      fix_path: '/deductions',
      fix_label: 'Review deductions',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (toMoney(yourTaxesScreen.amtIncome) > 0) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'FORM6251-REVIEW',
      severity: 'warning',
      title: 'Review AMT exposure',
      message:
        'You entered potential AMT preference income. Review Form 6251 before filing.',
      fix_path: '/your-taxes',
      fix_label: 'Review AMT',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (businessReturnCapability?.supportLevel === 'expert_required') {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'BUSINESS-FORM-EXPERT-REQUIRED',
      severity: 'warning',
      title: `${snapshot.formType} requires expert help`,
      message: businessReturnCapability.nonprofitReturnHint === '990N'
        ? 'This nonprofit may qualify for 990-N, but TaxFlow still routes Form 990-family work to expert help today.'
        : businessReturnCapability.nonprofitReturnHint === '990EZ'
        ? 'This nonprofit fits the 990-EZ size thresholds, but TaxFlow still routes Form 990-family work to expert help today.'
        : businessReturnCapability.reason ??
          `${snapshot.formType} self-service filing is not available in TaxFlow today.`,
      fix_path: '/situation',
      fix_label: 'Review support path',
      acknowledged: 0,
      metadata_key: null,
      created_at: now,
      updated_at: now
    })
  }

  if (
    businessReturnCapability &&
    businessReturnCapability.supportLevel === 'self_service_supported' &&
    !businessReturnCapability.hasMinimumData
  ) {
    findings.push({
      id: crypto.randomUUID(),
      filing_session_id: sessionId,
      code: 'BUSINESS-ENTITY-RETURN-INCOMPLETE',
      severity: 'error',
      title: `Finish ${snapshot.formType} entity return details`,
      message: `Your ${
        snapshot.formType
      } return is missing required facts: ${businessReturnCapability.missingInputs.join(
        ', '
      )}.`,
      fix_path: '/business-entity',
      fix_label: 'Complete entity return facts',
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
      message:
        'A rental property is missing an address, rent amount, or expense details.',
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
      message:
        'Foreign income, account, or treaty data is missing country, amount, or classification details.',
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
      message:
        'Your nonresident profile is missing visa, citizenship, or day-count details needed to determine the filing path.',
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
      message:
        'Your foreign account balances indicate that FinCEN Form 114 may need to be filed separately from your tax return.',
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
      message:
        'A dependent is missing a name, date of birth, relationship, or SSN.',
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
      message:
        'At least one credit is marked blocked and needs more information before filing.',
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

const inferReviewIssueForm = (
  snapshot: FilingSessionSnapshot,
  fixPath: string | null | undefined
) => {
  if (!fixPath) return snapshot.formType
  if (fixPath.includes('/form-1040-sr')) return '1040-SR'
  if (fixPath.includes('/marketplace-insurance')) return '8962'
  if (fixPath.includes('/deductions') || fixPath.includes('/schedule-a'))
    return 'Schedule A'
  if (fixPath.includes('/schedule-1a')) return 'Schedule 1-A'
  if (fixPath.includes('/schedule-8812-adjustments')) return '8812'
  if (fixPath.includes('/credits-v2') || fixPath.includes('/household'))
    return '8812'
  if (fixPath.includes('/form-4137')) return '4137'
  if (fixPath.includes('/form-8919')) return '8919'
  if (fixPath.includes('/form-8801')) return '8801'
  if (fixPath.includes('/underpayment')) return '2210'
  if (fixPath.includes('/your-taxes')) return '6251'
  if (fixPath.includes('/education-care')) return '8863'
  if (fixPath.includes('/tax-lots') || fixPath.includes('/investments'))
    return '8949'
  if (fixPath.includes('/qbi')) return '8995'
  if (fixPath.includes('/state')) return 'STATE'
  return snapshot.formType
}

const inferReviewIssueLineFamily = (
  code: string,
  fixPath: string | null | undefined
) => {
  const normalizedCode = code.toLowerCase()
  const normalizedPath = (fixPath ?? '').toLowerCase()
  if (normalizedCode.includes('agi') || normalizedPath.includes('identity')) {
    return 'identity_verification'
  }
  if (normalizedPath.includes('form-1040-sr')) {
    return 'senior_return'
  }
  if (normalizedPath.includes('marketplace') || normalizedCode.includes('8962')) {
    return 'marketplace_reconciliation'
  }
  if (normalizedPath.includes('schedule-1a')) {
    return 'obbba_deductions'
  }
  if (
    normalizedPath.includes('/deductions') ||
    normalizedPath.includes('/schedule-a') ||
    normalizedCode.includes('schedulea') ||
    normalizedCode.includes('itemized') ||
    normalizedCode.includes('salt')
  ) {
    return 'itemized_deductions'
  }
  if (normalizedPath.includes('schedule-8812') || normalizedCode.includes('8812')) {
    return 'family_credits'
  }
  if (normalizedPath.includes('underpayment') || normalizedCode.includes('2210')) {
    return 'underpayment_penalty'
  }
  if (normalizedPath.includes('form-4137')) {
    return 'unreported_tips'
  }
  if (normalizedPath.includes('form-8919')) {
    return 'uncollected_payroll_tax'
  }
  if (normalizedPath.includes('form-8801')) {
    return 'amt_credit'
  }
  if (
    normalizedPath.includes('/your-taxes') ||
    normalizedCode.includes('6251') ||
    normalizedCode.includes('amt')
  ) {
    return 'amt'
  }
  if (normalizedPath.includes('household')) {
    return 'dependent_eligibility'
  }
  if (normalizedPath.includes('qbi')) {
    return 'qbi'
  }
  if (normalizedPath.includes('tax-lots') || normalizedPath.includes('investments')) {
    return 'capital_gains'
  }
  if (normalizedPath.includes('education')) {
    return 'education_credits'
  }
  if (normalizedPath.includes('state')) {
    return 'state_filing'
  }
  return 'return_review'
}

const toReviewIssues = (
  snapshot: FilingSessionSnapshot,
  findings: ReviewFindingRow[],
  taxCalcErrors: string[]
): ReviewIssue[] => {
  const findingIssues = findings.map((finding) => ({
    id: finding.id,
    code: finding.code,
    form: inferReviewIssueForm(snapshot, finding.fix_path),
    lineFamily: inferReviewIssueLineFamily(finding.code, finding.fix_path),
    authority: 'backend' as const,
    severity: finding.severity,
    blocking: finding.severity === 'error',
    message: finding.message,
    editPath: finding.fix_path,
    editLabel: finding.fix_label
  }))

  const calcIssues = taxCalcErrors.map((message, index) => ({
    id: `tax-calc-${index + 1}`,
    code: 'TAX-CALC',
    form: snapshot.formType,
    lineFamily: 'tax_calculation',
    authority: 'ustaxes' as const,
    severity: 'error' as const,
    blocking: true,
    message,
    editPath: '/review-confirm',
    editLabel: 'Review tax calculation'
  }))

  return [...findingIssues, ...calcIssues]
}

const sumRecordMoney = (value: unknown) =>
  Object.values(asRecord(value)).reduce<number>(
    (sum, current) => sum + toMoney(current),
    0
  )

const buildAuthoritativePreviewMetrics = (
  snapshot: FilingSessionSnapshot,
  entities: SessionEntitySnapshot[],
  taxSummary: Record<string, unknown> | undefined
) => {
  const dependents = getDependents(snapshot, entities)
  const stateScreen = requireScreen(snapshot, '/state-tax')
  const stateEntries = asArray<Record<string, unknown>>(stateScreen.states)
  const stateWithholdingTotal = stateEntries.reduce(
    (sum, state) => sum + toMoney(state.stateWithheld),
    0
  )
  const schedule8812Fidelity = getSchedule8812CollectionFidelityData(
    snapshot,
    entities
  )
  const noncashContributions = getNoncashContributions(snapshot, entities)
  const itemizedDeductions =
    getItemizedDeductions(snapshot, entities, noncashContributions) ??
    EMPTY_ITEMIZED_DEDUCTIONS
  const underpaymentEntity = entities.find(
    (entity) => entity.entityType === 'underpayment_data'
  )
  const underpaymentData = asRecord(underpaymentEntity?.data)
  const underpaymentScreen = requireScreen(snapshot, '/underpayment')
  const underpaymentRecord =
    Object.keys(underpaymentData).length > 0
      ? underpaymentData
      : asRecord(underpaymentScreen)
  const estimatedPaymentTotal = Object.values(
    asRecord(underpaymentRecord.estimatedPayments)
  ).reduce<number>((sum, value) => sum + toMoney(value), 0)
  const marketplaceScreen = requireScreen(snapshot, '/marketplace-insurance')
  const importedPolicies = entities
    .filter((entity) => entity.entityType === 'aca_1095a')
    .map((entity) => entity.data)
  const marketplacePolicies: Record<string, unknown>[] =
    importedPolicies.length > 0
      ? importedPolicies.map((policy) => asRecord(policy))
      : asArray<Record<string, unknown>>(marketplaceScreen.policies)
  const marketplacePremiumTotal = marketplacePolicies.reduce(
    (sum, policy) =>
      sum +
      toMoney(policy.totalPremiums) +
      sumRecordMoney(policy.monthlyPremiums) +
      sumRecordMoney(policy.premiums),
    0
  )
  const marketplaceAptcTotal = marketplacePolicies.reduce(
    (sum, policy) =>
      sum +
      toMoney(policy.totalAdvancePayment) +
      sumRecordMoney(policy.monthlyAdvancePayment) +
      sumRecordMoney(policy.advancePaymentOfPTC),
    0
  )
  const creditSummary = getCreditSummary(snapshot, dependents)
  const educationCreditEntities = creditSummary.creditEntities.filter(
    (entity) => entity.creditId === 'education'
  )
  const careCreditEntities = creditSummary.creditEntities.filter(
    (entity) => entity.creditId === 'care'
  )
  const qbiEntities = getQBIWorksheetEntities(snapshot)
  const qbiDeductionData = getQbiDeductionData(snapshot)
  const qbiDetail = getQbiDetail(snapshot, qbiEntities, qbiDeductionData)
  const taxLots = getTaxLots(snapshot, entities)
  const yourTaxesScreen = requireScreen(snapshot, '/your-taxes')
  const form4137Screen = requireScreen(snapshot, '/form-4137')
  const form8919Screen = requireScreen(snapshot, '/form-8919')
  const form8801Screen = requireScreen(snapshot, '/form-8801')
  const schedule1AData = getSchedule1AData(
    snapshot,
    entities,
    Number(taxSummary?.agi ?? 0)
  )
  const form1040SrEligibility = get1040SrEligibility(snapshot, entities)
  const unreportedTipIncome = getUnreportedTipIncome(snapshot, entities) ?? 0
  const uncollectedSSTaxWages = getUncollectedSSTaxWages(snapshot, entities)
  const amtCreditData = getAmtCreditData(snapshot, entities)
  const scheduleATotal =
    toMoney(itemizedDeductions.medicalAndDental) +
    toMoney(itemizedDeductions.stateAndLocalTaxes) +
    toMoney(itemizedDeductions.stateAndLocalRealEstateTaxes) +
    toMoney(itemizedDeductions.stateAndLocalPropertyTaxes) +
    toMoney(itemizedDeductions.otherTaxes) +
    toMoney(itemizedDeductions.interest8a) +
    toMoney(itemizedDeductions.interest8b) +
    toMoney(itemizedDeductions.interest8c) +
    toMoney(itemizedDeductions.interest8d) +
    toMoney(itemizedDeductions.investmentInterest) +
    toMoney(itemizedDeductions.charityCashCheck) +
    toMoney(itemizedDeductions.charityOther) +
    toMoney(itemizedDeductions.casualtyLosses) +
    toMoney(itemizedDeductions.otherDeductions)
  const qbiFinalDeduction = qbiEntities.reduce(
    (sum, entity) => sum + toMoney(entity.finalDeduction),
    0
  )

  return {
    global: {
      filingStatus: snapshot.filingStatus,
      formType: snapshot.formType,
      completionPct: snapshot.completionPct,
      estimatedRefund: Number(snapshot.estimatedRefund ?? 0),
      refund: Number(taxSummary?.refund ?? taxSummary?.overpayment ?? 0),
      amountOwed: Number(taxSummary?.amountOwed ?? 0),
      totalTax: Number(taxSummary?.totalTax ?? 0),
      totalPayments: Number(taxSummary?.totalPayments ?? 0),
      dependentCount: dependents.length,
      stateCount: stateEntries.length
    },
    filing_status: {
      filingStatus: snapshot.filingStatus,
      dependentCount: dependents.length
    },
    form_1040_sr: {
      eligibleFilerCount: form1040SrEligibility.eligibleFilerCount,
      primaryEligible: form1040SrEligibility.primaryEligible,
      spouseEligible: form1040SrEligibility.spouseEligible,
      taxpayerDobKnown: form1040SrEligibility.taxpayerDobKnown,
      spouseDobKnown: form1040SrEligibility.spouseDobKnown
    },
    schedule_a: {
      medicalAndDental: toMoney(itemizedDeductions.medicalAndDental),
      saltEntered:
        toMoney(itemizedDeductions.stateAndLocalTaxes) +
        toMoney(itemizedDeductions.stateAndLocalRealEstateTaxes) +
        toMoney(itemizedDeductions.stateAndLocalPropertyTaxes) +
        toMoney(itemizedDeductions.otherTaxes),
      mortgageInterest:
        toMoney(itemizedDeductions.interest8a) +
        toMoney(itemizedDeductions.interest8b) +
        toMoney(itemizedDeductions.interest8c),
      charityCashCheck: toMoney(itemizedDeductions.charityCashCheck),
      charityOther: toMoney(itemizedDeductions.charityOther),
      casualtyLosses: toMoney(itemizedDeductions.casualtyLosses),
      otherDeductions: toMoney(itemizedDeductions.otherDeductions),
      itemizedTotal: scheduleATotal,
      useSalesTax: Boolean(itemizedDeductions.isSalesTax)
    },
    schedule_8812: {
      dependentCount: dependents.length,
      adjustmentTotal: sumRecordMoney(
        schedule8812Fidelity.schedule8812EarnedIncomeAdjustments
      ),
      otherWithholdingCount:
        schedule8812Fidelity.otherFederalWithholdingCredits?.length ?? 0
    },
    eic: {
      dependentCount: dependents.length,
      qualifyingChildCount: dependents.filter((dependent) =>
        Boolean(dependent.isComplete)
      ).length
    },
    schedule_1a: {
      tipAmount: schedule1AData.tipAmount,
      overtimeAmount: schedule1AData.overtimeAmount,
      autoLoanInterestPaid: schedule1AData.autoLoanInterestPaid,
      tipDeduction: schedule1AData.tipsDeduction,
      overtimeDeduction: schedule1AData.overtimeDeduction,
      autoLoanDeduction: schedule1AData.autoLoanDeduction,
      seniorDeduction: schedule1AData.seniorDeduction,
      totalDeduction: schedule1AData.totalDeduction,
      qualifyingSeniorCount: schedule1AData.qualifyingSeniorCount
    },
    form_8962: {
      marketplacePolicyCount: marketplacePolicies.length,
      annualPremiums: marketplacePremiumTotal,
      annualAptc: marketplaceAptcTotal
    },
    form_8863: {
      educationStudentCount: educationCreditEntities.length
    },
    form_2441: {
      careProviderCount: careCreditEntities.length
    },
    form_6251: {
      amtIncome:
        yourTaxesScreen.amtIncome != null ? toMoney(yourTaxesScreen.amtIncome) : null,
      currentTaxableIncome: Number(taxSummary?.taxableIncome ?? 0),
      priorYearAmtCreditCarryforward:
        form8801Screen.priorYearAmtCreditCarryforward != null
          ? toMoney(form8801Screen.priorYearAmtCreditCarryforward)
          : null
    },
    form_4137: {
      hasUnreportedTips: form4137Screen.hasUnreportedTips === true,
      unreportedTips: unreportedTipIncome,
      estimatedPayrollTax: Math.round(unreportedTipIncome * 7.65) / 100
    },
    form_8919: {
      employerCount: uncollectedSSTaxWages.length,
      totalWages: uncollectedSSTaxWages.reduce(
        (sum, record) => sum + toMoney(record.wagesReceived),
        0
      ),
      hasUncollectedWages: form8919Screen.hasUncollectedWages === true
    },
    form_8801: {
      priorYearAmtCredit: toMoney(amtCreditData.priorYearAmtCredit),
      priorYearAmtCreditCarryforward: toMoney(
        amtCreditData.priorYearAmtCreditCarryforward
      ),
      trackedTotal:
        toMoney(amtCreditData.priorYearAmtCredit) +
        toMoney(amtCreditData.priorYearAmtCreditCarryforward)
    },
    form_2210: {
      priorYearTax: getPriorYearTax(snapshot, entities) ?? null,
      currentYearWithholding:
        underpaymentRecord.currentYearWithholding != null
          ? toMoney(underpaymentRecord.currentYearWithholding)
          : null,
      estimatedPaymentTotal,
      currentYearTaxLiability:
        underpaymentRecord.currentYearTaxLiability != null
          ? toMoney(underpaymentRecord.currentYearTaxLiability)
          : null,
      requestWaiver: Boolean(underpaymentRecord.requestWaiver),
      useAnnualizedMethod: Boolean(underpaymentRecord.useAnnualizedMethod)
    },
    schedule_d: {
      taxLotCount: taxLots.length
    },
    qbi: {
      qbiEntityCount: qbiEntities.length,
      finalQBIDeduction: qbiFinalDeduction,
      sstbCount: qbiEntities.filter((entity) => entity.isSSTB).length,
      wageLimitedCount: qbiEntities.filter(
        (entity) => entity.w2Limitation > 0
      ).length,
      formPreference: qbiDetail.formPreference
    },
    state: {
      stateCount: stateEntries.length,
      stateWithholdingTotal
    }
  } as Record<string, Record<string, string | number | boolean | null>>
}

const valuesDiffer = (
  localValue: string | number | boolean | null,
  authoritativeValue: string | number | boolean | null
) => {
  if (typeof localValue === 'number' && typeof authoritativeValue === 'number') {
    return Math.abs(localValue - authoritativeValue) > 1
  }
  return localValue !== authoritativeValue
}

const comparePreviewCalculations = (
  calculations: PreviewCalculationInput[],
  authoritativeMetrics: Record<
    string,
    Record<string, string | number | boolean | null>
  >
) => {
  const diffs: PreviewDiffEntry[] = []

  for (const calculation of calculations) {
    const authoritative =
      authoritativeMetrics[calculation.family] ?? authoritativeMetrics.global
    for (const [key, rawValue] of Object.entries(calculation.metrics ?? {})) {
      if (!(key in authoritative)) continue
      const localValue =
        rawValue === undefined ? null : (rawValue as string | number | boolean | null)
      const authoritativeValue = authoritative[key] ?? null
      if (!valuesDiffer(localValue, authoritativeValue)) continue

      const blocking =
        key === 'filingStatus' ||
        key === 'refund' ||
        key === 'amountOwed' ||
        key === 'totalTax'
      diffs.push({
        id: `${calculation.id}:${key}`,
        family: calculation.family,
        key,
        localValue,
        authoritativeValue,
        severity: blocking ? 'error' : 'warning',
        blocking,
        message: `${calculation.label ?? calculation.family} differs from the authoritative backend result for ${key}.`,
        editPath: calculation.editPath ?? null
      })
    }
  }

  return diffs
}

export class AppSessionService {
  constructor(
    private readonly env: Env,
    private readonly repository: TaxRepository,
    private readonly artifacts: ArtifactStore,
    private readonly apiService: ApiService
  ) {}

  private async upsertSessionEntityInternal(
    sessionId: string,
    entityType: string,
    entityId: string,
    status: string,
    label: string | undefined,
    data: Record<string, unknown>
  ) {
    const now = nowIso()
    const rowId = makeSessionEntityRowId(sessionId, entityType, entityId)
    const dataKey = `filing-sessions/${sessionId}/entities/${entityType}/${entityId}.json`
    await this.artifacts.putJson(dataKey, data)
    await this.env.USTAXES_DB.prepare(
      `INSERT INTO session_entities (
          id, filing_session_id, entity_type, entity_key, status, label, data_key, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        ON CONFLICT(filing_session_id, entity_type, entity_key) DO UPDATE SET
          status = excluded.status,
          label = excluded.label,
          data_key = excluded.data_key,
          updated_at = excluded.updated_at`
    )
      .bind(
        rowId,
        sessionId,
        entityType,
        entityId,
        status,
        label ?? null,
        dataKey,
        now,
        now
      )
      .run()
  }

  private async runDocumentExtraction(
    sessionId: string,
    documentId: string,
    body: z.infer<typeof documentCreateSchema>,
    context: DocumentContext = {}
  ): Promise<{
    artifactKey: string | null
    metadata: Record<string, unknown>
    status: z.infer<typeof documentCreateSchema>['status']
    cluster: z.infer<typeof documentCreateSchema>['cluster']
    clusterConfidence: number
  }> {
    let artifactKey: string | null = null
    const metadata = {
      ...body.metadata
    } as Record<string, unknown>
    let extracted: ExtractedDocument | null = null

    const override = asRecord(metadata.extractionOverride)
    if (Object.keys(override).length > 0) {
      extracted = {
        documentType:
          typeof override.documentType === 'string'
            ? (override.documentType as ExtractedDocument['documentType'])
            : 'unknown',
        ...(override as Record<string, unknown>),
        confidence: toMoney(override.confidence) || 0.85,
        processingTimeMs: toMoney(override.processingTimeMs)
      } as ExtractedDocument
    }

    if (!extracted && body.contentBase64) {
      const bytes = decodeBase64Content(body.contentBase64)
      if (bytes) {
        artifactKey = `filing-sessions/${sessionId}/documents/${documentId}/artifact.bin`
        await this.env.ARTIFACTS_BUCKET.put(artifactKey, bytes, {
          httpMetadata: { contentType: body.mimeType }
        })

        try {
          extracted = await extractDocumentFromBytes(
            bytes,
            body.mimeType,
            body.name,
            this.env.AI
          )
        } catch (error) {
          metadata.ocrIssue =
            error instanceof Error
              ? error.message
              : 'We could not extract fields from this document yet.'
        }
      }
    }

    if (!artifactKey && body.contentBase64) {
      artifactKey = `filing-sessions/${sessionId}/documents/${documentId}/content.json`
      await this.artifacts.putJson(artifactKey, {
        contentBase64: body.contentBase64,
        mimeType: body.mimeType
      })
    }

    let status = body.status
    let cluster = body.cluster
    let clusterConfidence = body.clusterConfidence

    if (extracted) {
      const fields = buildDocumentFieldsFromExtraction(extracted)
      const sourceTextSample = extractDocumentSourceTextSample(extracted)
      const importedEntities = buildEntitiesFromDocumentExtraction(
        documentId,
        body.name,
        extracted,
        context
      )
      const interviewGuidance = buildDocumentInterviewGuidance(extracted)
      const extractedEntityRefs = importedEntities.map((entity) => ({
        entityType: entity.entityType,
        entityId: entity.entityId,
        status: entity.status,
        label: entity.label
      }))
      metadata.extraction = extracted
      metadata.fields = fields
      metadata.sourceTextSample = sourceTextSample || metadata.sourceTextSample
      metadata.documentType = extracted.documentType
      metadata.extractedAt = nowIso()
      metadata.extractedEntities = extractedEntityRefs
      metadata.extractedEntity =
        importedEntities.length === 1
          ? extractedEntityRefs[0]
          : null
      metadata.interviewGuidance = interviewGuidance
      metadata.prefillSummary = buildDocumentPrefillSummary(
        extracted,
        importedEntities
      )
      metadata.reconciliationSummary = buildDocumentReconciliationSummary(
        extracted,
        {
          ...context,
          currentDocumentId: documentId
        }
      )
      metadata.ocrIssue =
        extracted.documentType === 'unknown'
          ? metadata.ocrIssue ??
            'We could not classify this document with high confidence yet.'
          : metadata.ocrIssue

      cluster = inferDocumentClusterFromExtraction(extracted)
      clusterConfidence = extracted.confidence
      status =
        extracted.documentType === 'unknown'
          ? 'ambiguous'
          : fields.length > 0
          ? 'extracted'
          : 'needs_review'

      if (importedEntities.length > 0) {
        const existingEntities = await this.loadSessionEntities(sessionId)
        for (const importedEntity of importedEntities) {
          const existingEntity = existingEntities.find(
            (entity) =>
              entity.entityType === importedEntity.entityType &&
              entity.id === importedEntity.entityId
          )
          const mergedData = existingEntity
            ? mergeImportedEntityData(existingEntity.data, importedEntity.data)
            : importedEntity.data

          await this.upsertSessionEntityInternal(
            sessionId,
            importedEntity.entityType,
            importedEntity.entityId,
            importedEntity.status,
            importedEntity.label,
            mergedData
          )
        }
      }
    } else if (body.contentBase64) {
      metadata.ocrIssue =
        metadata.ocrIssue ??
        (body.mimeType.startsWith('image/')
          ? 'OCR has not completed yet for this upload.'
          : 'Preview extraction currently works best for images. You can still review and import this document manually.')
    }

    return {
      artifactKey,
      metadata,
      status,
      cluster,
      clusterConfidence
    }
  }

  async upsertUser(user: AppUserClaims): Promise<void> {
    const now = nowIso()
    await this.env.USTAXES_DB.prepare(
      `INSERT INTO users (id, email, tin, display_name, created_at, updated_at, last_login_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
           email = excluded.email,
           tin = excluded.tin,
           display_name = excluded.display_name,
           updated_at = excluded.updated_at,
           last_login_at = excluded.last_login_at`
    )
      .bind(
        user.sub,
        user.email,
        user.tin ?? null,
        user.displayName ?? null,
        now,
        now,
        now
      )
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

    await this.env.USTAXES_DB.prepare(
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
      formType: (patch.formType ??
        current.formType) as FilingSessionSnapshot['formType'],
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
    await this.env.USTAXES_DB.prepare(
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
    const result = await this.env.USTAXES_DB.prepare(
      `SELECT id, filing_session_id, entity_type, entity_key, status, label, data_key, created_at, updated_at
         FROM session_entities
         WHERE filing_session_id = ?1
         ORDER BY updated_at DESC`
    )
      .bind(sessionId)
      .all<SessionEntityRow>()

    return Promise.all(
      (result.results ?? []).map(async (row) => ({
        id: row.entity_key,
        entityType: row.entity_type,
        entityKey: row.entity_key,
        status: row.status,
        label: row.label,
        data:
          (await this.artifacts.getJson<Record<string, unknown>>(
            row.data_key
          )) ?? {},
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    )
  }

  private async loadSessionDocuments(
    sessionId: string
  ): Promise<
    Array<{
      id: string
      name: string
      mimeType: string
      status: string
      cluster: string
      clusterConfidence: number
      pages: number
      artifactPath: string | null
      metadata: Record<string, unknown>
      createdAt: string
      updatedAt: string
    }>
  > {
    const result = await this.env.USTAXES_DB.prepare(
      `SELECT id, filing_session_id, name, mime_type, status, cluster, cluster_confidence, pages, artifact_key, metadata_key, created_at, updated_at
         FROM documents
         WHERE filing_session_id = ?1
         ORDER BY updated_at DESC, created_at DESC`
    )
      .bind(sessionId)
      .all<DocumentRow>()

    return Promise.all(
      (result.results ?? []).map(async (row) => ({
        id: row.id,
        name: row.name,
        mimeType: row.mime_type,
        status: row.status,
        cluster: row.cluster,
        clusterConfidence: row.cluster_confidence,
        pages: row.pages,
        artifactPath: row.artifact_key
          ? `/app/v1/filing-sessions/${sessionId}/documents/${row.id}/artifact`
          : null,
        metadata:
          (await this.artifacts.getJson<Record<string, unknown>>(
            row.metadata_key
          )) ?? {},
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    )
  }

  private async refreshDocumentReconciliationSummaries(
    row: FilingSessionRow
  ): Promise<void> {
    const snapshot = await this.getSnapshot(row)
    const entities = await this.loadSessionEntities(row.id)
    const documents = await this.loadSessionDocuments(row.id)

    await Promise.all(
      documents.map(async (document) => {
        const extraction = getDocumentExtraction(document)
        if (!extraction) return
        const metadata = { ...document.metadata }
        metadata.reconciliationSummary = buildDocumentReconciliationSummary(
          extraction,
          {
            snapshot,
            entities,
            documents: documents.map((entry) => ({
              id: entry.id,
              name: entry.name,
              metadata: entry.metadata
            })),
            currentDocumentId: document.id
          }
        )
        const metadataKey = `filing-sessions/${row.id}/documents/${document.id}/metadata.json`
        await this.artifacts.putJson(metadataKey, metadata)
      })
    )
  }

  async listEntities(sessionId: string, user: AppUserClaims) {
    await this.requireSession(sessionId, user.sub)
    return { entities: await this.loadSessionEntities(sessionId) }
  }

  async listDocuments(sessionId: string, user: AppUserClaims) {
    await this.requireSession(sessionId, user.sub)
    return { documents: await this.loadSessionDocuments(sessionId) }
  }

  async putEntity(
    sessionId: string,
    entityType: string,
    entityId: string,
    rawBody: unknown,
    user: AppUserClaims
  ) {
    const row = await this.requireSession(sessionId, user.sub)
    const body = entitySchema.parse(rawBody ?? {})
    const now = nowIso()
    const rowId = makeSessionEntityRowId(sessionId, entityType, entityId)
    const dataKey = `filing-sessions/${sessionId}/entities/${entityType}/${entityId}.json`
    await this.artifacts.putJson(dataKey, body.data)
    await this.env.USTAXES_DB.prepare(
      `INSERT INTO session_entities (
          id, filing_session_id, entity_type, entity_key, status, label, data_key, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        ON CONFLICT(filing_session_id, entity_type, entity_key) DO UPDATE SET
          status = excluded.status,
          label = excluded.label,
          data_key = excluded.data_key,
          updated_at = excluded.updated_at`
    )
      .bind(
        rowId,
        sessionId,
        entityType,
        entityId,
        body.status,
        body.label ?? null,
        dataKey,
        now,
        now
      )
      .run()

    await this.refreshDocumentReconciliationSummaries(row)

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
    const row = await this.requireSession(sessionId, user.sub)
    await this.env.USTAXES_DB.prepare(
      `DELETE FROM session_entities
         WHERE filing_session_id = ?1 AND entity_type = ?2 AND entity_key = ?3`
    )
      .bind(sessionId, entityType, entityId)
      .run()
    await this.refreshDocumentReconciliationSummaries(row)
    return { deleted: true }
  }

  async createDocument(
    sessionId: string,
    rawBody: unknown,
    user: AppUserClaims
  ) {
    const row = await this.requireSession(sessionId, user.sub)
    const body = documentCreateSchema.parse(rawBody ?? {})
    const id = crypto.randomUUID()
    const now = nowIso()
    const metadataKey = `filing-sessions/${sessionId}/documents/${id}/metadata.json`
    const extracted = await this.runDocumentExtraction(sessionId, id, body, {
      snapshot: await this.getSnapshot(row),
      entities: await this.loadSessionEntities(row.id),
      documents: await this.loadSessionDocuments(row.id)
    })
    await this.artifacts.putJson(metadataKey, extracted.metadata)
    await this.env.USTAXES_DB.prepare(
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
        extracted.status,
        extracted.cluster,
        extracted.clusterConfidence,
        body.pages,
        extracted.artifactKey,
        metadataKey,
        now,
        now
      )
      .run()

    await this.refreshDocumentReconciliationSummaries(row)

    return this.getDocument(sessionId, id, user)
  }

  async createDocumentsBatch(
    sessionId: string,
    rawBody: unknown,
    user: AppUserClaims
  ) {
    await this.requireSession(sessionId, user.sub)
    const body = documentBatchCreateSchema.parse(rawBody ?? {})
    const createdDocuments = []

    for (const documentBody of body.documents) {
      const created = await this.createDocument(sessionId, documentBody, user)
      createdDocuments.push(created.document)
    }

    return {
      documents: createdDocuments,
      summary: buildDocumentBatchSummary(createdDocuments)
    }
  }

  async getDocument(
    sessionId: string,
    documentId: string,
    user: AppUserClaims
  ) {
    await this.requireSession(sessionId, user.sub)
    const row = await this.env.USTAXES_DB.prepare(
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
        artifactPath: row.artifact_key
          ? `/app/v1/filing-sessions/${sessionId}/documents/${row.id}/artifact`
          : null,
        metadata:
          (await this.artifacts.getJson<Record<string, unknown>>(
            row.metadata_key
          )) ?? {},
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    }
  }

  async getDocumentArtifact(
    sessionId: string,
    documentId: string,
    user: AppUserClaims
  ) {
    await this.requireSession(sessionId, user.sub)
    const row = await this.env.USTAXES_DB.prepare(
      `SELECT id, name, mime_type, artifact_key
         FROM documents
         WHERE filing_session_id = ?1 AND id = ?2`
    )
      .bind(sessionId, documentId)
      .first<Pick<DocumentRow, 'id' | 'name' | 'mime_type' | 'artifact_key'>>()

    if (!row) {
      throw new HttpError(404, 'Document not found')
    }
    if (!row.artifact_key) {
      throw new HttpError(404, 'Document source artifact not available')
    }

    if (row.artifact_key.endsWith('.json')) {
      const stored =
        (await this.artifacts.getJson<Record<string, unknown>>(row.artifact_key)) ??
        {}
      const bytes = decodeBase64Content(toText(stored.contentBase64))
      if (!bytes) {
        throw new HttpError(404, 'Document source artifact not available')
      }
      return {
        filename: row.name,
        mimeType: toText(stored.mimeType) || row.mime_type,
        bytes
      }
    }

    const object = await this.env.ARTIFACTS_BUCKET.get(row.artifact_key)
    if (!object) {
      throw new HttpError(404, 'Document source artifact not available')
    }

    return {
      filename: row.name,
      mimeType: object.httpMetadata?.contentType || row.mime_type,
      bytes: new Uint8Array(await object.arrayBuffer())
    }
  }

  async getPrintMailFilledPdf(sessionId: string, user: AppUserClaims) {
    const row = await this.requireSession(sessionId, user.sub)
    const snapshot = await this.getSnapshot(row)

    const pdfGenerator = resolveFilledPdfGenerator(
      snapshot.taxYear,
      snapshot.formType
    )
    if (!pdfGenerator) {
      throw new HttpError(
        409,
        `${snapshot.formType} filled PDF generation is not available for tax year ${snapshot.taxYear} yet`
      )
    }

    const entities = await this.loadSessionEntities(row.id)
    const facts = toFacts(row, snapshot, entities)
    const computed = await this.computeTaxSummary(sessionId, snapshot, facts)
    const requiredPdfTags = buildRequiredPinnedPdfTags(
      snapshot,
      asRecord(computed.taxSummary),
      facts
    )
    const missingTags = missingPinnedPdfTags(
      snapshot.taxYear,
      snapshot.formType,
      requiredPdfTags
    )
    if (missingTags.length > 0) {
      throw new HttpError(
        409,
        `Filled IRS PDF generation is not available for this return yet. Missing pinned templates: ${missingTags.join(
          ', '
        )}`
      )
    }
    const factsHash = await hashPayload({
      formType: snapshot.formType,
      taxYear: snapshot.taxYear,
      filingStatus: snapshot.filingStatus,
      facts,
      requiredPdfTags,
      output: 'filled-irs-pdf'
    })
    const pdfKey = `filing-sessions/${sessionId}/print-mail/filled-${factsHash}.pdf`
    const cached = await this.env.ARTIFACTS_BUCKET.get(pdfKey)
    if (cached) {
      return {
        filename: `taxflow-${snapshot.taxYear}-${snapshot.formType.toLowerCase()}-filled-return.pdf`,
        bytes: new Uint8Array(await cached.arrayBuffer())
      }
    }

    const { info, assets } = buildInformationAndAssetsFromFacts(facts)
    const downloader = async (url: string): Promise<PDFDocument> => {
      const pdfName = url.split('/').pop()
      if (!pdfName) {
        throw new HttpError(500, 'Failed to resolve IRS form PDF filename')
      }

      const frontendBaseUrl =
        this.env.USTAXES_FRONTEND_URL || TAXFLOW_FRONTEND_URL

      if (supportsPinnedIrsTemplates(snapshot.taxYear, snapshot.formType)) {
        const pinnedResponse = await fetch(
          `${frontendBaseUrl}/forms/Y${snapshot.taxYear}/irs/${pdfName}`
        )
        if (pinnedResponse.ok) {
          return PDFDocument.load(await pinnedResponse.arrayBuffer())
        }
        throw new HttpError(
          502,
          `Pinned IRS PDF template is missing for tax year ${snapshot.taxYear}: ${pdfName}`
        )
      }
      throw new HttpError(
        409,
        `Filled IRS PDF generation is not available for tax year ${snapshot.taxYear} yet`
      )
    }

    const pdfResult = await pdfGenerator(info, assets)(downloader)
    if (isLeft(pdfResult)) {
      throw new HttpError(
        422,
        `Could not build filled IRS PDF: ${pdfResult.left.map(String).join('; ')}`
      )
    }

    await this.env.ARTIFACTS_BUCKET.put(pdfKey, pdfResult.right, {
      httpMetadata: {
        contentType: 'application/pdf'
      }
    })

    return {
      filename: `taxflow-${snapshot.taxYear}-${snapshot.formType.toLowerCase()}-filled-return.pdf`,
      bytes: pdfResult.right
    }
  }

  async patchDocument(
    sessionId: string,
    documentId: string,
    rawBody: unknown,
    user: AppUserClaims
  ) {
    const row = await this.requireSession(sessionId, user.sub)
    const snapshot = await this.getSnapshot(row)
    const entities = await this.loadSessionEntities(row.id)
    const documents = await this.loadSessionDocuments(row.id)
    const current = await this.getDocument(sessionId, documentId, user)
    const patch = documentPatchSchema.parse(rawBody ?? {})
    const metadata = {
      ...(current.document.metadata as Record<string, unknown>),
      ...(patch.metadata ?? {})
    }
    const fieldEdits = asRecord(metadata.fieldEdits)
    let correctedExtraction: ExtractedDocument | null = null
    if (Object.keys(fieldEdits).length > 0) {
      const currentExtraction = asRecord(metadata.extraction)
      if (toText(currentExtraction.documentType)) {
        correctedExtraction = applyFieldEditsToExtractedDocument(
          currentExtraction as unknown as ExtractedDocument,
          fieldEdits
        )
        const fields = buildDocumentFieldsFromExtraction(correctedExtraction)
        const sourceTextSample =
          extractDocumentSourceTextSample(correctedExtraction)
        const importedEntities = buildEntitiesFromDocumentExtraction(
          documentId,
          current.document.name,
          correctedExtraction,
          { snapshot, entities }
        )
        const extractedEntityRefs = importedEntities.map((entity) => ({
          entityType: entity.entityType,
          entityId: entity.entityId,
          status: entity.status,
          label: entity.label
        }))
        metadata.extraction = correctedExtraction
        metadata.fields = fields
        metadata.sourceTextSample = sourceTextSample || metadata.sourceTextSample
        metadata.documentType = correctedExtraction.documentType
        metadata.extractedAt = nowIso()
        metadata.extractedEntities = extractedEntityRefs
        metadata.extractedEntity =
          importedEntities.length === 1 ? extractedEntityRefs[0] : null
        metadata.interviewGuidance =
          buildDocumentInterviewGuidance(correctedExtraction)
        metadata.prefillSummary = buildDocumentPrefillSummary(
          correctedExtraction,
          importedEntities
        )
        metadata.reconciliationSummary = buildDocumentReconciliationSummary(
          correctedExtraction,
          {
            snapshot,
            entities,
            documents: documents.map((document) => ({
              id: document.id,
              name: document.name,
              metadata: document.metadata
            })),
            currentDocumentId: documentId
          }
        )
      }
    }
    const metadataRow = await this.env.USTAXES_DB.prepare(
      `SELECT metadata_key FROM documents WHERE filing_session_id = ?1 AND id = ?2`
    )
      .bind(sessionId, documentId)
      .first<{ metadata_key: string }>()
    if (!metadataRow) {
      throw new HttpError(404, 'Document not found')
    }
    await this.artifacts.putJson(metadataRow.metadata_key, metadata)
    const extractedEntities = [
      ...asArray<Record<string, unknown>>(metadata.extractedEntities),
      ...(() => {
        const single = asRecord(metadata.extractedEntity)
        return toText(single.entityType) && toText(single.entityId) ? [single] : []
      })()
    ]
    if (patch.status === 'confirmed') {
      const extractedForImport =
        correctedExtraction ??
        (toText(asRecord(metadata.extraction).documentType)
          ? (asRecord(metadata.extraction) as unknown as ExtractedDocument)
          : null)
      const importedEntities = extractedForImport
        ? buildEntitiesFromDocumentExtraction(
            documentId,
            current.document.name,
            extractedForImport,
            { snapshot, entities }
          )
        : []

      if (importedEntities.length > 0) {
        for (const importedEntity of importedEntities) {
          await this.upsertSessionEntityInternal(
            sessionId,
            importedEntity.entityType,
            importedEntity.entityId,
            'complete',
            importedEntity.label || current.document.name,
            importedEntity.data
          )
        }
      } else {
        for (const extractedEntity of extractedEntities) {
          const entityType = toText(extractedEntity.entityType)
          const entityId = toText(extractedEntity.entityId)
          if (!entityType || !entityId) continue
          const dataKey = `filing-sessions/${sessionId}/entities/${entityType}/${entityId}.json`
          const currentData =
            (await this.artifacts.getJson<Record<string, unknown>>(dataKey)) ?? {}
          await this.upsertSessionEntityInternal(
            sessionId,
            entityType,
            entityId,
            'complete',
            toText(extractedEntity.label) || current.document.name,
            currentData
          )
        }
      }
    }
    const nextCluster =
      patch.cluster ??
      (correctedExtraction
        ? inferDocumentClusterFromExtraction(correctedExtraction)
        : null)
    const nextClusterConfidence =
      patch.clusterConfidence ??
      (correctedExtraction ? correctedExtraction.confidence : null)
    await this.env.USTAXES_DB.prepare(
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
        nextCluster,
        nextClusterConfidence,
        patch.pages ?? null,
        nowIso(),
        sessionId,
        documentId
      )
      .run()
    await this.refreshDocumentReconciliationSummaries(row)
    return this.getDocument(sessionId, documentId, user)
  }

  async getChecklist(sessionId: string, user: AppUserClaims) {
    const row = await this.requireSession(sessionId, user.sub)
    const snapshot = await this.getSnapshot(row)
    const entities = await this.loadSessionEntities(row.id)
    const findings = await this.syncReviewFindings(row.id, snapshot, entities)
    const businessReturnCapability = isBusinessFormType(snapshot.formType)
      ? getBusinessReturnCapabilityView(snapshot)
      : null
    return {
      checklist: buildChecklist(snapshot, entities, findings),
      businessFormCapability: businessReturnCapability,
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
    const facts = toFacts(row, snapshot, entities)
    const computed = await this.computeTaxSummary(sessionId, snapshot, facts)
    const businessReturnCapability = isBusinessFormType(snapshot.formType)
      ? getBusinessReturnCapabilityView(snapshot)
      : null

    return {
      review: buildReview(snapshot, findings, entities),
      taxSummary: computed.taxSummary,
      taxCalcErrors: computed.taxCalcErrors,
      businessFormCapability:
        computed.businessFormCapability ?? businessReturnCapability
    }
  }

  async getReviewIssues(sessionId: string, user: AppUserClaims) {
    const row = await this.requireSession(sessionId, user.sub)
    const snapshot = await this.getSnapshot(row)
    const entities = await this.loadSessionEntities(row.id)
    const findings = await this.syncReviewFindings(row.id, snapshot, entities)
    const facts = toFacts(row, snapshot, entities)
    const computed = await this.computeTaxSummary(sessionId, snapshot, facts)

    return {
      reviewIssues: toReviewIssues(
        snapshot,
        findings,
        computed.taxCalcErrors ?? []
      )
    }
  }

  async getPreviewDiff(
    sessionId: string,
    rawBody: unknown,
    user: AppUserClaims
  ) {
    const row = await this.requireSession(sessionId, user.sub)
    const snapshot = await this.getSnapshot(row)
    const entities = await this.loadSessionEntities(row.id)
    const facts = toFacts(row, snapshot, entities)
    const computed = await this.computeTaxSummary(sessionId, snapshot, facts)
    const body = previewDiffSchema.parse(rawBody ?? {})
    const authoritativeMetrics = buildAuthoritativePreviewMetrics(
      snapshot,
      entities,
      computed.taxSummary
    )
    const calculations = body.calculations as PreviewCalculationInput[]
    const mismatches = comparePreviewCalculations(
      calculations,
      authoritativeMetrics
    )

    return {
      previewDiff: {
        calculations,
        authoritativeMetrics,
        mismatches,
        hasBlockingDiffs: mismatches.some((mismatch) => mismatch.blocking)
      }
    }
  }

  async getBusinessPackage(sessionId: string, user: AppUserClaims) {
    const row = await this.requireSession(sessionId, user.sub)
    const snapshot = await this.getSnapshot(row)
    if (!isBusinessFormType(snapshot.formType)) {
      throw new HttpError(
        409,
        `${snapshot.formType} does not use the business/nonprofit package flow`
      )
    }

    const entities = await this.loadSessionEntities(row.id)
    const documents = await this.loadSessionDocuments(row.id)
    const findings = await this.syncReviewFindings(row.id, snapshot, entities)
    const facts = toFacts(row, snapshot, entities)
    const computed = await this.computeTaxSummary(sessionId, snapshot, facts)
    const capability =
      computed.businessFormCapability ?? getBusinessReturnCapabilityView(snapshot)
    const reviewIssues = toReviewIssues(
      snapshot,
      findings,
      computed.taxCalcErrors ?? []
    )
    const requiredForms = Array.from(
      new Set(
        [
          snapshot.formType,
          ...asArray<unknown>(computed.taxSummary?.schedules)
            .map((schedule) => toText(schedule))
            .filter(Boolean)
        ].filter(Boolean)
      )
    )
    const renderedArtifacts = [
      {
        type: 'review',
        label: 'Review packet',
        path: `/app/v1/filing-sessions/${row.id}/review`
      },
      {
        type: 'checklist',
        label: 'Checklist',
        path: `/app/v1/filing-sessions/${row.id}/checklist`
      }
    ]

    const businessPackage: BusinessExpertPackage = {
      entityType: snapshot.formType,
      supportLevel: toText(asRecord(capability).supportLevel) || 'unknown',
      readiness: toText(asRecord(capability).readiness) || 'needs_input',
      reasonCodes: [
        toText(asRecord(capability).supportLevel) || 'unknown_support_level',
        ...asArray<unknown>(asRecord(capability).missingInputs).map(
          (input) => `missing:${toText(input)}`
        )
      ].filter(Boolean),
      requiredForms,
      renderedArtifacts,
      filledPdfAvailability: {
        available: supportsPinnedIrsTemplates(snapshot.taxYear, snapshot.formType),
        reason: supportsPinnedIrsTemplates(snapshot.taxYear, snapshot.formType)
          ? 'Template-backed filled PDFs are available for this packet.'
          : 'This packet currently uses rendered previews and expert handoff artifacts.'
      },
      handoffStatus:
        toText(asRecord(capability).supportLevel) === 'expert_required'
          ? 'expert_required'
          : toText(asRecord(capability).readiness) === 'ready'
          ? 'ready_for_review'
          : 'needs_input',
      missingFacts: asArray<unknown>(asRecord(capability).missingInputs).map(
        (input) => toText(input)
      ),
      sourceDocuments: documents.map((document) => ({
        id: document.id,
        name: document.name,
        cluster: document.cluster,
        status: document.status,
        artifactPath: document.artifactPath
      })),
      reviewIssues
    }

    return { businessPackage }
  }

  async getStateCapabilities(rawQuery: unknown) {
    const query = stateCapabilitiesQuerySchema.parse(rawQuery ?? {})
    const taxYear = query.taxYear ?? 2025
    const capability = query.stateCode
      ? resolveStateCapability(this.env, query.stateCode, taxYear)
      : null

    return {
      stateCapabilities: capability
        ? [capability]
        : listStateCapabilities(this.env, taxYear),
      supportTargets: {
        implementedTaxYears: [2024, 2025],
        forecastOnlyTaxYears: [2026]
      }
    }
  }

  async syncReturn(sessionId: string, user: AppUserClaims) {
    const row = await this.requireSession(sessionId, user.sub)
    const snapshot = await this.getSnapshot(row)
    const entities = await this.loadSessionEntities(row.id)
    const facts = toFacts(row, snapshot, entities)
    const computed = await this.computeTaxSummary(sessionId, snapshot, facts)
    const taxSummary = computed.taxSummary
    const taxCalcErrors = computed.taxCalcErrors
    const businessReturnCapability = isBusinessFormType(snapshot.formType)
      ? getBusinessReturnCapabilityView(snapshot)
      : null

    // Update estimated refund on the session
    if (taxSummary) {
      const refund = Number(taxSummary.refund ?? taxSummary.overpayment ?? 0)
      const amountOwed = Number(taxSummary.amountOwed ?? 0)
      const estimatedRefund = refund > 0 ? refund : -amountOwed
      await this.env.USTAXES_DB.prepare(
        `UPDATE filing_sessions SET estimated_refund = ?1, updated_at = ?2 WHERE id = ?3`
      )
        .bind(estimatedRefund, nowIso(), sessionId)
        .run()
    }

    let taxReturnId = row.tax_return_id
    let factsKey = row.facts_key
    if (!taxReturnId) {
      const created = await this.apiService.createReturn({
        taxYear: snapshot.taxYear,
        filingStatus: snapshot.filingStatus,
        facts,
        ownerId: user.sub,
        ownerTin: String(facts.primaryTIN ?? '') || user.tin,
        formType:
          snapshot.formType === '1040-SS' ? '1040-SS' : snapshot.formType
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

    await this.env.USTAXES_DB.prepare(
      `UPDATE filing_sessions
         SET tax_return_id = ?1, facts_key = ?2, updated_at = ?3
         WHERE id = ?4`
    )
      .bind(taxReturnId, newFactsKey, nowIso(), sessionId)
      .run()

    return {
      taxReturnId,
      facts,
      taxSummary,
      taxCalcErrors,
      businessFormCapability:
        computed.businessFormCapability ?? businessReturnCapability
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
    const snapshot = await this.getSnapshot(row)
    const businessReturnCapability = isBusinessFormType(snapshot.formType)
      ? getBusinessReturnCapabilityView(snapshot)
      : null
    if (businessReturnCapability?.supportLevel === 'expert_required') {
      throw new HttpError(
        409,
        businessReturnCapability.reason ??
          `${snapshot.formType} is routed to expert help and cannot be self-served here yet`
      )
    }
    if (
      businessReturnCapability?.supportLevel === 'self_service_supported' &&
      !businessReturnCapability.hasMinimumData
    ) {
      throw new HttpError(
        422,
        `${
          snapshot.formType
        } is missing required entity-return facts: ${businessReturnCapability.missingInputs.join(
          ', '
        )}`
      )
    }
    const body = submitSchema.parse(rawBody ?? {})
    const syncResult = await this.syncReturn(sessionId, user)
    const refreshed = await this.requireSession(sessionId, user.sub)
    const refreshedSnapshot = await this.getSnapshot(refreshed)
    const entities = await this.loadSessionEntities(refreshed.id)
    const facts =
      body.factsOverride ?? toFacts(refreshed, refreshedSnapshot, entities)

    // Use tax calc result from syncReturn if available
    // Determine whether the summary came from a 1040 or a business entity calc
    const isBizForm = isBusinessFormType(refreshedSnapshot.formType)
    const taxCalcResult =
      !isBizForm && syncResult.taxSummary
        ? (syncResult.taxSummary as unknown as TaxCalculationResult)
        : undefined
    const bizCalcResult =
      isBizForm && syncResult.taxSummary
        ? (syncResult.taxSummary as unknown as BusinessEntityResult)
        : undefined

    const payload = {
      ...toSubmissionPayload(
        refreshed,
        refreshedSnapshot,
        facts,
        taxCalcResult,
        bizCalcResult
      ),
      ...(body.payloadOverride ?? {})
    } as SubmissionPayload
    const result = await this.apiService.submitReturn(syncResult.taxReturnId, {
      idempotencyKey: body.idempotencyKey,
      payload
    })
    await this.env.USTAXES_DB.prepare(
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
    const submission = await this.apiService.getSubmission(
      row.latest_submission_id
    )
    const ack = await this.apiService.getSubmissionAck(row.latest_submission_id)
    const payload = await this.apiService.getSubmissionPayload(
      row.latest_submission_id
    )
    const rejectionErrors = this.buildRejectionRepairErrors(
      ack.ack?.rejectionCodes ?? [],
      payload.payload ?? null
    )
    const lifecycleStatus = this.toLifecycleStatus(
      submission.submission.status,
      ack.ack,
      rejectionErrors
    )

    await this.env.USTAXES_DB.prepare(
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

  private async computeTaxSummary(
    sessionId: string,
    snapshot: FilingSessionSnapshot,
    facts: Record<string, unknown>
  ): Promise<CachedTaxComputation> {
    const factsHash = await hashPayload({
      formType: snapshot.formType,
      filingStatus: snapshot.filingStatus,
      facts
    })
    const cacheKey = `filing-sessions/${sessionId}/computed-tax/${factsHash}.json`
    const cached = await this.artifacts.getJson<CachedTaxComputation>(cacheKey)
    if (cached) {
      return cached
    }

    const taxCalcService = new TaxCalculationService()
    let computed: CachedTaxComputation

    if (isBusinessFormType(snapshot.formType)) {
      const businessFormCapability = getBusinessReturnCapabilityView(snapshot)
      const bizOutcome = taxCalcService.calculateBusinessEntity(
        snapshot.formType,
        facts
      )
      computed = bizOutcome.success
        ? {
            taxSummary: {
              formType: bizOutcome.formType,
              entityName: bizOutcome.entityName,
              totalIncome: bizOutcome.totalIncome,
              totalDeductions: bizOutcome.totalDeductions,
              taxableIncome: bizOutcome.taxableIncome,
              totalTax: bizOutcome.totalTax,
              totalPayments: bizOutcome.totalPayments,
              amountOwed: bizOutcome.amountOwed,
              overpayment: bizOutcome.overpayment,
              effectiveTaxRate: bizOutcome.effectiveTaxRate,
              adjustedTotalIncome: bizOutcome.adjustedTotalIncome,
              distributionDeduction: bizOutcome.distributionDeduction,
              exemption: bizOutcome.exemption,
              beneficiaryCount: bizOutcome.beneficiaryCount,
              requiredForms: bizOutcome.requiredForms,
              hazardFlags: bizOutcome.hazardFlags,
              corporateTaxAdjustments: bizOutcome.corporateTaxAdjustments,
              complianceAlerts: bizOutcome.complianceAlerts,
              schedules: bizOutcome.schedules,
              ownerAllocations: bizOutcome.ownerAllocations
            },
            businessFormCapability
          }
        : {
            taxCalcErrors: bizOutcome.errors,
            businessFormCapability
          }
    } else {
      const taxCalcOutcome = taxCalcService.calculate(facts)
      computed = taxCalcOutcome.success
        ? {
            taxSummary: {
              agi: taxCalcOutcome.agi,
              taxableIncome: taxCalcOutcome.taxableIncome,
              totalTax: taxCalcOutcome.totalTax,
              totalPayments: taxCalcOutcome.totalPayments,
              refund: taxCalcOutcome.refund,
              amountOwed: taxCalcOutcome.amountOwed,
              effectiveTaxRate: taxCalcOutcome.effectiveTaxRate,
              schedules: taxCalcOutcome.schedules
            }
          }
        : { taxCalcErrors: taxCalcOutcome.errors }
    }

    await this.artifacts.putJson(cacheKey, computed)
    return computed
  }

  async retrySubmission(sessionId: string, user: AppUserClaims) {
    const row = await this.requireSession(sessionId, user.sub)
    if (!row.latest_submission_id) {
      throw new HttpError(409, 'No submission is available to retry')
    }
    const result = await this.apiService.retrySubmission(
      row.latest_submission_id
    )
    await this.env.USTAXES_DB.prepare(
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
    const documents = await this.loadSessionDocuments(row.id)
    const taxpayer = requireScreen(snapshot, '/taxpayer-profile')
    const spouse = getSpouse(snapshot, entities)
    const review = requireScreen(snapshot, '/review-confirm')
    const printMail = requireScreen(snapshot, '/print-mail')
    const facts = toFacts(row, snapshot, entities)
    const computed = await this.computeTaxSummary(sessionId, snapshot, facts)
    const computedSummary = asRecord(computed.taxSummary)
    const totalTax = Number(review.totalTax ?? computedSummary.totalTax ?? 0)
    const totalPayments = Number(
      review.totalPayments ?? computedSummary.totalPayments ?? 0
    )
    const refund = Number(
      review.totalRefund ??
        computedSummary.refund ??
        computedSummary.overpayment ??
        snapshot.estimatedRefund ??
        0
    )
    const computedAmountOwed = Number(computedSummary.amountOwed ?? 0)
    const amountOwed = Math.max(
      0,
      computedAmountOwed > 0 ? computedAmountOwed : totalTax - totalPayments
    )
    const address = resolvePrintMailAddress(
      toText(asRecord(taxpayer.address).state ?? 'CA'),
      amountOwed > 0
    )
    const normalizePreviewFormName = (value: string): string => {
      const normalized = value.trim().toLowerCase()
      const explicitMap: Record<string, string> = {
        '1040': 'Form 1040',
        f1040: 'Form 1040',
        '1040nr': 'Form 1040-NR',
        f1040nr: 'Form 1040-NR',
        'schedule 1': 'Schedule 1',
        schedule1: 'Schedule 1',
        f1040s1: 'Schedule 1',
        'schedule a': 'Schedule A',
        schedulea: 'Schedule A',
        f1040sa: 'Schedule A',
        'schedule d': 'Schedule D',
        scheduled: 'Schedule D',
        f1040sd: 'Schedule D',
        'schedule e': 'Schedule E',
        schedulee: 'Schedule E',
        f1040se: 'Schedule E',
        'form 2441': 'Form 2441',
        f2441: 'Form 2441',
        'form 8283': 'Form 8283',
        f8283: 'Form 8283',
        'form 8863': 'Form 8863',
        f8863: 'Form 8863',
        'form 8949': 'Form 8949',
        f8949: 'Form 8949',
        'form 8962': 'Form 8962',
        f8962: 'Form 8962'
      }
      if (explicitMap[normalized]) {
        return explicitMap[normalized]
      }
      if (/^f\d+[a-z0-9]*$/i.test(value)) {
        const code = value.slice(1).toUpperCase()
        return `Form ${code}`
      }
      return value
    }
    const formatPreviewValue = (value: unknown): string => {
      if (typeof value === 'number') {
        return formatCurrency(value)
      }
      if (typeof value === 'boolean') {
        return value ? 'Yes' : ''
      }
      return toText(value)
    }
    const renderRows = (
      rows: Array<{ label: string; value: unknown }>
    ): Array<{ label: string; value: string }> =>
      compactRenderedRows(rows).map((row) => ({
        label: row.label,
        value: formatPreviewValue(row.value)
      }))
    const documentTypeOf = (document: Record<string, unknown>): string =>
      toText(asRecord(document.metadata).documentType).toLowerCase()
    const sourceDocumentsForTypes = (types: string[]) =>
      Array.from(
        new Set(
          documents
            .filter((document) => {
              const documentType = documentTypeOf(document)
              return types.length === 0
                ? true
                : types.some((type) => type === documentType || type === document.cluster)
            })
            .map((document) => toText(document.name))
            .filter(Boolean)
        )
      )
    const educationExpenses = asArray<Record<string, unknown>>(
      facts.educationExpenses
    )
    const marketplacePolicies: Record<string, unknown>[] =
      asArray<Record<string, unknown>>(facts.marketplaceInsurance).length > 0
        ? asArray<Record<string, unknown>>(facts.marketplaceInsurance)
        : asArray<Record<string, unknown>>(facts.aca1095a)
    const dependentCareProviders = asArray<Record<string, unknown>>(
      facts.dependentCareProviders
    )
    const taxLotRecords = asArray<Record<string, unknown>>(facts.taxLots)
    const k1Records = asArray<Record<string, unknown>>(facts.k1Records)
    const rentalProperties = asArray<Record<string, unknown>>(
      facts.rentalProperties
    )
    const miscRentRoyaltyRecords = asArray<Record<string, unknown>>(
      facts.form1099Records
    ).filter((record) => {
      const type = toText(record.type).toUpperCase()
      return (
        (type === 'MISC' || type === '1099-MISC' || type === '1099_MISC') &&
        (toMoney(record.rents) > 0 || toMoney(record.royalties) > 0)
      )
    })
    const derivedPreviewForms = [
      asArray<Record<string, unknown>>(facts.studentLoanRecords).length > 0 ||
      asArray<Record<string, unknown>>(facts.unemploymentRecords).length > 0
        ? 'Schedule 1'
        : null,
      Object.keys(asRecord(facts.itemizedDeductions)).length > 0
        ? 'Schedule A'
        : null,
      Object.keys(asRecord(facts.noncashContributions)).length > 0
        ? 'Form 8283'
        : null,
      asArray<Record<string, unknown>>(facts.marketplaceInsurance).length > 0 ||
      asArray<Record<string, unknown>>(facts.aca1095a).length > 0
        ? 'Form 8962'
        : null,
      educationExpenses.length > 0 ? 'Form 8863' : null,
      asArray<Record<string, unknown>>(facts.dependentCareProviders).length > 0 ||
      toMoney(facts.dependentCareExpenses) > 0
        ? 'Form 2441'
        : null,
      rentalProperties.length > 0 ||
      k1Records.length > 0 ||
      miscRentRoyaltyRecords.length > 0
        ? 'Schedule E'
        : null,
      asArray<Record<string, unknown>>(facts.taxLots).length > 0
        ? 'Schedule D'
        : null,
      asArray<Record<string, unknown>>(facts.taxLots).length > 0
        ? 'Form 8949'
        : null
    ].filter((form): form is string => Boolean(form))
    const includedForms = Array.from(
      new Set([
        normalizePreviewFormName(snapshot.formType),
        ...asArray<string>(computedSummary.schedules).map(normalizePreviewFormName),
        ...derivedPreviewForms
      ])
    ).filter(Boolean)
    const requiredPdfTags = buildRequiredPinnedPdfTags(
      snapshot,
      computedSummary,
      facts
    )
    const filledPdfPath = supportsFilledPdfTemplateSet(
      snapshot.taxYear,
      snapshot.formType,
      requiredPdfTags
    )
      ? `/app/v1/filing-sessions/${sessionId}/print-mail/pdf`
      : null
    const renderedForms = [
      {
        formName: normalizePreviewFormName(snapshot.formType),
        sourceDocuments: sourceDocumentsForTypes([]),
        status:
          (computed.taxCalcErrors?.length ?? 0) === 0 ? 'ready' : 'needs_review',
        rows: renderRows([
          { label: 'Tax year', value: snapshot.taxYear },
          { label: 'Filing status', value: snapshot.filingStatus.toUpperCase() },
          {
            label: 'W-2 wages',
            value: toMoney(asRecord(facts.incomeSummary).totalW2Wages)
          },
          {
            label: '1099 interest',
            value: asArray<Record<string, unknown>>(facts.form1099Records)
              .filter((record) => toText(record.type).toUpperCase().includes('INT'))
              .reduce((sum, record) => sum + toMoney(record.amount), 0)
          },
          {
            label: 'Ordinary dividends',
            value: asArray<Record<string, unknown>>(facts.form1099Records)
              .filter((record) => toText(record.type).toUpperCase().includes('DIV'))
              .reduce(
                (sum, record) =>
                  sum +
                  toMoney(record.ordinaryDividends ?? record.amount),
                0
              )
          },
          {
            label: 'Capital gains detail',
            value: taxLotRecords.length > 0 ? `${taxLotRecords.length} lot(s)` : ''
          },
          { label: 'Adjusted gross income', value: Number(computedSummary.agi ?? 0) },
          {
            label: 'Taxable income',
            value: Number(computedSummary.taxableIncome ?? 0)
          },
          { label: 'Total tax', value: totalTax },
          { label: 'Total payments', value: totalPayments },
          { label: 'Refund', value: refund > 0 ? refund : '' },
          { label: 'Amount owed', value: amountOwed > 0 ? amountOwed : '' }
        ])
      },
      Object.keys(asRecord(facts.itemizedDeductions)).length > 0
        ? {
            formName: 'Schedule A',
            sourceDocuments: sourceDocumentsForTypes([
              '1098-mortgage',
              'charity-receipt',
              '1098-c',
              'housing',
              'charity'
            ]),
            status: 'draft',
            rows: renderRows([
              {
                label: 'State and local taxes',
                value: toMoney(asRecord(facts.itemizedDeductions).saltDeduction)
              },
              {
                label: 'Mortgage interest',
                value: toMoney(asRecord(facts.itemizedDeductions).interest8a)
              },
              {
                label: 'Charity cash',
                value: toMoney(asRecord(facts.itemizedDeductions).charityCashCheck)
              },
              {
                label: 'Charity noncash',
                value: toMoney(asRecord(facts.itemizedDeductions).charityOther)
              },
              {
                label: 'Casualty losses',
                value: toMoney(asRecord(facts.itemizedDeductions).casualtyLosses)
              },
              {
                label: 'Other deductions',
                value: toMoney(asRecord(facts.itemizedDeductions).otherDeductions)
              }
            ])
          }
        : null,
      educationExpenses.length > 0
        ? {
            formName: 'Form 8863',
            sourceDocuments: sourceDocumentsForTypes(['1098-t', 'education']),
            status: 'draft',
            rows: renderRows([
              { label: 'Students', value: educationExpenses.length },
              {
                label: 'Qualified expenses',
                value: educationExpenses.reduce(
                  (sum, expense) =>
                    sum + toMoney(expense.qualifiedExpenses ?? expense.tuition),
                  0
                )
              },
              {
                label: 'Scholarships',
                value: educationExpenses.reduce(
                  (sum, expense) =>
                    sum +
                    toMoney(
                      expense.scholarshipsReceived ?? expense.scholarships
                    ),
                  0
                )
              },
              {
                label: 'Credit types',
                value: Array.from(
                  new Set(
                    educationExpenses
                      .map((expense) => toText(expense.creditType))
                      .filter(Boolean)
                  )
                ).join(', ')
              }
            ])
          }
        : null,
      marketplacePolicies.length > 0
        ? {
            formName: 'Form 8962',
            sourceDocuments: sourceDocumentsForTypes(['1095-a', 'health']),
            status: 'draft',
            rows: renderRows([
              { label: 'Marketplace policies', value: marketplacePolicies.length },
              {
                label: 'Enrollment premiums',
                value: marketplacePolicies.reduce(
                  (sum, policy) =>
                    sum +
                    asArray<unknown>(asRecord(policy).enrollmentPremiums).reduce<number>(
                      (innerSum, item) => innerSum + toMoney(item),
                      0
                    ),
                  0
                )
              },
              {
                label: 'SLCSP total',
                value: marketplacePolicies.reduce(
                  (sum, policy) =>
                    sum +
                    asArray<unknown>(asRecord(policy).slcsp).reduce<number>(
                      (innerSum, item) => innerSum + toMoney(item),
                      0
                    ),
                  0
                )
              },
              {
                label: 'Advance credit received',
                value: marketplacePolicies.reduce(
                  (sum, policy) =>
                    sum +
                    asArray<unknown>(asRecord(policy).advancePayments).reduce<number>(
                      (innerSum, item) => innerSum + toMoney(item),
                      0
                    ),
                  0
                )
              }
            ])
          }
        : null,
      dependentCareProviders.length > 0 || toMoney(facts.dependentCareExpenses) > 0
        ? {
            formName: 'Form 2441',
            sourceDocuments: sourceDocumentsForTypes(['childcare', 'care']),
            status: 'draft',
            rows: renderRows([
              { label: 'Care providers', value: dependentCareProviders.length },
              {
                label: 'Dependent care expenses',
                value: toMoney(facts.dependentCareExpenses)
              }
            ])
          }
        : null,
      rentalProperties.length > 0 ||
      k1Records.length > 0 ||
      miscRentRoyaltyRecords.length > 0
        ? {
            formName: 'Schedule E',
            sourceDocuments: sourceDocumentsForTypes([
              'k-1',
              '1099-misc',
              'business',
              'housing'
            ]),
            status: 'draft',
            rows: renderRows([
              { label: 'Rental properties', value: rentalProperties.length },
              { label: 'K-1 records', value: k1Records.length },
              {
                label: '1099-MISC rents and royalties',
                value: miscRentRoyaltyRecords.reduce(
                  (sum, record) =>
                    sum + toMoney(record.rents) + toMoney(record.royalties),
                  0
                )
              },
              {
                label: 'Rental income',
                value: rentalProperties.reduce(
                  (sum, property) => sum + toMoney(property.grossRents),
                  0
                )
              },
              {
                label: 'K-1 ordinary income',
                value: k1Records.reduce(
                  (sum, record) => sum + toMoney(record.ordinaryBusinessIncome),
                  0
                )
              }
            ])
          }
        : null,
      taxLotRecords.length > 0
        ? {
            formName: 'Schedule D',
            sourceDocuments: sourceDocumentsForTypes(['1099-b', 'investment']),
            status: 'draft',
            rows: renderRows([
              { label: 'Tax lots', value: taxLotRecords.length },
              {
                label: 'Gross proceeds',
                value: taxLotRecords.reduce(
                  (sum, record) => sum + toMoney(record.proceeds),
                  0
                )
              },
              {
                label: 'Cost basis',
                value: taxLotRecords.reduce(
                  (sum, record) => sum + toMoney(record.costBasis),
                  0
                )
              }
            ])
          }
        : null,
      taxLotRecords.length > 0
        ? {
            formName: 'Form 8949',
            sourceDocuments: sourceDocumentsForTypes(['1099-b', 'investment']),
            status: 'draft',
            rows: renderRows([
              {
                label: 'Reported transaction rows',
                value: taxLotRecords.reduce(
                  (sum, record) =>
                    sum + asArray(record.transactions).length,
                  0
                ) || taxLotRecords.length
              },
              {
                label: 'Short-term proceeds',
                value: taxLotRecords.reduce(
                  (sum, record) => sum + toMoney(record.shortTermProceeds),
                  0
                )
              },
              {
                label: 'Long-term proceeds',
                value: taxLotRecords.reduce(
                  (sum, record) => sum + toMoney(record.longTermProceeds),
                  0
                )
              }
            ])
          }
        : null
    ].filter(
      (
        form
      ): form is {
        formName: string
        sourceDocuments: string[]
        status: string
        rows: Array<{ label: string; value: string }>
      } => Boolean(form && form.rows.length > 0)
    )
    const renderedHtml = [
      '<!doctype html>',
      '<html lang="en"><head><meta charset="utf-8" />',
      `<title>TaxFlow ${snapshot.taxYear} IRS Preview</title>`,
      '<style>body{font-family:Arial,sans-serif;margin:32px;color:#0f172a}h1,h2{margin:0 0 12px}section{margin:24px 0;padding:20px;border:1px solid #cbd5e1;border-radius:16px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:14px}th{font-size:12px;text-transform:uppercase;color:#475569}.meta{color:#475569;font-size:14px}.sources{font-size:12px;color:#64748b;margin-top:10px}</style>',
      '</head><body>',
      `<h1>TaxFlow ${snapshot.taxYear} official-form preview</h1>`,
      `<p class="meta">${toText(taxpayer.firstName)} ${toText(
        taxpayer.lastName
      )} · ${snapshot.filingStatus.toUpperCase()} · ${normalizePreviewFormName(
        snapshot.formType
      )}</p>`,
      ...renderedForms.map(
        (form) =>
          `<section><h2>${form.formName}</h2><table><thead><tr><th>Line</th><th>Value</th></tr></thead><tbody>${form.rows
            .map(
              (row) =>
                `<tr><td>${row.label}</td><td>${row.value}</td></tr>`
            )
            .join('')}</tbody></table>${
            form.sourceDocuments.length > 0
              ? `<p class="sources">Source documents: ${form.sourceDocuments.join(
                  ', '
                )}</p>`
              : ''
          }</section>`
      ),
      '</body></html>'
    ].join('')
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
        totalTax,
        totalPayments,
        refund,
        amountOwed
      },
      mailingAddress: address,
      attachments,
      checklist,
      coverLetter: [
        `Tax year: ${snapshot.taxYear}`,
        `Filer: ${toText(taxpayer.firstName)} ${toText(
          taxpayer.lastName
        )}`.trim(),
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
      officialFormPreview: {
        includedForms,
        sourceDocumentCount: documents.length,
        extractedDocumentCount: documents.filter(
          (document) =>
            toText(asRecord(document.metadata).documentType) &&
            toText(asRecord(document.metadata).documentType) !== 'unknown'
        ).length,
        readyForPreview:
          includedForms.length > 0 && (computed.taxCalcErrors?.length ?? 0) === 0,
        filledPdfAvailable: Boolean(filledPdfPath),
        filledPdfPath,
        filledPdfFilename: filledPdfPath
          ? `taxflow-${snapshot.taxYear}-${snapshot.formType.toLowerCase()}-filled-return.pdf`
          : null,
        renderedForms,
        renderedHtml,
        nextActions: compactRenderedRows([
          {
            label: 'Return build status',
            value:
              (computed.taxCalcErrors?.length ?? 0) === 0
                ? 'Computed from uploaded data'
                : 'Needs review before filing'
          },
          {
            label: 'Forms in packet',
            value: includedForms.join(', ')
          }
        ])
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
      (
        snapshot.screenData['/taxpayer-profile']?.address as
          | Record<string, unknown>
          | undefined
      )?.state ??
        snapshot.screenData['/state-tax']?.stateCode ??
        'CA'
    ).toUpperCase()
    const profile = resolveStateProfile(this.env, stateCode)
    const capability = resolveStateCapability(this.env, stateCode, snapshot.taxYear)
    return {
      stateTransfer: {
        stateCode,
        profile,
        capability,
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
    const snapshot = await this.getSnapshot(row)
    const body = stateTransferSchema.parse(rawBody ?? {})
    const capability = resolveStateCapability(
      this.env,
      body.stateCode.toUpperCase(),
      snapshot.taxYear
    )
    if (!capability) {
      throw new HttpError(404, 'State capability not found')
    }
    if (capability.noIncomeTax) {
      throw new HttpError(
        409,
        `${capability.stateName} does not require a state income tax return in this flow`
      )
    }
    if (capability.lane !== 'transfer_export') {
      throw new HttpError(
        409,
        `${capability.stateName} is currently routed through expert handoff instead of direct transfer`
      )
    }
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
    await this.env.USTAXES_DB.prepare(
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

  private async getSessionRow(
    id: string,
    userId: string
  ): Promise<FilingSessionRow | null> {
    return (
      (await this.env.USTAXES_DB.prepare(
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

  private async requireSession(
    id: string,
    userId: string
  ): Promise<FilingSessionRow> {
    const row = await this.getSessionRow(id, userId)
    if (!row) {
      throw new HttpError(404, 'Filing session not found')
    }
    return row
  }

  private async getSnapshot(
    row: FilingSessionRow
  ): Promise<FilingSessionSnapshot> {
    return (
      (await this.artifacts.getJson<FilingSessionSnapshot>(
        row.metadata_key
      )) ?? {
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
    await this.env.USTAXES_DB.prepare(
      `DELETE FROM review_findings WHERE filing_session_id = ?1`
    )
      .bind(sessionId)
      .run()

    for (const finding of findings) {
      await this.env.USTAXES_DB.prepare(
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
