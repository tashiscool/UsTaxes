/**
 * IRS ATS Test Scenario 6 - Juan Torres
 *
 * Test Scenario Reference: IRS ATS Test Scenario 6 (ty25-1040-mef-ats-scenario-6-10212025.pdf)
 * Primary Taxpayer: Juan Torres
 * Filing Status: Single (implicit for 1040-SS)
 * Location: Puerto Rico
 *
 * Key Features Tested:
 * - Form 1040-SS (U.S. Self-Employment Tax Return for Puerto Rico)
 * - Schedule C (Profit or Loss from Business)
 * - Schedule SE (Self-Employment Tax)
 * - Bona fide Puerto Rico resident taxation
 * - Self-employment income and deductions
 *
 * Tax Year: 2025
 */

// =============================================================================
// Test Data Fixtures - Juan Torres (Scenario 6)
// =============================================================================

/**
 * Primary taxpayer information - Juan Torres (Puerto Rico resident)
 */
const juanTorresTaxpayer = {
  firstName: 'Juan',
  lastName: 'Torres',
  ssn: '400011041',
  ssnAtsReference: '400-00-1041',
  address: {
    address: 'Calle Sol 123',
    city: 'San Juan',
    state: 'PR' as const,
    zip: '00901'
  },
  dateOfBirth: new Date(1975, 10, 3), // November 3, 1975
  occupation: 'Consultant',
  isBonafidePrResident: true,
  digitalAssets: false
}

/**
 * Schedule C (Profit or Loss from Business)
 * Principal Business Code: 541611 (Management Consulting)
 */
const scheduleC = {
  businessName: 'Torres Consulting',
  principalBusinessCode: '541611',
  principalBusinessDescription: 'Management Consulting',
  businessAddress: juanTorresTaxpayer.address,
  accountingMethod: 'Cash' as const,
  ein: undefined, // Uses SSN

  // Part I - Income
  line1GrossReceipts: 85000,
  line2ReturnsAllowances: 0,
  line3NetReceipts: 85000,
  line4CostOfGoodsSold: 0,
  line5GrossProfit: 85000,
  line6OtherIncome: 0,
  line7GrossIncome: 85000,

  // Part II - Expenses
  expenses: {
    line8Advertising: 1200,
    line9CarTruck: 3500,
    line10Commissions: 0,
    line11ContractLabor: 5000,
    line12Depletion: 0,
    line13Depreciation: 2400,
    line14EmployeeBenefits: 0,
    line15Insurance: 1800,
    line16aMortgageInterest: 0,
    line16bOtherInterest: 0,
    line17LegalProfessional: 1500,
    line18OfficeExpense: 2200,
    line19PensionProfitSharing: 0,
    line20aRentVehicles: 0,
    line20bRentOther: 6000, // Office rent
    line21Repairs: 800,
    line22Supplies: 1500,
    line23TaxesLicenses: 950,
    line24aTravel: 3200,
    line24bMeals: 600, // 50% deductible
    line25Utilities: 1200,
    line26Wages: 0,
    line27aOther: 2500 // Professional development
  },

  // Line 28 - Total expenses
  line28TotalExpenses: 34350,

  // Line 29 - Tentative profit (loss)
  line29TentativeProfit: 50650, // 85000 - 34350

  // Line 30 - Expenses for business use of home (N/A)
  line30HomeOffice: 0,

  // Line 31 - Net profit (loss)
  line31NetProfit: 50650,

  allInvestmentAtRisk: true
}

/**
 * Schedule SE (Self-Employment Tax)
 */
const scheduleSE = {
  // Line 1a - Net farm profit (N/A)
  line1aFarmProfit: 0,

  // Line 1b - Net profit from Schedule C
  line1bScheduleCProfit: 50650,

  // Line 2 - Combined net profit
  line2CombinedProfit: 50650,

  // Line 3 - Multiply line 2 by 92.35%
  line3NetEarningsRate: 0.9235,
  line3NetEarnings: 46775.28, // 50650 * 0.9235

  // Line 4 - Maximum for Social Security (2025: $176,100)
  line4SsWageBase2025: 176100,

  // Line 5 - Wages subject to SS (N/A - no W-2)
  line5SsWages: 0,

  // Line 6 - Line 4 minus Line 5
  line6SsAvailable: 176100,

  // Line 7 - Smaller of Line 3 or Line 6
  line7SsSubject: 46775.28,

  // Line 8 - SS portion of SE tax (12.4%)
  line8SsTaxRate: 0.124,
  line8SsTax: 5800.13, // 46775.28 * 0.124

  // Line 9 - Medicare portion (2.9% on all net earnings)
  line9MedicareRate: 0.029,
  line9MedicareTax: 1356.48, // 46775.28 * 0.029

  // Line 10 - Additional Medicare Tax (0.9% over $200,000)
  line10AdditionalMedicareThreshold: 200000,
  line10AdditionalMedicareTax: 0, // Below threshold

  // Line 11 - Total self-employment tax
  line11TotalSeTax: 7156.61, // 5800.13 + 1356.48

  // Line 12 - Deductible part of SE tax (50%)
  line12DeductibleSeTax: 3578.31, // 7156.61 / 2

  flowsToForm1040ssLine3: true
}

/**
 * Form 1040-SS (U.S. Self-Employment Tax Return)
 */
const form1040SS = {
  // Part I - Total Tax and Credits
  line1NetEarnings: 46775.28, // From Schedule SE

  // Line 2 - Self-employment tax
  line2SeTax: 7156.61, // From Schedule SE, Line 11

  // Line 3 - Household employment taxes (N/A)
  line3HouseholdTax: 0,

  // Line 4 - Total tax
  line4TotalTax: 7156.61,

  // Line 5 - Estimated tax payments
  line5EstimatedPayments: 6000,

  // Line 6 - Excess Social Security tax withheld (N/A)
  line6ExcessSsWithheld: 0,

  // Line 7 - Additional child tax credit (N/A)
  line7Actc: 0,

  // Line 8 - Total payments and credits
  line8TotalPayments: 6000,

  // Line 9 - Tax owed (Line 4 - Line 8)
  line9TaxOwed: 1156.61,

  // Line 10 - Refund (if overpaid)
  line10Refund: 0,

  // Part II - Bona Fide Resident of Puerto Rico
  bonafideResident: true,
  puertoRicoAddress: true,

  // Part III - Profit or Loss from Farming (N/A)
  hasFarmIncome: false,

  // Part IV - Profit or Loss from Business
  hasBusinessIncome: true,
  scheduleCAttached: true,

  // Part V - Self-Employment Tax
  scheduleSeMethod: 'Regular' as const
}

/**
 * Complete Form 1040-SS data for Juan Torres
 */
const form1040SSData = {
  // Taxpayer info
  primarySsn: juanTorresTaxpayer.ssn,
  primaryFirstName: juanTorresTaxpayer.firstName,
  primaryLastName: juanTorresTaxpayer.lastName,
  address: juanTorresTaxpayer.address,
  formType: '1040-SS',
  isBonafidePrResident: true,

  // Digital assets
  digitalAssets: false,

  // Business income from Schedule C
  scheduleCProfit: scheduleC.line31NetProfit,

  // Self-employment tax from Schedule SE
  netEarningsSe: scheduleSE.line3NetEarnings,
  seTax: scheduleSE.line11TotalSeTax,
  deductibleSeTax: scheduleSE.line12DeductibleSeTax,

  // Form 1040-SS totals
  totalTax: form1040SS.line4TotalTax,
  totalPayments: form1040SS.line8TotalPayments,
  taxOwed: form1040SS.line9TaxOwed,
  refund: form1040SS.line10Refund
}

// =============================================================================
// Tests
// =============================================================================

describe('ATS Scenario 6 - Juan Torres (Form 1040-SS Puerto Rico)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct taxpayer name', () => {
      expect(juanTorresTaxpayer.firstName).toBe('Juan')
      expect(juanTorresTaxpayer.lastName).toBe('Torres')
    })

    it('should be in Puerto Rico', () => {
      expect(juanTorresTaxpayer.address.state).toBe('PR')
    })

    it('should be a bona fide Puerto Rico resident', () => {
      expect(juanTorresTaxpayer.isBonafidePrResident).toBe(true)
    })

    it('should have occupation as Consultant', () => {
      expect(juanTorresTaxpayer.occupation).toBe('Consultant')
    })

    it('should have valid SSN format', () => {
      expect(juanTorresTaxpayer.ssn).toHaveLength(9)
      expect(/^\d{9}$/.test(juanTorresTaxpayer.ssn)).toBe(true)
    })
  })

  describe('Schedule C (Business Income)', () => {
    it('should have correct gross receipts', () => {
      expect(scheduleC.line1GrossReceipts).toBe(85000)
    })

    it('should have correct principal business code for consulting', () => {
      expect(scheduleC.principalBusinessCode).toBe('541611')
      expect(scheduleC.principalBusinessDescription).toContain('Consulting')
    })

    it('should have cash accounting method', () => {
      expect(scheduleC.accountingMethod).toBe('Cash')
    })

    it('should calculate total expenses correctly', () => {
      const expected = Object.values(scheduleC.expenses).reduce(
        (sum, val) => sum + val,
        0
      )
      expect(scheduleC.line28TotalExpenses).toBe(expected)
    })

    it('should calculate net profit correctly', () => {
      const expected =
        scheduleC.line7GrossIncome - scheduleC.line28TotalExpenses
      expect(scheduleC.line31NetProfit).toBe(expected)
    })

    it('should have major expense categories', () => {
      expect(scheduleC.expenses.line20bRentOther).toBe(6000) // Office rent
      expect(scheduleC.expenses.line11ContractLabor).toBe(5000)
      expect(scheduleC.expenses.line9CarTruck).toBe(3500)
    })
  })

  describe('Schedule SE (Self-Employment Tax)', () => {
    it('should flow Schedule C profit correctly', () => {
      expect(scheduleSE.line1bScheduleCProfit).toBe(scheduleC.line31NetProfit)
    })

    it('should calculate net earnings at 92.35%', () => {
      const expected = scheduleSE.line2CombinedProfit * scheduleSE.line3NetEarningsRate
      expect(scheduleSE.line3NetEarnings).toBeCloseTo(expected, 2)
    })

    it('should calculate SS tax correctly (12.4%)', () => {
      const expected = scheduleSE.line7SsSubject * scheduleSE.line8SsTaxRate
      expect(scheduleSE.line8SsTax).toBeCloseTo(expected, 2)
    })

    it('should calculate Medicare tax correctly (2.9%)', () => {
      const expected = scheduleSE.line3NetEarnings * scheduleSE.line9MedicareRate
      expect(scheduleSE.line9MedicareTax).toBeCloseTo(expected, 2)
    })

    it('should have no additional Medicare tax (below threshold)', () => {
      expect(scheduleSE.line3NetEarnings).toBeLessThan(
        scheduleSE.line10AdditionalMedicareThreshold
      )
      expect(scheduleSE.line10AdditionalMedicareTax).toBe(0)
    })

    it('should calculate total SE tax correctly', () => {
      const expected = scheduleSE.line8SsTax + scheduleSE.line9MedicareTax
      expect(scheduleSE.line11TotalSeTax).toBeCloseTo(expected, 2)
    })

    it('should calculate deductible SE tax as 50%', () => {
      const expected = scheduleSE.line11TotalSeTax / 2
      expect(scheduleSE.line12DeductibleSeTax).toBeCloseTo(expected, 2)
    })
  })

  describe('Form 1040-SS', () => {
    it('should have correct form type', () => {
      expect(form1040SSData.formType).toBe('1040-SS')
    })

    it('should have bona fide PR resident status', () => {
      expect(form1040SSData.isBonafidePrResident).toBe(true)
      expect(form1040SS.bonafideResident).toBe(true)
    })

    it('should have total tax equal to SE tax (no household employment)', () => {
      const expected = form1040SS.line2SeTax + form1040SS.line3HouseholdTax
      expect(form1040SS.line4TotalTax).toBe(expected)
    })

    it('should calculate tax owed correctly', () => {
      const expected = form1040SS.line4TotalTax - form1040SS.line8TotalPayments
      expect(form1040SS.line9TaxOwed).toBeCloseTo(expected, 2)
    })

    it('should have estimated tax payments', () => {
      expect(form1040SS.line5EstimatedPayments).toBe(6000)
    })
  })

  describe('Self-Employment Tax Rates', () => {
    it('should have correct SS rate (12.4%)', () => {
      expect(scheduleSE.line8SsTaxRate).toBe(0.124)
    })

    it('should have correct Medicare rate (2.9%)', () => {
      expect(scheduleSE.line9MedicareRate).toBe(0.029)
    })

    it('should have correct net earnings rate (92.35%)', () => {
      expect(scheduleSE.line3NetEarningsRate).toBe(0.9235)
    })

    it('should have correct 2025 SS wage base', () => {
      expect(scheduleSE.line4SsWageBase2025).toBe(176100)
    })
  })

  describe('Integration', () => {
    it('should have all required Form 1040-SS fields', () => {
      const requiredFields = [
        'primarySsn',
        'primaryFirstName',
        'primaryLastName',
        'formType',
        'isBonafidePrResident',
        'scheduleCProfit',
        'seTax',
        'totalTax'
      ]

      for (const field of requiredFields) {
        expect(form1040SSData).toHaveProperty(field)
      }
    })

    it('should flow Schedule C to Schedule SE correctly', () => {
      expect(scheduleSE.line1bScheduleCProfit).toBe(scheduleC.line31NetProfit)
    })

    it('should flow Schedule SE tax to Form 1040-SS correctly', () => {
      expect(form1040SS.line2SeTax).toBe(scheduleSE.line11TotalSeTax)
    })

    it('should have PR resident file Form 1040-SS', () => {
      expect(form1040SSData.address.state).toBe('PR')
      expect(form1040SSData.formType).toBe('1040-SS')
    })

    it('should require Schedule SE for SE tax', () => {
      if (form1040SSData.seTax > 0) {
        expect(scheduleSE.line3NetEarnings).toBeGreaterThan(400)
      }
    })

    it('should require Schedule C for business income', () => {
      if (form1040SSData.scheduleCProfit > 0) {
        expect(form1040SS.hasBusinessIncome).toBe(true)
        expect(form1040SS.scheduleCAttached).toBe(true)
      }
    })

    it('should calculate overall tax liability correctly', () => {
      if (form1040SSData.totalTax > form1040SSData.totalPayments) {
        expect(form1040SSData.taxOwed).toBeCloseTo(
          form1040SSData.totalTax - form1040SSData.totalPayments,
          2
        )
        expect(form1040SSData.refund).toBe(0)
      } else {
        expect(form1040SSData.refund).toBeCloseTo(
          form1040SSData.totalPayments - form1040SSData.totalTax,
          2
        )
        expect(form1040SSData.taxOwed).toBe(0)
      }
    })
  })
})
