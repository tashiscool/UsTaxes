import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form SS-4 - Application for Employer Identification Number
 *
 * Used to apply for an EIN (Employer Identification Number).
 * Required for:
 * - Starting a business
 * - Hiring employees
 * - Opening a business bank account
 * - Filing business tax returns
 * - Estates and trusts
 * - Non-profit organizations
 *
 * Can be filed:
 * - Online (immediate EIN)
 * - By phone (immediate EIN)
 * - By fax (4 business days)
 * - By mail (4-5 weeks)
 */

export interface SS4Data {
  // Line 1: Legal name
  legalName: string
  // Line 2: Trade name (DBA)
  tradeName?: string
  // Line 3: Executor/trustee name (for estates/trusts)
  executorTrusteeName?: string
  // Line 4a-b: Mailing address
  mailingAddress: string
  mailingCity: string
  mailingState: string
  mailingZip: string
  // Line 5a-b: Street address (if different)
  streetAddress?: string
  streetCity?: string
  streetState?: string
  streetZip?: string
  // Line 6: County and state of principal business
  county: string
  state: string
  // Line 7a: Responsible party name
  responsiblePartyName: string
  // Line 7b: Responsible party SSN or ITIN
  responsiblePartySSN: string
  // Line 8a: Is LLC?
  isLLC: boolean
  // Line 8b: Number of LLC members
  numberOfLLCMembers?: number
  // Line 9a: Type of entity
  entityType:
    | 'sole_proprietor'
    | 'partnership'
    | 'corporation'
    | 'personal_service_corp'
    | 'church'
    | 'nonprofit'
    | 'other_nonprofit'
    | 'estate'
    | 'trust'
    | 'plan_administrator'
    | 'farmers_coop'
    | 'remic'
    | 'state_local_gov'
    | 'federal_gov'
    | 'indian_tribal'
    | 'other'
  otherEntityType?: string
  // Line 9b: State of incorporation
  stateOfIncorporation?: string
  // Line 10: Reason for applying
  reasonForApplying:
    | 'started_new_business'
    | 'hired_employees'
    | 'banking'
    | 'changed_org_type'
    | 'purchased_business'
    | 'created_trust'
    | 'created_pension_plan'
    | 'other'
  otherReason?: string
  // Line 11: Date business started
  dateBusinessStarted: Date
  // Line 12: Closing month of accounting year
  fiscalYearEndMonth: number
  // Line 13: Highest number of employees expected in next 12 months
  expectedEmployees: number
  // Line 14: Do you expect to have $1,000 or less in employment tax liability?
  expectLowTaxLiability: boolean
  // Line 15: First date wages paid
  firstDateWagesPaid?: Date
  // Line 16: Principal activity
  principalActivity: string
  // Line 17: Principal line of merchandise
  principalMerchandise?: string
  // Line 18: Has applicant ever applied for an EIN before?
  hasAppliedBefore: boolean
  priorEIN?: string
  // Third party designee
  thirdPartyDesignee?: string
  thirdPartyPhone?: string
  // Signature
  signatureDate: Date
  signerName: string
  signerTitle: string
  signerPhone: string
  signerFax?: string
}

export default class SS4 extends F1040Attachment {
  tag: FormTag = 'ss4'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasSS4Data()
  }

  hasSS4Data = (): boolean => {
    return false // Application form, not tax filing
  }

  ss4Data = (): SS4Data | undefined => {
    return undefined
  }

  // Legal name
  legalName = (): string => this.ss4Data()?.legalName ?? ''
  tradeName = (): string => this.ss4Data()?.tradeName ?? ''

  // Entity type
  entityType = (): string => this.ss4Data()?.entityType ?? ''

  isSoleProprietor = (): boolean => this.entityType() === 'sole_proprietor'
  isPartnership = (): boolean => this.entityType() === 'partnership'
  isCorporation = (): boolean => this.entityType() === 'corporation'
  isNonprofit = (): boolean =>
    this.entityType() === 'nonprofit' || this.entityType() === 'other_nonprofit'
  isEstate = (): boolean => this.entityType() === 'estate'
  isTrust = (): boolean => this.entityType() === 'trust'

  // LLC info
  isLLC = (): boolean => this.ss4Data()?.isLLC ?? false
  numberOfLLCMembers = (): number => this.ss4Data()?.numberOfLLCMembers ?? 1

  // Responsible party
  responsiblePartyName = (): string =>
    this.ss4Data()?.responsiblePartyName ?? ''

  // Reason for applying
  reasonForApplying = (): string => this.ss4Data()?.reasonForApplying ?? ''

  // Business dates
  dateBusinessStarted = (): Date | undefined =>
    this.ss4Data()?.dateBusinessStarted
  fiscalYearEndMonth = (): number => this.ss4Data()?.fiscalYearEndMonth ?? 12

  // Employees
  expectedEmployees = (): number => this.ss4Data()?.expectedEmployees ?? 0
  hasEmployees = (): boolean => this.expectedEmployees() > 0

  fields = (): Field[] => {
    const data = this.ss4Data()

    return [
      // Lines 1-2: Name
      data?.legalName ?? '',
      data?.tradeName ?? '',
      data?.executorTrusteeName ?? '',
      // Lines 4-5: Address
      data?.mailingAddress ?? '',
      data?.mailingCity ?? '',
      data?.mailingState ?? '',
      data?.mailingZip ?? '',
      data?.streetAddress ?? '',
      data?.streetCity ?? '',
      data?.streetState ?? '',
      data?.streetZip ?? '',
      // Line 6: County/State
      data?.county ?? '',
      data?.state ?? '',
      // Line 7: Responsible party
      data?.responsiblePartyName ?? '',
      data?.responsiblePartySSN ?? '',
      // Line 8: LLC
      this.isLLC(),
      data?.numberOfLLCMembers ?? 0,
      // Line 9: Entity type
      this.isSoleProprietor(),
      this.isPartnership(),
      this.isCorporation(),
      data?.entityType === 'personal_service_corp',
      data?.entityType === 'church',
      this.isNonprofit(),
      this.isEstate(),
      this.isTrust(),
      data?.entityType === 'other',
      data?.otherEntityType ?? '',
      data?.stateOfIncorporation ?? '',
      // Line 10: Reason
      data?.reasonForApplying ?? '',
      data?.otherReason ?? '',
      // Lines 11-12: Dates
      data?.dateBusinessStarted.toLocaleDateString() ?? '',
      data?.fiscalYearEndMonth ?? 12,
      // Lines 13-15: Employment
      this.expectedEmployees(),
      data?.expectLowTaxLiability ?? false,
      data?.firstDateWagesPaid?.toLocaleDateString() ?? '',
      // Lines 16-17: Activity
      data?.principalActivity ?? '',
      data?.principalMerchandise ?? '',
      // Line 18: Prior EIN
      data?.hasAppliedBefore ?? false,
      data?.priorEIN ?? '',
      // Third party
      data?.thirdPartyDesignee ?? '',
      data?.thirdPartyPhone ?? '',
      // Signature
      data?.signatureDate.toLocaleDateString() ?? '',
      data?.signerName ?? '',
      data?.signerTitle ?? '',
      data?.signerPhone ?? '',
      data?.signerFax ?? ''
    ]
  }
}
