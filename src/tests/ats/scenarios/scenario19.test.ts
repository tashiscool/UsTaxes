/**
 * IRS ATS Test Scenario 19 - Carlos & Sofia Garcia
 *
 * Test Scenario: Itemized Deductions
 * Primary Taxpayer: Carlos Garcia
 * Spouse: Sofia Garcia
 * Filing Status: Married Filing Jointly (2)
 *
 * Key Features Tested:
 * - W-2 income from both spouses
 * - Schedule A (Itemized Deductions)
 * - Mortgage interest (Form 1098)
 * - State and local taxes (SALT) with $10,000 cap
 * - Charitable contributions
 * - Medical expenses over 7.5% AGI threshold
 *
 * Tax Year: 2025
 */

import { FilingStatus } from 'ustaxes/core/data'

// =============================================================================
// Test Data Fixtures - Carlos & Sofia Garcia (Scenario 19)
// =============================================================================

const carlosGarciaTaxpayer = {
  firstName: 'Carlos',
  lastName: 'Garcia',
  ssn: '400011191',
  address: {
    address: '200 Deduction Drive',
    city: 'San Jose',
    state: 'CA' as const,
    zip: '95112'
  },
  dateOfBirth: new Date(1972, 10, 8),
  occupation: 'Sales Manager'
}

const sofiaGarciaSpouse = {
  firstName: 'Sofia',
  lastName: 'Garcia',
  ssn: '400011192',
  dateOfBirth: new Date(1975, 3, 19),
  occupation: 'Registered Nurse'
}

// W-2 from Carlos's employer
const w2Carlos = {
  employerName: 'Tech Sales Corp',
  employerEin: '94-5555555',
  box1Wages: 125000,
  box2FederalWithholding: 22000,
  box3SsWages: 125000,
  box4SsTax: 7750,
  box5MedicareWages: 125000,
  box6MedicareTax: 1813,
  box15State: 'CA',
  box16StateWages: 125000,
  box17StateTax: 8500
}

// W-2 from Sofia's employer
const w2Sofia = {
  employerName: 'Kaiser Permanente',
  employerEin: '94-6666666',
  box1Wages: 85000,
  box2FederalWithholding: 12000,
  box3SsWages: 85000,
  box4SsTax: 5270,
  box5MedicareWages: 85000,
  box6MedicareTax: 1233,
  box15State: 'CA',
  box16StateWages: 85000,
  box17StateTax: 5800
}

// Form 1098 - Mortgage Interest Statement
const f1098Mortgage = {
  lenderName: 'Wells Fargo Home Mortgage',
  lenderTin: '94-7777777',
  box1MortgageInterest: 18500,
  box2OutstandingPrincipal: 450000,
  box3OriginationDate: new Date(2018, 5, 15),
  box5PropertyTaxes: 9200 // Property taxes paid through escrow
}

// State and Local Taxes (SALT)
const saltDeduction = {
  stateIncomeTaxWithheld: w2Carlos.box17StateTax + w2Sofia.box17StateTax, // $14,300
  propertyTaxes: f1098Mortgage.box5PropertyTaxes, // $9,200
  get totalSALT() {
    return this.stateIncomeTaxWithheld + this.propertyTaxes
  },
  saltCap: 10000, // TCJA $10,000 cap
  get allowableSALT() {
    return Math.min(this.totalSALT, this.saltCap)
  }
}

// Charitable Contributions
const charitableContributions = {
  cashDonations: [
    { organization: 'American Red Cross', amount: 2500 },
    { organization: 'Local Food Bank', amount: 1500 },
    { organization: "St. Mary's Church", amount: 3600 } // $300/month
  ],
  nonCashDonations: [
    {
      organization: 'Goodwill',
      description: 'Clothing and household items',
      fairMarketValue: 800
    }
  ],

  get totalCashDonations() {
    return this.cashDonations.reduce((sum, d) => sum + d.amount, 0)
  },
  get totalNonCashDonations() {
    return this.nonCashDonations.reduce((sum, d) => sum + d.fairMarketValue, 0)
  },
  get totalCharitable() {
    return this.totalCashDonations + this.totalNonCashDonations
  }
}

// Medical Expenses
const medicalExpenses = {
  outOfPocketMedical: 8500, // Copays, deductibles, prescriptions
  dentalExpenses: 3200, // Orthodontics for children
  visionExpenses: 1800, // Glasses, contacts, exams
  healthInsurancePremiums: 0, // Paid pre-tax through employer

  get totalMedical() {
    return this.outOfPocketMedical + this.dentalExpenses + this.visionExpenses
  },

  agiThresholdPercent: 0.075, // 7.5% of AGI

  getDeductibleAmount(agi: number) {
    const threshold = agi * this.agiThresholdPercent
    return Math.max(0, this.totalMedical - threshold)
  }
}

// Calculate AGI and itemized deductions
const totals = {
  get totalWages() {
    return w2Carlos.box1Wages + w2Sofia.box1Wages
  },
  get agi() {
    return this.totalWages // No adjustments in this scenario
  },
  get federalWithholding() {
    return w2Carlos.box2FederalWithholding + w2Sofia.box2FederalWithholding
  }
}

// Schedule A - Itemized Deductions
const scheduleA = {
  // Line 1-4: Medical Expenses
  get medicalExpenseDeduction() {
    return medicalExpenses.getDeductibleAmount(totals.agi)
  },

  // Line 5-7: State and Local Taxes
  get saltDeduction() {
    return saltDeduction.allowableSALT
  },

  // Line 8-10: Interest Deduction
  get mortgageInterestDeduction() {
    return f1098Mortgage.box1MortgageInterest
  },

  // Line 11-14: Charitable Contributions
  get charitableDeduction() {
    return charitableContributions.totalCharitable
  },

  // Total Itemized Deductions
  get totalItemizedDeductions() {
    return (
      this.medicalExpenseDeduction +
      this.saltDeduction +
      this.mortgageInterestDeduction +
      this.charitableDeduction
    )
  }
}

// Standard vs Itemized comparison
const deductionComparison = {
  standardDeductionMFJ: 30000, // 2025 MFJ
  get itemizedDeductions() {
    return scheduleA.totalItemizedDeductions
  },
  get shouldItemize() {
    return this.itemizedDeductions > this.standardDeductionMFJ
  },
  get optimalDeduction() {
    return Math.max(this.standardDeductionMFJ, this.itemizedDeductions)
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('ATS Scenario 19 - Carlos & Sofia Garcia (Itemized Deductions)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct primary taxpayer name', () => {
      expect(carlosGarciaTaxpayer.firstName).toBe('Carlos')
      expect(carlosGarciaTaxpayer.lastName).toBe('Garcia')
    })

    it('should have correct spouse name', () => {
      expect(sofiaGarciaSpouse.firstName).toBe('Sofia')
      expect(sofiaGarciaSpouse.lastName).toBe('Garcia')
    })

    it('should be filing as MFJ', () => {
      const filingStatus = FilingStatus.MFJ
      expect(filingStatus).toBe(FilingStatus.MFJ)
    })
  })

  describe('W-2 Income', () => {
    it('should calculate total wages', () => {
      expect(totals.totalWages).toBe(210000)
    })

    it('should calculate total withholding', () => {
      expect(totals.federalWithholding).toBe(34000)
    })

    it('should have state income tax withheld', () => {
      const stateWithholding = w2Carlos.box17StateTax + w2Sofia.box17StateTax
      expect(stateWithholding).toBe(14300)
    })
  })

  describe('Form 1098 - Mortgage Interest', () => {
    it('should have mortgage interest paid', () => {
      expect(f1098Mortgage.box1MortgageInterest).toBe(18500)
    })

    it('should have property taxes paid through escrow', () => {
      expect(f1098Mortgage.box5PropertyTaxes).toBe(9200)
    })

    it('should have mortgage originated after 12/15/2017', () => {
      // Mortgage acquisition debt limit is $750,000 for loans after 12/15/2017
      const tcjaDate = new Date(2017, 11, 15)
      expect(f1098Mortgage.box3OriginationDate.getTime()).toBeGreaterThan(
        tcjaDate.getTime()
      )
    })
  })

  describe('State and Local Tax (SALT) Deduction', () => {
    it('should calculate total SALT before cap', () => {
      expect(saltDeduction.totalSALT).toBe(23500) // $14,300 + $9,200
    })

    it('should apply $10,000 SALT cap', () => {
      expect(saltDeduction.allowableSALT).toBe(10000)
    })

    it('should have excess SALT over cap', () => {
      const excess = saltDeduction.totalSALT - saltDeduction.saltCap
      expect(excess).toBe(13500)
    })
  })

  describe('Charitable Contributions', () => {
    it('should calculate total cash donations', () => {
      expect(charitableContributions.totalCashDonations).toBe(7600)
    })

    it('should have non-cash donations', () => {
      expect(charitableContributions.totalNonCashDonations).toBe(800)
    })

    it('should calculate total charitable deduction', () => {
      expect(charitableContributions.totalCharitable).toBe(8400)
    })

    it('should have three cash donation recipients', () => {
      expect(charitableContributions.cashDonations.length).toBe(3)
    })
  })

  describe('Medical Expenses', () => {
    it('should calculate total medical expenses', () => {
      expect(medicalExpenses.totalMedical).toBe(13500)
    })

    it('should apply 7.5% AGI threshold', () => {
      const threshold = totals.agi * 0.075
      expect(threshold).toBe(15750)
    })

    it('should have zero deductible medical if under threshold', () => {
      // $13,500 < $15,750 threshold = $0 deductible
      const deductible = medicalExpenses.getDeductibleAmount(totals.agi)
      expect(deductible).toBe(0)
    })
  })

  describe('Schedule A - Itemized Deductions', () => {
    it('should calculate mortgage interest deduction', () => {
      expect(scheduleA.mortgageInterestDeduction).toBe(18500)
    })

    it('should calculate SALT deduction (capped)', () => {
      expect(scheduleA.saltDeduction).toBe(10000)
    })

    it('should calculate charitable deduction', () => {
      expect(scheduleA.charitableDeduction).toBe(8400)
    })

    it('should calculate total itemized deductions', () => {
      // Medical (0) + SALT (10000) + Mortgage (18500) + Charitable (8400)
      const expected = 0 + 10000 + 18500 + 8400
      expect(scheduleA.totalItemizedDeductions).toBe(expected)
      expect(scheduleA.totalItemizedDeductions).toBe(36900)
    })
  })

  describe('Standard vs Itemized Comparison', () => {
    it('should compare to standard deduction for MFJ', () => {
      expect(deductionComparison.standardDeductionMFJ).toBe(30000)
    })

    it('should determine itemizing is beneficial', () => {
      // $36,900 itemized > $30,000 standard
      expect(deductionComparison.shouldItemize).toBe(true)
    })

    it('should select optimal deduction', () => {
      expect(deductionComparison.optimalDeduction).toBe(36900)
    })

    it('should calculate tax benefit of itemizing', () => {
      const benefit =
        deductionComparison.itemizedDeductions -
        deductionComparison.standardDeductionMFJ
      expect(benefit).toBe(6900)
    })
  })

  describe('Tax Calculation', () => {
    it('should calculate taxable income', () => {
      const taxableIncome = totals.agi - deductionComparison.optimalDeduction
      expect(taxableIncome).toBe(173100)
    })
  })
})
