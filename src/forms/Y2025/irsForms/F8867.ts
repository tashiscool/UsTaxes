import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 8867 - Paid Preparer's Due Diligence Checklist
 *
 * Required for paid preparers claiming:
 * - Earned Income Tax Credit (EITC/EIC)
 * - Child Tax Credit (CTC)/Additional Child Tax Credit (ACTC)
 * - American Opportunity Tax Credit (AOTC)
 * - Head of Household (HOH) filing status
 *
 * Penalty for failure: $600 per credit/status claimed without due diligence
 */

export interface F8867Data {
  // Preparer Information
  preparerName: string
  preparerPTIN: string
  preparerFirmName?: string
  preparerFirmEIN?: string
  // Taxpayer Information
  taxpayerName: string
  taxpayerSSN: string
  taxYear: number
  // Part I: Due Diligence Requirements - All Credits
  // Eligibility checklists completed
  completedEICChecklist: boolean
  completedCTCChecklist: boolean
  completedAOTCChecklist: boolean
  completedHOHChecklist: boolean
  // Part II: Due Diligence Questions - EIC
  claimingEIC: boolean
  eicQualifyingChildren: number
  eicDocumentsReviewed: boolean
  eicIncomeDocumentsReviewed: boolean
  // Part III: Due Diligence Questions - CTC/ACTC/ODC
  claimingCTC: boolean
  ctcQualifyingChildren: number
  ctcDocumentsReviewed: boolean
  // Part IV: Due Diligence Questions - AOTC
  claimingAOTC: boolean
  aotcStudents: number
  aotcForm1098TReviewed: boolean
  aotcExpenseDocumentsReviewed: boolean
  // Part V: Due Diligence Questions - HOH
  claimingHOH: boolean
  hohQualifyingPersonDocuments: boolean
  hohMaintenanceDocuments: boolean
  // Part VI: Eligibility Certification
  knowledgeBasedOnReasonableInquiries: boolean
  documentsKept: boolean
  noKnowledgeOfFraud: boolean
  // Signature
  signatureDate: Date
}

// Penalty amount per credit/status
const DUE_DILIGENCE_PENALTY = 600

export default class F8867 extends F1040Attachment {
  tag: FormTag = 'f8867'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF8867Data()
  }

  hasF8867Data = (): boolean => {
    return false  // Only needed by paid preparers
  }

  f8867Data = (): F8867Data | undefined => {
    return undefined
  }

  // Credits claimed
  isClaimingEIC = (): boolean => this.f8867Data()?.claimingEIC ?? false
  isClaimingCTC = (): boolean => this.f8867Data()?.claimingCTC ?? false
  isClaimingAOTC = (): boolean => this.f8867Data()?.claimingAOTC ?? false
  isClaimingHOH = (): boolean => this.f8867Data()?.claimingHOH ?? false

  // Number of credits/statuses requiring due diligence
  creditsRequiringDueDiligence = (): number => {
    let count = 0
    if (this.isClaimingEIC()) count++
    if (this.isClaimingCTC()) count++
    if (this.isClaimingAOTC()) count++
    if (this.isClaimingHOH()) count++
    return count
  }

  // Potential penalty if due diligence not met
  potentialPenalty = (): number => {
    return this.creditsRequiringDueDiligence() * DUE_DILIGENCE_PENALTY
  }

  // Are all due diligence requirements met?
  allRequirementsMet = (): boolean => {
    const data = this.f8867Data()
    if (!data) return false

    return data.knowledgeBasedOnReasonableInquiries &&
           data.documentsKept &&
           data.noKnowledgeOfFraud
  }

  // EIC children count
  eicQualifyingChildren = (): number => {
    return this.f8867Data()?.eicQualifyingChildren ?? 0
  }

  // CTC children count
  ctcQualifyingChildren = (): number => {
    return this.f8867Data()?.ctcQualifyingChildren ?? 0
  }

  // AOTC students count
  aotcStudents = (): number => {
    return this.f8867Data()?.aotcStudents ?? 0
  }

  fields = (): Field[] => {
    const data = this.f8867Data()

    return [
      // Preparer Information
      data?.preparerName ?? '',
      data?.preparerPTIN ?? '',
      data?.preparerFirmName ?? '',
      data?.preparerFirmEIN ?? '',
      // Taxpayer Information
      data?.taxpayerName ?? '',
      data?.taxpayerSSN ?? '',
      data?.taxYear ?? 2025,
      // Part I: Checklists completed
      data?.completedEICChecklist ?? false,
      data?.completedCTCChecklist ?? false,
      data?.completedAOTCChecklist ?? false,
      data?.completedHOHChecklist ?? false,
      // Part II: EIC
      this.isClaimingEIC(),
      this.eicQualifyingChildren(),
      data?.eicDocumentsReviewed ?? false,
      data?.eicIncomeDocumentsReviewed ?? false,
      // Part III: CTC
      this.isClaimingCTC(),
      this.ctcQualifyingChildren(),
      data?.ctcDocumentsReviewed ?? false,
      // Part IV: AOTC
      this.isClaimingAOTC(),
      this.aotcStudents(),
      data?.aotcForm1098TReviewed ?? false,
      data?.aotcExpenseDocumentsReviewed ?? false,
      // Part V: HOH
      this.isClaimingHOH(),
      data?.hohQualifyingPersonDocuments ?? false,
      data?.hohMaintenanceDocuments ?? false,
      // Part VI: Certification
      data?.knowledgeBasedOnReasonableInquiries ?? false,
      data?.documentsKept ?? false,
      data?.noKnowledgeOfFraud ?? false,
      this.allRequirementsMet(),
      // Calculations
      this.creditsRequiringDueDiligence(),
      this.potentialPenalty(),
      // Signature
      data?.signatureDate?.toLocaleDateString() ?? ''
    ]
  }
}
