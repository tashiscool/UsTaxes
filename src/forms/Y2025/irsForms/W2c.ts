import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form W-2c - Corrected Wage and Tax Statement
 *
 * Used by employers to correct errors on previously issued W-2 forms.
 * Common corrections include:
 * - Employee name or SSN
 * - Wages, tips, or other compensation
 * - Taxes withheld
 * - Allocated tips
 * - Dependent care benefits
 *
 * Must be issued whenever a W-2 error is discovered.
 */

export interface W2cData {
  // Employer Information
  employerEIN: string
  employerName: string
  employerAddress: string
  employerCity: string
  employerState: string
  employerZip: string
  employerContactName?: string
  employerPhone?: string
  employerFax?: string
  employerEmail?: string
  // Employee Information
  employeeSSN: string
  employeeSSNCorrected?: string            // If SSN was incorrect
  employeeFirstName: string
  employeeFirstNameCorrected?: string
  employeeMiddleName?: string
  employeeMiddleNameCorrected?: string
  employeeLastName: string
  employeeLastNameCorrected?: string
  employeeSuffix?: string
  employeeSuffixCorrected?: string
  employeeAddress: string
  employeeAddressCorrected?: string
  employeeCity: string
  employeeCityCorrected?: string
  employeeState: string
  employeeStateCorrected?: string
  employeeZip: string
  employeeZipCorrected?: string
  // Tax Year Being Corrected
  taxYearCorrected: number
  // Originally Reported Amounts
  wagesOriginal: number                    // Box 1
  federalWithheldOriginal: number          // Box 2
  ssWagesOriginal: number                  // Box 3
  ssWithheldOriginal: number               // Box 4
  medicareWagesOriginal: number            // Box 5
  medicareWithheldOriginal: number         // Box 6
  ssTipsOriginal?: number                  // Box 7
  allocatedTipsOriginal?: number           // Box 8
  dependentCareBenefitsOriginal?: number   // Box 10
  nonqualifiedPlansOriginal?: number       // Box 11
  // Corrected Amounts
  wagesCorrected: number                   // Box 1
  federalWithheldCorrected: number         // Box 2
  ssWagesCorrected: number                 // Box 3
  ssWithheldCorrected: number              // Box 4
  medicareWagesCorrected: number           // Box 5
  medicareWithheldCorrected: number        // Box 6
  ssTipsCorrected?: number                 // Box 7
  allocatedTipsCorrected?: number          // Box 8
  dependentCareBenefitsCorrected?: number  // Box 10
  nonqualifiedPlansCorrected?: number      // Box 11
  // State/Local (if applicable)
  stateOriginal?: string
  stateWagesOriginal?: number
  stateWithheldOriginal?: number
  stateCorrected?: string
  stateWagesCorrected?: number
  stateWithheldCorrected?: number
  localWagesOriginal?: number
  localWithheldOriginal?: number
  localWagesCorrected?: number
  localWithheldCorrected?: number
  localityName?: string
}

export default class W2c extends F1040Attachment {
  tag: FormTag = 'w2c'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasW2cData()
  }

  hasW2cData = (): boolean => {
    return false
  }

  w2cData = (): W2cData | undefined => {
    return undefined
  }

  // Differences between original and corrected
  wagesDifference = (): number => {
    const data = this.w2cData()
    if (!data) return 0
    return data.wagesCorrected - data.wagesOriginal
  }

  federalWithheldDifference = (): number => {
    const data = this.w2cData()
    if (!data) return 0
    return data.federalWithheldCorrected - data.federalWithheldOriginal
  }

  ssWagesDifference = (): number => {
    const data = this.w2cData()
    if (!data) return 0
    return data.ssWagesCorrected - data.ssWagesOriginal
  }

  medicareWagesDifference = (): number => {
    const data = this.w2cData()
    if (!data) return 0
    return data.medicareWagesCorrected - data.medicareWagesOriginal
  }

  // Is SSN being corrected?
  isSSNCorrected = (): boolean => {
    const data = this.w2cData()
    return (data?.employeeSSNCorrected ?? '').length > 0
  }

  // Is name being corrected?
  isNameCorrected = (): boolean => {
    const data = this.w2cData()
    return (data?.employeeFirstNameCorrected ?? '').length > 0 ||
           (data?.employeeLastNameCorrected ?? '').length > 0
  }

  // Is address being corrected?
  isAddressCorrected = (): boolean => {
    const data = this.w2cData()
    return (data?.employeeAddressCorrected ?? '').length > 0
  }

  // Tax year being corrected
  taxYearCorrected = (): number => {
    return this.w2cData()?.taxYearCorrected ?? 0
  }

  fields = (): Field[] => {
    const data = this.w2cData()

    return [
      // Employer Information
      data?.employerEIN ?? '',
      data?.employerName ?? '',
      data?.employerAddress ?? '',
      data?.employerCity ?? '',
      data?.employerState ?? '',
      data?.employerZip ?? '',
      data?.employerContactName ?? '',
      data?.employerPhone ?? '',
      data?.employerFax ?? '',
      data?.employerEmail ?? '',
      // Employee Information - Original
      data?.employeeSSN ?? '',
      data?.employeeFirstName ?? '',
      data?.employeeMiddleName ?? '',
      data?.employeeLastName ?? '',
      data?.employeeSuffix ?? '',
      data?.employeeAddress ?? '',
      data?.employeeCity ?? '',
      data?.employeeState ?? '',
      data?.employeeZip ?? '',
      // Employee Information - Corrected
      this.isSSNCorrected(),
      data?.employeeSSNCorrected ?? '',
      this.isNameCorrected(),
      data?.employeeFirstNameCorrected ?? '',
      data?.employeeMiddleNameCorrected ?? '',
      data?.employeeLastNameCorrected ?? '',
      data?.employeeSuffixCorrected ?? '',
      this.isAddressCorrected(),
      data?.employeeAddressCorrected ?? '',
      data?.employeeCityCorrected ?? '',
      data?.employeeStateCorrected ?? '',
      data?.employeeZipCorrected ?? '',
      // Tax Year
      this.taxYearCorrected(),
      // Box 1: Wages - Originally Reported vs Corrected
      data?.wagesOriginal ?? 0,
      data?.wagesCorrected ?? 0,
      this.wagesDifference(),
      // Box 2: Federal Tax Withheld
      data?.federalWithheldOriginal ?? 0,
      data?.federalWithheldCorrected ?? 0,
      this.federalWithheldDifference(),
      // Box 3: SS Wages
      data?.ssWagesOriginal ?? 0,
      data?.ssWagesCorrected ?? 0,
      this.ssWagesDifference(),
      // Box 4: SS Tax Withheld
      data?.ssWithheldOriginal ?? 0,
      data?.ssWithheldCorrected ?? 0,
      // Box 5: Medicare Wages
      data?.medicareWagesOriginal ?? 0,
      data?.medicareWagesCorrected ?? 0,
      this.medicareWagesDifference(),
      // Box 6: Medicare Tax Withheld
      data?.medicareWithheldOriginal ?? 0,
      data?.medicareWithheldCorrected ?? 0,
      // Box 7: SS Tips
      data?.ssTipsOriginal ?? 0,
      data?.ssTipsCorrected ?? 0,
      // Box 8: Allocated Tips
      data?.allocatedTipsOriginal ?? 0,
      data?.allocatedTipsCorrected ?? 0,
      // Box 10: Dependent Care Benefits
      data?.dependentCareBenefitsOriginal ?? 0,
      data?.dependentCareBenefitsCorrected ?? 0,
      // Box 11: Nonqualified Plans
      data?.nonqualifiedPlansOriginal ?? 0,
      data?.nonqualifiedPlansCorrected ?? 0,
      // State/Local
      data?.stateOriginal ?? '',
      data?.stateWagesOriginal ?? 0,
      data?.stateWithheldOriginal ?? 0,
      data?.stateCorrected ?? '',
      data?.stateWagesCorrected ?? 0,
      data?.stateWithheldCorrected ?? 0,
      data?.localWagesOriginal ?? 0,
      data?.localWithheldOriginal ?? 0,
      data?.localWagesCorrected ?? 0,
      data?.localWithheldCorrected ?? 0,
      data?.localityName ?? ''
    ]
  }
}
