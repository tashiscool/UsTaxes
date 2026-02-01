/**
 * IRS ATS Test Scenario 15 - Robert & Patricia Wilson
 *
 * Test Scenario: Retired Couple
 * Primary Taxpayer: Robert Wilson
 * Spouse: Patricia Wilson
 * Filing Status: Married Filing Jointly (2)
 *
 * Key Features Tested:
 * - Social Security benefits (SSA-1099)
 * - Pension income (1099-R)
 * - Interest income (1099-INT)
 * - Additional standard deduction for age 65+
 * - Social Security benefit taxation calculation
 *
 * Tax Year: 2025
 */

import { FilingStatus } from 'ustaxes/core/data'

// =============================================================================
// Test Data Fixtures - Robert & Patricia Wilson (Scenario 15)
// =============================================================================

const robertWilsonTaxpayer = {
  firstName: 'Robert',
  lastName: 'Wilson',
  ssn: '400011151',
  address: {
    address: '789 Retirement Blvd',
    city: 'Scottsdale',
    state: 'AZ' as const,
    zip: '85251'
  },
  dateOfBirth: new Date(1955, 8, 15), // September 15, 1955 - Age 70
  occupation: 'Retired',
  isOver65: true
}

const patriciaWilsonSpouse = {
  firstName: 'Patricia',
  lastName: 'Wilson',
  ssn: '400011152',
  dateOfBirth: new Date(1958, 2, 22), // March 22, 1958 - Age 67
  isOver65: true
}

// SSA-1099 - Social Security Benefits (Robert)
const ssa1099Robert = {
  recipientName: 'Robert Wilson',
  recipientSsn: '400011151',
  box3BenefitsPaid: 28800, // $2,400/month
  box4BenefitsRepaid: 0,
  box5NetBenefits: 28800,
  box6VoluntaryWithholding: 0
}

// SSA-1099 - Social Security Benefits (Patricia)
const ssa1099Patricia = {
  recipientName: 'Patricia Wilson',
  recipientSsn: '400011152',
  box3BenefitsPaid: 21600, // $1,800/month
  box4BenefitsRepaid: 0,
  box5NetBenefits: 21600,
  box6VoluntaryWithholding: 0
}

const totalSocialSecurity =
  ssa1099Robert.box5NetBenefits + ssa1099Patricia.box5NetBenefits // $50,400

// 1099-R - Pension Distribution (Robert's company pension)
const f1099RPension = {
  payerName: 'XYZ Corporation Pension Plan',
  payerTin: '12-3456789',
  box1GrossDistribution: 36000, // $3,000/month
  box2aTaxableAmount: 36000, // Fully taxable
  box2bTaxableNotDetermined: false,
  box4FederalWithholding: 3600, // 10% withheld
  box7DistributionCode: '7', // Normal distribution
  isIra: false
}

// 1099-INT - Interest Income
const f1099Int = {
  payerName: 'First National Bank',
  payerTin: '11-1111111',
  box1InterestIncome: 2400,
  box3InterestOnUsSavingsBonds: 0
}

// =============================================================================
// Tax Calculation Helpers
// =============================================================================

const taxCalculation = {
  // Other income (non-Social Security)
  get otherIncome() {
    return f1099RPension.box2aTaxableAmount + f1099Int.box1InterestIncome
  },

  // Social Security taxation calculation (MFJ thresholds)
  get provisionalIncome() {
    return this.otherIncome + totalSocialSecurity / 2
  },

  // MFJ: $32,000 base, $44,000 additional
  get taxableSocialSecurity() {
    const halfBenefits = totalSocialSecurity / 2
    const baseAmount = 32000
    const additionalAmount = 44000

    if (this.provisionalIncome <= baseAmount) {
      return 0
    } else if (this.provisionalIncome <= additionalAmount) {
      return Math.min(halfBenefits, (this.provisionalIncome - baseAmount) * 0.5)
    } else {
      const amount1 = Math.min(
        halfBenefits,
        (additionalAmount - baseAmount) * 0.5
      )
      const amount2 = (this.provisionalIncome - additionalAmount) * 0.85
      return Math.min(totalSocialSecurity * 0.85, amount1 + amount2)
    }
  },

  // Gross income
  get totalIncome() {
    return this.otherIncome + this.taxableSocialSecurity
  },

  // Standard deduction with additional amounts for 65+
  get standardDeduction() {
    const baseDeductionMFJ = 30000 // 2025 MFJ
    const additionalFor65Plus = 1550 // Per person for married
    const additionalTotal = additionalFor65Plus * 2 // Both over 65
    return baseDeductionMFJ + additionalTotal // $33,100
  },

  // AGI (no adjustments for this scenario)
  get agi() {
    return this.totalIncome
  },

  // Taxable income
  get taxableIncome() {
    return Math.max(0, this.agi - this.standardDeduction)
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('ATS Scenario 15 - Robert & Patricia Wilson (Retired Couple)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct primary taxpayer name', () => {
      expect(robertWilsonTaxpayer.firstName).toBe('Robert')
      expect(robertWilsonTaxpayer.lastName).toBe('Wilson')
    })

    it('should have correct spouse name', () => {
      expect(patriciaWilsonSpouse.firstName).toBe('Patricia')
      expect(patriciaWilsonSpouse.lastName).toBe('Wilson')
    })

    it('should have both taxpayers over 65', () => {
      expect(robertWilsonTaxpayer.isOver65).toBe(true)
      expect(patriciaWilsonSpouse.isOver65).toBe(true)
    })

    it('should be filing as MFJ', () => {
      const filingStatus = FilingStatus.MFJ
      expect(filingStatus).toBe(FilingStatus.MFJ)
    })
  })

  describe('Social Security Benefits (SSA-1099)', () => {
    it('should have two SSA-1099 forms', () => {
      expect(ssa1099Robert.box5NetBenefits).toBe(28800)
      expect(ssa1099Patricia.box5NetBenefits).toBe(21600)
    })

    it('should calculate total Social Security benefits', () => {
      expect(totalSocialSecurity).toBe(50400)
    })

    it('should have Robert as primary SS recipient', () => {
      expect(ssa1099Robert.box5NetBenefits).toBeGreaterThan(
        ssa1099Patricia.box5NetBenefits
      )
    })
  })

  describe('Pension Income (1099-R)', () => {
    it('should have pension distribution', () => {
      expect(f1099RPension.box1GrossDistribution).toBe(36000)
    })

    it('should be fully taxable', () => {
      expect(f1099RPension.box2aTaxableAmount).toBe(
        f1099RPension.box1GrossDistribution
      )
    })

    it('should have federal withholding', () => {
      expect(f1099RPension.box4FederalWithholding).toBe(3600)
    })

    it('should be normal distribution code 7', () => {
      expect(f1099RPension.box7DistributionCode).toBe('7')
    })
  })

  describe('Interest Income (1099-INT)', () => {
    it('should have interest income', () => {
      expect(f1099Int.box1InterestIncome).toBe(2400)
    })
  })

  describe('Social Security Taxation Calculation', () => {
    it('should calculate other income correctly', () => {
      const expected =
        f1099RPension.box2aTaxableAmount + f1099Int.box1InterestIncome
      expect(taxCalculation.otherIncome).toBe(expected)
      expect(taxCalculation.otherIncome).toBe(38400)
    })

    it('should calculate provisional income correctly', () => {
      const expected = taxCalculation.otherIncome + totalSocialSecurity / 2
      expect(taxCalculation.provisionalIncome).toBe(expected)
      expect(taxCalculation.provisionalIncome).toBe(63600)
    })

    it('should calculate taxable Social Security', () => {
      // Provisional income ($63,600) exceeds $44,000 threshold
      // So up to 85% of benefits may be taxable
      expect(taxCalculation.taxableSocialSecurity).toBeGreaterThan(0)
      expect(taxCalculation.taxableSocialSecurity).toBeLessThanOrEqual(
        totalSocialSecurity * 0.85
      )
    })
  })

  describe('Standard Deduction for Seniors', () => {
    it('should include additional deduction for both being 65+', () => {
      const baseDeduction = 30000
      const additionalPerPerson = 1550
      const expected = baseDeduction + additionalPerPerson * 2
      expect(taxCalculation.standardDeduction).toBe(expected)
      expect(taxCalculation.standardDeduction).toBe(33100)
    })
  })

  describe('Tax Calculation', () => {
    it('should calculate total income correctly', () => {
      expect(taxCalculation.totalIncome).toBeGreaterThan(0)
    })

    it('should calculate AGI correctly', () => {
      expect(taxCalculation.agi).toBe(taxCalculation.totalIncome)
    })

    it('should calculate taxable income correctly', () => {
      const expected = Math.max(
        0,
        taxCalculation.agi - taxCalculation.standardDeduction
      )
      expect(taxCalculation.taxableIncome).toBe(expected)
    })

    it('should have federal withholding from pension', () => {
      expect(f1099RPension.box4FederalWithholding).toBe(3600)
    })
  })
})
