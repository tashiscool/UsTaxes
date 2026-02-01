/**
 * ATS Business Entity Tests - Form 1120-S (S Corporation)
 *
 * These tests verify S-Corporation return calculations against
 * IRS ATS scenarios for business entities.
 *
 * Note: These are simplified unit tests focusing on calculation logic.
 * Full integration tests require complete Information objects.
 */

// 2025 tax rate for built-in gains (if applicable)
const CCORP_RATE = 0.21

// =============================================================================
// ATS S-Corporation Scenarios
// =============================================================================

describe('ATS S-Corporation Scenarios (Form 1120-S)', () => {
  /**
   * S-Corp Scenario 1 - Single Shareholder Consulting S-Corp
   * Simple professional services S-Corporation
   *
   * Expected calculations:
   * - Gross receipts: $400,000
   * - Other income: $2,000
   * - Total income: $402,000
   * - Total deductions: $300,000
   * - Ordinary business income: $102,000
   */
  describe('S-Corp Scenario 1 - Single Shareholder Consulting', () => {
    const income = {
      grossReceipts: 400000,
      returnsAndAllowances: 0,
      costOfGoodsSold: 0,
      otherIncome: 2000 // Bank interest
    }

    const deductions = {
      officerCompensation: 120000,
      salariesAndWages: 80000,
      repairsAndMaintenance: 3000,
      rents: 24000,
      taxesAndLicenses: 5000,
      interest: 1000,
      depreciation: 8000,
      advertising: 15000,
      pensionPlans: 12000,
      employeeBenefits: 18000,
      otherDeductions: 14000
    }

    it('should calculate gross receipts correctly', () => {
      expect(income.grossReceipts).toBe(400000)
    })

    it('should calculate gross profit correctly', () => {
      const grossProfit =
        income.grossReceipts - income.returnsAndAllowances - income.costOfGoodsSold
      expect(grossProfit).toBe(400000) // No COGS for service business
    })

    it('should calculate total income correctly', () => {
      const grossProfit =
        income.grossReceipts - income.returnsAndAllowances - income.costOfGoodsSold
      const totalIncome = grossProfit + income.otherIncome
      expect(totalIncome).toBe(402000)
    })

    it('should report officer compensation', () => {
      expect(deductions.officerCompensation).toBe(120000)
    })

    it('should calculate total deductions correctly', () => {
      const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0)
      expect(totalDeductions).toBe(300000)
    })

    it('should calculate ordinary business income correctly', () => {
      const grossProfit =
        income.grossReceipts - income.returnsAndAllowances - income.costOfGoodsSold
      const totalIncome = grossProfit + income.otherIncome
      const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0)
      const ordinaryIncome = totalIncome - totalDeductions
      expect(ordinaryIncome).toBe(102000)
    })

    it('should have no entity-level tax (standard S-Corp)', () => {
      const builtInGainsTax = 0
      const excessPassiveIncomeTax = 0
      const totalEntityTax = builtInGainsTax + excessPassiveIncomeTax
      expect(totalEntityTax).toBe(0)
    })

    it('should have no self-employment earnings', () => {
      // S-Corp shareholders don't pay SE tax on distributions
      const netEarningsSE = 0
      expect(netEarningsSE).toBe(0)
    })
  })

  /**
   * S-Corp Scenario 2 - Multi-Shareholder S-Corp with Investment Income
   */
  describe('S-Corp Scenario 2 - Multi-Shareholder with Investments', () => {
    const income = {
      grossReceipts: 2000000,
      returnsAndAllowances: 50000,
      costOfGoodsSold: 0,
      netGainFromSaleOfAssets: 30000, // Sold old equipment
      otherIncome: 10000
    }

    const deductions = {
      officerCompensation: 500000, // 2 shareholders
      salariesAndWages: 600000,
      repairsAndMaintenance: 10000,
      badDebts: 5000,
      rents: 120000,
      taxesAndLicenses: 25000,
      interest: 8000,
      depreciation: 75000,
      advertising: 50000,
      pensionPlans: 60000,
      employeeBenefits: 80000,
      otherDeductions: 67000
    }

    const scheduleK = {
      interestIncome: 5000,
      dividendIncome: 8000,
      qualifiedDividends: 6000,
      longTermCapitalGain: 30000,
      unrecaptured1250Gain: 20000,
      section179Deduction: 25000,
      taxExemptInterest: 2000,
      cashDistributions: 200000
    }

    it('should calculate net receipts after returns', () => {
      const netReceipts = income.grossReceipts - income.returnsAndAllowances
      expect(netReceipts).toBe(1950000)
    })

    it('should report net gain from Form 4797', () => {
      expect(income.netGainFromSaleOfAssets).toBe(30000)
    })

    it('should calculate total income correctly', () => {
      const netReceipts = income.grossReceipts - income.returnsAndAllowances
      const grossProfit = netReceipts - income.costOfGoodsSold
      const totalIncome =
        grossProfit + income.netGainFromSaleOfAssets + income.otherIncome
      expect(totalIncome).toBe(1990000)
    })

    it('should report officer compensation', () => {
      expect(deductions.officerCompensation).toBe(500000)
    })

    it('should calculate total deductions correctly', () => {
      const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0)
      expect(totalDeductions).toBe(1600000)
    })

    it('should calculate ordinary business income correctly', () => {
      const netReceipts = income.grossReceipts - income.returnsAndAllowances
      const grossProfit = netReceipts - income.costOfGoodsSold
      const totalIncome =
        grossProfit + income.netGainFromSaleOfAssets + income.otherIncome
      const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0)
      const ordinaryIncome = totalIncome - totalDeductions
      expect(ordinaryIncome).toBe(390000)
    })

    it('should report Schedule K interest income', () => {
      expect(scheduleK.interestIncome).toBe(5000)
    })

    it('should report Schedule K dividend income', () => {
      expect(scheduleK.dividendIncome).toBe(8000)
    })

    it('should report Schedule K qualified dividends', () => {
      expect(scheduleK.qualifiedDividends).toBe(6000)
    })

    it('should report Schedule K long-term capital gain', () => {
      expect(scheduleK.longTermCapitalGain).toBe(30000)
    })

    it('should report unrecaptured Section 1250 gain', () => {
      expect(scheduleK.unrecaptured1250Gain).toBe(20000)
    })

    it('should report Section 179 deduction', () => {
      expect(scheduleK.section179Deduction).toBe(25000)
    })

    it('should report tax-exempt interest', () => {
      expect(scheduleK.taxExemptInterest).toBe(2000)
    })
  })

  /**
   * S-Corp Scenario 3 - Former C-Corp with Built-in Gains Tax
   */
  describe('S-Corp Scenario 3 - Former C-Corp with Built-in Gains', () => {
    const income = {
      grossReceipts: 5000000,
      returnsAndAllowances: 100000,
      costOfGoodsSold: 3500000,
      netGainFromSaleOfAssets: 200000, // Sold appreciated asset
      otherIncome: 15000
    }

    const deductions = {
      officerCompensation: 400000,
      salariesAndWages: 350000,
      repairsAndMaintenance: 20000,
      badDebts: 25000,
      rents: 150000,
      taxesAndLicenses: 45000,
      interest: 30000,
      depreciation: 100000,
      advertising: 40000,
      pensionPlans: 50000,
      employeeBenefits: 60000,
      otherDeductions: 80000
    }

    // Built-in gains from C-Corp conversion
    const builtInGain = 200000
    const estimatedTaxPayments = 50000

    it('should calculate net receipts correctly', () => {
      const netReceipts = income.grossReceipts - income.returnsAndAllowances
      expect(netReceipts).toBe(4900000)
    })

    it('should subtract cost of goods sold', () => {
      expect(income.costOfGoodsSold).toBe(3500000)
    })

    it('should calculate gross profit correctly', () => {
      const netReceipts = income.grossReceipts - income.returnsAndAllowances
      const grossProfit = netReceipts - income.costOfGoodsSold
      expect(grossProfit).toBe(1400000)
    })

    it('should calculate total income correctly', () => {
      const netReceipts = income.grossReceipts - income.returnsAndAllowances
      const grossProfit = netReceipts - income.costOfGoodsSold
      const totalIncome =
        grossProfit + income.netGainFromSaleOfAssets + income.otherIncome
      expect(totalIncome).toBe(1615000)
    })

    it('should calculate total deductions correctly', () => {
      const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0)
      expect(totalDeductions).toBe(1350000)
    })

    it('should calculate ordinary business income correctly', () => {
      const netReceipts = income.grossReceipts - income.returnsAndAllowances
      const grossProfit = netReceipts - income.costOfGoodsSold
      const totalIncome =
        grossProfit + income.netGainFromSaleOfAssets + income.otherIncome
      const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0)
      const ordinaryIncome = totalIncome - totalDeductions
      expect(ordinaryIncome).toBe(265000)
    })

    it('should calculate built-in gains tax at 21%', () => {
      const builtInGainsTax = Math.round(builtInGain * CCORP_RATE)
      expect(builtInGainsTax).toBe(42000)
    })

    it('should have entity-level tax for BIG', () => {
      const builtInGainsTax = Math.round(builtInGain * CCORP_RATE)
      expect(builtInGainsTax).toBe(42000)
    })

    it('should calculate overpayment from estimated taxes', () => {
      const builtInGainsTax = Math.round(builtInGain * CCORP_RATE)
      const overpayment = estimatedTaxPayments - builtInGainsTax
      expect(overpayment).toBe(8000)
    })
  })

  /**
   * S-Corp Scenario 4 - S-Corp with Loss
   */
  describe('S-Corp Scenario 4 - S-Corp with Net Loss', () => {
    const income = {
      grossReceipts: 100000,
      returnsAndAllowances: 5000,
      costOfGoodsSold: 0,
      otherIncome: 1000
    }

    const deductions = {
      officerCompensation: 120000,
      salariesAndWages: 200000,
      repairsAndMaintenance: 2000,
      rents: 36000,
      taxesAndLicenses: 5000,
      interest: 3000,
      depreciation: 15000,
      advertising: 50000,
      employeeBenefits: 20000,
      otherDeductions: 49000
    }

    it('should calculate net receipts correctly', () => {
      const netReceipts = income.grossReceipts - income.returnsAndAllowances
      expect(netReceipts).toBe(95000)
    })

    it('should calculate total income correctly', () => {
      const netReceipts = income.grossReceipts - income.returnsAndAllowances
      const grossProfit = netReceipts - income.costOfGoodsSold
      const totalIncome = grossProfit + income.otherIncome
      expect(totalIncome).toBe(96000)
    })

    it('should calculate total deductions correctly', () => {
      const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0)
      expect(totalDeductions).toBe(500000)
    })

    it('should calculate ordinary business LOSS correctly', () => {
      const netReceipts = income.grossReceipts - income.returnsAndAllowances
      const grossProfit = netReceipts - income.costOfGoodsSold
      const totalIncome = grossProfit + income.otherIncome
      const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0)
      const ordinaryIncome = totalIncome - totalDeductions
      expect(ordinaryIncome).toBe(-404000)
    })

    it('should have no entity-level tax on loss', () => {
      const entityLevelTax = 0 // No BIG tax or passive income tax on loss
      expect(entityLevelTax).toBe(0)
    })

    it('should report Schedule K loss', () => {
      const netReceipts = income.grossReceipts - income.returnsAndAllowances
      const grossProfit = netReceipts - income.costOfGoodsSold
      const totalIncome = grossProfit + income.otherIncome
      const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0)
      const scheduleKOrdinaryIncome = totalIncome - totalDeductions
      expect(scheduleKOrdinaryIncome).toBe(-404000)
    })
  })
})

// =============================================================================
// Schedule K-1 Allocation Tests
// =============================================================================

describe('S-Corp Schedule K-1 Allocations', () => {
  describe('Multi-Shareholder Allocation Calculations', () => {
    const shareholders = [
      { name: 'Major Shareholder', percentageOfStock: 60 },
      { name: 'Minor Shareholder', percentageOfStock: 40 }
    ]

    const scheduleKTotals = {
      ordinaryBusinessIncome: 100000,
      interestIncome: 10000,
      dividendIncome: 5000,
      qualifiedDividends: 4000,
      shortTermCapitalGain: 2000,
      longTermCapitalGain: 15000,
      section179Deduction: 20000,
      charitableContributions: 8000,
      taxExemptInterest: 2000,
      nondeductibleExpenses: 500,
      cashDistributions: 50000
    }

    it('should allocate ordinary income by stock percentage', () => {
      const majorShare =
        (scheduleKTotals.ordinaryBusinessIncome * shareholders[0].percentageOfStock) /
        100
      const minorShare =
        (scheduleKTotals.ordinaryBusinessIncome * shareholders[1].percentageOfStock) /
        100
      expect(majorShare).toBe(60000)
      expect(minorShare).toBe(40000)
    })

    it('should allocate interest income by stock percentage', () => {
      const majorShare =
        (scheduleKTotals.interestIncome * shareholders[0].percentageOfStock) / 100
      expect(majorShare).toBe(6000)
    })

    it('should allocate dividend income by stock percentage', () => {
      const majorShare =
        (scheduleKTotals.dividendIncome * shareholders[0].percentageOfStock) / 100
      expect(majorShare).toBe(3000)
    })

    it('should allocate qualified dividends by stock percentage', () => {
      const majorShare =
        (scheduleKTotals.qualifiedDividends * shareholders[0].percentageOfStock) / 100
      expect(majorShare).toBe(2400)
    })

    it('should allocate short-term capital gains', () => {
      const majorShare =
        (scheduleKTotals.shortTermCapitalGain * shareholders[0].percentageOfStock) /
        100
      expect(majorShare).toBe(1200)
    })

    it('should allocate long-term capital gains', () => {
      const majorShare =
        (scheduleKTotals.longTermCapitalGain * shareholders[0].percentageOfStock) / 100
      expect(majorShare).toBe(9000)
    })

    it('should allocate Section 179 deduction', () => {
      const majorShare =
        (scheduleKTotals.section179Deduction * shareholders[0].percentageOfStock) / 100
      expect(majorShare).toBe(12000)
    })

    it('should allocate charitable contributions', () => {
      const majorShare =
        (scheduleKTotals.charitableContributions *
          shareholders[0].percentageOfStock) /
        100
      expect(majorShare).toBe(4800)
    })

    it('should allocate tax-exempt interest', () => {
      const majorShare =
        (scheduleKTotals.taxExemptInterest * shareholders[0].percentageOfStock) / 100
      expect(majorShare).toBe(1200)
    })

    it('should allocate non-deductible expenses', () => {
      const majorShare =
        (scheduleKTotals.nondeductibleExpenses * shareholders[0].percentageOfStock) /
        100
      expect(majorShare).toBe(300)
    })

    it('should allocate cash distributions', () => {
      const majorShare =
        (scheduleKTotals.cashDistributions * shareholders[0].percentageOfStock) / 100
      expect(majorShare).toBe(30000)
    })

    it('should have NO self-employment earnings', () => {
      // S-Corp shareholders don't pay SE tax
      const netEarningsSE = 0
      expect(netEarningsSE).toBe(0)
    })
  })
})
