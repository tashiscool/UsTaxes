import { describe, expect, it } from 'vitest'

import { ApiService } from '../../src/services/apiService'
import { SubmissionOrchestrationService } from '../../src/services/submissionOrchestrationService'
import {
  asQueue,
  InMemoryArtifactStore,
  InMemoryQueue,
  InMemoryTaxRepository
} from '../support/inMemoryAdapters'

describe('ApiService retrySubmission', () => {
  it('allows manual retry for rejected submissions and enqueues again', async () => {
    const repository = new InMemoryTaxRepository()
    const artifacts = new InMemoryArtifactStore()
    const queue = new InMemoryQueue()

    const api = new ApiService(repository, artifacts, asQueue(queue))
    const orchestration = new SubmissionOrchestrationService(
      repository,
      artifacts
    )

    const created = await api.createReturn({
      taxYear: 2025,
      filingStatus: 'single',
      facts: {}
    })

    const submitted = await api.submitReturn(created.taxReturn.id, {
      idempotencyKey: 'de610dc8-70d6-4568-8129-1733f0f8cc1f',
      payload: {
        taxYear: 2025,
        filingStatus: 'single'
      }
    })

    await orchestration.processSubmission(queue.messages[0])
    expect(
      (await api.getSubmission(submitted.submission.id)).submission.status
    ).toBe('rejected')

    const retried = await api.retrySubmission(submitted.submission.id)
    expect(retried.retried).toBe(true)
    expect(queue.messages).toHaveLength(2)
    expect(queue.messages[1].submissionId).toBe(submitted.submission.id)

    const requeued = await api.getSubmission(submitted.submission.id)
    expect(requeued.submission.status).toBe('queued')
    expect(requeued.submission.ackCode).toBeUndefined()
    expect(requeued.submission.ackMessage).toBeUndefined()
    expect(requeued.submission.lastError).toBeUndefined()
    expect(requeued.submission.processedAt).toBeUndefined()
  })
})
