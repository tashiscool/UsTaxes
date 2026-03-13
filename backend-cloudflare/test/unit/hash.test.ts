import { describe, expect, it } from 'vitest'

import { hashPayload, stableJsonStringify } from '../../src/utils/hash'

describe('hash utilities', () => {
  it('stableJsonStringify sorts nested object keys deterministically', () => {
    const first = stableJsonStringify({
      b: 2,
      a: 1,
      nested: {
        z: true,
        c: 3
      }
    })

    const second = stableJsonStringify({
      nested: {
        c: 3,
        z: true
      },
      a: 1,
      b: 2
    })

    expect(first).toBe(second)
  })

  it('hashPayload returns same hash for semantically equivalent JSON', async () => {
    const one = await hashPayload({
      filingStatus: 'single',
      form1040: {
        totalTax: 123,
        totalPayments: 100
      }
    })
    const two = await hashPayload({
      form1040: {
        totalPayments: 100,
        totalTax: 123
      },
      filingStatus: 'single'
    })

    expect(one).toBe(two)
  })
})
