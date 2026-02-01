import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Schedule J (Form 1120) - Tax Computation and Payment
 *
 * Used by C-Corporations to compute income tax liability.
 *
 * 2025 Corporate Tax Rate: 21% flat rate
 *
 * Components:
 * - Part I: Tax Computation
 * - Part II: Payments and Credits
 * - Part III: Estimated Tax Penalty
 */

export interface ScheduleJ1120Data {
  // Part I: Tax Computation
  taxableIncome: number
  // Tax credits
  foreignTaxCredit: number
  generalBusinessCredit: number
  priorYearMinimumTaxCredit: number
  bondCredits: number
  otherCredits: number
  // Recapture taxes
  investmentCreditRecapture: number
  lowIncomeHousingRecapture: number
  section1260Recapture: number
  // Other taxes
  personalHoldingCompanyTax: number
  accumulatedEarningsTax: number
  // Part II: Payments
  estimatedTaxPayments: number
  extensionPayment: number
  creditFromForm4136: number
  creditFromForm8827: number
  refundableFuelCredits: number
  otherPayments: number
}

// 2025 Corporate Tax Rate
const CORPORATE_TAX_RATE = 0.21

export default class ScheduleJ1120 extends F1040Attachment {
  tag: FormTag = 'f1120sj'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasCCorpData()
  }

  hasCCorpData = (): boolean => {
    const cCorps = this.f1040.info.cCorpOwnership
    return cCorps !== undefined && cCorps.length > 0
  }

  scheduleJ1120Data = (): ScheduleJ1120Data | undefined => {
    return undefined // Would be populated from entity data
  }

  // Part I: Tax Computation

  // Line 1: Check if corporation is member of controlled group
  isControlledGroup = (): boolean => false

  // Line 2: Taxable income from Form 1120, line 30
  l2 = (): number => this.scheduleJ1120Data()?.taxableIncome ?? 0

  // Line 3: Income tax (21% flat rate)
  l3 = (): number => Math.round(this.l2() * CORPORATE_TAX_RATE)

  // Line 4: Reserved
  l4 = (): number => 0

  // Line 5a: Foreign tax credit
  l5a = (): number => this.scheduleJ1120Data()?.foreignTaxCredit ?? 0

  // Line 5b: General business credit
  l5b = (): number => this.scheduleJ1120Data()?.generalBusinessCredit ?? 0

  // Line 5c: Prior year minimum tax credit
  l5c = (): number => this.scheduleJ1120Data()?.priorYearMinimumTaxCredit ?? 0

  // Line 5d: Bond credits
  l5d = (): number => this.scheduleJ1120Data()?.bondCredits ?? 0

  // Line 5e: Total credits
  l5e = (): number =>
    sumFields([this.l5a(), this.l5b(), this.l5c(), this.l5d()])

  // Line 6: Subtract credits from tax
  l6 = (): number => Math.max(0, this.l3() - this.l5e())

  // Line 7: Personal holding company tax (if applicable)
  l7 = (): number => this.scheduleJ1120Data()?.personalHoldingCompanyTax ?? 0

  // Line 8: Recapture taxes
  recaptureInvestmentCredit = (): number =>
    this.scheduleJ1120Data()?.investmentCreditRecapture ?? 0
  recaptureLowIncomeHousing = (): number =>
    this.scheduleJ1120Data()?.lowIncomeHousingRecapture ?? 0
  recaptureSection1260 = (): number =>
    this.scheduleJ1120Data()?.section1260Recapture ?? 0

  l8 = (): number =>
    sumFields([
      this.recaptureInvestmentCredit(),
      this.recaptureLowIncomeHousing(),
      this.recaptureSection1260()
    ])

  // Line 9: Reserved
  l9 = (): number => 0

  // Line 10: Reserved
  l10 = (): number => 0

  // Line 11: Total tax
  l11 = (): number =>
    sumFields([this.l6(), this.l7(), this.l8(), this.l9(), this.l10()])

  // Part II: Payments and Refundable Credits

  // Line 12: Reserved
  l12 = (): number => 0

  // Line 13: Reserved
  l13 = (): number => 0

  // Line 14: Payments
  estimatedTaxPayments = (): number =>
    this.scheduleJ1120Data()?.estimatedTaxPayments ?? 0
  extensionPayment = (): number =>
    this.scheduleJ1120Data()?.extensionPayment ?? 0
  creditFromForm4136 = (): number =>
    this.scheduleJ1120Data()?.creditFromForm4136 ?? 0
  creditFromForm8827 = (): number =>
    this.scheduleJ1120Data()?.creditFromForm8827 ?? 0
  otherPayments = (): number => this.scheduleJ1120Data()?.otherPayments ?? 0

  l14 = (): number =>
    sumFields([
      this.estimatedTaxPayments(),
      this.extensionPayment(),
      this.creditFromForm4136(),
      this.creditFromForm8827(),
      this.otherPayments()
    ])

  // Line 15: Refundable credits
  l15 = (): number => this.scheduleJ1120Data()?.refundableFuelCredits ?? 0

  // Line 16: Total payments and credits
  l16 = (): number => this.l14() + this.l15()

  // Line 17: Estimated tax penalty
  l17 = (): number => 0 // Would be calculated based on underpayment

  // Line 18: Amount owed
  l18 = (): number => {
    const owed = this.l11() + this.l17() - this.l16()
    return Math.max(0, owed)
  }

  // Line 19: Overpayment
  l19 = (): number => {
    const over = this.l16() - this.l11() - this.l17()
    return Math.max(0, over)
  }

  // Amount to be refunded
  amountToBeRefunded = (): number => this.l19()

  // Amount to be applied to next year
  amountAppliedToNextYear = (): number => 0

  fields = (): Field[] => {
    return [
      // Part I: Tax Computation
      this.isControlledGroup(),
      this.l2(),
      this.l3(),
      CORPORATE_TAX_RATE * 100,
      this.l5a(),
      this.l5b(),
      this.l5c(),
      this.l5d(),
      this.l5e(),
      this.l6(),
      this.l7(),
      this.recaptureInvestmentCredit(),
      this.recaptureLowIncomeHousing(),
      this.recaptureSection1260(),
      this.l8(),
      this.l11(),
      // Part II: Payments
      this.estimatedTaxPayments(),
      this.extensionPayment(),
      this.creditFromForm4136(),
      this.creditFromForm8827(),
      this.otherPayments(),
      this.l14(),
      this.l15(),
      this.l16(),
      // Part III: Tax Due/Overpayment
      this.l17(),
      this.l18(),
      this.l19(),
      this.amountToBeRefunded(),
      this.amountAppliedToNextYear()
    ]
  }
}
