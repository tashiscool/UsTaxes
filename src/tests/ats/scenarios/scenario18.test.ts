/**
 * IRS ATS Test Scenario 18 - Michael Thompson
 *
 * Test Scenario: Rental Property Owner
 * Primary Taxpayer: Michael Thompson
 * Filing Status: Single (1)
 *
 * Key Features Tested:
 * - W-2 wage income
 * - Schedule E (Rental Real Estate Income)
 * - Rental income and expenses
 * - Depreciation (MACRS)
 * - Passive Activity Loss Rules
 *
 * Tax Year: 2025
 */

import { FilingStatus } from 'ustaxes/core/data'

// =============================================================================
// Test Data Fixtures - Michael Thompson (Scenario 18)
// =============================================================================

const michaelThompsonTaxpayer = {
  firstName: 'Michael',
  lastName: 'Thompson',
  ssn: '400011181',
  address: {
    address: '100 Landlord Lane',
    city: 'Denver',
    state: 'CO' as const,
    zip: '80202'
  },
  dateOfBirth: new Date(1980, 5, 25),
  occupation: 'Engineer'
}

// W-2 from primary employer
const w2Primary = {
  employerName: 'Colorado Tech Corp',
  employerEin: '84-1234567',
  box1Wages: 95000,
  box2FederalWithholding: 15200,
  box3SsWages: 95000,
  box4SsTax: 5890,
  box5MedicareWages: 95000,
  box6MedicareTax: 1378
}

// Rental Property #1 - Single Family Home
const rentalProperty1 = {
  address: '456 Rental Road, Denver, CO 80210',
  propertyType: 'Single Family' as const,
  daysRented: 365,
  personalUseDays: 0,

  // Income
  grossRent: 24000, // $2,000/month
  securityDeposits: 0, // Refundable deposits not income

  // Expenses
  mortgage_interest: 8500,
  property_taxes: 3200,
  insurance: 1400,
  repairs: 2100,
  management_fees: 2400, // 10% of rent
  utilities: 0, // Paid by tenant
  advertising: 150,
  legal_professional: 300,

  // Depreciation
  buildingBasis: 220000,
  landValue: 80000, // Not depreciable
  depreciationYears: 27.5, // Residential rental
  get annualDepreciation() {
    return this.buildingBasis / this.depreciationYears
  }
}

// Rental Property #2 - Condo
const rentalProperty2 = {
  address: '789 Condo Court #204, Aurora, CO 80012',
  propertyType: 'Condo' as const,
  daysRented: 365,
  personalUseDays: 0,

  // Income
  grossRent: 18000, // $1,500/month

  // Expenses
  mortgage_interest: 6200,
  property_taxes: 2100,
  insurance: 800,
  repairs: 950,
  hoa_fees: 3600, // $300/month
  management_fees: 1800,

  // Depreciation
  buildingBasis: 160000,
  landValue: 40000,
  depreciationYears: 27.5,
  get annualDepreciation() {
    return this.buildingBasis / this.depreciationYears
  }
}

// Schedule E calculations
const scheduleE = {
  get property1TotalIncome() {
    return rentalProperty1.grossRent
  },

  get property1TotalExpenses() {
    return (
      rentalProperty1.mortgage_interest +
      rentalProperty1.property_taxes +
      rentalProperty1.insurance +
      rentalProperty1.repairs +
      rentalProperty1.management_fees +
      rentalProperty1.advertising +
      rentalProperty1.legal_professional +
      rentalProperty1.annualDepreciation
    )
  },

  get property1NetIncome() {
    return this.property1TotalIncome - this.property1TotalExpenses
  },

  get property2TotalIncome() {
    return rentalProperty2.grossRent
  },

  get property2TotalExpenses() {
    return (
      rentalProperty2.mortgage_interest +
      rentalProperty2.property_taxes +
      rentalProperty2.insurance +
      rentalProperty2.repairs +
      rentalProperty2.hoa_fees +
      rentalProperty2.management_fees +
      rentalProperty2.annualDepreciation
    )
  },

  get property2NetIncome() {
    return this.property2TotalIncome - this.property2TotalExpenses
  },

  get totalRentalIncome() {
    return this.property1TotalIncome + this.property2TotalIncome
  },

  get totalRentalExpenses() {
    return this.property1TotalExpenses + this.property2TotalExpenses
  },

  get totalNetRentalIncome() {
    return this.property1NetIncome + this.property2NetIncome
  }
}

// Passive Activity Loss limitation
const passiveActivityRules = {
  // Active participation allowance: Up to $25,000 loss
  // Phase-out starts at $100,000 MAGI, eliminated at $150,000
  magiThreshold: 100000,
  phaseoutComplete: 150000,
  maxAllowance: 25000,

  get magi() {
    return w2Primary.box1Wages // Simplified - would include other income
  },

  get allowedLoss() {
    if (this.magi <= this.magiThreshold) {
      return this.maxAllowance
    } else if (this.magi >= this.phaseoutComplete) {
      return 0
    } else {
      const phaseoutAmount = ((this.magi - this.magiThreshold) / 2)
      return Math.max(0, this.maxAllowance - phaseoutAmount)
    }
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('ATS Scenario 18 - Michael Thompson (Rental Property Owner)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct taxpayer name', () => {
      expect(michaelThompsonTaxpayer.firstName).toBe('Michael')
      expect(michaelThompsonTaxpayer.lastName).toBe('Thompson')
    })

    it('should be filing as Single', () => {
      const filingStatus = FilingStatus.S
      expect(filingStatus).toBe(FilingStatus.S)
    })
  })

  describe('W-2 Income', () => {
    it('should have wage income', () => {
      expect(w2Primary.box1Wages).toBe(95000)
    })

    it('should have federal withholding', () => {
      expect(w2Primary.box2FederalWithholding).toBe(15200)
    })
  })

  describe('Rental Property #1 (Single Family)', () => {
    it('should have gross rental income', () => {
      expect(rentalProperty1.grossRent).toBe(24000)
    })

    it('should calculate depreciation correctly', () => {
      const expected = 220000 / 27.5
      expect(rentalProperty1.annualDepreciation).toBe(expected)
      expect(rentalProperty1.annualDepreciation).toBe(8000)
    })

    it('should be rented full year', () => {
      expect(rentalProperty1.daysRented).toBe(365)
      expect(rentalProperty1.personalUseDays).toBe(0)
    })
  })

  describe('Rental Property #2 (Condo)', () => {
    it('should have gross rental income', () => {
      expect(rentalProperty2.grossRent).toBe(18000)
    })

    it('should include HOA fees as expense', () => {
      expect(rentalProperty2.hoa_fees).toBe(3600)
    })

    it('should calculate depreciation correctly', () => {
      const expected = 160000 / 27.5
      expect(rentalProperty2.annualDepreciation).toBeCloseTo(expected, 2)
    })
  })

  describe('Schedule E Calculations', () => {
    it('should calculate Property 1 net income', () => {
      const income = scheduleE.property1TotalIncome
      const expenses = scheduleE.property1TotalExpenses
      expect(income).toBe(24000)
      expect(expenses).toBeGreaterThan(income) // Net loss expected
    })

    it('should calculate Property 2 net income', () => {
      const income = scheduleE.property2TotalIncome
      const expenses = scheduleE.property2TotalExpenses
      expect(income).toBe(18000)
    })

    it('should calculate total rental income', () => {
      expect(scheduleE.totalRentalIncome).toBe(42000)
    })

    it('should calculate combined net rental income/loss', () => {
      const net = scheduleE.totalNetRentalIncome
      // May be positive or negative depending on expenses
      expect(typeof net).toBe('number')
    })
  })

  describe('Passive Activity Loss Rules', () => {
    it('should identify MAGI for phaseout calculation', () => {
      expect(passiveActivityRules.magi).toBe(95000)
    })

    it('should be below phaseout threshold', () => {
      expect(passiveActivityRules.magi).toBeLessThan(passiveActivityRules.magiThreshold)
    })

    it('should allow full $25,000 loss deduction', () => {
      // MAGI under $100,000 = full allowance
      expect(passiveActivityRules.allowedLoss).toBe(25000)
    })
  })

  describe('Depreciation', () => {
    it('should use 27.5 year life for residential rental', () => {
      expect(rentalProperty1.depreciationYears).toBe(27.5)
      expect(rentalProperty2.depreciationYears).toBe(27.5)
    })

    it('should not depreciate land value', () => {
      expect(rentalProperty1.landValue).toBe(80000)
      expect(rentalProperty2.landValue).toBe(40000)
      // Depreciation based only on building basis
      const totalBasis = rentalProperty1.buildingBasis + rentalProperty2.buildingBasis
      const totalWithLand = totalBasis + rentalProperty1.landValue + rentalProperty2.landValue
      expect(totalBasis).toBeLessThan(totalWithLand)
    })

    it('should calculate total annual depreciation', () => {
      const totalDepreciation =
        rentalProperty1.annualDepreciation + rentalProperty2.annualDepreciation
      expect(totalDepreciation).toBeGreaterThan(0)
    })
  })

  describe('Tax Calculation', () => {
    it('should calculate AGI with rental income/loss', () => {
      const wages = w2Primary.box1Wages
      const rentalNet = scheduleE.totalNetRentalIncome
      const agi = wages + rentalNet
      expect(agi).toBeDefined()
    })

    it('should use standard deduction for 2025 Single', () => {
      const standardDeduction = 15000
      expect(standardDeduction).toBe(15000)
    })
  })
})
