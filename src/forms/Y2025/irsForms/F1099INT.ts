import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 1099-INT - Interest Income
 *
 * Reports interest income from:
 * - Banks and savings institutions
 * - Brokerages
 * - Bonds
 * - Notes
 * - US Savings Bonds
 *
 * Key boxes:
 * - Box 1: Interest income → Schedule B, Form 1040 Line 2b
 * - Box 2: Early withdrawal penalty → Schedule 1 Line 18
 * - Box 3: Interest on US Savings Bonds → May be excludable for education
 * - Box 4: Federal tax withheld
 * - Box 8: Tax-exempt interest → Form 1040 Line 2a
 */

export interface F1099INTData {
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
  // FATCA filing requirement
  fatcaFilingRequired: boolean
  // Interest amounts
  interestIncome: number                    // Box 1
  earlyWithdrawalPenalty: number            // Box 2
  interestOnUSSavingsBonds: number          // Box 3
  federalTaxWithheld: number                // Box 4
  investmentExpenses: number                // Box 5
  foreignTaxPaid: number                    // Box 6
  foreignCountry: string                    // Box 7
  taxExemptInterest: number                 // Box 8
  privateActivityBondInterest: number       // Box 9
  marketDiscount: number                    // Box 10
  bondPremium: number                       // Box 11
  bondPremiumTreasury: number               // Box 12
  bondPremiumTaxExempt: number              // Box 13
  taxExemptCUSIP: string                    // Box 14
  // State tax
  stateTaxWithheld: number                  // Box 15
  stateId: string                           // Box 16
  stateInterest: number                     // Box 17
}

export default class F1099INT extends F1040Attachment {
  tag: FormTag = 'f1099int'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF1099INTData()
  }

  hasF1099INTData = (): boolean => {
    return false
  }

  f1099INTData = (): F1099INTData | undefined => {
    return undefined
  }

  // Box 1: Interest income → Form 1040 Line 2b
  interestIncome = (): number => {
    return this.f1099INTData()?.interestIncome ?? 0
  }

  // Box 2: Early withdrawal penalty → Schedule 1 Line 18
  earlyWithdrawalPenalty = (): number => {
    return this.f1099INTData()?.earlyWithdrawalPenalty ?? 0
  }

  // Box 3: Interest on US Savings Bonds
  interestOnUSSavingsBonds = (): number => {
    return this.f1099INTData()?.interestOnUSSavingsBonds ?? 0
  }

  // Box 4: Federal tax withheld
  federalTaxWithheld = (): number => {
    return this.f1099INTData()?.federalTaxWithheld ?? 0
  }

  // Box 6: Foreign tax paid → Form 1116
  foreignTaxPaid = (): number => {
    return this.f1099INTData()?.foreignTaxPaid ?? 0
  }

  // Box 8: Tax-exempt interest → Form 1040 Line 2a
  taxExemptInterest = (): number => {
    return this.f1099INTData()?.taxExemptInterest ?? 0
  }

  // Box 9: Private activity bond interest → May be AMT preference
  privateActivityBondInterest = (): number => {
    return this.f1099INTData()?.privateActivityBondInterest ?? 0
  }

  // Taxable interest (Box 1 + Box 3)
  totalTaxableInterest = (): number => {
    return this.interestIncome() + this.interestOnUSSavingsBonds()
  }

  // To Form 1040 Line 2b
  toForm1040Line2b = (): number => this.totalTaxableInterest()

  // To Form 1040 Line 2a (tax-exempt)
  toForm1040Line2a = (): number => this.taxExemptInterest()

  // To Schedule 1 Line 18 (penalty)
  toSchedule1Line18 = (): number => this.earlyWithdrawalPenalty()

  fields = (): Field[] => {
    const data = this.f1099INTData()

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
      data?.fatcaFilingRequired ?? false,
      // Interest amounts
      data?.interestIncome ?? 0,                    // Box 1
      data?.earlyWithdrawalPenalty ?? 0,            // Box 2
      data?.interestOnUSSavingsBonds ?? 0,          // Box 3
      data?.federalTaxWithheld ?? 0,                // Box 4
      data?.investmentExpenses ?? 0,                // Box 5
      data?.foreignTaxPaid ?? 0,                    // Box 6
      data?.foreignCountry ?? '',                   // Box 7
      data?.taxExemptInterest ?? 0,                 // Box 8
      data?.privateActivityBondInterest ?? 0,       // Box 9
      data?.marketDiscount ?? 0,                    // Box 10
      data?.bondPremium ?? 0,                       // Box 11
      data?.bondPremiumTreasury ?? 0,               // Box 12
      data?.bondPremiumTaxExempt ?? 0,              // Box 13
      data?.taxExemptCUSIP ?? '',                   // Box 14
      // State
      data?.stateTaxWithheld ?? 0,
      data?.stateId ?? '',
      data?.stateInterest ?? 0,
      // Routing
      this.toForm1040Line2b(),
      this.toForm1040Line2a(),
      this.toSchedule1Line18()
    ]
  }
}
