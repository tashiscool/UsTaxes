import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Schedule B (Form 1041) - Income Distribution Deduction
 *
 * Used to calculate the income distribution deduction for estates
 * and complex trusts that distribute income to beneficiaries.
 *
 * Key sections:
 * - Part I: Income Required to Be Distributed Currently
 * - Part II: Accumulation Distributions (Complex Trusts)
 * - Part III: Tax Computation (Throwback rules)
 */

export interface BeneficiaryDistribution {
  beneficiaryName: string
  beneficiarySSN: string
  beneficiaryAddress: string
  currentDistribution: number
  accumulationDistribution: number
  capitalGainDistribution: number
}

export interface Schedule1041BData {
  // Part I: Current distributions
  beneficiaryDistributions: BeneficiaryDistribution[]
  // Distributable net income
  distributableNetIncome: number
  // Tax-exempt income
  taxExemptIncome: number
  // Capital gains allocated to corpus
  capitalGainsAllocatedToCorpus: number
  // Part II: Accumulation distributions
  accumulationDistributions: number
  priorYearsUndistributedIncome: number
  // Throwback calculations
  throwbackTax: number
}

export default class Schedule1041B extends F1040Attachment {
  tag: FormTag = 'f1041sb'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasDistributionData()
  }

  hasDistributionData = (): boolean => {
    const fiduciaryReturn = this.f1040.info.fiduciaryReturn
    return fiduciaryReturn !== undefined
  }

  schedule1041BData = (): Schedule1041BData | undefined => {
    return undefined  // Would be populated from estate/trust data
  }

  // Beneficiary distributions
  distributions = (): BeneficiaryDistribution[] => {
    return this.schedule1041BData()?.beneficiaryDistributions ?? []
  }

  // Part I: Current distributions

  // Line 1: Adjusted total income
  l1 = (): number => {
    // Would come from Form 1041 line 17
    return 0
  }

  // Line 2: Adjusted tax-exempt interest
  l2 = (): number => {
    return this.schedule1041BData()?.taxExemptIncome ?? 0
  }

  // Line 3: Total net gain from Schedule D
  l3 = (): number => 0  // Capital gains from Schedule D

  // Line 4: Capital gains allocated to corpus
  l4 = (): number => {
    return this.schedule1041BData()?.capitalGainsAllocatedToCorpus ?? 0
  }

  // Line 5: Capital gains paid or set aside for charity
  l5 = (): number => 0

  // Line 6: Capital gains distributed to beneficiaries
  l6 = (): number => {
    return this.distributions().reduce((sum, d) => sum + d.capitalGainDistribution, 0)
  }

  // Line 7: Distributable net income (DNI)
  l7 = (): number => {
    return sumFields([this.l1(), this.l2()]) - sumFields([this.l4(), this.l5(), this.l6()])
  }

  // Line 8: Income required to be distributed currently
  l8 = (): number => {
    return this.distributions().reduce((sum, d) => sum + d.currentDistribution, 0)
  }

  // Line 9: Other amounts paid, credited, or required to be distributed
  l9 = (): number => {
    return this.distributions().reduce((sum, d) => sum + d.accumulationDistribution, 0)
  }

  // Line 10: Total distributions (line 8 + line 9)
  l10 = (): number => this.l8() + this.l9()

  // Line 11: Tentative income distribution deduction
  l11 = (): number => Math.min(this.l7(), this.l10())

  // Line 12: Tax-exempt income included in line 11
  l12 = (): number => {
    if (this.l10() === 0) return 0
    return Math.round(this.l2() * (this.l11() / this.l10()))
  }

  // Line 13: Income distribution deduction
  l13 = (): number => Math.max(0, this.l11() - this.l12())

  // To Form 1041 Line 18
  toForm1041Line18 = (): number => this.l13()

  // Number of beneficiaries
  numberOfBeneficiaries = (): number => this.distributions().length

  // Total to all beneficiaries
  totalDistributions = (): number => this.l10()

  fields = (): Field[] => {
    const distributions = this.distributions()

    return [
      // Part I: Income Distribution Deduction
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
      this.l13(),
      // Beneficiary 1
      distributions[0]?.beneficiaryName ?? '',
      distributions[0]?.beneficiarySSN ?? '',
      distributions[0]?.currentDistribution ?? 0,
      distributions[0]?.accumulationDistribution ?? 0,
      distributions[0]?.capitalGainDistribution ?? 0,
      // Beneficiary 2
      distributions[1]?.beneficiaryName ?? '',
      distributions[1]?.beneficiarySSN ?? '',
      distributions[1]?.currentDistribution ?? 0,
      // Beneficiary 3
      distributions[2]?.beneficiaryName ?? '',
      distributions[2]?.currentDistribution ?? 0,
      // Summary
      this.numberOfBeneficiaries(),
      this.totalDistributions(),
      this.toForm1041Line18()
    ]
  }
}
