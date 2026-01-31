import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { Field } from 'ustaxes/core/pdfFiller'

/**
 * Form 6198 - At-Risk Limitations
 *
 * Limits losses to the amount the taxpayer has "at risk" in an activity.
 *
 * At-risk amount includes:
 * - Cash contributions
 * - Basis of property contributed
 * - Amounts borrowed for which taxpayer is personally liable
 * - Amounts borrowed secured by property (not used in activity)
 *
 * Does NOT include:
 * - Nonrecourse loans
 * - Amounts protected against loss
 * - Amounts borrowed from related parties
 */

export interface AtRiskActivity {
  name: string
  description: string
  atRiskInvestment: number
  recourseLoans: number
  qualifiedNonrecourseFinancing: number
  amountsProtectedAgainstLoss: number
  currentYearIncome: number
  currentYearDeductions: number
  priorYearLossAllowed: number
  priorYearAtRiskCarryover: number
}

export default class F6198 extends F1040Attachment {
  tag: FormTag = 'f6198'
  sequenceIndex = 31

  isNeeded = (): boolean => {
    return this.hasAtRiskActivities()
  }

  hasAtRiskActivities = (): boolean => {
    return (this.f1040.info.atRiskActivities?.length ?? 0) > 0
  }

  activity = (): AtRiskActivity | undefined => {
    return this.f1040.info.atRiskActivities?.[0]
  }

  // Part I - Current Year Profit or Loss

  // Line 1: Ordinary income or loss from activity
  l1 = (): number => {
    const act = this.activity()
    return (act?.currentYearIncome ?? 0) - (act?.currentYearDeductions ?? 0)
  }

  // Line 2a: Gain from Schedule D
  l2a = (): number => 0

  // Line 2b: Gain from Form 4797
  l2b = (): number => 0

  // Line 3: Other income and gains
  l3 = (): number => 0

  // Line 4: Total income and gains (add lines 1, 2a, 2b, 3)
  l4 = (): number => sumFields([this.l1(), this.l2a(), this.l2b(), this.l3()])

  // Part II - Simplified Computation of Amount At Risk

  // Line 5: Adjusted basis of property
  l5 = (): number => this.activity()?.atRiskInvestment ?? 0

  // Line 6: Amounts borrowed for use in activity (recourse)
  l6 = (): number => this.activity()?.recourseLoans ?? 0

  // Line 7: Add lines 5 and 6
  l7 = (): number => this.l5() + this.l6()

  // Line 8: Amounts protected against loss or nonrecourse
  l8 = (): number => this.activity()?.amountsProtectedAgainstLoss ?? 0

  // Line 9: Subtract line 8 from line 7
  l9 = (): number => Math.max(0, this.l7() - this.l8())

  // Part III - Detailed Computation of Amount At Risk

  // Line 10a: Investment in activity at beginning of year
  l10a = (): number => this.activity()?.priorYearAtRiskCarryover ?? 0

  // Line 10b: Increases at end of year
  l10b = (): number => {
    const act = this.activity()
    const contributions = act?.atRiskInvestment ?? 0
    return contributions
  }

  // Line 10c: Decreases at end of year
  l10c = (): number => 0

  // Line 10d: Combine lines 10a, 10b, 10c
  l10d = (): number => this.l10a() + this.l10b() - this.l10c()

  // Part IV - Deductible Loss

  // Line 11: Amount at risk (larger of line 9 or 10d)
  l11 = (): number => Math.max(this.l9(), this.l10d())

  // Line 12: Loss from activity (if line 4 is a loss)
  l12 = (): number => Math.abs(Math.min(0, this.l4()))

  // Line 13: Deductible loss (smaller of line 11 or 12)
  l13 = (): number => Math.min(this.l11(), this.l12())

  // Line 14: Disallowed loss (subtract line 13 from line 12)
  l14 = (): number => Math.max(0, this.l12() - this.l13())

  // Line 15: Amount at risk after deductible loss
  l15 = (): number => Math.max(0, this.l11() - this.l13())

  // Amounts for other forms
  deductibleLoss = (): number => this.l13()
  disallowedLoss = (): number => this.l14()
  atRiskCarryover = (): number => this.l15()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.activity()?.name ?? '',
    this.activity()?.description ?? '',
    // Part I
    this.l1(),
    this.l2a(),
    this.l2b(),
    this.l3(),
    this.l4(),
    // Part II
    this.l5(),
    this.l6(),
    this.l7(),
    this.l8(),
    this.l9(),
    // Part III
    this.l10a(),
    this.l10b(),
    this.l10c(),
    this.l10d(),
    // Part IV
    this.l11(),
    this.l12(),
    this.l13(),
    this.l14(),
    this.l15()
  ]
}
