/**
 * IRS ATS Test Scenario NR-12 - John Harrier
 *
 * Test Scenario Reference: IRS ATS Test Scenario NR-12 (ty2025-form-1040-nr-scenario-12.pdf)
 * Primary Taxpayer: John Harrier
 * Filing Status: Married Filing Separately (MFS)
 * Location: Melbourne, Australia (Foreign Address)
 *
 * Key Features Tested:
 * - Form 1040-NR for Nonresident Alien (MFS filing status)
 * - Schedule A (Form 1040-NR) - Itemized Deductions (SALT cap $5,000 for MFS)
 * - Schedule P (Form 1040-NR) - Foreign Partner's Partnership Interest Transfer
 * - Schedule D - Capital Gains and Losses
 * - Form 8949 - Sales and Other Dispositions of Capital Assets
 * - Short-term capital gain from partnership interest transfer
 * - Estimated tax payments
 *
 * Tax Year: 2025
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-plus-operands, @typescript-eslint/no-unsafe-argument */

// =============================================================================
// Test Data Fixtures - John Harrier (Scenario NR-12)
// =============================================================================

/**
 * Primary taxpayer information - John Harrier
 */
const johnHarrierTaxpayer = {
  firstName: 'John',
  lastName: 'Harrier',
  ssn: '123011112',
  ssnAtsReference: '123-00-1112',
  foreignAddress: {
    street: '500 Watheroo St',
    city: 'Melbourne',
    province: 'VIC',
    postalCode: '3000',
    country: 'Australia'
  },
  dateOfBirth: new Date(1975, 7, 20), // August 20, 1975
  isNonresidentAlien: true,
  filingStatus: 'MFS' as const,
  filingStatusCode: 3,
  digitalAssets: false
}

/**
 * Schedule A (Form 1040-NR) - Itemized Deductions
 */
const scheduleA = {
  // Taxes You Paid
  line1aStateLocalIncomeTaxes: 5432,
  // SALT cap for MFS is $5,000 (half of $10,000)
  line1bSaltDeduction: 5000,

  // Gifts to U.S. Charities
  line2CashGifts: 0,
  line3NoncashGifts: 0,
  line4Carryover: 0,
  line5TotalGifts: 0,

  // Casualty and Theft Losses
  line6CasualtyTheft: 0,

  // Other Itemized Deductions
  line7Other: 0,

  // Total Itemized Deductions
  line8Total: 5000
}

/**
 * Schedule P (Form 1040-NR) - Foreign Partner's Partnership Interest Transfer
 */
const scheduleP = {
  // Part I - Partnership Interest Information
  partnershipName: 'IRIDIUM PARTNERSHIP',
  partnershipAddress: '50 W Roan Blvd, San Jose, CA 95101',
  partnershipEin: '005159901',
  percentageTransferred: 10, // 10%
  dateAcquired: new Date(2025, 5, 15), // June 15, 2025
  dateTransferred: new Date(2025, 11, 31), // December 31, 2025
  totalTransfers: 1,
  totalProceeds: 375000,

  // Part II - Gain or Loss on Transfer
  line1Proceeds: 375000,
  line2OutsideBasis: 25000,
  line3TotalOutsideGain: 350000, // 375000 - 25000
  line4Section751OrdinaryGain: 0,
  line5TotalCapitalGain: 350000,
  line6EciOrdinaryGain: 0,
  line7EciCapitalGain: 375000,
  line8RecognizedEciOrdinary: 0,
  line9RecognizedEciCapital: 350000 // Smaller of line 5 or line 7
}

/**
 * Form 8949 (Sales and Other Dispositions of Capital Assets)
 */
const form8949 = {
  // Part I - Short-Term
  partIBoxChecked: 'C', // Not reported on Form 1099-B
  transactions: [
    {
      description: 'From Schedule P (Form 1040-NR)',
      dateAcquired: scheduleP.dateAcquired,
      dateSold: scheduleP.dateTransferred,
      proceeds: scheduleP.line1Proceeds,
      costBasis: scheduleP.line2OutsideBasis,
      adjustmentCode: null,
      adjustmentAmount: 0,
      gainLoss: scheduleP.line3TotalOutsideGain
    }
  ],
  line2Totals: {
    proceeds: 375000,
    cost: 25000,
    adjustment: 0,
    gain: 350000
  },

  // Part II - Long-Term
  partIITransactions: [] // No long-term transactions
}

/**
 * Schedule D (Capital Gains and Losses)
 */
const scheduleD = {
  // Part I - Short-Term Capital Gains and Losses
  line1a: null, // Blank
  line1b: null, // Box A or G
  line2: null, // Box B or H
  line3: {
    // Box C or I checked
    proceeds: form8949.line2Totals.proceeds,
    cost: form8949.line2Totals.cost,
    adjustment: form8949.line2Totals.adjustment,
    gain: form8949.line2Totals.gain
  },
  line4Form6252Etc: 0,
  line5K1ShortTerm: 0,
  line6Carryover: 0,
  line7NetShortTerm: 350000,

  // Part II - Long-Term Capital Gains and Losses
  line8a: null,
  line8b: null,
  line9: null,
  line10: null,
  line11Form4797Etc: 0,
  line12K1LongTerm: 0,
  line13CapitalDistributions: 0,
  line14Carryover: 0,
  line15NetLongTerm: 0,

  // Part III - Summary
  line16Combined: 350000, // Short-term + Long-term
  line17BothGains: false, // Line 15 is 0
  line22QualifiedDividends: false
}

/**
 * Complete Form 1040-NR data for John Harrier
 */
const form1040NRData = (() => {
  // Income calculation
  const capitalGain = scheduleD.line16Combined
  const totalEci = capitalGain // 350,000

  // AGI (no adjustments)
  const agi = totalEci // 350,000

  // Deductions
  const itemizedDeductions = scheduleA.line8Total // 5,000

  // Taxable income
  const taxableIncome = agi - itemizedDeductions // 345,000

  // Tax calculation - MFS brackets 2025
  // Short-term capital gain taxed as ordinary income
  const tax = 90297 // From the form

  // No credits
  const totalCredits = 0

  // Tax after credits
  const taxAfterCredits = tax - totalCredits // 90,297

  // No other taxes
  const otherTaxes = 0

  // Total tax
  const totalTax = taxAfterCredits + otherTaxes // 90,297

  // Payments - Estimated tax payments
  const estimatedPayments = 90297
  const totalPayments = estimatedPayments

  // Amount owed (payments = tax exactly)
  const balance = totalTax - totalPayments // 0

  return {
    formType: '1040-NR',
    taxYear: 2025,
    filingStatus: 'MFS',
    filingStatusCode: 3,

    // Taxpayer info
    taxpayer: johnHarrierTaxpayer,

    // Income (Effectively Connected)
    line1aW2Wages: 0,
    line7aCapitalGain: capitalGain,
    line9TotalEci: totalEci,
    line11aAgi: agi,

    // Tax and Credits
    line11bAgi: agi,
    line12ItemizedDeductions: itemizedDeductions,
    line14TotalDeductions: itemizedDeductions,
    line15TaxableIncome: taxableIncome,
    line16Tax: tax,
    line17Schedule2Line3: 0,
    line18Total: tax,
    line19ChildTaxCredit: 0,
    line20Schedule3Line8: 0,
    line21TotalCredits: totalCredits,
    line22TaxAfterCredits: taxAfterCredits,
    line23aNecTax: 0,
    line23bOtherTaxes: otherTaxes,
    line23dTotalOther: otherTaxes,
    line24TotalTax: totalTax,

    // Payments
    line25aW2Withholding: 0,
    line25dTotalWithholding: 0,
    line26EstimatedPayments: estimatedPayments,
    line33TotalPayments: totalPayments,

    // Amount Owed
    line37AmountOwed: balance,

    // Attached schedules/forms
    hasScheduleANr: true,
    hasScheduleP: true,
    hasScheduleD: true,
    hasForm8949: true
  }
})()

// =============================================================================
// Tests
// =============================================================================

describe('ATS Scenario NR-12 - John Harrier (Form 1040-NR MFS Partnership Transfer)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct taxpayer name', () => {
      expect(johnHarrierTaxpayer.firstName).toBe('John')
      expect(johnHarrierTaxpayer.lastName).toBe('Harrier')
    })

    it('should have valid SSN format', () => {
      expect(johnHarrierTaxpayer.ssn).toHaveLength(9)
      expect(/^\d{9}$/.test(johnHarrierTaxpayer.ssn)).toBe(true)
    })

    it('should be a nonresident alien', () => {
      expect(johnHarrierTaxpayer.isNonresidentAlien).toBe(true)
    })

    it('should have foreign address in Australia', () => {
      expect(johnHarrierTaxpayer.foreignAddress.country).toBe('Australia')
      expect(johnHarrierTaxpayer.foreignAddress.province).toBe('VIC')
      expect(johnHarrierTaxpayer.foreignAddress.city).toBe('Melbourne')
    })

    it('should have Married Filing Separately filing status', () => {
      expect(johnHarrierTaxpayer.filingStatus).toBe('MFS')
      expect(johnHarrierTaxpayer.filingStatusCode).toBe(3)
    })

    it('should have no digital assets', () => {
      expect(johnHarrierTaxpayer.digitalAssets).toBe(false)
    })
  })

  describe('Schedule A (Itemized Deductions)', () => {
    it('should have correct state/local taxes entered', () => {
      expect(scheduleA.line1aStateLocalIncomeTaxes).toBe(5432)
    })

    it('should apply MFS SALT cap of $5,000', () => {
      expect(scheduleA.line1bSaltDeduction).toBe(5000)
      expect(scheduleA.line1aStateLocalIncomeTaxes).toBeGreaterThan(
        scheduleA.line1bSaltDeduction
      )
    })

    it('should have no charitable contributions', () => {
      expect(scheduleA.line5TotalGifts).toBe(0)
    })

    it('should have total itemized deductions of $5,000', () => {
      expect(scheduleA.line8Total).toBe(5000)
    })
  })

  describe('Schedule P (Partnership Interest Transfer)', () => {
    it('should have correct partnership name', () => {
      expect(scheduleP.partnershipName).toBe('IRIDIUM PARTNERSHIP')
    })

    it('should have correct partnership EIN', () => {
      expect(scheduleP.partnershipEin).toBe('005159901')
    })

    it('should have partnership in California', () => {
      expect(scheduleP.partnershipAddress).toContain('San Jose, CA')
    })

    it('should have 10% interest transferred', () => {
      expect(scheduleP.percentageTransferred).toBe(10)
    })

    it('should have short-term holding period', () => {
      const acquired = scheduleP.dateAcquired
      const transferred = scheduleP.dateTransferred
      const daysHeld = Math.floor(
        (transferred.getTime() - acquired.getTime()) / (1000 * 60 * 60 * 24)
      )
      expect(daysHeld).toBeLessThan(365)
    })

    it('should have correct proceeds', () => {
      expect(scheduleP.line1Proceeds).toBe(375000)
    })

    it('should have correct outside basis', () => {
      expect(scheduleP.line2OutsideBasis).toBe(25000)
    })

    it('should calculate total gain correctly', () => {
      const expected = scheduleP.line1Proceeds - scheduleP.line2OutsideBasis
      expect(scheduleP.line3TotalOutsideGain).toBe(expected)
      expect(expected).toBe(350000)
    })

    it('should have no Section 751 ordinary gain', () => {
      expect(scheduleP.line4Section751OrdinaryGain).toBe(0)
    })

    it('should have capital gain equal total gain', () => {
      expect(scheduleP.line5TotalCapitalGain).toBe(
        scheduleP.line3TotalOutsideGain
      )
    })

    it('should recognize ECI capital gain as smaller of line 5 or 7', () => {
      const expected = Math.min(
        scheduleP.line5TotalCapitalGain,
        scheduleP.line7EciCapitalGain
      )
      expect(scheduleP.line9RecognizedEciCapital).toBe(expected)
    })
  })

  describe('Form 8949 (Sales and Dispositions)', () => {
    it('should have Box C checked (not on 1099-B)', () => {
      expect(form8949.partIBoxChecked).toBe('C')
    })

    it('should reference Schedule P in description', () => {
      const txn = form8949.transactions[0]
      expect(txn.description).toContain('Schedule P')
    })

    it('should have correct transaction dates', () => {
      const txn = form8949.transactions[0]
      expect(txn.dateAcquired).toEqual(new Date(2025, 5, 15))
      expect(txn.dateSold).toEqual(new Date(2025, 11, 31))
    })

    it('should have correct transaction amounts', () => {
      const txn = form8949.transactions[0]
      expect(txn.proceeds).toBe(375000)
      expect(txn.costBasis).toBe(25000)
      expect(txn.gainLoss).toBe(350000)
    })

    it('should have correct line 2 totals', () => {
      expect(form8949.line2Totals.proceeds).toBe(375000)
      expect(form8949.line2Totals.cost).toBe(25000)
      expect(form8949.line2Totals.gain).toBe(350000)
    })

    it('should have no long-term transactions', () => {
      expect(form8949.partIITransactions).toHaveLength(0)
    })
  })

  describe('Schedule D (Capital Gains)', () => {
    it('should have short-term gain on line 3 (Box C)', () => {
      expect(scheduleD.line3.gain).toBe(350000)
    })

    it('should have net short-term capital gain', () => {
      expect(scheduleD.line7NetShortTerm).toBe(350000)
    })

    it('should have no long-term gain', () => {
      expect(scheduleD.line15NetLongTerm).toBe(0)
    })

    it('should have combined gain on line 16', () => {
      const expected = scheduleD.line7NetShortTerm + scheduleD.line15NetLongTerm
      expect(scheduleD.line16Combined).toBe(expected)
    })

    it('should not have both gains', () => {
      expect(scheduleD.line17BothGains).toBe(false)
    })

    it('should have no qualified dividends', () => {
      expect(scheduleD.line22QualifiedDividends).toBe(false)
    })
  })

  describe('Form 1040-NR Tax Calculation', () => {
    it('should have correct form type', () => {
      expect(form1040NRData.formType).toBe('1040-NR')
    })

    it('should have MFS filing status', () => {
      expect(form1040NRData.filingStatus).toBe('MFS')
    })

    it('should have capital gain as only income', () => {
      expect(form1040NRData.line7aCapitalGain).toBe(350000)
      expect(form1040NRData.line1aW2Wages).toBe(0)
    })

    it('should have total ECI of $350,000', () => {
      expect(form1040NRData.line9TotalEci).toBe(350000)
    })

    it('should have AGI of $350,000', () => {
      expect(form1040NRData.line11aAgi).toBe(350000)
    })

    it('should use itemized deductions of $5,000', () => {
      expect(form1040NRData.line12ItemizedDeductions).toBe(5000)
    })

    it('should calculate taxable income correctly', () => {
      const expected = 350000 - 5000
      expect(form1040NRData.line15TaxableIncome).toBe(expected)
    })

    it('should have correct tax amount', () => {
      expect(form1040NRData.line16Tax).toBe(90297)
    })

    it('should have no credits', () => {
      expect(form1040NRData.line21TotalCredits).toBe(0)
    })

    it('should have correct total tax', () => {
      expect(form1040NRData.line24TotalTax).toBe(90297)
    })

    it('should have correct estimated payments', () => {
      expect(form1040NRData.line26EstimatedPayments).toBe(90297)
    })

    it('should have total payments equal total tax', () => {
      expect(form1040NRData.line33TotalPayments).toBe(
        form1040NRData.line24TotalTax
      )
    })

    it('should have no balance due', () => {
      expect(form1040NRData.line37AmountOwed).toBe(0)
    })
  })

  describe('Tax Rate Analysis', () => {
    it('should have reasonable effective tax rate for MFS', () => {
      const taxable = form1040NRData.line15TaxableIncome
      const tax = form1040NRData.line16Tax
      const effectiveRate = tax / taxable
      // Effective rate should be around 26% for this income level
      expect(effectiveRate).toBeGreaterThan(0.25)
      expect(effectiveRate).toBeLessThan(0.28)
    })
  })

  describe('Integration', () => {
    it('should flow Schedule P to Form 8949', () => {
      expect(form8949.line2Totals.proceeds).toBe(scheduleP.line1Proceeds)
      expect(form8949.line2Totals.cost).toBe(scheduleP.line2OutsideBasis)
      expect(form8949.line2Totals.gain).toBe(scheduleP.line3TotalOutsideGain)
    })

    it('should flow Form 8949 to Schedule D', () => {
      expect(scheduleD.line3.gain).toBe(form8949.line2Totals.gain)
    })

    it('should flow Schedule D to Form 1040-NR', () => {
      expect(form1040NRData.line7aCapitalGain).toBe(scheduleD.line16Combined)
    })

    it('should flow Schedule A to Form 1040-NR', () => {
      expect(form1040NRData.line12ItemizedDeductions).toBe(scheduleA.line8Total)
    })

    it('should have consistent line math', () => {
      // Taxable income = AGI - Deductions
      const expectedTaxable =
        form1040NRData.line11aAgi - form1040NRData.line14TotalDeductions
      expect(form1040NRData.line15TaxableIncome).toBe(expectedTaxable)

      // Tax after credits = Tax - Credits
      const expectedAfterCredits =
        form1040NRData.line16Tax - form1040NRData.line21TotalCredits
      expect(form1040NRData.line22TaxAfterCredits).toBe(expectedAfterCredits)

      // Total tax = Tax after credits + Other taxes
      const expectedTotalTax =
        form1040NRData.line22TaxAfterCredits + form1040NRData.line23dTotalOther
      expect(form1040NRData.line24TotalTax).toBe(expectedTotalTax)

      // Amount owed = Total tax - Total payments
      const expectedOwed =
        form1040NRData.line24TotalTax - form1040NRData.line33TotalPayments
      expect(form1040NRData.line37AmountOwed).toBe(expectedOwed)
    })

    it('should have complete gain calculation chain', () => {
      // Schedule P: Proceeds - Basis = Gain
      const pGain = scheduleP.line1Proceeds - scheduleP.line2OutsideBasis
      expect(pGain).toBe(350000)

      // Form 8949: Same gain
      expect(form8949.line2Totals.gain).toBe(pGain)

      // Schedule D line 3: Same gain
      expect(scheduleD.line3.gain).toBe(pGain)

      // Schedule D line 7: Net short-term
      expect(scheduleD.line7NetShortTerm).toBe(pGain)

      // Schedule D line 16: Combined
      expect(scheduleD.line16Combined).toBe(pGain)

      // Form 1040-NR line 7a: Capital gain
      expect(form1040NRData.line7aCapitalGain).toBe(pGain)
    })
  })

  describe('Validation Rules', () => {
    it('should use 1040-NR for nonresident alien', () => {
      expect(form1040NRData.formType).toBe('1040-NR')
      expect(form1040NRData.taxpayer.isNonresidentAlien).toBe(true)
    })

    it('should apply MFS SALT cap of $5,000', () => {
      expect(scheduleA.line1bSaltDeduction).toBe(5000)
    })

    it('should require Schedule P for partnership interest transfer', () => {
      expect(form1040NRData.hasScheduleP).toBe(true)
    })

    it('should require Schedule D for capital gain', () => {
      expect(form1040NRData.hasScheduleD).toBe(true)
    })
  })
})

export {}
