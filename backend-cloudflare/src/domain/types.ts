export type SubmissionStatus =
  | 'draft'
  | 'queued'
  | 'processing'
  | 'accepted'
  | 'rejected'
  | 'failed'

export type ReturnFormType =
  | '1040'
  | '1040-NR'
  | '1040-SS'
  | '4868'
  | '1120'
  | '1120-S'
  | '1065'
  | '1041'
  | '990'

export interface TaxReturnRecord {
  id: string
  taxYear: number
  filingStatus: string
  ownerId: string
  ownerTin?: string
  formType?: ReturnFormType
  currentStatus: SubmissionStatus
  factsKey: string
  signKey?: string
  signedAt?: string
  createdAt: string
  updatedAt: string
}

export interface SubmissionRecord {
  id: string
  taxReturnId: string
  idempotencyKey: string
  status: SubmissionStatus
  payloadKey: string
  payloadHash: string
  attemptCount: number
  lastError?: string
  ackCode?: string
  ackMessage?: string
  processedAt?: string
  createdAt: string
  updatedAt: string
}

export interface SubmissionEventRecord {
  id: number
  submissionId: string
  status: SubmissionStatus
  message: string
  createdAt: string
}

export interface SubmissionPayload {
  taxYear: number
  primaryTIN?: string
  filingStatus: string
  formType?: ReturnFormType
  form1040?: {
    totalTax?: number
    totalPayments?: number
    refund?: number
    amountOwed?: number
  }
  forms?: Record<string, unknown>
  metadata?: {
    scenarioId?: string
    sourceFile?: string
    scenarioName?: string
    expectedValues?: {
      totalTax?: number
      totalPayments?: number
      refund?: number
      amountOwed?: number
    }
    [key: string]: unknown
  }
}

export interface Acknowledgment {
  status: SubmissionStatus
  ackCode: string
  ackMessage: string
  rejectionCodes: string[]
}

export interface SubmissionQueueMessage {
  submissionId: string
  taxReturnId: string
  attempt: number
  queuedAt: string
}

export interface CreateReturnRequest {
  taxYear: number
  filingStatus: string
  facts: Record<string, unknown>
  ownerId?: string
  ownerTin?: string
  formType?: ReturnFormType
}

export interface SubmitReturnRequest {
  idempotencyKey?: string
  payload: SubmissionPayload
}
