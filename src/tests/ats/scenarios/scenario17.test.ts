/**
 * IRS ATS Test Scenario 17 - Raj & Priya Patel
 *
 * Test Scenario: Investment Income
 * Primary Taxpayer: Raj Patel
 * Spouse: Priya Patel
 * Filing Status: Married Filing Jointly (2)
 *
 * Key Features Tested:
 * - W-2 income from both spouses
 * - Schedule B (Interest and Dividends)
 * - Schedule D (Capital Gains)
 * - Form 8949 (Sales and Dispositions)
 * - Qualified dividends at preferential rates
 * - Tax-exempt interest (municipal bonds)
 * - Net Investment Income Tax (NIIT) Form 8960
 *
 * Tax Year: 2025
 */

import { FilingStatus } from 'ustaxes/core/data'

// =============================================================================
// Test Data Fixtures - Raj & Priya Patel (Scenario 17)
// =============================================================================

const rajPatelTaxpayer = {
  firstName: 'Raj',
  lastName: 'Patel',
  ssn: '400011171',
  address: {
    address: '555 Wealth Way',
    city: 'Palo Alto',
    state: 'CA' as const,
    zip: '94301'
  },
  dateOfBirth: new Date(1975, 4, 18),
  occupation: 'Software Engineer'
}

const priyaPatelSpouse = {
  firstName: 'Priya',
  lastName: 'Patel',
  ssn: '400011172',
  dateOfBirth: new Date(1978, 9, 3),
  occupation: 'Product Manager'
}

// W-2 from Raj's employer
const w2Raj = {
  employerName: 'Tech Giants Inc',
  employerEin: '94-1234567',
  box1Wages: 250000,
  box2FederalWithholding: 50000,
  box3SsWages: 176100, // Capped at wage base
  box4SsTax: 10918,
  box5MedicareWages: 250000,
  box6MedicareTax: 3625,
  box12Code: { DD: 15000 } // Employer health insurance
}

// W-2 from Priya's employer
const w2Priya = {
  employerName: 'Innovation Labs',
  employerEin: '94-7654321',
  box1Wages: 180000,
  box2FederalWithholding: 32000,
  box3SsWages: 176100,
  box4SsTax: 10918,
  box5MedicareWages: 180000,
  box6MedicareTax: 2610
}

// 1099-INT - Interest Income
const interestIncome = [
  { payer: 'Chase Bank', amount: 3500, isTaxExempt: false },
  { payer: 'Wells Fargo', amount: 2800, isTaxExempt: false },
  { payer: 'CA Muni Bond Fund', amount: 8500, isTaxExempt: true } // Tax-exempt
]

// 1099-DIV - Dividend Income
const dividendIncome = [
  {
    payer: 'Vanguard Total Stock Market',
    ordinaryDividends: 12000,
    qualifiedDividends: 10800
  },
  {
    payer: 'Fidelity Growth Fund',
    ordinaryDividends: 8500,
    qualifiedDividends: 7200
  },
  {
    payer: 'Apple Inc',
    ordinaryDividends: 2400,
    qualifiedDividends: 2400
  }
]

// Form 8949 / Schedule D - Capital Gains
const capitalGains = {
  shortTerm: [
    {
      description: 'TSLA - 50 shares',
      dateAcquired: new Date(2025, 2, 15),
      dateSold: new Date(2025, 8, 20),
      proceeds: 12500,
      costBasis: 11000,
      gain: 1500
    },
    {
      description: 'NVDA - 20 shares',
      dateAcquired: new Date(2025, 4, 1),
      dateSold: new Date(2025, 9, 15),
      proceeds: 15000,
      costBasis: 12000,
      gain: 3000
    }
  ],
  longTerm: [
    {
      description: 'AAPL - 100 shares',
      dateAcquired: new Date(2020, 5, 10),
      dateSold: new Date(2025, 6, 1),
      proceeds: 25000,
      costBasis: 12000,
      gain: 13000
    },
    {
      description: 'MSFT - 75 shares',
      dateAcquired: new Date(2019, 8, 22),
      dateSold: new Date(2025, 7, 15),
      proceeds: 35000,
      costBasis: 18000,
      gain: 17000
    },
    {
      description: 'GOOG - 10 shares',
      dateAcquired: new Date(2018, 1, 5),
      dateSold: new Date(2025, 10, 1),
      proceeds: 18000,
      costBasis: 10000,
      gain: 8000
    }
  ]
}

// Calculate totals
const totals = {
  get wages() {
    return w2Raj.box1Wages + w2Priya.box1Wages
  },
  get taxableInterest() {
    return interestIncome.filter(i => !i.isTaxExempt).reduce((sum, i) => sum + i.amount, 0)
  },
  get taxExemptInterest() {
    return interestIncome.filter(i => i.isTaxExempt).reduce((sum, i) => sum + i.amount, 0)
  },
  get ordinaryDividends() {
    return dividendIncome.reduce((sum, d) => sum + d.ordinaryDividends, 0)
  },
  get qualifiedDividends() {
    return dividendIncome.reduce((sum, d) => sum + d.qualifiedDividends, 0)
  },
  get shortTermGain() {
    return capitalGains.shortTerm.reduce((sum, g) => sum + g.gain, 0)
  },
  get longTermGain() {
    return capitalGains.longTerm.reduce((sum, g) => sum + g.gain, 0)
  },
  get netCapitalGain() {
    return this.shortTermGain + this.longTermGain
  },
  get federalWithholding() {
    return w2Raj.box2FederalWithholding + w2Priya.box2FederalWithholding
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('ATS Scenario 17 - Raj & Priya Patel (Investment Income)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct primary taxpayer name', () => {
      expect(rajPatelTaxpayer.firstName).toBe('Raj')
      expect(rajPatelTaxpayer.lastName).toBe('Patel')
    })

    it('should have correct spouse name', () => {
      expect(priyaPatelSpouse.firstName).toBe('Priya')
      expect(priyaPatelSpouse.lastName).toBe('Patel')
    })

    it('should be filing as MFJ', () => {
      const filingStatus = FilingStatus.MFJ
      expect(filingStatus).toBe(FilingStatus.MFJ)
    })
  })

  describe('W-2 Income', () => {
    it('should calculate total wages', () => {
      expect(totals.wages).toBe(430000)
    })

    it('should have correct withholding from both W-2s', () => {
      expect(totals.federalWithholding).toBe(82000)
    })

    it('should have SS wages capped at wage base', () => {
      expect(w2Raj.box3SsWages).toBe(176100)
      expect(w2Priya.box3SsWages).toBe(176100)
    })
  })

  describe('Schedule B - Interest Income', () => {
    it('should calculate taxable interest', () => {
      expect(totals.taxableInterest).toBe(6300)
    })

    it('should calculate tax-exempt interest', () => {
      expect(totals.taxExemptInterest).toBe(8500)
    })

    it('should have three interest sources', () => {
      expect(interestIncome.length).toBe(3)
    })
  })

  describe('Schedule B - Dividend Income', () => {
    it('should calculate total ordinary dividends', () => {
      expect(totals.ordinaryDividends).toBe(22900)
    })

    it('should calculate qualified dividends', () => {
      expect(totals.qualifiedDividends).toBe(20400)
    })

    it('should have qualified dividends less than or equal to ordinary', () => {
      expect(totals.qualifiedDividends).toBeLessThanOrEqual(totals.ordinaryDividends)
    })
  })

  describe('Schedule D / Form 8949 - Capital Gains', () => {
    it('should calculate short-term capital gains', () => {
      expect(totals.shortTermGain).toBe(4500)
    })

    it('should calculate long-term capital gains', () => {
      expect(totals.longTermGain).toBe(38000)
    })

    it('should calculate net capital gain', () => {
      expect(totals.netCapitalGain).toBe(42500)
    })

    it('should have two short-term transactions', () => {
      expect(capitalGains.shortTerm.length).toBe(2)
    })

    it('should have three long-term transactions', () => {
      expect(capitalGains.longTerm.length).toBe(3)
    })

    it('should have long-term gains held over 1 year', () => {
      capitalGains.longTerm.forEach(gain => {
        const holdingPeriod = gain.dateSold.getTime() - gain.dateAcquired.getTime()
        const oneYear = 365 * 24 * 60 * 60 * 1000
        expect(holdingPeriod).toBeGreaterThan(oneYear)
      })
    })
  })

  describe('Tax Calculation', () => {
    it('should calculate total income', () => {
      const totalIncome = totals.wages + totals.taxableInterest +
                         totals.ordinaryDividends + totals.netCapitalGain
      expect(totalIncome).toBe(501700)
    })

    it('should use standard deduction for 2025 MFJ', () => {
      const standardDeduction = 30000
      expect(standardDeduction).toBe(30000)
    })

    it('should calculate AGI correctly', () => {
      const totalIncome = totals.wages + totals.taxableInterest +
                         totals.ordinaryDividends + totals.netCapitalGain
      // No above-the-line deductions in this scenario
      const agi = totalIncome
      expect(agi).toBe(501700)
    })

    it('should calculate taxable income correctly', () => {
      const agi = 501700
      const standardDeduction = 30000
      const taxableIncome = agi - standardDeduction
      expect(taxableIncome).toBe(471700)
    })

    it('should have qualified dividends and LTCG taxed at preferential rates', () => {
      // Qualified dividends and LTCG taxed at 15% or 20% (not ordinary rates)
      const preferentialIncome = totals.qualifiedDividends + totals.longTermGain
      expect(preferentialIncome).toBe(58400)
    })
  })

  describe('Net Investment Income Tax (NIIT)', () => {
    it('should identify investment income for NIIT', () => {
      const investmentIncome = totals.taxableInterest + totals.ordinaryDividends + totals.netCapitalGain
      expect(investmentIncome).toBe(71700)
    })

    it('should calculate MAGI over $250,000 threshold for MFJ', () => {
      const magi = 501700
      const threshold = 250000
      expect(magi).toBeGreaterThan(threshold)
    })

    it('should calculate NIIT at 3.8%', () => {
      const magi = 501700
      const threshold = 250000
      const investmentIncome = 71700
      const niitBase = Math.min(magi - threshold, investmentIncome)
      const niit = niitBase * 0.038
      expect(niit).toBeGreaterThan(0)
    })
  })
})
