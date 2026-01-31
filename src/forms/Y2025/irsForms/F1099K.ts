import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 1099-K - Payment Card and Third Party Network Transactions
 *
 * Reports payments received through:
 * - Payment card transactions (credit/debit cards)
 * - Third-party network transactions (PayPal, Venmo, etc.)
 *
 * 2025 Threshold: $600 (reduced from $20,000/200 transactions)
 *
 * Common sources:
 * - eBay, Etsy, Amazon sellers
 * - Uber, Lyft drivers
 * - PayPal, Stripe, Square
 * - Airbnb hosts
 */

export interface F1099KData {
  // Filer information (payment settlement entity)
  filerName: string
  filerAddress: string
  filerTIN: string
  filerPhone: string
  // Payee information
  payeeName: string
  payeeAddress: string
  payeeTIN: string
  // Account number
  accountNumber?: string
  // Transaction information
  paymentCardIndicator: boolean      // Box 1a checkbox
  thirdPartyNetworkIndicator: boolean // Box 1b checkbox
  merchantCategoryCode?: string
  numberOfTransactions: number
  // Amounts
  grossAmount: number                // Box 1a/1b
  cardNotPresent: number             // Box 1c
  federalTaxWithheld: number         // Box 4
  // Monthly breakdown
  januaryAmount: number
  februaryAmount: number
  marchAmount: number
  aprilAmount: number
  mayAmount: number
  juneAmount: number
  julyAmount: number
  augustAmount: number
  septemberAmount: number
  octoberAmount: number
  novemberAmount: number
  decemberAmount: number
  // State information
  stateTaxWithheld: number           // Box 8
  statePayerNumber: string
  stateIncome: number
}

// 2025 reporting threshold
const REPORTING_THRESHOLD = 600

export default class F1099K extends F1040Attachment {
  tag: FormTag = 'f1099k'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF1099KData()
  }

  hasF1099KData = (): boolean => {
    return false
  }

  f1099KData = (): F1099KData | undefined => {
    return undefined
  }

  // Gross amount (Box 1a or 1b)
  grossAmount = (): number => {
    return this.f1099KData()?.grossAmount ?? 0
  }

  // Is this from payment cards?
  isPaymentCard = (): boolean => {
    return this.f1099KData()?.paymentCardIndicator ?? false
  }

  // Is this from third-party network?
  isThirdPartyNetwork = (): boolean => {
    return this.f1099KData()?.thirdPartyNetworkIndicator ?? false
  }

  // Number of transactions
  numberOfTransactions = (): number => {
    return this.f1099KData()?.numberOfTransactions ?? 0
  }

  // Card not present transactions
  cardNotPresent = (): number => {
    return this.f1099KData()?.cardNotPresent ?? 0
  }

  // Federal tax withheld
  federalTaxWithheld = (): number => {
    return this.f1099KData()?.federalTaxWithheld ?? 0
  }

  // Monthly total verification
  monthlyTotal = (): number => {
    const data = this.f1099KData()
    if (!data) return 0
    return data.januaryAmount + data.februaryAmount + data.marchAmount +
           data.aprilAmount + data.mayAmount + data.juneAmount +
           data.julyAmount + data.augustAmount + data.septemberAmount +
           data.octoberAmount + data.novemberAmount + data.decemberAmount
  }

  // This typically goes to Schedule C (self-employment) or Schedule 1
  toScheduleC = (): number => this.grossAmount()

  fields = (): Field[] => {
    const data = this.f1099KData()

    return [
      // Filer info
      data?.filerName ?? '',
      data?.filerAddress ?? '',
      data?.filerTIN ?? '',
      data?.filerPhone ?? '',
      // Payee info
      data?.payeeName ?? '',
      data?.payeeAddress ?? '',
      data?.payeeTIN ?? '',
      data?.accountNumber ?? '',
      // Transaction type
      this.isPaymentCard(),
      this.isThirdPartyNetwork(),
      data?.merchantCategoryCode ?? '',
      this.numberOfTransactions(),
      // Amounts
      this.grossAmount(),
      this.cardNotPresent(),
      data?.federalTaxWithheld ?? 0,
      // Monthly
      data?.januaryAmount ?? 0,
      data?.februaryAmount ?? 0,
      data?.marchAmount ?? 0,
      data?.aprilAmount ?? 0,
      data?.mayAmount ?? 0,
      data?.juneAmount ?? 0,
      data?.julyAmount ?? 0,
      data?.augustAmount ?? 0,
      data?.septemberAmount ?? 0,
      data?.octoberAmount ?? 0,
      data?.novemberAmount ?? 0,
      data?.decemberAmount ?? 0,
      // State
      data?.stateTaxWithheld ?? 0,
      data?.statePayerNumber ?? '',
      data?.stateIncome ?? 0,
      // Verification
      this.monthlyTotal(),
      REPORTING_THRESHOLD
    ]
  }
}
