import type {
  SubmissionEventRecord,
  SubmissionRecord,
  SubmissionStatus,
  TaxReturnRecord
} from '../domain/types'
import type {
  CreateSubmissionParams,
  CreateTaxReturnParams,
  TaxRepository,
  UpdateSubmissionStatusOptions
} from './repository'
import { nowIso } from '../utils/time'

interface TaxReturnRow {
  id: string
  tax_year: number
  filing_status: string
  owner_id: string
  owner_tin: string | null
  form_type: string | null
  current_status: SubmissionStatus
  facts_key: string
  sign_key: string | null
  signed_at: string | null
  created_at: string
  updated_at: string
}

interface SubmissionRow {
  id: string
  tax_return_id: string
  idempotency_key: string
  status: SubmissionStatus
  payload_key: string
  payload_hash: string
  attempt_count: number
  last_error: string | null
  ack_code: string | null
  ack_message: string | null
  processed_at: string | null
  created_at: string
  updated_at: string
}

interface SubmissionEventRow {
  id: number
  submission_id: string
  status: SubmissionStatus
  message: string
  created_at: string
}

const toTaxReturnRecord = (row: TaxReturnRow): TaxReturnRecord => ({
  id: row.id,
  taxYear: row.tax_year,
  filingStatus: row.filing_status,
  ownerId: row.owner_id,
  ownerTin: row.owner_tin ?? undefined,
  formType: (row.form_type as TaxReturnRecord['formType']) ?? undefined,
  currentStatus: row.current_status,
  factsKey: row.facts_key,
  signKey: row.sign_key ?? undefined,
  signedAt: row.signed_at ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

const toSubmissionRecord = (row: SubmissionRow): SubmissionRecord => ({
  id: row.id,
  taxReturnId: row.tax_return_id,
  idempotencyKey: row.idempotency_key,
  status: row.status,
  payloadKey: row.payload_key,
  payloadHash: row.payload_hash,
  attemptCount: row.attempt_count,
  lastError: row.last_error ?? undefined,
  ackCode: row.ack_code ?? undefined,
  ackMessage: row.ack_message ?? undefined,
  processedAt: row.processed_at ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

const toSubmissionEventRecord = (
  row: SubmissionEventRow
): SubmissionEventRecord => ({
  id: row.id,
  submissionId: row.submission_id,
  status: row.status,
  message: row.message,
  createdAt: row.created_at
})

export class D1TaxRepository implements TaxRepository {
  constructor(private readonly db: D1Database) {}

  async createTaxReturn(
    params: CreateTaxReturnParams
  ): Promise<TaxReturnRecord> {
    const now = nowIso()
    await this.db
      .prepare(
        `INSERT INTO tax_returns (
           id,
           tax_year,
           filing_status,
           owner_id,
           owner_tin,
           form_type,
           current_status,
           facts_key,
           created_at,
           updated_at
         )
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
      )
      .bind(
        params.id,
        params.taxYear,
        params.filingStatus,
        params.ownerId ?? 'local-user',
        params.ownerTin ?? null,
        params.formType ?? null,
        params.currentStatus,
        params.factsKey,
        now,
        now
      )
      .run()

    return {
      id: params.id,
      taxYear: params.taxYear,
      filingStatus: params.filingStatus,
      ownerId: params.ownerId ?? 'local-user',
      ownerTin: params.ownerTin,
      formType: params.formType as TaxReturnRecord['formType'],
      currentStatus: params.currentStatus,
      factsKey: params.factsKey,
      createdAt: now,
      updatedAt: now
    }
  }

  async listTaxReturns(ownerId?: string): Promise<TaxReturnRecord[]> {
    const query = ownerId
      ? this.db
          .prepare(
            `SELECT id, tax_year, filing_status, owner_id, owner_tin, form_type, current_status, facts_key, sign_key, signed_at, created_at, updated_at
             FROM tax_returns
             WHERE owner_id = ?1
             ORDER BY created_at DESC`
          )
          .bind(ownerId)
      : this.db.prepare(
          `SELECT id, tax_year, filing_status, owner_id, owner_tin, form_type, current_status, facts_key, sign_key, signed_at, created_at, updated_at
           FROM tax_returns
           ORDER BY created_at DESC`
        )

    const result = await query.all<TaxReturnRow>()
    return (result.results ?? []).map(toTaxReturnRecord)
  }

  async getTaxReturn(id: string): Promise<TaxReturnRecord | null> {
    const row = await this.db
      .prepare(
        `SELECT id, tax_year, filing_status, owner_id, owner_tin, form_type, current_status, facts_key, sign_key, signed_at, created_at, updated_at
         FROM tax_returns
         WHERE id = ?1`
      )
      .bind(id)
      .first<TaxReturnRow>()

    return row ? toTaxReturnRecord(row) : null
  }

  async updateTaxReturnStatus(
    id: string,
    status: SubmissionStatus
  ): Promise<void> {
    const now = nowIso()
    await this.db
      .prepare(
        `UPDATE tax_returns SET current_status = ?1, updated_at = ?2 WHERE id = ?3`
      )
      .bind(status, now, id)
      .run()
  }

  async updateTaxReturnFactsKey(id: string, factsKey: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE tax_returns
         SET facts_key = ?1, updated_at = ?2
         WHERE id = ?3`
      )
      .bind(factsKey, nowIso(), id)
      .run()
  }

  async setTaxReturnSignature(
    id: string,
    signKey: string,
    signedAt: string
  ): Promise<void> {
    await this.db
      .prepare(
        `UPDATE tax_returns
         SET sign_key = ?1, signed_at = ?2, updated_at = ?3
         WHERE id = ?4`
      )
      .bind(signKey, signedAt, nowIso(), id)
      .run()
  }

  async createSubmission(
    params: CreateSubmissionParams
  ): Promise<SubmissionRecord> {
    const now = nowIso()
    await this.db
      .prepare(
        `INSERT INTO submissions (
           id,
           tax_return_id,
           idempotency_key,
           status,
           payload_key,
           payload_hash,
           attempt_count,
           created_at,
           updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?8)`
      )
      .bind(
        params.id,
        params.taxReturnId,
        params.idempotencyKey,
        params.status,
        params.payloadKey,
        params.payloadHash,
        now,
        now
      )
      .run()

    return {
      id: params.id,
      taxReturnId: params.taxReturnId,
      idempotencyKey: params.idempotencyKey,
      status: params.status,
      payloadKey: params.payloadKey,
      payloadHash: params.payloadHash,
      attemptCount: 0,
      createdAt: now,
      updatedAt: now
    }
  }

  async getSubmission(id: string): Promise<SubmissionRecord | null> {
    const row = await this.db
      .prepare(
        `SELECT id, tax_return_id, idempotency_key, status, payload_key, payload_hash, attempt_count, last_error, ack_code, ack_message, processed_at, created_at, updated_at
         FROM submissions WHERE id = ?1`
      )
      .bind(id)
      .first<SubmissionRow>()

    return row ? toSubmissionRecord(row) : null
  }

  async listReturnSubmissions(
    taxReturnId: string
  ): Promise<SubmissionRecord[]> {
    const result = await this.db
      .prepare(
        `SELECT id, tax_return_id, idempotency_key, status, payload_key, payload_hash, attempt_count, last_error, ack_code, ack_message, processed_at, created_at, updated_at
         FROM submissions
         WHERE tax_return_id = ?1
         ORDER BY created_at DESC`
      )
      .bind(taxReturnId)
      .all<SubmissionRow>()

    return (result.results ?? []).map(toSubmissionRecord)
  }

  async findSubmissionByIdempotency(
    taxReturnId: string,
    idempotencyKey: string
  ): Promise<SubmissionRecord | null> {
    const row = await this.db
      .prepare(
        `SELECT id, tax_return_id, idempotency_key, status, payload_key, payload_hash, attempt_count, last_error, ack_code, ack_message, processed_at, created_at, updated_at
         FROM submissions
         WHERE tax_return_id = ?1 AND idempotency_key = ?2`
      )
      .bind(taxReturnId, idempotencyKey)
      .first<SubmissionRow>()

    return row ? toSubmissionRecord(row) : null
  }

  async setSubmissionPayloadHash(
    submissionId: string,
    payloadHash: string
  ): Promise<void> {
    await this.db
      .prepare(
        `UPDATE submissions
         SET payload_hash = ?1
         WHERE id = ?2 AND payload_hash = ''`
      )
      .bind(payloadHash, submissionId)
      .run()
  }

  async incrementSubmissionAttempt(submissionId: string): Promise<number> {
    const now = nowIso()
    await this.db
      .prepare(
        `UPDATE submissions
         SET attempt_count = attempt_count + 1, updated_at = ?1
         WHERE id = ?2`
      )
      .bind(now, submissionId)
      .run()

    const row = await this.db
      .prepare(`SELECT attempt_count FROM submissions WHERE id = ?1`)
      .bind(submissionId)
      .first<{ attempt_count: number }>()

    return row?.attempt_count ?? 0
  }

  async updateSubmissionStatus(
    submissionId: string,
    status: SubmissionStatus,
    options?: UpdateSubmissionStatusOptions
  ): Promise<void> {
    const now = nowIso()
    await this.db
      .prepare(
        `UPDATE submissions
         SET
           status = ?1,
           ack_code = CASE
             WHEN ?8 = 1 THEN NULL
             ELSE COALESCE(?2, ack_code)
           END,
           ack_message = CASE
             WHEN ?8 = 1 THEN NULL
             ELSE COALESCE(?3, ack_message)
           END,
           last_error = CASE
             WHEN ?9 = 1 THEN NULL
             ELSE COALESCE(?4, last_error)
           END,
           processed_at = CASE
             WHEN ?10 = 1 THEN NULL
             ELSE COALESCE(?5, processed_at)
           END,
           updated_at = ?6
         WHERE id = ?7`
      )
      .bind(
        status,
        options?.ackCode ?? null,
        options?.ackMessage ?? null,
        options?.lastError ?? null,
        options?.processedAt ?? null,
        now,
        submissionId,
        options?.clearAcknowledgment ? 1 : 0,
        options?.clearLastError ? 1 : 0,
        options?.clearProcessedAt ? 1 : 0
      )
      .run()
  }

  async addSubmissionEvent(
    submissionId: string,
    status: SubmissionStatus,
    message: string
  ): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO submission_events (submission_id, status, message, created_at)
         VALUES (?1, ?2, ?3, ?4)`
      )
      .bind(submissionId, status, message, nowIso())
      .run()
  }

  async listSubmissionEvents(
    submissionId: string
  ): Promise<SubmissionEventRecord[]> {
    const result = await this.db
      .prepare(
        `SELECT id, submission_id, status, message, created_at
         FROM submission_events
         WHERE submission_id = ?1
         ORDER BY id ASC`
      )
      .bind(submissionId)
      .all<SubmissionEventRow>()

    return (result.results ?? []).map(toSubmissionEventRecord)
  }
}
