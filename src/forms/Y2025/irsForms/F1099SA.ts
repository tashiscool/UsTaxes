/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 1099-SA - Distributions From an HSA, Archer MSA, or Medicare Advantage MSA
 *
 * Reports distributions from:
 * - Health Savings Accounts (HSAs)
 * - Archer Medical Savings Accounts
 * - Medicare Advantage MSAs
 *
 * Distributions are tax-free if used for qualified medical expenses.
 * May be taxable and subject to penalty if not for qualified expenses.
 */

export interface F1099SAData {
  // Payer (custodian/trustee)
  payerName: string
  payerAddress: string
  payerTIN: string
  // Recipient
  recipientName: string
  recipientAddress: string
  recipientTIN: string
  // Account number
  accountNumber?: string
  // Distribution details
  grossDistribution: number // Box 1
  earnings: number // Box 2 (Archer MSA only)
  distributionCode: string // Box 3
  fairMarketValue: number // Box 4
  // Account type
  isHSA: boolean // Box 5a
  isArcherMSA: boolean // Box 5b
  isMedicareAdvantageMSA: boolean // Box 5c
}

// Distribution codes
const DISTRIBUTION_CODES: Record<string, string> = {
  '1': 'Normal distribution',
  '2': 'Excess contributions',
  '3': 'Disability',
  '4': 'Death (other than 6)',
  '5': 'Prohibited transaction',
  '6': 'Death distribution to spouse beneficiary'
}

export default class F1099SA extends F1040Attachment {
  tag: FormTag = 'f1099sa'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF1099SAData()
  }

  hasF1099SAData = (): boolean => {
    return false
  }

  f1099SAData = (): F1099SAData | undefined => {
    return undefined
  }

  // Box 1: Gross distribution
  grossDistribution = (): number => {
    return this.f1099SAData()?.grossDistribution ?? 0
  }

  // Box 2: Earnings (Archer MSA only)
  earnings = (): number => {
    return this.f1099SAData()?.earnings ?? 0
  }

  // Box 3: Distribution code
  distributionCode = (): string => {
    return this.f1099SAData()?.distributionCode ?? ''
  }

  distributionCodeDescription = (): string => {
    return DISTRIBUTION_CODES[this.distributionCode()] ?? 'Unknown'
  }

  // Box 4: FMV at year end
  fairMarketValue = (): number => {
    return this.f1099SAData()?.fairMarketValue ?? 0
  }

  // Account type
  isHSA = (): boolean => {
    return this.f1099SAData()?.isHSA ?? false
  }

  isArcherMSA = (): boolean => {
    return this.f1099SAData()?.isArcherMSA ?? false
  }

  isMedicareAdvantageMSA = (): boolean => {
    return this.f1099SAData()?.isMedicareAdvantageMSA ?? false
  }

  // Is this a normal distribution?
  isNormalDistribution = (): boolean => {
    return this.distributionCode() === '1'
  }

  // Is this taxable? (Depends on whether used for qualified medical expenses)
  potentiallyTaxable = (): boolean => {
    // Code 1 distributions may be taxable if not for qualified expenses
    return this.isNormalDistribution()
  }

  // Potential 20% penalty (HSA) or 50% penalty (MSA) if not for qualified expenses
  potentialPenaltyRate = (): number => {
    if (this.isHSA()) return 0.2
    if (this.isArcherMSA() || this.isMedicareAdvantageMSA()) return 0.5
    return 0
  }

  potentialPenalty = (): number => {
    return Math.round(this.grossDistribution() * this.potentialPenaltyRate())
  }

  // To Form 8889 (HSA) or Form 8853 (MSA)
  toForm8889 = (): number => (this.isHSA() ? this.grossDistribution() : 0)
  toForm8853 = (): number =>
    this.isArcherMSA() || this.isMedicareAdvantageMSA()
      ? this.grossDistribution()
      : 0

  fields = (): Field[] => {
    const data = this.f1099SAData()

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
      // Distribution details
      data?.grossDistribution ?? 0, // Box 1
      data?.earnings ?? 0, // Box 2
      data?.distributionCode ?? '', // Box 3
      data?.fairMarketValue ?? 0, // Box 4
      // Account type
      this.isHSA(),
      this.isArcherMSA(),
      this.isMedicareAdvantageMSA(),
      // Analysis
      this.distributionCodeDescription(),
      this.isNormalDistribution(),
      this.potentiallyTaxable(),
      this.potentialPenaltyRate(),
      this.potentialPenalty(),
      // Routing
      this.toForm8889(),
      this.toForm8853()
    ]
  }
}
