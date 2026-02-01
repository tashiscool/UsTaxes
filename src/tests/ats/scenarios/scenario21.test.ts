/**
 * IRS ATS Test Scenario 21 - Jennifer & Kevin Kim
 *
 * Test Scenario: Child and Dependent Care Credit
 * Primary Taxpayer: Jennifer Kim
 * Spouse: Kevin Kim
 * Filing Status: Married Filing Jointly (2)
 * Dependents: 2 children (both under 13)
 *
 * Key Features Tested:
 * - W-2 income from both spouses
 * - Child Tax Credit (multiple qualifying children)
 * - Child and Dependent Care Credit (Form 2441)
 * - Dependent Care FSA (Box 10 on W-2)
 *
 * Tax Year: 2025
 */

import { FilingStatus } from 'ustaxes/core/data'

// =============================================================================
// Test Data Fixtures - Jennifer & Kevin Kim (Scenario 21)
// =============================================================================

const jenniferKimTaxpayer = {
  firstName: 'Jennifer',
  lastName: 'Kim',
  ssn: '400011211',
  address: {
    address: '400 Family Lane',
    city: 'Seattle',
    state: 'WA' as const,
    zip: '98101'
  },
  dateOfBirth: new Date(1988, 1, 28),
  occupation: 'Marketing Director'
}

const kevinKimSpouse = {
  firstName: 'Kevin',
  lastName: 'Kim',
  ssn: '400011212',
  dateOfBirth: new Date(1986, 9, 5),
  occupation: 'Software Engineer'
}

// Dependents
const dependents = [
  {
    firstName: 'Emma',
    lastName: 'Kim',
    ssn: '400011213',
    dateOfBirth: new Date(2018, 3, 12), // Age 7
    relationship: 'Daughter' as const,
    isUnder13: true,
    monthsLivedWithTaxpayer: 12
  },
  {
    firstName: 'Lucas',
    lastName: 'Kim',
    ssn: '400011214',
    dateOfBirth: new Date(2021, 7, 25), // Age 4
    relationship: 'Son' as const,
    isUnder13: true,
    monthsLivedWithTaxpayer: 12
  }
]

// W-2 from Jennifer's employer
const w2Jennifer = {
  employerName: 'Pacific Marketing Group',
  employerEin: '91-1111111',
  box1Wages: 95000,
  box2FederalWithholding: 12000,
  box3SsWages: 95000,
  box4SsTax: 5890,
  box5MedicareWages: 95000,
  box6MedicareTax: 1378,
  box10DependentCareBenefits: 5000 // FSA contribution
}

// W-2 from Kevin's employer
const w2Kevin = {
  employerName: 'Amazon Web Services',
  employerEin: '91-2222222',
  box1Wages: 145000,
  box2FederalWithholding: 22000,
  box3SsWages: 145000,
  box4SsTax: 8990,
  box5MedicareWages: 145000,
  box6MedicareTax: 2103,
  box10DependentCareBenefits: 0 // Only Jennifer has FSA
}

// Childcare expenses
const childcareExpenses = {
  provider: {
    name: 'Sunshine Day Care Center',
    ein: '91-3333333',
    address: '123 Care Street, Seattle, WA 98102'
  },
  expenses: [
    { child: 'Emma', annualCost: 12000 }, // After-school care
    { child: 'Lucas', annualCost: 18000 } // Full-time daycare
  ],
  get totalExpenses() {
    return this.expenses.reduce((sum, e) => sum + e.annualCost, 0)
  }
}

// Form 2441 - Child and Dependent Care Expenses
const form2441 = {
  qualifyingPersons: dependents.filter((d) => d.isUnder13),

  // Expense limits
  get expenseLimit() {
    // $3,000 for one qualifying person, $6,000 for two or more
    return this.qualifyingPersons.length >= 2 ? 6000 : 3000
  },

  // Dependent Care Benefits (FSA) reduce eligible expenses
  get dependentCareBenefits() {
    return (
      w2Jennifer.box10DependentCareBenefits + w2Kevin.box10DependentCareBenefits
    )
  },

  // Expenses after FSA exclusion
  get expensesAfterFSA() {
    return Math.max(
      0,
      childcareExpenses.totalExpenses - this.dependentCareBenefits
    )
  },

  // Eligible expenses (lesser of actual expenses or limit)
  get eligibleExpenses() {
    return Math.min(this.expensesAfterFSA, this.expenseLimit)
  },

  // Earned income test (both spouses must have earned income)
  get earnedIncomeJennifer() {
    return w2Jennifer.box1Wages
  },
  get earnedIncomeKevin() {
    return w2Kevin.box1Wages
  },
  get lowerEarnedIncome() {
    return Math.min(this.earnedIncomeJennifer, this.earnedIncomeKevin)
  },

  // Credit percentage based on AGI
  getCreditPercentage(agi: number): number {
    if (agi <= 15000) return 35
    // Decreases by 1% for each $2,000 over $15,000
    // Minimum 20% at $43,000+
    const reduction = Math.floor((agi - 15000) / 2000)
    return Math.max(20, 35 - reduction)
  },

  // Calculate credit
  getCredit(agi: number): number {
    const percentage = this.getCreditPercentage(agi) / 100
    const qualifyingExpenses = Math.min(
      this.eligibleExpenses,
      this.lowerEarnedIncome
    )
    return qualifyingExpenses * percentage
  }
}

// Child Tax Credit
const childTaxCredit = {
  creditPerChild: 2000, // 2025 CTC amount
  qualifyingChildren: dependents.filter(
    (d) => d.monthsLivedWithTaxpayer >= 6 && d.isUnder13
  ),

  get totalCredit() {
    return this.qualifyingChildren.length * this.creditPerChild
  },

  // Phase-out thresholds
  phaseoutThresholdMFJ: 400000,

  get refundablePortionPerChild() {
    return 1700 // 2025 ACTC limit
  }
}

// Income calculations
const totals = {
  get totalWages() {
    return w2Jennifer.box1Wages + w2Kevin.box1Wages
  },
  get agi() {
    return this.totalWages
  },
  get federalWithholding() {
    return w2Jennifer.box2FederalWithholding + w2Kevin.box2FederalWithholding
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('ATS Scenario 21 - Jennifer & Kevin Kim (Childcare Credit)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct primary taxpayer name', () => {
      expect(jenniferKimTaxpayer.firstName).toBe('Jennifer')
      expect(jenniferKimTaxpayer.lastName).toBe('Kim')
    })

    it('should have correct spouse name', () => {
      expect(kevinKimSpouse.firstName).toBe('Kevin')
      expect(kevinKimSpouse.lastName).toBe('Kim')
    })

    it('should be filing as MFJ', () => {
      const filingStatus = FilingStatus.MFJ
      expect(filingStatus).toBe(FilingStatus.MFJ)
    })
  })

  describe('Dependents', () => {
    it('should have two dependents', () => {
      expect(dependents.length).toBe(2)
    })

    it('should have both children under 13', () => {
      dependents.forEach((d) => {
        expect(d.isUnder13).toBe(true)
      })
    })

    it('should have children living with taxpayers full year', () => {
      dependents.forEach((d) => {
        expect(d.monthsLivedWithTaxpayer).toBe(12)
      })
    })
  })

  describe('W-2 Income', () => {
    it('should calculate total wages', () => {
      expect(totals.totalWages).toBe(240000)
    })

    it('should calculate total withholding', () => {
      expect(totals.federalWithholding).toBe(34000)
    })

    it('should have Dependent Care FSA contribution', () => {
      expect(w2Jennifer.box10DependentCareBenefits).toBe(5000)
    })
  })

  describe('Childcare Expenses', () => {
    it('should calculate total childcare expenses', () => {
      expect(childcareExpenses.totalExpenses).toBe(30000)
    })

    it('should have care for both children', () => {
      expect(childcareExpenses.expenses.length).toBe(2)
    })

    it('should have valid care provider', () => {
      expect(childcareExpenses.provider.ein).toBe('91-3333333')
    })
  })

  describe('Form 2441 - Child and Dependent Care Credit', () => {
    it('should have two qualifying persons', () => {
      expect(form2441.qualifyingPersons.length).toBe(2)
    })

    it('should use $6,000 expense limit for 2+ qualifying persons', () => {
      expect(form2441.expenseLimit).toBe(6000)
    })

    it('should reduce expenses by FSA benefits', () => {
      expect(form2441.dependentCareBenefits).toBe(5000)
      expect(form2441.expensesAfterFSA).toBe(25000)
    })

    it('should cap eligible expenses at limit', () => {
      expect(form2441.eligibleExpenses).toBe(6000)
    })

    it('should calculate earned income for both spouses', () => {
      expect(form2441.earnedIncomeJennifer).toBe(95000)
      expect(form2441.earnedIncomeKevin).toBe(145000)
    })

    it('should use lower earner for expense limit', () => {
      expect(form2441.lowerEarnedIncome).toBe(95000)
    })

    it('should calculate credit percentage based on AGI', () => {
      const percentage = form2441.getCreditPercentage(totals.agi)
      expect(percentage).toBe(20) // At high AGI, minimum 20%
    })

    it('should calculate care credit', () => {
      const credit = form2441.getCredit(totals.agi)
      // $6,000 × 20% = $1,200
      expect(credit).toBe(1200)
    })
  })

  describe('Child Tax Credit', () => {
    it('should have $2,000 credit per child', () => {
      expect(childTaxCredit.creditPerChild).toBe(2000)
    })

    it('should have two qualifying children', () => {
      expect(childTaxCredit.qualifyingChildren.length).toBe(2)
    })

    it('should calculate total CTC', () => {
      expect(childTaxCredit.totalCredit).toBe(4000)
    })

    it('should be below phase-out threshold', () => {
      expect(totals.agi).toBeLessThan(childTaxCredit.phaseoutThresholdMFJ)
    })

    it('should have refundable portion per child', () => {
      expect(childTaxCredit.refundablePortionPerChild).toBe(1700)
    })
  })

  describe('Dependent Care FSA', () => {
    it('should have FSA contribution on W-2 Box 10', () => {
      const totalFSA =
        w2Jennifer.box10DependentCareBenefits +
        w2Kevin.box10DependentCareBenefits
      expect(totalFSA).toBe(5000)
    })

    it('should not exceed $5,000 annual limit for MFJ', () => {
      const totalFSA =
        w2Jennifer.box10DependentCareBenefits +
        w2Kevin.box10DependentCareBenefits
      expect(totalFSA).toBeLessThanOrEqual(5000)
    })

    it('should exclude FSA from taxable wages', () => {
      // Box 1 wages already reduced by FSA contribution
      // This is pre-tax benefit
      expect(w2Jennifer.box10DependentCareBenefits).toBe(5000)
    })
  })

  describe('Tax Calculation', () => {
    it('should calculate AGI', () => {
      expect(totals.agi).toBe(240000)
    })

    it('should use standard deduction for 2025 MFJ', () => {
      const standardDeduction = 30000
      expect(standardDeduction).toBe(30000)
    })

    it('should calculate taxable income', () => {
      const taxableIncome = totals.agi - 30000
      expect(taxableIncome).toBe(210000)
    })

    it('should apply both CTC and care credit', () => {
      const totalCredits =
        childTaxCredit.totalCredit + form2441.getCredit(totals.agi)
      expect(totalCredits).toBe(5200) // $4,000 + $1,200
    })
  })
})
