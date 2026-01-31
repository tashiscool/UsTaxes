import { Field } from 'ustaxes/core/pdfFiller'
import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 6168 - Interest Computation Under the Look-Back Method
 * for Completed Long-Term Contracts
 *
 * Use this form to figure the interest due or to be refunded under
 * the look-back method for long-term contracts.
 *
 * This applies to:
 * - Long-term contracts accounted for using the percentage of completion method
 * - Contracts that span more than one tax year
 *
 * The look-back method requires recomputing income from each prior contract
 * year using actual (rather than estimated) contract price and costs.
 *
 * Key concepts:
 * - Applies when contract is completed or disposed of
 * - Compare hypothetical tax (using actual figures) vs tax actually paid
 * - Pay interest on underpayments, receive interest on overpayments
 * - Uses federal short-term rate plus 3 percentage points
 *
 * Reference: IRC Section 460(b)(2)
 */

export interface LongTermContractData {
  contractDescription: string
  completionDate: Date
  contractPrice: number
  totalCosts: number
  // Prior year allocations
  priorYearAllocations: PriorYearContractAllocation[]
}

export interface PriorYearContractAllocation {
  taxYear: number
  estimatedGrossProfit: number
  actualGrossProfit: number
  taxRateForYear: number
  interestRate: number  // Federal short-term rate + 3%
}

export default class F6168 extends F1040Attachment {
  sequenceIndex = 999
  tag: FormTag = 'f6168'

  isNeeded = (): boolean => {
    return this.longTermContracts().length > 0
  }

  longTermContracts = (): LongTermContractData[] => {
    return (this.f1040.info.longTermContracts as LongTermContractData[] | undefined) ?? []
  }

  // Part I - Regular Method

  // Line 1: Contract description
  l1 = (): string => {
    const contracts = this.longTermContracts()
    return contracts.length > 0 ? contracts[0].contractDescription : ''
  }

  // Line 2: Completion or disposition date
  l2 = (): string => {
    const contracts = this.longTermContracts()
    if (contracts.length === 0) return ''
    return contracts[0].completionDate.toLocaleDateString()
  }

  // Line 3: Contract price
  l3 = (): number => {
    return this.longTermContracts().reduce((sum, c) => sum + c.contractPrice, 0)
  }

  // Line 4: Total allocable contract costs
  l4 = (): number => {
    return this.longTermContracts().reduce((sum, c) => sum + c.totalCosts, 0)
  }

  // Line 5: Gross profit (line 3 minus line 4)
  l5 = (): number => Math.max(0, this.l3() - this.l4())

  // Calculate look-back interest
  calculateLookBackInterest = (): number => {
    let totalInterest = 0

    for (const contract of this.longTermContracts()) {
      for (const allocation of contract.priorYearAllocations) {
        // Difference between actual and estimated profit
        const profitDifference = allocation.actualGrossProfit - allocation.estimatedGrossProfit

        // Tax difference
        const taxDifference = profitDifference * allocation.taxRateForYear

        // Interest on the difference
        // Simplified: assume 1 year of interest
        const interest = taxDifference * allocation.interestRate

        totalInterest += interest
      }
    }

    return Math.round(totalInterest)
  }

  // Line 13: Interest due (if positive)
  l13 = (): number => {
    const interest = this.calculateLookBackInterest()
    return interest > 0 ? interest : 0
  }

  // Line 14: Interest to be refunded (if negative)
  l14 = (): number => {
    const interest = this.calculateLookBackInterest()
    return interest < 0 ? Math.abs(interest) : 0
  }

  // Net interest for Schedule 2 or Schedule 3
  netInterestDue = (): number => this.l13()
  netInterestRefund = (): number => this.l14()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson?.ssid,
    // Part I
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5(),
    // Interest
    this.l13(),
    this.l14()
  ]
}
