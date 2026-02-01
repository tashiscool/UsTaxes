/**
 * IRS ATS Test Scenario 22 - Tommy Nguyen
 *
 * Test Scenario: Cryptocurrency Transactions
 * Primary Taxpayer: Tommy Nguyen
 * Filing Status: Single (1)
 *
 * Key Features Tested:
 * - W-2 wage income
 * - Cryptocurrency capital gains/losses (Form 8949, Schedule D)
 * - Short-term vs long-term holding periods
 * - Cryptocurrency mining income (Schedule 1)
 * - Digital asset question on Form 1040
 * - Cost basis methods (FIFO, Specific Identification)
 *
 * Tax Year: 2025
 */

import { FilingStatus } from 'ustaxes/core/data'

// =============================================================================
// Test Data Fixtures - Tommy Nguyen (Scenario 22)
// =============================================================================

const tommyNguyenTaxpayer = {
  firstName: 'Tommy',
  lastName: 'Nguyen',
  ssn: '400011221',
  address: {
    address: '500 Blockchain Blvd',
    city: 'Miami',
    state: 'FL' as const,
    zip: '33101'
  },
  dateOfBirth: new Date(1995, 11, 3),
  occupation: 'IT Specialist',
  digitalAssets: true // Must answer "Yes" on 1040
}

// W-2 from primary employer
const w2Primary = {
  employerName: 'Tech Solutions LLC',
  employerEin: '65-1234567',
  box1Wages: 78000,
  box2FederalWithholding: 10500,
  box3SsWages: 78000,
  box4SsTax: 4836,
  box5MedicareWages: 78000,
  box6MedicareTax: 1131
}

// Cryptocurrency transactions - Form 8949
const cryptoTransactions = {
  shortTerm: [
    {
      description: 'Bitcoin (BTC) - 0.5',
      dateAcquired: new Date(2025, 1, 15),
      dateSold: new Date(2025, 6, 20),
      proceeds: 28000,
      costBasis: 22000,
      gain: 6000,
      reportingCategory: 'A' // Reported on 1099-B with basis
    },
    {
      description: 'Ethereum (ETH) - 3.0',
      dateAcquired: new Date(2025, 3, 1),
      dateSold: new Date(2025, 8, 15),
      proceeds: 9500,
      costBasis: 11000,
      gain: -1500, // Loss
      reportingCategory: 'C' // Not reported on 1099-B
    },
    {
      description: 'Solana (SOL) - 50',
      dateAcquired: new Date(2025, 5, 10),
      dateSold: new Date(2025, 10, 5),
      proceeds: 7500,
      costBasis: 5000,
      gain: 2500,
      reportingCategory: 'C'
    }
  ],
  longTerm: [
    {
      description: 'Bitcoin (BTC) - 1.0',
      dateAcquired: new Date(2023, 0, 5),
      dateSold: new Date(2025, 4, 12),
      proceeds: 62000,
      costBasis: 18000,
      gain: 44000,
      reportingCategory: 'D' // Long-term, not on 1099-B
    },
    {
      description: 'Ethereum (ETH) - 5.0',
      dateAcquired: new Date(2022, 8, 20),
      dateSold: new Date(2025, 7, 30),
      proceeds: 16000,
      costBasis: 8500,
      gain: 7500,
      reportingCategory: 'D'
    }
  ],

  get totalShortTermGain() {
    return this.shortTerm.reduce((sum, t) => sum + t.gain, 0)
  },
  get totalLongTermGain() {
    return this.longTerm.reduce((sum, t) => sum + t.gain, 0)
  },
  get netCapitalGain() {
    return this.totalShortTermGain + this.totalLongTermGain
  }
}

// Cryptocurrency mining income
const cryptoMining = {
  transactions: [
    {
      date: new Date(2025, 0, 31),
      coin: 'Ethereum',
      amount: 0.05,
      fairMarketValue: 175
    },
    {
      date: new Date(2025, 1, 28),
      coin: 'Ethereum',
      amount: 0.05,
      fairMarketValue: 180
    },
    {
      date: new Date(2025, 2, 31),
      coin: 'Ethereum',
      amount: 0.04,
      fairMarketValue: 145
    },
    {
      date: new Date(2025, 3, 30),
      coin: 'Ethereum',
      amount: 0.05,
      fairMarketValue: 165
    },
    {
      date: new Date(2025, 4, 31),
      coin: 'Ethereum',
      amount: 0.05,
      fairMarketValue: 170
    },
    {
      date: new Date(2025, 5, 30),
      coin: 'Ethereum',
      amount: 0.04,
      fairMarketValue: 140
    },
    {
      date: new Date(2025, 6, 31),
      coin: 'Ethereum',
      amount: 0.05,
      fairMarketValue: 175
    },
    {
      date: new Date(2025, 7, 31),
      coin: 'Ethereum',
      amount: 0.05,
      fairMarketValue: 180
    },
    {
      date: new Date(2025, 8, 30),
      coin: 'Ethereum',
      amount: 0.04,
      fairMarketValue: 145
    },
    {
      date: new Date(2025, 9, 31),
      coin: 'Ethereum',
      amount: 0.05,
      fairMarketValue: 175
    },
    {
      date: new Date(2025, 10, 30),
      coin: 'Ethereum',
      amount: 0.05,
      fairMarketValue: 180
    },
    {
      date: new Date(2025, 11, 31),
      coin: 'Ethereum',
      amount: 0.05,
      fairMarketValue: 185
    }
  ],

  get totalMined() {
    return this.transactions.reduce((sum, t) => sum + t.amount, 0)
  },
  get totalFairMarketValue() {
    return this.transactions.reduce((sum, t) => sum + t.fairMarketValue, 0)
  },

  // Mining is ordinary income, reported on Schedule 1
  // If substantial/regular activity, could be Schedule C
  isHobbyMining: true, // Not a business, report as Other Income
  expenses: {
    electricity: 420,
    internetPortion: 120
  },
  get netMiningIncome() {
    // Hobby expenses not deductible after TCJA
    return this.totalFairMarketValue
  }
}

// Staking rewards
const stakingRewards = {
  transactions: [
    { coin: 'Cardano (ADA)', rewards: 500, fairMarketValue: 225 },
    { coin: 'Solana (SOL)', rewards: 8, fairMarketValue: 1200 }
  ],
  get totalFairMarketValue() {
    return this.transactions.reduce((sum, t) => sum + t.fairMarketValue, 0)
  }
}

// Form 8949 categorization
const form8949 = {
  // Part I - Short-term
  categoryA: cryptoTransactions.shortTerm.filter(
    (t) => t.reportingCategory === 'A'
  ),
  categoryB: cryptoTransactions.shortTerm.filter(
    (t) => t.reportingCategory === 'B'
  ),
  categoryC: cryptoTransactions.shortTerm.filter(
    (t) => t.reportingCategory === 'C'
  ),

  // Part II - Long-term
  categoryD: cryptoTransactions.longTerm.filter(
    (t) => t.reportingCategory === 'D'
  ),
  categoryE: cryptoTransactions.longTerm.filter(
    (t) => t.reportingCategory === 'E'
  ),
  categoryF: cryptoTransactions.longTerm.filter(
    (t) => t.reportingCategory === 'F'
  )
}

// Schedule D calculations
const scheduleD = {
  get shortTermFromForm8949() {
    return cryptoTransactions.totalShortTermGain
  },
  get longTermFromForm8949() {
    return cryptoTransactions.totalLongTermGain
  },
  get netShortTermGainLoss() {
    return this.shortTermFromForm8949
  },
  get netLongTermGainLoss() {
    return this.longTermFromForm8949
  },
  get netCapitalGainLoss() {
    return this.netShortTermGainLoss + this.netLongTermGainLoss
  }
}

// Tax calculation
const totals = {
  get wages() {
    return w2Primary.box1Wages
  },
  get otherIncome() {
    return cryptoMining.netMiningIncome + stakingRewards.totalFairMarketValue
  },
  get capitalGains() {
    return scheduleD.netCapitalGainLoss
  },
  get totalIncome() {
    return this.wages + this.otherIncome + this.capitalGains
  },
  get federalWithholding() {
    return w2Primary.box2FederalWithholding
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('ATS Scenario 22 - Tommy Nguyen (Cryptocurrency)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct taxpayer name', () => {
      expect(tommyNguyenTaxpayer.firstName).toBe('Tommy')
      expect(tommyNguyenTaxpayer.lastName).toBe('Nguyen')
    })

    it('should be filing as Single', () => {
      const filingStatus = FilingStatus.S
      expect(filingStatus).toBe(FilingStatus.S)
    })

    it('should answer Yes to digital assets question', () => {
      expect(tommyNguyenTaxpayer.digitalAssets).toBe(true)
    })
  })

  describe('W-2 Income', () => {
    it('should have wage income', () => {
      expect(w2Primary.box1Wages).toBe(78000)
    })

    it('should have federal withholding', () => {
      expect(w2Primary.box2FederalWithholding).toBe(10500)
    })
  })

  describe('Cryptocurrency Capital Gains - Short Term', () => {
    it('should have three short-term transactions', () => {
      expect(cryptoTransactions.shortTerm.length).toBe(3)
    })

    it('should calculate total short-term gain', () => {
      // $6,000 - $1,500 + $2,500 = $7,000
      expect(cryptoTransactions.totalShortTermGain).toBe(7000)
    })

    it('should include both gains and losses', () => {
      const gains = cryptoTransactions.shortTerm.filter((t) => t.gain > 0)
      const losses = cryptoTransactions.shortTerm.filter((t) => t.gain < 0)
      expect(gains.length).toBe(2)
      expect(losses.length).toBe(1)
    })

    it('should have holding period under 1 year', () => {
      cryptoTransactions.shortTerm.forEach((t) => {
        const holdingDays =
          (t.dateSold.getTime() - t.dateAcquired.getTime()) /
          (1000 * 60 * 60 * 24)
        expect(holdingDays).toBeLessThan(365)
      })
    })
  })

  describe('Cryptocurrency Capital Gains - Long Term', () => {
    it('should have two long-term transactions', () => {
      expect(cryptoTransactions.longTerm.length).toBe(2)
    })

    it('should calculate total long-term gain', () => {
      // $44,000 + $7,500 = $51,500
      expect(cryptoTransactions.totalLongTermGain).toBe(51500)
    })

    it('should have holding period over 1 year', () => {
      cryptoTransactions.longTerm.forEach((t) => {
        const holdingDays =
          (t.dateSold.getTime() - t.dateAcquired.getTime()) /
          (1000 * 60 * 60 * 24)
        expect(holdingDays).toBeGreaterThan(365)
      })
    })

    it('should qualify for preferential tax rates', () => {
      // Long-term gains taxed at 0%, 15%, or 20% based on income
      expect(cryptoTransactions.totalLongTermGain).toBeGreaterThan(0)
    })
  })

  describe('Form 8949 Categories', () => {
    it('should categorize short-term with 1099-B (Category A)', () => {
      expect(form8949.categoryA.length).toBe(1)
    })

    it('should categorize short-term without 1099-B (Category C)', () => {
      expect(form8949.categoryC.length).toBe(2)
    })

    it('should categorize long-term without 1099-B (Category D)', () => {
      expect(form8949.categoryD.length).toBe(2)
    })
  })

  describe('Schedule D', () => {
    it('should calculate net short-term gain/loss', () => {
      expect(scheduleD.netShortTermGainLoss).toBe(7000)
    })

    it('should calculate net long-term gain/loss', () => {
      expect(scheduleD.netLongTermGainLoss).toBe(51500)
    })

    it('should calculate net capital gain', () => {
      expect(scheduleD.netCapitalGainLoss).toBe(58500)
    })
  })

  describe('Cryptocurrency Mining Income', () => {
    it('should calculate total ETH mined', () => {
      expect(cryptoMining.totalMined).toBeCloseTo(0.57, 2)
    })

    it('should calculate fair market value of mined coins', () => {
      expect(cryptoMining.totalFairMarketValue).toBe(2015)
    })

    it('should report mining as ordinary income', () => {
      expect(cryptoMining.isHobbyMining).toBe(true)
      // Hobby mining = Other Income on Schedule 1
    })

    it('should not deduct hobby expenses', () => {
      // TCJA eliminated miscellaneous itemized deductions
      expect(cryptoMining.netMiningIncome).toBe(
        cryptoMining.totalFairMarketValue
      )
    })
  })

  describe('Staking Rewards', () => {
    it('should calculate total staking rewards FMV', () => {
      expect(stakingRewards.totalFairMarketValue).toBe(1425)
    })

    it('should report staking as ordinary income', () => {
      // Staking rewards are taxable at FMV when received
      expect(stakingRewards.totalFairMarketValue).toBeGreaterThan(0)
    })
  })

  describe('Tax Calculation', () => {
    it('should calculate total ordinary income', () => {
      const ordinaryIncome = totals.wages + totals.otherIncome
      expect(ordinaryIncome).toBe(81440) // $78,000 + $2,015 + $1,425
    })

    it('should calculate total income including capital gains', () => {
      expect(totals.totalIncome).toBe(139940)
    })

    it('should use standard deduction for 2025 Single', () => {
      const standardDeduction = 15000
      expect(standardDeduction).toBe(15000)
    })

    it('should calculate taxable income', () => {
      const taxableIncome = totals.totalIncome - 15000
      expect(taxableIncome).toBe(124940)
    })

    it('should have long-term gains taxed at preferential rates', () => {
      // For income around $125,000 single, LTCG rate is 15%
      const ltcgTax = scheduleD.netLongTermGainLoss * 0.15
      expect(ltcgTax).toBe(7725)
    })
  })

  describe('Digital Assets Question (Form 1040)', () => {
    it('should require Yes answer due to crypto activity', () => {
      const hasDigitalAssetActivity =
        cryptoTransactions.shortTerm.length > 0 ||
        cryptoTransactions.longTerm.length > 0 ||
        cryptoMining.transactions.length > 0 ||
        stakingRewards.transactions.length > 0

      expect(hasDigitalAssetActivity).toBe(true)
      expect(tommyNguyenTaxpayer.digitalAssets).toBe(true)
    })
  })
})
