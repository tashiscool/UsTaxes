import { describe, expect, it } from 'vitest'

import { ApiService } from '../../src/services/apiService'
import {
  asQueue,
  InMemoryArtifactStore,
  InMemoryQueue,
  InMemoryTaxRepository
} from '../support/inMemoryAdapters'

describe('ApiService lifecycle', () => {
  it('creates return, submits, and lists submissions for that return', async () => {
    const repository = new InMemoryTaxRepository()
    const artifacts = new InMemoryArtifactStore()
    const queue = new InMemoryQueue()

    const api = new ApiService(repository, artifacts, asQueue(queue))

    const created = await api.createReturn({
      taxYear: 2025,
      filingStatus: 'single',
      facts: {
        primaryTIN: '400011032'
      }
    })

    const submitted = await api.submitReturn(created.taxReturn.id, {
      idempotencyKey: '61d0f7e4-4b2d-4700-b234-643817d548ef',
      payload: {
        taxYear: 2025,
        primaryTIN: '400011032',
        filingStatus: 'single',
        form1040: {
          totalTax: 3000,
          totalPayments: 3100
        }
      }
    })

    expect(submitted.idempotent).toBe(false)
    expect(queue.messages).toHaveLength(1)
    expect(queue.messages[0].attempt).toBe(1)

    const list = await api.listReturnSubmissions(created.taxReturn.id)
    expect(list.submissions).toHaveLength(1)
    expect(list.submissions[0].id).toBe(submitted.submission.id)

    const payload = await api.getSubmissionPayload(submitted.submission.id)
    expect(payload.payload).toMatchObject({
      taxYear: 2025,
      primaryTIN: '400011032'
    })
  })
})
