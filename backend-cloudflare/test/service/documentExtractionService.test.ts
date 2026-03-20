import { describe, expect, it } from 'vitest'

import { extractDocumentFromBytes } from '../../src/services/documentExtractionService'

const pdfBytes = (text: string) => new TextEncoder().encode(text)

describe('documentExtractionService', () => {
  it('parses Form 1098-T style PDF text into education fields', async () => {
    const extracted = await extractDocumentFromBytes(
      pdfBytes(`
        Form 1098-T
        Filer's name: Monroe State University
        Student's name: Casey Tester
        Payments received for qualified tuition and related expenses 6,400.00
        Scholarships or grants 1,000.00
        Adjustments made for a prior year 0.00
      `),
      'application/pdf',
      '1098-T.pdf'
    )

    expect(extracted.documentType).toBe('1098-t')
    expect(extracted.form1098T?.institutionName).toBe('Monroe State University')
    expect(extracted.form1098T?.studentName).toBe('Casey Tester')
    expect(extracted.form1098T?.qualifiedTuitionExpenses).toBe(6400)
    expect(extracted.form1098T?.scholarshipsOrGrants).toBe(1000)
  })

  it('parses tuition ledger PDF text into education support fields', async () => {
    const extracted = await extractDocumentFromBytes(
      pdfBytes(`
        Student Billing Statement
        School name: Monroe State University
        Student's name: Casey Tester
        Tuition charges 5,800.00
        Books and required supplies 600.00
        Scholarships or grants 1,000.00
        Payments received 4,500.00
      `),
      'application/pdf',
      'tuition-ledger.pdf'
    )

    expect(extracted.documentType).toBe('tuition-ledger')
    expect(extracted.form1098T?.institutionName).toBe('Monroe State University')
    expect(extracted.form1098T?.booksAndMaterials).toBe(600)
    expect(extracted.form1098T?.paymentsReceived).toBe(4500)
  })

  it('parses Schedule K-1 style PDF text into k-1 fields', async () => {
    const extracted = await extractDocumentFromBytes(
      pdfBytes(`
        Schedule K-1
        Partnership's name: Maple Holdings LP
        12-3456789
        Ordinary business income 4,200.00
        Net rental real estate income 900.00
        Interest income 35.00
        Qualified business income 3,900.00
      `),
      'application/pdf',
      'Schedule-K1.pdf'
    )

    expect(extracted.documentType).toBe('k-1')
    expect(extracted.scheduleK1?.issuerName).toBe('Maple Holdings LP')
    expect(extracted.scheduleK1?.issuerEin).toBe('12-3456789')
    expect(extracted.scheduleK1?.ordinaryBusinessIncome).toBe(4200)
    expect(extracted.scheduleK1?.rentalRealEstateIncome).toBe(900)
    expect(extracted.scheduleK1?.section199AQBI).toBe(3900)
  })

  it('parses 1099-MISC style PDF text into misc income fields', async () => {
    const extracted = await extractDocumentFromBytes(
      pdfBytes(`
        Form 1099-MISC
        Payer's name: Studio Distribution LLC
        Rents 1,500.00
        Royalties 600.00
        Other income 300.00
        Federal income tax withheld 90.00
        Section 409A deferrals 0.00
        Nonqualified deferred compensation 0.00
      `),
      'application/pdf',
      '1099-MISC.pdf'
    )

    expect(extracted.documentType).toBe('1099-misc')
    expect(extracted.form1099Misc?.payerName).toBe('Studio Distribution LLC')
    expect(extracted.form1099Misc?.rents).toBe(1500)
    expect(extracted.form1099Misc?.royalties).toBe(600)
    expect(extracted.form1099Misc?.otherIncome).toBe(300)
    expect(extracted.form1099Misc?.federalTaxWithheld).toBe(90)
  })

  it('parses brokerage PDF text into 1099-B totals and transaction rows', async () => {
    const extracted = await extractDocumentFromBytes(
      pdfBytes(`
        Form 1099-B
        Broker name: Fidelity Brokerage
        Short-term sales proceeds 10,000.00
        Short-term cost basis 9,000.00
        Long-term sales proceeds 8,000.00
        Long-term cost basis 6,200.00
        AAPL short-term sale 10,000.00 9,000.00
        MSFT long-term sale 8,000.00 6,200.00
      `),
      'application/pdf',
      '1099-B.pdf'
    )

    expect(extracted.documentType).toBe('1099-b')
    expect(extracted.form1099B?.payerName).toBe('Fidelity Brokerage')
    expect(extracted.form1099B?.shortTermProceeds).toBe(10000)
    expect(extracted.form1099B?.longTermProceeds).toBe(8000)
    expect(extracted.form1099B?.transactions?.length).toBeGreaterThanOrEqual(2)
  })

  it('parses brokerage summary PDF text into investment totals', async () => {
    const extracted = await extractDocumentFromBytes(
      pdfBytes(`
        Annual Brokerage Statement
        Broker name: Fidelity Brokerage
        Short-term proceeds 10,000.00
        Short-term cost basis 9,000.00
        Long-term proceeds 8,000.00
        Long-term cost basis 6,200.00
      `),
      'application/pdf',
      'brokerage-summary.pdf'
    )

    expect(extracted.documentType).toBe('brokerage-summary')
    expect(extracted.form1099B?.documentVariant).toBe('brokerage-summary')
    expect(extracted.form1099B?.shortTermProceeds).toBe(10000)
    expect(extracted.form1099B?.longTermCostBasis).toBe(6200)
  })
})
