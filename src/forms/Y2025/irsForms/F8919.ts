import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 8919 - Uncollected Social Security and Medicare Tax on Wages
 *
 * Use this form if you received wages from an employer who did not withhold
 * social security and Medicare taxes from your pay, and one of these applies:
 *
 * - You filed Form SS-8 (worker classification) and received a determination letter
 * - You received other correspondence from the IRS that says you're an employee
 *
 * This commonly occurs when:
 * - Employer misclassified you as an independent contractor
 * - You believe you should have been treated as an employee
 *
 * The tax computed on this form goes to Schedule 2, Line 13.
 *
 * 2025 rates:
 * - Social Security: 6.2% on wages up to $176,100
 * - Medicare: 1.45% on all wages (no limit)
 */

// 2025 Social Security wage base
const SS_WAGE_BASE = 176100
const SS_RATE = 0.062
const MEDICARE_RATE = 0.0145

export interface UncollectedSSTaxWages {
  employerName: string
  employerEIN: string
  wagesReceived: number
  reasonCode: 'A' | 'C' | 'G' | 'H' // Reason codes from Form 8919 instructions
  // A = Filed SS-8 and received determination
  // C = Received other IRS correspondence
  // G = Section 530 relief requested
  // H = Section 530 relief granted
}

export default class F8919 extends F1040Attachment {
  tag: FormTag = 'f8919'
  sequenceIndex = 72

  isNeeded = (): boolean => {
    return this.uncollectedWages().length > 0
  }

  uncollectedWages = (): UncollectedSSTaxWages[] => {
    return (
      (this.f1040.info.uncollectedSSTaxWages as
        | UncollectedSSTaxWages[]
        | undefined) ?? []
    )
  }

  // Total wages already subject to Social Security (from W-2s)
  totalW2SocialSecurityWages = (): number => {
    return this.f1040.info.w2s.reduce((sum, w2) => {
      return sum + (w2.ssWages ?? 0)
    }, 0)
  }

  // Part I - Wages Subject to Social Security and Medicare Taxes

  // Line 1: Firm name (first employer)
  l1FirmName = (): string => {
    const wages = this.uncollectedWages()
    return wages.length > 0 ? wages[0].employerName : ''
  }

  // Line 1: EIN (first employer)
  l1EIN = (): string => {
    const wages = this.uncollectedWages()
    return wages.length > 0 ? wages[0].employerEIN : ''
  }

  // Line 1: Reason code
  l1ReasonCode = (): string => {
    const wages = this.uncollectedWages()
    return wages.length > 0 ? wages[0].reasonCode : ''
  }

  // Line 1: Wages received
  l1Wages = (): number => {
    const wages = this.uncollectedWages()
    return wages.length > 0 ? wages[0].wagesReceived : 0
  }

  // Line 6: Total wages from all employers listed
  l6 = (): number => {
    return this.uncollectedWages().reduce((sum, w) => sum + w.wagesReceived, 0)
  }

  // Part II - Figuring the Social Security Tax

  // Line 7: Maximum wages subject to social security tax
  l7 = (): number => SS_WAGE_BASE

  // Line 8: Total social security wages and tips from W-2s
  l8 = (): number => this.totalW2SocialSecurityWages()

  // Line 9: Subtract line 8 from line 7
  l9 = (): number => Math.max(0, this.l7() - this.l8())

  // Line 10: Wages subject to social security tax (smaller of line 6 or line 9)
  l10 = (): number => Math.min(this.l6(), this.l9())

  // Line 11: Multiply line 10 by 6.2% (Social Security tax rate)
  l11 = (): number => Math.round(this.l10() * SS_RATE * 100) / 100

  // Part III - Figuring the Medicare Tax

  // Line 12: Total wages subject to Medicare tax (from line 6)
  l12 = (): number => this.l6()

  // Line 13: Multiply line 12 by 1.45% (Medicare tax rate)
  l13 = (): number => Math.round(this.l12() * MEDICARE_RATE * 100) / 100

  // Part IV - Total Tax

  // Line 14: Add lines 11 and 13
  l14 = (): number => this.l11() + this.l13()

  // Tax for Schedule 2, Line 13
  l6Tax = (): number => this.l14()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Part I - First employer
    this.l1FirmName(),
    this.l1EIN(),
    this.l1ReasonCode(),
    this.l1Wages(),
    // Line 6
    this.l6(),
    // Part II
    this.l7(),
    this.l8(),
    this.l9(),
    this.l10(),
    this.l11(),
    // Part III
    this.l12(),
    this.l13(),
    // Part IV
    this.l14()
  ]
}
