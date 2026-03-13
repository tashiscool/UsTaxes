import { describe, expect, it } from 'vitest'

import { validateMefCompliance } from '../../src/services/mefComplianceService'

describe('validateMefCompliance', () => {
  it('accepts valid payload and produces MeF XML', async () => {
    const result = await validateMefCompliance({
      taxYear: 2025,
      primaryTIN: '400011032',
      filingStatus: 'single',
      formType: '1040',
      form1040: {
        totalTax: 2242,
        totalPayments: 2713,
        refund: 471,
        amountOwed: 0
      },
      metadata: {
        stateCode: 'MA',
        mefSchemaAsOf: '2026-03-12T00:00:00.000Z'
      }
    })

    expect(result.valid).toBe(true)
    if (!result.valid) {
      return
    }

    expect(result.xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(result.xml).toContain('xmlns="http://www.irs.gov/efile"')
    expect(result.xml).toContain('returnVersion="2025v5.1"')
    expect(result.xml).toContain('<ReturnHeader')
    expect(result.xml).toContain('<ReturnData')
    expect(result.report.schemaTrack).toBe('ats')
    expect(result.report.returnVersion).toBe('2025v5.1')
    expect(result.report.xmlValidationErrors).toEqual([])
    expect(result.report.fieldValidationErrors).toEqual([])
  })

  it('switches to the next ATS returnVersion when effective date is reached', async () => {
    const result = await validateMefCompliance({
      taxYear: 2025,
      primaryTIN: '400011032',
      filingStatus: 'single',
      metadata: {
        mefSchemaAsOf: '2026-03-15T00:00:00.000Z'
      }
    })

    expect(result.valid).toBe(true)
    if (!result.valid) {
      return
    }

    expect(result.xml).toContain('returnVersion="2025v5.2"')
    expect(result.report.returnVersion).toBe('2025v5.2')
  })

  it('resolves production track versions independently of ATS dates', async () => {
    const result = await validateMefCompliance({
      taxYear: 2025,
      primaryTIN: '400011032',
      filingStatus: 'single',
      metadata: {
        mefSchemaTrack: 'production',
        mefSchemaAsOf: '2026-01-20T00:00:00.000Z'
      }
    })

    expect(result.valid).toBe(true)
    if (!result.valid) {
      return
    }

    expect(result.xml).toContain('returnVersion="2025v5.0"')
    expect(result.report.schemaTrack).toBe('production')
    expect(result.report.returnVersion).toBe('2025v5.0')
  })

  it('rejects payload with invalid state code', async () => {
    const result = await validateMefCompliance({
      taxYear: 2025,
      primaryTIN: '400011032',
      filingStatus: 'single',
      metadata: {
        stateCode: 'ZZ'
      }
    })

    expect(result.valid).toBe(false)
    if (result.valid) {
      return
    }

    expect(result.rejectionCode).toBe('R0000-905')
  })

  it('rejects payload with non-9-digit primary TIN', async () => {
    const result = await validateMefCompliance({
      taxYear: 2025,
      primaryTIN: '12345',
      filingStatus: 'single'
    })

    expect(result.valid).toBe(false)
    if (result.valid) {
      return
    }

    expect(result.rejectionCode).toBe('IND-031')
  })

  it('enforces ATS strict TIN 00 rule when enabled', async () => {
    const result = await validateMefCompliance({
      taxYear: 2025,
      primaryTIN: '400011032',
      filingStatus: 'single',
      metadata: {
        irsAtsStrictTin: true
      }
    })

    expect(result.valid).toBe(false)
    if (result.valid) {
      return
    }

    expect(result.rejectionCode).toBe('ATS-TIN-00')
  })

  it('accepts ATS strict TIN payloads when digits 4 and 5 are 00', async () => {
    const result = await validateMefCompliance({
      taxYear: 2025,
      primaryTIN: '400001032',
      filingStatus: 'single',
      metadata: {
        irsAtsStrictTin: true
      }
    })

    expect(result.valid).toBe(true)
    if (!result.valid) {
      return
    }

    expect(result.report.returnVersion).toBeTruthy()
  })
})
