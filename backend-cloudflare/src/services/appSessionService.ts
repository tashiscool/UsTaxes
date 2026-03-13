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

const toFacts = (row: FilingSessionRow, snapshot: FilingSessionSnapshot): Record<string, unknown> => {
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

  return {
    primaryTIN: primaryTin,
    taxflowSessionId: row.id,
    filingStatus: status,
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
    metadata: {
      source: 'taxflow-app-v1',
      filingSessionId: row.id,
      localSessionId: row.local_session_id ?? undefined,
      priorYearAgi: taxpayer.priorYearAgi,
      ipPin: taxpayer.ipPin ?? efile.ipPin,
      signerName: efile.signatureText ?? undefined,
      bankLast4: String(efile.account ?? '').slice(-4) || undefined
    }
  }
}

const buildChecklist = (snapshot: FilingSessionSnapshot) => {
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
      spouse: itemFromScreen('spouse', '/spouse', 'Spouse information saved', { optional: true }),
      household: itemFromScreen('household', '/household', 'Dependents reviewed', { optional: true }),
      residency: itemFromScreen('residency', '/residency', 'Residency information saved'),
      w2s: itemFromScreen('w2s', '/w2', 'W-2 information saved', { optional: true }),
      '1099s': itemFromScreen('1099s', '/1099', '1099 information saved', { optional: true }),
      investments: itemFromScreen('investments', '/tax-lots', 'Investment activity reviewed', { optional: true }),
      rental: itemFromScreen('rental', '/rental', 'Rental property reviewed', { optional: true }),
      business: itemFromScreen('business', '/business-k1', 'Business income reviewed', { optional: true }),
      retirement: itemFromScreen('retirement', '/ira-retirement', 'Retirement income reviewed', { optional: true }),
      'foreign-income': itemFromScreen('foreign-income', '/foreign-income', 'Foreign income reviewed', { optional: true }),
      hsa: itemFromScreen('hsa', '/hsa', 'HSA reviewed', { optional: true }),
      ctc: itemFromScreen('ctc', '/credits-v2', 'Credits reviewed', { optional: true }),
      'your-taxes': itemFromScreen('your-taxes', '/your-taxes', 'Tax details reviewed', { optional: true }),
      'state-tax': itemFromScreen('state-tax', '/state-tax', 'State filing reviewed', { optional: true }),
      'review-confirm': itemFromScreen('review-confirm', '/review-confirm', 'Review confirmed'),
      'efile-wizard': itemFromScreen('efile-wizard', '/efile-wizard', 'E-file steps completed', { optional: true })
    },
    collections: {},
    ui: {
      filingPathTreeCollapsed:
        Boolean(
          (requireScreen(snapshot, '/checklist').ui as Record<string, unknown> | undefined)
            ?.filingPathTreeCollapsed
        ) || false
    }
  }
}

const buildReview = (snapshot: FilingSessionSnapshot, findings: ReviewFindingRow[]) => {
  const taxpayer = requireScreen(snapshot, '/taxpayer-profile')
  const efile = requireScreen(snapshot, '/efile-wizard')
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

const toFindingRows = (sessionId: string, snapshot: FilingSessionSnapshot): ReviewFindingRow[] => {
  const taxpayer = requireScreen(snapshot, '/taxpayer-profile')
  const efile = requireScreen(snapshot, '/efile-wizard')
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

  async listEntities(sessionId: string, user: AppUserClaims) {
    await this.requireSession(sessionId, user.sub)
    const result = await this.env.USTAXES_DB
      .prepare(
        `SELECT id, filing_session_id, entity_type, entity_key, status, label, data_key, created_at, updated_at
         FROM session_entities
         WHERE filing_session_id = ?1
         ORDER BY updated_at DESC`
      )
      .bind(sessionId)
      .all<SessionEntityRow>()

    const entities = await Promise.all(
      (result.results ?? []).map(async (row) => ({
        id: row.id,
        entityType: row.entity_type,
        entityKey: row.entity_key,
        status: row.status,
        label: row.label,
        data:
          (await this.artifacts.getJson<Record<string, unknown>>(row.data_key)) ??
          {},
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    )

    return { entities }
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
    const findings = await this.syncReviewFindings(row.id, snapshot)
    return {
      checklist: buildChecklist(snapshot),
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
    const findings = await this.syncReviewFindings(row.id, snapshot)
    return {
      review: buildReview(snapshot, findings)
    }
  }

  async syncReturn(sessionId: string, user: AppUserClaims) {
    const row = await this.requireSession(sessionId, user.sub)
    const snapshot = await this.getSnapshot(row)
    const facts = toFacts(row, snapshot)
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
    const facts = body.factsOverride ?? toFacts(refreshed, snapshot)
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
    const lifecycleStatus = this.toLifecycleStatus(
      submission.submission.status,
      ack.ack
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
        events: submission.events
      }
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
    snapshot: FilingSessionSnapshot
  ): Promise<ReviewFindingRow[]> {
    const findings = toFindingRows(sessionId, snapshot)
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
    ack: { rejectionCodes?: string[] } | null
  ): FilingLifecycleStatus {
    if (status === 'accepted' && ack?.rejectionCodes?.length) {
      return 'accepted_with_alerts'
    }
    if (status === 'queued') return 'queued'
    if (status === 'processing') return 'processing'
    if (status === 'accepted') return 'accepted'
    if (status === 'rejected') return 'rejected'
    if (status === 'failed') return 'failed'
    return 'pending'
  }
}
