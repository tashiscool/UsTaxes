import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 1099-G - Certain Government Payments
 *
 * Reports payments from government agencies:
 * - Unemployment compensation
 * - State or local income tax refunds
 * - Agricultural payments
 * - Taxable grants
 * - RTAA payments (trade adjustment assistance)
 *
 * Key for:
 * - Unemployment → Form 1040 Schedule 1 Line 7
 * - State tax refunds → May be taxable if you itemized
 */

export interface F1099GData {
  // Payer (government agency)
  payerName: string
  payerAddress: string
  payerTIN: string
  payerPhone: string
  // Recipient
  recipientName: string
  recipientAddress: string
  recipientTIN: string
  // Account number
  accountNumber?: string
  // Payments
  unemploymentCompensation: number // Box 1
  stateLocalTaxRefund: number // Box 2
  taxYearOfRefund: number // Box 3
  federalTaxWithheld: number // Box 4
  rtaaPayments: number // Box 5
  taxableGrants: number // Box 6
  agriculturePayments: number // Box 7
  tradeOrBusinessIncome: boolean // Box 8 checkbox
  marketGain: number // Box 9
  // State
  stateTaxWithheld: number // Box 10a
  stateId: string // Box 10b
  stateIncome: number // Box 11
}

export default class F1099G extends F1040Attachment {
  tag: FormTag = 'f1099g'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF1099GData()
  }

  hasF1099GData = (): boolean => {
    return false
  }

  f1099GData = (): F1099GData | undefined => {
    return undefined
  }

  // Box 1: Unemployment compensation → Schedule 1 Line 7
  unemploymentCompensation = (): number => {
    return this.f1099GData()?.unemploymentCompensation ?? 0
  }

  // Box 2: State/local tax refund → May be taxable
  stateLocalTaxRefund = (): number => {
    return this.f1099GData()?.stateLocalTaxRefund ?? 0
  }

  // Box 4: Federal tax withheld
  federalTaxWithheld = (): number => {
    return this.f1099GData()?.federalTaxWithheld ?? 0
  }

  // Box 5: RTAA payments
  rtaaPayments = (): number => {
    return this.f1099GData()?.rtaaPayments ?? 0
  }

  // Box 6: Taxable grants
  taxableGrants = (): number => {
    return this.f1099GData()?.taxableGrants ?? 0
  }

  // Box 7: Agriculture payments
  agriculturePayments = (): number => {
    return this.f1099GData()?.agriculturePayments ?? 0
  }

  // To Schedule 1 Line 7 (unemployment)
  toSchedule1Line7 = (): number => this.unemploymentCompensation()

  // Is state refund taxable? (Depends on whether taxpayer itemized)
  isStateRefundTaxable = (): boolean => {
    // Would need to check prior year return
    return this.stateLocalTaxRefund() > 0
  }

  // To Schedule 1 Line 1 (if itemized last year)
  toSchedule1Line1 = (): number => {
    // Only taxable if taxpayer itemized deductions last year
    return this.stateLocalTaxRefund()
  }

  fields = (): Field[] => {
    const data = this.f1099GData()

    return [
      // Payer info
      data?.payerName ?? '',
      data?.payerAddress ?? '',
      data?.payerTIN ?? '',
      data?.payerPhone ?? '',
      // Recipient info
      data?.recipientName ?? '',
      data?.recipientAddress ?? '',
      data?.recipientTIN ?? '',
      data?.accountNumber ?? '',
      // Payments
      data?.unemploymentCompensation ?? 0, // Box 1
      data?.stateLocalTaxRefund ?? 0, // Box 2
      data?.taxYearOfRefund ?? 0, // Box 3
      data?.federalTaxWithheld ?? 0, // Box 4
      data?.rtaaPayments ?? 0, // Box 5
      data?.taxableGrants ?? 0, // Box 6
      data?.agriculturePayments ?? 0, // Box 7
      data?.tradeOrBusinessIncome ?? false, // Box 8
      data?.marketGain ?? 0, // Box 9
      // State
      data?.stateTaxWithheld ?? 0,
      data?.stateId ?? '',
      data?.stateIncome ?? 0,
      // Routing
      this.toSchedule1Line7(),
      this.isStateRefundTaxable(),
      this.toSchedule1Line1()
    ]
  }
}
