import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form W-4 - Employee's Withholding Certificate
 *
 * Used by employees to tell employers how much federal income tax
 * to withhold from their paychecks.
 *
 * Key changes from 2020 onwards:
 * - No more "allowances"
 * - Uses actual dollar amounts for adjustments
 * - Multiple jobs worksheet
 * - Deductions worksheet
 *
 * Should be updated when:
 * - Starting a new job
 * - Life changes (marriage, divorce, birth of child)
 * - Large refund or balance due from prior year
 */

export interface W4Data {
  // Step 1: Personal Information
  firstName: string
  lastName: string
  ssn: string
  address: string
  city: string
  state: string
  zip: string
  filingStatus: 'single' | 'married_jointly' | 'head_of_household'
  // Step 2: Multiple Jobs or Spouse Works
  multipleJobsOrSpouseWorks: boolean
  useMultipleJobsWorksheet: boolean
  // Step 3: Claim Dependents
  qualifyingChildrenUnder17: number
  otherDependents: number
  totalDependentCredit: number
  // Step 4: Other Adjustments
  otherIncome: number                       // 4(a) - not from jobs
  deductions: number                        // 4(b) - above standard deduction
  extraWithholding: number                  // 4(c) - additional per paycheck
  // Signature
  signatureDate: Date
  // Employer information (filled by employer)
  employerName?: string
  employerEIN?: string
  firstDateOfEmployment?: Date
}

// 2025 Standard Deductions
const STANDARD_DEDUCTIONS = {
  single: 14600,
  married_jointly: 29200,
  head_of_household: 21900
}

// 2025 Child Tax Credit amounts
const CHILD_TAX_CREDIT = 2000
const OTHER_DEPENDENT_CREDIT = 500

export default class W4 extends F1040Attachment {
  tag: FormTag = 'w4'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasW4Data()
  }

  hasW4Data = (): boolean => {
    return false  // Used for withholding, not tax filing
  }

  w4Data = (): W4Data | undefined => {
    return undefined
  }

  // Personal info
  fullName = (): string => {
    const data = this.w4Data()
    return `${data?.firstName ?? ''} ${data?.lastName ?? ''}`.trim()
  }

  ssn = (): string => this.w4Data()?.ssn ?? ''

  filingStatus = (): string => this.w4Data()?.filingStatus ?? 'single'

  // Step 2: Multiple jobs
  hasMultipleJobs = (): boolean => this.w4Data()?.multipleJobsOrSpouseWorks ?? false

  // Step 3: Dependents
  qualifyingChildren = (): number => this.w4Data()?.qualifyingChildrenUnder17 ?? 0
  otherDependents = (): number => this.w4Data()?.otherDependents ?? 0

  // Calculate dependent credit
  dependentCredit = (): number => {
    const children = this.qualifyingChildren() * CHILD_TAX_CREDIT
    const others = this.otherDependents() * OTHER_DEPENDENT_CREDIT
    return children + others
  }

  // Step 4: Adjustments
  otherIncome = (): number => this.w4Data()?.otherIncome ?? 0
  deductions = (): number => this.w4Data()?.deductions ?? 0
  extraWithholding = (): number => this.w4Data()?.extraWithholding ?? 0

  // Standard deduction for filing status
  standardDeduction = (): number => {
    const status = this.filingStatus() as keyof typeof STANDARD_DEDUCTIONS
    return STANDARD_DEDUCTIONS[status] ?? STANDARD_DEDUCTIONS.single
  }

  // Deductions above standard (for 4b)
  deductionsAboveStandard = (): number => {
    return Math.max(0, this.deductions() - this.standardDeduction())
  }

  fields = (): Field[] => {
    const data = this.w4Data()

    return [
      // Step 1: Personal Information
      data?.firstName ?? '',
      data?.lastName ?? '',
      data?.ssn ?? '',
      data?.address ?? '',
      data?.city ?? '',
      data?.state ?? '',
      data?.zip ?? '',
      data?.filingStatus === 'single',
      data?.filingStatus === 'married_jointly',
      data?.filingStatus === 'head_of_household',
      // Step 2: Multiple Jobs
      this.hasMultipleJobs(),
      data?.useMultipleJobsWorksheet ?? false,
      // Step 3: Dependents
      this.qualifyingChildren(),
      this.qualifyingChildren() * CHILD_TAX_CREDIT,
      this.otherDependents(),
      this.otherDependents() * OTHER_DEPENDENT_CREDIT,
      this.dependentCredit(),
      // Step 4: Adjustments
      this.otherIncome(),                // 4(a)
      this.deductions(),                 // 4(b) input
      this.deductionsAboveStandard(),    // 4(b) calculated
      this.extraWithholding(),           // 4(c)
      // Signature
      data?.signatureDate?.toLocaleDateString() ?? '',
      // Employer
      data?.employerName ?? '',
      data?.employerEIN ?? '',
      data?.firstDateOfEmployment?.toLocaleDateString() ?? '',
      // Reference
      this.standardDeduction()
    ]
  }
}
