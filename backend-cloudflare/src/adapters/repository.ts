import type {
  SubmissionEventRecord,
  SubmissionRecord,
  SubmissionStatus,
  TaxReturnRecord
} from '@/domain/types'

export interface CreateTaxReturnParams {
  id: string
  taxYear: number
  filingStatus: string
  ownerId?: string
  ownerTin?: string
  formType?: string
  currentStatus: SubmissionStatus
  factsKey: string
}

export interface CreateSubmissionParams {
  id: string
  taxReturnId: string
  idempotencyKey: string
  status: SubmissionStatus
  payloadKey: string
  payloadHash: string
}

export interface UpdateSubmissionStatusOptions {
  ackCode?: string
  ackMessage?: string
  lastError?: string
  processedAt?: string
  clearAcknowledgment?: boolean
  clearLastError?: boolean
  clearProcessedAt?: boolean
}

export interface TaxRepository {
  createTaxReturn(params: CreateTaxReturnParams): Promise<TaxReturnRecord>
  listTaxReturns(ownerId?: string): Promise<TaxReturnRecord[]>
  getTaxReturn(id: string): Promise<TaxReturnRecord | null>
  updateTaxReturnFactsKey(id: string, factsKey: string): Promise<void>
  setTaxReturnSignature(
    id: string,
    signKey: string,
    signedAt: string
  ): Promise<void>
  updateTaxReturnStatus(id: string, status: SubmissionStatus): Promise<void>

  createSubmission(params: CreateSubmissionParams): Promise<SubmissionRecord>
  getSubmission(id: string): Promise<SubmissionRecord | null>
  listReturnSubmissions(taxReturnId: string): Promise<SubmissionRecord[]>
  findSubmissionByIdempotency(
    taxReturnId: string,
    idempotencyKey: string
  ): Promise<SubmissionRecord | null>
  setSubmissionPayloadHash(
    submissionId: string,
    payloadHash: string
  ): Promise<void>
  incrementSubmissionAttempt(submissionId: string): Promise<number>
  updateSubmissionStatus(
    submissionId: string,
    status: SubmissionStatus,
    options?: UpdateSubmissionStatusOptions
  ): Promise<void>

  addSubmissionEvent(
    submissionId: string,
    status: SubmissionStatus,
    message: string
  ): Promise<void>
  listSubmissionEvents(submissionId: string): Promise<SubmissionEventRecord[]>
}
