import { describe, expect, it } from 'vitest'

import { validateDirectFileFacts } from '../../src/utils/factGraphValidation'

describe('validateDirectFileFacts', () => {
  it('accepts valid Direct File fact wrappers', () => {
    const issues = validateDirectFileFacts({
      '/taxYear': {
        $type: 'gov.irs.factgraph.persisters.IntWrapper',
        item: 2025
      },
      '/filingStatus': {
        $type: 'gov.irs.factgraph.persisters.EnumWrapper',
        item: {
          value: ['single'],
          enumOptionsPath: '/filingStatusOptions'
        }
      },
      '/filers/#primary/tin': {
        $type: 'gov.irs.factgraph.persisters.TinWrapper',
        item: {
          area: '400',
          group: '01',
          serial: '1032'
        }
      },
      '/address': {
        $type: 'gov.irs.factgraph.persisters.AddressWrapper',
        item: {
          streetAddress: '2030 Pecan Street',
          city: 'Monroe',
          stateOrProvence: 'MA',
          postalCode: '02301'
        }
      }
    })

    expect(issues).toEqual([])
  })

  it('rejects facts with invalid TinWrapper structure', () => {
    const issues = validateDirectFileFacts({
      '/filers/#primary/tin': {
        $type: 'gov.irs.factgraph.persisters.TinWrapper',
        item: {
          area: '40',
          group: '1',
          serial: '1032'
        }
      }
    })

    expect(issues).toHaveLength(1)
    expect(issues[0].path).toBe('/filers/#primary/tin')
  })

  it('rejects fact entries without slash-prefixed path', () => {
    const issues = validateDirectFileFacts({
      filingStatus: {
        $type: 'gov.irs.factgraph.persisters.EnumWrapper',
        item: {
          value: ['single']
        }
      }
    })

    expect(issues).toHaveLength(1)
    expect(issues[0].message).toContain('must start with "/"')
  })
})
