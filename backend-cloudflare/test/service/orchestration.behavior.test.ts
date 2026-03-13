import { describe, expect, it } from 'vitest'

import { ApiService } from '../../src/services/apiService'
import {
  RetryableSubmissionError,
  SubmissionOrchestrationService
} from '../../src/services/submissionOrchestrationService'
import {
  asQueue,
  InMemoryArtifactStore,
  InMemoryQueue,
  InMemoryTaxRepository
} from '../support/inMemoryAdapters'

describe('SubmissionOrchestrationService behavior', () => {
  it('rejects when payload tax year mismatches return tax year', async () => {
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
      idempotencyKey: 'e5dc66d3-66ee-4e89-ab00-57bde4a4f2e1',
      payload: {
        taxYear: 2024,
        primaryTIN: '400011032',
        filingStatus: 'single'
      }
    })

    await orchestration.processSubmission(queue.messages[0])
    const ack = await api.getSubmissionAck(submitted.submission.id)

    expect(ack.status).toBe('rejected')
    expect(ack.ack?.rejectionCodes).toEqual(['R0000-902'])
  })

  it('requeues transient failures and throws RetryableSubmissionError', async () => {
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
      idempotencyKey: 'f9638514-8554-4f39-9635-398783321f13',
      payload: {
        taxYear: 2025,
        primaryTIN: '400011032',
        filingStatus: 'single',
        metadata: {
          simulateTransientFailure: true
        }
      }
    })

    await expect(
      orchestration.processSubmission(queue.messages[0])
    ).rejects.toThrow(RetryableSubmissionError)

    const status = await api.getSubmission(submitted.submission.id)
    expect(status.submission.status).toBe('queued')
    expect(status.submission.attemptCount).toBe(1)
    expect(status.events.map((event) => event.status)).toEqual([
      'queued',
      'processing',
      'queued'
    ])
  })

  it('fails after max transient retries', async () => {
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
      idempotencyKey: '72d2f15b-4cb4-4468-a2e6-f2b9e06dd6f8',
      payload: {
        taxYear: 2025,
        primaryTIN: '400011032',
        filingStatus: 'single',
        metadata: {
          simulateTransientFailure: true
        }
      }
    })

    await expect(
      orchestration.processSubmission(queue.messages[0])
    ).rejects.toThrow(RetryableSubmissionError)
    await expect(
      orchestration.processSubmission(queue.messages[0])
    ).rejects.toThrow(RetryableSubmissionError)
    await orchestration.processSubmission(queue.messages[0])

    const status = await api.getSubmission(submitted.submission.id)
    expect(status.submission.status).toBe('failed')
    expect(status.submission.attemptCount).toBe(3)
    expect(status.submission.ackCode).toBe('F')
  })

  it('rejects payloads that violate MeF JSON/XML rules', async () => {
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
      idempotencyKey: '6aef57a2-75a6-4a5d-b5a2-c8a69531f1d9',
      payload: {
        taxYear: 2025,
        primaryTIN: '400011032',
        filingStatus: 'single',
        metadata: {
          stateCode: 'ZZ'
        }
      }
    })

    await orchestration.processSubmission(queue.messages[0])

    const status = await api.getSubmission(submitted.submission.id)
    const ack = await api.getSubmissionAck(submitted.submission.id)
    expect(status.submission.status).toBe('rejected')
    expect(ack.ack).toMatchObject({
      ackCode: 'R',
      rejectionCodes: ['R0000-905']
    })
  })

  it('requeues once when MeF resiliency mode is active, then accepts on retry', async () => {
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
      idempotencyKey: '35fcce56-6058-4a63-9d80-27748fcae8e1',
      payload: {
        taxYear: 2025,
        primaryTIN: '400011032',
        filingStatus: 'single',
        formType: '1040',
        metadata: {
          mefOperationalMode: 'resiliency'
        }
      }
    })

    await expect(
      orchestration.processSubmission(queue.messages[0])
    ).rejects.toThrow(RetryableSubmissionError)

    const firstStatus = await api.getSubmission(submitted.submission.id)
    expect(firstStatus.submission.status).toBe('queued')
    expect(firstStatus.submission.attemptCount).toBe(1)
    expect(firstStatus.submission.lastError).toContain(
      'acknowledgements temporarily unavailable'
    )

    await orchestration.processSubmission(queue.messages[0])

    const finalStatus = await api.getSubmission(submitted.submission.id)
    const ack = await api.getSubmissionAck(submitted.submission.id)
    expect(finalStatus.submission.status).toBe('accepted')
    expect(finalStatus.submission.attemptCount).toBe(2)
    expect(ack.ack).toMatchObject({
      ackCode: 'A',
      rejectionCodes: []
    })
  })
})
