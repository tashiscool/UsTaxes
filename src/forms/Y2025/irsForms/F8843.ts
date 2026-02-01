import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 8843 - Statement for Exempt Individuals
 *
 * Filed by certain aliens who are present in the US but are not counted
 * as US residents for tax purposes due to their visa status.
 *
 * Exempt individuals include:
 * - Foreign students (F, J, M, or Q visa)
 * - Teachers and trainees (J or Q visa)
 * - Professional athletes temporarily in US for competition
 * - Individuals with medical conditions preventing departure
 *
 * Purpose:
 * - Document days of presence that should be excluded from the
 *   Substantial Presence Test for determining residency
 * - Must be filed even if no income or no tax return required
 *
 * Key rule: Students exempt for first 5 calendar years
 *           Teachers/trainees exempt for first 2 years in any 6-year period
 */

export type ExemptCategory =
  | 'student'
  | 'teacher'
  | 'trainee'
  | 'athlete'
  | 'medical'

export interface ExemptIndividualInfo {
  visaType: string // F-1, J-1, M-1, Q-1, etc.
  category: ExemptCategory
  countryOfCitizenship: string
  countryOfTaxResidence: string
  passportNumber: string
  passportCountry: string
  usEntryDate: Date
  currentImmigrationStatus: string
  statusChangeDate?: Date

  // For students
  schoolName?: string
  schoolAddress?: string
  studentIdNumber?: string
  fieldOfStudy?: string
  academicLevel?: 'undergraduate' | 'graduate' | 'postdoctoral' | 'other'

  // For teachers/trainees
  employerName?: string
  employerAddress?: string
  employerEin?: string
  directorName?: string

  // Days of presence
  daysInUSCurrentYear: number
  priorYearsInUS?: { year: number; days: number }[]
  exemptDaysCurrentYear: number
}

export default class F8843 extends F1040Attachment {
  tag: FormTag = 'f8843'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasExemptIndividualInfo()
  }

  hasExemptIndividualInfo = (): boolean => {
    return this.exemptInfo() !== undefined
  }

  exemptInfo = (): ExemptIndividualInfo | undefined => {
    return this.f1040.info.exemptIndividualInfo as
      | ExemptIndividualInfo
      | undefined
  }

  // Part I - General Information

  // Line 1a: Type of US visa
  l1a = (): string => this.exemptInfo()?.visaType ?? ''

  // Line 1b: Country of citizenship
  l1b = (): string => this.exemptInfo()?.countryOfCitizenship ?? ''

  // Line 1c: Country of tax residence
  l1c = (): string => this.exemptInfo()?.countryOfTaxResidence ?? ''

  // Line 2: Passport number and country
  l2Number = (): string => this.exemptInfo()?.passportNumber ?? ''
  l2Country = (): string => this.exemptInfo()?.passportCountry ?? ''

  // Line 3a: Date of US arrival
  l3a = (): string => this.exemptInfo()?.usEntryDate.toLocaleDateString() ?? ''

  // Line 3b: Current immigration status
  l3b = (): string => this.exemptInfo()?.currentImmigrationStatus ?? ''

  // Line 3c: Status change date (if applicable)
  l3c = (): string =>
    this.exemptInfo()?.statusChangeDate?.toLocaleDateString() ?? ''

  // Part II - Teachers and Trainees

  isTeacherOrTrainee = (): boolean => {
    const cat = this.exemptInfo()?.category
    return cat === 'teacher' || cat === 'trainee'
  }

  // Line 4a: Name of academic institution or program director
  l4a = (): string => {
    const info = this.exemptInfo()
    return info?.employerName ?? info?.schoolName ?? ''
  }

  // Line 4b: Address
  l4b = (): string => {
    const info = this.exemptInfo()
    return info?.employerAddress ?? info?.schoolAddress ?? ''
  }

  // Line 4c: Director name
  l4c = (): string => this.exemptInfo()?.directorName ?? ''

  // Line 5: Prior years in teacher/trainee status
  l5Years = (): string => {
    const priorYears = this.exemptInfo()?.priorYearsInUS ?? []
    return priorYears.map((y) => y.year.toString()).join(', ')
  }

  // Part III - Students

  isStudent = (): boolean => {
    return this.exemptInfo()?.category === 'student'
  }

  // Line 6a: Name of academic institution
  l6a = (): string => this.exemptInfo()?.schoolName ?? ''

  // Line 6b: Address
  l6b = (): string => this.exemptInfo()?.schoolAddress ?? ''

  // Line 6c: Student ID
  l6c = (): string => this.exemptInfo()?.studentIdNumber ?? ''

  // Line 7: Field of study
  l7 = (): string => this.exemptInfo()?.fieldOfStudy ?? ''

  // Line 8: Academic level
  l8Undergrad = (): boolean =>
    this.exemptInfo()?.academicLevel === 'undergraduate'
  l8Graduate = (): boolean => this.exemptInfo()?.academicLevel === 'graduate'
  l8PostDoc = (): boolean => this.exemptInfo()?.academicLevel === 'postdoctoral'
  l8Other = (): boolean => this.exemptInfo()?.academicLevel === 'other'

  // Line 9: Prior years in student status (within last 6 years)
  l9Years = (): string => {
    const priorYears = this.exemptInfo()?.priorYearsInUS ?? []
    const recentYears = priorYears.filter((y) => y.year >= 2019) // Last 6 years
    return recentYears.map((y) => y.year.toString()).join(', ')
  }

  // Part IV - Professional Athletes

  isAthlete = (): boolean => {
    return this.exemptInfo()?.category === 'athlete'
  }

  // Part V - Medical Condition

  hasMedicalCondition = (): boolean => {
    return this.exemptInfo()?.category === 'medical'
  }

  // Summary information

  // Days of presence in US
  daysInUS = (): number => this.exemptInfo()?.daysInUSCurrentYear ?? 0

  // Days excluded from substantial presence test
  exemptDays = (): number => this.exemptInfo()?.exemptDaysCurrentYear ?? 0

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Part I - General
    this.l1a(),
    this.l1b(),
    this.l1c(),
    this.l2Number(),
    this.l2Country(),
    this.l3a(),
    this.l3b(),
    this.l3c(),
    // Part II - Teachers/Trainees
    this.isTeacherOrTrainee(),
    this.l4a(),
    this.l4b(),
    this.l4c(),
    this.l5Years(),
    // Part III - Students
    this.isStudent(),
    this.l6a(),
    this.l6b(),
    this.l6c(),
    this.l7(),
    this.l8Undergrad(),
    this.l8Graduate(),
    this.l8PostDoc(),
    this.l8Other(),
    this.l9Years(),
    // Part IV - Athletes
    this.isAthlete(),
    // Part V - Medical
    this.hasMedicalCondition(),
    // Summary
    this.daysInUS(),
    this.exemptDays()
  ]
}
