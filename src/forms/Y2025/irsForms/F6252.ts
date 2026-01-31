import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Field } from 'ustaxes/core/pdfFiller'

/**
 * Form 6252 - Installment Sale Income
 *
 * Used to report income from an installment sale (selling property and
 * receiving payments over multiple years).
 *
 * Installment method defers gain recognition to when payments are received.
 * Does NOT apply to:
 * - Inventory sales
 * - Publicly traded securities
 * - Depreciation recapture (recognized in year of sale)
 */

export interface InstallmentSale {
  description: string
  dateAcquired: Date
  dateSold: Date
  sellingPrice: number
  mortgageAssumed: number
  adjustedBasis: number
  depreciationRecapture: number
  sellingExpenses: number
  priorYearPayments: number
  currentYearPayments: number
  isRelatedPartySale: boolean
}

export default class F6252 extends F1040Attachment {
  tag: FormTag = 'f6252'
  sequenceIndex = 79

  isNeeded = (): boolean => {
    return this.hasInstallmentSales()
  }

  hasInstallmentSales = (): boolean => {
    return (this.f1040.info.installmentSales?.length ?? 0) > 0
  }

  // Get first installment sale (form handles one sale, need copies for more)
  sale = (): InstallmentSale | undefined => {
    const sales = this.f1040.info.installmentSales as InstallmentSale[] | undefined
    return sales?.[0]
  }

  // Part I - Gross Profit and Contract Price

  // Line 5: Selling price (including mortgages)
  l5 = (): number => this.sale()?.sellingPrice ?? 0

  // Line 6: Mortgages and other debts buyer assumed
  l6 = (): number => this.sale()?.mortgageAssumed ?? 0

  // Line 7: Subtract line 6 from line 5
  l7 = (): number => Math.max(0, this.l5() - this.l6())

  // Line 8: Cost or other basis of property sold
  l8 = (): number => this.sale()?.adjustedBasis ?? 0

  // Line 9: Depreciation allowed
  l9 = (): number => 0  // Simplified

  // Line 10: Adjusted basis (line 8 - line 9)
  l10 = (): number => Math.max(0, this.l8() - this.l9())

  // Line 11: Commissions and other selling expenses
  l11 = (): number => this.sale()?.sellingExpenses ?? 0

  // Line 12: Income recapture from Form 4797
  l12 = (): number => this.sale()?.depreciationRecapture ?? 0

  // Line 13: Add lines 10, 11, and 12
  l13 = (): number => this.l10() + this.l11() + this.l12()

  // Line 14: Subtract line 13 from line 5 (Gross profit)
  l14 = (): number => Math.max(0, this.l5() - this.l13())

  // Line 15: Subtract line 12 from line 14
  l15 = (): number => Math.max(0, this.l14() - this.l12())

  // Line 16: Contract price
  l16 = (): number => {
    // Contract price = Selling price - Mortgages (to extent they exceed basis)
    const mortgageExcess = Math.max(0, this.l6() - this.l10())
    return this.l7() + mortgageExcess
  }

  // Part II - Installment Sale Income

  // Line 17: Gross profit percentage (line 15 ÷ line 16)
  l17 = (): number => {
    if (this.l16() <= 0) return 0
    return this.l15() / this.l16()
  }

  // Line 18: If related party sale, enter name/SSN
  l18RelatedParty = (): boolean => this.sale()?.isRelatedPartySale ?? false

  // Line 19: Selling price of property resold
  l19 = (): number => 0

  // Part III - Related Party Installment Sale Income

  // Line 20: Payments received prior to current year
  l20 = (): number => this.sale()?.priorYearPayments ?? 0

  // Line 21: Payments received during current year
  l21 = (): number => this.sale()?.currentYearPayments ?? 0

  // Line 22: Add lines 20 and 21
  l22 = (): number => this.l20() + this.l21()

  // Line 23: Payments received in prior years (from line 22 of prior year forms)
  l23 = (): number => this.l20()

  // Line 24: Installment sale income (line 21 × line 17)
  l24 = (): number => Math.round(this.l21() * this.l17())

  // Line 25: Part of line 24 that is ordinary income (recapture)
  l25 = (): number => {
    // Depreciation recapture recognized in year of sale, not here
    return 0
  }

  // Line 26: Subtract line 25 from line 24 (long-term capital gain)
  l26 = (): number => Math.max(0, this.l24() - this.l25())

  // Income amounts
  ordinaryIncome = (): number => this.l25()
  ordinaryGain = (): number => this.l25()  // Alias for Form 4797
  longTermCapitalGain = (): number => this.l26()
  section1231Gain = (): number => this.l26()  // For Form 4797 - installment gain from Section 1231 property
  totalInstallmentIncome = (): number => this.l24()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.sale()?.description ?? '',
    this.sale()?.dateAcquired?.toLocaleDateString() ?? '',
    this.sale()?.dateSold?.toLocaleDateString() ?? '',
    // Part I
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
    this.l15(),
    this.l16(),
    // Part II
    this.l17(),
    this.l18RelatedParty(),
    this.l19(),
    // Part III
    this.l20(),
    this.l21(),
    this.l22(),
    this.l23(),
    this.l24(),
    this.l25(),
    this.l26()
  ]
}
