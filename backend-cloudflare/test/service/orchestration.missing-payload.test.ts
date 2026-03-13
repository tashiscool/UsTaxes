import { describe, expect, it } from 'vitest'

import { SubmissionOrchestrationService } from '../../src/services/submissionOrchestrationService'
import {
  InMemoryArtifactStore,
  InMemoryTaxRepository
} from '../support/inMemoryAdapters'

describe('SubmissionOrchestrationService missing payload', () => {
  it('marks submission failed when payload object is missing from artifact store', async () => {
    const repository = new InMemoryTaxRepository()
    const artifacts = new InMemoryArtifactStore()
    const orchestration = new SubmissionOrchestrationService(
      repository,
      artifacts
    )

    const taxReturn = await repository.createTaxReturn({
      id: 'ret-missing-payload',
      taxYear: 2025,
      filingStatus: 'single',
      currentStatus: 'draft',
      factsKey: 'returns/ret-missing-payload/facts.json'
    })

    const submission = await repository.createSubmission({
      id: 'sub-missing-payload',
      taxReturnId: taxReturn.id,
      idempotencyKey: 'f98f9967-aab8-47fd-a068-2ab03723eb36',
      status: 'queued',
      payloadKey: 'submissions/sub-missing-payload/payload.json',
      payloadHash: 'abc'
    })

    await orchestration.processSubmission({
      submissionId: submission.id,
      taxReturnId: taxReturn.id,
      attempt: 1,
      queuedAt: '2026-03-12T00:00:00.000Z'
    })

    const updated = await repository.getSubmission(submission.id)
    expect(updated?.status).toBe('failed')
    expect(updated?.ackCode).toBe('F')
    expect(updated?.attemptCount).toBe(1)
  })
})
