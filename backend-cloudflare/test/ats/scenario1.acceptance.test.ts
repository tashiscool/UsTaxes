import { describe, expect, it } from 'vitest'

import { ApiService } from '../../src/services/apiService'
import { SubmissionOrchestrationService } from '../../src/services/submissionOrchestrationService'
import { atsScenario1Payload } from '../fixtures/atsScenario1'
import {
  asQueue,
  InMemoryArtifactStore,
  InMemoryQueue,
  InMemoryTaxRepository
} from '../support/inMemoryAdapters'

describe('ATS Scenario 1 - backend acceptance', () => {
  it('accepts a valid ATS-like submission through queue + orchestrator', async () => {
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
      facts: {
        primaryTIN: '400011032'
      }
    })

    const submit = await api.submitReturn(created.taxReturn.id, {
      idempotencyKey: '37b75df4-342f-4ec5-96df-e126672cd377',
      payload: atsScenario1Payload
    })

    expect(submit.idempotent).toBe(false)
    expect(queue.messages).toHaveLength(1)

    await orchestration.processSubmission(queue.messages[0])

    const status = await api.getSubmission(submit.submission.id)
    const ack = await api.getSubmissionAck(submit.submission.id)

    expect(status.submission.status).toBe('accepted')
    expect(ack.status).toBe('accepted')
    expect(ack.ack).toMatchObject({
      ackCode: 'A',
      rejectionCodes: []
    })

    expect(status.events.map((e) => e.status)).toEqual([
      'queued',
      'processing',
      'accepted'
    ])
  })
})
