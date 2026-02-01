import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Schedule D (Form 1041) - Capital Gains and Losses
 *
 * Used by estates and trusts to report capital gains and losses.
 *
 * Key differences from individual Schedule D:
 * - Capital gains may be allocated to beneficiaries
 * - Capital gains may be allocated to corpus
 * - Different rules for capital loss carryovers
 *
 * Sections:
 * - Part I: Short-Term Capital Gains and Losses
 * - Part II: Long-Term Capital Gains and Losses
 * - Part III: Summary
 */

export interface FiduciaryCapitalTransaction {
  description: string
  dateAcquired: Date
  dateSold: Date
  salesPrice: number
  costBasis: number
  gainOrLoss: number
  isShortTerm: boolean
  allocatedToBeneficiaries: number
  allocatedToCorpus: number
}

export interface Schedule1041DData {
  // Short-term transactions
  shortTermTransactions: FiduciaryCapitalTransaction[]
  shortTermGainFromForm4797: number
  shortTermGainFromForm6252: number
  shortTermGainFromForm8824: number
  shortTermLossCarryover: number
  // Long-term transactions
  longTermTransactions: FiduciaryCapitalTransaction[]
  longTermGainFromForm4797: number
  longTermGainFromForm6252: number
  longTermGainFromForm8824: number
  longTermGainFromScheduleK1: number
  longTermLossCarryover: number
  // 28% rate gain
  collectiblesGain: number
  section1202Gain: number
  // Unrecaptured section 1250 gain
  unrecapturedSection1250Gain: number
}

export default class Schedule1041D extends F1040Attachment {
  tag: FormTag = 'f1041sd'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasCapitalTransactions()
  }

  hasCapitalTransactions = (): boolean => {
    const fiduciaryReturn = this.f1040.info.fiduciaryReturn
    return fiduciaryReturn !== undefined
  }

  schedule1041DData = (): Schedule1041DData | undefined => {
    return undefined // Would be populated from estate/trust data
  }

  // Part I: Short-Term Capital Gains and Losses

  shortTermTransactions = (): FiduciaryCapitalTransaction[] => {
    return this.schedule1041DData()?.shortTermTransactions ?? []
  }

  // Line 1: Short-term totals from Form 8949
  l1 = (): number => {
    return this.shortTermTransactions()
      .filter((t) => t.isShortTerm)
      .reduce((sum, t) => sum + t.gainOrLoss, 0)
  }

  // Line 2: Short-term gain from Form 4797
  l2 = (): number => this.schedule1041DData()?.shortTermGainFromForm4797 ?? 0

  // Line 3: Short-term gain from Form 6252 (installment sales)
  l3 = (): number => this.schedule1041DData()?.shortTermGainFromForm6252 ?? 0

  // Line 4: Short-term gain from Form 8824 (like-kind exchanges)
  l4 = (): number => this.schedule1041DData()?.shortTermGainFromForm8824 ?? 0

  // Line 5: Net short-term gain or loss
  l5 = (): number => sumFields([this.l1(), this.l2(), this.l3(), this.l4()])

  // Line 6: Short-term capital loss carryover
  l6 = (): number => this.schedule1041DData()?.shortTermLossCarryover ?? 0

  // Line 7: Net short-term capital gain or loss
  l7 = (): number => this.l5() - this.l6()

  // Part II: Long-Term Capital Gains and Losses

  longTermTransactions = (): FiduciaryCapitalTransaction[] => {
    return this.schedule1041DData()?.longTermTransactions ?? []
  }

  // Line 8: Long-term totals from Form 8949
  l8 = (): number => {
    return this.longTermTransactions()
      .filter((t) => !t.isShortTerm)
      .reduce((sum, t) => sum + t.gainOrLoss, 0)
  }

  // Line 9: Long-term gain from Form 4797
  l9 = (): number => this.schedule1041DData()?.longTermGainFromForm4797 ?? 0

  // Line 10: Long-term gain from Form 6252
  l10 = (): number => this.schedule1041DData()?.longTermGainFromForm6252 ?? 0

  // Line 11: Long-term gain from Form 8824
  l11 = (): number => this.schedule1041DData()?.longTermGainFromForm8824 ?? 0

  // Line 12: Long-term gain from Schedule K-1
  l12 = (): number => this.schedule1041DData()?.longTermGainFromScheduleK1 ?? 0

  // Line 13: Capital gain distributions
  l13 = (): number => 0 // From 1099-DIV Box 2a

  // Line 14: Net long-term gain or loss
  l14 = (): number =>
    sumFields([
      this.l8(),
      this.l9(),
      this.l10(),
      this.l11(),
      this.l12(),
      this.l13()
    ])

  // Line 15: Long-term capital loss carryover
  l15 = (): number => this.schedule1041DData()?.longTermLossCarryover ?? 0

  // Line 16: Net long-term capital gain or loss
  l16 = (): number => this.l14() - this.l15()

  // Part III: Summary

  // Line 17: Net short-term + long-term
  l17 = (): number => this.l7() + this.l16()

  // Line 18a: 28% rate gain (collectibles, section 1202)
  l18a = (): number => {
    const data = this.schedule1041DData()
    return sumFields([data?.collectiblesGain, data?.section1202Gain])
  }

  // Line 18b: Unrecaptured section 1250 gain
  l18b = (): number =>
    this.schedule1041DData()?.unrecapturedSection1250Gain ?? 0

  // Capital gains allocated to beneficiaries
  capitalGainsToBeneficiaries = (): number => {
    const allTransactions = [
      ...this.shortTermTransactions(),
      ...this.longTermTransactions()
    ]
    return allTransactions.reduce(
      (sum, t) => sum + t.allocatedToBeneficiaries,
      0
    )
  }

  // Capital gains allocated to corpus
  capitalGainsToCorpus = (): number => {
    const allTransactions = [
      ...this.shortTermTransactions(),
      ...this.longTermTransactions()
    ]
    return allTransactions.reduce((sum, t) => sum + t.allocatedToCorpus, 0)
  }

  // To Form 1041 Line 4
  toForm1041Line4 = (): number => this.l17()

  fields = (): Field[] => {
    const shortTerm = this.shortTermTransactions()
    const longTerm = this.longTermTransactions()

    return [
      // Part I: Short-Term
      shortTerm[0]?.description ?? '',
      shortTerm[0]?.dateAcquired?.toLocaleDateString() ?? '',
      shortTerm[0]?.dateSold?.toLocaleDateString() ?? '',
      shortTerm[0]?.salesPrice ?? 0,
      shortTerm[0]?.costBasis ?? 0,
      shortTerm[0]?.gainOrLoss ?? 0,
      this.l1(),
      this.l2(),
      this.l3(),
      this.l4(),
      this.l5(),
      this.l6(),
      this.l7(),
      // Part II: Long-Term
      longTerm[0]?.description ?? '',
      longTerm[0]?.dateAcquired?.toLocaleDateString() ?? '',
      longTerm[0]?.dateSold?.toLocaleDateString() ?? '',
      longTerm[0]?.salesPrice ?? 0,
      longTerm[0]?.costBasis ?? 0,
      longTerm[0]?.gainOrLoss ?? 0,
      this.l8(),
      this.l9(),
      this.l10(),
      this.l11(),
      this.l12(),
      this.l13(),
      this.l14(),
      this.l15(),
      this.l16(),
      // Part III: Summary
      this.l17(),
      this.l18a(),
      this.l18b(),
      // Allocations
      this.capitalGainsToBeneficiaries(),
      this.capitalGainsToCorpus(),
      this.toForm1041Line4()
    ]
  }
}
