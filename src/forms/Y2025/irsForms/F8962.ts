/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import F1040Attachment from './F1040Attachment'
import { FilingStatus } from 'ustaxes/core/data'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 8962 - Premium Tax Credit (PTC)
 *
 * Reconciles advance premium tax credit payments for health insurance
 * purchased through the Health Insurance Marketplace (Healthcare.gov).
 *
 * Key concepts:
 * - Premium Tax Credit: Credit to help pay for marketplace health insurance
 * - APTC: Advance Premium Tax Credit (paid directly to insurer monthly)
 * - SLCSP: Second Lowest Cost Silver Plan (benchmark for credit calculation)
 * - FPL: Federal Poverty Level (determines credit eligibility)
 *
 * 2025 Rules:
 * - Credit available for income 100% - 400% of FPL (extended through 2025)
 * - American Rescue Plan enhanced credits continue through 2025
 * - Credit calculated monthly, reconciled on tax return
 * - Excess APTC must be repaid (with caps based on income)
 */

// 2025 Federal Poverty Level (continental US)
const federalPovertyLevel = {
  baseAmount: 15060, // For 1 person
  additionalPerson: 5380 // Additional per person
}

// 2025 Premium Tax Credit income thresholds as % of FPL
const ptcThresholds = {
  minFplPercent: 100, // Minimum income for credit
  maxFplPercent: 400, // Maximum income for credit (pre-ARP)
  arpExtended: true // ARP enhancements extended through 2025
}

// 2025 Applicable percentage table (ARP enhanced)
// Income as % of FPL -> max premium % of income
const applicablePercentageTable = [
  { minFpl: 100, maxFpl: 150, startPercent: 0.0, endPercent: 0.0 },
  { minFpl: 150, maxFpl: 200, startPercent: 0.0, endPercent: 0.02 },
  { minFpl: 200, maxFpl: 250, startPercent: 0.02, endPercent: 0.04 },
  { minFpl: 250, maxFpl: 300, startPercent: 0.04, endPercent: 0.06 },
  { minFpl: 300, maxFpl: 400, startPercent: 0.06, endPercent: 0.085 },
  { minFpl: 400, maxFpl: Infinity, startPercent: 0.085, endPercent: 0.085 } // ARP extension
]

// Repayment limitation amounts (2025)
const repaymentLimits = {
  under200: { single: 375, other: 750 },
  under300: { single: 975, other: 1950 },
  under400: { single: 1625, other: 3250 },
  over400: { single: Infinity, other: Infinity } // No limit
}

export interface MarketplaceCoverage {
  month: number // 1-12
  enrollmentPremium: number
  slcsp: number // Second lowest cost silver plan
  advancePayment: number // APTC paid
  coverageMonths: number // Fraction of month covered (usually 1)
}

interface MarketplacePolicyData {
  enrollmentPremiums?: number[]
  slcsp?: number[]
  advancePayments?: number[]
}

export default class F8962 extends F1040Attachment {
  tag: FormTag = 'f8962'
  sequenceIndex = 73

  isNeeded = (): boolean => {
    return this.hasMarketplaceCoverage()
  }

  hasMarketplaceCoverage = (): boolean => {
    const coverage = this.f1040.info.healthInsuranceMarketplace
    return (coverage?.length ?? 0) > 0
  }

  marketplaceCoverage = (): MarketplaceCoverage[] => {
    const policies = (this.f1040.info.healthInsuranceMarketplace ??
      []) as MarketplacePolicyData[]
    const coverage: MarketplaceCoverage[] = []

    for (const policy of policies) {
      const enrollmentPremiums = policy.enrollmentPremiums ?? []
      const slcspValues = policy.slcsp ?? []
      const advancePayments = policy.advancePayments ?? []
      for (let month = 0; month < 12; month++) {
        if ((enrollmentPremiums[month] ?? 0) > 0) {
          coverage.push({
            month: month + 1,
            enrollmentPremium: enrollmentPremiums[month] ?? 0,
            slcsp: slcspValues[month] ?? 0,
            advancePayment: advancePayments[month] ?? 0,
            coverageMonths: 1
          })
        }
      }
    }

    return coverage
  }

  // Part I - Annual and Monthly Contribution Amount

  // Line 1: Tax family size (number of exemptions)
  l1 = (): number => {
    let count = 1 // Primary taxpayer
    if (this.f1040.info.taxPayer.spouse) count++
    count += this.f1040.info.taxPayer.dependents.length ?? 0
    return count
  }

  // Line 2a: Modified AGI
  l2a = (): number => {
    // MAGI for PTC = AGI + tax-exempt interest + foreign earned income exclusion
    const agi = this.f1040.l11()
    const taxExemptInterest = this.f1040.l2a() ?? 0
    const foreignExclusion = this.f1040.f2555?.l45() ?? 0
    return agi + taxExemptInterest + foreignExclusion
  }

  // Line 2b: Dependents' modified AGI (simplified - usually 0)
  l2b = (): number => 0

  // Line 3: Household income (line 2a + line 2b)
  l3 = (): number => this.l2a() + this.l2b()

  // Line 4: Federal poverty line for family size
  l4 = (): number => {
    const familySize = this.l1()
    return (
      federalPovertyLevel.baseAmount +
      Math.max(0, familySize - 1) * federalPovertyLevel.additionalPerson
    )
  }

  // Line 5: Household income as percentage of FPL
  l5 = (): number => {
    const fplPercent = Math.round((this.l3() / this.l4()) * 100)
    return Math.max(0, fplPercent)
  }

  // Line 6: Check if within eligible range
  l6 = (): boolean => {
    const pct = this.l5()
    // With ARP extension, eligible at any income level if enrolled in marketplace
    return pct >= 100 || ptcThresholds.arpExtended
  }

  // Line 7: Applicable percentage (from table based on income)
  l7 = (): number => {
    const fplPercent = this.l5()

    // Below 100% FPL - may still be eligible for premium assistance
    if (fplPercent < 100) return 0

    // Find applicable bracket
    for (const bracket of applicablePercentageTable) {
      if (fplPercent >= bracket.minFpl && fplPercent < bracket.maxFpl) {
        // Linear interpolation within bracket
        const position =
          (fplPercent - bracket.minFpl) / (bracket.maxFpl - bracket.minFpl)
        const percent =
          bracket.startPercent +
          position * (bracket.endPercent - bracket.startPercent)
        return Math.round(percent * 10000) / 10000 // Round to 4 decimal places
      }
    }

    return 0.085 // Default max for high income
  }

  // Line 8a: Annual contribution amount (line 3 × line 7)
  l8a = (): number => Math.round(this.l3() * this.l7())

  // Line 8b: Monthly contribution amount (line 8a ÷ 12)
  l8b = (): number => Math.round(this.l8a() / 12)

  // Part II - Premium Tax Credit Claim and Reconciliation

  // Lines 11-23: Monthly calculations (simplified to annual totals)

  // Get monthly premium data
  getMonthlyData = (
    month: number
  ): { premium: number; slcsp: number; advance: number } => {
    const coverage = this.marketplaceCoverage()
    const monthData = coverage.find((c) => c.month === month)
    return {
      premium: monthData?.enrollmentPremium ?? 0,
      slcsp: monthData?.slcsp ?? 0,
      advance: monthData?.advancePayment ?? 0
    }
  }

  // Line 11a-m: Monthly enrollment premiums
  l11 = (month: number): number => this.getMonthlyData(month).premium

  // Line 12a-m: Monthly SLCSP premiums
  l12 = (month: number): number => this.getMonthlyData(month).slcsp

  // Line 13a-m: Monthly contribution (line 8b or actual if different)
  l13 = (month: number): number => {
    const slcsp = this.l12(month)
    if (slcsp === 0) return 0 // No coverage this month
    return Math.min(this.l8b(), slcsp)
  }

  // Line 14a-m: Monthly max PTC (line 12 - line 13, not less than 0)
  l14 = (month: number): number => {
    return Math.max(0, this.l12(month) - this.l13(month))
  }

  // Line 15a-m: Monthly PTC allowed (smaller of line 11 or line 14)
  l15 = (month: number): number => {
    return Math.min(this.l11(month), this.l14(month))
  }

  // Line 16a-m: Monthly APTC
  l16 = (month: number): number => this.getMonthlyData(month).advance

  // Annual totals
  totalEnrollmentPremiums = (): number => {
    return Array.from({ length: 12 }, (_, i) => this.l11(i + 1)).reduce(
      (sum, v) => sum + v,
      0
    )
  }

  totalSlcsp = (): number => {
    return Array.from({ length: 12 }, (_, i) => this.l12(i + 1)).reduce(
      (sum, v) => sum + v,
      0
    )
  }

  totalMaxPtc = (): number => {
    return Array.from({ length: 12 }, (_, i) => this.l14(i + 1)).reduce(
      (sum, v) => sum + v,
      0
    )
  }

  totalPtcAllowed = (): number => {
    return Array.from({ length: 12 }, (_, i) => this.l15(i + 1)).reduce(
      (sum, v) => sum + v,
      0
    )
  }

  totalAptc = (): number => {
    return Array.from({ length: 12 }, (_, i) => this.l16(i + 1)).reduce(
      (sum, v) => sum + v,
      0
    )
  }

  // Line 24: Total premium tax credit (sum of line 15 for all months)
  l24 = (): number => this.totalPtcAllowed()

  // Line 25: Total APTC (sum of line 16 for all months)
  l25 = (): number => this.totalAptc()

  // Line 26: Compare line 24 and line 25
  l26 = (): number => Math.max(0, this.l24() - this.l25()) // Net PTC

  // Line 27: Excess APTC (line 25 - line 24, if positive)
  l27 = (): number => Math.max(0, this.l25() - this.l24())

  // Line 28: Repayment limitation (based on income)
  l28 = (): number => {
    const fplPercent = this.l5()
    const isSingle =
      this.f1040.info.taxPayer.filingStatus === FilingStatus.S ||
      this.f1040.info.taxPayer.filingStatus === FilingStatus.MFS

    if (fplPercent < 200) {
      return isSingle
        ? repaymentLimits.under200.single
        : repaymentLimits.under200.other
    } else if (fplPercent < 300) {
      return isSingle
        ? repaymentLimits.under300.single
        : repaymentLimits.under300.other
    } else if (fplPercent < 400) {
      return isSingle
        ? repaymentLimits.under400.single
        : repaymentLimits.under400.other
    }
    return Infinity // No limit above 400% FPL
  }

  // Line 29: Excess APTC repayment (smaller of line 27 or line 28)
  l29 = (): number => Math.min(this.l27(), this.l28())

  // Summary methods for integration

  // Net premium tax credit (if PTC > APTC)
  // Goes to Schedule 3, line 9
  credit = (): number => this.l26()

  // Excess APTC repayment (if APTC > PTC)
  // Goes to Schedule 2, line 2
  excessAptcRepayment = (): number => this.l29()

  fields = (): Field[] => {
    const monthlyFields: Field[] = []

    // Add monthly data (lines 11-16 for each month)
    for (let month = 1; month <= 12; month++) {
      monthlyFields.push(
        this.l11(month),
        this.l12(month),
        this.l13(month),
        this.l14(month),
        this.l15(month),
        this.l16(month)
      )
    }

    return [
      this.f1040.namesString(),
      this.f1040.info.taxPayer.primaryPerson.ssid,
      // Part I
      this.l1(),
      this.l2a(),
      this.l2b(),
      this.l3(),
      this.l4(),
      this.l5(),
      this.l6(),
      this.l7(),
      this.l8a(),
      this.l8b(),
      // Part II - Monthly calculations
      ...monthlyFields,
      // Totals
      this.totalEnrollmentPremiums(),
      this.totalSlcsp(),
      this.totalMaxPtc(),
      this.totalPtcAllowed(),
      this.totalAptc(),
      // Lines 24-29
      this.l24(),
      this.l25(),
      this.l26(),
      this.l27(),
      this.l28(),
      this.l29()
    ]
  }
}
