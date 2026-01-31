import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Schedule B (Form 1065) - Other Information
 *
 * Questions about the partnership's activities, ownership, and elections.
 *
 * Key questions:
 * - Type of entity
 * - Number of partners
 * - Foreign partners
 * - Publicly traded partnership
 * - Tax shelter registration
 * - Section 754 elections
 */

export interface ScheduleB1065Data {
  // Question 1: Type of entity
  entityType: 'domesticGeneralPartnership' | 'domesticLLP' | 'domesticLLC' | 'foreign' | 'other'
  // Question 2: Partnership schedule
  scheduleM3Required: boolean
  // Question 3: Filing method
  aggregateMethod: boolean
  // Question 4: During tax year...
  wasConvertedFromOther: boolean
  wasMergedOrConsolidated: boolean
  // Question 5: Partners
  anyNewPartners: boolean
  anyPartnersLeftOrReduced: boolean
  // Question 6: Foreign partners
  anyForeignPartners: boolean
  numberOfForeignPartners: number
  // Question 7: Foreign transactions
  anyForeignTransactions: boolean
  // Question 8: Interests
  anyTransfersOfInterests: boolean
  // Question 9: Section 754 election
  section754Election: boolean
  // Question 10: Debt
  anyNonrecourseDebt: boolean
  // Question 11: Technical termination
  technicalTermination: boolean
  // Question 12: Form 8918 filed
  form8918Filed: boolean
  // Question 13: Form 3520 required
  form3520Required: boolean
  // Question 14: Section 1446 withholding
  section1446Withholding: boolean
  // Question 15: Qualified opportunity fund
  qualifiedOpportunityFund: boolean
  // Question 16: Syndication costs
  anySyndicationCosts: boolean
  // Question 17: Partnership representative
  partnershipRepName: string
  partnershipRepPhone: string
  partnershipRepAddress: string
  designatedIndividual?: string
  // Question 18: Election out of centralized partnership audit
  electedOutOfAuditRegime: boolean
  // Question 19: Number of partners
  numberOfPartners: number
  // Question 20: Total capital
  capitalAtBeginning: number
  capitalAtEnd: number
  // Question 21: Method of accounting
  accountingMethod: 'cash' | 'accrual' | 'other'
}

export default class ScheduleB1065 extends F1040Attachment {
  tag: FormTag = 'f1065sb'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasPartnershipData()
  }

  hasPartnershipData = (): boolean => {
    const partnerships = this.f1040.info.partnershipOwnership
    return partnerships !== undefined && partnerships.length > 0
  }

  scheduleB1065Data = (): ScheduleB1065Data | undefined => {
    return undefined  // Would be populated from entity data
  }

  // Entity type
  entityType = (): string => this.scheduleB1065Data()?.entityType ?? 'domesticGeneralPartnership'

  // Number of partners
  numberOfPartners = (): number => this.scheduleB1065Data()?.numberOfPartners ?? 0

  // Foreign partners
  anyForeignPartners = (): boolean => this.scheduleB1065Data()?.anyForeignPartners ?? false
  numberOfForeignPartners = (): number => this.scheduleB1065Data()?.numberOfForeignPartners ?? 0

  // Section 754 election
  hasSection754Election = (): boolean => this.scheduleB1065Data()?.section754Election ?? false

  // Partnership representative
  partnershipRepName = (): string => this.scheduleB1065Data()?.partnershipRepName ?? ''
  partnershipRepPhone = (): string => this.scheduleB1065Data()?.partnershipRepPhone ?? ''

  // Accounting method
  accountingMethod = (): string => this.scheduleB1065Data()?.accountingMethod ?? 'cash'

  // Capital
  capitalAtBeginning = (): number => this.scheduleB1065Data()?.capitalAtBeginning ?? 0
  capitalAtEnd = (): number => this.scheduleB1065Data()?.capitalAtEnd ?? 0

  // Qualified opportunity fund
  isQualifiedOpportunityFund = (): boolean => this.scheduleB1065Data()?.qualifiedOpportunityFund ?? false

  // Elected out of centralized audit
  electedOutOfAudit = (): boolean => this.scheduleB1065Data()?.electedOutOfAuditRegime ?? false

  fields = (): Field[] => {
    const data = this.scheduleB1065Data()

    return [
      // Question 1: Entity type
      data?.entityType === 'domesticGeneralPartnership',
      data?.entityType === 'domesticLLP',
      data?.entityType === 'domesticLLC',
      data?.entityType === 'foreign',
      data?.entityType === 'other',
      // Question 2: Schedule M-3
      data?.scheduleM3Required ?? false,
      // Question 3: Aggregate method
      data?.aggregateMethod ?? false,
      // Question 4: Conversions/mergers
      data?.wasConvertedFromOther ?? false,
      data?.wasMergedOrConsolidated ?? false,
      // Question 5: Partner changes
      data?.anyNewPartners ?? false,
      data?.anyPartnersLeftOrReduced ?? false,
      // Question 6: Foreign partners
      this.anyForeignPartners(),
      this.numberOfForeignPartners(),
      // Question 7: Foreign transactions
      data?.anyForeignTransactions ?? false,
      // Question 8: Interest transfers
      data?.anyTransfersOfInterests ?? false,
      // Question 9: Section 754
      this.hasSection754Election(),
      // Question 10: Nonrecourse debt
      data?.anyNonrecourseDebt ?? false,
      // Question 11: Technical termination
      data?.technicalTermination ?? false,
      // Question 12: Form 8918
      data?.form8918Filed ?? false,
      // Question 13: Form 3520
      data?.form3520Required ?? false,
      // Question 14: Section 1446
      data?.section1446Withholding ?? false,
      // Question 15: QOF
      this.isQualifiedOpportunityFund(),
      // Question 16: Syndication costs
      data?.anySyndicationCosts ?? false,
      // Question 17: Partnership representative
      this.partnershipRepName(),
      this.partnershipRepPhone(),
      data?.partnershipRepAddress ?? '',
      data?.designatedIndividual ?? '',
      // Question 18: Election out
      this.electedOutOfAudit(),
      // Question 19: Number of partners
      this.numberOfPartners(),
      // Question 20: Capital
      this.capitalAtBeginning(),
      this.capitalAtEnd(),
      // Question 21: Accounting method
      this.accountingMethod() === 'cash',
      this.accountingMethod() === 'accrual',
      this.accountingMethod() === 'other'
    ]
  }
}
