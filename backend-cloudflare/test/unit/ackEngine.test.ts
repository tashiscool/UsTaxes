import { describe, expect, it } from 'vitest'

import { evaluateSubmissionPayload } from '../../src/services/ackEngine'

const validPayload = {
  taxYear: 2025,
  primaryTIN: '400011032',
  filingStatus: 'single',
  form1040: {
    totalTax: 1900,
    totalPayments: 2200,
    refund: 300
  }
}

describe('ackEngine', () => {
  it('accepts a valid payload', () => {
    const ack = evaluateSubmissionPayload(validPayload)
    expect(ack.status).toBe('accepted')
    expect(ack.ackCode).toBe('A')
  })

  it('rejects invalid filing status', () => {
    const ack = evaluateSubmissionPayload({
      ...validPayload,
      filingStatus: 'unknown-status'
    })
    expect(ack.status).toBe('rejected')
    expect(ack.rejectionCodes).toEqual(['R0000-058'])
  })

  it('rejects invalid TIN', () => {
    const ack = evaluateSubmissionPayload({
      ...validPayload,
      primaryTIN: '1234'
    })
    expect(ack.status).toBe('rejected')
    expect(ack.rejectionCodes).toEqual(['IND-031'])
  })

  it('rejects structurally invalid TIN values', () => {
    const ack = evaluateSubmissionPayload({
      ...validPayload,
      primaryTIN: '000-11-1032'
    })
    expect(ack.status).toBe('rejected')
    expect(ack.rejectionCodes).toEqual(['IND-031'])
  })

  it('rejects negative total payments', () => {
    const ack = evaluateSubmissionPayload({
      ...validPayload,
      form1040: {
        ...validPayload.form1040,
        totalPayments: -1
      }
    })
    expect(ack.status).toBe('rejected')
    expect(ack.rejectionCodes).toEqual(['F1040-PMT-NEG'])
  })

  it('rejects empty totals when form1040 is present', () => {
    const ack = evaluateSubmissionPayload({
      ...validPayload,
      form1040: {}
    })
    expect(ack.status).toBe('rejected')
    expect(ack.rejectionCodes).toEqual(['F1040-TOTALS-MISSING'])
  })

  it('rejects refund mismatch against totals', () => {
    const ack = evaluateSubmissionPayload({
      ...validPayload,
      form1040: {
        totalTax: 1000,
        totalPayments: 1500,
        refund: 400
      }
    })
    expect(ack.status).toBe('rejected')
    expect(ack.rejectionCodes).toEqual(['F1040-RFND-MISMATCH'])
  })

  it('rejects when refund and amount owed are both positive', () => {
    const ack = evaluateSubmissionPayload({
      ...validPayload,
      form1040: {
        totalTax: 1000,
        totalPayments: 1500,
        refund: 500,
        amountOwed: 1
      }
    })
    expect(ack.status).toBe('rejected')
    expect(ack.rejectionCodes).toEqual(['F1040-BAL-DOUBLE'])
  })

  it('rejects ATS expected value mismatches', () => {
    const ack = evaluateSubmissionPayload({
      ...validPayload,
      metadata: {
        scenarioId: 'S1',
        expectedValues: {
          totalTax: 1901
        }
      }
    })
    expect(ack.status).toBe('rejected')
    expect(ack.rejectionCodes).toEqual(['ATS-TAX-MISMATCH'])
  })

  it('accepts ATS group 00 test TIN when scenario metadata is present', () => {
    const ack = evaluateSubmissionPayload({
      ...validPayload,
      primaryTIN: '400001032',
      metadata: {
        scenarioId: 'S1'
      }
    })
    expect(ack.status).toBe('accepted')
    expect(ack.ackCode).toBe('A')
  })

  it('rejects group 00 TIN when ATS metadata is absent', () => {
    const ack = evaluateSubmissionPayload({
      ...validPayload,
      primaryTIN: '400001032'
    })
    expect(ack.status).toBe('rejected')
    expect(ack.rejectionCodes).toEqual(['IND-031'])
  })
})
