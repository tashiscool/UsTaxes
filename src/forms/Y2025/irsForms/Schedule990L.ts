import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Schedule L (Form 990) - Transactions With Interested Persons
 *
 * Reports transactions with:
 * - Officers, directors, trustees, key employees
 * - Highest compensated employees
 * - Disqualified persons
 * - Family members of the above
 *
 * Required when organization has reportable transactions with interested persons.
 */

export interface ExcessBenefitTransaction {
  name: string
  relationship: string
  description: string
  transactionCorrected: boolean
}

export interface LoanToInterested {
  personName: string
  relationship: string
  purposeOfLoan: string
  loanToOrFrom: 'to' | 'from'
  originalPrincipal: number
  balanceDue: number
  inDefault: boolean
  approvedByBoard: boolean
  writtenAgreement: boolean
}

export interface GrantToInterested {
  personName: string
  relationship: string
  purposeOfGrant: string
  amount: number
}

export interface BusinessTransaction {
  personName: string
  relationship: string
  descriptionOfTransaction: string
  amount: number
  sharingOfRevenues: boolean
}

export interface Schedule990LData {
  // Part I: Excess benefit transactions
  excessBenefitTransactions: ExcessBenefitTransaction[]
  // Part II: Loans to/from interested persons
  loans: LoanToInterested[]
  // Part III: Grants to interested persons
  grants: GrantToInterested[]
  // Part IV: Business transactions with interested persons
  businessTransactions: BusinessTransaction[]
}

export default class Schedule990L extends F1040Attachment {
  tag: FormTag = 'f990sl'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasInterestedPersonData()
  }

  hasInterestedPersonData = (): boolean => {
    const exemptOrg = this.f1040.info.exemptOrgReturn
    return exemptOrg !== undefined
  }

  schedule990LData = (): Schedule990LData | undefined => {
    return undefined  // Would be populated from organization data
  }

  // Part I: Excess benefit transactions
  excessBenefitTransactions = (): ExcessBenefitTransaction[] => {
    return this.schedule990LData()?.excessBenefitTransactions ?? []
  }

  hasExcessBenefitTransactions = (): boolean => {
    return this.excessBenefitTransactions().length > 0
  }

  // Part II: Loans
  loans = (): LoanToInterested[] => {
    return this.schedule990LData()?.loans ?? []
  }

  loansToInterestedPersons = (): LoanToInterested[] => {
    return this.loans().filter(l => l.loanToOrFrom === 'to')
  }

  loansFromInterestedPersons = (): LoanToInterested[] => {
    return this.loans().filter(l => l.loanToOrFrom === 'from')
  }

  totalLoansToInterested = (): number => {
    return this.loansToInterestedPersons().reduce((sum, l) => sum + l.balanceDue, 0)
  }

  totalLoansFromInterested = (): number => {
    return this.loansFromInterestedPersons().reduce((sum, l) => sum + l.balanceDue, 0)
  }

  // Part III: Grants
  grants = (): GrantToInterested[] => {
    return this.schedule990LData()?.grants ?? []
  }

  totalGrantsToInterested = (): number => {
    return this.grants().reduce((sum, g) => sum + g.amount, 0)
  }

  // Part IV: Business transactions
  businessTransactions = (): BusinessTransaction[] => {
    return this.schedule990LData()?.businessTransactions ?? []
  }

  totalBusinessTransactions = (): number => {
    return this.businessTransactions().reduce((sum, t) => sum + t.amount, 0)
  }

  // Total all transactions
  totalAllTransactions = (): number => {
    return sumFields([
      this.totalLoansToInterested(),
      this.totalLoansFromInterested(),
      this.totalGrantsToInterested(),
      this.totalBusinessTransactions()
    ])
  }

  fields = (): Field[] => {
    const excess = this.excessBenefitTransactions()
    const loans = this.loans()
    const grants = this.grants()
    const business = this.businessTransactions()

    return [
      // Part I: Excess benefit
      this.hasExcessBenefitTransactions(),
      excess[0]?.name ?? '',
      excess[0]?.relationship ?? '',
      excess[0]?.description ?? '',
      excess[0]?.transactionCorrected ?? false,
      this.excessBenefitTransactions().length,
      // Part II: Loans
      loans[0]?.personName ?? '',
      loans[0]?.relationship ?? '',
      loans[0]?.purposeOfLoan ?? '',
      loans[0]?.loanToOrFrom === 'to',
      loans[0]?.loanToOrFrom === 'from',
      loans[0]?.originalPrincipal ?? 0,
      loans[0]?.balanceDue ?? 0,
      loans[0]?.inDefault ?? false,
      loans[0]?.approvedByBoard ?? false,
      loans[0]?.writtenAgreement ?? false,
      // Second loan
      loans[1]?.personName ?? '',
      loans[1]?.balanceDue ?? 0,
      this.loans().length,
      this.totalLoansToInterested(),
      this.totalLoansFromInterested(),
      // Part III: Grants
      grants[0]?.personName ?? '',
      grants[0]?.relationship ?? '',
      grants[0]?.purposeOfGrant ?? '',
      grants[0]?.amount ?? 0,
      // Second grant
      grants[1]?.personName ?? '',
      grants[1]?.amount ?? 0,
      this.grants().length,
      this.totalGrantsToInterested(),
      // Part IV: Business transactions
      business[0]?.personName ?? '',
      business[0]?.relationship ?? '',
      business[0]?.descriptionOfTransaction ?? '',
      business[0]?.amount ?? 0,
      business[0]?.sharingOfRevenues ?? false,
      // Second transaction
      business[1]?.personName ?? '',
      business[1]?.amount ?? 0,
      this.businessTransactions().length,
      this.totalBusinessTransactions(),
      // Total
      this.totalAllTransactions()
    ]
  }
}
