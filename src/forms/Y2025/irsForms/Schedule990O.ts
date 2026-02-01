import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Schedule O (Form 990) - Supplemental Information to Form 990
 *
 * Used to provide additional information required by Form 990.
 * Organizations use this schedule to:
 * - Explain answers to Form 990 questions
 * - Provide narrative descriptions
 * - Describe governance policies
 * - Detail program accomplishments
 *
 * This is a free-form schedule for supplemental explanations.
 */

export interface SupplementalExplanation {
  formPart: string
  lineNumber: string
  explanation: string
}

export interface Schedule990OData {
  organizationName: string
  ein: string
  explanations: SupplementalExplanation[]
  // Common explanations
  missionStatement?: string
  significantActivitiesDescription?: string
  governancePoliciesDescription?: string
  conflictOfInterestPolicy?: string
  whistleblowerPolicy?: string
  documentRetentionPolicy?: string
  compensationProcessDescription?: string
  jointVenturePolicy?: string
}

export default class Schedule990O extends F1040Attachment {
  tag: FormTag = 'f990so'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasSupplementalExplanations()
  }

  hasSupplementalExplanations = (): boolean => {
    const exemptOrg = this.f1040.info.exemptOrgReturn
    return exemptOrg !== undefined
  }

  schedule990OData = (): Schedule990OData | undefined => {
    return undefined // Would be populated from organization data
  }

  // Get explanations
  explanations = (): SupplementalExplanation[] => {
    return this.schedule990OData()?.explanations ?? []
  }

  // Organization info
  organizationName = (): string => {
    return this.schedule990OData()?.organizationName ?? ''
  }

  ein = (): string => {
    return this.schedule990OData()?.ein ?? ''
  }

  // Common policy descriptions
  missionStatement = (): string => {
    return this.schedule990OData()?.missionStatement ?? ''
  }

  conflictOfInterestPolicy = (): string => {
    return this.schedule990OData()?.conflictOfInterestPolicy ?? ''
  }

  whistleblowerPolicy = (): string => {
    return this.schedule990OData()?.whistleblowerPolicy ?? ''
  }

  documentRetentionPolicy = (): string => {
    return this.schedule990OData()?.documentRetentionPolicy ?? ''
  }

  // Get explanation by form part and line
  getExplanation = (formPart: string, lineNumber: string): string => {
    const explanation = this.explanations().find(
      (e) => e.formPart === formPart && e.lineNumber === lineNumber
    )
    return explanation?.explanation ?? ''
  }

  // Count of explanations
  numberOfExplanations = (): number => {
    return this.explanations().length
  }

  fields = (): Field[] => {
    const data = this.schedule990OData()
    const explanations = this.explanations()

    return [
      // Header
      this.organizationName(),
      this.ein(),
      // Explanation 1
      explanations[0]?.formPart ?? '',
      explanations[0]?.lineNumber ?? '',
      explanations[0]?.explanation ?? '',
      // Explanation 2
      explanations[1]?.formPart ?? '',
      explanations[1]?.lineNumber ?? '',
      explanations[1]?.explanation ?? '',
      // Explanation 3
      explanations[2]?.formPart ?? '',
      explanations[2]?.lineNumber ?? '',
      explanations[2]?.explanation ?? '',
      // Explanation 4
      explanations[3]?.formPart ?? '',
      explanations[3]?.lineNumber ?? '',
      explanations[3]?.explanation ?? '',
      // Common policies
      data?.missionStatement ?? '',
      data?.significantActivitiesDescription ?? '',
      data?.governancePoliciesDescription ?? '',
      data?.conflictOfInterestPolicy ?? '',
      data?.whistleblowerPolicy ?? '',
      data?.documentRetentionPolicy ?? '',
      data?.compensationProcessDescription ?? '',
      data?.jointVenturePolicy ?? '',
      // Count
      this.numberOfExplanations()
    ]
  }
}
