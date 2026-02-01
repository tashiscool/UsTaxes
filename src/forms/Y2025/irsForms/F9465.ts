import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 9465 - Installment Agreement Request
 *
 * Used by taxpayers who cannot pay their full tax liability to request
 * a monthly payment plan with the IRS.
 *
 * Types of agreements:
 * - Guaranteed: Tax owed ≤ $10,000, can pay in 3 years, filed/paid on time for 5 years
 * - Streamlined: Tax owed ≤ $50,000, can pay in 72 months
 * - Non-streamlined: Tax owed > $50,000 or need more than 72 months
 *
 * 2025 Rules:
 * - User fee: $225 (or $107 for low income, $31 for Direct Debit)
 * - Penalty continues to accrue at reduced rate (0.25%/month vs 0.5%/month)
 * - Interest continues to accrue
 */

export interface InstallmentAgreementInfo {
  amountOwed: number
  proposedMonthlyPayment: number
  paymentDueDay: number // Day of month (1-28)
  useDirectDebit: boolean
  bankRoutingNumber?: string
  bankAccountNumber?: string
  accountType?: 'checking' | 'savings'
  employerName?: string
  employerAddress?: string
  employerPhone?: string
}

export default class F9465 extends F1040Attachment {
  tag: FormTag = 'f9465'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    // Form is needed if taxpayer owes money and wants installment plan
    return this.f1040.l37() > 0 && this.hasInstallmentRequest()
  }

  hasInstallmentRequest = (): boolean => {
    return this.installmentInfo() !== undefined
  }

  installmentInfo = (): InstallmentAgreementInfo | undefined => {
    return this.f1040.info.installmentAgreement as
      | InstallmentAgreementInfo
      | undefined
  }

  // Line 1-6: Personal information from F1040

  // Line 7: Tax return type
  taxReturnType = (): string => '1040'

  // Line 8: Tax period (year)
  taxPeriod = (): string => '2025'

  // Line 9: Amount you owe (from Form 1040 line 37)
  l9 = (): number => this.f1040.l37()

  // Line 10: Additional balances owed (from other years/forms)
  l10 = (): number => this.installmentInfo()?.amountOwed ?? 0

  // Line 11a: Total amount you owe (lines 9 + 10)
  l11a = (): number => this.l9() + this.l10()

  // Line 11b: Amount you can pay now
  l11b = (): number => 0 // User-specified

  // Line 12: Balance to be paid in installments (11a - 11b)
  l12 = (): number => Math.max(0, this.l11a() - this.l11b())

  // Line 13: Monthly payment amount
  l13 = (): number => {
    const info = this.installmentInfo()
    if (info?.proposedMonthlyPayment) return info.proposedMonthlyPayment

    // Default: divide by 72 months (maximum for streamlined)
    return Math.ceil(this.l12() / 72)
  }

  // Line 14: Day of month for payment (1-28)
  l14 = (): number => this.installmentInfo()?.paymentDueDay ?? 15

  // Check if qualifies for guaranteed agreement
  qualifiesForGuaranteed = (): boolean => {
    // Tax owed ≤ $10,000
    // Can pay within 3 years
    // Filed and paid on time for last 5 years (assumed)
    return this.l12() <= 10000 && this.l13() >= this.l12() / 36
  }

  // Check if qualifies for streamlined agreement
  qualifiesForStreamlined = (): boolean => {
    // Tax owed ≤ $50,000
    // Can pay within 72 months
    return this.l12() <= 50000 && this.l13() >= this.l12() / 72
  }

  // Direct Debit information
  useDirectDebit = (): boolean =>
    this.installmentInfo()?.useDirectDebit ?? false

  // Line 15a: Bank routing number
  l15a = (): string => this.installmentInfo()?.bankRoutingNumber ?? ''

  // Line 15b: Bank account number
  l15b = (): string => this.installmentInfo()?.bankAccountNumber ?? ''

  // Line 15c: Account type
  l15cChecking = (): boolean =>
    this.installmentInfo()?.accountType === 'checking'
  l15cSavings = (): boolean => this.installmentInfo()?.accountType === 'savings'

  // Employment information (for non-streamlined)
  employerName = (): string => this.installmentInfo()?.employerName ?? ''
  employerAddress = (): string => this.installmentInfo()?.employerAddress ?? ''
  employerPhone = (): string => this.installmentInfo()?.employerPhone ?? ''

  // Calculate estimated user fee
  userFee = (): number => {
    if (this.useDirectDebit()) return 31
    // Low income rate would be $107, but requires additional verification
    return 225
  }

  // Calculate months to pay off
  monthsToPay = (): number => {
    if (this.l13() <= 0) return 0
    return Math.ceil(this.l12() / this.l13())
  }

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.f1040.info.taxPayer.primaryPerson.address.address,
    this.f1040.info.taxPayer.primaryPerson.address.city,
    this.f1040.info.taxPayer.primaryPerson.address.state,
    this.f1040.info.taxPayer.primaryPerson.address.zip,
    this.f1040.info.taxPayer.spouse?.ssid ?? '',
    // Tax return info
    this.taxReturnType(),
    this.taxPeriod(),
    // Amounts
    this.l9(),
    this.l10(),
    this.l11a(),
    this.l11b(),
    this.l12(),
    this.l13(),
    this.l14(),
    // Direct Debit
    this.useDirectDebit(),
    this.l15a(),
    this.l15b(),
    this.l15cChecking(),
    this.l15cSavings(),
    // Employment
    this.employerName(),
    this.employerAddress(),
    this.employerPhone()
  ]
}
