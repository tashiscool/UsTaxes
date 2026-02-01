import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8874Data } from 'ustaxes/core/data'

/**
 * Form 8874 - New Markets Credit
 *
 * Credit for investments in qualified community development entities (CDEs)
 * that serve low-income communities.
 *
 * Credit calculation:
 * - Years 1-3: 5% of qualified equity investment
 * - Years 4-7: 6% of qualified equity investment
 * - Total credit over 7 years: 39% of investment
 *
 * Requirements:
 * - Investment must be in a qualified CDE
 * - CDE must use substantially all proceeds for qualified
 *   low-income community investments
 * - Credit allocated by CDFI Fund of Treasury
 *
 * Recapture rules apply if:
 * - Investment is redeemed within 7 years
 * - CDE ceases to be qualified
 * - Investment purposes change
 */

// Credit percentages by year
const newMarketsCredits = {
  years1to3: 0.05, // 5%
  years4to7: 0.06 // 6%
}

export default class F8874 extends F1040Attachment {
  tag: FormTag = 'f8874'
  sequenceIndex = 107

  isNeeded = (): boolean => {
    return this.hasNewMarketsCredit()
  }

  hasNewMarketsCredit = (): boolean => {
    const data = this.creditData()
    return (
      data !== undefined &&
      (data.qualifiedEquityInvestments.length > 0 ||
        (data.passthrough8874Credit ?? 0) > 0)
    )
  }

  creditData = (): Form8874Data | undefined => {
    // Would need to add to Information interface
    return undefined
  }

  // Part I - Current Year Credit from Qualified Equity Investments

  // Line 1a: Qualified equity investments (years 1-3 at 5%)
  l1a = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.qualifiedEquityInvestments
      .filter((i) => i.creditPercentage === newMarketsCredits.years1to3)
      .reduce((sum, i) => sum + i.creditAmount, 0)
  }

  // Line 1b: Qualified equity investments (years 4-7 at 6%)
  l1b = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.qualifiedEquityInvestments
      .filter((i) => i.creditPercentage === newMarketsCredits.years4to7)
      .reduce((sum, i) => sum + i.creditAmount, 0)
  }

  // Line 2: Add lines 1a and 1b
  l2 = (): number => this.l1a() + this.l1b()

  // Line 3: New markets credit from partnerships, S corps, etc.
  l3 = (): number => this.creditData()?.passthrough8874Credit ?? 0

  // Line 4: Add lines 2 and 3 (total credit)
  l4 = (): number => this.l2() + this.l3()

  // Credit for Form 3800
  credit = (): number => this.creditData()?.totalCredit ?? this.l4()

  // Number of qualified investments
  numberOfInvestments = (): number =>
    this.creditData()?.qualifiedEquityInvestments.length ?? 0

  // Total original investment amount
  totalInvestmentAmount = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.qualifiedEquityInvestments.reduce(
      (sum, i) => sum + i.originalInvestmentAmount,
      0
    )
  }

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.l1a(),
    this.l1b(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.numberOfInvestments(),
    this.totalInvestmentAmount()
  ]
}
