import { describe, expect, it } from 'vitest'

import { ApiService } from '../../src/services/apiService'
import {
  asQueue,
  InMemoryArtifactStore,
  InMemoryQueue,
  InMemoryTaxRepository
} from '../support/inMemoryAdapters'

describe('Idempotency behavior', () => {
  it('returns same submission when same idempotency key is reused', async () => {
    const repository = new InMemoryTaxRepository()
    const artifacts = new InMemoryArtifactStore()
    const queue = new InMemoryQueue()

    const api = new ApiService(repository, artifacts, asQueue(queue))

    const created = await api.createReturn({
      taxYear: 2025,
      filingStatus: 'single',
      facts: {}
    })

    const request = {
      idempotencyKey: 'f7ec2f3e-5154-4a5e-8dba-70cbccfb1324',
      payload: {
        taxYear: 2025,
        primaryTIN: '123456789',
        filingStatus: 'single'
      }
    }

    const first = await api.submitReturn(created.taxReturn.id, request)
    const second = await api.submitReturn(created.taxReturn.id, request)

    expect(first.idempotent).toBe(false)
    expect(second.idempotent).toBe(true)
    expect(second.submission.id).toBe(first.submission.id)
    expect(queue.messages).toHaveLength(1)
  })
})
