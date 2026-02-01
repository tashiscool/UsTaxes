/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 8915-F - Qualified Disaster Retirement Plan Distributions and Repayments
 *
 * Permanent form replacing disaster-specific forms (8915-A through E).
 * Used to report:
 * - Qualified disaster distributions from retirement plans
 * - Spread of taxable amount over 3 years
 * - Repayments of qualified disaster distributions
 *
 * Benefits for qualified disaster distributions:
 * - 10% early withdrawal penalty waived
 * - Can spread income over 3 tax years
 * - Can repay within 3 years and amend returns
 * - Up to $22,000 per disaster
 *
 * 2025 Rules:
 * - Applies to federally declared disasters
 * - Must live in qualified disaster area
 * - Distribution must be made during disaster period
 */

export type DisasterType =
  | 'hurricane'
  | 'wildfire'
  | 'flood'
  | 'tornado'
  | 'earthquake'
  | 'other'

export interface QualifiedDisasterDistribution {
  disasterName: string
  disasterType: DisasterType
  femaDisasterNumber: string
  disasterBeginDate: Date
  disasterEndDate: Date

  // Distribution information
  distributionAmount: number
  distributionDate: Date
  planName: string
  planType: 'ira' | '401k' | '403b' | 'pension' | 'other'
  isTraditionIra: boolean

  // Spread election
  spreadOver3Years: boolean
  yearOfDistribution: number // 1, 2, or 3 in the spread

  // Prior year amounts (if continuing spread)
  priorYearTaxableAmount?: number

  // Repayments
  repaymentAmount: number
  repaymentDate?: Date
}

export default class F8915F extends F1040Attachment {
  tag: FormTag = 'f8915f'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasDisasterDistributions() || this.hasRepayments()
  }

  hasDisasterDistributions = (): boolean => {
    return this.disasterDistributions().length > 0
  }

  hasRepayments = (): boolean => {
    return this.disasterDistributions().some((d) => d.repaymentAmount > 0)
  }

  disasterDistributions = (): QualifiedDisasterDistribution[] => {
    return (
      (this.f1040.info.disasterDistributions as
        | QualifiedDisasterDistribution[]
        | undefined) ?? []
    )
  }

  // Part I - Qualified Disaster Distributions From Retirement Plans

  // Total qualified distributions
  totalDistributions = (): number => {
    return this.disasterDistributions().reduce(
      (sum, d) => sum + d.distributionAmount,
      0
    )
  }

  // Maximum allowed per disaster ($22,000)
  maxPerDisaster = (): number => 22000

  // Line 1: Total qualified disaster distributions
  l1 = (): number => Math.min(this.totalDistributions(), this.maxPerDisaster())

  // Line 2: Qualified distributions from IRAs
  l2 = (): number => {
    return this.disasterDistributions()
      .filter((d) => d.isTraditionIra)
      .reduce(
        (sum, d) => sum + Math.min(d.distributionAmount, this.maxPerDisaster()),
        0
      )
  }

  // Line 3: Qualified distributions from other retirement plans
  l3 = (): number => {
    return this.disasterDistributions()
      .filter((d) => !d.isTraditionIra)
      .reduce(
        (sum, d) => sum + Math.min(d.distributionAmount, this.maxPerDisaster()),
        0
      )
  }

  // Part II - Qualified Disaster Distributions Subject to 3-Year Spread

  // Check if any distributions are being spread
  hasSpreadElection = (): boolean => {
    return this.disasterDistributions().some((d) => d.spreadOver3Years)
  }

  // Distributions electing 3-year spread
  spreadDistributions = (): QualifiedDisasterDistribution[] => {
    return this.disasterDistributions().filter((d) => d.spreadOver3Years)
  }

  // Line 4: Distributions electing spread (total)
  l4 = (): number => {
    return this.spreadDistributions().reduce(
      (sum, d) => sum + d.distributionAmount,
      0
    )
  }

  // Line 5: Amount includible this year (1/3 of line 4)
  l5 = (): number => {
    if (!this.hasSpreadElection()) return 0
    return Math.round(this.l4() / 3)
  }

  // Line 6: Amount from prior year spread (year 2 or 3)
  l6 = (): number => {
    return this.spreadDistributions()
      .filter((d) => d.yearOfDistribution > 1)
      .reduce((sum, d) => sum + (d.priorYearTaxableAmount ?? 0), 0)
  }

  // Part III - Qualified Disaster Distributions Not Subject to 3-Year Spread

  // Line 7: Distributions not electing spread
  l7 = (): number => {
    return this.disasterDistributions()
      .filter((d) => !d.spreadOver3Years)
      .reduce((sum, d) => sum + d.distributionAmount, 0)
  }

  // Part IV - Total Taxable Amount

  // Line 8: Total taxable amount before repayments
  l8 = (): number => {
    return sumFields([this.l5(), this.l6(), this.l7()])
  }

  // Part V - Repayment of Qualified Disaster Distributions

  // Line 9: Repayments made in 2025
  l9 = (): number => {
    return this.disasterDistributions().reduce(
      (sum, d) => sum + d.repaymentAmount,
      0
    )
  }

  // Line 10: Repayments applied to prior year amounts
  l10 = (): number => {
    // Repayments first apply to oldest distributions
    const priorYearAmount = this.l6()
    return Math.min(this.l9(), priorYearAmount)
  }

  // Line 11: Repayments applied to current year
  l11 = (): number => {
    const remainingRepayment = this.l9() - this.l10()
    return Math.min(remainingRepayment, this.l5() + this.l7())
  }

  // Part VI - Amount to Include in Income

  // Line 12: Total taxable amount (line 8 minus repayments applied)
  l12 = (): number => {
    return Math.max(0, this.l8() - this.l10() - this.l11())
  }

  // Summary methods

  // Amount to include in income (goes to Form 1040)
  taxableAmount = (): number => this.l12()

  // Amount exempt from 10% penalty
  penaltyExemptAmount = (): number => this.l1()

  // Carryforward repayment amount
  excessRepayment = (): number => {
    const totalApplied = this.l10() + this.l11()
    return Math.max(0, this.l9() - totalApplied)
  }

  fields = (): Field[] => {
    const distributions = this.disasterDistributions()
    const primary = distributions[0]

    return [
      this.f1040.namesString(),
      this.f1040.info.taxPayer.primaryPerson.ssid,
      // Disaster information
      primary.disasterName ?? '',
      primary.femaDisasterNumber ?? '',
      primary.disasterBeginDate.toLocaleDateString() ?? '',
      primary.disasterEndDate.toLocaleDateString() ?? '',
      // Part I
      this.l1(),
      this.l2(),
      this.l3(),
      // Part II - Spread
      this.hasSpreadElection(),
      this.l4(),
      this.l5(),
      this.l6(),
      // Part III
      this.l7(),
      // Part IV
      this.l8(),
      // Part V - Repayments
      this.l9(),
      this.l10(),
      this.l11(),
      // Part VI
      this.l12()
    ]
  }
}
