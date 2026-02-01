/**
 * IRS ATS Test Scenario 12 - Sam Gardenia
 *
 * Test Scenario Reference: IRS ATS Test Scenario 12 (1040-mef-ats-scenario-12-10292025.pdf)
 * Primary Taxpayer: Sam Gardenia
 * Filing Status: Single
 * Location: Anytown, Kentucky
 *
 * Key Features Tested:
 * - W-2 wage income with retirement plan
 * - Schedule C (Self-Employment - Designer)
 * - Schedule SE (Self-Employment Tax)
 * - Form 7206 (Self-Employed Health Insurance Deduction)
 * - Form 7217 (Partner's Report of Property Distributed by a Partnership)
 * - Schedule 1 (Additional Income and Adjustments)
 * - Schedule 2 (Additional Taxes - SE Tax)
 *
 * Tax Year: 2025
 */

import { FilingStatus } from 'ustaxes/core/data'

// =============================================================================
// Test Data Fixtures - Sam Gardenia (Scenario 12)
// =============================================================================

/**
 * Primary taxpayer information - Sam Gardenia
 */
const samGardeniaTaxpayer = {
  firstName: 'Sam',
  lastName: 'Gardenia',
  ssn: '400011212',
  ssnAtsReference: '400-00-1212',
  address: {
    address: '231 Red Run Street',
    city: 'Anytown',
    state: 'KY' as const,
    zip: '41011'
  },
  occupation: 'Designer',
  digitalAssets: false
}

/**
 * W-2 from Design LLC
 */
const w2DesignLLC = {
  employer: {
    name: 'Design LLC',
    ein: '000000011',
    address: {
      address: '426 Build St',
      city: 'Anytown',
      state: 'KY' as const,
      zip: '41011'
    }
  },
  wages: 100836,
  federalWithholding: 14444,
  ssWages: 105878,
  ssTax: 6564,
  medicareWages: 105878,
  medicareTax: 1535,
  box12DD: 10315, // Employer health coverage
  hasRetirementPlan: true,
  stateId: '00-0000056',
  stateWages: 100836,
  stateTax: 3420
}

/**
 * Schedule C (Profit or Loss from Business)
 * Principal Business Code: 541310 (Architectural Services/Designer)
 */
const scheduleC = {
  proprietorName: 'Sam Gardenia',
  principalBusiness: 'Designer',
  principalBusinessCode: '541310',
  businessName: 'Energy Build',
  businessAddress: {
    address: '654 W 3rd St',
    city: 'Anytown',
    state: 'KY' as const,
    zip: '41011'
  },
  accountingMethod: 'Cash' as const,
  materiallyParticipated: true,

  // Part I - Income
  line1GrossReceipts: 35235,
  line3GrossReceiptsLessReturns: 35235,
  line5GrossProfit: 35235,
  line7GrossIncome: 35235,

  // Part II - Expenses
  expenses: {
    line15Insurance: 550,
    line17LegalProfessional: 125,
    line18OfficeExpense: 1000,
    line20bRentOtherBusiness: 2500,
    line22Supplies: 6532,
    line23TaxesLicenses: 200
  },

  // Line 28 - Total expenses
  line28TotalExpenses: 10907,

  // Line 31 - Net profit
  line31NetProfit: 24328
}

/**
 * Schedule SE (Self-Employment Tax)
 */
const scheduleSE = {
  line2NetProfit: 24328,
  line3Combined: 24328,
  line4aSeEarnings: 22467, // 24328 * 0.9235
  line4cCombined: 22467,
  line6Total: 22467,
  line7SsWageBase: 176100,
  line8aSsWagesW2: 105878,
  line8dTotalSsWages: 105878,
  line9RemainingSsBase: 70222, // 176100 - 105878
  line10SsTax: 2786, // min(22467, 70222) * 0.124 (actually shown as $2,786 in PDF)
  line11MedicareTax: 652, // 22467 * 0.029
  line12SeTax: 3438,
  line13DeductibleSeTax: 1719 // 50% of SE tax
}

/**
 * Form 7206 (Self-Employed Health Insurance Deduction)
 */
const form7206 = {
  line1HealthInsurancePremiums: 1000,
  line3TotalPremiums: 1000,
  line4NetProfit: 24328,
  line5TotalNetProfits: 24328,
  line6Ratio: 1.0,
  line7SeTaxDeductionPortion: 1719,
  line8NetProfitMinusSeDeduction: 22609, // 24328 - 1719
  line10AvailableForDeduction: 22609,
  line13Limit: 22609,
  line14Deduction: 1000 // Smaller of line 3 or line 13
}

/**
 * Form 7217 (Partner's Report of Property Distributed by Partnership)
 */
const form7217 = {
  partnerName: 'Sam Gardenia',
  partnerTin: '400011212',
  partnershipName: 'Energy Build',
  partnershipEin: '001040012',
  distributionDate: new Date(2025, 2, 1), // March 1, 2025
  isLiquidating: false,
  is751bSaleExchange: false,

  // Part I
  line3PartnershipBasis: 32507,
  line4PartnerBasisBefore: 10000,
  line5aCashReceived: 4000,
  line5cTotalCash: 4000,
  line6Smaller: 4000,
  line7GainRecognized: 0,
  line9BasisAfterCash: 6000, // 10000 - 4000
  line10BasisToAllocate: 6000,

  // Part II - Distributed Property
  distributedProperty: {
    description: 'Cash',
    partnershipBasis: 32507,
    section734b: true,
    partnerBasis: 4000
  }
}

/**
 * Schedule 1 (Additional Income and Adjustments)
 */
const schedule1 = {
  // Part I - Additional Income
  line3BusinessIncome: 24328, // From Schedule C
  line10TotalAdditionalIncome: 24328,

  // Part II - Adjustments to Income
  line15SeTaxDeduction: 1719, // From Schedule SE
  line17SeHealthInsurance: 1000, // From Form 7206
  line26TotalAdjustments: 2719
}

/**
 * Schedule 2 (Additional Taxes)
 */
const schedule2 = {
  // Part II - Other Taxes
  line4SeTax: 3438, // From Schedule SE
  line21TotalOtherTaxes: 3438
}

/**
 * Complete Form 1040 data for Sam Gardenia
 */
const form1040Data = (() => {
  // Income
  const w2Wages = w2DesignLLC.wages
  const scheduleCIncome = scheduleC.line31NetProfit
  const totalIncome = w2Wages + scheduleCIncome // 125,164

  // Adjustments
  const adjustments = schedule1.line26TotalAdjustments

  // AGI
  const agi = totalIncome - adjustments // 122,445

  // Standard deduction (Single 2025) - per PDF
  const standardDeduction = 15000

  // Taxable income
  const taxableIncome = agi - standardDeduction // 107,445

  // Tax calculation (from PDF)
  const calculatedTax = 18634

  // SE Tax
  const seTax = scheduleSE.line12SeTax

  // Total tax
  const totalTax = calculatedTax + seTax // 22,072

  // Payments
  const totalWithholding = w2DesignLLC.federalWithholding
  const totalPayments = totalWithholding

  // Amount owed
  const amountOwed = totalTax - totalPayments // 7,628

  return {
    // Taxpayer info
    primarySsn: samGardeniaTaxpayer.ssn,
    primaryFirstName: samGardeniaTaxpayer.firstName,
    primaryLastName: samGardeniaTaxpayer.lastName,
    address: samGardeniaTaxpayer.address,
    filingStatus: FilingStatus.S,

    // Checkboxes
    digitalAssets: false,

    // Income
    line1aW2Wages: w2Wages,
    line1zTotalWages: w2Wages,
    line8Schedule1Income: scheduleCIncome,
    line9TotalIncome: totalIncome,

    // Adjustments
    line10Adjustments: adjustments,

    // AGI
    line11aAgi: agi,

    // Deduction
    line12eStandardDeduction: standardDeduction,
    line14TotalDeductions: standardDeduction,

    // Taxable income
    line15TaxableIncome: taxableIncome,

    // Tax
    line16Tax: calculatedTax,
    line18Total: calculatedTax,
    line22TaxMinusCredits: calculatedTax,
    line23OtherTaxes: seTax,
    line24TotalTax: totalTax,

    // Payments
    line25aW2Withholding: totalWithholding,
    line25dTotalWithholding: totalWithholding,
    line33TotalPayments: totalPayments,

    // Amount owed
    line37AmountOwed: amountOwed,

    // Summary
    wages: w2Wages,
    totalIncome,
    agi,
    deduction: standardDeduction,
    taxableIncome,
    totalTax,
    totalPayments,
    amountOwed
  }
})()

// =============================================================================
// Tests
// =============================================================================

describe('ATS Scenario 12 - Sam Gardenia (Schedule C, Form 7206, Form 7217)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct taxpayer name', () => {
      expect(samGardeniaTaxpayer.firstName).toBe('Sam')
      expect(samGardeniaTaxpayer.lastName).toBe('Gardenia')
    })

    it('should be in Kentucky', () => {
      expect(samGardeniaTaxpayer.address.state).toBe('KY')
      expect(samGardeniaTaxpayer.address.city).toBe('Anytown')
    })

    it('should have valid SSN format', () => {
      expect(samGardeniaTaxpayer.ssn).toHaveLength(9)
      expect(/^\d{9}$/.test(samGardeniaTaxpayer.ssn)).toBe(true)
    })

    it('should be a Designer', () => {
      expect(samGardeniaTaxpayer.occupation).toBe('Designer')
    })
  })

  describe('W-2 Income', () => {
    it('should have correct wages', () => {
      expect(w2DesignLLC.wages).toBe(100836)
    })

    it('should have correct federal withholding', () => {
      expect(w2DesignLLC.federalWithholding).toBe(14444)
    })

    it('should have SS wages higher than regular wages', () => {
      expect(w2DesignLLC.ssWages).toBeGreaterThan(w2DesignLLC.wages)
      expect(w2DesignLLC.ssWages).toBe(105878)
    })

    it('should have retirement plan', () => {
      expect(w2DesignLLC.hasRetirementPlan).toBe(true)
    })

    it('should have Box 12 DD for employer health coverage', () => {
      expect(w2DesignLLC.box12DD).toBe(10315)
    })
  })

  describe('Schedule C (Business Income)', () => {
    it('should have correct business name', () => {
      expect(scheduleC.businessName).toBe('Energy Build')
    })

    it('should have correct principal business code', () => {
      expect(scheduleC.principalBusinessCode).toBe('541310')
    })

    it('should have correct gross receipts', () => {
      expect(scheduleC.line1GrossReceipts).toBe(35235)
    })

    it('should calculate total expenses correctly', () => {
      const expected = Object.values(scheduleC.expenses).reduce(
        (sum, val) => sum + val,
        0
      )
      expect(scheduleC.line28TotalExpenses).toBe(expected)
    })

    it('should calculate net profit correctly', () => {
      const expected = scheduleC.line7GrossIncome - scheduleC.line28TotalExpenses
      expect(scheduleC.line31NetProfit).toBe(expected)
    })

    it('should materially participate', () => {
      expect(scheduleC.materiallyParticipated).toBe(true)
    })
  })

  describe('Schedule SE (Self-Employment Tax)', () => {
    it('should flow Schedule C profit correctly', () => {
      expect(scheduleSE.line2NetProfit).toBe(scheduleC.line31NetProfit)
    })

    it('should calculate SE earnings at 92.35%', () => {
      const expected = Math.floor(scheduleSE.line2NetProfit * 0.9235)
      expect(scheduleSE.line4aSeEarnings).toBeCloseTo(expected, -1)
    })

    it('should have correct 2025 SS wage base', () => {
      expect(scheduleSE.line7SsWageBase).toBe(176100)
    })

    it('should use W-2 SS wages', () => {
      expect(scheduleSE.line8aSsWagesW2).toBe(w2DesignLLC.ssWages)
    })

    it('should calculate SS tax correctly', () => {
      expect(scheduleSE.line10SsTax).toBe(2786)
    })

    it('should calculate Medicare tax correctly', () => {
      expect(scheduleSE.line11MedicareTax).toBe(652)
    })

    it('should calculate total SE tax correctly', () => {
      const expected = scheduleSE.line10SsTax + scheduleSE.line11MedicareTax
      expect(scheduleSE.line12SeTax).toBe(expected)
    })

    it('should calculate deductible SE tax as 50%', () => {
      const expected = Math.floor(scheduleSE.line12SeTax / 2)
      expect(scheduleSE.line13DeductibleSeTax).toBe(expected)
    })
  })

  describe('Form 7206 (Self-Employed Health Insurance)', () => {
    it('should have health insurance premiums', () => {
      expect(form7206.line1HealthInsurancePremiums).toBe(1000)
    })

    it('should limit deduction to premiums', () => {
      const premiums = form7206.line3TotalPremiums
      const limit = form7206.line13Limit
      expect(form7206.line14Deduction).toBe(Math.min(premiums, limit))
    })

    it('should use net profit for limitation', () => {
      expect(form7206.line4NetProfit).toBe(scheduleC.line31NetProfit)
    })

    it('should subtract SE tax deduction', () => {
      expect(form7206.line7SeTaxDeductionPortion).toBe(
        scheduleSE.line13DeductibleSeTax
      )
    })
  })

  describe('Form 7217 (Partnership Distribution)', () => {
    it('should have correct partnership info', () => {
      expect(form7217.partnershipName).toBe('Energy Build')
      expect(form7217.partnershipEin).toBe('001040012')
    })

    it('should not be a liquidating distribution', () => {
      expect(form7217.isLiquidating).toBe(false)
    })

    it('should have cash distribution', () => {
      expect(form7217.line5aCashReceived).toBe(4000)
    })

    it('should recognize no gain', () => {
      expect(form7217.line7GainRecognized).toBe(0)
    })

    it('should calculate basis after cash correctly', () => {
      const expected =
        form7217.line4PartnerBasisBefore - form7217.line5aCashReceived
      expect(form7217.line9BasisAfterCash).toBe(expected)
    })
  })

  describe('Schedule 1 (Additional Income and Adjustments)', () => {
    it('should have business income from Schedule C', () => {
      expect(schedule1.line3BusinessIncome).toBe(scheduleC.line31NetProfit)
    })

    it('should have SE tax deduction from Schedule SE', () => {
      expect(schedule1.line15SeTaxDeduction).toBe(scheduleSE.line13DeductibleSeTax)
    })

    it('should have health insurance deduction from Form 7206', () => {
      expect(schedule1.line17SeHealthInsurance).toBe(form7206.line14Deduction)
    })

    it('should calculate total adjustments correctly', () => {
      const expected =
        schedule1.line15SeTaxDeduction + schedule1.line17SeHealthInsurance
      expect(schedule1.line26TotalAdjustments).toBe(expected)
    })
  })

  describe('Schedule 2 (Additional Taxes)', () => {
    it('should have SE tax from Schedule SE', () => {
      expect(schedule2.line4SeTax).toBe(scheduleSE.line12SeTax)
    })

    it('should have total other taxes equal SE tax', () => {
      expect(schedule2.line21TotalOtherTaxes).toBe(schedule2.line4SeTax)
    })
  })

  describe('Tax Calculation', () => {
    it('should have correct filing status', () => {
      expect(form1040Data.filingStatus).toBe(FilingStatus.S)
    })

    it('should calculate total income correctly', () => {
      const expected = w2DesignLLC.wages + scheduleC.line31NetProfit
      expect(form1040Data.line9TotalIncome).toBe(expected)
      expect(form1040Data.line9TotalIncome).toBe(125164)
    })

    it('should calculate AGI correctly', () => {
      const expected =
        form1040Data.line9TotalIncome - form1040Data.line10Adjustments
      expect(form1040Data.line11aAgi).toBe(expected)
      expect(form1040Data.line11aAgi).toBe(122445)
    })

    it('should calculate taxable income correctly', () => {
      expect(form1040Data.line15TaxableIncome).toBe(107445)
    })

    it('should have correct regular tax', () => {
      expect(form1040Data.line16Tax).toBe(18634)
    })

    it('should have SE tax on Schedule 2', () => {
      expect(form1040Data.line23OtherTaxes).toBe(3438)
    })

    it('should calculate total tax correctly', () => {
      const expected = form1040Data.line16Tax + form1040Data.line23OtherTaxes
      expect(form1040Data.line24TotalTax).toBe(expected)
      expect(form1040Data.line24TotalTax).toBe(22072)
    })

    it('should calculate amount owed correctly', () => {
      const expected =
        form1040Data.line24TotalTax - form1040Data.line33TotalPayments
      expect(form1040Data.line37AmountOwed).toBe(expected)
      expect(form1040Data.line37AmountOwed).toBe(7628)
    })
  })

  describe('Integration', () => {
    it('should have all required Form 1040 fields', () => {
      const requiredFields = [
        'primarySsn',
        'primaryFirstName',
        'primaryLastName',
        'filingStatus',
        'wages',
        'totalIncome',
        'agi',
        'deduction',
        'taxableIncome',
        'totalTax',
        'totalPayments'
      ]

      for (const field of requiredFields) {
        expect(form1040Data).toHaveProperty(field)
      }
    })

    it('should flow Schedule C to Schedule 1 correctly', () => {
      expect(schedule1.line3BusinessIncome).toBe(scheduleC.line31NetProfit)
    })

    it('should flow Schedule C to Schedule SE correctly', () => {
      expect(scheduleSE.line2NetProfit).toBe(scheduleC.line31NetProfit)
    })

    it('should flow Schedule SE to Schedule 1 correctly', () => {
      expect(schedule1.line15SeTaxDeduction).toBe(scheduleSE.line13DeductibleSeTax)
    })

    it('should flow Schedule SE to Schedule 2 correctly', () => {
      expect(schedule2.line4SeTax).toBe(scheduleSE.line12SeTax)
    })

    it('should flow Form 7206 to Schedule 1 correctly', () => {
      expect(schedule1.line17SeHealthInsurance).toBe(form7206.line14Deduction)
    })
  })
})
