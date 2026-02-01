import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 8858 - Information Return of U.S. Persons With Respect to
 * Foreign Disregarded Entities (FDEs) and Foreign Branches (FBs)
 *
 * Required for:
 * - U.S. persons who are tax owners of FDEs
 * - U.S. persons who operate foreign branches
 * - Certain CFCs, 10/50 corporations, or controlled foreign partnerships
 *   that own FDEs or operate FBs
 *
 * FDE Definition:
 * A foreign entity that is disregarded as separate from its owner
 * for U.S. tax purposes under the check-the-box regulations
 *
 * Key Information Reported:
 * - FDE/FB identifying information
 * - Separate income statement
 * - Balance sheet
 * - Transactions between FDE and related parties
 *
 * Due Date: Attached to filer's income tax return
 * Penalties: $10,000 per failure to furnish information
 */

export type FDEType = 'disregardedEntity' | 'foreignBranch'

export interface FDEIdentification {
  name: string
  referenceIDNumber: string
  address: string
  country: string
  dateOfOrganization: Date
  entityType: FDEType
  principalBusinessActivity: string
  principalBusinessCode: string
  functionalCurrency: string
}

export interface FDEIncomeStatement {
  // Income
  grossReceipts: number
  costOfGoodsSold: number
  grossProfit: number
  dividends: number
  interest: number
  grossRents: number
  grossRoyalties: number
  netGainFromAssetSales: number
  otherIncome: number
  totalIncome: number
  // Deductions
  compensation: number
  rentsPaid: number
  royaltiesPaid: number
  interestPaid: number
  depreciation: number
  depletion: number
  taxes: number
  otherDeductions: number
  totalDeductions: number
  // Net
  netIncome: number
}

export interface FDEBalanceSheet {
  // Assets
  cashAndDeposits: number
  accountsReceivable: number
  inventories: number
  otherCurrentAssets: number
  loansToShareholders: number
  investments: number
  buildingsAndEquipment: number
  depreciableAssets: number
  depletableAssets: number
  landAssets: number
  intangibleAssets: number
  otherAssets: number
  totalAssets: number
  // Liabilities
  accountsPayable: number
  shortTermBorrowing: number
  otherCurrentLiabilities: number
  loansFromShareholders: number
  longTermLiabilities: number
  otherLiabilities: number
  totalLiabilities: number
  // Equity
  ownerEquity: number
}

export interface RelatedPartyTransactions {
  salesOfInventory: number
  purchasesOfInventory: number
  salesOfProperty: number
  purchasesOfProperty: number
  compensationReceived: number
  compensationPaid: number
  rentsReceived: number
  rentsPaid: number
  royaltiesReceived: number
  royaltiesPaid: number
  interestReceived: number
  interestPaid: number
  otherReceived: number
  otherPaid: number
}

export interface Form8858Info {
  // Filer Information
  filerName: string
  filerTIN: string
  filerAddress: string
  taxYear: number
  // FDE/FB Information
  fde: FDEIdentification
  // Direct Owner
  directOwnerName: string
  directOwnerTIN?: string
  directOwnerCountry: string
  ownershipPercentage: number
  // Financial Statements
  incomeStatement: FDEIncomeStatement
  balanceSheet: FDEBalanceSheet
  // Related Party Transactions
  relatedPartyTransactions: RelatedPartyTransactions
  // Additional Information
  hasSubsidiaries: boolean
  subsidiaryCount: number
  isFirstYearFiling: boolean
  isFinalFiling: boolean
}

export default class F8858 extends F1040Attachment {
  tag: FormTag = 'f8858'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasForm8858Info()
  }

  hasForm8858Info = (): boolean => {
    return this.f8858Info() !== undefined
  }

  f8858Info = (): Form8858Info | undefined => {
    return this.f1040.info.foreignDisregardedEntity as Form8858Info | undefined
  }

  // FDE Information
  fde = (): FDEIdentification | undefined => this.f8858Info()?.fde
  fdeName = (): string => this.fde()?.name ?? ''
  fdeCountry = (): string => this.fde()?.country ?? ''
  fdeType = (): FDEType => this.fde()?.entityType ?? 'disregardedEntity'
  isDisregardedEntity = (): boolean => this.fdeType() === 'disregardedEntity'
  isForeignBranch = (): boolean => this.fdeType() === 'foreignBranch'

  // Income Statement
  incomeStatement = (): FDEIncomeStatement | undefined =>
    this.f8858Info()?.incomeStatement

  totalIncome = (): number => this.incomeStatement()?.totalIncome ?? 0
  totalDeductions = (): number => this.incomeStatement()?.totalDeductions ?? 0
  netIncome = (): number => this.incomeStatement()?.netIncome ?? 0
  grossProfit = (): number => this.incomeStatement()?.grossProfit ?? 0

  // Balance Sheet
  balanceSheet = (): FDEBalanceSheet | undefined =>
    this.f8858Info()?.balanceSheet

  totalAssets = (): number => this.balanceSheet()?.totalAssets ?? 0
  totalLiabilities = (): number => this.balanceSheet()?.totalLiabilities ?? 0
  ownerEquity = (): number => this.balanceSheet()?.ownerEquity ?? 0

  // Related Party Transactions
  relatedParty = (): RelatedPartyTransactions | undefined =>
    this.f8858Info()?.relatedPartyTransactions

  totalRelatedPartyReceived = (): number => {
    const rp = this.relatedParty()
    if (!rp) return 0
    return sumFields([
      rp.salesOfInventory,
      rp.salesOfProperty,
      rp.compensationReceived,
      rp.rentsReceived,
      rp.royaltiesReceived,
      rp.interestReceived,
      rp.otherReceived
    ])
  }

  totalRelatedPartyPaid = (): number => {
    const rp = this.relatedParty()
    if (!rp) return 0
    return sumFields([
      rp.purchasesOfInventory,
      rp.purchasesOfProperty,
      rp.compensationPaid,
      rp.rentsPaid,
      rp.royaltiesPaid,
      rp.interestPaid,
      rp.otherPaid
    ])
  }

  fields = (): Field[] => {
    const info = this.f8858Info()
    const fde = this.fde()
    const income = this.incomeStatement()
    const balance = this.balanceSheet()
    const rp = this.relatedParty()

    return [
      // Filer Information
      info?.filerName ?? '',
      info?.filerTIN ?? '',
      info?.filerAddress ?? '',
      info?.taxYear ?? 2025,
      // FDE Identification
      this.fdeName(),
      fde?.referenceIDNumber ?? '',
      fde?.address ?? '',
      this.fdeCountry(),
      fde?.dateOfOrganization.toLocaleDateString() ?? '',
      this.isDisregardedEntity(),
      this.isForeignBranch(),
      fde?.principalBusinessActivity ?? '',
      fde?.principalBusinessCode ?? '',
      fde?.functionalCurrency ?? '',
      // Direct Owner
      info?.directOwnerName ?? '',
      info?.directOwnerTIN ?? '',
      info?.directOwnerCountry ?? '',
      info?.ownershipPercentage ?? 100,
      // Income Statement
      income?.grossReceipts ?? 0,
      income?.costOfGoodsSold ?? 0,
      this.grossProfit(),
      income?.dividends ?? 0,
      income?.interest ?? 0,
      income?.grossRents ?? 0,
      income?.grossRoyalties ?? 0,
      income?.otherIncome ?? 0,
      this.totalIncome(),
      income?.compensation ?? 0,
      income?.depreciation ?? 0,
      income?.taxes ?? 0,
      income?.otherDeductions ?? 0,
      this.totalDeductions(),
      this.netIncome(),
      // Balance Sheet
      balance?.cashAndDeposits ?? 0,
      balance?.accountsReceivable ?? 0,
      balance?.inventories ?? 0,
      balance?.investments ?? 0,
      balance?.buildingsAndEquipment ?? 0,
      this.totalAssets(),
      balance?.accountsPayable ?? 0,
      balance?.longTermLiabilities ?? 0,
      this.totalLiabilities(),
      this.ownerEquity(),
      // Related Party Transactions
      rp?.salesOfInventory ?? 0,
      rp?.purchasesOfInventory ?? 0,
      rp?.compensationPaid ?? 0,
      rp?.interestPaid ?? 0,
      this.totalRelatedPartyReceived(),
      this.totalRelatedPartyPaid(),
      // Additional
      info?.hasSubsidiaries ?? false,
      info?.subsidiaryCount ?? 0,
      info?.isFirstYearFiling ?? false,
      info?.isFinalFiling ?? false
    ]
  }
}
