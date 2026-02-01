import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { LumpSumDistributionData } from 'ustaxes/core/data'

/**
 * Form 4972 - Tax on Lump-Sum Distributions
 *
 * Allows special tax treatment for lump-sum distributions from
 * qualified retirement plans if the participant was born before
 * January 2, 1936.
 *
 * Two special treatments available:
 * 1. Capital gain election - 20% tax rate on pre-1974 participation portion
 * 2. 10-year averaging - Uses 1986 tax rates for ordinary income portion
 *
 * IRC Section 402(e) - Tax on lump sum distributions
 *
 * Note: This election is rarely used as it only applies to participants
 * born before 1936 who haven't previously made the election.
 */
export default class F4972 extends F1040Attachment {
  tag: FormTag = 'f4972'
  sequenceIndex = 28

  get distributions(): LumpSumDistributionData[] {
    return this.f1040.info.lumpSumDistributions ?? []
  }

  /**
   * Only eligible if participant was born before January 2, 1936
   */
  get eligibleDistributions(): LumpSumDistributionData[] {
    return this.distributions.filter((d) => d.participantBirthYear < 1936)
  }

  isNeeded = (): boolean => this.eligibleDistributions.length > 0

  // Part I - Complete this part to see if you can use Form 4972

  /**
   * Line 1 - Was this a lump-sum distribution from a qualified plan?
   */
  l1 = (): boolean => this.eligibleDistributions.length > 0

  /**
   * Line 2 - Was the plan participant born before January 2, 1936?
   */
  l2 = (): boolean =>
    this.eligibleDistributions.some((d) => d.participantBirthYear < 1936)

  /**
   * Line 3 - Was the participant in the plan for at least 5 years?
   * (Assumed yes if they're claiming the distribution)
   */
  l3 = (): boolean => this.l2()

  /**
   * Line 4 - Did you use Form 4972 after 1986 for a distribution from this plan?
   * (Cannot use if previously elected)
   */
  l4 = (): boolean => false // Assumed no - user would not enter if already used

  /**
   * Line 5 - If you are receiving this on behalf of deceased employee,
   * did the employee meet the conditions?
   */
  l5 = (): boolean | undefined => undefined

  // Part II - Complete this part to choose capital gain election

  /**
   * Line 6 - Capital gain part from box 3 of Form 1099-R
   * (Pre-1974 participation portion eligible for 20% rate)
   */
  l6 = (): number =>
    this.eligibleDistributions
      .filter((d) => d.electCapitalGainTreatment)
      .reduce((total, d) => total + (d.capitalGainPortion ?? 0), 0)

  /**
   * Line 7 - Multiply line 6 by 20% (0.20)
   * Tax on capital gain portion
   */
  l7 = (): number => Math.round(this.l6() * 0.2)

  // Part III - Complete this part to choose 10-year averaging

  /**
   * Line 8 - Ordinary income from Form 1099-R box 2a minus box 3
   */
  l8 = (): number =>
    this.eligibleDistributions
      .filter((d) => d.elect10YearAveraging)
      .reduce(
        (total, d) =>
          total +
          (d.ordinaryIncomePortion ??
            d.totalDistribution - (d.capitalGainPortion ?? 0)),
        0
      )

  /**
   * Line 9 - Death benefit exclusion for pre-August 21, 1996 beneficiaries
   */
  l9 = (): number | undefined => undefined

  /**
   * Line 10 - Total taxable amount (line 8 minus line 9)
   */
  l10 = (): number => Math.max(0, this.l8() - (this.l9() ?? 0))

  /**
   * Line 11 - Current actuarial value of annuity
   */
  l11 = (): number =>
    this.eligibleDistributions.reduce(
      (total, d) => total + (d.currentActuarialValue ?? 0),
      0
    )

  /**
   * Line 12 - Adjusted total taxable amount (line 10 plus line 11)
   */
  l12 = (): number => this.l10() + this.l11()

  /**
   * Line 13 - Multiply line 12 by 10% (0.10)
   * This is 1/10 of the distribution for averaging purposes
   */
  l13 = (): number => Math.round(this.l12() * 0.1)

  /**
   * Line 14 - Tax on amount on line 13 using 1986 single tax rates
   * 1986 Tax Rate Schedule for Single filers:
   * - 11% on first $2,390
   * - 12% on $2,390 - $3,540
   * - 14% on $3,540 - $4,580
   * - 15% on $4,580 - $6,760
   * - 16% on $6,760 - $8,850
   * - 18% on $8,850 - $11,240
   * - 20% on $11,240 - $13,430
   * - 23% on $13,430 - $15,610
   * - 26% on $15,610 - $18,940
   * - 30% on $18,940 - $24,460
   * - 34% on $24,460 - $29,970
   * - 38% on $29,970 - $35,490
   * - 42% on $35,490 - $43,190
   * - 48% on $43,190 - $57,550
   * - 50% on over $57,550
   */
  l14 = (): number => {
    const amount = this.l13()
    return this.calculate1986Tax(amount)
  }

  /**
   * Calculate tax using 1986 single tax rates
   */
  private calculate1986Tax(amount: number): number {
    const brackets = [
      { limit: 2390, rate: 0.11 },
      { limit: 3540, rate: 0.12 },
      { limit: 4580, rate: 0.14 },
      { limit: 6760, rate: 0.15 },
      { limit: 8850, rate: 0.16 },
      { limit: 11240, rate: 0.18 },
      { limit: 13430, rate: 0.2 },
      { limit: 15610, rate: 0.23 },
      { limit: 18940, rate: 0.26 },
      { limit: 24460, rate: 0.3 },
      { limit: 29970, rate: 0.34 },
      { limit: 35490, rate: 0.38 },
      { limit: 43190, rate: 0.42 },
      { limit: 57550, rate: 0.48 },
      { limit: Infinity, rate: 0.5 }
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

  /**
   * Line 15 - Multiply line 14 by 10
   * Total tax using 10-year averaging
   */
  l15 = (): number => this.l14() * 10

  /**
   * Line 16 - Multiply line 11 by 10% (0.10)
   */
  l16 = (): number => Math.round(this.l11() * 0.1)

  /**
   * Line 17 - Tax on line 16 using 1986 rates
   */
  l17 = (): number => this.calculate1986Tax(this.l16())

  /**
   * Line 18 - Multiply line 17 by 10
   */
  l18 = (): number => this.l17() * 10

  /**
   * Line 19 - Subtract line 18 from line 15
   */
  l19 = (): number => Math.max(0, this.l15() - this.l18())

  /**
   * Line 20 - Federal estate tax attributable to lump-sum distribution
   */
  l20 = (): number =>
    this.eligibleDistributions.reduce(
      (total, d) => total + (d.federalEstateTaxAttributable ?? 0),
      0
    )

  /**
   * Line 21 - Subtract line 20 from line 19
   * This is the tax from 10-year averaging
   */
  l21 = (): number => Math.max(0, this.l19() - this.l20())

  // Part IV - Complete this part to figure your tax

  /**
   * Line 22 - Tax from Part II (capital gain) line 7
   */
  l22 = (): number => this.l7()

  /**
   * Line 23 - Tax from Part III (10-year averaging) line 21
   */
  l23 = (): number => this.l21()

  /**
   * Line 24 - Total tax (add lines 22 and 23)
   * This is the tax to add to Form 1040
   */
  l24 = (): number => this.l22() + this.l23()

  /**
   * Tax on lump-sum distributions
   * This goes to Form 1040 (via Schedule 2)
   */
  tax = (): number => {
    const totalTax = this.l24()
    return totalTax > 0 ? totalTax : 0
  }

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Part I
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5(),
    // Part II - Capital gain election
    this.l6(),
    this.l7(),
    // Part III - 10-year averaging
    this.l8(),
    this.l9(),
    this.l10(),
    this.l11(),
    this.l12(),
    this.l13(),
    this.l14(),
    this.l15(),
    this.l16(),
    this.l17(),
    this.l18(),
    this.l19(),
    this.l20(),
    this.l21(),
    // Part IV - Total tax
    this.l22(),
    this.l23(),
    this.l24()
  ]
}
