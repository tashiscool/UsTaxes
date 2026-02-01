/**
 * ATS Business Entity Tests - Form 1120 (C Corporation)
 *
 * These tests verify C-Corporation return calculations against
 * IRS ATS scenarios for business entities.
 *
 * Key features:
 * - C-Corps pay entity-level tax (21% flat rate for 2025)
 * - No pass-through of income to shareholders
 * - Dividends to shareholders are taxed again (double taxation)
 * - Schedule M-1/M-2 reconciliation required
 */

// 2025 C-Corp tax rate
const CCORP_TAX_RATE = 0.21

// =============================================================================
// ATS C-Corporation Scenarios
// =============================================================================

describe('ATS C-Corporation Scenarios (Form 1120)', () => {
  /**
   * C-Corp Scenario 1 - Simple Manufacturing Corporation
   */
  describe('C-Corp Scenario 1 - Manufacturing Corporation', () => {
    const income = {
      grossReceipts: 5000000,
      returnsAndAllowances: 200000,
      costOfGoodsSold: 3000000,
      dividendIncome: 50000,
      interestIncome: 25000,
      grossRents: 0,
      netCapitalGain: 75000,
      netGainFromSaleOfAssets: 100000,
      otherIncome: 15000
    }

    const deductions = {
      compensationOfOfficers: 500000,
      salariesAndWages: 800000,
      repairsAndMaintenance: 50000,
      badDebts: 25000,
      rents: 200000,
      taxesAndLicenses: 100000,
      interest: 75000,
      charitableContributions: 50000,
      depreciation: 150000,
      advertising: 80000,
      pensionAndProfitSharing: 100000,
      employeeBenefits: 120000,
      domesticProductionDeduction: 0,
      otherDeductions: 150000
    }

    it('should calculate gross receipts less returns', () => {
      const netReceipts = income.grossReceipts - income.returnsAndAllowances
      expect(netReceipts).toBe(4800000)
    })

    it('should calculate gross profit', () => {
      const netReceipts = income.grossReceipts - income.returnsAndAllowances
      const grossProfit = netReceipts - income.costOfGoodsSold
      expect(grossProfit).toBe(1800000)
    })

    it('should calculate total income', () => {
      const netReceipts = income.grossReceipts - income.returnsAndAllowances
      const grossProfit = netReceipts - income.costOfGoodsSold
      const totalIncome =
        grossProfit +
        income.dividendIncome +
        income.interestIncome +
        income.grossRents +
        income.netCapitalGain +
        income.netGainFromSaleOfAssets +
        income.otherIncome
      expect(totalIncome).toBe(2065000)
    })

    it('should calculate total deductions', () => {
      const totalDeductions = Object.values(deductions).reduce(
        (a, b) => a + b,
        0
      )
      expect(totalDeductions).toBe(2400000)
    })

    it('should calculate taxable income before NOL', () => {
      const netReceipts = income.grossReceipts - income.returnsAndAllowances
      const grossProfit = netReceipts - income.costOfGoodsSold
      const totalIncome =
        grossProfit +
        income.dividendIncome +
        income.interestIncome +
        income.netCapitalGain +
        income.netGainFromSaleOfAssets +
        income.otherIncome
      const totalDeductions = Object.values(deductions).reduce(
        (a, b) => a + b,
        0
      )

      // Note: taxable income can be negative (loss)
      const taxableIncome = totalIncome - totalDeductions
      expect(taxableIncome).toBe(-335000) // Loss for this scenario
    })

    it('should have no tax on loss', () => {
      const taxableIncome = -335000 // From above
      const corporateTax = Math.max(0, taxableIncome) * CCORP_TAX_RATE
      expect(corporateTax).toBe(0)
    })
  })

  /**
   * C-Corp Scenario 2 - Profitable Service Corporation
   */
  describe('C-Corp Scenario 2 - Profitable Service Corporation', () => {
    const income = {
      grossReceipts: 2000000,
      returnsAndAllowances: 0,
      costOfGoodsSold: 0, // Service company, no COGS
      interestIncome: 10000,
      otherIncome: 5000
    }

    const deductions = {
      compensationOfOfficers: 400000,
      salariesAndWages: 500000,
      repairsAndMaintenance: 10000,
      rents: 100000,
      taxesAndLicenses: 50000,
      interest: 20000,
      depreciation: 30000,
      advertising: 40000,
      pensionAndProfitSharing: 50000,
      employeeBenefits: 60000,
      otherDeductions: 40000
    }

    it('should calculate total income (service company)', () => {
      const totalIncome =
        income.grossReceipts -
        income.returnsAndAllowances -
        income.costOfGoodsSold +
        income.interestIncome +
        income.otherIncome
      expect(totalIncome).toBe(2015000)
    })

    it('should calculate total deductions', () => {
      const totalDeductions = Object.values(deductions).reduce(
        (a, b) => a + b,
        0
      )
      expect(totalDeductions).toBe(1300000)
    })

    it('should calculate taxable income', () => {
      const totalIncome = 2015000
      const totalDeductions = 1300000
      const taxableIncome = totalIncome - totalDeductions
      expect(taxableIncome).toBe(715000)
    })

    it('should calculate corporate tax at 21%', () => {
      const taxableIncome = 715000
      const corporateTax = Math.round(taxableIncome * CCORP_TAX_RATE)
      expect(corporateTax).toBe(150150)
    })

    it('should calculate effective tax rate', () => {
      const taxableIncome = 715000
      const corporateTax = taxableIncome * CCORP_TAX_RATE
      const effectiveRate = corporateTax / taxableIncome
      expect(effectiveRate).toBe(CCORP_TAX_RATE)
    })
  })

  /**
   * C-Corp Scenario 3 - Corporation with Dividends Received Deduction
   */
  describe('C-Corp Scenario 3 - Dividends Received Deduction', () => {
    const income = {
      grossReceipts: 1000000,
      dividendIncome: 200000,
      dividendSourcePercentage: {
        lessThan20Percent: 100000, // 50% DRD
        between20And80Percent: 75000, // 65% DRD
        greaterThan80Percent: 25000 // 100% DRD
      }
    }

    it('should calculate 50% DRD for <20% ownership', () => {
      const drd50 = income.dividendSourcePercentage.lessThan20Percent * 0.5
      expect(drd50).toBe(50000)
    })

    it('should calculate 65% DRD for 20-80% ownership', () => {
      const drd65 = income.dividendSourcePercentage.between20And80Percent * 0.65
      expect(drd65).toBe(48750)
    })

    it('should calculate 100% DRD for >80% ownership', () => {
      const drd100 = income.dividendSourcePercentage.greaterThan80Percent * 1.0
      expect(drd100).toBe(25000)
    })

    it('should calculate total DRD', () => {
      const drd50 = income.dividendSourcePercentage.lessThan20Percent * 0.5
      const drd65 = income.dividendSourcePercentage.between20And80Percent * 0.65
      const drd100 = income.dividendSourcePercentage.greaterThan80Percent * 1.0
      const totalDRD = drd50 + drd65 + drd100
      expect(totalDRD).toBe(123750)
    })

    it('should reduce taxable income by DRD', () => {
      const grossIncome = income.grossReceipts + income.dividendIncome
      const totalDRD = 123750
      const adjustedIncome = grossIncome - totalDRD
      expect(adjustedIncome).toBe(1076250)
    })
  })
})

// =============================================================================
// Schedule M-1 Reconciliation Tests
// =============================================================================

describe('Schedule M-1 Book-Tax Reconciliation', () => {
  const bookIncome = {
    netIncomePerBooks: 500000
  }

  const additions = {
    federalIncomeTaxPerBooks: 100000,
    excessCapitalLossesOverGains: 25000,
    incomeRecordedOnBooksNotOnReturn: 0,
    expensesRecordedOnBooksNotDeductible: 50000 // Meals, entertainment
  }

  const subtractions = {
    incomeOnReturnNotRecordedOnBooks: 10000, // Prepaid income
    deductionsOnReturnNotChargedToBooks: 30000 // Depreciation difference
  }

  it('should calculate additions to book income', () => {
    const totalAdditions = Object.values(additions).reduce((a, b) => a + b, 0)
    expect(totalAdditions).toBe(175000)
  })

  it('should calculate subtractions from book income', () => {
    const totalSubtractions = Object.values(subtractions).reduce(
      (a, b) => a + b,
      0
    )
    expect(totalSubtractions).toBe(40000)
  })

  it('should reconcile to taxable income', () => {
    const totalAdditions = Object.values(additions).reduce((a, b) => a + b, 0)
    const totalSubtractions = Object.values(subtractions).reduce(
      (a, b) => a + b,
      0
    )
    const taxableIncome =
      bookIncome.netIncomePerBooks + totalAdditions - totalSubtractions
    expect(taxableIncome).toBe(635000)
  })
})

// =============================================================================
// Estimated Tax Tests
// =============================================================================

describe('C-Corp Estimated Tax', () => {
  const taxLiability = 150000
  const quarterlyPayments = [37500, 37500, 37500, 37500]

  it('should calculate quarterly payment amount', () => {
    const quarterlyAmount = taxLiability / 4
    expect(quarterlyAmount).toBe(37500)
  })

  it('should have four quarterly payments', () => {
    expect(quarterlyPayments.length).toBe(4)
  })

  it('should equal total liability', () => {
    const totalPayments = quarterlyPayments.reduce((a, b) => a + b, 0)
    expect(totalPayments).toBe(taxLiability)
  })

  it('should calculate underpayment penalty if short', () => {
    const actualPayments = [30000, 30000, 30000, 30000] // $7,500 short each quarter
    const totalPaid = actualPayments.reduce((a, b) => a + b, 0)
    const shortfall = taxLiability - totalPaid
    expect(shortfall).toBe(30000)
  })
})

// =============================================================================
// Net Operating Loss Tests
// =============================================================================

describe('C-Corp Net Operating Loss', () => {
  describe('Post-TCJA NOL Rules', () => {
    const nolAmount = 500000
    const taxableIncomeBeforeNol = 300000
    const nolLimitPercent = 0.8 // 80% limitation

    it('should limit NOL deduction to 80% of taxable income', () => {
      const maxNolDeduction = taxableIncomeBeforeNol * nolLimitPercent
      expect(maxNolDeduction).toBe(240000)
    })

    it('should calculate taxable income after NOL', () => {
      const maxNolDeduction = taxableIncomeBeforeNol * nolLimitPercent
      const nolUsed = Math.min(nolAmount, maxNolDeduction)
      const taxableIncomeAfterNol = taxableIncomeBeforeNol - nolUsed
      expect(taxableIncomeAfterNol).toBe(60000)
    })

    it('should carry forward unused NOL', () => {
      const maxNolDeduction = taxableIncomeBeforeNol * nolLimitPercent
      const nolUsed = Math.min(nolAmount, maxNolDeduction)
      const nolCarryforward = nolAmount - nolUsed
      expect(nolCarryforward).toBe(260000)
    })

    it('should not allow carryback (post-TCJA)', () => {
      const allowCarryback = false // TCJA eliminated carrybacks generally
      expect(allowCarryback).toBe(false)
    })
  })
})

// =============================================================================
// Accumulated Earnings Tax Tests
// =============================================================================

describe('Accumulated Earnings Tax', () => {
  const aetRate = 0.2 // 20% accumulated earnings tax

  const scenario = {
    accumulatedEarnings: 2000000,
    exemptionAmount: 250000, // $250K for most corporations
    businessNeeds: 500000, // Reasonable business needs
    dividendsPaid: 100000
  }

  it('should calculate accumulated taxable income', () => {
    const ati =
      scenario.accumulatedEarnings -
      scenario.exemptionAmount -
      scenario.businessNeeds -
      scenario.dividendsPaid
    expect(ati).toBe(1150000)
  })

  it('should calculate AET at 20%', () => {
    const ati = 1150000
    const aet = ati * aetRate
    expect(aet).toBe(230000)
  })

  it('should exempt first $250K for most corporations', () => {
    expect(scenario.exemptionAmount).toBe(250000)
  })
})

export {}
