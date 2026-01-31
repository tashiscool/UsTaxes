/**
 * Tax Planning Calculator Engine
 * Calculates tax for arbitrary inputs independent of redux state
 */

import { FilingStatus } from 'ustaxes/core/data'

// Tax brackets for 2024 (can be extended for other years)
export interface TaxBrackets {
  rates: number[]
  brackets: number[]
}

export interface FederalTaxData {
  ordinary: { [key in FilingStatus]: TaxBrackets }
  longTermCapGains: { [key in FilingStatus]: TaxBrackets }
  standardDeduction: { [key in FilingStatus]: number }
}

// 2024 Federal Tax Data
export const federalTaxData2024: FederalTaxData = {
  ordinary: {
    [FilingStatus.S]: {
      rates: [10, 12, 22, 24, 32, 35, 37],
      brackets: [0, 11600, 47150, 100525, 191950, 243725, 609350]
    },
    [FilingStatus.MFJ]: {
      rates: [10, 12, 22, 24, 32, 35, 37],
      brackets: [0, 23200, 94300, 201050, 383900, 487450, 731200]
    },
    [FilingStatus.MFS]: {
      rates: [10, 12, 22, 24, 32, 35, 37],
      brackets: [0, 11600, 47150, 100525, 191950, 243725, 365600]
    },
    [FilingStatus.HOH]: {
      rates: [10, 12, 22, 24, 32, 35, 37],
      brackets: [0, 16550, 63100, 100500, 191950, 243700, 609350]
    },
    [FilingStatus.W]: {
      rates: [10, 12, 22, 24, 32, 35, 37],
      brackets: [0, 23200, 94300, 201050, 383900, 487450, 731200]
    }
  },
  longTermCapGains: {
    [FilingStatus.S]: {
      rates: [0, 15, 20],
      brackets: [0, 47025, 518900]
    },
    [FilingStatus.MFJ]: {
      rates: [0, 15, 20],
      brackets: [0, 94050, 583750]
    },
    [FilingStatus.MFS]: {
      rates: [0, 15, 20],
      brackets: [0, 47025, 291850]
    },
    [FilingStatus.HOH]: {
      rates: [0, 15, 20],
      brackets: [0, 63000, 551350]
    },
    [FilingStatus.W]: {
      rates: [0, 15, 20],
      brackets: [0, 94050, 583750]
    }
  },
  standardDeduction: {
    [FilingStatus.S]: 14600,
    [FilingStatus.MFJ]: 29200,
    [FilingStatus.MFS]: 14600,
    [FilingStatus.HOH]: 21900,
    [FilingStatus.W]: 29200
  }
}

// 2025 Federal Tax Data (projected with ~2.5% inflation adjustment)
export const federalTaxData2025: FederalTaxData = {
  ordinary: {
    [FilingStatus.S]: {
      rates: [10, 12, 22, 24, 32, 35, 37],
      brackets: [0, 11925, 48475, 103350, 197300, 250525, 626350]
    },
    [FilingStatus.MFJ]: {
      rates: [10, 12, 22, 24, 32, 35, 37],
      brackets: [0, 23850, 96950, 206700, 394600, 501050, 751600]
    },
    [FilingStatus.MFS]: {
      rates: [10, 12, 22, 24, 32, 35, 37],
      brackets: [0, 11925, 48475, 103350, 197300, 250525, 375800]
    },
    [FilingStatus.HOH]: {
      rates: [10, 12, 22, 24, 32, 35, 37],
      brackets: [0, 17000, 64850, 103350, 197300, 250275, 626350]
    },
    [FilingStatus.W]: {
      rates: [10, 12, 22, 24, 32, 35, 37],
      brackets: [0, 23850, 96950, 206700, 394600, 501050, 751600]
    }
  },
  longTermCapGains: {
    [FilingStatus.S]: {
      rates: [0, 15, 20],
      brackets: [0, 48350, 533400]
    },
    [FilingStatus.MFJ]: {
      rates: [0, 15, 20],
      brackets: [0, 96700, 600050]
    },
    [FilingStatus.MFS]: {
      rates: [0, 15, 20],
      brackets: [0, 48350, 300000]
    },
    [FilingStatus.HOH]: {
      rates: [0, 15, 20],
      brackets: [0, 64750, 566700]
    },
    [FilingStatus.W]: {
      rates: [0, 15, 20],
      brackets: [0, 96700, 600050]
    }
  },
  standardDeduction: {
    [FilingStatus.S]: 15000,
    [FilingStatus.MFJ]: 30000,
    [FilingStatus.MFS]: 15000,
    [FilingStatus.HOH]: 22500,
    [FilingStatus.W]: 30000
  }
}

export interface TaxInputs {
  filingStatus: FilingStatus
  wages: number
  interestIncome: number
  dividendIncome: number
  qualifiedDividends: number
  shortTermCapitalGains: number
  longTermCapitalGains: number
  otherIncome: number
  adjustments: {
    iraContribution: number
    hsaContribution: number
    studentLoanInterest: number
    selfEmploymentTax: number
    otherAdjustments: number
  }
  deductions: {
    useItemized: boolean
    itemizedAmount: number
  }
  credits: {
    childTaxCredit: number
    earnedIncomeCredit: number
    educationCredits: number
    otherCredits: number
  }
  payments: {
    federalWithholding: number
    estimatedPayments: number
  }
  dependents: number
  year: number
}

export interface TaxBreakdown {
  grossIncome: number
  adjustedGrossIncome: number
  taxableIncome: number
  ordinaryIncomeTax: number
  capitalGainsTax: number
  totalTaxBeforeCredits: number
  totalCredits: number
  totalTax: number
  effectiveTaxRate: number
  marginalTaxRate: number
  totalPayments: number
  refundOrOwed: number
  bracketBreakdown: BracketBreakdown[]
}

export interface BracketBreakdown {
  rate: number
  incomeInBracket: number
  taxInBracket: number
}

/**
 * Calculate tax for a given bracket structure
 */
export function calculateBracketTax(
  income: number,
  brackets: TaxBrackets
): { tax: number; breakdown: BracketBreakdown[]; marginalRate: number } {
  const { rates, brackets: thresholds } = brackets
  let remainingIncome = income
  let totalTax = 0
  const breakdown: BracketBreakdown[] = []
  let marginalRate = rates[0]

  for (let i = 0; i < rates.length; i++) {
    const rate = rates[i] / 100
    const bracketStart = thresholds[i]
    const bracketEnd = thresholds[i + 1] ?? Infinity

    if (remainingIncome <= 0) break

    const bracketSize = bracketEnd - bracketStart
    const incomeInBracket = Math.min(remainingIncome, bracketSize)
    const taxInBracket = incomeInBracket * rate

    if (incomeInBracket > 0) {
      breakdown.push({
        rate: rates[i],
        incomeInBracket,
        taxInBracket
      })
      marginalRate = rates[i]
    }

    totalTax += taxInBracket
    remainingIncome -= incomeInBracket
  }

  return { tax: totalTax, breakdown, marginalRate }
}

/**
 * Get federal tax data for a given year
 */
export function getFederalTaxData(year: number): FederalTaxData {
  if (year >= 2025) {
    return federalTaxData2025
  }
  return federalTaxData2024
}

/**
 * Calculate IRA contribution limits
 */
export function getIRAContributionLimit(year: number, age: number): number {
  const baseLimit = year >= 2025 ? 7000 : 7000
  const catchUpLimit = age >= 50 ? 1000 : 0
  return baseLimit + catchUpLimit
}

/**
 * Calculate HSA contribution limits
 */
export function getHSAContributionLimit(
  year: number,
  coverageType: 'self-only' | 'family',
  age: number
): number {
  const baseLimits = {
    'self-only': year >= 2025 ? 4300 : 4150,
    family: year >= 2025 ? 8550 : 8300
  }
  const catchUpLimit = age >= 55 ? 1000 : 0
  return baseLimits[coverageType] + catchUpLimit
}

/**
 * Calculate Child Tax Credit
 */
export function calculateChildTaxCredit(
  agi: number,
  filingStatus: FilingStatus,
  qualifyingChildren: number,
  year: number
): number {
  const creditPerChild = year >= 2025 ? 2000 : 2000
  const maxCredit = qualifyingChildren * creditPerChild

  // Phase-out thresholds
  const phaseOutThreshold =
    filingStatus === FilingStatus.MFJ ? 400000 : 200000

  if (agi <= phaseOutThreshold) {
    return maxCredit
  }

  // $50 reduction per $1000 over threshold
  const reduction = Math.floor((agi - phaseOutThreshold) / 1000) * 50
  return Math.max(0, maxCredit - reduction)
}

/**
 * Calculate Earned Income Credit (simplified)
 */
export function calculateEarnedIncomeCredit(
  earnedIncome: number,
  agi: number,
  filingStatus: FilingStatus,
  qualifyingChildren: number
  // year parameter reserved for future year-specific thresholds
): number {
  // Simplified EIC calculation - actual calculation is more complex
  if (filingStatus === FilingStatus.MFS) {
    return 0 // MFS not eligible
  }

  const maxCredits2024 = [600, 3995, 6604, 7430]
  const incomeThresholds2024Single = [18591, 49084, 55768, 59899]
  const incomeThresholds2024MFJ = [25511, 56004, 62688, 66819]

  const childIndex = Math.min(qualifyingChildren, 3)
  const maxCredit = maxCredits2024[childIndex]
  const threshold =
    filingStatus === FilingStatus.MFJ
      ? incomeThresholds2024MFJ[childIndex]
      : incomeThresholds2024Single[childIndex]

  const testIncome = Math.max(earnedIncome, agi)

  if (testIncome > threshold) {
    return 0
  }

  // Simplified phase-in/phase-out calculation
  const phaseInEnd = childIndex === 0 ? 7840 : childIndex === 1 ? 11750 : 16510
  const plateauEnd = childIndex === 0 ? 9800 : 21560

  if (earnedIncome <= phaseInEnd) {
    return (earnedIncome / phaseInEnd) * maxCredit
  } else if (testIncome <= plateauEnd) {
    return maxCredit
  } else {
    const phaseOutRate = maxCredit / (threshold - plateauEnd)
    return Math.max(0, maxCredit - (testIncome - plateauEnd) * phaseOutRate)
  }
}

/**
 * Main tax calculation function
 */
export function calculateTax(inputs: TaxInputs): TaxBreakdown {
  const taxData = getFederalTaxData(inputs.year)
  const { filingStatus } = inputs

  // Calculate gross income
  const grossIncome =
    inputs.wages +
    inputs.interestIncome +
    inputs.dividendIncome +
    inputs.shortTermCapitalGains +
    inputs.longTermCapitalGains +
    inputs.otherIncome

  // Calculate adjustments (above-the-line deductions)
  const totalAdjustments =
    inputs.adjustments.iraContribution +
    inputs.adjustments.hsaContribution +
    inputs.adjustments.studentLoanInterest +
    inputs.adjustments.selfEmploymentTax * 0.5 +
    inputs.adjustments.otherAdjustments

  // Calculate AGI
  const adjustedGrossIncome = Math.max(0, grossIncome - totalAdjustments)

  // Calculate deductions
  const standardDeduction = taxData.standardDeduction[filingStatus]
  const deduction = inputs.deductions.useItemized
    ? Math.max(inputs.deductions.itemizedAmount, standardDeduction)
    : standardDeduction

  // Calculate QBI deduction (simplified - 20% of qualified business income, capped)
  const qbiDeduction = 0 // Simplified - would need more inputs for actual calculation

  // Calculate taxable income
  const taxableIncome = Math.max(
    0,
    adjustedGrossIncome - deduction - qbiDeduction
  )

  // Calculate ordinary income (excluding qualified dividends and long-term capital gains)
  const preferentialIncome =
    inputs.qualifiedDividends + Math.max(0, inputs.longTermCapitalGains)
  const ordinaryTaxableIncome = Math.max(0, taxableIncome - preferentialIncome)

  // Calculate ordinary income tax
  const ordinaryTaxResult = calculateBracketTax(
    ordinaryTaxableIncome,
    taxData.ordinary[filingStatus]
  )

  // Calculate capital gains tax (on preferential income)
  const capitalGainsTaxResult = calculateBracketTax(
    preferentialIncome,
    taxData.longTermCapGains[filingStatus]
  )

  // Total tax before credits
  const totalTaxBeforeCredits =
    ordinaryTaxResult.tax + capitalGainsTaxResult.tax

  // Calculate credits
  const totalCredits =
    inputs.credits.childTaxCredit +
    inputs.credits.earnedIncomeCredit +
    inputs.credits.educationCredits +
    inputs.credits.otherCredits

  // Calculate total tax
  const totalTax = Math.max(0, totalTaxBeforeCredits - totalCredits)

  // Calculate effective and marginal rates
  const effectiveTaxRate =
    taxableIncome > 0 ? (totalTax / taxableIncome) * 100 : 0
  const marginalTaxRate = ordinaryTaxResult.marginalRate

  // Calculate total payments
  const totalPayments =
    inputs.payments.federalWithholding + inputs.payments.estimatedPayments

  // Calculate refund or amount owed
  const refundOrOwed = totalPayments - totalTax

  return {
    grossIncome,
    adjustedGrossIncome,
    taxableIncome,
    ordinaryIncomeTax: ordinaryTaxResult.tax,
    capitalGainsTax: capitalGainsTaxResult.tax,
    totalTaxBeforeCredits,
    totalCredits,
    totalTax,
    effectiveTaxRate,
    marginalTaxRate,
    totalPayments,
    refundOrOwed,
    bracketBreakdown: ordinaryTaxResult.breakdown
  }
}

/**
 * Calculate safe harbor amount for estimated taxes
 */
export function calculateSafeHarbor(
  priorYearTax: number,
  priorYearAGI: number,
  currentYearTax: number
): { safeHarborAmount: number; quarterlyPayment: number; method: string } {
  // 100% of prior year tax (110% if AGI > $150k)
  const priorYearThreshold = priorYearAGI > 150000 ? 1.1 : 1.0
  const priorYearSafeHarbor = priorYearTax * priorYearThreshold

  // 90% of current year tax
  const currentYearSafeHarbor = currentYearTax * 0.9

  // Use the lower amount
  const safeHarborAmount = Math.min(priorYearSafeHarbor, currentYearSafeHarbor)
  const method =
    safeHarborAmount === priorYearSafeHarbor
      ? `${priorYearThreshold * 100}% of prior year tax`
      : '90% of current year tax'

  return {
    safeHarborAmount,
    quarterlyPayment: safeHarborAmount / 4,
    method
  }
}

/**
 * Calculate potential tax savings from various strategies
 */
export interface TaxSavingOpportunity {
  strategy: string
  description: string
  potentialSavings: number
  requiredAction: string
  additionalContribution?: number
}

export function calculateTaxSavingOpportunities(
  currentInputs: TaxInputs,
  currentBreakdown: TaxBreakdown
): TaxSavingOpportunity[] {
  const opportunities: TaxSavingOpportunity[] = []
  const marginalRate = currentBreakdown.marginalTaxRate / 100

  // IRA contribution opportunity
  const iraLimit = getIRAContributionLimit(currentInputs.year, 50) // Assume 50 for max
  const currentIra = currentInputs.adjustments.iraContribution
  if (currentIra < iraLimit) {
    const additionalContribution = iraLimit - currentIra
    const potentialSavings = additionalContribution * marginalRate
    opportunities.push({
      strategy: 'Maximize IRA Contribution',
      description: `You can contribute an additional $${additionalContribution.toLocaleString()} to your Traditional IRA`,
      potentialSavings,
      requiredAction: `Contribute $${additionalContribution.toLocaleString()} more to your Traditional IRA before the tax deadline`,
      additionalContribution
    })
  }

  // HSA contribution opportunity
  const hsaLimit = getHSAContributionLimit(currentInputs.year, 'family', 55)
  const currentHsa = currentInputs.adjustments.hsaContribution
  if (currentHsa < hsaLimit) {
    const additionalContribution = hsaLimit - currentHsa
    const potentialSavings = additionalContribution * marginalRate
    opportunities.push({
      strategy: 'Maximize HSA Contribution',
      description: `You can contribute an additional $${additionalContribution.toLocaleString()} to your HSA (family coverage, 55+)`,
      potentialSavings,
      requiredAction: `Increase HSA contributions by $${additionalContribution.toLocaleString()}`,
      additionalContribution
    })
  }

  // Check if itemizing might be beneficial
  const taxData = getFederalTaxData(currentInputs.year)
  const standardDeduction = taxData.standardDeduction[currentInputs.filingStatus]
  if (
    !currentInputs.deductions.useItemized &&
    currentInputs.deductions.itemizedAmount > standardDeduction * 0.8
  ) {
    const potentialAdditional =
      standardDeduction - currentInputs.deductions.itemizedAmount
    if (potentialAdditional < 5000) {
      opportunities.push({
        strategy: 'Consider Itemizing Deductions',
        description: `Your itemized deductions are close to the standard deduction. Consider bunching deductions to exceed $${standardDeduction.toLocaleString()}`,
        potentialSavings: potentialAdditional * marginalRate,
        requiredAction: `Track additional deductible expenses like charitable contributions, medical expenses, or state taxes`
      })
    }
  }

  // Tax-loss harvesting opportunity
  if (currentInputs.longTermCapitalGains > 3000) {
    const harvestableAmount = Math.min(
      currentInputs.longTermCapitalGains,
      10000
    )
    opportunities.push({
      strategy: 'Tax-Loss Harvesting',
      description: `Consider selling investments at a loss to offset capital gains`,
      potentialSavings: harvestableAmount * 0.15, // Assuming 15% LTCG rate
      requiredAction: `Review your portfolio for positions with unrealized losses`
    })
  }

  // Withholding adjustment
  if (currentBreakdown.refundOrOwed > 5000) {
    opportunities.push({
      strategy: 'Adjust W-4 Withholding',
      description: `You're overpaying taxes throughout the year. Consider adjusting your W-4 to keep more money in your paycheck`,
      potentialSavings: currentBreakdown.refundOrOwed * 0.05, // Opportunity cost
      requiredAction: `Submit a new W-4 to your employer to reduce withholding`
    })
  } else if (currentBreakdown.refundOrOwed < -1000) {
    opportunities.push({
      strategy: 'Increase W-4 Withholding',
      description: `You may owe ${Math.abs(currentBreakdown.refundOrOwed).toLocaleString()} at tax time. Consider increasing withholding to avoid penalties`,
      potentialSavings: 0,
      requiredAction: `Submit a new W-4 to your employer to increase withholding`
    })
  }

  return opportunities.sort((a, b) => b.potentialSavings - a.potentialSavings)
}

/**
 * Project next year's taxes based on current data with inflation adjustments
 */
export function projectNextYearTax(
  currentInputs: TaxInputs,
  inflationRate = 0.025,
  incomeGrowthRate = 0.03
): { projectedInputs: TaxInputs; projectedBreakdown: TaxBreakdown } {
  const projectedInputs: TaxInputs = {
    ...currentInputs,
    year: currentInputs.year + 1,
    wages: currentInputs.wages * (1 + incomeGrowthRate),
    interestIncome: currentInputs.interestIncome * (1 + inflationRate),
    dividendIncome: currentInputs.dividendIncome * (1 + inflationRate),
    qualifiedDividends: currentInputs.qualifiedDividends * (1 + inflationRate),
    shortTermCapitalGains: currentInputs.shortTermCapitalGains,
    longTermCapitalGains: currentInputs.longTermCapitalGains,
    otherIncome: currentInputs.otherIncome * (1 + inflationRate),
    adjustments: {
      ...currentInputs.adjustments,
      iraContribution:
        currentInputs.adjustments.iraContribution * (1 + inflationRate),
      hsaContribution:
        currentInputs.adjustments.hsaContribution * (1 + inflationRate)
    },
    deductions: {
      ...currentInputs.deductions,
      itemizedAmount:
        currentInputs.deductions.itemizedAmount * (1 + inflationRate)
    },
    payments: {
      federalWithholding:
        currentInputs.payments.federalWithholding * (1 + incomeGrowthRate),
      estimatedPayments: currentInputs.payments.estimatedPayments
    }
  }

  const projectedBreakdown = calculateTax(projectedInputs)

  return { projectedInputs, projectedBreakdown }
}
