/**
 * IRS ATS Test Scenario 1 - Tara Black
 *
 * Test Scenario Reference: IRS ATS Test Scenario 1 (ty25-1040-mef-ats-scenario-1-12012025.pdf)
 * Primary Taxpayer: Tara Black
 * Filing Status: Single (1)
 * No Dependents
 *
 * Key Features Tested:
 * - Multiple W-2 forms from different employers
 * - Schedule H (Household Employment Taxes)
 * - Form 5695 (Residential Energy Credits)
 * - Schedule 2 (Additional Taxes)
 * - Schedule 3 (Additional Credits)
 * - Energy efficient home improvements (doors, windows, AC)
 *
 * Tax Year: 2025
 */

import { FilingStatus } from 'ustaxes/core/data'

// =============================================================================
// Test Data Fixtures - Tara Black (Scenario 1)
// =============================================================================

/**
 * Primary taxpayer information
 * ATS Reference SSN: 400-00-1032 (invalid for production)
 * Test SSN: 400011032 (valid format for testing)
 */
const taraBlackTaxpayer = {
  firstName: 'Tara',
  lastName: 'Black',
  ssn: '400011032',
  ssnAtsReference: '400-00-1032',
  address: {
    address: '17 Lexington Drive',
    city: 'Cincinnati',
    state: 'OH' as const,
    zip: '45223'
  },
  dateOfBirth: new Date(1985, 5, 15), // June 15, 1985
  occupation: 'Sales Representative',
  digitalAssets: false
}

/**
 * W-2 #1 - The Green Ladies (Georgia employer)
 */
const w2GreenLadies = {
  employeeName: 'Tara Black',
  employerName: 'The Green Ladies',
  employerEin: '000000007',
  employerAddress: {
    address: '14 Forest Lane',
    city: 'Atlanta',
    state: 'GA' as const,
    zip: '30033'
  },
  box1Wages: 22970,
  box2FederalWithholding: 1073,
  box3SsWages: 22970,
  box4SsTax: 1424,
  box5MedicareWages: 22970,
  box6MedicareTax: 333,
  box15State: 'GA',
  box16StateWages: 22970,
  box17StateTax: 320
}

/**
 * W-2 #2 - C&R (Ohio employer)
 */
const w2CR = {
  employeeName: 'Tara Black',
  employerName: 'C&R',
  employerEin: '000000007',
  employerAddress: {
    address: '1121 W Fourth Street',
    city: 'Cincinnati',
    state: 'OH' as const,
    zip: '45223'
  },
  box1Wages: 19500,
  box2FederalWithholding: 1640,
  box3SsWages: 19500,
  box4SsTax: 1209,
  box5MedicareWages: 19500,
  box6MedicareTax: 283,
  box15State: 'GA', // State wages reported to GA even though employer is OH
  box16StateWages: 19500,
  box17StateTax: 416
}

/**
 * W-2 totals
 */
const w2Totals = {
  totalWages: 42470, // 22970 + 19500
  federalWithholding: 2713, // 1073 + 1640
  ssWages: 42470,
  ssTax: 2633, // 1424 + 1209
  medicareWages: 42470,
  medicareTax: 616, // 333 + 283
  stateTax: 736 // 320 + 416
}

/**
 * Schedule H (Household Employment Taxes)
 * Tara employs household help with cash wages of $3,100
 */
const scheduleH = {
  employerEin: '000000029',
  cashWagesPaid: 3100,
  cashWagesSubjectToSs: 3100,
  cashWagesSubjectToMedicare: 3100,
  ssTaxRate: 0.124, // 12.4% (employer + employee share)
  medicareTaxRate: 0.029, // 2.9% (employer + employee share)
  socialSecurityTax: 384.4, // 3100 * 0.124
  medicareTax: 89.9, // 3100 * 0.029
  line7SsMedicareTax: 474.3, // 384.40 + 89.90
  line8TotalTaxes: 474.3,
  futaRequired: false,
  futaTax: 0,
  totalHouseholdEmploymentTaxes: 474.3
}

/**
 * Form 5695 (Residential Energy Credits)
 * Energy efficient home improvements
 */
const form5695 = {
  propertyAddress: {
    address: '17 Lexington Drive',
    city: 'Cincinnati',
    state: 'OH' as const,
    zip: '45223'
  },
  exteriorDoors: {
    totalCost: 2740,
    creditRate: 0.3,
    calculatedCredit: 822, // 2740 * 0.30
    creditCap: 500,
    allowedCredit: 500 // Limited to cap
  },
  windows: {
    totalCost: 600,
    creditRate: 0.3,
    calculatedCredit: 180, // 600 * 0.30
    creditCap: 600,
    allowedCredit: 180 // Below cap, use calculated
  },
  centralAc: {
    totalCost: 2500,
    creditRate: 0.3,
    calculatedCredit: 750, // 2500 * 0.30
    creditCap: 600,
    allowedCredit: 600 // Limited to cap
  },
  line29Total: 1280, // 500 + 180 + 600
  annualLimit: 1200,
  priorYearCreditUsed: 0,
  line32Credit: 1200 // Min(1280, 1200 - 0)
}

/**
 * Schedule 2 (Additional Taxes)
 */
const schedule2 = {
  line8HouseholdEmploymentTaxes: 474, // From Schedule H (rounded)
  line21Total: 474
}

/**
 * Schedule 3 (Additional Credits)
 */
const schedule3 = {
  line5ResidentialEnergyCredit: 1200, // From Form 5695, Line 32
  line8TotalPart1: 1200
}

/**
 * Complete Form 1040 data for Tara Black
 */
const form1040Data = (() => {
  // Income
  const totalWages = w2Totals.totalWages // $42,470
  const totalIncome = totalWages

  // AGI (no adjustments)
  const agi = totalIncome

  // Standard Deduction (2025 Single)
  const standardDeductionSingle2025 = 15000

  // Taxable Income
  const taxableIncome = Math.max(0, agi - standardDeductionSingle2025) // $27,470

  // Tax calculation (2025 Single brackets)
  // $0 - $11,600: 10%
  // $11,601 - $47,150: 12%
  let calculatedTax: number
  if (taxableIncome <= 11600) {
    calculatedTax = taxableIncome * 0.1
  } else if (taxableIncome <= 47150) {
    const taxBracket1 = 11600 * 0.1 // $1,160
    const remaining = taxableIncome - 11600 // $15,870
    const taxBracket2 = remaining * 0.12 // $1,904.40
    calculatedTax = taxBracket1 + taxBracket2 // $3,064.40
  } else {
    const taxBracket1 = 11600 * 0.1
    const taxBracket2 = 35550 * 0.12
    const remaining = taxableIncome - 47150
    const taxBracket3 = remaining * 0.22
    calculatedTax = taxBracket1 + taxBracket2 + taxBracket3
  }
  calculatedTax = Math.round(calculatedTax) // $3,064

  // Schedule 2 additional taxes
  const schedule2Tax = schedule2.line21Total

  // Total tax before credits
  const totalTaxBeforeCredits = calculatedTax + schedule2Tax // $3,538

  // Credits from Schedule 3
  const nonrefundableCredits = schedule3.line8TotalPart1

  // Tax after credits
  const taxAfterCredits = Math.max(0, totalTaxBeforeCredits - nonrefundableCredits) // $2,338

  // Total tax
  const totalTax = taxAfterCredits

  // Payments
  const federalWithholding = w2Totals.federalWithholding // $2,713
  const totalPayments = federalWithholding

  // Refund or owed
  const refund = totalPayments > totalTax ? totalPayments - totalTax : 0
  const amountOwed = totalTax > totalPayments ? totalTax - totalPayments : 0

  return {
    // Taxpayer info
    primarySsn: taraBlackTaxpayer.ssn,
    primaryFirstName: taraBlackTaxpayer.firstName,
    primaryLastName: taraBlackTaxpayer.lastName,
    address: taraBlackTaxpayer.address,
    filingStatus: FilingStatus.S,

    // No spouse or dependents
    spouseSsn: undefined,
    dependents: [],

    // Income lines
    line1zWages: totalWages,
    line9TotalIncome: totalIncome,
    totalIncome,

    // Adjustments
    line10Adjustments: 0,

    // AGI
    line11Agi: agi,
    agi,

    // Deductions
    line12Deduction: standardDeductionSingle2025,
    line14TotalDeductions: standardDeductionSingle2025,
    deduction: standardDeductionSingle2025,

    // Taxable income
    line15TaxableIncome: taxableIncome,
    taxableIncome,

    // Tax
    line16Tax: calculatedTax,
    line17Schedule2: schedule2Tax,
    line18Total: totalTaxBeforeCredits,
    line20Schedule3: nonrefundableCredits,
    line22TaxMinusCredits: taxAfterCredits,
    line24TotalTax: totalTax,
    totalTax,

    // Payments
    line25aW2Withholding: federalWithholding,
    line25dTotalWithholding: federalWithholding,
    line33TotalPayments: totalPayments,
    totalPayments,

    // Refund or Amount Owed
    line34Overpaid: refund,
    line35aRefund: refund,
    line37AmountOwed: amountOwed,
    refund,
    amountOwed
  }
})()

// =============================================================================
// Tests
// =============================================================================

describe('ATS Scenario 1 - Tara Black (Single with Energy Credits)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct taxpayer name', () => {
      expect(taraBlackTaxpayer.firstName).toBe('Tara')
      expect(taraBlackTaxpayer.lastName).toBe('Black')
    })

    it('should have valid SSN format (9 digits)', () => {
      expect(taraBlackTaxpayer.ssn).toHaveLength(9)
      expect(/^\d{9}$/.test(taraBlackTaxpayer.ssn)).toBe(true)
    })

    it('should have occupation as Sales Representative', () => {
      expect(taraBlackTaxpayer.occupation).toBe('Sales Representative')
    })

    it('should have address in Ohio', () => {
      expect(taraBlackTaxpayer.address.state).toBe('OH')
      expect(taraBlackTaxpayer.address.city).toBe('Cincinnati')
    })
  })

  describe('Multiple W-2 Forms', () => {
    it('should have two W-2 forms', () => {
      expect(w2GreenLadies.employerName).toBe('The Green Ladies')
      expect(w2CR.employerName).toBe('C&R')
    })

    it('should calculate total wages correctly', () => {
      const total = w2GreenLadies.box1Wages + w2CR.box1Wages
      expect(w2Totals.totalWages).toBe(total)
      expect(w2Totals.totalWages).toBe(42470)
    })

    it('should calculate total federal withholding correctly', () => {
      const total = w2GreenLadies.box2FederalWithholding + w2CR.box2FederalWithholding
      expect(w2Totals.federalWithholding).toBe(total)
      expect(w2Totals.federalWithholding).toBe(2713)
    })

    it('should calculate total SS tax correctly', () => {
      const total = w2GreenLadies.box4SsTax + w2CR.box4SsTax
      expect(w2Totals.ssTax).toBe(total)
    })

    it('should calculate total Medicare tax correctly', () => {
      const total = w2GreenLadies.box6MedicareTax + w2CR.box6MedicareTax
      expect(w2Totals.medicareTax).toBe(total)
    })
  })

  describe('Schedule H (Household Employment Taxes)', () => {
    it('should have cash wages above threshold', () => {
      const threshold2025 = 2700
      expect(scheduleH.cashWagesPaid).toBeGreaterThanOrEqual(threshold2025)
      expect(scheduleH.cashWagesPaid).toBe(3100)
    })

    it('should calculate Social Security tax correctly', () => {
      const expected = scheduleH.cashWagesSubjectToSs * scheduleH.ssTaxRate
      expect(scheduleH.socialSecurityTax).toBeCloseTo(expected, 2)
    })

    it('should calculate Medicare tax correctly', () => {
      const expected = scheduleH.cashWagesSubjectToMedicare * scheduleH.medicareTaxRate
      expect(scheduleH.medicareTax).toBeCloseTo(expected, 2)
    })

    it('should calculate total household taxes correctly', () => {
      const expected = scheduleH.socialSecurityTax + scheduleH.medicareTax
      expect(scheduleH.line7SsMedicareTax).toBeCloseTo(expected, 2)
    })

    it('should not require FUTA', () => {
      expect(scheduleH.futaRequired).toBe(false)
      expect(scheduleH.futaTax).toBe(0)
    })
  })

  describe('Form 5695 (Residential Energy Credits)', () => {
    it('should cap exterior doors credit at $500', () => {
      expect(form5695.exteriorDoors.totalCost).toBe(2740)
      expect(form5695.exteriorDoors.calculatedCredit).toBe(822)
      expect(form5695.exteriorDoors.creditCap).toBe(500)
      expect(form5695.exteriorDoors.allowedCredit).toBe(500)
    })

    it('should calculate windows credit below cap', () => {
      expect(form5695.windows.totalCost).toBe(600)
      expect(form5695.windows.calculatedCredit).toBe(180)
      expect(form5695.windows.allowedCredit).toBe(180)
    })

    it('should cap central AC credit at $600', () => {
      expect(form5695.centralAc.totalCost).toBe(2500)
      expect(form5695.centralAc.calculatedCredit).toBe(750)
      expect(form5695.centralAc.creditCap).toBe(600)
      expect(form5695.centralAc.allowedCredit).toBe(600)
    })

    it('should calculate total before annual limit', () => {
      const total =
        form5695.exteriorDoors.allowedCredit +
        form5695.windows.allowedCredit +
        form5695.centralAc.allowedCredit
      expect(form5695.line29Total).toBe(total)
      expect(form5695.line29Total).toBe(1280)
    })

    it('should apply annual limit of $1,200', () => {
      expect(form5695.annualLimit).toBe(1200)
      expect(form5695.line32Credit).toBe(
        Math.min(form5695.line29Total, form5695.annualLimit - form5695.priorYearCreditUsed)
      )
    })
  })

  describe('Tax Calculation', () => {
    it('should have filing status Single', () => {
      expect(form1040Data.filingStatus).toBe(FilingStatus.S)
    })

    it('should calculate AGI correctly', () => {
      expect(form1040Data.agi).toBe(form1040Data.totalIncome)
      expect(form1040Data.agi).toBe(42470)
    })

    it('should use standard deduction for 2025 Single', () => {
      expect(form1040Data.deduction).toBe(15000)
    })

    it('should calculate taxable income correctly', () => {
      const expected = form1040Data.agi - form1040Data.deduction
      expect(form1040Data.taxableIncome).toBe(expected)
      expect(form1040Data.taxableIncome).toBe(27470)
    })

    it('should include Schedule 2 taxes', () => {
      expect(form1040Data.line17Schedule2).toBe(474)
    })

    it('should include Schedule 3 credits', () => {
      expect(form1040Data.line20Schedule3).toBe(1200)
    })
  })

  describe('Integration', () => {
    it('should have all required Form 1040 fields', () => {
      const requiredFields = [
        'primarySsn',
        'primaryFirstName',
        'primaryLastName',
        'filingStatus',
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

    it('should have consistent line math (AGI = Total Income - Adjustments)', () => {
      expect(form1040Data.agi).toBe(form1040Data.totalIncome - form1040Data.line10Adjustments)
    })

    it('should have consistent line math (Taxable = AGI - Deductions)', () => {
      expect(form1040Data.taxableIncome).toBe(form1040Data.agi - form1040Data.deduction)
    })

    it('should flow W-2 wages to Form 1040 correctly', () => {
      expect(form1040Data.line1zWages).toBe(w2Totals.totalWages)
    })

    it('should flow W-2 withholding to Form 1040 correctly', () => {
      expect(form1040Data.line25aW2Withholding).toBe(w2Totals.federalWithholding)
    })

    it('should calculate refund or amount owed correctly', () => {
      if (form1040Data.totalPayments > form1040Data.totalTax) {
        expect(form1040Data.refund).toBe(form1040Data.totalPayments - form1040Data.totalTax)
        expect(form1040Data.amountOwed).toBe(0)
      } else {
        expect(form1040Data.refund).toBe(0)
        expect(form1040Data.amountOwed).toBe(form1040Data.totalTax - form1040Data.totalPayments)
      }
    })
  })
})
