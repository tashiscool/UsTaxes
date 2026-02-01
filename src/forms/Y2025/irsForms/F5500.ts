import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 5500 - Annual Return/Report of Employee Benefit Plan
 *
 * Required for most employee benefit plans including:
 * - Pension plans (defined benefit and defined contribution)
 * - 401(k) plans
 * - Profit-sharing plans
 * - Health and welfare benefit plans
 *
 * Filed with the DOL (Department of Labor) and IRS.
 * Due 7 months after plan year end (July 31 for calendar year plans).
 *
 * This is a complex form with multiple schedules:
 * - Schedule A: Insurance Information
 * - Schedule C: Service Provider Information
 * - Schedule D: DFE/Participating Plan Information
 * - Schedule G: Financial Transaction Schedules
 * - Schedule H: Financial Information (Large Plans)
 * - Schedule I: Financial Information (Small Plans)
 * - Schedule MB: Multiemployer Defined Benefit Plan
 * - Schedule R: Retirement Plan Information
 * - Schedule SB: Single-Employer Defined Benefit Plan
 *
 * For individual taxpayers, this may be relevant for:
 * - Self-employed individuals with solo 401(k) plans
 * - Small business owners with retirement plans
 */

export type PlanType =
  | 'definedBenefit'
  | 'definedContribution'
  | '401k'
  | 'profitSharing'
  | 'esop'
  | 'welfare'
export type FundingType = 'trust' | 'insurance' | 'generalAssets'

export interface PlanSponsorInfo {
  name: string
  ein: string
  address: string
  city: string
  state: string
  zip: string
  phone: string
  businessCode: string
}

export interface PlanAdministratorInfo {
  name: string
  ein: string
  address: string
  isSameAsSponsor: boolean
}

export interface PlanFinancialInfo {
  // Assets
  beginningYearAssets: number
  endOfYearAssets: number
  // Contributions
  employerContributions: number
  participantContributions: number
  otherContributions: number
  totalContributions: number
  // Distributions and expenses
  benefitsPaid: number
  administrativeExpenses: number
  otherExpenses: number
  totalDistributionsAndExpenses: number
  // Investment income
  interestIncome: number
  dividendIncome: number
  rentsIncome: number
  netGainOnAssets: number
  otherIncome: number
  totalIncome: number
  // Net change
  netAssetChange: number
}

export interface ParticipantInfo {
  activeParticipants: number
  retiredParticipants: number
  separatedParticipantsEntitled: number
  deceasedParticipants: number
  totalParticipants: number
  beneficiariesReceivingBenefits: number
}

export interface Form5500Info {
  // Plan identification
  planName: string
  planNumber: string // Usually 001, 002, etc.
  planType: PlanType
  fundingType: FundingType
  planYearBegin: Date
  planYearEnd: Date
  isFirstYearPlan: boolean
  isLastYearPlan: boolean
  // Plan sponsor
  planSponsor: PlanSponsorInfo
  // Plan administrator
  planAdministrator: PlanAdministratorInfo
  // Financial information
  financialInfo: PlanFinancialInfo
  // Participants
  participantInfo: ParticipantInfo
  // Other
  isSmallPlan: boolean // < 100 participants
  requiresAudit: boolean // Generally > 100 participants
  hasFidelityBond: boolean
  fidelityBondAmount: number
}

export default class F5500 extends F1040Attachment {
  tag: FormTag = 'f5500'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF5500Info()
  }

  hasF5500Info = (): boolean => {
    return this.f5500Info() !== undefined
  }

  f5500Info = (): Form5500Info | undefined => {
    return this.f1040.info.employeeBenefitPlan as Form5500Info | undefined
  }

  // Plan Identification
  planName = (): string => this.f5500Info()?.planName ?? ''
  planNumber = (): string => this.f5500Info()?.planNumber ?? '001'
  planType = (): PlanType => this.f5500Info()?.planType ?? 'definedContribution'
  fundingType = (): FundingType => this.f5500Info()?.fundingType ?? 'trust'

  planYearBegin = (): string =>
    this.f5500Info()?.planYearBegin.toLocaleDateString() ?? ''
  planYearEnd = (): string =>
    this.f5500Info()?.planYearEnd.toLocaleDateString() ?? ''

  isFirstYearPlan = (): boolean => this.f5500Info()?.isFirstYearPlan ?? false
  isLastYearPlan = (): boolean => this.f5500Info()?.isLastYearPlan ?? false

  // Plan Sponsor
  planSponsor = (): PlanSponsorInfo | undefined => this.f5500Info()?.planSponsor

  sponsorName = (): string => this.planSponsor()?.name ?? ''
  sponsorEin = (): string => this.planSponsor()?.ein ?? ''
  sponsorAddress = (): string => this.planSponsor()?.address ?? ''

  // Plan Administrator
  planAdministrator = (): PlanAdministratorInfo | undefined =>
    this.f5500Info()?.planAdministrator

  adminName = (): string => this.planAdministrator()?.name ?? ''
  adminEin = (): string => this.planAdministrator()?.ein ?? ''
  isSameAsSponsor = (): boolean =>
    this.planAdministrator()?.isSameAsSponsor ?? true

  // Financial Information
  financialInfo = (): PlanFinancialInfo | undefined =>
    this.f5500Info()?.financialInfo

  beginningYearAssets = (): number =>
    this.financialInfo()?.beginningYearAssets ?? 0
  endOfYearAssets = (): number => this.financialInfo()?.endOfYearAssets ?? 0

  employerContributions = (): number =>
    this.financialInfo()?.employerContributions ?? 0
  participantContributions = (): number =>
    this.financialInfo()?.participantContributions ?? 0
  totalContributions = (): number => {
    return (
      this.financialInfo()?.totalContributions ??
      sumFields([
        this.employerContributions(),
        this.participantContributions(),
        this.financialInfo()?.otherContributions ?? 0
      ])
    )
  }

  benefitsPaid = (): number => this.financialInfo()?.benefitsPaid ?? 0
  administrativeExpenses = (): number =>
    this.financialInfo()?.administrativeExpenses ?? 0
  totalDistributionsAndExpenses = (): number =>
    this.financialInfo()?.totalDistributionsAndExpenses ?? 0

  totalIncome = (): number => this.financialInfo()?.totalIncome ?? 0
  netAssetChange = (): number => this.financialInfo()?.netAssetChange ?? 0

  // Participants
  participantInfo = (): ParticipantInfo | undefined =>
    this.f5500Info()?.participantInfo

  activeParticipants = (): number =>
    this.participantInfo()?.activeParticipants ?? 0
  retiredParticipants = (): number =>
    this.participantInfo()?.retiredParticipants ?? 0
  totalParticipants = (): number =>
    this.participantInfo()?.totalParticipants ?? 0

  // Other
  isSmallPlan = (): boolean => this.f5500Info()?.isSmallPlan ?? true
  requiresAudit = (): boolean => this.f5500Info()?.requiresAudit ?? false
  hasFidelityBond = (): boolean => this.f5500Info()?.hasFidelityBond ?? false
  fidelityBondAmount = (): number => this.f5500Info()?.fidelityBondAmount ?? 0

  fields = (): Field[] => {
    const sponsor = this.planSponsor()
    const admin = this.planAdministrator()
    const financial = this.financialInfo()
    const participants = this.participantInfo()

    return [
      // Plan Identification
      this.planName(),
      this.planNumber(),
      this.planType(),
      this.fundingType(),
      this.planYearBegin(),
      this.planYearEnd(),
      this.isFirstYearPlan(),
      this.isLastYearPlan(),
      // Plan Sponsor
      this.sponsorName(),
      this.sponsorEin(),
      sponsor?.address ?? '',
      sponsor?.city ?? '',
      sponsor?.state ?? '',
      sponsor?.zip ?? '',
      sponsor?.phone ?? '',
      sponsor?.businessCode ?? '',
      // Plan Administrator
      this.isSameAsSponsor(),
      this.adminName(),
      this.adminEin(),
      admin?.address ?? '',
      // Financial Information
      this.beginningYearAssets(),
      this.endOfYearAssets(),
      this.employerContributions(),
      this.participantContributions(),
      this.totalContributions(),
      this.benefitsPaid(),
      this.administrativeExpenses(),
      this.totalDistributionsAndExpenses(),
      financial?.interestIncome ?? 0,
      financial?.dividendIncome ?? 0,
      financial?.netGainOnAssets ?? 0,
      this.totalIncome(),
      this.netAssetChange(),
      // Participants
      this.activeParticipants(),
      this.retiredParticipants(),
      participants?.separatedParticipantsEntitled ?? 0,
      participants?.deceasedParticipants ?? 0,
      this.totalParticipants(),
      participants?.beneficiariesReceivingBenefits ?? 0,
      // Other
      this.isSmallPlan(),
      this.requiresAudit(),
      this.hasFidelityBond(),
      this.fidelityBondAmount()
    ]
  }
}
