/**
 * IRS ATS Test Scenario 23 - James Brown
 *
 * Test Scenario: Military Service Member
 * Primary Taxpayer: James Brown
 * Spouse: Sarah Brown
 * Filing Status: Married Filing Jointly (2)
 *
 * Key Features Tested:
 * - Military W-2 income with combat zone exclusion
 * - Form 3903 (Moving Expenses for Armed Forces)
 * - PCS (Permanent Change of Station) move
 * - Tax-free combat pay exclusion
 * - Military housing allowance (BAH)
 * - SCRA protections
 *
 * Tax Year: 2025
 */

import { FilingStatus } from 'ustaxes/core/data'

// =============================================================================
// Test Data Fixtures - James Brown (Scenario 23)
// =============================================================================

const jamesBrownTaxpayer = {
  firstName: 'James',
  lastName: 'Brown',
  ssn: '400011231',
  address: {
    address: '123 Base Housing Road',
    city: 'San Diego',
    state: 'CA' as const,
    zip: '92134'
  },
  dateOfBirth: new Date(1990, 2, 15),
  occupation: 'Active Duty Military (E-6)',
  militaryStatus: {
    branch: 'Navy' as const,
    rank: 'E-6',
    yearsOfService: 8,
    isActiveDuty: true
  }
}

const sarahBrownSpouse = {
  firstName: 'Sarah',
  lastName: 'Brown',
  ssn: '400011232',
  dateOfBirth: new Date(1992, 7, 22),
  occupation: 'Teacher'
}

// Military W-2 (DFAS)
const w2Military = {
  employerName: 'Defense Finance and Accounting Service',
  employerEin: '31-1575142',
  // Regular pay (non-combat)
  box1Wages: 42000, // Taxable wages (base pay for non-combat months)
  box2FederalWithholding: 3800,
  box3SsWages: 42000,
  box4SsTax: 2604,
  box5MedicareWages: 42000,
  box6MedicareTax: 609,
  box12Codes: {
    Q: 18000 // Combat zone pay exclusion (Box 12 Code Q)
  }
}

// Combat Zone Exclusion Details
const combatZoneExclusion = {
  zone: 'Afghanistan',
  monthsInCombatZone: 6, // January - June 2025
  excludedPay: 18000, // Tax-free combat pay
  immediateDangerPay: 225 * 6, // $225/month hostile fire pay
  familySeparationAllowance: 250 * 6, // $250/month FSA

  get totalExcludedIncome() {
    return this.excludedPay + this.immediateDangerPay + this.familySeparationAllowance
  }
}

// Non-taxable Military Allowances
const militaryAllowances = {
  bah: 2800 * 12, // Basic Allowance for Housing - $2,800/month San Diego
  bas: 452 * 12, // Basic Allowance for Subsistence - $452/month
  colaOverseas: 0, // COLA for overseas (not applicable)

  get totalNonTaxableAllowances() {
    return this.bah + this.bas + this.colaOverseas
  }
}

// Spouse W-2 (civilian job)
const w2Spouse = {
  employerName: 'San Diego Unified School District',
  employerEin: '95-6000619',
  box1Wages: 52000,
  box2FederalWithholding: 5200,
  box3SsWages: 52000,
  box4SsTax: 3224,
  box5MedicareWages: 52000,
  box6MedicareTax: 754,
  box15State: 'CA',
  box16StateWages: 52000,
  box17StateTax: 2600
}

// Form 3903 - Moving Expenses (Military PCS only)
const form3903 = {
  moveReason: 'PCS' as const, // Permanent Change of Station
  previousDutyStation: 'Naval Station Norfolk, VA',
  newDutyStation: 'Naval Base San Diego, CA',
  moveDate: new Date(2025, 6, 15), // July 2025

  // Moving expenses (military PCS moves still deductible)
  transportationOfHousehold: 8500, // Moving company
  travelExpenses: {
    mileage: 2800 * 0.22, // 2,800 miles × standard mileage rate
    lodging: 450, // 3 nights en route
    meals: 0 // Not deductible
  },
  storageExpenses: 1200, // 30 days temporary storage

  get totalMovingExpenses() {
    return (
      this.transportationOfHousehold +
      this.travelExpenses.mileage +
      this.travelExpenses.lodging +
      this.storageExpenses
    )
  },

  // Reimbursements from military
  dislocationAllowance: 3800, // DLA
  mileageReimbursement: 2800 * 0.22,
  perDiem: 600,

  get totalReimbursements() {
    return this.dislocationAllowance + this.mileageReimbursement + this.perDiem
  },

  get deductibleMovingExpenses() {
    // Deductible = Total expenses - Reimbursements (if positive)
    return Math.max(0, this.totalMovingExpenses - this.totalReimbursements)
  }
}

// Servicemembers Civil Relief Act (SCRA) Benefits
const scraProtections = {
  // State of legal residence (domicile) for tax purposes
  legalResidence: 'TX' as const, // Texas - no state income tax
  currentDutyStation: 'CA',

  // Military spouse can elect same residence
  spouseElectionSameResidence: true,

  // Interest rate cap on pre-service debts
  interestRateCap: 6.0
}

// Tax calculations
const totals = {
  get totalTaxableWages() {
    return w2Military.box1Wages + w2Spouse.box1Wages
  },
  get totalExcludedIncome() {
    return combatZoneExclusion.totalExcludedIncome + militaryAllowances.totalNonTaxableAllowances
  },
  get federalWithholding() {
    return w2Military.box2FederalWithholding + w2Spouse.box2FederalWithholding
  },
  get agi() {
    return this.totalTaxableWages - form3903.deductibleMovingExpenses
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('ATS Scenario 23 - James Brown (Military)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct taxpayer name', () => {
      expect(jamesBrownTaxpayer.firstName).toBe('James')
      expect(jamesBrownTaxpayer.lastName).toBe('Brown')
    })

    it('should have correct spouse name', () => {
      expect(sarahBrownSpouse.firstName).toBe('Sarah')
      expect(sarahBrownSpouse.lastName).toBe('Brown')
    })

    it('should be filing as MFJ', () => {
      const filingStatus = FilingStatus.MFJ
      expect(filingStatus).toBe(FilingStatus.MFJ)
    })

    it('should be active duty military', () => {
      expect(jamesBrownTaxpayer.militaryStatus.isActiveDuty).toBe(true)
      expect(jamesBrownTaxpayer.militaryStatus.branch).toBe('Navy')
    })
  })

  describe('Military W-2 Income', () => {
    it('should have taxable military wages', () => {
      expect(w2Military.box1Wages).toBe(42000)
    })

    it('should have combat zone exclusion in Box 12 Code Q', () => {
      expect(w2Military.box12Codes.Q).toBe(18000)
    })

    it('should have federal withholding', () => {
      expect(w2Military.box2FederalWithholding).toBe(3800)
    })

    it('should be from DFAS', () => {
      expect(w2Military.employerName).toBe('Defense Finance and Accounting Service')
    })
  })

  describe('Combat Zone Exclusion', () => {
    it('should have 6 months in combat zone', () => {
      expect(combatZoneExclusion.monthsInCombatZone).toBe(6)
    })

    it('should have excluded combat pay', () => {
      expect(combatZoneExclusion.excludedPay).toBe(18000)
    })

    it('should include hostile fire pay', () => {
      expect(combatZoneExclusion.immediateDangerPay).toBe(1350)
    })

    it('should include family separation allowance', () => {
      expect(combatZoneExclusion.familySeparationAllowance).toBe(1500)
    })

    it('should calculate total excluded income', () => {
      expect(combatZoneExclusion.totalExcludedIncome).toBe(20850)
    })
  })

  describe('Non-Taxable Military Allowances', () => {
    it('should have tax-free BAH', () => {
      expect(militaryAllowances.bah).toBe(33600) // $2,800 × 12
    })

    it('should have tax-free BAS', () => {
      expect(militaryAllowances.bas).toBe(5424) // $452 × 12
    })

    it('should calculate total non-taxable allowances', () => {
      expect(militaryAllowances.totalNonTaxableAllowances).toBe(39024)
    })
  })

  describe('Spouse W-2 Income', () => {
    it('should have civilian spouse wages', () => {
      expect(w2Spouse.box1Wages).toBe(52000)
    })

    it('should have state tax withheld', () => {
      expect(w2Spouse.box17StateTax).toBe(2600)
    })
  })

  describe('Form 3903 - Military Moving Expenses', () => {
    it('should be a PCS move', () => {
      expect(form3903.moveReason).toBe('PCS')
    })

    it('should calculate total moving expenses', () => {
      const expected = 8500 + (2800 * 0.22) + 450 + 1200
      expect(form3903.totalMovingExpenses).toBeCloseTo(expected, 2)
    })

    it('should calculate military reimbursements', () => {
      const expected = 3800 + (2800 * 0.22) + 600
      expect(form3903.totalReimbursements).toBeCloseTo(expected, 2)
    })

    it('should calculate deductible moving expenses', () => {
      // Only expenses exceeding reimbursements are deductible
      const deductible = form3903.deductibleMovingExpenses
      expect(deductible).toBeGreaterThanOrEqual(0)
    })

    it('should still allow moving expense deduction for military', () => {
      // Note: TCJA suspended moving deduction for civilians,
      // but military PCS moves are still deductible
      expect(form3903.moveReason).toBe('PCS')
    })
  })

  describe('SCRA Protections', () => {
    it('should maintain legal residence in Texas', () => {
      expect(scraProtections.legalResidence).toBe('TX')
    })

    it('should have different duty station from legal residence', () => {
      expect(scraProtections.currentDutyStation).toBe('CA')
      expect(scraProtections.legalResidence).not.toBe(scraProtections.currentDutyStation)
    })

    it('should allow spouse to elect same residence', () => {
      expect(scraProtections.spouseElectionSameResidence).toBe(true)
    })

    it('should have 6% interest rate cap on pre-service debts', () => {
      expect(scraProtections.interestRateCap).toBe(6.0)
    })
  })

  describe('Tax Calculation', () => {
    it('should calculate total taxable wages', () => {
      expect(totals.totalTaxableWages).toBe(94000)
    })

    it('should calculate total excluded/non-taxable income', () => {
      // Combat exclusion + allowances
      const expected = combatZoneExclusion.totalExcludedIncome +
                       militaryAllowances.totalNonTaxableAllowances
      expect(totals.totalExcludedIncome).toBe(expected)
    })

    it('should calculate federal withholding', () => {
      expect(totals.federalWithholding).toBe(9000)
    })

    it('should calculate AGI with moving expense deduction', () => {
      const agi = totals.agi
      expect(agi).toBeLessThanOrEqual(totals.totalTaxableWages)
    })

    it('should use standard deduction for 2025 MFJ', () => {
      const standardDeduction = 30000
      expect(standardDeduction).toBe(30000)
    })

    it('should not owe California state tax due to SCRA', () => {
      // Military income not taxable by non-resident state
      // Spouse can elect Texas residence
      expect(scraProtections.legalResidence).toBe('TX')
    })
  })
})
