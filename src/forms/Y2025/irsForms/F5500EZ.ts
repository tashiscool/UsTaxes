import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 5500-EZ - Annual Return of A One-Participant (Owners/Partners and Their Spouses) Retirement Plan
 *
 * Simplified version of Form 5500 for:
 * - One-participant plans (owner-only or owner + spouse)
 * - Solo 401(k) plans
 * - Plans that cover only owners/partners and their spouses
 *
 * Eligibility requirements:
 * - Plan covers only owner(s) and spouse(s)
 * - No common-law employees (or only spouse)
 * - Total plan assets at end of year > $250,000 (otherwise filing not required)
 *
 * Key differences from Form 5500:
 * - Much simpler, single-page form
 * - No schedules required
 * - No audit requirement
 * - Filed directly with IRS, not DOL
 *
 * Due date: Same as Form 5500 (July 31 for calendar year plans)
 * Can request extension using Form 5558
 */

export type OneParticipantPlanType =
  | 'definedBenefit'
  | 'definedContribution'
  | 'both'

export interface Form5500EZInfo {
  // Plan identification
  planName: string
  planNumber: string
  planType: OneParticipantPlanType
  planYearBegin: Date
  planYearEnd: Date
  // Status
  isFirstYearPlan: boolean
  isAmendedReturn: boolean
  isFinalReturn: boolean
  isShortPlanYear: boolean
  // Plan sponsor/employer
  employerName: string
  employerEin: string
  employerAddress: string
  employerCity: string
  employerState: string
  employerZip: string
  employerPhone: string
  businessCode: string
  // Plan features
  has401kFeature: boolean
  hasRothFeature: boolean
  hasProfitSharing: boolean
  hasMoneyPurchase: boolean
  // Financial information
  totalPlanAssets: number
  totalPlanLiabilities: number
  netPlanAssets: number
  employerContributions: number
  participantContributions: number
  // Participant count
  numberOfParticipantsEndOfYear: number
  // Compliance questions
  wasMinDistributionMade: boolean // For participants 72+
  wasExcessContributionCorrected: boolean
  wereLoansInDefault: boolean
  wasProhibitedTransactionCorrected: boolean
}

export default class F5500EZ extends F1040Attachment {
  tag: FormTag = 'f5500ez'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF5500EZInfo()
  }

  hasF5500EZInfo = (): boolean => {
    return this.f5500EZInfo() !== undefined
  }

  f5500EZInfo = (): Form5500EZInfo | undefined => {
    return this.f1040.info.oneParticipantPlan as Form5500EZInfo | undefined
  }

  // Plan Identification
  planName = (): string => this.f5500EZInfo()?.planName ?? ''
  planNumber = (): string => this.f5500EZInfo()?.planNumber ?? '001'
  planType = (): OneParticipantPlanType =>
    this.f5500EZInfo()?.planType ?? 'definedContribution'

  planYearBegin = (): string =>
    this.f5500EZInfo()?.planYearBegin.toLocaleDateString() ?? ''
  planYearEnd = (): string =>
    this.f5500EZInfo()?.planYearEnd.toLocaleDateString() ?? ''

  // Plan Status
  isFirstYearPlan = (): boolean => this.f5500EZInfo()?.isFirstYearPlan ?? false
  isAmendedReturn = (): boolean => this.f5500EZInfo()?.isAmendedReturn ?? false
  isFinalReturn = (): boolean => this.f5500EZInfo()?.isFinalReturn ?? false
  isShortPlanYear = (): boolean => this.f5500EZInfo()?.isShortPlanYear ?? false

  // Employer Information
  employerName = (): string => this.f5500EZInfo()?.employerName ?? ''
  employerEin = (): string => this.f5500EZInfo()?.employerEin ?? ''
  employerAddress = (): string => this.f5500EZInfo()?.employerAddress ?? ''
  employerCity = (): string => this.f5500EZInfo()?.employerCity ?? ''
  employerState = (): string => this.f5500EZInfo()?.employerState ?? ''
  employerZip = (): string => this.f5500EZInfo()?.employerZip ?? ''
  employerPhone = (): string => this.f5500EZInfo()?.employerPhone ?? ''
  businessCode = (): string => this.f5500EZInfo()?.businessCode ?? ''

  // Plan Features
  has401kFeature = (): boolean => this.f5500EZInfo()?.has401kFeature ?? false
  hasRothFeature = (): boolean => this.f5500EZInfo()?.hasRothFeature ?? false
  hasProfitSharing = (): boolean =>
    this.f5500EZInfo()?.hasProfitSharing ?? false
  hasMoneyPurchase = (): boolean =>
    this.f5500EZInfo()?.hasMoneyPurchase ?? false

  isDefinedBenefit = (): boolean => {
    const type = this.planType()
    return type === 'definedBenefit' || type === 'both'
  }

  isDefinedContribution = (): boolean => {
    const type = this.planType()
    return type === 'definedContribution' || type === 'both'
  }

  // Financial Information
  totalPlanAssets = (): number => this.f5500EZInfo()?.totalPlanAssets ?? 0
  totalPlanLiabilities = (): number =>
    this.f5500EZInfo()?.totalPlanLiabilities ?? 0
  netPlanAssets = (): number => {
    return (
      this.f5500EZInfo()?.netPlanAssets ??
      this.totalPlanAssets() - this.totalPlanLiabilities()
    )
  }

  employerContributions = (): number =>
    this.f5500EZInfo()?.employerContributions ?? 0
  participantContributions = (): number =>
    this.f5500EZInfo()?.participantContributions ?? 0
  totalContributions = (): number =>
    this.employerContributions() + this.participantContributions()

  // Participant Count
  numberOfParticipants = (): number =>
    this.f5500EZInfo()?.numberOfParticipantsEndOfYear ?? 1

  // Filing threshold check ($250,000)
  meetsFilingThreshold = (): boolean => this.totalPlanAssets() > 250000

  // Compliance Questions
  wasMinDistributionMade = (): boolean =>
    this.f5500EZInfo()?.wasMinDistributionMade ?? true
  wasExcessContributionCorrected = (): boolean =>
    this.f5500EZInfo()?.wasExcessContributionCorrected ?? true
  wereLoansInDefault = (): boolean =>
    this.f5500EZInfo()?.wereLoansInDefault ?? false
  wasProhibitedTransactionCorrected = (): boolean =>
    this.f5500EZInfo()?.wasProhibitedTransactionCorrected ?? true

  fields = (): Field[] => [
    // Plan Identification
    this.planName(),
    this.planNumber(),
    this.planYearBegin(),
    this.planYearEnd(),
    // Plan Status
    this.isFirstYearPlan(),
    this.isAmendedReturn(),
    this.isFinalReturn(),
    this.isShortPlanYear(),
    // Plan Type
    this.isDefinedBenefit(),
    this.isDefinedContribution(),
    this.has401kFeature(),
    this.hasRothFeature(),
    this.hasProfitSharing(),
    this.hasMoneyPurchase(),
    // Employer Information
    this.employerName(),
    this.employerEin(),
    this.employerAddress(),
    this.employerCity(),
    this.employerState(),
    this.employerZip(),
    this.employerPhone(),
    this.businessCode(),
    // Financial Information
    this.totalPlanAssets(),
    this.totalPlanLiabilities(),
    this.netPlanAssets(),
    this.employerContributions(),
    this.participantContributions(),
    this.totalContributions(),
    // Participants
    this.numberOfParticipants(),
    // Compliance Questions
    this.wasMinDistributionMade(),
    this.wasExcessContributionCorrected(),
    this.wereLoansInDefault(),
    this.wasProhibitedTransactionCorrected()
  ]
}
