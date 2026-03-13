import { describe, expect, it } from 'vitest'

import { SubmissionOrchestrationService } from '../../src/services/submissionOrchestrationService'
import {
  InMemoryArtifactStore,
  InMemoryTaxRepository
} from '../support/inMemoryAdapters'

describe('SubmissionOrchestrationService missing return', () => {
  it('fails submission when associated tax return does not exist', async () => {
    const repository = new InMemoryTaxRepository()
    const artifacts = new InMemoryArtifactStore()
    const orchestration = new SubmissionOrchestrationService(
      repository,
      artifacts
    )

    const submission = await repository.createSubmission({
      id: 'sub-missing-return',
      taxReturnId: 'ret-missing',
      idempotencyKey: '9f4078c0-c208-4f69-8786-49cdf56df95c',
      status: 'queued',
      payloadKey: 'submissions/sub-missing-return/payload.json',
      payloadHash: 'abc'
    })

    await orchestration.processSubmission({
      submissionId: submission.id,
      taxReturnId: 'ret-missing',
      attempt: 1,
      queuedAt: '2026-03-12T00:00:00.000Z'
    })

    const updated = await repository.getSubmission(submission.id)
    expect(updated?.status).toBe('failed')
    expect(updated?.ackCode).toBe('F')
  })
})
