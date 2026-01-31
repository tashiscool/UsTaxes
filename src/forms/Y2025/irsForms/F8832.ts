import Form from 'ustaxes/core/irsForms/Form'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8832Data, EntityClassificationChoice } from 'ustaxes/core/data'

/**
 * Form 8832 - Entity Classification Election
 *
 * Used by eligible entities to elect how they are classified for
 * federal tax purposes. This is the "check-the-box" election.
 *
 * Eligible entities:
 * - LLCs (single or multi-member)
 * - Partnerships
 * - Certain foreign entities
 *
 * Default classifications (if no election made):
 * - Single-member LLC: Disregarded entity (Schedule C or E)
 * - Multi-member LLC: Partnership (Form 1065)
 * - Corporation: Always corporation (can elect S-Corp via 2553)
 *
 * Election options:
 * - Disregarded entity (single-member only)
 * - Partnership (multi-member)
 * - Association taxable as corporation
 *
 * Effective date can be:
 * - Up to 75 days before filing
 * - Up to 12 months after filing
 *
 * Late election relief available under certain conditions
 */

export default class F8832 extends Form {
  tag: FormTag = 'f8832'
  sequenceIndex = 999

  data: Form8832Data

  constructor(data: Form8832Data) {
    super()
    this.data = data
  }

  // Part I - Election Information

  // Line 1a: Type of election - initial classification
  isInitialElection = (): boolean => this.data.electionType === 'initial'

  // Line 1b: Type of election - change in classification
  isChangeElection = (): boolean => this.data.electionType === 'change'

  // Line 2: Eligible entity information
  entityName = (): string => this.data.entityName
  ein = (): string => this.data.ein
  address = (): string => this.data.address.address
  city = (): string => this.data.address.city
  state = (): string => this.data.address.state ?? ''
  zip = (): string => this.data.address.zip ?? ''

  // Line 3: Type of entity
  // a. Domestic eligible entity electing to be classified as association
  electCorporation = (): boolean => this.data.newClassification === 'corporation'
  // b. Domestic eligible entity electing to be classified as partnership
  electPartnership = (): boolean => this.data.newClassification === 'partnership'
  // c. Domestic eligible entity electing to be classified as disregarded
  electDisregarded = (): boolean => this.data.newClassification === 'disregarded'

  // Line 4: Effective date of election
  effectiveDate = (): string => {
    if (this.data.effectiveDate instanceof Date) {
      return this.data.effectiveDate.toLocaleDateString()
    }
    return String(this.data.effectiveDate)
  }

  // Line 5: Previous classification (for change elections)
  previousClassification = (): EntityClassificationChoice | undefined => {
    return this.data.previousClassification
  }

  previousWasCorporation = (): boolean => this.previousClassification() === 'corporation'
  previousWasPartnership = (): boolean => this.previousClassification() === 'partnership'
  previousWasDisregarded = (): boolean => this.previousClassification() === 'disregarded'

  // Line 6: Number of owners
  numberOfOwners = (): number => this.data.numberOfOwners

  // Part II - Late Election Relief

  isLateElection = (): boolean => this.data.isLateElection ?? false
  lateElectionReason = (): string => this.data.lateElectionReason ?? ''

  // Consent

  // Line 7: All owners must consent
  allOwnersConsent = (): boolean => this.data.allOwnersConsent

  ownerNames = (): string[] => this.data.ownerNames ?? []

  // Formation information
  dateFormed = (): string => {
    if (this.data.dateFormed instanceof Date) {
      return this.data.dateFormed.toLocaleDateString()
    }
    return String(this.data.dateFormed)
  }

  stateOfFormation = (): string => this.data.stateOrCountryOfFormation

  // Helper to describe the election
  electionDescription = (): string => {
    const newClass = this.data.newClassification
    switch (newClass) {
      case 'corporation':
        return 'Association taxable as a corporation'
      case 'partnership':
        return 'Partnership'
      case 'disregarded':
        return 'Disregarded entity'
      case 'sCorporation':
        return 'S Corporation (requires Form 2553)'
      default:
        return 'Unknown'
    }
  }

  fields = (): Field[] => [
    // Entity info
    this.entityName(),
    this.ein(),
    this.address(),
    this.city(),
    this.state(),
    this.zip(),
    // Election type
    this.isInitialElection(),
    this.isChangeElection(),
    // Classification elected
    this.electCorporation(),
    this.electPartnership(),
    this.electDisregarded(),
    // Effective date
    this.effectiveDate(),
    // Previous (for changes)
    this.previousWasCorporation(),
    this.previousWasPartnership(),
    this.previousWasDisregarded(),
    // Ownership
    this.numberOfOwners(),
    // Late election
    this.isLateElection(),
    this.lateElectionReason(),
    // Consent
    this.allOwnersConsent(),
    // Formation
    this.dateFormed(),
    this.stateOfFormation()
  ]
}
