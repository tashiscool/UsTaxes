import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 4137 - Social Security and Medicare Tax on Unreported Tip Income
 *
 * Use this form if you received tips and:
 * - Didn't report all tips to your employer, or
 * - Employer didn't withhold social security and Medicare taxes on reported tips
 *
 * The tax computed on this form is added to Schedule 2, Line 13.
 *
 * 2025 rates:
 * - Social Security: 6.2% on wages up to $176,100
 * - Medicare: 1.45% on all wages (no limit)
 * - Additional Medicare: 0.9% on wages over $200,000 (single)
 */

// 2025 Social Security wage base
const SS_WAGE_BASE = 176100
const SS_RATE = 0.062
const MEDICARE_RATE = 0.0145

export default class F4137 extends F1040Attachment {
  tag: FormTag = 'f4137'
  sequenceIndex = 25

  isNeeded = (): boolean => {
    return this.unreportedTips() > 0
  }

  // Total unreported tips from user data
  unreportedTips = (): number => {
    return this.f1040.info.unreportedTipIncome ?? 0
  }

  // Total wages and tips subject to Social Security (from W-2s)
  totalSocialSecurityWages = (): number => {
    return this.f1040.info.w2s.reduce((sum, w2) => {
      return sum + (w2.ssWages ?? 0)
    }, 0)
  }

  // Total wages and tips subject to Medicare (from W-2s)
  totalMedicareWages = (): number => {
    return this.f1040.info.w2s.reduce((sum, w2) => {
      return sum + (w2.medicareIncome ?? 0)
    }, 0)
  }

  // Line 1: Total cash and charge tips received
  l1 = (): number => this.unreportedTips()

  // Line 2: Tips reported to employer
  l2 = (): number => {
    // Tips already included in W-2 income would have been reported to employer
    // If tipIncome exists, assume some portion was reported
    // Unreported tips = total tips - reported tips
    // For now, assume all tips were unreported (conservative approach)
    return 0
  }

  // Line 3: Subtract line 2 from line 1 (unreported tips)
  l3 = (): number => Math.max(0, this.l1() - this.l2())

  // Line 4: Cash tips not reported to employer
  l4 = (): number => this.l3()

  // Line 5: Total social security wages and tips from W-2s
  l5 = (): number => this.totalSocialSecurityWages()

  // Line 6: Total social security tips from W-2s
  l6 = (): number => {
    // Social security tips would be included in ssWages for most W-2s
    // This represents tips already subject to SS tax
    return 0 // Would need explicit tip tracking in W-2 data
  }

  // Line 7: Maximum wages subject to social security tax
  l7 = (): number => SS_WAGE_BASE

  // Line 8: Add lines 5 and 6
  l8 = (): number => this.l5() + this.l6()

  // Line 9: Subtract line 8 from line 7 (remaining SS wage base)
  l9 = (): number => Math.max(0, this.l7() - this.l8())

  // Line 10: Enter smaller of line 4 or line 9 (tips subject to SS tax)
  l10 = (): number => Math.min(this.l4(), this.l9())

  // Line 11: Multiply line 10 by 6.2% (Social Security tax)
  l11 = (): number => Math.round(this.l10() * SS_RATE * 100) / 100

  // Line 12: Multiply line 4 by 1.45% (Medicare tax)
  l12 = (): number => Math.round(this.l4() * MEDICARE_RATE * 100) / 100

  // Line 13: Add lines 11 and 12 (total tax)
  l13 = (): number => this.l11() + this.l12()

  // Tax for Schedule 2, Line 13
  l6Tax = (): number => this.l13()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5(),
    this.l6(),
    this.l7(),
    this.l8(),
    this.l9(),
    this.l10(),
    this.l11(),
    this.l12(),
    this.l13()
  ]
}
