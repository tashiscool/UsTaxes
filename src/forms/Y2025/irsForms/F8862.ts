import F1040Attachment from './F1040Attachment'
import { FilingStatus } from 'ustaxes/core/data'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 8862 - Information To Claim Certain Credits After Disallowance
 *
 * Required to claim certain credits after they were previously disallowed.
 * This form must be filed to "unlock" the credits in subsequent years.
 *
 * Credits requiring Form 8862 after disallowance:
 * - Earned Income Credit (EIC)
 * - Child Tax Credit (CTC)
 * - Additional Child Tax Credit (ACTC)
 * - Credit for Other Dependents (ODC)
 * - American Opportunity Tax Credit (AOTC)
 *
 * 2025 Rules:
 * - Required if credit was reduced or disallowed for any reason other than
 *   a math or clerical error
 * - Not required if credit was disallowed solely due to math error
 * - Two-year ban for reckless disregard of rules
 * - Ten-year ban for fraud
 */

export interface CreditDisallowanceInfo {
  disallowedCredits: ('EIC' | 'CTC' | 'ACTC' | 'ODC' | 'AOTC')[]
  disallowanceYear: number
  disallowanceReason: 'error' | 'reckless' | 'fraud' | 'other'
  wasAppealed: boolean
  appealResult?: 'upheld' | 'reversed' | 'pending'
  meetRequirementsNow: boolean
  qualifyingChildrenInfo?: {
    childName: string
    childSsn: string
    relationship: string
    monthsLivedWithYou: number
    isStudent: boolean
    isPermanentlyDisabled: boolean
  }[]
}

export default class F8862 extends F1040Attachment {
  tag: FormTag = 'f8862'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasDisallowedCredits() && this.isEligibleToRefile()
  }

  hasDisallowedCredits = (): boolean => {
    return this.disallowanceInfo() !== undefined
  }

  disallowanceInfo = (): CreditDisallowanceInfo | undefined => {
    return this.f1040.info.creditDisallowance as CreditDisallowanceInfo | undefined
  }

  // Check if enough time has passed since disallowance
  isEligibleToRefile = (): boolean => {
    const info = this.disallowanceInfo()
    if (!info) return false

    const currentYear = 2025
    const yearsSinceDisallowance = currentYear - info.disallowanceYear

    // Check ban period
    if (info.disallowanceReason === 'fraud') {
      return yearsSinceDisallowance >= 10
    }
    if (info.disallowanceReason === 'reckless') {
      return yearsSinceDisallowance >= 2
    }
    // Regular disallowance - can refile next year
    return yearsSinceDisallowance >= 1
  }

  // Part I - All Filers

  // Line 1: Which credit(s) were disallowed?
  eicDisallowed = (): boolean => {
    return this.disallowanceInfo()?.disallowedCredits.includes('EIC') ?? false
  }

  ctcDisallowed = (): boolean => {
    return this.disallowanceInfo()?.disallowedCredits.includes('CTC') ?? false
  }

  actcDisallowed = (): boolean => {
    return this.disallowanceInfo()?.disallowedCredits.includes('ACTC') ?? false
  }

  odcDisallowed = (): boolean => {
    return this.disallowanceInfo()?.disallowedCredits.includes('ODC') ?? false
  }

  aotcDisallowed = (): boolean => {
    return this.disallowanceInfo()?.disallowedCredits.includes('AOTC') ?? false
  }

  // Line 2: Year credit was disallowed
  l2 = (): number => this.disallowanceInfo()?.disallowanceYear ?? 0

  // Part II - Earned Income Credit

  // Line 3: Do you have a qualifying child for EIC?
  l3 = (): boolean => {
    const deps = this.f1040.info.taxPayer.dependents ?? []
    return deps.some(d => {
      const age = 2025 - new Date(d.dateOfBirth).getFullYear()
      return age < 19 || (age < 24 && d.qualifyingInfo?.isStudent)
    })
  }

  // Lines 4-7: Qualifying child information
  qualifyingChildren = () => {
    return this.disallowanceInfo()?.qualifyingChildrenInfo ?? []
  }

  // Line 8a: Did child live with you for more than half the year?
  l8a = (): boolean => {
    return this.qualifyingChildren().every(c => c.monthsLivedWithYou >= 7)
  }

  // Line 8b: Is child under age 19 (or 24 if student)?
  l8b = (): boolean => {
    const deps = this.f1040.info.taxPayer.dependents ?? []
    return deps.some(d => {
      const age = 2025 - new Date(d.dateOfBirth).getFullYear()
      return age < 19 || (age < 24 && d.qualifyingInfo?.isStudent)
    })
  }

  // Line 9: Are you (and spouse if MFJ) at least age 25 but under 65?
  l9 = (): boolean => {
    const primary = this.f1040.info.taxPayer.primaryPerson
    const age = 2025 - new Date(primary.dateOfBirth).getFullYear()
    return age >= 25 && age < 65
  }

  // Line 10: Can you be claimed as a dependent on another return?
  l10 = (): boolean => {
    return this.f1040.info.taxPayer.primaryPerson.isTaxpayerDependent ?? false
  }

  // Part III - Child Tax Credit / Credit for Other Dependents

  // Line 11: Do you have a qualifying child for CTC?
  l11 = (): boolean => {
    const deps = this.f1040.info.taxPayer.dependents ?? []
    return deps.some(d => {
      const age = 2025 - new Date(d.dateOfBirth).getFullYear()
      return age < 17
    })
  }

  // Line 12: Child information (similar to Part II)

  // Part IV - American Opportunity Tax Credit

  // Line 13: Are you claiming AOTC for an eligible student?
  l13 = (): boolean => {
    return (this.f1040.info.educationExpenses?.length ?? 0) > 0
  }

  // Line 14-17: Student information

  // Part V - Filers With a Qualifying Child

  // Additional questions about the qualifying child

  // Summary - certify eligibility
  certifyMeetRequirements = (): boolean => {
    return this.disallowanceInfo()?.meetRequirementsNow ?? false
  }

  fields = (): Field[] => {
    const children = this.qualifyingChildren()

    return [
      this.f1040.namesString(),
      this.f1040.info.taxPayer.primaryPerson.ssid,
      // Part I - Credit selection
      this.eicDisallowed(),
      this.ctcDisallowed(),
      this.actcDisallowed(),
      this.odcDisallowed(),
      this.aotcDisallowed(),
      this.l2(),
      // Part II - EIC
      this.l3(),
      // Child 1 info
      children[0]?.childName ?? '',
      children[0]?.childSsn ?? '',
      children[0]?.relationship ?? '',
      children[0]?.monthsLivedWithYou ?? 0,
      // Child 2 info
      children[1]?.childName ?? '',
      children[1]?.childSsn ?? '',
      children[1]?.relationship ?? '',
      children[1]?.monthsLivedWithYou ?? 0,
      // EIC questions
      this.l8a(),
      this.l8b(),
      this.l9(),
      this.l10(),
      // Part III - CTC
      this.l11(),
      // Part IV - AOTC
      this.l13(),
      // Certification
      this.certifyMeetRequirements()
    ]
  }
}
