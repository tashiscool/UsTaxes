import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { LumpSumDistributionData } from 'ustaxes/core/data'

/**
 * Form 4972 - Tax on Lump-Sum Distributions
 *
 * Use this form to figure the tax on a qualified lump-sum distribution
 * from a qualified retirement plan using the optional methods:
 *
 * 1. Capital gain election (for pre-1974 participation)
 *    - 20% flat rate on pre-1974 portion
 *
 * 2. 10-year tax option
 *    - Treats distribution as if received over 10 years
 *    - Uses 1986 single tax rates
 *
 * Requirements to qualify:
 * - Must be the entire balance from all of employer's qualified plans
 * - Distribution must be paid within one tax year
 * - Participant must have been in plan for at least 5 years
 * - Participant must have been born before January 2, 1936
 */

export default class F4972 extends F1040Attachment {
  tag: FormTag = 'f4972'
  sequenceIndex = 28

  isNeeded = (): boolean => {
    return this.lumpSumDistributions().length > 0
  }

  lumpSumDistributions = (): LumpSumDistributionData[] => {
    return this.f1040.info.lumpSumDistributions ?? []
  }

  // Part I - Complete this part to see if you can use Form 4972

  // Line 1: Was this participant born before January 2, 1936?
  l1 = (): boolean => {
    return this.lumpSumDistributions().some(d => d.participantBirthYear < 1936)
  }

  // Line 2: Was this a lump-sum distribution from a qualified plan?
  l2 = (): boolean => this.lumpSumDistributions().length > 0

  // Part II - Ordinary Income and Tax

  // Line 3: Capital gain part (for pre-1974 participation)
  l3 = (): number => {
    return this.lumpSumDistributions()
      .filter(d => d.electCapitalGainTreatment)
      .reduce((sum, d) => sum + (d.capitalGainPortion ?? 0), 0)
  }

  // Line 4: Multiply line 3 by 20% (0.20) for capital gains tax
  l4 = (): number => Math.round(this.l3() * 0.20)

  // Part III - Tax on 10-Year Average (If Applicable)

  // Line 5: Ordinary income portion
  l5 = (): number => {
    return this.lumpSumDistributions()
      .filter(d => d.elect10YearAveraging)
      .reduce((sum, d) => sum + (d.ordinaryIncomePortion ?? d.totalDistribution - (d.capitalGainPortion ?? 0)), 0)
  }

  // Line 6: Death benefit exclusion (if applicable) - $5,000 max
  l6 = (): number => 0

  // Line 7: Total taxable amount (line 5 - line 6)
  l7 = (): number => Math.max(0, this.l5() - this.l6())

  // Line 8: Current actuarial value of annuity (if any)
  l8 = (): number => {
    return this.lumpSumDistributions()
      .reduce((sum, d) => sum + (d.currentActuarialValue ?? 0), 0)
  }

  // Line 9: Adjusted total taxable amount
  l9 = (): number => this.l7() + this.l8()

  // Line 10: Multiply line 9 by 10%
  l10 = (): number => Math.round(this.l9() * 0.10)

  // Line 11: Tax on amount on line 10 (using 1986 single tax rates)
  l11 = (): number => this.calculate1986Tax(this.l10())

  // Line 12: Multiply line 11 by 10 (10-year averaging)
  l12 = (): number => this.l11() * 10

  // Line 13: Adjustment for portion of lump sum
  l13 = (): number => {
    if (this.l8() === 0) return 0
    return Math.round(this.l12() * (this.l8() / this.l9()))
  }

  // Line 14: Subtract line 13 from line 12
  l14 = (): number => this.l12() - this.l13()

  /**
   * Calculate tax using 1986 single tax rates
   * (Used for 10-year averaging calculation)
   */
  private calculate1986Tax(amount: number): number {
    // 1986 tax rates for single filers
    const brackets = [
      { limit: 1190, rate: 0 },
      { limit: 2270, rate: 0.11 },
      { limit: 4530, rate: 0.12 },
      { limit: 6690, rate: 0.14 },
      { limit: 9170, rate: 0.15 },
      { limit: 11440, rate: 0.16 },
      { limit: 13710, rate: 0.18 },
      { limit: 17160, rate: 0.20 },
      { limit: 22880, rate: 0.23 },
      { limit: 28600, rate: 0.26 },
      { limit: 34320, rate: 0.30 },
      { limit: 42300, rate: 0.34 },
      { limit: 57190, rate: 0.38 },
      { limit: 85790, rate: 0.42 },
      { limit: Infinity, rate: 0.48 }
    ]

    let tax = 0
    let previousLimit = 0

    for (const bracket of brackets) {
      if (amount <= previousLimit) break
      const taxableInBracket = Math.min(amount, bracket.limit) - previousLimit
      tax += taxableInBracket * bracket.rate
      previousLimit = bracket.limit
    }

    return Math.round(tax)
  }

  // Part IV - Total Tax

  // Line 15: Tax from Part II (capital gain portion)
  l15 = (): number => this.l4()

  // Line 16: Tax from Part III (10-year average)
  l16 = (): number => this.l14()

  // Line 17: Total tax (add lines 15 and 16)
  l17 = (): number => this.l15() + this.l16()

  // Total tax for Schedule 2
  tax = (): number => this.l17()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson?.ssid,
    // Part I
    this.l1(),
    this.l2(),
    // Part II
    this.l3(),
    this.l4(),
    // Part III
    this.l5(),
    this.l6(),
    this.l7(),
    this.l8(),
    this.l9(),
    this.l10(),
    this.l11(),
    this.l12(),
    this.l13(),
    this.l14(),
    // Part IV
    this.l15(),
    this.l16(),
    this.l17()
  ]
}
