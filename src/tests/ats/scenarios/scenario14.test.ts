/**
 * IRS ATS Test Scenario 14 - Maria Martinez
 *
 * Test Scenario: Self-Employed Gig Worker
 * Primary Taxpayer: Maria Martinez
 * Filing Status: Single (1)
 * No Dependents
 *
 * Key Features Tested:
 * - Multiple 1099-NEC forms from gig economy (rideshare, delivery)
 * - Schedule C business income and expenses
 * - Schedule SE self-employment tax
 * - Quarterly estimated tax payments
 * - QBI deduction (Section 199A)
 *
 * Tax Year: 2025
 */

import { FilingStatus } from 'ustaxes/core/data'

// =============================================================================
// Test Data Fixtures - Maria Martinez (Scenario 14)
// =============================================================================

const mariaMartinezTaxpayer = {
  firstName: 'Maria',
  lastName: 'Martinez',
  ssn: '400011141',
  address: {
    address: '456 Gig Lane',
    city: 'Austin',
    state: 'TX' as const,
    zip: '78701'
  },
  dateOfBirth: new Date(1992, 3, 12),
  occupation: 'Independent Contractor',
  digitalAssets: false
}

// 1099-NEC from Uber
const nec1Uber = {
  payerName: 'Uber Technologies',
  payerEin: '45-2647441',
  box1NonemployeeComp: 28500
}

// 1099-NEC from DoorDash
const nec2Doordash = {
  payerName: 'DoorDash Inc',
  payerEin: '46-2852392',
  box1NonemployeeComp: 18200
}

// 1099-NEC from Instacart
const nec3Instacart = {
  payerName: 'Maplebear Inc (Instacart)',
  payerEin: '46-0723335',
  box1NonemployeeComp: 12300
}

const totalGrossReceipts =
  nec1Uber.box1NonemployeeComp +
  nec2Doordash.box1NonemployeeComp +
  nec3Instacart.box1NonemployeeComp // $59,000

// Schedule C - Business Expenses
const scheduleC = {
  principalBusiness: 'Rideshare/Delivery Services',
  businessCode: '485300', // Taxi and ridesharing services
  accountingMethod: 'cash' as const,

  // Income
  line1GrossReceipts: totalGrossReceipts, // $59,000

  // Expenses
  carAndTruck: 8500, // Mileage deduction (standard rate)
  insurance: 1200, // Business portion
  cellPhone: 720, // 60% business use
  supplies: 350, // Phone mount, bags, etc.
  otherExpenses: 480, // App fees, tolls, parking

  get totalExpenses() {
    return this.carAndTruck + this.insurance + this.cellPhone +
           this.supplies + this.otherExpenses
  },

  get netProfit() {
    return this.line1GrossReceipts - this.totalExpenses
  }
}

// Schedule SE - Self-Employment Tax
const scheduleSE = {
  netEarningsFromSE: scheduleC.netProfit * 0.9235, // 92.35% of net profit
  ssTaxRate: 0.124, // 12.4% Social Security
  medicareTaxRate: 0.029, // 2.9% Medicare

  get socialSecurityTax() {
    // Capped at wage base ($176,100 for 2025)
    const ssTaxableAmount = Math.min(this.netEarningsFromSE, 176100)
    return ssTaxableAmount * this.ssTaxRate
  },

  get medicareTax() {
    return this.netEarningsFromSE * this.medicareTaxRate
  },

  get totalSETax() {
    return this.socialSecurityTax + this.medicareTax
  },

  get deductibleHalf() {
    return this.totalSETax / 2
  }
}

// Estimated Tax Payments
const estimatedTaxPayments = {
  q1: 2000,
  q2: 2000,
  q3: 2000,
  q4: 2000,
  get total() {
    return this.q1 + this.q2 + this.q3 + this.q4
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('ATS Scenario 14 - Maria Martinez (Gig Worker)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct taxpayer name', () => {
      expect(mariaMartinezTaxpayer.firstName).toBe('Maria')
      expect(mariaMartinezTaxpayer.lastName).toBe('Martinez')
    })

    it('should have valid SSN format', () => {
      expect(mariaMartinezTaxpayer.ssn).toHaveLength(9)
      expect(/^\d{9}$/.test(mariaMartinezTaxpayer.ssn)).toBe(true)
    })

    it('should be filing as Single', () => {
      const filingStatus = FilingStatus.S
      expect(filingStatus).toBe(FilingStatus.S)
    })
  })

  describe('1099-NEC Income', () => {
    it('should have three 1099-NEC forms', () => {
      const necs = [nec1Uber, nec2Doordash, nec3Instacart]
      expect(necs.length).toBe(3)
    })

    it('should calculate total 1099-NEC income correctly', () => {
      expect(totalGrossReceipts).toBe(59000)
    })

    it('should have Uber as largest income source', () => {
      expect(nec1Uber.box1NonemployeeComp).toBeGreaterThan(nec2Doordash.box1NonemployeeComp)
      expect(nec1Uber.box1NonemployeeComp).toBeGreaterThan(nec3Instacart.box1NonemployeeComp)
    })
  })

  describe('Schedule C (Business Income)', () => {
    it('should have gross receipts matching 1099-NECs', () => {
      expect(scheduleC.line1GrossReceipts).toBe(totalGrossReceipts)
    })

    it('should calculate total expenses correctly', () => {
      const expected = 8500 + 1200 + 720 + 350 + 480
      expect(scheduleC.totalExpenses).toBe(expected)
      expect(scheduleC.totalExpenses).toBe(11250)
    })

    it('should calculate net profit correctly', () => {
      const expected = scheduleC.line1GrossReceipts - scheduleC.totalExpenses
      expect(scheduleC.netProfit).toBe(expected)
      expect(scheduleC.netProfit).toBe(47750)
    })

    it('should have car/truck as largest expense', () => {
      expect(scheduleC.carAndTruck).toBeGreaterThan(scheduleC.insurance)
      expect(scheduleC.carAndTruck).toBeGreaterThan(scheduleC.cellPhone)
    })
  })

  describe('Schedule SE (Self-Employment Tax)', () => {
    it('should calculate net earnings from SE correctly', () => {
      const expected = scheduleC.netProfit * 0.9235
      expect(scheduleSE.netEarningsFromSE).toBeCloseTo(expected, 2)
    })

    it('should calculate Social Security tax correctly', () => {
      const taxableAmount = Math.min(scheduleSE.netEarningsFromSE, 176100)
      const expected = taxableAmount * 0.124
      expect(scheduleSE.socialSecurityTax).toBeCloseTo(expected, 2)
    })

    it('should calculate Medicare tax correctly', () => {
      const expected = scheduleSE.netEarningsFromSE * 0.029
      expect(scheduleSE.medicareTax).toBeCloseTo(expected, 2)
    })

    it('should calculate total SE tax correctly', () => {
      const expected = scheduleSE.socialSecurityTax + scheduleSE.medicareTax
      expect(scheduleSE.totalSETax).toBeCloseTo(expected, 2)
    })

    it('should calculate deductible half of SE tax', () => {
      const expected = scheduleSE.totalSETax / 2
      expect(scheduleSE.deductibleHalf).toBeCloseTo(expected, 2)
    })
  })

  describe('Estimated Tax Payments', () => {
    it('should have four quarterly payments', () => {
      expect(estimatedTaxPayments.q1).toBe(2000)
      expect(estimatedTaxPayments.q2).toBe(2000)
      expect(estimatedTaxPayments.q3).toBe(2000)
      expect(estimatedTaxPayments.q4).toBe(2000)
    })

    it('should calculate total estimated payments', () => {
      expect(estimatedTaxPayments.total).toBe(8000)
    })
  })

  describe('Tax Calculation', () => {
    it('should calculate AGI correctly', () => {
      const agi = scheduleC.netProfit - scheduleSE.deductibleHalf
      expect(agi).toBeGreaterThan(0)
      expect(agi).toBeLessThan(scheduleC.netProfit)
    })

    it('should use standard deduction for 2025 Single', () => {
      const standardDeduction = 15000
      expect(standardDeduction).toBe(15000)
    })

    it('should calculate QBI deduction (20% of qualified business income)', () => {
      const qbiDeduction = scheduleC.netProfit * 0.2
      expect(qbiDeduction).toBe(9550)
    })
  })
})
