import { describe, expect, it } from 'vitest'

import { ApiService } from '../../src/services/apiService'
import {
  asQueue,
  InMemoryArtifactStore,
  InMemoryQueue,
  InMemoryTaxRepository
} from '../support/inMemoryAdapters'

describe('ApiService validation', () => {
  it('normalizes supported return form aliases to canonical value', async () => {
    const repository = new InMemoryTaxRepository()
    const artifacts = new InMemoryArtifactStore()
    const queue = new InMemoryQueue()

    const api = new ApiService(repository, artifacts, asQueue(queue))

    const created = await api.createReturn({
      taxYear: 2025,
      filingStatus: 'single',
      facts: {}
    })

    const submitted = await api.submitReturn(created.taxReturn.id, {
      idempotencyKey: '2905a602-f67d-4f50-b1a0-e54f42f965a9',
      payload: {
        taxYear: 2025,
        primaryTIN: '400011032',
        filingStatus: 'single',
        formType: '1040_nr'
      }
    })

    expect(submitted.idempotent).toBe(false)
    expect(queue.messages).toHaveLength(1)
  })

  it('rejects unsupported return form types', async () => {
    const repository = new InMemoryTaxRepository()
    const artifacts = new InMemoryArtifactStore()
    const queue = new InMemoryQueue()

    const api = new ApiService(repository, artifacts, asQueue(queue))

    const created = await api.createReturn({
      taxYear: 2025,
      filingStatus: 'single',
      facts: {}
    })

    await expect(
      api.submitReturn(created.taxReturn.id, {
        idempotencyKey: '725fce98-5269-4dff-87b7-7fcd057ce7e8',
        payload: {
          taxYear: 2025,
          primaryTIN: '400011032',
          filingStatus: 'single',
          formType: '1120'
        }
      })
    ).rejects.toThrow(/Invalid return form type/)
    expect(queue.messages).toHaveLength(0)
  })
})
