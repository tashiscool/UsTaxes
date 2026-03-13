import { describe, expect, it } from 'vitest'

import { ApiService } from '../../src/services/apiService'
import { SubmissionOrchestrationService } from '../../src/services/submissionOrchestrationService'
import {
  asQueue,
  InMemoryArtifactStore,
  InMemoryQueue,
  InMemoryTaxRepository
} from '../support/inMemoryAdapters'

describe('SubmissionOrchestrationService ATS expected values', () => {
  it('rejects when submitted totals do not match ATS expected values', async () => {
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

    const submitted = await api.submitReturn(created.taxReturn.id, {
      idempotencyKey: '82bc6cfc-ce8f-4b4d-8f06-df92157e4e2c',
      payload: {
        taxYear: 2025,
        primaryTIN: '400011032',
        filingStatus: 'single',
        form1040: {
          totalTax: 1000,
          totalPayments: 1300,
          refund: 300
        },
        metadata: {
          scenarioId: 'S1',
          expectedValues: {
            totalTax: 1001,
            totalPayments: 1300,
            refund: 299
          }
        }
      }
    })

    await orchestration.processSubmission(queue.messages[0])

    const status = await api.getSubmission(submitted.submission.id)
    const ack = await api.getSubmissionAck(submitted.submission.id)

    expect(status.submission.status).toBe('rejected')
    expect(ack.ack).toMatchObject({
      ackCode: 'R',
      rejectionCodes: ['ATS-TAX-MISMATCH']
    })
  })
})
