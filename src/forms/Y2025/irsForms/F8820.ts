import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8820Data } from 'ustaxes/core/data'

/**
 * Form 8820 - Orphan Drug Credit
 *
 * Credit for qualified clinical testing expenses for drugs
 * designated as "orphan drugs" under the Orphan Drug Act.
 *
 * Credit calculation:
 * - 25% of qualified clinical testing expenses
 * - For testing of drugs to treat rare diseases or conditions
 *
 * "Orphan drug" designation:
 * - Drug intended to treat disease affecting fewer than 200,000 people in US
 * - Or no reasonable expectation of recovering costs from US sales
 * - Must be designated by FDA before clinical testing begins
 *
 * Qualified clinical testing expenses:
 * - Wages for employees engaged in clinical testing
 * - Supplies used in clinical testing
 * - Contract research organizations (65% of amounts paid)
 * - Must be conducted on humans in the United States
 *
 * Note: This credit was reduced from 50% to 25% by the
 * Tax Cuts and Jobs Act of 2017.
 */

// 2025 parameters
const orphanDrugParams = {
  creditRate: 0.25, // 25% of qualified expenses
  contractResearchRate: 0.65 // Only 65% of contract research qualifies
}

export default class F8820 extends F1040Attachment {
  tag: FormTag = 'f8820'
  sequenceIndex = 97

  isNeeded = (): boolean => {
    return this.hasOrphanDrugCredit()
  }

  hasOrphanDrugCredit = (): boolean => {
    const data = this.creditData()
    return (
      data !== undefined &&
      (data.qualifiedClinicalTestingExpenses > 0 ||
        (data.passthrough8820Credit ?? 0) > 0)
    )
  }

  creditData = (): Form8820Data | undefined => {
    // Would need to add to Information interface
    return undefined
  }

  // Part I - Current Year Credit

  // Line 1: Qualified clinical testing expenses
  l1 = (): number => this.creditData()?.qualifiedClinicalTestingExpenses ?? 0

  // Line 2: Multiply line 1 by 25%
  l2 = (): number => Math.round(this.l1() * orphanDrugParams.creditRate)

  // Line 3: Orphan drug credit from partnerships, S corps, etc.
  l3 = (): number => this.creditData()?.passthrough8820Credit ?? 0

  // Line 4: Add lines 2 and 3 (total credit)
  l4 = (): number => this.l2() + this.l3()

  // Credit for Form 3800
  credit = (): number => this.creditData()?.totalCredit ?? this.l4()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4()
  ]
}
