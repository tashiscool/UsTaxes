import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 5472 - Information Return of a 25% Foreign-Owned U.S. Corporation
 * or a Foreign Corporation Engaged in a U.S. Trade or Business
 *
 * Required when:
 * 1. A 25% foreign-owned U.S. corporation has reportable transactions
 *    with a foreign or domestic related party
 * 2. A foreign corporation engaged in U.S. trade/business has
 *    reportable transactions with related parties
 *
 * Reportable transactions include:
 * - Sales and purchases of tangible property
 * - Rents and royalties paid or received
 * - Sales, purchases, and amounts paid for intangibles
 * - Consideration paid for technical and other services
 * - Commissions
 * - Interest paid and received
 * - Premiums received and paid for insurance
 * - Other amounts paid or received
 *
 * Penalties for non-filing or incorrect information: $25,000 per form
 */

export interface RelatedPartyInfo {
  name: string
  identifyingNumber: string // EIN, SSN, or foreign reference
  country: string
  relationship: 'parent' | 'subsidiary' | 'affiliate' | 'other'
  ownershipPercentage: number
  principalBusinessActivity: string
}

export interface ReportableTransactions {
  // Part IV: Monetary Transactions
  salesOfTangibleProperty: number
  purchasesOfTangibleProperty: number
  salesOfPropertyRights: number
  purchasesOfPropertyRights: number
  compensationForTechnicalServices: number
  compensationReceivedForTechnicalServices: number
  commissionsPaid: number
  commissionsReceived: number
  rentsPaid: number
  rentsReceived: number
  royaltiesPaid: number
  royaltiesReceived: number
  interestPaid: number
  interestReceived: number
  premiumsPaidForInsurance: number
  premiumsReceivedForInsurance: number
  otherAmountsPaid: number
  otherAmountsReceived: number
}

export interface Form5472Info {
  // Part I: Reporting Corporation
  corporationName: string
  corporationEin: string
  corporationAddress: string
  dateOfIncorporation: Date
  stateOfIncorporation: string
  countryOfIncorporation: string
  totalAssets: number
  principalBusinessActivity: string
  naicsCode: string
  // Part II: 25% Foreign Shareholder (if applicable)
  foreignShareholder?: RelatedPartyInfo
  // Part III: Related Party
  relatedParty: RelatedPartyInfo
  // Part IV: Transactions
  transactions: ReportableTransactions
  // Part V: Additional Information
  hasLoans: boolean
  loanBalanceOwed: number
  loanBalanceDue: number
  hasNonMonetaryTransactions: boolean
}

export default class F5472 extends F1040Attachment {
  tag: FormTag = 'f5472'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF5472Info()
  }

  hasF5472Info = (): boolean => {
    return this.f5472Info() !== undefined
  }

  f5472Info = (): Form5472Info | undefined => {
    return this.f1040.info.foreignOwnedCorpInfo as Form5472Info | undefined
  }

  // Part I: Reporting Corporation
  corporationName = (): string => this.f5472Info()?.corporationName ?? ''
  corporationEin = (): string => this.f5472Info()?.corporationEin ?? ''
  corporationAddress = (): string => this.f5472Info()?.corporationAddress ?? ''
  stateOfIncorporation = (): string =>
    this.f5472Info()?.stateOfIncorporation ?? ''
  countryOfIncorporation = (): string =>
    this.f5472Info()?.countryOfIncorporation ?? 'US'
  totalAssets = (): number => this.f5472Info()?.totalAssets ?? 0
  principalBusinessActivity = (): string =>
    this.f5472Info()?.principalBusinessActivity ?? ''
  naicsCode = (): string => this.f5472Info()?.naicsCode ?? ''

  // Part II: Foreign Shareholder
  foreignShareholder = (): RelatedPartyInfo | undefined =>
    this.f5472Info()?.foreignShareholder
  foreignShareholderName = (): string => this.foreignShareholder()?.name ?? ''
  foreignShareholderCountry = (): string =>
    this.foreignShareholder()?.country ?? ''
  foreignOwnershipPercentage = (): number =>
    this.foreignShareholder()?.ownershipPercentage ?? 0

  // Part III: Related Party
  relatedParty = (): RelatedPartyInfo | undefined =>
    this.f5472Info()?.relatedParty
  relatedPartyName = (): string => this.relatedParty()?.name ?? ''
  relatedPartyCountry = (): string => this.relatedParty()?.country ?? ''
  relatedPartyRelationship = (): string =>
    this.relatedParty()?.relationship ?? ''

  // Part IV: Transactions
  transactions = (): ReportableTransactions | undefined =>
    this.f5472Info()?.transactions

  // Line 1: Sales of tangible property to related party
  l1 = (): number => this.transactions()?.salesOfTangibleProperty ?? 0
  // Line 2: Purchases of tangible property from related party
  l2 = (): number => this.transactions()?.purchasesOfTangibleProperty ?? 0
  // Line 3: Sales of property rights to related party
  l3 = (): number => this.transactions()?.salesOfPropertyRights ?? 0
  // Line 4: Purchases of property rights from related party
  l4 = (): number => this.transactions()?.purchasesOfPropertyRights ?? 0
  // Line 5: Compensation paid for technical services
  l5 = (): number => this.transactions()?.compensationForTechnicalServices ?? 0
  // Line 6: Compensation received for technical services
  l6 = (): number =>
    this.transactions()?.compensationReceivedForTechnicalServices ?? 0
  // Line 7: Commissions paid
  l7 = (): number => this.transactions()?.commissionsPaid ?? 0
  // Line 8: Commissions received
  l8 = (): number => this.transactions()?.commissionsReceived ?? 0
  // Line 9: Rents paid
  l9 = (): number => this.transactions()?.rentsPaid ?? 0
  // Line 10: Rents received
  l10 = (): number => this.transactions()?.rentsReceived ?? 0
  // Line 11: Royalties paid
  l11 = (): number => this.transactions()?.royaltiesPaid ?? 0
  // Line 12: Royalties received
  l12 = (): number => this.transactions()?.royaltiesReceived ?? 0
  // Line 13: Interest paid
  l13 = (): number => this.transactions()?.interestPaid ?? 0
  // Line 14: Interest received
  l14 = (): number => this.transactions()?.interestReceived ?? 0
  // Line 15: Insurance premiums paid
  l15 = (): number => this.transactions()?.premiumsPaidForInsurance ?? 0
  // Line 16: Insurance premiums received
  l16 = (): number => this.transactions()?.premiumsReceivedForInsurance ?? 0
  // Line 17: Other amounts paid
  l17 = (): number => this.transactions()?.otherAmountsPaid ?? 0
  // Line 18: Other amounts received
  l18 = (): number => this.transactions()?.otherAmountsReceived ?? 0

  // Total amounts paid to related party
  totalAmountsPaid = (): number => {
    return sumFields([
      this.l1(),
      this.l3(),
      this.l5(),
      this.l7(),
      this.l9(),
      this.l11(),
      this.l13(),
      this.l15(),
      this.l17()
    ])
  }

  // Total amounts received from related party
  totalAmountsReceived = (): number => {
    return sumFields([
      this.l2(),
      this.l4(),
      this.l6(),
      this.l8(),
      this.l10(),
      this.l12(),
      this.l14(),
      this.l16(),
      this.l18()
    ])
  }

  // Part V: Additional Information
  hasLoans = (): boolean => this.f5472Info()?.hasLoans ?? false
  loanBalanceOwed = (): number => this.f5472Info()?.loanBalanceOwed ?? 0
  loanBalanceDue = (): number => this.f5472Info()?.loanBalanceDue ?? 0

  fields = (): Field[] => [
    // Part I: Reporting Corporation
    this.corporationName(),
    this.corporationEin(),
    this.corporationAddress(),
    this.f5472Info()?.dateOfIncorporation.toLocaleDateString() ?? '',
    this.stateOfIncorporation(),
    this.countryOfIncorporation(),
    this.totalAssets(),
    this.principalBusinessActivity(),
    this.naicsCode(),
    // Part II: Foreign Shareholder
    this.foreignShareholderName(),
    this.foreignShareholder()?.identifyingNumber ?? '',
    this.foreignShareholderCountry(),
    this.foreignOwnershipPercentage(),
    // Part III: Related Party
    this.relatedPartyName(),
    this.relatedParty()?.identifyingNumber ?? '',
    this.relatedPartyCountry(),
    this.relatedPartyRelationship(),
    // Part IV: Transactions
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5(),
    this.l6(),
    this.l7(),
    this.l8(),
    this.l9(),
    this.l10(),
    this.l11(),
    this.l12(),
    this.l13(),
    this.l14(),
    this.l15(),
    this.l16(),
    this.l17(),
    this.l18(),
    this.totalAmountsPaid(),
    this.totalAmountsReceived(),
    // Part V: Additional
    this.hasLoans(),
    this.loanBalanceOwed(),
    this.loanBalanceDue()
  ]
}
