import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 8857 - Request for Innocent Spouse Relief
 *
 * Used to request relief from joint tax liability when:
 * - Traditional Innocent Spouse Relief (Section 6015(b))
 * - Separation of Liability (Section 6015(c))
 * - Equitable Relief (Section 6015(f))
 *
 * Applies when a joint return was filed but one spouse was
 * unaware of the understatement or payment issues.
 */

export interface F8857Data {
  // Part I: Your Information
  yourName: string
  yourSSN: string
  currentAddress: string
  city: string
  state: string
  zip: string
  daytimePhone: string
  bestTimeToCall?: string
  // Current spouse/partner
  currentMaritalStatus:
    | 'married'
    | 'divorced'
    | 'separated'
    | 'widowed'
    | 'single'
  dateOfDivorce?: Date
  dateOfSeparation?: Date
  // Part II: Information About the Person Who Filed Joint Return With You
  spouseName: string
  spouseSSN: string
  spouseCurrentAddress?: string
  stillMarriedToSpouse: boolean
  // Part III: Tax Years for Relief
  taxYearsRequested: number[]
  // Part IV: Type of Relief Requested
  reliefType:
    | 'innocent_spouse'
    | 'separation_of_liability'
    | 'equitable_relief'
    | 'all'
  // Part V: Reason for Relief
  didNotKnowAboutUnderstatement: boolean
  knewSomethingWasWrong?: boolean
  whereYouAwarePenalty?: boolean
  didSpouseLieOrHide?: boolean
  wereYouAbused?: boolean
  explanationOfCircumstances: string
  // Part VI: Your Financial Situation
  currentEmployer?: string
  currentIncome?: number
  monthlyExpenses?: number
  // Signature
  signatureDate: Date
}

export default class F8857 extends F1040Attachment {
  tag: FormTag = 'f8857'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF8857Data()
  }

  hasF8857Data = (): boolean => {
    return false
  }

  f8857Data = (): F8857Data | undefined => {
    return undefined
  }

  // Relief type
  reliefType = (): string => this.f8857Data()?.reliefType ?? ''

  isInnocentSpouseRelief = (): boolean => {
    const type = this.reliefType()
    return type === 'innocent_spouse' || type === 'all'
  }

  isSeparationOfLiability = (): boolean => {
    const type = this.reliefType()
    return type === 'separation_of_liability' || type === 'all'
  }

  isEquitableRelief = (): boolean => {
    const type = this.reliefType()
    return type === 'equitable_relief' || type === 'all'
  }

  // Marital status
  isStillMarried = (): boolean => {
    return this.f8857Data()?.currentMaritalStatus === 'married'
  }

  isDivorced = (): boolean => {
    return this.f8857Data()?.currentMaritalStatus === 'divorced'
  }

  isSeparated = (): boolean => {
    return this.f8857Data()?.currentMaritalStatus === 'separated'
  }

  // Tax years
  taxYearsRequestedCount = (): number => {
    return this.f8857Data()?.taxYearsRequested.length ?? 0
  }

  // Abuse claim
  claimsAbuse = (): boolean => {
    return this.f8857Data()?.wereYouAbused ?? false
  }

  // Knowledge factors
  didNotKnow = (): boolean => {
    return this.f8857Data()?.didNotKnowAboutUnderstatement ?? false
  }

  spouseLiedOrHid = (): boolean => {
    return this.f8857Data()?.didSpouseLieOrHide ?? false
  }

  fields = (): Field[] => {
    const data = this.f8857Data()

    return [
      // Part I: Your Information
      data?.yourName ?? '',
      data?.yourSSN ?? '',
      data?.currentAddress ?? '',
      data?.city ?? '',
      data?.state ?? '',
      data?.zip ?? '',
      data?.daytimePhone ?? '',
      data?.bestTimeToCall ?? '',
      // Marital status
      this.isStillMarried(),
      this.isDivorced(),
      this.isSeparated(),
      data?.currentMaritalStatus === 'widowed',
      data?.currentMaritalStatus === 'single',
      data?.dateOfDivorce?.toLocaleDateString() ?? '',
      data?.dateOfSeparation?.toLocaleDateString() ?? '',
      // Part II: Spouse Information
      data?.spouseName ?? '',
      data?.spouseSSN ?? '',
      data?.spouseCurrentAddress ?? '',
      data?.stillMarriedToSpouse ?? false,
      // Part III: Tax Years
      (data?.taxYearsRequested ?? []).join(', '),
      this.taxYearsRequestedCount(),
      // Part IV: Type of Relief
      this.isInnocentSpouseRelief(),
      this.isSeparationOfLiability(),
      this.isEquitableRelief(),
      data?.reliefType === 'all',
      // Part V: Reason for Relief
      this.didNotKnow(),
      data?.knewSomethingWasWrong ?? false,
      data?.whereYouAwarePenalty ?? false,
      this.spouseLiedOrHid(),
      this.claimsAbuse(),
      data?.explanationOfCircumstances ?? '',
      // Part VI: Financial Situation
      data?.currentEmployer ?? '',
      data?.currentIncome ?? 0,
      data?.monthlyExpenses ?? 0,
      // Signature
      data?.signatureDate.toLocaleDateString() ?? ''
    ]
  }
}
