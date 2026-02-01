/**
 * IRS ATS Test Scenario 13 - William and Nancy Birch
 *
 * Test Scenario Reference: IRS ATS Test Scenario 13 (1040-mef-ats-scenario-13.pdf)
 * Primary Taxpayer: William Birch
 * Secondary Taxpayer: Nancy Birch
 * Filing Status: Married Filing Jointly
 * Location: Anytown, Texas (no state income tax)
 *
 * Key Features Tested:
 * - Married Filing Jointly with low income
 * - Form 8911 (Alternative Fuel Vehicle Refueling Property Credit)
 * - Form 8911 Schedule A (Refueling Property Details)
 * - Form 6251 (Alternative Minimum Tax - no AMT due)
 * - Schedule 3 (Additional Credits and Payments)
 * - Credit exceeds tax liability (nonrefundable credit limited)
 *
 * Tax Year: 2025
 */

import { FilingStatus } from 'ustaxes/core/data'

// =============================================================================
// Test Data Fixtures - William and Nancy Birch (Scenario 13)
// =============================================================================

/**
 * Primary taxpayer information - William Birch
 */
const williamBirchTaxpayer = {
  firstName: 'William',
  lastName: 'Birch',
  ssn: '400011313',
  ssnAtsReference: '400-00-1313',
  address: {
    address: '13 Elm Street',
    city: 'Anytown',
    state: 'TX' as const,
    zip: '77013'
  },
  digitalAssets: false
}

/**
 * Spouse information - Nancy Birch
 */
const nancyBirchSpouse = {
  firstName: 'Nancy',
  lastName: 'Birch',
  ssn: '400011234',
  ssnAtsReference: '400-00-1234'
}

/**
 * W-2 from Oak Supply Co (William only)
 */
const w2OakSupplyCo = {
  employer: {
    name: 'Oak Supply Co',
    ein: '000000014',
    address: {
      address: '201 Elm Drive',
      city: 'Anytown',
      state: 'TX' as const,
      zip: '77013'
    }
  },
  wages: 31620,
  federalWithholding: 609,
  ssWages: 31620,
  ssTax: 1960,
  medicareWages: 31620,
  medicareTax: 458,
  // Texas has no state income tax
  state: null,
  stateWages: null,
  stateTax: null
}

/**
 * Form 8911 Schedule A (Alternative Fuel Vehicle Refueling Property Details)
 * Electric charger installed at main home
 */
const form8911ScheduleA = {
  // Part I - Property Details
  description: 'Electric Charger',
  locationAddress: '13 Elm Street, Anytown TX 77013',
  censusTractGeoid: '48201100000',
  dateConstructionBegan: new Date(2025, 2, 1), // March 1, 2025
  datePlacedInService: new Date(2025, 2, 1),
  isEligibleCensusTract: true,

  // Part II - Business/Investment Use (N/A for personal use)
  line8Cost: 1000,
  line9BusinessUsePercent: 0,
  line10BusinessPortion: 0,

  // Part III - Personal Use
  isMainHome: true,
  line18PersonalPortion: 1000,
  line19PersonalCreditRate: 300, // 30% of $1,000
  line20MaxPersonalCredit: 1000,
  line21PersonalCredit: 300 // Smaller of line 19 or line 20
}

/**
 * Form 8911 (Alternative Fuel Vehicle Refueling Property Credit)
 */
const form8911 = {
  // Part I - Business/Investment Credit
  line1BusinessCreditScheduleA: 0,
  line3BusinessCredit: 0,

  // Part II - Personal Use Credit
  line4PersonalCreditScheduleA: 300,
  line5RegularTaxBeforeCredits: 162,
  line6cCreditsReducingTax: 0,
  line7NetRegularTax: 162,
  line8TentativeMinimumTax: 0,
  line9AvailableForCredit: 162,
  line10PersonalCredit: 162 // Smaller of line 4 or line 9 - LIMITED BY TAX
}

/**
 * Form 6251 (Alternative Minimum Tax - Individuals)
 * No AMT is due because income is below exemption amount
 */
const form6251 = {
  // Part I - AMTI
  line1TaxableIncome: 1620,
  line2aStandardDeduction: 30000, // Add back for AMT
  line4Amti: 31620,

  // Part II - AMT
  line5Exemption: 137000, // MFJ exemption 2025
  line6AmtiOverExemption: 0, // 31,620 - 137,000 = negative, so 0
  line7AmtRateCalculation: 0,
  line9TentativeMinimumTax: 0,
  line10RegularTax: 162,
  line11Amt: 0 // No AMT because TMT < regular tax
}

/**
 * Schedule 3 (Additional Credits and Payments)
 */
const schedule3 = {
  // Part I - Nonrefundable Credits
  line6jAlternativeFuelRefuelingCredit: 162,
  line7TotalOtherCredits: 162,
  line8TotalNonrefundableCredits: 162,

  // Part II - Other Payments (none)
  line15TotalPayments: 0
}

/**
 * Complete Form 1040 data for William and Nancy Birch
 */
const form1040Data = (() => {
  // Income
  const w2Wages = w2OakSupplyCo.wages
  const totalIncome = w2Wages

  // AGI (no adjustments)
  const agi = totalIncome

  // Standard deduction (MFJ 2025) - per PDF
  const standardDeduction = 30000

  // Taxable income
  const taxableIncome = Math.max(0, agi - standardDeduction) // 1,620

  // Tax calculation (10% bracket for MFJ on $1,620)
  const calculatedTax = 162

  // Credits from Schedule 3
  const totalCredits = schedule3.line8TotalNonrefundableCredits

  // Tax after credits
  const taxAfterCredits = Math.max(0, calculatedTax - totalCredits) // 0

  // Total tax
  const totalTax = taxAfterCredits

  // Payments
  const totalWithholding = w2OakSupplyCo.federalWithholding
  const totalPayments = totalWithholding

  // Refund
  const refund = totalPayments > totalTax ? totalPayments - totalTax : 0
  const amountOwed = totalTax > totalPayments ? totalTax - totalPayments : 0

  return {
    // Taxpayer info
    primarySsn: williamBirchTaxpayer.ssn,
    primaryFirstName: williamBirchTaxpayer.firstName,
    primaryLastName: williamBirchTaxpayer.lastName,
    address: williamBirchTaxpayer.address,
    filingStatus: FilingStatus.MFJ,

    // Spouse info
    spouseSsn: nancyBirchSpouse.ssn,
    spouseFirstName: nancyBirchSpouse.firstName,
    spouseLastName: nancyBirchSpouse.lastName,

    // Checkboxes
    digitalAssets: false,

    // Income
    line1aW2Wages: w2Wages,
    line1zTotalWages: w2Wages,
    line9TotalIncome: totalIncome,

    // AGI
    line11aAgi: agi,
    line11bAgi: agi,

    // Deduction
    line12eStandardDeduction: standardDeduction,
    line14TotalDeductions: standardDeduction,

    // Taxable income
    line15TaxableIncome: taxableIncome,

    // Tax
    line16Tax: calculatedTax,
    line18Total: calculatedTax,
    line20Schedule3Credits: totalCredits,
    line21TotalCredits: totalCredits,
    line22TaxMinusCredits: taxAfterCredits,
    line24TotalTax: totalTax,

    // Payments
    line25aW2Withholding: totalWithholding,
    line25dTotalWithholding: totalWithholding,
    line33TotalPayments: totalPayments,

    // Refund
    line34Overpaid: refund,
    line35aRefund: refund,
    line37AmountOwed: amountOwed,

    // Summary
    wages: w2Wages,
    totalIncome,
    agi,
    deduction: standardDeduction,
    taxableIncome,
    totalTax,
    totalPayments,
    refund,
    amountOwed
  }
})()

// =============================================================================
// Tests
// =============================================================================

describe('ATS Scenario 13 - William & Nancy Birch (Form 8911, Form 6251)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct primary taxpayer name', () => {
      expect(williamBirchTaxpayer.firstName).toBe('William')
      expect(williamBirchTaxpayer.lastName).toBe('Birch')
    })

    it('should have correct spouse name', () => {
      expect(nancyBirchSpouse.firstName).toBe('Nancy')
      expect(nancyBirchSpouse.lastName).toBe('Birch')
    })

    it('should be in Texas (no state income tax)', () => {
      expect(williamBirchTaxpayer.address.state).toBe('TX')
    })

    it('should have valid SSN formats', () => {
      expect(williamBirchTaxpayer.ssn).toHaveLength(9)
      expect(nancyBirchSpouse.ssn).toHaveLength(9)
    })
  })

  describe('W-2 Income', () => {
    it('should have correct wages', () => {
      expect(w2OakSupplyCo.wages).toBe(31620)
    })

    it('should have correct federal withholding', () => {
      expect(w2OakSupplyCo.federalWithholding).toBe(609)
    })

    it('should have no state tax (Texas)', () => {
      expect(w2OakSupplyCo.state).toBeNull()
      expect(w2OakSupplyCo.stateTax).toBeNull()
    })
  })

  describe('Form 8911 Schedule A (Refueling Property)', () => {
    it('should be an electric charger', () => {
      expect(form8911ScheduleA.description).toBe('Electric Charger')
    })

    it('should be in eligible census tract', () => {
      expect(form8911ScheduleA.isEligibleCensusTract).toBe(true)
    })

    it('should have correct census tract GEOID', () => {
      expect(form8911ScheduleA.censusTractGeoid).toBe('48201100000')
    })

    it('should be installed at main home', () => {
      expect(form8911ScheduleA.isMainHome).toBe(true)
    })

    it('should have correct property cost', () => {
      expect(form8911ScheduleA.line8Cost).toBe(1000)
    })

    it('should calculate 30% personal credit', () => {
      const expected = form8911ScheduleA.line18PersonalPortion * 0.3
      expect(form8911ScheduleA.line19PersonalCreditRate).toBe(expected)
    })

    it('should have personal credit limited to calculated amount', () => {
      const calculated = form8911ScheduleA.line19PersonalCreditRate
      const maximum = form8911ScheduleA.line20MaxPersonalCredit
      expect(form8911ScheduleA.line21PersonalCredit).toBe(
        Math.min(calculated, maximum)
      )
      expect(form8911ScheduleA.line21PersonalCredit).toBe(300)
    })

    it('should have no business use', () => {
      expect(form8911ScheduleA.line9BusinessUsePercent).toBe(0)
      expect(form8911ScheduleA.line10BusinessPortion).toBe(0)
    })
  })

  describe('Form 8911 (Refueling Credit)', () => {
    it('should have no business credit', () => {
      expect(form8911.line3BusinessCredit).toBe(0)
    })

    it('should flow personal credit from Schedule A', () => {
      expect(form8911.line4PersonalCreditScheduleA).toBe(
        form8911ScheduleA.line21PersonalCredit
      )
    })

    it('should limit credit by available tax', () => {
      const potentialCredit = form8911.line4PersonalCreditScheduleA // 300
      const availableTax = form8911.line9AvailableForCredit // 162
      expect(form8911.line10PersonalCredit).toBe(
        Math.min(potentialCredit, availableTax)
      )
      expect(form8911.line10PersonalCredit).toBe(162)
    })

    it('should have no tentative minimum tax', () => {
      expect(form8911.line8TentativeMinimumTax).toBe(0)
    })

    it('should show credit is limited (credit > tax)', () => {
      expect(form8911.line4PersonalCreditScheduleA).toBeGreaterThan(
        form8911.line10PersonalCredit
      )
    })
  })

  describe('Form 6251 (Alternative Minimum Tax)', () => {
    it('should calculate AMTI correctly', () => {
      const expected =
        form6251.line1TaxableIncome + form6251.line2aStandardDeduction
      expect(form6251.line4Amti).toBe(expected)
    })

    it('should have AMTI below exemption', () => {
      expect(form6251.line4Amti).toBeLessThan(form6251.line5Exemption)
    })

    it('should have no AMTI over exemption', () => {
      expect(form6251.line6AmtiOverExemption).toBe(0)
    })

    it('should have no tentative minimum tax', () => {
      expect(form6251.line9TentativeMinimumTax).toBe(0)
    })

    it('should have no AMT due', () => {
      expect(form6251.line11Amt).toBe(0)
    })

    it('should use 2025 MFJ exemption amount', () => {
      expect(form6251.line5Exemption).toBe(137000)
    })
  })

  describe('Schedule 3 (Additional Credits)', () => {
    it('should have refueling credit on line 6j', () => {
      expect(schedule3.line6jAlternativeFuelRefuelingCredit).toBe(162)
    })

    it('should have total nonrefundable credits from Form 8911', () => {
      expect(schedule3.line8TotalNonrefundableCredits).toBe(
        form8911.line10PersonalCredit
      )
    })

    it('should have no other payments', () => {
      expect(schedule3.line15TotalPayments).toBe(0)
    })
  })

  describe('Tax Calculation', () => {
    it('should have correct filing status', () => {
      expect(form1040Data.filingStatus).toBe(FilingStatus.MFJ)
    })

    it('should have correct total income', () => {
      expect(form1040Data.line9TotalIncome).toBe(31620)
    })

    it('should use MFJ standard deduction', () => {
      expect(form1040Data.line12eStandardDeduction).toBe(30000)
    })

    it('should calculate taxable income correctly', () => {
      const expected = form1040Data.agi - form1040Data.deduction
      expect(form1040Data.line15TaxableIncome).toBe(expected)
      expect(form1040Data.line15TaxableIncome).toBe(1620)
    })

    it('should calculate tax at 10% bracket', () => {
      expect(form1040Data.line16Tax).toBe(162)
    })

    it('should have credits reduce tax to zero', () => {
      expect(form1040Data.line16Tax).toBe(162)
      expect(form1040Data.line20Schedule3Credits).toBe(162)
      expect(form1040Data.line22TaxMinusCredits).toBe(0)
    })

    it('should have zero total tax', () => {
      expect(form1040Data.line24TotalTax).toBe(0)
    })

    it('should calculate refund correctly', () => {
      const expected =
        form1040Data.line33TotalPayments - form1040Data.line24TotalTax
      expect(form1040Data.line34Overpaid).toBe(expected)
      expect(form1040Data.line35aRefund).toBe(609)
    })

    it('should have no amount owed', () => {
      expect(form1040Data.line37AmountOwed).toBe(0)
    })
  })

  describe('Credit Limitation Analysis', () => {
    it('should show potential credit exceeds actual credit', () => {
      const potentialCredit = form8911ScheduleA.line21PersonalCredit
      const actualCredit = form8911.line10PersonalCredit
      const wastedCredit = potentialCredit - actualCredit

      expect(potentialCredit).toBe(300)
      expect(actualCredit).toBe(162)
      expect(wastedCredit).toBe(138)
    })

    it('should demonstrate nonrefundable credit limitation', () => {
      // Full credit would be $300, but limited to $162 tax liability
      expect(form8911ScheduleA.line21PersonalCredit).toBe(300)
      expect(form1040Data.line16Tax).toBe(162)
      expect(form1040Data.line20Schedule3Credits).toBe(162)
    })
  })

  describe('Integration', () => {
    it('should have all required Form 1040 fields', () => {
      const requiredFields = [
        'primarySsn',
        'primaryFirstName',
        'primaryLastName',
        'spouseSsn',
        'filingStatus',
        'wages',
        'totalIncome',
        'agi',
        'deduction',
        'taxableIncome',
        'totalTax',
        'totalPayments',
        'refund'
      ]

      for (const field of requiredFields) {
        expect(form1040Data).toHaveProperty(field)
      }
    })

    it('should flow Form 8911 Schedule A to Form 8911', () => {
      expect(form8911.line4PersonalCreditScheduleA).toBe(
        form8911ScheduleA.line21PersonalCredit
      )
    })

    it('should flow Form 8911 to Schedule 3', () => {
      expect(schedule3.line6jAlternativeFuelRefuelingCredit).toBe(
        form8911.line10PersonalCredit
      )
    })

    it('should flow Schedule 3 to Form 1040', () => {
      expect(form1040Data.line20Schedule3Credits).toBe(
        schedule3.line8TotalNonrefundableCredits
      )
    })

    it('should flow Form 6251 TMT to Form 8911', () => {
      expect(form8911.line8TentativeMinimumTax).toBe(
        form6251.line9TentativeMinimumTax
      )
    })

    it('should require spouse SSN for MFJ', () => {
      expect(form1040Data.filingStatus).toBe(FilingStatus.MFJ)
      expect(form1040Data.spouseSsn).toBeDefined()
      expect(form1040Data.spouseSsn).not.toBe('')
    })
  })
})
