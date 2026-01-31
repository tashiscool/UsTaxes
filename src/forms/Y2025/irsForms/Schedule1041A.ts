import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Schedule A (Form 1041) - Charitable Deduction
 *
 * Used by estates and trusts to compute the charitable deduction.
 * Only applicable to estates and complex trusts that:
 * - Made charitable contributions
 * - Have governing instrument allowing charitable deductions
 *
 * The charitable deduction is generally the amount of gross income
 * paid or permanently set aside for charitable purposes.
 */

export interface CharitableContribution {
  charityName: string
  charityAddress: string
  charityEIN: string
  dateOfContribution: Date
  description: string
  amount: number
  paidFromPrincipal: boolean
  paidFromIncome: boolean
}

export interface Schedule1041AData {
  // Charitable contributions
  contributions: CharitableContribution[]
  // Amounts paid from gross income
  amountsPaidFromIncome: number
  // Amounts permanently set aside
  amountsPermanentlySetAside: number
  // Capital gains allocated to charity
  capitalGainsToCharity: number
  // Amounts required to be distributed
  amountsRequiredDistributed: number
  // Net short-term capital gain
  netShortTermCapitalGain: number
  // Net long-term capital gain
  netLongTermCapitalGain: number
}

export default class Schedule1041A extends F1040Attachment {
  tag: FormTag = 'f1041sa'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasCharitableData()
  }

  hasCharitableData = (): boolean => {
    const fiduciaryReturn = this.f1040.info.fiduciaryReturn
    return fiduciaryReturn !== undefined
  }

  schedule1041AData = (): Schedule1041AData | undefined => {
    return undefined  // Would be populated from estate/trust data
  }

  // Charitable contributions
  contributions = (): CharitableContribution[] => {
    return this.schedule1041AData()?.contributions ?? []
  }

  // Line 1: Amounts paid or permanently set aside from gross income
  l1 = (): number => {
    return this.schedule1041AData()?.amountsPaidFromIncome ?? 0
  }

  // Line 2: Tax-exempt income allocable to charitable contributions
  l2 = (): number => 0  // Would be calculated from exempt income

  // Line 3: Subtract line 2 from line 1
  l3 = (): number => Math.max(0, this.l1() - this.l2())

  // Line 4: Capital gains paid or set aside for charity
  l4 = (): number => {
    return this.schedule1041AData()?.capitalGainsToCharity ?? 0
  }

  // Line 5: Add lines 3 and 4
  l5 = (): number => this.l3() + this.l4()

  // Line 6: Amounts required to be distributed
  l6 = (): number => {
    return this.schedule1041AData()?.amountsRequiredDistributed ?? 0
  }

  // Line 7: Charitable deduction (smaller of line 5 or line 6)
  l7 = (): number => Math.min(this.l5(), this.l6())

  // Total contributions from principal
  totalFromPrincipal = (): number => {
    return this.contributions()
      .filter(c => c.paidFromPrincipal)
      .reduce((sum, c) => sum + c.amount, 0)
  }

  // Total contributions from income
  totalFromIncome = (): number => {
    return this.contributions()
      .filter(c => c.paidFromIncome)
      .reduce((sum, c) => sum + c.amount, 0)
  }

  // Total charitable contributions
  totalContributions = (): number => {
    return this.contributions().reduce((sum, c) => sum + c.amount, 0)
  }

  // To Form 1041 Line 13
  toForm1041Line13 = (): number => this.l7()

  fields = (): Field[] => {
    const contributions = this.contributions()

    return [
      // Contribution 1
      contributions[0]?.charityName ?? '',
      contributions[0]?.charityAddress ?? '',
      contributions[0]?.charityEIN ?? '',
      contributions[0]?.description ?? '',
      contributions[0]?.amount ?? 0,
      contributions[0]?.paidFromPrincipal ?? false,
      contributions[0]?.paidFromIncome ?? false,
      // Contribution 2
      contributions[1]?.charityName ?? '',
      contributions[1]?.amount ?? 0,
      // Contribution 3
      contributions[2]?.charityName ?? '',
      contributions[2]?.amount ?? 0,
      // Totals
      this.totalFromPrincipal(),
      this.totalFromIncome(),
      this.totalContributions(),
      // Calculation
      this.l1(),
      this.l2(),
      this.l3(),
      this.l4(),
      this.l5(),
      this.l6(),
      this.l7(),
      this.toForm1041Line13()
    ]
  }
}
