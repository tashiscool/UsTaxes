import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 3520-A - Annual Information Return of Foreign Trust With a U.S. Owner
 *
 * Filed by foreign trusts with U.S. owners to provide:
 * - Trust accounting information
 * - Foreign Grantor Trust Owner Statement
 * - Foreign Grantor Trust Beneficiary Statement
 *
 * Filing Requirements:
 * - Must be filed by the trustee of the foreign trust
 * - If trustee fails to file, the U.S. owner must file a substitute Form 3520-A
 *
 * Due Date: March 15 (15th day of 3rd month after end of trust's tax year)
 *
 * Penalties:
 * - 5% of gross value of trust assets for each month (up to 12 months)
 * - Or $10,000 for failure to file required information
 */

export interface TrusteeInfo {
  name: string
  address: string
  country: string
  tin?: string
  isUSPerson: boolean
}

export interface USOwnerInfo {
  name: string
  tin: string
  address: string
  ownershipPercentage: number
  portionOfIncome: number
  portionOfDeductions: number
  portionOfCredits: number
}

export interface TrustBeneficiary {
  name: string
  tin?: string
  address: string
  country: string
  isUSPerson: boolean
  distributionAmount: number
  isCurrentBeneficiary: boolean
  isRemainderBeneficiary: boolean
}

export interface TrustAccountingInfo {
  // Income
  interestIncome: number
  dividendIncome: number
  capitalGains: number
  rentalIncome: number
  royaltyIncome: number
  businessIncome: number
  otherIncome: number
  // Deductions
  interestExpense: number
  taxes: number
  trusteeFees: number
  professionalFees: number
  otherDeductions: number
  // Assets
  cashAndEquivalents: number
  investments: number
  realProperty: number
  otherAssets: number
  totalAssets: number
  // Liabilities
  totalLiabilities: number
}

export interface Form3520AInfo {
  // Trust Information
  trustName: string
  trustEIN?: string
  trustAddress: string
  trustCountry: string
  trustTaxYear: number
  dateCreated: Date
  // Trustee
  trustee: TrusteeInfo
  // U.S. Owners
  usOwners: USOwnerInfo[]
  // Beneficiaries
  beneficiaries: TrustBeneficiary[]
  // Accounting
  accounting: TrustAccountingInfo
  // Filing information
  isSubstituteReturn: boolean
  isFinalReturn: boolean
  isAmendedReturn: boolean
}

export default class F3520A extends F1040Attachment {
  tag: FormTag = 'f3520a'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasForm3520AInfo()
  }

  hasForm3520AInfo = (): boolean => {
    return this.f3520AInfo() !== undefined
  }

  f3520AInfo = (): Form3520AInfo | undefined => {
    return this.f1040.info.foreignTrustAnnualReturn as Form3520AInfo | undefined
  }

  // Trust Information
  trustName = (): string => this.f3520AInfo()?.trustName ?? ''
  trustEIN = (): string => this.f3520AInfo()?.trustEIN ?? ''
  trustCountry = (): string => this.f3520AInfo()?.trustCountry ?? ''

  // Trustee Information
  trustee = (): TrusteeInfo | undefined => this.f3520AInfo()?.trustee
  trusteeName = (): string => this.trustee()?.name ?? ''
  trusteeCountry = (): string => this.trustee()?.country ?? ''

  // U.S. Owners
  usOwners = (): USOwnerInfo[] => this.f3520AInfo()?.usOwners ?? []
  numberOfUSOwners = (): number => this.usOwners().length

  totalOwnershipPercentage = (): number => {
    return this.usOwners().reduce((sum, o) => sum + o.ownershipPercentage, 0)
  }

  // Beneficiaries
  beneficiaries = (): TrustBeneficiary[] =>
    this.f3520AInfo()?.beneficiaries ?? []
  numberOfBeneficiaries = (): number => this.beneficiaries().length

  usBeneficiaries = (): TrustBeneficiary[] => {
    return this.beneficiaries().filter((b) => b.isUSPerson)
  }

  foreignBeneficiaries = (): TrustBeneficiary[] => {
    return this.beneficiaries().filter((b) => !b.isUSPerson)
  }

  totalDistributions = (): number => {
    return this.beneficiaries().reduce(
      (sum, b) => sum + b.distributionAmount,
      0
    )
  }

  // Accounting Information
  accounting = (): TrustAccountingInfo | undefined =>
    this.f3520AInfo()?.accounting

  // Income
  totalIncome = (): number => {
    const acc = this.accounting()
    if (!acc) return 0
    return sumFields([
      acc.interestIncome,
      acc.dividendIncome,
      acc.capitalGains,
      acc.rentalIncome,
      acc.royaltyIncome,
      acc.businessIncome,
      acc.otherIncome
    ])
  }

  // Deductions
  totalDeductions = (): number => {
    const acc = this.accounting()
    if (!acc) return 0
    return sumFields([
      acc.interestExpense,
      acc.taxes,
      acc.trusteeFees,
      acc.professionalFees,
      acc.otherDeductions
    ])
  }

  // Net Income
  netIncome = (): number => this.totalIncome() - this.totalDeductions()

  // Assets
  totalAssets = (): number => this.accounting()?.totalAssets ?? 0

  // Liabilities
  totalLiabilities = (): number => this.accounting()?.totalLiabilities ?? 0

  // Net Worth
  netWorth = (): number => this.totalAssets() - this.totalLiabilities()

  // Owner's share of income
  ownerIncomeShare = (): number => {
    return this.usOwners().reduce((sum, o) => sum + o.portionOfIncome, 0)
  }

  // Owner's share of deductions
  ownerDeductionShare = (): number => {
    return this.usOwners().reduce((sum, o) => sum + o.portionOfDeductions, 0)
  }

  fields = (): Field[] => {
    const info = this.f3520AInfo()
    const trustee = this.trustee()
    const accounting = this.accounting()
    const owners = this.usOwners()
    const beneficiaries = this.beneficiaries()

    return [
      // Trust Information
      this.trustName(),
      this.trustEIN(),
      info?.trustAddress ?? '',
      this.trustCountry(),
      info?.trustTaxYear ?? 2025,
      info?.dateCreated.toLocaleDateString() ?? '',
      // Trustee
      this.trusteeName(),
      trustee?.address ?? '',
      this.trusteeCountry(),
      trustee?.isUSPerson ?? false,
      // Filing Status
      info?.isSubstituteReturn ?? false,
      info?.isFinalReturn ?? false,
      info?.isAmendedReturn ?? false,
      // U.S. Owners
      this.numberOfUSOwners(),
      this.totalOwnershipPercentage(),
      owners[0]?.name ?? '',
      owners[0]?.tin ?? '',
      owners[0]?.ownershipPercentage ?? 0,
      owners[0]?.portionOfIncome ?? 0,
      owners[0]?.portionOfDeductions ?? 0,
      // Beneficiaries
      this.numberOfBeneficiaries(),
      this.usBeneficiaries().length,
      this.foreignBeneficiaries().length,
      this.totalDistributions(),
      beneficiaries[0]?.name ?? '',
      beneficiaries[0]?.distributionAmount ?? 0,
      // Income
      accounting?.interestIncome ?? 0,
      accounting?.dividendIncome ?? 0,
      accounting?.capitalGains ?? 0,
      accounting?.rentalIncome ?? 0,
      accounting?.otherIncome ?? 0,
      this.totalIncome(),
      // Deductions
      accounting?.trusteeFees ?? 0,
      accounting?.taxes ?? 0,
      accounting?.otherDeductions ?? 0,
      this.totalDeductions(),
      this.netIncome(),
      // Assets
      accounting?.cashAndEquivalents ?? 0,
      accounting?.investments ?? 0,
      accounting?.realProperty ?? 0,
      this.totalAssets(),
      this.totalLiabilities(),
      this.netWorth(),
      // Owner shares
      this.ownerIncomeShare(),
      this.ownerDeductionShare()
    ]
  }
}
