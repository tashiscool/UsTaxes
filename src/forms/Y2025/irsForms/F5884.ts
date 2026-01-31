import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form5884Data } from 'ustaxes/core/data'

/**
 * Form 5884 - Work Opportunity Credit
 *
 * Credit for hiring individuals from certain targeted groups who have
 * faced significant barriers to employment.
 *
 * Target groups include:
 * - TANF recipients
 * - Veterans (including disabled veterans)
 * - Ex-felons
 * - Designated community residents
 * - Vocational rehabilitation referrals
 * - Summer youth employees
 * - SNAP recipients
 * - SSI recipients
 * - Long-term family assistance recipients
 * - Qualified long-term unemployment recipients
 *
 * Credit rates:
 * - 25% of first-year wages if employee works 120-399 hours
 * - 40% of first-year wages if employee works 400+ hours
 * - Maximum qualifying wages: $6,000-$24,000 depending on group
 */

export default class F5884 extends F1040Attachment {
  tag: FormTag = 'f5884'
  sequenceIndex = 77

  isNeeded = (): boolean => {
    return this.hasWorkOpportunityCredit()
  }

  hasWorkOpportunityCredit = (): boolean => {
    const data = this.creditData()
    return data !== undefined && data.qualifiedWages.length > 0
  }

  creditData = (): Form5884Data | undefined => {
    // Would need to add to Information interface
    return undefined
  }

  // Line 1a: Enter total qualified first-year wages (25% rate)
  l1a = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.qualifiedWages
      .filter(w => w.creditRate === 0.25)
      .reduce((sum, w) => sum + w.wages, 0)
  }

  // Line 1b: Multiply line 1a by 25%
  l1b = (): number => Math.round(this.l1a() * 0.25)

  // Line 2a: Enter total qualified first-year wages (40% rate)
  l2a = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.qualifiedWages
      .filter(w => w.creditRate === 0.40)
      .reduce((sum, w) => sum + w.wages, 0)
  }

  // Line 2b: Multiply line 2a by 40%
  l2b = (): number => Math.round(this.l2a() * 0.40)

  // Line 3: Add lines 1b and 2b
  l3 = (): number => this.l1b() + this.l2b()

  // Line 4: Work opportunity credit from partnerships, S corps, etc.
  l4 = (): number => 0

  // Line 5: Add lines 3 and 4
  l5 = (): number => this.l3() + this.l4()

  // Credit for Form 3800
  credit = (): number => this.l5()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson?.ssid,
    this.l1a(),
    this.l1b(),
    this.l2a(),
    this.l2b(),
    this.l3(),
    this.l4(),
    this.l5()
  ]
}
