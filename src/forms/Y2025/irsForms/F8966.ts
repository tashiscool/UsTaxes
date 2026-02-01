import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 8966 - FATCA Report
 *
 * Filed by Foreign Financial Institutions (FFIs) and other entities
 * to report U.S. accounts and U.S. owners under FATCA
 * (Foreign Account Tax Compliance Act).
 *
 * Part I: Filer Information
 * Part II: Account Holder or Payee Information
 * Part III: Financial Account Information
 * Part IV: Pooled Reporting (if applicable)
 *
 * This form is typically filed by financial institutions, but
 * U.S. persons may need to understand this for their foreign
 * account reporting obligations.
 *
 * Key 2025 updates:
 * - New reporting thresholds
 * - Enhanced due diligence requirements
 * - Expanded scope for certain account types
 */

export type AccountHolderType = 'individual' | 'entity' | 'passiveNFFE'
export type FilerCategory =
  | 'participatingFFI'
  | 'registeredDeemedCompliant'
  | 'sponsoredFFI'
  | 'directReportingNFFE'

export interface AccountHolderInfo {
  type: AccountHolderType
  name: string
  tin?: string
  address: string
  countryOfResidence: string
  dateOfBirth?: Date // For individuals
  entityType?: string // For entities
  // Substantial U.S. owners (for passive NFFEs)
  substantialUSOwners?: {
    name: string
    tin: string
    ownershipPercentage: number
  }[]
}

export interface FinancialAccountInfo {
  accountNumber: string
  accountType:
    | 'depository'
    | 'custodial'
    | 'debtInterest'
    | 'equityInterest'
    | 'cashValueInsurance'
    | 'annuity'
  currency: string
  accountBalance: number
  // Income types
  dividends?: number
  interest?: number
  grossProceeds?: number
  otherIncome?: number
  wasAccountClosed: boolean
  closureDate?: Date
}

export interface Form8966Info {
  // Part I: Filer Information
  filerCategory: FilerCategory
  filerName: string
  filerGIIN: string // Global Intermediary Identification Number
  filerAddress: string
  filerCountry: string
  sponsorName?: string
  sponsorGIIN?: string
  // Part II: Account Holder
  accountHolder: AccountHolderInfo
  // Part III: Financial Account
  financialAccount: FinancialAccountInfo
  // Part IV: Pooled Reporting
  isPooledReport: boolean
  numberOfAccountsInPool?: number
  aggregateBalanceInPool?: number
  reportingYear: number
}

export default class F8966 extends F1040Attachment {
  tag: FormTag = 'f8966'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF8966Info()
  }

  hasF8966Info = (): boolean => {
    return this.f8966Info() !== undefined
  }

  f8966Info = (): Form8966Info | undefined => {
    return this.f1040.info.fatcaReport as Form8966Info | undefined
  }

  // Part I: Filer Information
  filerCategory = (): FilerCategory =>
    this.f8966Info()?.filerCategory ?? 'participatingFFI'
  filerName = (): string => this.f8966Info()?.filerName ?? ''
  filerGIIN = (): string => this.f8966Info()?.filerGIIN ?? ''
  filerAddress = (): string => this.f8966Info()?.filerAddress ?? ''
  filerCountry = (): string => this.f8966Info()?.filerCountry ?? ''
  sponsorName = (): string => this.f8966Info()?.sponsorName ?? ''
  sponsorGIIN = (): string => this.f8966Info()?.sponsorGIIN ?? ''

  // Part II: Account Holder Information
  accountHolder = (): AccountHolderInfo | undefined =>
    this.f8966Info()?.accountHolder

  accountHolderType = (): AccountHolderType =>
    this.accountHolder()?.type ?? 'individual'
  accountHolderName = (): string => this.accountHolder()?.name ?? ''
  accountHolderTin = (): string => this.accountHolder()?.tin ?? ''
  accountHolderAddress = (): string => this.accountHolder()?.address ?? ''
  accountHolderCountry = (): string =>
    this.accountHolder()?.countryOfResidence ?? ''

  isIndividual = (): boolean => this.accountHolderType() === 'individual'
  isEntity = (): boolean => this.accountHolderType() === 'entity'
  isPassiveNFFE = (): boolean => this.accountHolderType() === 'passiveNFFE'

  // Substantial U.S. owners
  substantialUSOwners = () => this.accountHolder()?.substantialUSOwners ?? []
  hasSubstantialUSOwners = (): boolean => this.substantialUSOwners().length > 0

  // Part III: Financial Account Information
  financialAccount = (): FinancialAccountInfo | undefined =>
    this.f8966Info()?.financialAccount

  accountNumber = (): string => this.financialAccount()?.accountNumber ?? ''
  accountType = (): string => this.financialAccount()?.accountType ?? ''
  accountCurrency = (): string => this.financialAccount()?.currency ?? 'USD'
  accountBalance = (): number => this.financialAccount()?.accountBalance ?? 0

  // Income from account
  dividendsIncome = (): number => this.financialAccount()?.dividends ?? 0
  interestIncome = (): number => this.financialAccount()?.interest ?? 0
  grossProceeds = (): number => this.financialAccount()?.grossProceeds ?? 0
  otherIncome = (): number => this.financialAccount()?.otherIncome ?? 0

  totalAccountIncome = (): number => {
    return (
      this.dividendsIncome() +
      this.interestIncome() +
      this.grossProceeds() +
      this.otherIncome()
    )
  }

  wasAccountClosed = (): boolean =>
    this.financialAccount()?.wasAccountClosed ?? false

  // Part IV: Pooled Reporting
  isPooledReport = (): boolean => this.f8966Info()?.isPooledReport ?? false
  numberOfAccountsInPool = (): number =>
    this.f8966Info()?.numberOfAccountsInPool ?? 0
  aggregateBalanceInPool = (): number =>
    this.f8966Info()?.aggregateBalanceInPool ?? 0

  // Reporting year
  reportingYear = (): number => this.f8966Info()?.reportingYear ?? 2025

  fields = (): Field[] => {
    const holder = this.accountHolder()
    const account = this.financialAccount()
    const owners = this.substantialUSOwners()

    return [
      // Part I: Filer
      this.filerCategory(),
      this.filerName(),
      this.filerGIIN(),
      this.filerAddress(),
      this.filerCountry(),
      this.sponsorName(),
      this.sponsorGIIN(),
      // Part II: Account Holder
      this.isIndividual(),
      this.isEntity(),
      this.isPassiveNFFE(),
      this.accountHolderName(),
      this.accountHolderTin(),
      this.accountHolderAddress(),
      this.accountHolderCountry(),
      holder?.dateOfBirth?.toLocaleDateString() ?? '',
      holder?.entityType ?? '',
      // Substantial US Owners (first one)
      this.hasSubstantialUSOwners(),
      owners[0]?.name ?? '',
      owners[0]?.tin ?? '',
      owners[0]?.ownershipPercentage ?? 0,
      // Part III: Financial Account
      this.accountNumber(),
      this.accountType(),
      this.accountCurrency(),
      this.accountBalance(),
      this.dividendsIncome(),
      this.interestIncome(),
      this.grossProceeds(),
      this.otherIncome(),
      this.totalAccountIncome(),
      this.wasAccountClosed(),
      account?.closureDate?.toLocaleDateString() ?? '',
      // Part IV: Pooled Reporting
      this.isPooledReport(),
      this.numberOfAccountsInPool(),
      this.aggregateBalanceInPool(),
      // Reporting Year
      this.reportingYear()
    ]
  }
}
