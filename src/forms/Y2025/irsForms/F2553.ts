import Form from 'ustaxes/core/irsForms/Form'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form2553Data, SCorpShareholderConsent } from 'ustaxes/core/data'

/**
 * Form 2553 - Election by a Small Business Corporation
 *
 * Used by a corporation or eligible entity to elect S corporation status.
 * S corporations are pass-through entities that avoid double taxation.
 *
 * Requirements for S-Corp election:
 * - Domestic corporation
 * - Only allowable shareholders (individuals, estates, certain trusts)
 * - No more than 100 shareholders
 * - Only one class of stock
 * - Not an ineligible corporation (banks, insurance, etc.)
 *
 * Filing deadline:
 * - No more than 2 months and 15 days after beginning of tax year
 * - For new corporations, within 2 months and 15 days of formation
 *
 * ALL shareholders must consent to the election
 *
 * Late election relief available under Rev. Proc. 2013-30
 */

export default class F2553 extends Form {
  tag: FormTag = 'f2553'
  sequenceIndex = 999

  data: Form2553Data

  constructor(data: Form2553Data) {
    super()
    this.data = data
  }

  // Part I - Election Information

  // Line A: Name
  corporationName = (): string => this.data.corporationName

  // Line B: EIN
  ein = (): string => this.data.ein

  // Line C: Address
  address = (): string => this.data.address.address
  city = (): string => this.data.address.city
  state = (): string => this.data.address.state ?? ''
  zip = (): string => this.data.address.zip ?? ''

  // Line D: Date incorporated
  dateIncorporated = (): string => {
    if (this.data.dateIncorporated instanceof Date) {
      return this.data.dateIncorporated.toLocaleDateString()
    }
    return String(this.data.dateIncorporated)
  }

  // Line E: State of incorporation
  stateOfIncorporation = (): string => this.data.stateOfIncorporation

  // Line F: Effective date of election
  effectiveDate = (): string => {
    if (this.data.effectiveDate instanceof Date) {
      return this.data.effectiveDate.toLocaleDateString()
    }
    return String(this.data.effectiveDate)
  }

  // Line G: Tax year selection
  taxYearEnd = (): string => this.data.taxYearEnd
  isCalendarYear = (): boolean => this.data.taxYearEnd === 'December'
  isFiscalYear = (): boolean => this.data.taxYearEnd !== 'December'

  // Line H: Total shares on election date
  totalShares = (): number => this.data.totalShares

  // Line I: Principal business activity
  principalBusinessActivity = (): string => this.data.principalBusinessActivity

  // Line J: Principal product or service
  principalProduct = (): string => this.data.principalProduct

  // Part II - Shareholder Consents

  shareholders = (): SCorpShareholderConsent[] => this.data.shareholders

  // All shareholders must consent
  allShareholdersConsented = (): boolean => {
    return this.shareholders().every((s) => s.consent)
  }

  // Number of shareholders (max 100)
  shareholderCount = (): number => this.shareholders().length

  // Total shares accounted for
  totalSharesConsented = (): number => {
    return this.shareholders().reduce((sum, s) => sum + s.stockOwned, 0)
  }

  // Verify ownership equals 100%
  ownershipVerified = (): boolean => {
    return this.totalSharesConsented() === this.totalShares()
  }

  // Part III - Qualified Subchapter S Trust (QSST) Election
  // (Additional election for certain trusts - simplified here)
  hasQSSTElection = (): boolean => false

  // Part IV - Late Corporate Classification Election
  isLateElection = (): boolean => this.data.isLateElection ?? false
  lateElectionReason = (): string => this.data.reasonForLateElection ?? ''

  // Eligibility requirements met?
  meetsEligibilityRequirements = (): boolean => {
    // Basic checks
    return (
      this.shareholderCount() <= 100 &&
      this.allShareholdersConsented() &&
      this.ownershipVerified()
    )
  }

  // Officer signature
  officerName = (): string => this.data.officerName
  officerTitle = (): string => this.data.officerTitle
  signatureDate = (): string => {
    if (this.data.signatureDate instanceof Date) {
      return this.data.signatureDate.toLocaleDateString()
    }
    return String(this.data.signatureDate)
  }
  phoneNumber = (): string => this.data.phoneNumber

  fields = (): Field[] => [
    // Part I
    this.corporationName(),
    this.ein(),
    this.address(),
    this.city(),
    this.state(),
    this.zip(),
    this.dateIncorporated(),
    this.stateOfIncorporation(),
    this.effectiveDate(),
    this.isCalendarYear(),
    this.isFiscalYear(),
    this.taxYearEnd(),
    this.totalShares(),
    this.principalBusinessActivity(),
    this.principalProduct(),
    // Part II - Shareholders (first few)
    this.shareholderCount(),
    this.totalSharesConsented(),
    this.allShareholdersConsented(),
    // Part III
    this.hasQSSTElection(),
    // Part IV
    this.isLateElection(),
    this.lateElectionReason(),
    // Signature
    this.officerName(),
    this.officerTitle(),
    this.signatureDate(),
    this.phoneNumber()
  ]
}
