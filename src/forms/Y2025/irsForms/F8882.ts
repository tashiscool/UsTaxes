import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8882Data } from 'ustaxes/core/data'

/**
 * Form 8882 - Credit for Employer-Provided Childcare Facilities
 *             and Services
 *
 * Credit for employers who provide childcare facilities or contract
 * with childcare providers for their employees.
 *
 * Credit calculation:
 * - 25% of qualified childcare facility expenditures
 * - 10% of qualified childcare resource and referral expenditures
 * - Maximum credit: $150,000 per year
 *
 * Qualified childcare facility expenditures:
 * - Acquiring, constructing, rehabilitating, or expanding
 *   childcare facilities
 * - Operating costs of childcare facilities
 *
 * Qualified childcare resource and referral expenditures:
 * - Amounts paid under contract for childcare resource and referral services
 * - Must benefit employees primarily
 *
 * Recapture applies if facility use changes within 10 years.
 */

// 2025 parameters
const childcareCreditParams = {
  facilityRate: 0.25, // 25% of facility costs
  resourceRate: 0.1, // 10% of resource/referral costs
  maxCredit: 150000 // Maximum credit per year
}

export default class F8882 extends F1040Attachment {
  tag: FormTag = 'f8882'
  sequenceIndex = 132

  isNeeded = (): boolean => {
    return this.hasChildcareCredit()
  }

  hasChildcareCredit = (): boolean => {
    const data = this.creditData()
    return (
      data !== undefined &&
      (data.qualifiedChildcareFacilityCosts > 0 ||
        data.qualifiedChildcareResourceCosts > 0 ||
        (data.passthrough8882Credit ?? 0) > 0)
    )
  }

  creditData = (): Form8882Data | undefined => {
    // Would need to add to Information interface
    return undefined
  }

  // Part I - Qualified Childcare Facility Expenditures

  // Line 1: Qualified childcare facility expenditures
  l1 = (): number => this.creditData()?.qualifiedChildcareFacilityCosts ?? 0

  // Line 2: Multiply line 1 by 25%
  l2 = (): number => Math.round(this.l1() * childcareCreditParams.facilityRate)

  // Part II - Qualified Childcare Resource and Referral Expenditures

  // Line 3: Qualified resource and referral expenditures
  l3 = (): number => this.creditData()?.qualifiedChildcareResourceCosts ?? 0

  // Line 4: Multiply line 3 by 10%
  l4 = (): number => Math.round(this.l3() * childcareCreditParams.resourceRate)

  // Part III - Total Credit

  // Line 5: Add lines 2 and 4
  l5 = (): number => this.l2() + this.l4()

  // Line 6: Maximum credit limit
  l6 = (): number => childcareCreditParams.maxCredit

  // Line 7: Enter smaller of line 5 or line 6
  l7 = (): number => Math.min(this.l5(), this.l6())

  // Line 8: Credit from partnerships, S corps, etc.
  l8 = (): number => this.creditData()?.passthrough8882Credit ?? 0

  // Line 9: Add lines 7 and 8 (total credit)
  l9 = (): number => this.l7() + this.l8()

  // Credit for Form 3800
  credit = (): number => this.creditData()?.totalCredit ?? this.l9()

  // Total qualified costs
  totalQualifiedCosts = (): number => this.l1() + this.l3()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Part I
    this.l1(),
    this.l2(),
    // Part II
    this.l3(),
    this.l4(),
    // Part III
    this.l5(),
    this.l6(),
    this.l7(),
    this.l8(),
    this.l9()
  ]
}
