import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { AccountType } from 'ustaxes/core/data'

/**
 * Form 8888 - Allocation of Refund (Including Savings Bond Purchases)
 *
 * Use this form to:
 * - Split your refund and have it directly deposited into two or three accounts
 * - Buy up to $5,000 in paper Series I savings bonds with your refund
 *
 * Requirements:
 * - Must have a refund to split
 * - Each account must be in the taxpayer's name
 * - Can deposit into checking, savings, or IRA accounts
 * - Can purchase I bonds in multiples of $50
 */

export interface RefundAllocation {
  routingNumber: string
  accountNumber: string
  accountType: AccountType
  amount: number
  isBondPurchase?: boolean
}

export default class F8888 extends F1040Attachment {
  tag: FormTag = 'f8888'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    // Needed if user wants to split refund into multiple accounts
    const allocations = this.refundAllocations()
    return allocations.length > 1 || allocations.some((a) => a.isBondPurchase)
  }

  refundAllocations = (): RefundAllocation[] => {
    return (
      (this.f1040.info.refundAllocations as RefundAllocation[] | undefined) ??
      []
    )
  }

  // Total refund amount (from Form 1040 line 34)
  totalRefund = (): number => this.f1040.l34()

  // Part I - Direct Deposit

  // Line 1a-c: First account allocation
  l1a = (): number => this.refundAllocations()[0]?.amount ?? 0
  l1b = (): string => this.refundAllocations()[0]?.routingNumber ?? ''
  l1c = (): string => this.refundAllocations()[0]?.accountNumber ?? ''
  l1d = (): AccountType | undefined => this.refundAllocations()[0]?.accountType

  // Line 2a-c: Second account allocation
  l2a = (): number => this.refundAllocations()[1]?.amount ?? 0
  l2b = (): string => this.refundAllocations()[1]?.routingNumber ?? ''
  l2c = (): string => this.refundAllocations()[1]?.accountNumber ?? ''
  l2d = (): AccountType | undefined => this.refundAllocations()[1]?.accountType

  // Line 3a-c: Third account allocation
  l3a = (): number => this.refundAllocations()[2]?.amount ?? 0
  l3b = (): string => this.refundAllocations()[2]?.routingNumber ?? ''
  l3c = (): string => this.refundAllocations()[2]?.accountNumber ?? ''
  l3d = (): AccountType | undefined => this.refundAllocations()[2]?.accountType

  // Part II - U.S. Series I Savings Bond Purchases

  // Line 4: Amount to be used to buy paper Series I savings bonds
  l4 = (): number => {
    const bondAllocation = this.refundAllocations().find(
      (a) => a.isBondPurchase
    )
    return bondAllocation?.amount ?? 0
  }

  // Line 5a-c: Bond registration info (owner name)
  l5a = (): string => this.f1040.info.taxPayer.primaryPerson.firstName ?? ''
  l5b = (): string => this.f1040.info.taxPayer.primaryPerson.lastName ?? ''
  l5c = (): string => this.f1040.info.taxPayer.primaryPerson.ssid ?? ''

  // Validation: total allocations must equal total refund
  isValid = (): boolean => {
    const allocations = this.refundAllocations()
    const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0)
    return Math.abs(totalAllocated - this.totalRefund()) < 0.01
  }

  // Total of all allocations
  totalAllocated = (): number => {
    return this.l1a() + this.l2a() + this.l3a() + this.l4()
  }

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Part I - Direct Deposit
    this.l1a(),
    this.l1b(),
    this.l1c(),
    this.l1d() === AccountType.checking,
    this.l1d() === AccountType.savings,
    this.l2a(),
    this.l2b(),
    this.l2c(),
    this.l2d() === AccountType.checking,
    this.l2d() === AccountType.savings,
    this.l3a(),
    this.l3b(),
    this.l3c(),
    this.l3d() === AccountType.checking,
    this.l3d() === AccountType.savings,
    // Part II - Savings Bonds
    this.l4(),
    this.l5a(),
    this.l5b(),
    this.l5c()
  ]
}
