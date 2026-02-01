/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 656 - Offer in Compromise
 *
 * Used to propose a settlement with the IRS to pay less than the full
 * amount of tax owed. The IRS considers:
 * - Doubt as to Liability (dispute over tax owed)
 * - Doubt as to Collectibility (can't pay full amount)
 * - Effective Tax Administration (hardship or public policy)
 *
 * Key requirements:
 * - Must be current on all filing requirements
 * - Must not be in open bankruptcy
 * - Must submit Form 433-A (and 433-B for business)
 * - Non-refundable application fee ($205 for 2025)
 * - Initial payment required with offer (varies by type)
 *
 * Payment options:
 * - Lump Sum: 20% with offer, balance in 5 months
 * - Periodic Payment: First payment with offer, remaining in 6-24 months
 */

export type OfferBasis =
  | 'doubtAsToLiability'
  | 'doubtAsToCollectibility'
  | 'effectiveTaxAdministration'
export type PaymentOption = 'lumpSum' | 'periodicPayment'

export interface TaxPeriodDebt {
  taxType: 'income' | 'employment' | 'excise' | 'other'
  formNumber: string
  taxPeriod: string // e.g., "2024", "Q1 2024"
  amount: number
}

export interface OfferInCompromiseInfo {
  offerBasis: OfferBasis
  paymentOption: PaymentOption
  offerAmount: number
  applicationFee: number // $205 for 2025
  initialPayment: number // 20% for lump sum, or first periodic payment
  taxDebts: TaxPeriodDebt[]
  totalDebtOwed: number
  reasonForOffer: string
  // Financial information references
  hasF433A: boolean // Individual collection statement
  hasF433B: boolean // Business collection statement
  // Payment terms (for periodic payment)
  periodicPaymentAmount?: number
  paymentMonths?: number // 6-24 months
}

export default class F656 extends F1040Attachment {
  tag: FormTag = 'f656'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasOfferInfo()
  }

  hasOfferInfo = (): boolean => {
    return this.offerInfo() !== undefined
  }

  offerInfo = (): OfferInCompromiseInfo | undefined => {
    return this.f1040.info.offerInCompromise as
      | OfferInCompromiseInfo
      | undefined
  }

  // Section 1: Taxpayer Information (from F1040)

  // Section 2: Offer Basis
  offerBasis = (): OfferBasis =>
    this.offerInfo()?.offerBasis ?? 'doubtAsToCollectibility'

  isDoubtAsToLiability = (): boolean =>
    this.offerBasis() === 'doubtAsToLiability'
  isDoubtAsToCollectibility = (): boolean =>
    this.offerBasis() === 'doubtAsToCollectibility'
  isEffectiveTaxAdministration = (): boolean =>
    this.offerBasis() === 'effectiveTaxAdministration'

  // Section 3: Payment Options
  paymentOption = (): PaymentOption =>
    this.offerInfo()?.paymentOption ?? 'lumpSum'

  isLumpSum = (): boolean => this.paymentOption() === 'lumpSum'
  isPeriodicPayment = (): boolean => this.paymentOption() === 'periodicPayment'

  // Section 4: Offer Amount
  offerAmount = (): number => this.offerInfo()?.offerAmount ?? 0
  applicationFee = (): number => this.offerInfo()?.applicationFee ?? 205
  initialPayment = (): number => this.offerInfo()?.initialPayment ?? 0

  // For lump sum: 20% of offer amount
  lumpSumInitialPayment = (): number => {
    if (this.isLumpSum()) {
      return Math.round(this.offerAmount() * 0.2)
    }
    return 0
  }

  // For lump sum: remaining 80% due within 5 months
  lumpSumBalance = (): number => {
    if (this.isLumpSum()) {
      return this.offerAmount() - this.lumpSumInitialPayment()
    }
    return 0
  }

  // For periodic payment
  periodicPaymentAmount = (): number =>
    this.offerInfo()?.periodicPaymentAmount ?? 0
  paymentMonths = (): number => this.offerInfo()?.paymentMonths ?? 24

  // Section 5: Tax Debt Information
  taxDebts = (): TaxPeriodDebt[] => this.offerInfo()?.taxDebts ?? []

  totalDebtOwed = (): number => {
    return (
      this.offerInfo()?.totalDebtOwed ??
      this.taxDebts().reduce((sum, d) => sum + d.amount, 0)
    )
  }

  // Offer as percentage of debt
  offerPercentage = (): number => {
    const debt = this.totalDebtOwed()
    if (debt === 0) return 0
    return Math.round((this.offerAmount() / debt) * 100)
  }

  // Section 6: Supporting Forms
  hasF433A = (): boolean => this.offerInfo()?.hasF433A ?? false
  hasF433B = (): boolean => this.offerInfo()?.hasF433B ?? false

  // Section 7: Reason for Offer
  reasonForOffer = (): string => this.offerInfo()?.reasonForOffer ?? ''

  // Total amount required with submission
  totalWithSubmission = (): number => {
    return this.applicationFee() + this.initialPayment()
  }

  // Low-income certification (fee waiver eligibility)
  isLowIncome = (): boolean => {
    // Based on federal poverty guidelines - simplified check
    // Form 656-A would be used to claim low-income certification
    return false // Would need income verification
  }

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.f1040.info.taxPayer.primaryPerson.address.address ?? '',
    `${this.f1040.info.taxPayer.primaryPerson.address.city ?? ''}, ${
      this.f1040.info.taxPayer.primaryPerson.address.state ?? ''
    } ${this.f1040.info.taxPayer.primaryPerson.address.zip ?? ''}`,
    // Offer basis checkboxes
    this.isDoubtAsToLiability(),
    this.isDoubtAsToCollectibility(),
    this.isEffectiveTaxAdministration(),
    // Payment option checkboxes
    this.isLumpSum(),
    this.isPeriodicPayment(),
    // Amounts
    this.offerAmount(),
    this.applicationFee(),
    this.initialPayment(),
    // Lump sum details
    this.lumpSumInitialPayment(),
    this.lumpSumBalance(),
    // Periodic payment details
    this.periodicPaymentAmount(),
    this.paymentMonths(),
    // Debt information
    this.totalDebtOwed(),
    this.offerPercentage(),
    // Supporting forms
    this.hasF433A(),
    this.hasF433B(),
    // Reason
    this.reasonForOffer()
  ]
}
