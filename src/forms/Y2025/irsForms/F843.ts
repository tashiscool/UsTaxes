import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 843 - Claim for Refund and Request for Abatement
 *
 * Used to claim a refund of or request abatement of:
 * - Taxes (other than income tax) that were incorrectly paid
 * - Interest, penalties, or additions to tax
 * - Fees
 *
 * Common uses:
 * - Refund of overpaid employment taxes (FICA)
 * - Abatement of penalties (reasonable cause)
 * - Refund of excise taxes
 * - Interest abatement
 *
 * NOT used for:
 * - Income tax refunds (use Form 1040-X)
 * - Estate tax refunds (use Form 843 with Form 706)
 *
 * Time limits:
 * - Generally 3 years from return due date or 2 years from payment
 * - Varies by type of tax/penalty
 */

export type ClaimType = 'refund' | 'abatement' | 'both'
export type TaxType = 'employment' | 'excise' | 'penalty' | 'interest' | 'fee' | 'other'

export interface RefundClaimInfo {
  claimType: ClaimType
  taxType: TaxType
  taxPeriodEnd: Date
  amountClaimed: number

  // Tax details
  taxFormNumber: string  // e.g., "941", "940", "720"
  taxYear: number
  taxQuarter?: number  // For quarterly returns

  // For penalty abatement
  penaltyType?: string
  reasonableC?: boolean
  firstTimeAbatement?: boolean

  // Explanation
  explanation: string
  supportingDocuments?: string[]
}

export default class F843 extends F1040Attachment {
  tag: FormTag = 'f843'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasRefundClaim()
  }

  hasRefundClaim = (): boolean => {
    return this.claimInfo() !== undefined
  }

  claimInfo = (): RefundClaimInfo | undefined => {
    return this.f1040.info.refundClaim as RefundClaimInfo | undefined
  }

  // Line 1: Your name and SSN/EIN (from F1040)

  // Line 2: Address (from F1040)

  // Line 3: Type of tax
  l3Employment = (): boolean => this.claimInfo()?.taxType === 'employment'
  l3Excise = (): boolean => this.claimInfo()?.taxType === 'excise'
  l3Other = (): boolean => {
    const type = this.claimInfo()?.taxType
    return type !== 'employment' && type !== 'excise'
  }

  // Line 4: Type of return filed
  l4 = (): string => this.claimInfo()?.taxFormNumber ?? ''

  // Line 5a: Tax period ended
  l5a = (): string => {
    return this.claimInfo()?.taxPeriodEnd?.toLocaleDateString() ?? ''
  }

  // Line 5b: Date tax paid (if claiming refund)
  l5b = (): string => ''  // Would need additional data

  // Line 6: Amount to be refunded or abated
  l6 = (): number => this.claimInfo()?.amountClaimed ?? 0

  // Line 7: Reason for claim
  l7Refund = (): boolean => {
    const type = this.claimInfo()?.claimType
    return type === 'refund' || type === 'both'
  }
  l7Abatement = (): boolean => {
    const type = this.claimInfo()?.claimType
    return type === 'abatement' || type === 'both'
  }

  // Line 8: Explanation (why refund/abatement is due)
  l8 = (): string => this.claimInfo()?.explanation ?? ''

  // Supporting information for penalty abatement

  // Reasonable cause explanation
  hasReasonableCause = (): boolean => this.claimInfo()?.reasonableC ?? false

  // First-time abatement request
  isFirstTimeAbatement = (): boolean => this.claimInfo()?.firstTimeAbatement ?? false

  // Penalty type
  penaltyDescription = (): string => this.claimInfo()?.penaltyType ?? ''

  // Supporting documents list
  supportingDocs = (): string => {
    return this.claimInfo()?.supportingDocuments?.join('; ') ?? ''
  }

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.f1040.info.taxPayer.primaryPerson.address.address,
    this.f1040.info.taxPayer.primaryPerson.address.city,
    this.f1040.info.taxPayer.primaryPerson.address.state,
    this.f1040.info.taxPayer.primaryPerson.address.zip,
    // Line 3 - Type of tax
    this.l3Employment(),
    this.l3Excise(),
    this.l3Other(),
    // Line 4
    this.l4(),
    // Line 5
    this.l5a(),
    this.l5b(),
    // Line 6
    this.l6(),
    // Line 7
    this.l7Refund(),
    this.l7Abatement(),
    // Line 8
    this.l8()
  ]
}
