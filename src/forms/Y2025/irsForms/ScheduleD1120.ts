import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Schedule D (Form 1120/1120-S) - Capital Gains and Losses
 *
 * Used by corporations (C-Corps and S-Corps) to report capital gains and losses.
 *
 * Key differences from individual Schedule D:
 * - No preferential capital gains rate for C-Corps (taxed at ordinary rates)
 * - S-Corps pass through to shareholders
 * - Net capital loss cannot offset ordinary income for C-Corps
 * - Capital loss carryback (3 years) and carryforward (5 years) for C-Corps
 */

export interface CorporateCapitalTransaction {
  description: string
  dateAcquired: Date
  dateSold: Date
  salesPrice: number
  costBasis: number
  gainOrLoss: number
  isShortTerm: boolean
}

export interface ScheduleD1120Data {
  // Short-term transactions
  shortTermTransactions: CorporateCapitalTransaction[]
  shortTermGainFromForm4797: number
  shortTermGainFromInstallmentSales: number
  shortTermGainFromLikeKindExchanges: number
  shortTermCapitalLossCarryover: number
  // Long-term transactions
  longTermTransactions: CorporateCapitalTransaction[]
  longTermGainFromForm4797: number
  longTermGainFromInstallmentSales: number
  longTermGainFromLikeKindExchanges: number
  longTermCapitalLossCarryover: number
  // Prior year capital loss carryovers
  priorYearShortTermLoss: number
  priorYearLongTermLoss: number
}

export default class ScheduleD1120 extends F1040Attachment {
  tag: FormTag = 'f1120sd'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasCapitalTransactions()
  }

  hasCapitalTransactions = (): boolean => {
    const cCorps = this.f1040.info.cCorpOwnership
    const sCorps = this.f1040.info.sCorpOwnership
    return (
      (cCorps !== undefined && cCorps.length > 0) ||
      (sCorps !== undefined && sCorps.length > 0)
    )
  }

  scheduleD1120Data = (): ScheduleD1120Data | undefined => {
    return undefined // Would be populated from entity data
  }

  // Part I: Short-Term Capital Gains and Losses

  shortTermTransactions = (): CorporateCapitalTransaction[] => {
    return this.scheduleD1120Data()?.shortTermTransactions ?? []
  }

  // Line 1: Short-term totals from transactions
  l1 = (): number => {
    return this.shortTermTransactions().reduce(
      (sum, t) => sum + t.gainOrLoss,
      0
    )
  }

  // Line 2: Short-term gain from Form 4797
  l2 = (): number => this.scheduleD1120Data()?.shortTermGainFromForm4797 ?? 0

  // Line 3: Short-term gain from installment sales
  l3 = (): number =>
    this.scheduleD1120Data()?.shortTermGainFromInstallmentSales ?? 0

  // Line 4: Short-term gain from like-kind exchanges
  l4 = (): number =>
    this.scheduleD1120Data()?.shortTermGainFromLikeKindExchanges ?? 0

  // Line 5: Net short-term capital gain/loss
  l5 = (): number => sumFields([this.l1(), this.l2(), this.l3(), this.l4()])

  // Line 6: Short-term capital loss carryover
  l6 = (): number =>
    this.scheduleD1120Data()?.shortTermCapitalLossCarryover ?? 0

  // Line 7: Net short-term capital gain/loss
  l7 = (): number => this.l5() - this.l6()

  // Part II: Long-Term Capital Gains and Losses

  longTermTransactions = (): CorporateCapitalTransaction[] => {
    return this.scheduleD1120Data()?.longTermTransactions ?? []
  }

  // Line 8: Long-term totals from transactions
  l8 = (): number => {
    return this.longTermTransactions().reduce((sum, t) => sum + t.gainOrLoss, 0)
  }

  // Line 9: Long-term gain from Form 4797
  l9 = (): number => this.scheduleD1120Data()?.longTermGainFromForm4797 ?? 0

  // Line 10: Long-term gain from installment sales
  l10 = (): number =>
    this.scheduleD1120Data()?.longTermGainFromInstallmentSales ?? 0

  // Line 11: Long-term gain from like-kind exchanges
  l11 = (): number =>
    this.scheduleD1120Data()?.longTermGainFromLikeKindExchanges ?? 0

  // Line 12: Net long-term capital gain/loss
  l12 = (): number => sumFields([this.l8(), this.l9(), this.l10(), this.l11()])

  // Line 13: Long-term capital loss carryover
  l13 = (): number =>
    this.scheduleD1120Data()?.longTermCapitalLossCarryover ?? 0

  // Line 14: Net long-term capital gain/loss
  l14 = (): number => this.l12() - this.l13()

  // Part III: Summary

  // Line 15: Total net gain/loss
  l15 = (): number => this.l7() + this.l14()

  // For S-Corps: Amount to Schedule K
  toScheduleK = (): number => this.l15()

  // For C-Corps: Net capital gain (if positive)
  netCapitalGain = (): number => Math.max(0, this.l15())

  // For C-Corps: Net capital loss (corporations can only use to offset capital gains)
  netCapitalLoss = (): number => Math.max(0, -this.l15())

  // Capital loss carryback/carryforward
  capitalLossCarryover = (): number => {
    if (this.l15() >= 0) return 0
    return Math.abs(this.l15())
  }

  fields = (): Field[] => {
    const data = this.scheduleD1120Data()
    const shortTerm = this.shortTermTransactions()
    const longTerm = this.longTermTransactions()

    return [
      // Part I: Short-Term
      // First transaction
      shortTerm[0]?.description ?? '',
      shortTerm[0]?.dateAcquired?.toLocaleDateString() ?? '',
      shortTerm[0]?.dateSold?.toLocaleDateString() ?? '',
      shortTerm[0]?.salesPrice ?? 0,
      shortTerm[0]?.costBasis ?? 0,
      shortTerm[0]?.gainOrLoss ?? 0,
      // Totals
      this.l1(),
      this.l2(),
      this.l3(),
      this.l4(),
      this.l5(),
      this.l6(),
      this.l7(),
      // Part II: Long-Term
      // First transaction
      longTerm[0]?.description ?? '',
      longTerm[0]?.dateAcquired?.toLocaleDateString() ?? '',
      longTerm[0]?.dateSold?.toLocaleDateString() ?? '',
      longTerm[0]?.salesPrice ?? 0,
      longTerm[0]?.costBasis ?? 0,
      longTerm[0]?.gainOrLoss ?? 0,
      // Totals
      this.l8(),
      this.l9(),
      this.l10(),
      this.l11(),
      this.l12(),
      this.l13(),
      this.l14(),
      // Part III: Summary
      this.l15(),
      this.netCapitalGain(),
      this.netCapitalLoss(),
      this.capitalLossCarryover()
    ]
  }
}
