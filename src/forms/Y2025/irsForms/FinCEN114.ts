import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * FinCEN Form 114 - Report of Foreign Bank and Financial Accounts (FBAR)
 *
 * Required for U.S. persons with financial interest in or signature authority
 * over foreign financial accounts when the aggregate value exceeds $10,000
 * at any time during the calendar year.
 *
 * U.S. Persons Include:
 * - U.S. citizens
 * - U.S. residents
 * - Entities (corporations, partnerships, LLCs, trusts, estates)
 *
 * Foreign Financial Accounts Include:
 * - Bank accounts (checking, savings)
 * - Securities accounts
 * - Mutual funds
 * - Debit card accounts
 * - Insurance policies with cash value
 * - Pension accounts
 *
 * Reporting Threshold: $10,000 aggregate maximum value
 * Due Date: April 15 (with automatic extension to October 15)
 * Filed electronically via BSA E-Filing System (not with tax return)
 *
 * Penalties:
 * - Non-willful: Up to $14,489 per violation (2025)
 * - Willful: Greater of $144,886 or 50% of account balance
 */

export type AccountType = 'bank' | 'securities' | 'other'
export type OwnershipType = 'financialInterest' | 'signatureAuthority' | 'both'

export interface ForeignAccount {
  accountNumber: string
  financialInstitution: string
  institutionAddress: string
  institutionCity: string
  institutionCountry: string
  accountType: AccountType
  ownershipType: OwnershipType
  currencyCode: string
  maximumValue: number  // Maximum value during calendar year (in USD)
  wasJointlyOwned: boolean
  numberOfJointOwners?: number
  jointOwnerNames?: string[]
  // For signature authority only
  ownerName?: string
  ownerAddress?: string
}

export interface FinCEN114Info {
  // Filer Information
  filerType: 'individual' | 'entity'
  lastName?: string
  firstName?: string
  middleName?: string
  entityName?: string
  tin: string  // SSN or EIN
  dateOfBirth?: Date
  address: string
  city: string
  state: string
  zip: string
  country: string
  // Calendar year
  calendarYear: number
  // Accounts
  foreignAccounts: ForeignAccount[]
  // Amended/Late filing
  isAmendedReport: boolean
  isLateReport: boolean
  lateFilingReason?: string
}

// 2025 FBAR Reporting Threshold
const FBAR_THRESHOLD = 10000

export default class FinCEN114 extends F1040Attachment {
  tag: FormTag = 'fincen114'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasFbarInfo() && this.meetsReportingThreshold()
  }

  hasFbarInfo = (): boolean => {
    return this.fbarInfo() !== undefined
  }

  fbarInfo = (): FinCEN114Info | undefined => {
    return this.f1040.info.fbarReport as FinCEN114Info | undefined
  }

  // Part I: Filer Information

  filerType = (): string => this.fbarInfo()?.filerType ?? 'individual'
  isIndividual = (): boolean => this.filerType() === 'individual'
  isEntity = (): boolean => this.filerType() === 'entity'

  filerName = (): string => {
    const info = this.fbarInfo()
    if (!info) return ''
    if (this.isEntity()) return info.entityName ?? ''
    return `${info.lastName ?? ''}, ${info.firstName ?? ''} ${info.middleName ?? ''}`.trim()
  }

  tin = (): string => this.fbarInfo()?.tin ?? ''
  calendarYear = (): number => this.fbarInfo()?.calendarYear ?? 2025

  // Part II: Foreign Accounts

  foreignAccounts = (): ForeignAccount[] => this.fbarInfo()?.foreignAccounts ?? []
  numberOfAccounts = (): number => this.foreignAccounts().length

  // Calculate maximum aggregate value
  maximumAggregateValue = (): number => {
    return this.foreignAccounts().reduce((sum, a) => sum + a.maximumValue, 0)
  }

  // Check if meets reporting threshold
  meetsReportingThreshold = (): boolean => {
    return this.maximumAggregateValue() > FBAR_THRESHOLD
  }

  // Accounts by type
  bankAccounts = (): ForeignAccount[] => {
    return this.foreignAccounts().filter(a => a.accountType === 'bank')
  }

  securitiesAccounts = (): ForeignAccount[] => {
    return this.foreignAccounts().filter(a => a.accountType === 'securities')
  }

  otherAccounts = (): ForeignAccount[] => {
    return this.foreignAccounts().filter(a => a.accountType === 'other')
  }

  // Accounts by ownership type
  financialInterestAccounts = (): ForeignAccount[] => {
    return this.foreignAccounts().filter(a =>
      a.ownershipType === 'financialInterest' || a.ownershipType === 'both'
    )
  }

  signatureAuthorityAccounts = (): ForeignAccount[] => {
    return this.foreignAccounts().filter(a =>
      a.ownershipType === 'signatureAuthority' || a.ownershipType === 'both'
    )
  }

  // Joint accounts
  jointAccounts = (): ForeignAccount[] => {
    return this.foreignAccounts().filter(a => a.wasJointlyOwned)
  }

  // Countries with accounts
  countriesWithAccounts = (): string[] => {
    const countries = new Set(this.foreignAccounts().map(a => a.institutionCountry))
    return Array.from(countries)
  }

  // Part III: Signature
  isAmendedReport = (): boolean => this.fbarInfo()?.isAmendedReport ?? false
  isLateReport = (): boolean => this.fbarInfo()?.isLateReport ?? false

  fields = (): Field[] => {
    const info = this.fbarInfo()
    const accounts = this.foreignAccounts()

    return [
      // Part I: Filer Information
      this.isIndividual(),
      this.isEntity(),
      this.filerName(),
      this.tin(),
      info?.dateOfBirth?.toLocaleDateString() ?? '',
      info?.address ?? '',
      info?.city ?? '',
      info?.state ?? '',
      info?.zip ?? '',
      info?.country ?? 'United States',
      this.calendarYear(),
      // Summary
      this.numberOfAccounts(),
      this.maximumAggregateValue(),
      this.meetsReportingThreshold(),
      // Account breakdown
      this.bankAccounts().length,
      this.securitiesAccounts().length,
      this.otherAccounts().length,
      this.financialInterestAccounts().length,
      this.signatureAuthorityAccounts().length,
      this.jointAccounts().length,
      this.countriesWithAccounts().length,
      // First account details
      accounts[0]?.financialInstitution ?? '',
      accounts[0]?.accountNumber ?? '',
      accounts[0]?.institutionCountry ?? '',
      accounts[0]?.accountType ?? '',
      accounts[0]?.maximumValue ?? 0,
      accounts[0]?.ownershipType ?? '',
      accounts[0]?.wasJointlyOwned ?? false,
      // Second account details
      accounts[1]?.financialInstitution ?? '',
      accounts[1]?.accountNumber ?? '',
      accounts[1]?.institutionCountry ?? '',
      accounts[1]?.maximumValue ?? 0,
      // Filing status
      this.isAmendedReport(),
      this.isLateReport(),
      info?.lateFilingReason ?? ''
    ]
  }
}
