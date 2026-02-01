import Form from 'ustaxes/core/irsForms/Form'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { FormW2Generated, FormW3Data, W2Box12Info } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form W-2 - Wage and Tax Statement
 *
 * Employers must provide W-2 forms to employees by January 31
 * showing wages paid and taxes withheld during the year.
 *
 * Copies distributed:
 * - Copy A: SSA (with W-3)
 * - Copy B: Employee (for federal return)
 * - Copy C: Employee (for records)
 * - Copy D: Employer records
 * - Copy 1: State/local tax department
 * - Copy 2: Employee (for state/local return)
 */

export class FormW2 extends Form {
  tag: FormTag = 'fw2'
  sequenceIndex = 999

  data: FormW2Generated

  constructor(data: FormW2Generated) {
    super()
    this.data = data
  }

  // Employer information
  employerEIN = (): string => this.data.employerEIN
  employerName = (): string => this.data.employerName
  employerAddress = (): string => {
    const addr = this.data.employerAddress
    return `${addr.address}, ${addr.city}, ${addr.state ?? ''} ${
      addr.zip ?? ''
    }`
  }

  // Employee information
  employeeSSN = (): string => this.data.employeeSSN
  employeeName = (): string => this.data.employeeName
  employeeAddress = (): string => {
    const addr = this.data.employeeAddress
    if (!addr) return ''
    return `${addr.address}, ${addr.city}, ${addr.state ?? ''} ${
      addr.zip ?? ''
    }`
  }

  // Control number (optional)
  controlNumber = (): string => this.data.controlNumber ?? ''

  // Box 1: Wages, tips, other compensation
  box1 = (): number => this.data.box1Wages

  // Box 2: Federal income tax withheld
  box2 = (): number => this.data.box2FederalWithholding

  // Box 3: Social security wages
  box3 = (): number => this.data.box3SocialSecurityWages

  // Box 4: Social security tax withheld
  box4 = (): number => this.data.box4SocialSecurityTax

  // Box 5: Medicare wages and tips
  box5 = (): number => this.data.box5MedicareWages

  // Box 6: Medicare tax withheld
  box6 = (): number => this.data.box6MedicareTax

  // Box 7: Social security tips
  box7 = (): number => this.data.box7SocialSecurityTips ?? 0

  // Box 8: Allocated tips
  box8 = (): number => this.data.box8AllocatedTips ?? 0

  // Box 10: Dependent care benefits
  box10 = (): number => this.data.box10DependentCareBenefits ?? 0

  // Box 11: Nonqualified plans
  box11 = (): number => this.data.box11NonqualifiedPlans ?? 0

  // Box 12: Codes and amounts (up to 4)
  box12 = (): W2Box12Info => this.data.box12

  // Box 13: Checkboxes
  box13Statutory = (): boolean => this.data.box13Statutory ?? false
  box13Retirement = (): boolean => this.data.box13RetirementPlan ?? false
  box13ThirdPartySick = (): boolean => this.data.box13ThirdPartySickPay ?? false

  // State/local information
  box15State = (): string => this.data.box15State ?? ''
  box15StateEIN = (): string => this.data.box15StateEIN ?? ''
  box16StateWages = (): number => this.data.box16StateWages ?? 0
  box17StateWithholding = (): number => this.data.box17StateWithholding ?? 0
  box18LocalWages = (): number => this.data.box18LocalWages ?? 0
  box19LocalWithholding = (): number => this.data.box19LocalWithholding ?? 0
  box20LocalityName = (): string => this.data.box20LocalityName ?? ''

  taxYear = (): number => this.data.taxYear

  fields = (): Field[] => [
    this.employerEIN(),
    this.employerName(),
    this.employerAddress(),
    this.controlNumber(),
    this.employeeSSN(),
    this.employeeName(),
    this.employeeAddress(),
    this.box1(),
    this.box2(),
    this.box3(),
    this.box4(),
    this.box5(),
    this.box6(),
    this.box7(),
    this.box8(),
    this.box10(),
    this.box11(),
    this.box13Statutory(),
    this.box13Retirement(),
    this.box13ThirdPartySick(),
    this.box15State(),
    this.box15StateEIN(),
    this.box16StateWages(),
    this.box17StateWithholding(),
    this.box18LocalWages(),
    this.box19LocalWithholding(),
    this.box20LocalityName()
  ]
}

/**
 * Form W-3 - Transmittal of Wage and Tax Statements
 *
 * Employers file W-3 with the SSA to transmit all W-2 forms.
 * It's a summary of all W-2s issued.
 *
 * Due date: Last day of February (paper) or March 31 (electronic)
 * Electronic filing required for 10+ W-2s
 */

export class FormW3 extends Form {
  tag: FormTag = 'fw3'
  sequenceIndex = 999

  data: FormW3Data
  w2Forms: FormW2Generated[]

  constructor(data: FormW3Data, w2Forms: FormW2Generated[] = []) {
    super()
    this.data = data
    this.w2Forms = w2Forms
  }

  // Employer information
  employerEIN = (): string => this.data.employerEIN
  employerName = (): string => this.data.employerName
  employerAddress = (): string => {
    const addr = this.data.employerAddress
    return `${addr.address}, ${addr.city}, ${addr.state ?? ''} ${
      addr.zip ?? ''
    }`
  }
  contactName = (): string => this.data.employerContactName ?? ''
  contactPhone = (): string => this.data.employerContactPhone ?? ''
  contactEmail = (): string => this.data.employerContactEmail ?? ''

  // Kind of employer
  kindOfEmployer = (): string => this.data.kindOfEmployer
  is941Employer = (): boolean => this.data.kindOfEmployer === '941'
  is943Employer = (): boolean => this.data.kindOfEmployer === '943'
  is944Employer = (): boolean => this.data.kindOfEmployer === '944'
  isCT1Employer = (): boolean => this.data.kindOfEmployer === 'CT-1'
  isHouseholdEmployer = (): boolean => this.data.kindOfEmployer === 'Household'
  isMilitaryEmployer = (): boolean => this.data.kindOfEmployer === 'Military'

  // Kind of payer
  kindOfPayer = (): string => this.data.kindOfPayer

  // Number of W-2 forms
  numberOfW2s = (): number => this.data.numberOfW2s

  // Aggregate totals (Box numbers match W-2)

  // Box 1: Wages, tips, other compensation
  box1 = (): number => this.data.totalWages

  // Box 2: Federal income tax withheld
  box2 = (): number => this.data.totalFederalWithholding

  // Box 3: Social security wages
  box3 = (): number => this.data.totalSocialSecurityWages

  // Box 4: Social security tax withheld
  box4 = (): number => this.data.totalSocialSecurityTax

  // Box 5: Medicare wages and tips
  box5 = (): number => this.data.totalMedicareWages

  // Box 6: Medicare tax withheld
  box6 = (): number => this.data.totalMedicareTax

  // Box 7: Social security tips
  box7 = (): number => this.data.totalSocialSecurityTips ?? 0

  // Box 8: Allocated tips
  box8 = (): number => this.data.totalAllocatedTips ?? 0

  // Box 10: Dependent care benefits
  box10 = (): number => this.data.totalDependentCareBenefits ?? 0

  // Box 11: Nonqualified plans
  box11 = (): number => this.data.totalNonqualifiedPlans ?? 0

  taxYear = (): number => this.data.taxYear

  // Calculate totals from W-2 forms if available
  calculateTotalsFromW2s = (): {
    wages: number
    federalWithholding: number
    ssWages: number
    ssTax: number
    medicareWages: number
    medicareTax: number
  } => {
    return {
      wages: this.w2Forms.reduce((sum, w2) => sum + w2.box1Wages, 0),
      federalWithholding: this.w2Forms.reduce(
        (sum, w2) => sum + w2.box2FederalWithholding,
        0
      ),
      ssWages: this.w2Forms.reduce(
        (sum, w2) => sum + w2.box3SocialSecurityWages,
        0
      ),
      ssTax: this.w2Forms.reduce(
        (sum, w2) => sum + w2.box4SocialSecurityTax,
        0
      ),
      medicareWages: this.w2Forms.reduce(
        (sum, w2) => sum + w2.box5MedicareWages,
        0
      ),
      medicareTax: this.w2Forms.reduce((sum, w2) => sum + w2.box6MedicareTax, 0)
    }
  }

  fields = (): Field[] => [
    this.employerEIN(),
    this.employerName(),
    this.employerAddress(),
    this.contactName(),
    this.contactPhone(),
    this.contactEmail(),
    this.is941Employer(),
    this.is943Employer(),
    this.is944Employer(),
    this.isCT1Employer(),
    this.isHouseholdEmployer(),
    this.isMilitaryEmployer(),
    this.kindOfPayer(),
    this.numberOfW2s(),
    this.box1(),
    this.box2(),
    this.box3(),
    this.box4(),
    this.box5(),
    this.box6(),
    this.box7(),
    this.box8(),
    this.box10(),
    this.box11(),
    this.taxYear()
  ]
}
