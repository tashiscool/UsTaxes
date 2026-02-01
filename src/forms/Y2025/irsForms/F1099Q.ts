import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 1099-Q - Payments From Qualified Education Programs
 * (Under Sections 529 and 530)
 *
 * Reports distributions from:
 * - 529 plans (qualified tuition programs)
 * - Coverdell Education Savings Accounts (ESAs)
 *
 * Distributions are tax-free if used for qualified education expenses.
 * Earnings portion may be taxable if not used for qualified expenses.
 */

export interface F1099QData {
  // Payer (plan administrator)
  payerName: string
  payerAddress: string
  payerTIN: string
  // Recipient
  recipientName: string
  recipientAddress: string
  recipientTIN: string
  // Designated beneficiary
  beneficiaryName: string
  beneficiarySSN: string
  // Account number
  accountNumber?: string
  // Distribution details
  grossDistribution: number // Box 1
  earnings: number // Box 2
  basis: number // Box 3
  trusteeToTrusteeTransfer: boolean // Box 4 checkbox
  // Account type
  is529Plan: boolean // Box 5 checkbox for 529
  isCoverdellESA: boolean // Box 5 checkbox for Coverdell
  // Designated beneficiary is not the recipient
  beneficiaryNotRecipient: boolean // Box 6 checkbox
}

export default class F1099Q extends F1040Attachment {
  tag: FormTag = 'f1099q'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF1099QData()
  }

  hasF1099QData = (): boolean => {
    return false
  }

  f1099QData = (): F1099QData | undefined => {
    return undefined
  }

  // Box 1: Gross distribution
  grossDistribution = (): number => {
    return this.f1099QData()?.grossDistribution ?? 0
  }

  // Box 2: Earnings
  earnings = (): number => {
    return this.f1099QData()?.earnings ?? 0
  }

  // Box 3: Basis (non-taxable return of contributions)
  basis = (): number => {
    return this.f1099QData()?.basis ?? 0
  }

  // Box 4: Trustee-to-trustee transfer
  isTrusteeToTrusteeTransfer = (): boolean => {
    return this.f1099QData()?.trusteeToTrusteeTransfer ?? false
  }

  // Is this a 529 plan?
  is529Plan = (): boolean => {
    return this.f1099QData()?.is529Plan ?? false
  }

  // Is this a Coverdell ESA?
  isCoverdellESA = (): boolean => {
    return this.f1099QData()?.isCoverdellESA ?? false
  }

  // Beneficiary info
  beneficiaryName = (): string => {
    return this.f1099QData()?.beneficiaryName ?? ''
  }

  // Is distribution potentially taxable?
  // Taxable if earnings are not used for qualified education expenses
  potentiallyTaxableEarnings = (): number => {
    if (this.isTrusteeToTrusteeTransfer()) return 0
    return this.earnings()
  }

  // The earnings portion may be subject to 10% penalty if not for qualified expenses
  potentialPenalty = (): number => {
    return Math.round(this.potentiallyTaxableEarnings() * 0.1)
  }

  fields = (): Field[] => {
    const data = this.f1099QData()

    return [
      // Payer info
      data?.payerName ?? '',
      data?.payerAddress ?? '',
      data?.payerTIN ?? '',
      // Recipient info
      data?.recipientName ?? '',
      data?.recipientAddress ?? '',
      data?.recipientTIN ?? '',
      data?.accountNumber ?? '',
      // Beneficiary
      data?.beneficiaryName ?? '',
      data?.beneficiarySSN ?? '',
      data?.beneficiaryNotRecipient ?? false, // Box 6
      // Distribution details
      data?.grossDistribution ?? 0, // Box 1
      data?.earnings ?? 0, // Box 2
      data?.basis ?? 0, // Box 3
      data?.trusteeToTrusteeTransfer ?? false, // Box 4
      // Account type
      this.is529Plan(),
      this.isCoverdellESA(),
      // Analysis
      this.potentiallyTaxableEarnings(),
      this.potentialPenalty()
    ]
  }
}
