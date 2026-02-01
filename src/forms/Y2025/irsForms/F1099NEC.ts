import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 1099-NEC - Nonemployee Compensation
 *
 * Reports nonemployee compensation of $600 or more.
 * This form was reintroduced in 2020 (previously part of 1099-MISC Box 7).
 *
 * Used for:
 * - Independent contractor payments
 * - Self-employment income
 * - Professional services fees
 * - Commissions to non-employees
 *
 * Income reported here typically goes to Schedule C or Schedule C-EZ.
 */

export interface F1099NECData {
  // Payer information
  payerName: string
  payerAddress: string
  payerTIN: string
  payerPhone: string
  // Recipient information
  recipientName: string
  recipientAddress: string
  recipientTIN: string
  // Account number
  accountNumber?: string
  // Amounts
  nonemployeeCompensation: number // Box 1
  directSalesIndicator: boolean // Box 2 (checkbox)
  federalTaxWithheld: number // Box 4
  // State information
  stateTaxWithheld1: number // Box 5
  statePayerNumber1: string // Box 6
  stateIncome1: number // Box 7
  stateTaxWithheld2?: number
  statePayerNumber2?: string
  stateIncome2?: number
}

export default class F1099NEC extends F1040Attachment {
  tag: FormTag = 'f1099nec'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF1099NECData()
  }

  hasF1099NECData = (): boolean => {
    return false // Would check for 1099-NEC data
  }

  f1099NECData = (): F1099NECData | undefined => {
    return undefined
  }

  // Nonemployee compensation (Box 1)
  nonemployeeCompensation = (): number => {
    return this.f1099NECData()?.nonemployeeCompensation ?? 0
  }

  // This income goes to Schedule C Line 1
  toScheduleCLine1 = (): number => this.nonemployeeCompensation()

  // Federal tax withheld
  federalTaxWithheld = (): number => {
    return this.f1099NECData()?.federalTaxWithheld ?? 0
  }

  // Is this direct sales?
  isDirectSales = (): boolean => {
    return this.f1099NECData()?.directSalesIndicator ?? false
  }

  // State tax withheld
  stateTaxWithheld = (): number => {
    const data = this.f1099NECData()
    return (data?.stateTaxWithheld1 ?? 0) + (data?.stateTaxWithheld2 ?? 0)
  }

  fields = (): Field[] => {
    const data = this.f1099NECData()

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
      // Amounts
      data?.nonemployeeCompensation ?? 0, // Box 1
      data?.directSalesIndicator ?? false, // Box 2
      data?.federalTaxWithheld ?? 0, // Box 4
      // State 1
      data?.stateTaxWithheld1 ?? 0, // Box 5
      data?.statePayerNumber1 ?? '', // Box 6
      data?.stateIncome1 ?? 0, // Box 7
      // State 2
      data?.stateTaxWithheld2 ?? 0,
      data?.statePayerNumber2 ?? '',
      data?.stateIncome2 ?? 0,
      // To Schedule C
      this.toScheduleCLine1()
    ]
  }
}
