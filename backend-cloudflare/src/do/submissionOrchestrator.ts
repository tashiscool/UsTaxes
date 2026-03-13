import { ZodError, z } from 'zod'

import { D1TaxRepository } from '../adapters/d1Repository'
import { R2ArtifactStore } from '../adapters/r2ArtifactStore'
import type { Env } from '../domain/env'
import type { SubmissionQueueMessage } from '../domain/types'
import {
  RetryableSubmissionError,
  SubmissionOrchestrationService
} from '../services/submissionOrchestrationService'
import { jsonResponse } from '../utils/http'

const submissionQueueMessageSchema: z.ZodType<SubmissionQueueMessage> =
  z.object({
    submissionId: z.string().min(2),
    taxReturnId: z.string().min(2),
    attempt: z.number().int().min(1),
    queuedAt: z.string().min(10)
  })

export class SubmissionOrchestrator {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (request.method !== 'POST' || url.pathname !== '/process') {
      return jsonResponse({ error: 'Not found' }, 404)
    }

    let message: SubmissionQueueMessage
    try {
      message = submissionQueueMessageSchema.parse(await request.json())
    } catch (error) {
      if (error instanceof ZodError) {
        return jsonResponse(
          {
            error: 'Invalid queue message',
            issues: error.issues
          },
          400
        )
      }
      throw error
    }

    const guardKey = `inflight:${message.submissionId}`
    const isInFlight = await this.state.storage.get<boolean>(guardKey)
    if (isInFlight) {
      return jsonResponse({ ok: true, deduplicated: true })
    }

    await this.state.storage.put(guardKey, true)

    try {
      const repository = new D1TaxRepository(this.env.USTAXES_DB)
      const artifacts = new R2ArtifactStore(this.env.ARTIFACTS_BUCKET)
      const service = new SubmissionOrchestrationService(repository, artifacts)
      try {
        await service.processSubmission(message)
      } catch (error) {
        if (error instanceof RetryableSubmissionError) {
          return jsonResponse(
            {
              error: 'Transient processing failure',
              detail: error.message
            },
            503
          )
        }

        return jsonResponse(
          {
            error: 'Submission processing failed',
            detail: error instanceof Error ? error.message : 'Unknown error'
          },
          500
        )
      }

      return jsonResponse({ ok: true })
    } finally {
      await this.state.storage.delete(guardKey)
    }
  }
}
