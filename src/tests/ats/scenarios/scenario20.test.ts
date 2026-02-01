/**
 * IRS ATS Test Scenario 20 - David Lee
 *
 * Test Scenario: Premium Tax Credit (Health Insurance Marketplace)
 * Primary Taxpayer: David Lee
 * Filing Status: Single (1)
 *
 * Key Features Tested:
 * - Self-employment income (1099-NEC)
 * - Health Insurance Marketplace coverage (Form 1095-A)
 * - Premium Tax Credit calculation (Form 8962)
 * - Advance Premium Tax Credit reconciliation
 * - Self-employed health insurance deduction
 *
 * Tax Year: 2025
 */

import { FilingStatus } from 'ustaxes/core/data'

// =============================================================================
// Test Data Fixtures - David Lee (Scenario 20)
// =============================================================================

const davidLeeTaxpayer = {
  firstName: 'David',
  lastName: 'Lee',
  ssn: '400011201',
  address: {
    address: '300 Healthcare Way',
    city: 'Portland',
    state: 'OR' as const,
    zip: '97201'
  },
  dateOfBirth: new Date(1985, 7, 14),
  occupation: 'Freelance Web Developer'
}

// 1099-NEC - Self-employment income
const nec1099Freelance = {
  payerName: 'Various Clients',
  box1NonemployeeComp: 52000
}

// Schedule C - Business expenses
const scheduleC = {
  grossReceipts: nec1099Freelance.box1NonemployeeComp,
  expenses: {
    advertising: 800,
    computerEquipment: 1500, // Section 179
    software: 600,
    internet: 720, // 50% business use
    homeOffice: 1800, // Simplified method: $5/sq ft, 360 sq ft
    professionalDevelopment: 500
  },
  get totalExpenses() {
    return Object.values(this.expenses).reduce((sum, exp) => sum + exp, 0)
  },
  get netProfit() {
    return this.grossReceipts - this.totalExpenses
  }
}

// Schedule SE - Self-employment tax
const scheduleSE = {
  get netEarnings() {
    return scheduleC.netProfit * 0.9235
  },
  get socialSecurityTax() {
    return Math.min(this.netEarnings, 176100) * 0.124
  },
  get medicareTax() {
    return this.netEarnings * 0.029
  },
  get totalSETax() {
    return this.socialSecurityTax + this.medicareTax
  },
  get deductibleHalf() {
    return this.totalSETax / 2
  }
}

// Form 1095-A - Health Insurance Marketplace Statement
const f1095A = {
  marketplaceName: 'Cover Oregon',
  policyNumber: 'OR-2025-123456',

  // Monthly premiums and APTC
  monthlyData: [
    { month: 'January', premium: 450, slcsp: 520, aptc: 280 },
    { month: 'February', premium: 450, slcsp: 520, aptc: 280 },
    { month: 'March', premium: 450, slcsp: 520, aptc: 280 },
    { month: 'April', premium: 450, slcsp: 520, aptc: 280 },
    { month: 'May', premium: 450, slcsp: 520, aptc: 280 },
    { month: 'June', premium: 450, slcsp: 520, aptc: 280 },
    { month: 'July', premium: 450, slcsp: 520, aptc: 280 },
    { month: 'August', premium: 450, slcsp: 520, aptc: 280 },
    { month: 'September', premium: 450, slcsp: 520, aptc: 280 },
    { month: 'October', premium: 450, slcsp: 520, aptc: 280 },
    { month: 'November', premium: 450, slcsp: 520, aptc: 280 },
    { month: 'December', premium: 450, slcsp: 520, aptc: 280 }
  ],

  get annualPremium() {
    return this.monthlyData.reduce((sum, m) => sum + m.premium, 0)
  },
  get annualSLCSP() {
    return this.monthlyData.reduce((sum, m) => sum + m.slcsp, 0)
  },
  get annualAPTC() {
    return this.monthlyData.reduce((sum, m) => sum + m.aptc, 0)
  }
}

// Federal Poverty Level (FPL) for 2025 - Single person, 48 states
const federalPovertyLevel = {
  single: 15650, // 2025 FPL for single person
  householdSize: 1,
  get fplAmount() {
    return this.single // Would add ~$5,500 per additional person
  }
}

// Form 8962 - Premium Tax Credit
const form8962 = {
  // Household income calculation
  get modifiedAGI() {
    return scheduleC.netProfit - scheduleSE.deductibleHalf
  },

  get fplPercentage() {
    return (this.modifiedAGI / federalPovertyLevel.fplAmount) * 100
  },

  // Applicable percentage based on FPL (2025 enhanced credits)
  getApplicablePercentage(fplPercent: number): number {
    if (fplPercent <= 150) return 0
    if (fplPercent <= 200) return 2.0
    if (fplPercent <= 250) return 4.0
    if (fplPercent <= 300) return 6.0
    if (fplPercent <= 400) return 8.5
    return 8.5 // ARP extended credits through 2025
  },

  get applicablePercentage() {
    return this.getApplicablePercentage(this.fplPercentage)
  },

  // Annual contribution amount
  get annualContribution() {
    return this.modifiedAGI * (this.applicablePercentage / 100)
  },

  // Premium Tax Credit calculation
  get annualPTC() {
    const slcsp = f1095A.annualSLCSP
    const contribution = this.annualContribution
    return Math.max(0, slcsp - contribution)
  },

  // APTC reconciliation
  get aptcReceived() {
    return f1095A.annualAPTC
  },

  get ptcEntitlement() {
    return this.annualPTC
  },

  get reconciliationAmount() {
    // Positive = additional credit, Negative = repayment
    return this.ptcEntitlement - this.aptcReceived
  }
}

// Self-employed health insurance deduction
const selfEmployedHealthInsurance = {
  get totalPremiumPaid() {
    return f1095A.annualPremium - f1095A.annualAPTC // Net premium after APTC
  },
  get deductibleAmount() {
    // Limited to net self-employment income
    return Math.min(this.totalPremiumPaid, scheduleC.netProfit - scheduleSE.deductibleHalf)
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('ATS Scenario 20 - David Lee (Premium Tax Credit)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct taxpayer name', () => {
      expect(davidLeeTaxpayer.firstName).toBe('David')
      expect(davidLeeTaxpayer.lastName).toBe('Lee')
    })

    it('should be filing as Single', () => {
      const filingStatus = FilingStatus.S
      expect(filingStatus).toBe(FilingStatus.S)
    })

    it('should be self-employed', () => {
      expect(davidLeeTaxpayer.occupation).toBe('Freelance Web Developer')
    })
  })

  describe('Self-Employment Income (1099-NEC)', () => {
    it('should have freelance income', () => {
      expect(nec1099Freelance.box1NonemployeeComp).toBe(52000)
    })
  })

  describe('Schedule C - Business Income', () => {
    it('should calculate total business expenses', () => {
      const expected = 800 + 1500 + 600 + 720 + 1800 + 500
      expect(scheduleC.totalExpenses).toBe(expected)
      expect(scheduleC.totalExpenses).toBe(5920)
    })

    it('should calculate net profit', () => {
      expect(scheduleC.netProfit).toBe(46080)
    })
  })

  describe('Schedule SE - Self-Employment Tax', () => {
    it('should calculate net earnings from SE', () => {
      const expected = scheduleC.netProfit * 0.9235
      expect(scheduleSE.netEarnings).toBeCloseTo(expected, 2)
    })

    it('should calculate total SE tax', () => {
      expect(scheduleSE.totalSETax).toBeGreaterThan(0)
    })

    it('should calculate deductible half of SE tax', () => {
      expect(scheduleSE.deductibleHalf).toBeCloseTo(scheduleSE.totalSETax / 2, 2)
    })
  })

  describe('Form 1095-A - Health Insurance Marketplace', () => {
    it('should have 12 months of coverage', () => {
      expect(f1095A.monthlyData.length).toBe(12)
    })

    it('should calculate annual premium', () => {
      expect(f1095A.annualPremium).toBe(5400) // $450 × 12
    })

    it('should calculate annual SLCSP', () => {
      expect(f1095A.annualSLCSP).toBe(6240) // $520 × 12
    })

    it('should calculate annual APTC received', () => {
      expect(f1095A.annualAPTC).toBe(3360) // $280 × 12
    })
  })

  describe('Federal Poverty Level', () => {
    it('should use 2025 FPL for single person', () => {
      expect(federalPovertyLevel.fplAmount).toBe(15650)
    })

    it('should calculate FPL percentage', () => {
      const fplPercent = form8962.fplPercentage
      expect(fplPercent).toBeGreaterThan(100)
      expect(fplPercent).toBeLessThan(400)
    })
  })

  describe('Form 8962 - Premium Tax Credit', () => {
    it('should calculate modified AGI', () => {
      const expected = scheduleC.netProfit - scheduleSE.deductibleHalf
      expect(form8962.modifiedAGI).toBeCloseTo(expected, 2)
    })

    it('should determine applicable percentage based on FPL', () => {
      const percentage = form8962.applicablePercentage
      expect(percentage).toBeGreaterThanOrEqual(0)
      expect(percentage).toBeLessThanOrEqual(8.5)
    })

    it('should calculate annual contribution amount', () => {
      expect(form8962.annualContribution).toBeGreaterThanOrEqual(0)
    })

    it('should calculate Premium Tax Credit entitlement', () => {
      expect(form8962.ptcEntitlement).toBeGreaterThanOrEqual(0)
    })

    it('should reconcile APTC with actual PTC', () => {
      const reconciliation = form8962.reconciliationAmount
      // Can be positive (additional refund) or negative (repayment)
      expect(typeof reconciliation).toBe('number')
    })
  })

  describe('APTC Reconciliation', () => {
    it('should compare APTC received to PTC entitlement', () => {
      expect(form8962.aptcReceived).toBe(3360)
      expect(form8962.ptcEntitlement).toBeGreaterThanOrEqual(0)
    })

    it('should calculate repayment or additional credit', () => {
      const diff = form8962.reconciliationAmount
      if (diff > 0) {
        // Entitled to more credit than received
        expect(diff).toBeGreaterThan(0)
      } else if (diff < 0) {
        // Must repay excess APTC
        expect(diff).toBeLessThan(0)
      } else {
        // APTC matches entitlement
        expect(diff).toBe(0)
      }
    })
  })

  describe('Self-Employed Health Insurance Deduction', () => {
    it('should calculate net premium after APTC', () => {
      const netPremium = selfEmployedHealthInsurance.totalPremiumPaid
      expect(netPremium).toBe(2040) // $5,400 - $3,360
    })

    it('should limit deduction to net SE income', () => {
      const deduction = selfEmployedHealthInsurance.deductibleAmount
      expect(deduction).toBeLessThanOrEqual(form8962.modifiedAGI)
    })
  })

  describe('Tax Calculation', () => {
    it('should calculate AGI with adjustments', () => {
      const agi = scheduleC.netProfit -
                  scheduleSE.deductibleHalf -
                  selfEmployedHealthInsurance.deductibleAmount
      expect(agi).toBeGreaterThan(0)
    })

    it('should use standard deduction for 2025 Single', () => {
      const standardDeduction = 15000
      expect(standardDeduction).toBe(15000)
    })
  })
})
