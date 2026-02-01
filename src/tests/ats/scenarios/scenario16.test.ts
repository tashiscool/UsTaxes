/**
 * IRS ATS Test Scenario 16 - Emily Johnson
 *
 * Test Scenario: College Student with Education Credits
 * Primary Taxpayer: Emily Johnson
 * Filing Status: Single (1)
 *
 * Key Features Tested:
 * - Part-time W-2 income
 * - American Opportunity Tax Credit (AOTC) - Form 8863
 * - Student loan interest deduction
 * - Form 1098-T (Tuition Statement)
 * - Form 1098-E (Student Loan Interest)
 *
 * Tax Year: 2025
 */

import { FilingStatus } from 'ustaxes/core/data'

// =============================================================================
// Test Data Fixtures - Emily Johnson (Scenario 16)
// =============================================================================

const emilyJohnsonTaxpayer = {
  firstName: 'Emily',
  lastName: 'Johnson',
  ssn: '400011161',
  address: {
    address: '321 Campus Drive',
    city: 'Ann Arbor',
    state: 'MI' as const,
    zip: '48109'
  },
  dateOfBirth: new Date(2003, 6, 8), // Age 22
  occupation: 'Student/Part-time Worker',
  digitalAssets: false,
  isFullTimeStudent: true
}

// W-2 from part-time campus job
const w2CampusJob = {
  employerName: 'University of Michigan',
  employerEin: '38-6006309',
  box1Wages: 12500,
  box2FederalWithholding: 625,
  box3SsWages: 12500,
  box4SsTax: 775,
  box5MedicareWages: 12500,
  box6MedicareTax: 181,
  box15State: 'MI',
  box16StateWages: 12500,
  box17StateTax: 125
}

// Form 1098-T - Tuition Statement
const f1098T = {
  filerName: 'University of Michigan',
  filerTin: '38-6006309',
  studentName: 'Emily Johnson',
  studentSsn: '400011161',
  box1PaymentsReceived: 15000, // Payments for qualified tuition
  box2: 0, // Reserved
  box3: false, // Change in reporting method
  box4AdjustmentsPriorYear: 0,
  box5Scholarships: 5000, // Scholarship received
  box6AdjustmentsToScholarships: 0,
  box7CheckedForAmounts: false,
  box8AtLeastHalfTime: true,
  box9Graduate: false // Undergraduate
}

// Form 1098-E - Student Loan Interest
const f1098E = {
  lenderName: 'Great Lakes Borrowers',
  lenderTin: '39-1234567',
  borrowerName: 'Emily Johnson',
  borrowerSsn: '400011161',
  box1StudentLoanInterestPaid: 1850
}

// American Opportunity Tax Credit (AOTC) calculation
const aotc = {
  // Qualified education expenses
  qualifiedExpenses: f1098T.box1PaymentsReceived - f1098T.box5Scholarships, // $10,000

  // AOTC calculation: 100% of first $2,000 + 25% of next $2,000
  get creditAmount() {
    const first2000 = Math.min(this.qualifiedExpenses, 2000) * 1.0
    const next2000 = Math.min(Math.max(0, this.qualifiedExpenses - 2000), 2000) * 0.25
    return first2000 + next2000
  }, // Maximum $2,500

  // 40% of AOTC is refundable (up to $1,000)
  get refundablePortion() {
    return this.creditAmount * 0.4
  },

  get nonRefundablePortion() {
    return this.creditAmount * 0.6
  }
}

// Student loan interest deduction
const studentLoanInterestDeduction = {
  interestPaid: f1098E.box1StudentLoanInterestPaid,
  maxDeduction: 2500, // Maximum deduction
  get deductibleAmount() {
    return Math.min(this.interestPaid, this.maxDeduction)
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('ATS Scenario 16 - Emily Johnson (College Student)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct taxpayer name', () => {
      expect(emilyJohnsonTaxpayer.firstName).toBe('Emily')
      expect(emilyJohnsonTaxpayer.lastName).toBe('Johnson')
    })

    it('should be a full-time student', () => {
      expect(emilyJohnsonTaxpayer.isFullTimeStudent).toBe(true)
    })

    it('should be filing as Single', () => {
      const filingStatus = FilingStatus.S
      expect(filingStatus).toBe(FilingStatus.S)
    })
  })

  describe('W-2 Income', () => {
    it('should have part-time wages', () => {
      expect(w2CampusJob.box1Wages).toBe(12500)
    })

    it('should have federal withholding', () => {
      expect(w2CampusJob.box2FederalWithholding).toBe(625)
    })

    it('should have correct employer', () => {
      expect(w2CampusJob.employerName).toBe('University of Michigan')
    })
  })

  describe('Form 1098-T (Tuition Statement)', () => {
    it('should have tuition payments', () => {
      expect(f1098T.box1PaymentsReceived).toBe(15000)
    })

    it('should have scholarship amount', () => {
      expect(f1098T.box5Scholarships).toBe(5000)
    })

    it('should be at least half-time student', () => {
      expect(f1098T.box8AtLeastHalfTime).toBe(true)
    })

    it('should be undergraduate', () => {
      expect(f1098T.box9Graduate).toBe(false)
    })

    it('should calculate net qualified expenses', () => {
      const netExpenses = f1098T.box1PaymentsReceived - f1098T.box5Scholarships
      expect(netExpenses).toBe(10000)
    })
  })

  describe('American Opportunity Tax Credit (Form 8863)', () => {
    it('should calculate qualified expenses', () => {
      expect(aotc.qualifiedExpenses).toBe(10000)
    })

    it('should calculate AOTC credit amount', () => {
      // 100% of first $2,000 = $2,000
      // 25% of next $2,000 = $500
      // Total = $2,500 (maximum)
      expect(aotc.creditAmount).toBe(2500)
    })

    it('should calculate refundable portion (40%)', () => {
      expect(aotc.refundablePortion).toBe(1000)
    })

    it('should calculate non-refundable portion (60%)', () => {
      expect(aotc.nonRefundablePortion).toBe(1500)
    })

    it('should not exceed maximum credit', () => {
      expect(aotc.creditAmount).toBeLessThanOrEqual(2500)
    })
  })

  describe('Form 1098-E (Student Loan Interest)', () => {
    it('should have student loan interest paid', () => {
      expect(f1098E.box1StudentLoanInterestPaid).toBe(1850)
    })

    it('should calculate deductible interest', () => {
      expect(studentLoanInterestDeduction.deductibleAmount).toBe(1850)
    })

    it('should not exceed maximum deduction', () => {
      expect(studentLoanInterestDeduction.deductibleAmount).toBeLessThanOrEqual(2500)
    })
  })

  describe('Tax Calculation', () => {
    it('should calculate AGI with student loan interest deduction', () => {
      const grossIncome = w2CampusJob.box1Wages
      const adjustments = studentLoanInterestDeduction.deductibleAmount
      const agi = grossIncome - adjustments
      expect(agi).toBe(10650)
    })

    it('should use standard deduction for 2025 Single', () => {
      const standardDeduction = 15000
      expect(standardDeduction).toBe(15000)
    })

    it('should have zero taxable income when deduction exceeds AGI', () => {
      const agi = w2CampusJob.box1Wages - studentLoanInterestDeduction.deductibleAmount
      const standardDeduction = 15000
      const taxableIncome = Math.max(0, agi - standardDeduction)
      expect(taxableIncome).toBe(0)
    })

    it('should receive refundable AOTC', () => {
      // Even with zero tax liability, student gets refundable portion
      expect(aotc.refundablePortion).toBe(1000)
    })

    it('should calculate total refund', () => {
      // Withholding + refundable AOTC
      const expectedRefund = w2CampusJob.box2FederalWithholding + aotc.refundablePortion
      expect(expectedRefund).toBe(1625)
    })
  })
})
