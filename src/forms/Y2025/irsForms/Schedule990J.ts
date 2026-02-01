import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Schedule J (Form 990) - Compensation Information
 *
 * Reports compensation for certain officers, directors, trustees,
 * key employees, and highest compensated employees.
 *
 * Required when:
 * - Organization reported more than $150,000 in compensation
 * - Organization filed Form 990 (not 990-EZ)
 *
 * Key sections:
 * - Part I: Questions regarding compensation
 * - Part II: Officers, Directors, Key Employees compensation
 * - Part III: Supplemental Information
 */

export interface CompensatedPerson {
  name: string
  title: string
  // Base compensation
  baseCompensation: number
  bonusAndIncentive: number
  otherReportable: number
  // Retirement and deferred compensation
  retirementPlan: number
  nontaxableBenefits: number
  // Total compensation
  totalFromOrg: number
  totalFromRelated: number
}

export interface Schedule990JData {
  // Part I: Questions
  providedFirstClassTravel: boolean
  providedTravelForCompanions: boolean
  providedTaxIndemnification: boolean
  providedDiscretionarySpending: boolean
  providedHousingAllowance: boolean
  providedClubDues: boolean
  providedPersonalServices: boolean
  // Substantiation methods
  usedCompensationCommittee: boolean
  usedIndependentConsultant: boolean
  usedFormComparison: boolean
  usedWrittenPolicy: boolean
  // Part II: Compensation details
  compensatedPersons: CompensatedPerson[]
}

export default class Schedule990J extends F1040Attachment {
  tag: FormTag = 'f990sj'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasCompensationData()
  }

  hasCompensationData = (): boolean => {
    const exemptOrg = this.f1040.info.exemptOrgReturn
    return exemptOrg !== undefined
  }

  schedule990JData = (): Schedule990JData | undefined => {
    return undefined // Would be populated from organization data
  }

  // Part I: Questions
  providedFirstClassTravel = (): boolean => {
    return this.schedule990JData()?.providedFirstClassTravel ?? false
  }

  providedTaxIndemnification = (): boolean => {
    return this.schedule990JData()?.providedTaxIndemnification ?? false
  }

  // Substantiation
  usedCompensationCommittee = (): boolean => {
    return this.schedule990JData()?.usedCompensationCommittee ?? false
  }

  // Part II: Compensated Persons
  compensatedPersons = (): CompensatedPerson[] => {
    return this.schedule990JData()?.compensatedPersons ?? []
  }

  // Total compensation from organization
  totalBaseCompensation = (): number => {
    return this.compensatedPersons().reduce(
      (sum, p) => sum + p.baseCompensation,
      0
    )
  }

  totalBonusCompensation = (): number => {
    return this.compensatedPersons().reduce(
      (sum, p) => sum + p.bonusAndIncentive,
      0
    )
  }

  totalOtherCompensation = (): number => {
    return this.compensatedPersons().reduce(
      (sum, p) => sum + p.otherReportable,
      0
    )
  }

  totalRetirementBenefits = (): number => {
    return this.compensatedPersons().reduce(
      (sum, p) => sum + p.retirementPlan,
      0
    )
  }

  totalNontaxableBenefits = (): number => {
    return this.compensatedPersons().reduce(
      (sum, p) => sum + p.nontaxableBenefits,
      0
    )
  }

  grandTotalCompensation = (): number => {
    return this.compensatedPersons().reduce((sum, p) => sum + p.totalFromOrg, 0)
  }

  // Highest paid
  highestPaidPerson = (): CompensatedPerson | undefined => {
    const persons = this.compensatedPersons()
    if (persons.length === 0) return undefined
    return persons.reduce((max, p) =>
      p.totalFromOrg > max.totalFromOrg ? p : max
    )
  }

  fields = (): Field[] => {
    const data = this.schedule990JData()
    const persons = this.compensatedPersons()

    return [
      // Part I: Questions
      data?.providedFirstClassTravel ?? false,
      data?.providedTravelForCompanions ?? false,
      data?.providedTaxIndemnification ?? false,
      data?.providedDiscretionarySpending ?? false,
      data?.providedHousingAllowance ?? false,
      data?.providedClubDues ?? false,
      data?.providedPersonalServices ?? false,
      // Substantiation
      data?.usedCompensationCommittee ?? false,
      data?.usedIndependentConsultant ?? false,
      data?.usedFormComparison ?? false,
      data?.usedWrittenPolicy ?? false,
      // Part II: Person 1
      persons[0]?.name ?? '',
      persons[0]?.title ?? '',
      persons[0]?.baseCompensation ?? 0,
      persons[0]?.bonusAndIncentive ?? 0,
      persons[0]?.otherReportable ?? 0,
      persons[0]?.retirementPlan ?? 0,
      persons[0]?.nontaxableBenefits ?? 0,
      persons[0]?.totalFromOrg ?? 0,
      persons[0]?.totalFromRelated ?? 0,
      // Person 2
      persons[1]?.name ?? '',
      persons[1]?.title ?? '',
      persons[1]?.baseCompensation ?? 0,
      persons[1]?.totalFromOrg ?? 0,
      // Person 3
      persons[2]?.name ?? '',
      persons[2]?.totalFromOrg ?? 0,
      // Person 4
      persons[3]?.name ?? '',
      persons[3]?.totalFromOrg ?? 0,
      // Person 5
      persons[4]?.name ?? '',
      persons[4]?.totalFromOrg ?? 0,
      // Totals
      this.compensatedPersons().length,
      this.totalBaseCompensation(),
      this.totalBonusCompensation(),
      this.totalOtherCompensation(),
      this.totalRetirementBenefits(),
      this.totalNontaxableBenefits(),
      this.grandTotalCompensation()
    ]
  }
}
