/**
 * IRS ATS Test Scenario 7 - Charlie Boone
 *
 * Test Scenario Reference: IRS ATS Test Scenario 7 (ty25-1040-mef-ats-scenario-7-10212025.pdf)
 * Primary Taxpayer: Charlie Boone
 * Filing Status: Single (extension only - no full return)
 * Location: Denver, Colorado
 *
 * Key Features Tested:
 * - Form 4868 (Application for Automatic Extension of Time)
 * - Extension-only filing (no Form 1040)
 * - Electronic funds withdrawal for balance due
 * - Estimated tax liability calculation
 *
 * Tax Year: 2025
 */

// =============================================================================
// Test Data Fixtures - Charlie Boone (Scenario 7)
// =============================================================================

/**
 * Primary taxpayer information - Charlie Boone
 */
const charlieBoonesTaxpayer = {
  firstName: 'Charlie',
  lastName: 'Boone',
  ssn: '400011042',
  ssnAtsReference: '400-00-1042',
  address: {
    address: '789 Mountain View Drive',
    city: 'Denver',
    state: 'CO' as const,
    zip: '80202'
  },
  dateOfBirth: new Date(1982, 6, 15), // July 15, 1982
  occupation: 'Software Engineer',
  daytimePhone: '3035551234'
}

/**
 * Form 4868 (Application for Automatic Extension of Time to File)
 *
 * This is an extension-only filing - no Form 1040 is filed at this time.
 * The taxpayer is requesting an automatic 6-month extension from
 * April 15, 2026 to October 15, 2026.
 */
const form4868 = {
  // Part I - Identification
  yourFirstName: charlieBoonesTaxpayer.firstName,
  yourLastName: charlieBoonesTaxpayer.lastName,
  yourSsn: charlieBoonesTaxpayer.ssn,
  spouseFirstName: undefined,
  spouseLastName: undefined,
  spouseSsn: undefined,
  address: charlieBoonesTaxpayer.address,

  // Part II - Individual Income Tax
  // Line 4 - Estimate of total tax liability for 2025
  line4EstimatedTotalTax: 12500,

  // Line 5 - Total 2025 payments
  line5TotalPayments: 10000,

  // Line 6 - Balance due (Line 4 - Line 5)
  line6BalanceDue: 2500,

  // Line 7 - Amount you're paying
  line7AmountPaying: 2500,

  // Filing out of country
  outOfCountry: false,

  // Extension dates
  originalDueDate: new Date(2026, 3, 15), // April 15, 2026
  extendedDueDate: new Date(2026, 9, 15), // October 15, 2026
  extensionMonths: 6
}

/**
 * Electronic Funds Withdrawal information
 * Used to pay the balance due with the extension request
 */
const electronicFundsWithdrawal = {
  routingTransitNumber: '123456789',
  bankAccountNumber: '9876543210',
  accountType: 'Checking' as const,
  withdrawalAmount: form4868.line7AmountPaying,
  requestedWithdrawalDate: new Date(2026, 3, 15), // April 15, 2026

  // Taxpayer authorization
  authorizedDebit: true,
  taxpayerSignature: true
}

/**
 * Breakdown of estimated tax liability
 * This is used to calculate Line 4 on Form 4868
 */
const estimatedTaxLiability = {
  // Income estimates
  estimatedWages: 95000,
  estimatedOtherIncome: 5000,
  estimatedAgi: 100000,

  // Deduction and tax calculation
  estimatedStandardDeduction: 15000, // 2025 single
  estimatedTaxableIncome: 85000,

  // Tax bracket calculation for Single filer 2025
  // 10% on $11,600 = $1,160
  // 12% on $35,550 ($47,150 - $11,600) = $4,266
  // 22% on $37,850 ($85,000 - $47,150) = $8,327
  estimatedIncomeTax: 13753,

  // Credits estimated
  estimatedCredits: 1253,

  // Net tax liability
  estimatedNetTax: 12500
}

/**
 * Breakdown of payments already made
 * This is used to calculate Line 5 on Form 4868
 */
const paymentsBreakdown = {
  // Withholding from W-2
  federalWithholding: 8500,

  // Estimated tax payments made
  estimatedPaymentQ1: 500,
  estimatedPaymentQ2: 500,
  estimatedPaymentQ3: 500,
  estimatedPaymentQ4: 0,

  // Total payments
  totalPayments: 10000
}

/**
 * Complete Form 4868 submission data
 */
const form4868Data = {
  // Taxpayer info
  primarySsn: charlieBoonesTaxpayer.ssn,
  primaryFirstName: charlieBoonesTaxpayer.firstName,
  primaryLastName: charlieBoonesTaxpayer.lastName,
  address: charlieBoonesTaxpayer.address,
  formType: '4868',

  // Extension request
  estimatedTotalTax: form4868.line4EstimatedTotalTax,
  totalPayments: form4868.line5TotalPayments,
  balanceDue: form4868.line6BalanceDue,
  amountPaying: form4868.line7AmountPaying,

  // Payment method
  paymentMethod: 'Electronic Funds Withdrawal' as const,
  efw: electronicFundsWithdrawal,

  // Filing timeline
  originalDueDate: form4868.originalDueDate,
  extendedDueDate: form4868.extendedDueDate
}

// =============================================================================
// Tests
// =============================================================================

describe('ATS Scenario 7 - Charlie Boone (Form 4868 Extension)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct taxpayer name', () => {
      expect(charlieBoonesTaxpayer.firstName).toBe('Charlie')
      expect(charlieBoonesTaxpayer.lastName).toBe('Boone')
    })

    it('should be in Colorado', () => {
      expect(charlieBoonesTaxpayer.address.state).toBe('CO')
      expect(charlieBoonesTaxpayer.address.city).toBe('Denver')
    })

    it('should have valid SSN format', () => {
      expect(charlieBoonesTaxpayer.ssn).toHaveLength(9)
      expect(/^\d{9}$/.test(charlieBoonesTaxpayer.ssn)).toBe(true)
    })

    it('should have daytime phone for extension', () => {
      expect(charlieBoonesTaxpayer.daytimePhone).toBeDefined()
    })
  })

  describe('Form 4868 (Extension Request)', () => {
    it('should be an extension-only filing', () => {
      expect(form4868Data.formType).toBe('4868')
    })

    it('should have correct estimated tax liability', () => {
      expect(form4868.line4EstimatedTotalTax).toBe(12500)
    })

    it('should have correct total payments', () => {
      expect(form4868.line5TotalPayments).toBe(10000)
    })

    it('should calculate balance due correctly', () => {
      const expected =
        form4868.line4EstimatedTotalTax - form4868.line5TotalPayments
      expect(form4868.line6BalanceDue).toBe(expected)
    })

    it('should pay full balance due', () => {
      expect(form4868.line7AmountPaying).toBe(form4868.line6BalanceDue)
    })

    it('should request 6-month extension', () => {
      expect(form4868.extensionMonths).toBe(6)
    })

    it('should extend from April 15 to October 15', () => {
      expect(form4868.originalDueDate.getMonth()).toBe(3) // April (0-indexed)
      expect(form4868.originalDueDate.getDate()).toBe(15)
      expect(form4868.extendedDueDate.getMonth()).toBe(9) // October (0-indexed)
      expect(form4868.extendedDueDate.getDate()).toBe(15)
    })

    it('should not be filing from out of country', () => {
      expect(form4868.outOfCountry).toBe(false)
    })
  })

  describe('Electronic Funds Withdrawal', () => {
    it('should have valid routing number format', () => {
      expect(electronicFundsWithdrawal.routingTransitNumber).toHaveLength(9)
      expect(
        /^\d{9}$/.test(electronicFundsWithdrawal.routingTransitNumber)
      ).toBe(true)
    })

    it('should use checking account', () => {
      expect(electronicFundsWithdrawal.accountType).toBe('Checking')
    })

    it('should withdraw correct amount', () => {
      expect(electronicFundsWithdrawal.withdrawalAmount).toBe(
        form4868.line7AmountPaying
      )
      expect(electronicFundsWithdrawal.withdrawalAmount).toBe(2500)
    })

    it('should have taxpayer authorization', () => {
      expect(electronicFundsWithdrawal.authorizedDebit).toBe(true)
      expect(electronicFundsWithdrawal.taxpayerSignature).toBe(true)
    })

    it('should withdraw on original due date', () => {
      expect(electronicFundsWithdrawal.requestedWithdrawalDate).toEqual(
        form4868.originalDueDate
      )
    })
  })

  describe('Estimated Tax Calculation', () => {
    it('should have reasonable income estimate', () => {
      expect(estimatedTaxLiability.estimatedWages).toBe(95000)
      expect(estimatedTaxLiability.estimatedAgi).toBe(100000)
    })

    it('should use 2025 standard deduction for single', () => {
      expect(estimatedTaxLiability.estimatedStandardDeduction).toBe(15000)
    })

    it('should calculate taxable income correctly', () => {
      const expected =
        estimatedTaxLiability.estimatedAgi -
        estimatedTaxLiability.estimatedStandardDeduction
      expect(estimatedTaxLiability.estimatedTaxableIncome).toBe(expected)
    })

    it('should arrive at net tax liability matching Form 4868', () => {
      expect(estimatedTaxLiability.estimatedNetTax).toBe(
        form4868.line4EstimatedTotalTax
      )
    })
  })

  describe('Payments Breakdown', () => {
    it('should have federal withholding', () => {
      expect(paymentsBreakdown.federalWithholding).toBe(8500)
    })

    it('should have estimated tax payments', () => {
      const quarterlyPayments =
        paymentsBreakdown.estimatedPaymentQ1 +
        paymentsBreakdown.estimatedPaymentQ2 +
        paymentsBreakdown.estimatedPaymentQ3 +
        paymentsBreakdown.estimatedPaymentQ4
      expect(quarterlyPayments).toBe(1500)
    })

    it('should calculate total payments correctly', () => {
      const expected =
        paymentsBreakdown.federalWithholding +
        paymentsBreakdown.estimatedPaymentQ1 +
        paymentsBreakdown.estimatedPaymentQ2 +
        paymentsBreakdown.estimatedPaymentQ3 +
        paymentsBreakdown.estimatedPaymentQ4
      expect(paymentsBreakdown.totalPayments).toBe(expected)
    })

    it('should match Form 4868 Line 5', () => {
      expect(paymentsBreakdown.totalPayments).toBe(form4868.line5TotalPayments)
    })
  })

  describe('Integration', () => {
    it('should have all required Form 4868 fields', () => {
      const requiredFields = [
        'primarySsn',
        'primaryFirstName',
        'primaryLastName',
        'formType',
        'estimatedTotalTax',
        'totalPayments',
        'balanceDue',
        'amountPaying'
      ]

      for (const field of requiredFields) {
        expect(form4868Data).toHaveProperty(field)
      }
    })

    it('should have electronic funds withdrawal setup', () => {
      expect(form4868Data.paymentMethod).toBe('Electronic Funds Withdrawal')
      expect(form4868Data.efw).toBeDefined()
    })

    it('should have both due dates set', () => {
      expect(form4868Data.originalDueDate).toBeDefined()
      expect(form4868Data.extendedDueDate).toBeDefined()
    })

    it('should not have a spouse (single filing)', () => {
      expect(form4868.spouseFirstName).toBeUndefined()
      expect(form4868.spouseLastName).toBeUndefined()
      expect(form4868.spouseSsn).toBeUndefined()
    })

    it('should calculate extension period correctly', () => {
      const originalMonth = form4868.originalDueDate.getMonth()
      const extendedMonth = form4868.extendedDueDate.getMonth()
      const monthsDifference = extendedMonth - originalMonth
      expect(monthsDifference).toBe(6)
    })
  })

  describe('Form 4868 Validation Rules', () => {
    it('should have non-negative balance due', () => {
      expect(form4868.line6BalanceDue).toBeGreaterThanOrEqual(0)
    })

    it('should not pay more than balance due', () => {
      expect(form4868.line7AmountPaying).toBeLessThanOrEqual(
        form4868.line6BalanceDue
      )
    })

    it('should have valid year for extension', () => {
      expect(form4868.originalDueDate.getFullYear()).toBe(2026)
      expect(form4868.extendedDueDate.getFullYear()).toBe(2026)
    })

    it('should have same day of month for both dates', () => {
      expect(form4868.originalDueDate.getDate()).toBe(
        form4868.extendedDueDate.getDate()
      )
    })
  })
})

export {}
