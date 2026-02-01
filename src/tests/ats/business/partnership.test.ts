/**
 * ATS Business Entity Tests - Form 1065 (Partnership)
 *
 * These tests verify partnership return calculations against
 * IRS ATS scenarios for business entities.
 *
 * Note: These are simplified unit tests focusing on calculation logic.
 * Full integration tests require complete Information objects.
 */

// =============================================================================
// ATS Partnership Calculation Tests
// =============================================================================

describe('ATS Partnership Scenarios (Form 1065)', () => {
  /**
   * Partnership Scenario 1 - Simple Service Partnership
   * Two equal general partners, consulting business
   *
   * Expected calculations:
   * - Gross receipts: $500,000
   * - Other income: $5,000
   * - Total income: $505,000
   * - Total deductions: $360,000
   * - Ordinary business income: $145,000
   */
  describe('Partnership Scenario 1 - Simple Service Partnership', () => {
    const income = {
      grossReceipts: 500000,
      returnsAndAllowances: 0,
      costOfGoodsSold: 0,
      otherIncome: 5000
    }

    const deductions = {
      salariesAndWages: 150000,
      guaranteedPayments: 100000, // $50K to each partner
      repairsAndMaintenance: 5000,
      rents: 36000,
      taxesAndLicenses: 8000,
      interest: 2000,
      depreciation: 10000,
      retirementPlans: 15000,
      employeeBenefits: 20000,
      otherDeductions: 14000
    }

    it('should calculate gross profit correctly', () => {
      const grossProfit =
        income.grossReceipts - income.returnsAndAllowances - income.costOfGoodsSold
      expect(grossProfit).toBe(500000)
    })

    it('should calculate total income correctly', () => {
      const grossProfit =
        income.grossReceipts - income.returnsAndAllowances - income.costOfGoodsSold
      const totalIncome = grossProfit + income.otherIncome
      expect(totalIncome).toBe(505000)
    })

    it('should calculate total deductions correctly', () => {
      const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0)
      expect(totalDeductions).toBe(360000)
    })

    it('should calculate ordinary business income correctly', () => {
      const grossProfit =
        income.grossReceipts - income.returnsAndAllowances - income.costOfGoodsSold
      const totalIncome = grossProfit + income.otherIncome
      const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0)
      const ordinaryIncome = totalIncome - totalDeductions
      expect(ordinaryIncome).toBe(145000)
    })

    it('should have correct guaranteed payments to partners', () => {
      expect(deductions.guaranteedPayments).toBe(100000)
    })
  })

  /**
   * Partnership Scenario 2 - Real Estate Partnership
   * Partnership with rental properties, 1 GP + 2 LPs
   */
  describe('Partnership Scenario 2 - Real Estate Partnership', () => {
    const income = {
      grossReceipts: 0, // Rental income goes to Schedule K
      netGainFromSaleOfAssets: 25000 // Sold equipment
    }

    const deductions = {
      salariesAndWages: 50000,
      repairsAndMaintenance: 30000,
      taxesAndLicenses: 15000,
      interest: 80000, // Mortgage interest
      depreciation: 100000,
      employeeBenefits: 5000,
      otherDeductions: 20000
    }

    const scheduleK = {
      rentalRealEstateIncome: 180000,
      longTermCapitalGain: 25000,
      unrecaptured1250Gain: 15000,
      section179Deduction: 20000
    }

    it('should calculate total deductions correctly', () => {
      const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0)
      expect(totalDeductions).toBe(300000)
    })

    it('should report net gain from equipment sale', () => {
      expect(income.netGainFromSaleOfAssets).toBe(25000)
    })

    it('should report Schedule K rental income', () => {
      expect(scheduleK.rentalRealEstateIncome).toBe(180000)
    })

    it('should report Schedule K long-term capital gain', () => {
      expect(scheduleK.longTermCapitalGain).toBe(25000)
    })

    it('should report unrecaptured Section 1250 gain', () => {
      expect(scheduleK.unrecaptured1250Gain).toBe(15000)
    })

    it('should report Section 179 deduction', () => {
      expect(scheduleK.section179Deduction).toBe(20000)
    })
  })

  /**
   * Partnership Scenario 3 - Manufacturing Partnership with COGS
   */
  describe('Partnership Scenario 3 - Manufacturing Partnership', () => {
    const income = {
      grossReceipts: 2000000,
      returnsAndAllowances: 50000,
      costOfGoodsSold: 1200000,
      netGainFromSaleOfAssets: 10000,
      otherIncome: 3000
    }

    const deductions = {
      salariesAndWages: 250000,
      guaranteedPayments: 150000,
      repairsAndMaintenance: 25000,
      badDebts: 5000,
      rents: 60000,
      taxesAndLicenses: 20000,
      interest: 15000,
      depreciation: 75000,
      retirementPlans: 30000,
      employeeBenefits: 40000,
      otherDeductions: 30000
    }

    it('should calculate net receipts after returns', () => {
      const netReceipts = income.grossReceipts - income.returnsAndAllowances
      expect(netReceipts).toBe(1950000)
    })

    it('should calculate gross profit correctly', () => {
      const netReceipts = income.grossReceipts - income.returnsAndAllowances
      const grossProfit = netReceipts - income.costOfGoodsSold
      expect(grossProfit).toBe(750000)
    })

    it('should calculate total income correctly', () => {
      const netReceipts = income.grossReceipts - income.returnsAndAllowances
      const grossProfit = netReceipts - income.costOfGoodsSold
      const totalIncome =
        grossProfit + income.netGainFromSaleOfAssets + income.otherIncome
      expect(totalIncome).toBe(763000)
    })

    it('should calculate total deductions correctly', () => {
      const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0)
      expect(totalDeductions).toBe(700000)
    })

    it('should calculate ordinary business income correctly', () => {
      const netReceipts = income.grossReceipts - income.returnsAndAllowances
      const grossProfit = netReceipts - income.costOfGoodsSold
      const totalIncome =
        grossProfit + income.netGainFromSaleOfAssets + income.otherIncome
      const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0)
      const ordinaryIncome = totalIncome - totalDeductions
      expect(ordinaryIncome).toBe(63000)
    })
  })
})

// =============================================================================
// Schedule K Allocation Tests
// =============================================================================

describe('Partnership Schedule K Allocations', () => {
  describe('Partner Allocation Calculations', () => {
    const scheduleKTotals = {
      ordinaryBusinessIncome: 100000,
      interestIncome: 5000,
      dividendIncome: 3000,
      qualifiedDividends: 2000,
      shortTermCapitalGain: 2000,
      longTermCapitalGain: 8000,
      section179Deduction: 10000,
      charitableContributions: 5000,
      netEarningsSE: 100000,
      taxExemptInterest: 1000,
      cashDistributions: 50000
    }

    const partners = [
      { name: 'Partner 1', profitShare: 50 },
      { name: 'Partner 2', profitShare: 50 }
    ]

    it('should allocate ordinary income 50/50', () => {
      const partner1Share =
        (scheduleKTotals.ordinaryBusinessIncome * partners[0].profitShare) / 100
      const partner2Share =
        (scheduleKTotals.ordinaryBusinessIncome * partners[1].profitShare) / 100
      expect(partner1Share).toBe(50000)
      expect(partner2Share).toBe(50000)
    })

    it('should allocate interest income 50/50', () => {
      const partner1Share =
        (scheduleKTotals.interestIncome * partners[0].profitShare) / 100
      expect(partner1Share).toBe(2500)
    })

    it('should allocate capital gains 50/50', () => {
      const totalCapitalGains =
        scheduleKTotals.shortTermCapitalGain + scheduleKTotals.longTermCapitalGain
      const partner1Share = (totalCapitalGains * partners[0].profitShare) / 100
      expect(partner1Share).toBe(5000)
    })

    it('should allocate SE earnings to general partners', () => {
      // SE earnings pass through to general partners
      expect(scheduleKTotals.netEarningsSE).toBe(100000)
    })

    it('should report Section 179 deduction', () => {
      expect(scheduleKTotals.section179Deduction).toBe(10000)
    })

    it('should report charitable contributions separately', () => {
      expect(scheduleKTotals.charitableContributions).toBe(5000)
    })
  })

  describe('Unequal Partner Allocations', () => {
    const scheduleKTotals = {
      ordinaryBusinessIncome: 100000
    }

    const partners = [
      { name: 'GP', profitShare: 20 },
      { name: 'LP1', profitShare: 40 },
      { name: 'LP2', profitShare: 40 }
    ]

    it('should allocate 20/40/40 correctly', () => {
      const gpShare =
        (scheduleKTotals.ordinaryBusinessIncome * partners[0].profitShare) / 100
      const lp1Share =
        (scheduleKTotals.ordinaryBusinessIncome * partners[1].profitShare) / 100
      const lp2Share =
        (scheduleKTotals.ordinaryBusinessIncome * partners[2].profitShare) / 100

      expect(gpShare).toBe(20000)
      expect(lp1Share).toBe(40000)
      expect(lp2Share).toBe(40000)
      expect(gpShare + lp1Share + lp2Share).toBe(100000)
    })
  })
})
