import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Income1099Type } from 'ustaxes/core/data'

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

  private recipientAddressString = (): string => {
    const address = this.f1040.info.taxPayer.primaryPerson.address
    const line1 = [address.address, address.aptNo].filter(Boolean).join(' ')
    const line2 = [
      address.city,
      address.state,
      address.zip ?? address.postalCode,
      address.foreignCountry
    ]
      .filter(Boolean)
      .join(', ')

    return [line1, line2].filter(Boolean).join(', ')
  }

  private first1099G = () =>
    this.f1040.info.f1099s.find(
      (entry): entry is (typeof this.f1040.info.f1099s)[number] & {
        type: Income1099Type.G
      } => entry.type === Income1099Type.G
    )

  isNeeded = (): boolean => {
    return this.hasF1099GData()
  }

  hasF1099GData = (): boolean => {
    return this.first1099G() !== undefined
  }

  f1099GData = (): F1099GData | undefined => {
    const form1099G = this.first1099G()
    if (form1099G === undefined) {
      return undefined
    }

    const recipient = this.f1040.info.taxPayer.primaryPerson
    const form = form1099G.form

    return {
      payerName: form1099G.payer,
      payerAddress: '',
      payerTIN: '',
      payerPhone: '',
      recipientName: this.f1040.namesString(),
      recipientAddress: this.recipientAddressString(),
      recipientTIN: recipient.ssid,
      unemploymentCompensation: form.unemploymentCompensation ?? 0,
      stateLocalTaxRefund: form.stateLocalTaxRefund ?? 0,
      taxYearOfRefund: form.taxYear ?? 0,
      federalTaxWithheld: form.federalIncomeTaxWithheld ?? 0,
      rtaaPayments: form.rtaaPayments ?? 0,
      taxableGrants: form.taxableGrants ?? 0,
      agriculturePayments: form.agriculturePayments ?? 0,
      tradeOrBusinessIncome: form.tradeOrBusinessIncome ?? false,
      marketGain: form.marketGain ?? 0,
      stateTaxWithheld: form.stateTaxWithheld ?? 0,
      stateId: form.stateIdNumber ?? '',
      stateIncome: 0
    }
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
