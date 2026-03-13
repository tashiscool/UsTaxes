import { z } from 'zod'

import type { ArtifactStore } from '../adapters/artifactStore'
import type { TaxRepository } from '../adapters/repository'
import type {
  Acknowledgment,
  CreateReturnRequest,
  ReturnFormType,
  SubmissionPayload,
  SubmitReturnRequest,
  SubmissionQueueMessage,
  SubmissionStatus
} from '../domain/types'
import { HttpError } from '../utils/http'
import { hashPayload } from '../utils/hash'
import {
  isValidFilingStatus,
  normalizeFilingStatus
} from '../utils/filingStatus'
import {
  canonicalReturnFormType,
  isValidReturnFormType,
  normalizeReturnFormType
} from '../utils/formType'
import { nowIso } from '../utils/time'

const filingStatusSchema = z
  .string()
  .min(1)
  .transform((value) => normalizeFilingStatus(value))
  .refine((value) => isValidFilingStatus(value), {
    message: 'Invalid filing status'
  })

const formTypeSchema: z.ZodType<ReturnFormType, z.ZodTypeDef, string> = z
  .string()
  .min(2)
  .transform((value, context) => {
    const normalized = normalizeReturnFormType(value)
    if (!isValidReturnFormType(normalized)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid return form type'
      })
      return z.NEVER
    }

    return canonicalReturnFormType(normalized)
  })

const createReturnSchema: z.ZodType<
  CreateReturnRequest,
  z.ZodTypeDef,
  unknown
> = z.object({
  taxYear: z.number().int().min(2020).max(2100),
  filingStatus: filingStatusSchema,
  facts: z.record(z.string(), z.unknown()),
  ownerId: z.string().min(2).optional(),
  ownerTin: z.string().min(9).optional(),
  formType: formTypeSchema.optional()
})

const submitReturnSchema: z.ZodType<
  SubmitReturnRequest,
  z.ZodTypeDef,
  unknown
> = z.object({
  idempotencyKey: z.string().uuid().optional(),
  payload: z.object({
    taxYear: z.number().int().min(2020).max(2100),
    primaryTIN: z.string().optional(),
    filingStatus: filingStatusSchema,
    formType: formTypeSchema.optional(),
    form1040: z
      .object({
        totalTax: z.number().finite().optional(),
        totalPayments: z.number().finite().optional(),
        refund: z.number().finite().optional(),
        amountOwed: z.number().finite().optional()
      })
      .optional(),
    forms: z.record(z.string(), z.unknown()).optional(),
    metadata: z
      .object({
        scenarioId: z.string().optional(),
        sourceFile: z.string().optional(),
        scenarioName: z.string().optional(),
        expectedValues: z
          .object({
            totalTax: z.number().finite().optional(),
            totalPayments: z.number().finite().optional(),
            refund: z.number().finite().optional(),
            amountOwed: z.number().finite().optional()
          })
          .optional()
      })
      .catchall(z.unknown())
      .optional()
  })
})

export class ApiService {
  constructor(
    private readonly repository: TaxRepository,
    private readonly artifacts: ArtifactStore,
    private readonly queue: Queue<SubmissionQueueMessage>
  ) {}

  async createReturn(rawBody: unknown) {
    const body = createReturnSchema.parse(rawBody)

    const returnId = crypto.randomUUID()
    const factsKey = `returns/${returnId}/facts.json`

    await this.artifacts.putJson(factsKey, body.facts)
    const created = await this.repository.createTaxReturn({
      id: returnId,
      taxYear: body.taxYear,
      filingStatus: body.filingStatus,
      ownerId: body.ownerId ?? 'local-user',
      ownerTin: body.ownerTin,
      formType: body.formType,
      currentStatus: 'draft',
      factsKey
    })

    return {
      taxReturn: created
    }
  }

  async getReturn(returnId: string) {
    const taxReturn = await this.repository.getTaxReturn(returnId)
    if (!taxReturn) {
      throw new HttpError(404, `Tax return ${returnId} not found`)
    }

    return {
      taxReturn
    }
  }

  async submitReturn(returnId: string, rawBody: unknown) {
    const body = submitReturnSchema.parse(rawBody)

    const taxReturn = await this.repository.getTaxReturn(returnId)
    if (!taxReturn) {
      throw new HttpError(404, `Tax return ${returnId} not found`)
    }

    const idempotencyKey = body.idempotencyKey ?? crypto.randomUUID()
    const payloadHash = await hashPayload(body.payload)

    const existing = await this.repository.findSubmissionByIdempotency(
      returnId,
      idempotencyKey
    )

    if (existing) {
      if (existing.payloadHash) {
        if (existing.payloadHash !== payloadHash) {
          throw new HttpError(
            409,
            'Idempotency key already exists for this return with a different payload'
          )
        }
      } else {
        await this.repository.setSubmissionPayloadHash(existing.id, payloadHash)
      }

      return {
        idempotent: true,
        submission: existing
      }
    }

    const submissionId = crypto.randomUUID()
    const payloadKey = `submissions/${submissionId}/payload.json`

    await this.artifacts.putJson(payloadKey, body.payload)

    const submission = await this.repository.createSubmission({
      id: submissionId,
      taxReturnId: returnId,
      idempotencyKey,
      status: 'queued',
      payloadKey,
      payloadHash
    })

    await this.repository.updateTaxReturnStatus(returnId, 'queued')
    await this.repository.addSubmissionEvent(
      submissionId,
      'queued',
      'Submission enqueued for processing'
    )

    await this.queue.send({
      submissionId,
      taxReturnId: returnId,
      attempt: 1,
      queuedAt: nowIso()
    })

    return {
      idempotent: false,
      submission
    }
  }

  async getSubmission(submissionId: string) {
    const submission = await this.repository.getSubmission(submissionId)
    if (!submission) {
      throw new HttpError(404, `Submission ${submissionId} not found`)
    }

    const events = await this.repository.listSubmissionEvents(submissionId)

    return {
      submission,
      events
    }
  }

  async listReturnSubmissions(returnId: string) {
    const taxReturn = await this.repository.getTaxReturn(returnId)
    if (!taxReturn) {
      throw new HttpError(404, `Tax return ${returnId} not found`)
    }

    const submissions = await this.repository.listReturnSubmissions(returnId)
    return {
      taxReturn,
      submissions
    }
  }

  async getSubmissionAck(submissionId: string) {
    const submission = await this.repository.getSubmission(submissionId)
    if (!submission) {
      throw new HttpError(404, `Submission ${submissionId} not found`)
    }

    const ack = await this.artifacts.getJson<Acknowledgment>(
      `submissions/${submissionId}/ack.json`
    )

    return {
      submissionId,
      status: submission.status,
      ack: ack ?? null
    }
  }

  async getSubmissionPayload(submissionId: string) {
    const submission = await this.repository.getSubmission(submissionId)
    if (!submission) {
      throw new HttpError(404, `Submission ${submissionId} not found`)
    }

    const payload = await this.artifacts.getJson<SubmissionPayload>(
      submission.payloadKey
    )

    return {
      submissionId,
      payload
    }
  }

  async retrySubmission(submissionId: string) {
    const submission = await this.repository.getSubmission(submissionId)
    if (!submission) {
      throw new HttpError(404, `Submission ${submissionId} not found`)
    }

    const retryableStatuses = new Set<SubmissionStatus>(['failed', 'rejected'])
    if (!retryableStatuses.has(submission.status)) {
      throw new HttpError(
        409,
        `Submission ${submissionId} is ${submission.status} and cannot be retried`
      )
    }

    await this.repository.updateSubmissionStatus(submissionId, 'queued', {
      clearLastError: true,
      clearAcknowledgment: true,
      clearProcessedAt: true
    })
    await this.repository.updateTaxReturnStatus(
      submission.taxReturnId,
      'queued'
    )
    await this.repository.addSubmissionEvent(
      submissionId,
      'queued',
      'Submission manually requeued'
    )

    await this.queue.send({
      submissionId,
      taxReturnId: submission.taxReturnId,
      attempt: submission.attemptCount + 1,
      queuedAt: nowIso()
    })

    return {
      retried: true,
      submissionId
    }
  }
}
