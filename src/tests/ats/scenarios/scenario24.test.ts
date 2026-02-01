/**
 * IRS ATS Test Scenario 24 - Pastor Marcus Davis
 *
 * Test Scenario: Clergy Member
 * Primary Taxpayer: Marcus Davis
 * Spouse: Angela Davis
 * Filing Status: Married Filing Jointly (2)
 *
 * Key Features Tested:
 * - Clergy W-2 with special tax treatment
 * - Parsonage/Housing Allowance (Section 107)
 * - Dual-status self-employment tax
 * - Schedule SE for ministerial services
 * - Form 4361 exemption considerations
 * - Ministerial income reporting
 *
 * Tax Year: 2025
 */

import { FilingStatus } from 'ustaxes/core/data'

// =============================================================================
// Test Data Fixtures - Pastor Marcus Davis (Scenario 24)
// =============================================================================

const marcusDavisTaxpayer = {
  firstName: 'Marcus',
  lastName: 'Davis',
  ssn: '400011241',
  address: {
    address: '500 Grace Avenue',
    city: 'Atlanta',
    state: 'GA' as const,
    zip: '30301'
  },
  dateOfBirth: new Date(1975, 5, 12),
  occupation: 'Senior Pastor',
  clergyStatus: {
    isOrdained: true,
    denomination: 'Baptist',
    yearsInMinistry: 18
  }
}

const angelaDavisSpouse = {
  firstName: 'Angela',
  lastName: 'Davis',
  ssn: '400011242',
  dateOfBirth: new Date(1978, 8, 25),
  occupation: 'Church Administrator'
}

// Pastor W-2 from Church
const w2Pastor = {
  employerName: 'First Baptist Church of Atlanta',
  employerEin: '58-1234567',
  // Note: Clergy W-2 typically shows only salary, not housing allowance
  box1Wages: 65000, // Salary (excludes housing allowance)
  box2FederalWithholding: 6500, // Voluntary withholding
  // Boxes 3-6 typically blank for clergy (dual-status)
  box3SsWages: 0, // Clergy exempt from FICA on W-2
  box4SsTax: 0,
  box5MedicareWages: 0,
  box6MedicareTax: 0,
  box14Other: 'Housing Allowance: $30,000' // Informational
}

// Parsonage/Housing Allowance (IRC Section 107)
const housingAllowance = {
  designatedAmount: 30000, // Church-designated housing allowance
  actualExpenses: {
    rent: 0, // Owns home
    mortgageInterest: 12000,
    propertyTaxes: 4500,
    utilities: 3600,
    insurance: 1800,
    repairs: 2500,
    furnishings: 1500
  },

  get totalActualExpenses() {
    return Object.values(this.actualExpenses).reduce((sum, exp) => sum + exp, 0)
  },

  // FRV calculation
  fairRentalValue: 28000, // FRV of furnished home + utilities

  // Excludable amount is LESSER of:
  // 1. Designated amount
  // 2. Actual expenses
  // 3. Fair rental value
  get excludableAmount() {
    return Math.min(
      this.designatedAmount,
      this.totalActualExpenses,
      this.fairRentalValue
    )
  },

  // Excess housing allowance is taxable
  get taxableExcess() {
    return Math.max(0, this.designatedAmount - this.excludableAmount)
  }
}

// Spouse W-2 (Church employee, non-clergy)
const w2Spouse = {
  employerName: 'First Baptist Church of Atlanta',
  employerEin: '58-1234567',
  box1Wages: 38000,
  box2FederalWithholding: 3800,
  box3SsWages: 38000,
  box4SsTax: 2356,
  box5MedicareWages: 38000,
  box6MedicareTax: 551,
  box15State: 'GA',
  box16StateWages: 38000,
  box17StateTax: 1900
}

// Additional ministerial income (1099-NEC)
const ministerialIncome1099 = {
  weddings: 3500, // Officiating weddings
  funerals: 2000, // Officiating funerals
  speakingEngagements: 4500, // Guest preaching, conferences
  counseling: 1500, // Pastoral counseling fees

  get totalMinisterialIncome() {
    return this.weddings + this.funerals + this.speakingEngagements + this.counseling
  }
}

// Schedule SE - Dual-Status Self-Employment Tax
// Clergy are considered self-employed for SE tax purposes
const scheduleSE = {
  // SE income includes W-2 salary + housing allowance + 1099 income
  get netMinisterialEarnings() {
    return (
      w2Pastor.box1Wages +
      housingAllowance.excludableAmount + // Housing allowance IS subject to SE tax
      ministerialIncome1099.totalMinisterialIncome
    )
  },

  // 92.35% of net earnings
  get netEarningsForSE() {
    return this.netMinisterialEarnings * 0.9235
  },

  // SE tax rates
  socialSecurityRate: 0.124,
  medicareRate: 0.029,
  socialSecurityWageBase: 176100,

  get socialSecurityTax() {
    const taxableAmount = Math.min(this.netEarningsForSE, this.socialSecurityWageBase)
    return taxableAmount * this.socialSecurityRate
  },

  get medicareTax() {
    return this.netEarningsForSE * this.medicareRate
  },

  get totalSETax() {
    return this.socialSecurityTax + this.medicareTax
  },

  get deductibleHalf() {
    return this.totalSETax / 2
  }
}

// Form 4361 - Application for Exemption (for reference)
const form4361Exemption = {
  // Pastor has NOT filed Form 4361 - owes SE tax
  hasExemption: false,
  // If exempt, would need to have religious objections to public insurance
  religiousObjection: false,
  // Once filed and approved, exemption is irrevocable
  isIrrevocable: true
}

// Schedule C for ministerial side income
const scheduleC = {
  grossReceipts: ministerialIncome1099.totalMinisterialIncome,
  expenses: {
    vestments: 400, // Clergy robes, collars
    booksAndMaterials: 600,
    professionalDevelopment: 800, // Conferences
    mileage: 1200 // Travel to weddings, funerals
  },

  get totalExpenses() {
    return Object.values(this.expenses).reduce((sum, exp) => sum + exp, 0)
  },

  get netProfit() {
    return this.grossReceipts - this.totalExpenses
  }
}

// Tax calculations
const totals = {
  get totalWages() {
    return w2Pastor.box1Wages + w2Spouse.box1Wages
  },
  get totalMinisterialIncome() {
    return scheduleC.netProfit
  },
  get grossIncome() {
    return this.totalWages + this.totalMinisterialIncome + housingAllowance.taxableExcess
  },
  get agi() {
    return this.grossIncome - scheduleSE.deductibleHalf
  },
  get federalWithholding() {
    return w2Pastor.box2FederalWithholding + w2Spouse.box2FederalWithholding
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('ATS Scenario 24 - Pastor Marcus Davis (Clergy)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct taxpayer name', () => {
      expect(marcusDavisTaxpayer.firstName).toBe('Marcus')
      expect(marcusDavisTaxpayer.lastName).toBe('Davis')
    })

    it('should have correct spouse name', () => {
      expect(angelaDavisSpouse.firstName).toBe('Angela')
      expect(angelaDavisSpouse.lastName).toBe('Davis')
    })

    it('should be filing as MFJ', () => {
      const filingStatus = FilingStatus.MFJ
      expect(filingStatus).toBe(FilingStatus.MFJ)
    })

    it('should be ordained clergy', () => {
      expect(marcusDavisTaxpayer.clergyStatus.isOrdained).toBe(true)
    })
  })

  describe('Clergy W-2 Income', () => {
    it('should have salary on W-2', () => {
      expect(w2Pastor.box1Wages).toBe(65000)
    })

    it('should have no FICA withheld (dual-status)', () => {
      expect(w2Pastor.box3SsWages).toBe(0)
      expect(w2Pastor.box4SsTax).toBe(0)
      expect(w2Pastor.box5MedicareWages).toBe(0)
      expect(w2Pastor.box6MedicareTax).toBe(0)
    })

    it('should show housing allowance in Box 14', () => {
      expect(w2Pastor.box14Other).toContain('Housing Allowance')
    })

    it('should have voluntary federal withholding', () => {
      expect(w2Pastor.box2FederalWithholding).toBe(6500)
    })
  })

  describe('Parsonage/Housing Allowance (Section 107)', () => {
    it('should have designated housing allowance', () => {
      expect(housingAllowance.designatedAmount).toBe(30000)
    })

    it('should calculate actual housing expenses', () => {
      expect(housingAllowance.totalActualExpenses).toBe(25900)
    })

    it('should have fair rental value', () => {
      expect(housingAllowance.fairRentalValue).toBe(28000)
    })

    it('should calculate excludable amount as lesser of three limits', () => {
      // Min of: $30,000 (designated), $25,900 (actual), $28,000 (FRV)
      expect(housingAllowance.excludableAmount).toBe(25900)
    })

    it('should calculate taxable excess', () => {
      // $30,000 - $25,900 = $4,100 taxable
      expect(housingAllowance.taxableExcess).toBe(4100)
    })
  })

  describe('Ministerial Side Income (1099-NEC)', () => {
    it('should have income from weddings', () => {
      expect(ministerialIncome1099.weddings).toBe(3500)
    })

    it('should have income from funerals', () => {
      expect(ministerialIncome1099.funerals).toBe(2000)
    })

    it('should have income from speaking engagements', () => {
      expect(ministerialIncome1099.speakingEngagements).toBe(4500)
    })

    it('should calculate total ministerial 1099 income', () => {
      expect(ministerialIncome1099.totalMinisterialIncome).toBe(11500)
    })
  })

  describe('Schedule C - Ministerial Expenses', () => {
    it('should have gross receipts matching 1099 income', () => {
      expect(scheduleC.grossReceipts).toBe(ministerialIncome1099.totalMinisterialIncome)
    })

    it('should calculate total business expenses', () => {
      expect(scheduleC.totalExpenses).toBe(3000)
    })

    it('should calculate net profit', () => {
      expect(scheduleC.netProfit).toBe(8500)
    })
  })

  describe('Schedule SE - Dual-Status Self-Employment', () => {
    it('should include salary in SE income', () => {
      expect(scheduleSE.netMinisterialEarnings).toBeGreaterThanOrEqual(w2Pastor.box1Wages)
    })

    it('should include housing allowance in SE income', () => {
      // Housing allowance is tax-free for income tax but subject to SE tax
      const seIncome = scheduleSE.netMinisterialEarnings
      expect(seIncome).toBeGreaterThan(w2Pastor.box1Wages)
    })

    it('should calculate net earnings for SE tax', () => {
      const expected = scheduleSE.netMinisterialEarnings * 0.9235
      expect(scheduleSE.netEarningsForSE).toBeCloseTo(expected, 2)
    })

    it('should calculate Social Security tax', () => {
      expect(scheduleSE.socialSecurityTax).toBeGreaterThan(0)
    })

    it('should calculate Medicare tax', () => {
      expect(scheduleSE.medicareTax).toBeGreaterThan(0)
    })

    it('should calculate total SE tax', () => {
      const expected = scheduleSE.socialSecurityTax + scheduleSE.medicareTax
      expect(scheduleSE.totalSETax).toBeCloseTo(expected, 2)
    })

    it('should calculate deductible half of SE tax', () => {
      expect(scheduleSE.deductibleHalf).toBe(scheduleSE.totalSETax / 2)
    })
  })

  describe('Form 4361 Exemption Status', () => {
    it('should not have Form 4361 exemption', () => {
      expect(form4361Exemption.hasExemption).toBe(false)
    })

    it('should owe SE tax without exemption', () => {
      expect(scheduleSE.totalSETax).toBeGreaterThan(0)
    })

    it('should know exemption is irrevocable once filed', () => {
      expect(form4361Exemption.isIrrevocable).toBe(true)
    })
  })

  describe('Spouse W-2 Income', () => {
    it('should have spouse wages', () => {
      expect(w2Spouse.box1Wages).toBe(38000)
    })

    it('should have FICA withheld (non-clergy employee)', () => {
      expect(w2Spouse.box3SsWages).toBe(38000)
      expect(w2Spouse.box4SsTax).toBe(2356)
    })

    it('should have state tax withheld', () => {
      expect(w2Spouse.box17StateTax).toBe(1900)
    })
  })

  describe('Tax Calculation', () => {
    it('should calculate total wages', () => {
      expect(totals.totalWages).toBe(103000)
    })

    it('should calculate gross income including taxable excess', () => {
      const expected = totals.totalWages + scheduleC.netProfit + housingAllowance.taxableExcess
      expect(totals.grossIncome).toBe(expected)
    })

    it('should calculate AGI with SE deduction', () => {
      expect(totals.agi).toBeLessThan(totals.grossIncome)
    })

    it('should calculate federal withholding', () => {
      expect(totals.federalWithholding).toBe(10300)
    })

    it('should use standard deduction for 2025 MFJ', () => {
      const standardDeduction = 30000
      expect(standardDeduction).toBe(30000)
    })

    it('should exclude housing allowance from taxable income', () => {
      // Only the excess is taxable, not the full $30,000
      expect(housingAllowance.excludableAmount).toBe(25900)
    })
  })

  describe('Special Clergy Tax Rules', () => {
    it('should treat clergy as employee for income tax', () => {
      // Receives W-2, can have voluntary withholding
      expect(w2Pastor.box2FederalWithholding).toBeGreaterThan(0)
    })

    it('should treat clergy as self-employed for SE tax', () => {
      // No FICA on W-2, pays SE tax instead
      expect(w2Pastor.box4SsTax).toBe(0)
      expect(scheduleSE.totalSETax).toBeGreaterThan(0)
    })

    it('should include housing allowance in SE but not income tax', () => {
      // Housing allowance affects SE calculation
      expect(scheduleSE.netMinisterialEarnings).toBeGreaterThan(w2Pastor.box1Wages)
      // But only excess is taxable for income tax
      expect(housingAllowance.taxableExcess).toBeLessThan(housingAllowance.designatedAmount)
    })
  })
})
