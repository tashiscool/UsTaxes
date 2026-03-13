import { describe, expect, it } from 'vitest'

import { ApiService } from '../../src/services/apiService'
import {
  asQueue,
  InMemoryArtifactStore,
  InMemoryQueue,
  InMemoryTaxRepository
} from '../support/inMemoryAdapters'

describe('ApiService idempotency conflict', () => {
  it('returns 409 when idempotency key is reused with a different payload', async () => {
    const repository = new InMemoryTaxRepository()
    const artifacts = new InMemoryArtifactStore()
    const queue = new InMemoryQueue()

    const api = new ApiService(repository, artifacts, asQueue(queue))

    const created = await api.createReturn({
      taxYear: 2025,
      filingStatus: 'single',
      facts: {}
    })

    const idempotencyKey = '5e80cbf8-fce4-4aa6-8d58-1786ff8e0b8d'
    await api.submitReturn(created.taxReturn.id, {
      idempotencyKey,
      payload: {
        taxYear: 2025,
        primaryTIN: '400011032',
        filingStatus: 'single'
      }
    })

    await expect(
      api.submitReturn(created.taxReturn.id, {
        idempotencyKey,
        payload: {
          taxYear: 2025,
          primaryTIN: '400011033',
          filingStatus: 'single'
        }
      })
    ).rejects.toThrow(/Idempotency key already exists/)
  })
})
