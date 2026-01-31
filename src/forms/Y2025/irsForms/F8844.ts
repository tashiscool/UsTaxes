import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8844Data } from 'ustaxes/core/data'

/**
 * Form 8844 - Empowerment Zone Employment Credit
 *
 * Credit for employers who hire employees who both live and work
 * in a designated empowerment zone.
 *
 * Credit calculation:
 * - 20% of qualified zone wages
 * - Maximum wages: $15,000 per employee per year
 * - Maximum credit: $3,000 per employee per year
 *
 * Requirements:
 * - Employee must live and work in an empowerment zone
 * - Business must be an "enterprise zone business"
 * - Cannot include wages of certain relatives or 5% owners
 *
 * Note: The empowerment zone program has been extended multiple times.
 * Check current status for 2025 applicability.
 */

// 2025 parameters
const empowermentZoneParams = {
  maxWagesPerEmployee: 15000,
  creditRate: 0.20,
  maxCreditPerEmployee: 3000
}

export default class F8844 extends F1040Attachment {
  tag: FormTag = 'f8844'
  sequenceIndex = 99

  isNeeded = (): boolean => {
    return this.hasEmpowermentZoneCredit()
  }

  hasEmpowermentZoneCredit = (): boolean => {
    const data = this.creditData()
    return data !== undefined && data.qualifiedEmployees.length > 0
  }

  creditData = (): Form8844Data | undefined => {
    // Would need to add to Information interface
    return undefined
  }

  // Part I - Current Year Credit

  // Line 1: Qualified zone wages
  l1 = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.qualifiedEmployees.reduce((sum, e) =>
      sum + Math.min(e.qualifiedWages, empowermentZoneParams.maxWagesPerEmployee), 0)
  }

  // Line 2: Multiply line 1 by 20%
  l2 = (): number => Math.round(this.l1() * empowermentZoneParams.creditRate)

  // Line 3: Empowerment zone credit from partnerships, S corps, etc.
  l3 = (): number => this.creditData()?.passthrough8844Credit ?? 0

  // Line 4: Add lines 2 and 3 (total credit)
  l4 = (): number => this.l2() + this.l3()

  // Credit for Form 3800
  credit = (): number => this.creditData()?.totalCredit ?? this.l4()

  // Number of qualified zone employees
  qualifiedEmployeeCount = (): number => this.creditData()?.qualifiedEmployees.length ?? 0

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson?.ssid,
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.qualifiedEmployeeCount()
  ]
}
