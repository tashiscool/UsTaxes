import type { ArtifactStore } from '../../src/adapters/artifactStore'
import type {
  CreateSubmissionParams,
  CreateTaxReturnParams,
  TaxRepository,
  UpdateSubmissionStatusOptions
} from '../../src/adapters/repository'
import type {
  SubmissionEventRecord,
  SubmissionRecord,
  SubmissionStatus,
  TaxReturnRecord,
  SubmissionQueueMessage
} from '../../src/domain/types'
import { nowIso } from '../../src/utils/time'

export class InMemoryTaxRepository implements TaxRepository {
  private readonly taxReturns = new Map<string, TaxReturnRecord>()
  private readonly submissions = new Map<string, SubmissionRecord>()
  private readonly events = new Map<string, SubmissionEventRecord[]>()

  async createTaxReturn(
    params: CreateTaxReturnParams
  ): Promise<TaxReturnRecord> {
    const now = nowIso()
    const record: TaxReturnRecord = {
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

    this.taxReturns.set(record.id, record)
    return record
  }

  async getTaxReturn(id: string): Promise<TaxReturnRecord | null> {
    return this.taxReturns.get(id) ?? null
  }

  async listTaxReturns(ownerId?: string): Promise<TaxReturnRecord[]> {
    return [...this.taxReturns.values()]
      .filter((taxReturn) => (ownerId ? taxReturn.ownerId === ownerId : true))
      .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
  }

  async updateTaxReturnFactsKey(id: string, factsKey: string): Promise<void> {
    const existing = this.taxReturns.get(id)
    if (!existing) {
      return
    }

    this.taxReturns.set(id, {
      ...existing,
      factsKey,
      updatedAt: nowIso()
    })
  }

  async setTaxReturnSignature(
    id: string,
    signKey: string,
    signedAt: string
  ): Promise<void> {
    const existing = this.taxReturns.get(id)
    if (!existing) {
      return
    }

    this.taxReturns.set(id, {
      ...existing,
      signKey,
      signedAt,
      updatedAt: nowIso()
    })
  }

  async updateTaxReturnStatus(
    id: string,
    status: SubmissionStatus
  ): Promise<void> {
    const existing = this.taxReturns.get(id)
    if (!existing) {
      return
    }

    this.taxReturns.set(id, {
      ...existing,
      currentStatus: status,
      updatedAt: nowIso()
    })
  }

  async createSubmission(
    params: CreateSubmissionParams
  ): Promise<SubmissionRecord> {
    const now = nowIso()
    const record: SubmissionRecord = {
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

    this.submissions.set(record.id, record)
    return record
  }

  async getSubmission(id: string): Promise<SubmissionRecord | null> {
    return this.submissions.get(id) ?? null
  }

  async listReturnSubmissions(
    taxReturnId: string
  ): Promise<SubmissionRecord[]> {
    return [...this.submissions.values()]
      .filter((submission) => submission.taxReturnId === taxReturnId)
      .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
  }

  async findSubmissionByIdempotency(
    taxReturnId: string,
    idempotencyKey: string
  ): Promise<SubmissionRecord | null> {
    for (const submission of this.submissions.values()) {
      if (
        submission.taxReturnId === taxReturnId &&
        submission.idempotencyKey === idempotencyKey
      ) {
        return submission
      }
    }

    return null
  }

  async setSubmissionPayloadHash(
    submissionId: string,
    payloadHash: string
  ): Promise<void> {
    const existing = this.submissions.get(submissionId)
    if (!existing) {
      return
    }

    if (!existing.payloadHash) {
      this.submissions.set(submissionId, {
        ...existing,
        payloadHash
      })
    }
  }

  async incrementSubmissionAttempt(submissionId: string): Promise<number> {
    const existing = this.submissions.get(submissionId)
    if (!existing) {
      return 0
    }

    const attemptCount = existing.attemptCount + 1
    this.submissions.set(submissionId, {
      ...existing,
      attemptCount,
      updatedAt: nowIso()
    })
    return attemptCount
  }

  async updateSubmissionStatus(
    submissionId: string,
    status: SubmissionStatus,
    options?: UpdateSubmissionStatusOptions
  ): Promise<void> {
    const existing = this.submissions.get(submissionId)
    if (!existing) {
      return
    }

    this.submissions.set(submissionId, {
      ...existing,
      status,
      ackCode: options?.clearAcknowledgment
        ? undefined
        : options?.ackCode ?? existing.ackCode,
      ackMessage: options?.clearAcknowledgment
        ? undefined
        : options?.ackMessage ?? existing.ackMessage,
      lastError: options?.clearLastError
        ? undefined
        : options?.lastError ?? existing.lastError,
      processedAt: options?.clearProcessedAt
        ? undefined
        : options?.processedAt ?? existing.processedAt,
      updatedAt: nowIso()
    })
  }

  async addSubmissionEvent(
    submissionId: string,
    status: SubmissionStatus,
    message: string
  ): Promise<void> {
    const list = this.events.get(submissionId) ?? []
    list.push({
      id: list.length + 1,
      submissionId,
      status,
      message,
      createdAt: nowIso()
    })
    this.events.set(submissionId, list)
  }

  async listSubmissionEvents(
    submissionId: string
  ): Promise<SubmissionEventRecord[]> {
    return this.events.get(submissionId) ?? []
  }
}

export class InMemoryArtifactStore implements ArtifactStore {
  private readonly objects = new Map<string, unknown>()

  async putJson<T>(key: string, payload: T): Promise<void> {
    this.objects.set(key, payload)
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = this.objects.get(key)
    if (value === undefined) {
      return null
    }
    return value as T
  }
}

export class InMemoryQueue {
  readonly messages: SubmissionQueueMessage[] = []

  async send(body: SubmissionQueueMessage): Promise<void> {
    this.messages.push(body)
  }
}

export const asQueue = (queue: InMemoryQueue): Queue<SubmissionQueueMessage> =>
  queue as unknown as Queue<SubmissionQueueMessage>
