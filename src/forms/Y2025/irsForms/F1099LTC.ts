import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 1099-LTC - Long-Term Care and Accelerated Death Benefits
 *
 * Reports payments from:
 * - Long-term care insurance contracts
 * - Accelerated death benefits from life insurance
 * - Viatical settlements
 *
 * Generally tax-free if:
 * - Paid to a chronically ill individual
 * - Used for qualified long-term care services
 * - Below the per diem limitation ($420/day in 2025)
 */

export interface F1099LTCData {
  // Payer information
  payerName: string
  payerAddress: string
  payerTIN: string
  // Policyholder information
  policyholderName: string
  policyholderAddress: string
  policyholderSSN: string
  // Insured information (if different from policyholder)
  insuredName: string
  insuredAddress: string
  insuredSSN: string
  // Account number
  accountNumber?: string
  // Payment details
  grossBenefitsPaid: number                // Box 1
  acceleratedDeathBenefits: number         // Box 2
  benefitsPaidOnPerDiemBasis: boolean      // Box 3 checkbox
  qualifiedContract: boolean               // Box 4 checkbox
  statusOfInsured: 'chronically_ill' | 'terminally_ill'  // Box 5
  dateInsuredCertified?: Date              // Date status certified
}

// 2025 per diem limitation
const PER_DIEM_LIMIT_2025 = 420

export default class F1099LTC extends F1040Attachment {
  tag: FormTag = 'f1099ltc'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF1099LTCData()
  }

  hasF1099LTCData = (): boolean => {
    return false
  }

  f1099LTCData = (): F1099LTCData | undefined => {
    return undefined
  }

  // Box 1: Gross long-term care benefits paid
  grossBenefitsPaid = (): number => {
    return this.f1099LTCData()?.grossBenefitsPaid ?? 0
  }

  // Box 2: Accelerated death benefits paid
  acceleratedDeathBenefits = (): number => {
    return this.f1099LTCData()?.acceleratedDeathBenefits ?? 0
  }

  // Box 3: Benefits paid on per diem or other periodic basis
  isPaidOnPerDiemBasis = (): boolean => {
    return this.f1099LTCData()?.benefitsPaidOnPerDiemBasis ?? false
  }

  // Box 4: Qualified contract
  isQualifiedContract = (): boolean => {
    return this.f1099LTCData()?.qualifiedContract ?? false
  }

  // Is insured chronically ill?
  isChronicallyIll = (): boolean => {
    return this.f1099LTCData()?.statusOfInsured === 'chronically_ill'
  }

  // Is insured terminally ill?
  isTerminallyIll = (): boolean => {
    return this.f1099LTCData()?.statusOfInsured === 'terminally_ill'
  }

  // Total benefits paid
  totalBenefitsPaid = (): number => {
    return this.grossBenefitsPaid() + this.acceleratedDeathBenefits()
  }

  // Calculate potentially taxable amount for per diem payments
  // Taxable if per diem exceeds daily limit and exceeds actual costs
  perDiemLimitExcess = (daysInYear = 365): number => {
    if (!this.isPaidOnPerDiemBasis()) return 0
    const annualLimit = PER_DIEM_LIMIT_2025 * daysInYear
    return Math.max(0, this.grossBenefitsPaid() - annualLimit)
  }

  // Are benefits potentially tax-free?
  potentiallyTaxFree = (): boolean => {
    // Benefits are generally tax-free if:
    // 1. Qualified contract AND
    // 2. Insured is chronically or terminally ill AND
    // 3. If per diem, doesn't exceed limit (or actual costs)
    if (!this.isQualifiedContract()) return false
    if (!this.isChronicallyIll() && !this.isTerminallyIll()) return false
    if (this.isPaidOnPerDiemBasis() && this.perDiemLimitExcess() > 0) return false
    return true
  }

  // To Form 8853 (if needed for excess per diem)
  toForm8853 = (): number => {
    return this.perDiemLimitExcess()
  }

  fields = (): Field[] => {
    const data = this.f1099LTCData()

    return [
      // Payer info
      data?.payerName ?? '',
      data?.payerAddress ?? '',
      data?.payerTIN ?? '',
      // Policyholder info
      data?.policyholderName ?? '',
      data?.policyholderAddress ?? '',
      data?.policyholderSSN ?? '',
      // Insured info
      data?.insuredName ?? '',
      data?.insuredAddress ?? '',
      data?.insuredSSN ?? '',
      data?.accountNumber ?? '',
      // Payment details
      data?.grossBenefitsPaid ?? 0,               // Box 1
      data?.acceleratedDeathBenefits ?? 0,        // Box 2
      this.isPaidOnPerDiemBasis(),                // Box 3
      this.isQualifiedContract(),                 // Box 4
      this.isChronicallyIll(),                    // Box 5 - Chronically ill
      this.isTerminallyIll(),                     // Box 5 - Terminally ill
      data?.dateInsuredCertified?.toLocaleDateString() ?? '',
      // Calculations
      this.totalBenefitsPaid(),
      this.perDiemLimitExcess(),
      this.potentiallyTaxFree(),
      this.toForm8853()
    ]
  }
}
