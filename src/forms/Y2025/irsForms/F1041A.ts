import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 1041-A - U.S. Information Return - Trust Accumulation of Charitable Amounts
 *
 * Used by split-interest trusts (charitable remainder trusts, pooled income funds,
 * charitable lead trusts) to report:
 * - Accumulation of income for charitable purposes
 * - Distributions to charitable beneficiaries
 * - Information about non-charitable beneficiaries
 *
 * Required for trusts with both charitable and non-charitable beneficiaries.
 */

export interface CharitableDistribution {
  charityName: string
  charityEIN: string
  charityAddress: string
  amount: number
  dateOfDistribution: Date
}

export interface F1041AData {
  // Trust information
  trustName: string
  trustEIN: string
  trustType: 'crt_annuity' | 'crt_unitrust' | 'pooled_income' | 'charitable_lead' | 'other'
  // Charitable beneficiaries
  charitableDistributions: CharitableDistribution[]
  // Non-charitable beneficiaries
  nonCharitableBeneficiaries: {
    name: string
    ssn: string
    amount: number
  }[]
  // Accumulation information
  beginningAccumulation: number
  currentYearIncome: number
  currentYearDistributions: number
  endingAccumulation: number
  // Investment information
  fairMarketValueAssets: number
  grossIncome: number
  deductions: number
}

export default class F1041A extends F1040Attachment {
  tag: FormTag = 'f1041a'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasSplitInterestTrust()
  }

  hasSplitInterestTrust = (): boolean => {
    const fiduciary = this.f1040.info.fiduciaryReturn
    return fiduciary !== undefined
  }

  f1041AData = (): F1041AData | undefined => {
    return undefined
  }

  // Trust info
  trustName = (): string => this.f1041AData()?.trustName ?? ''
  trustEIN = (): string => this.f1041AData()?.trustEIN ?? ''

  // Charitable distributions
  charitableDistributions = (): CharitableDistribution[] => {
    return this.f1041AData()?.charitableDistributions ?? []
  }

  totalCharitableDistributions = (): number => {
    return this.charitableDistributions().reduce((sum, d) => sum + d.amount, 0)
  }

  // Non-charitable beneficiaries
  totalNonCharitableDistributions = (): number => {
    const beneficiaries = this.f1041AData()?.nonCharitableBeneficiaries ?? []
    return beneficiaries.reduce((sum, b) => sum + b.amount, 0)
  }

  // Accumulation
  beginningAccumulation = (): number => this.f1041AData()?.beginningAccumulation ?? 0
  currentYearIncome = (): number => this.f1041AData()?.currentYearIncome ?? 0
  currentYearDistributions = (): number => this.f1041AData()?.currentYearDistributions ?? 0

  endingAccumulation = (): number => {
    return this.beginningAccumulation() + this.currentYearIncome() - this.currentYearDistributions()
  }

  // FMV and income
  fairMarketValueAssets = (): number => this.f1041AData()?.fairMarketValueAssets ?? 0
  grossIncome = (): number => this.f1041AData()?.grossIncome ?? 0
  deductions = (): number => this.f1041AData()?.deductions ?? 0
  netIncome = (): number => this.grossIncome() - this.deductions()

  fields = (): Field[] => {
    const data = this.f1041AData()
    const charDist = this.charitableDistributions()
    const nonCharBen = data?.nonCharitableBeneficiaries ?? []

    return [
      // Trust info
      this.trustName(),
      this.trustEIN(),
      data?.trustType ?? '',
      // Charitable distribution 1
      charDist[0]?.charityName ?? '',
      charDist[0]?.charityEIN ?? '',
      charDist[0]?.charityAddress ?? '',
      charDist[0]?.amount ?? 0,
      charDist[0]?.dateOfDistribution?.toLocaleDateString() ?? '',
      // Charitable distribution 2
      charDist[1]?.charityName ?? '',
      charDist[1]?.amount ?? 0,
      // Total charitable
      this.totalCharitableDistributions(),
      // Non-charitable beneficiary 1
      nonCharBen[0]?.name ?? '',
      nonCharBen[0]?.ssn ?? '',
      nonCharBen[0]?.amount ?? 0,
      // Non-charitable beneficiary 2
      nonCharBen[1]?.name ?? '',
      nonCharBen[1]?.amount ?? 0,
      // Total non-charitable
      this.totalNonCharitableDistributions(),
      // Accumulation
      this.beginningAccumulation(),
      this.currentYearIncome(),
      this.currentYearDistributions(),
      this.endingAccumulation(),
      // Investment info
      this.fairMarketValueAssets(),
      this.grossIncome(),
      this.deductions(),
      this.netIncome()
    ]
  }
}
