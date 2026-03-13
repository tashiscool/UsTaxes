import { describe, expect, it } from 'vitest'

import { ApiService } from '../../src/services/apiService'
import { SubmissionOrchestrationService } from '../../src/services/submissionOrchestrationService'
import {
  asQueue,
  InMemoryArtifactStore,
  InMemoryQueue,
  InMemoryTaxRepository
} from '../support/inMemoryAdapters'

describe('ATS rejection path - missing primary TIN', () => {
  it('rejects submission with IND-031 when primaryTIN is missing', async () => {
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

    const submit = await api.submitReturn(created.taxReturn.id, {
      idempotencyKey: '6a59b4fd-af24-470b-b722-d53bc1ef0fbe',
      payload: {
        taxYear: 2025,
        filingStatus: 'single',
        form1040: {
          totalTax: 1200,
          totalPayments: 1200
        }
      }
    })

    await orchestration.processSubmission(queue.messages[0])

    const status = await api.getSubmission(submit.submission.id)
    const ack = await api.getSubmissionAck(submit.submission.id)

    expect(status.submission.status).toBe('rejected')
    expect(ack.ack).toMatchObject({
      ackCode: 'R',
      rejectionCodes: ['IND-031']
    })
  })
})
