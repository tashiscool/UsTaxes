import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 1099-DIV - Dividends and Distributions
 *
 * Reports dividend income from:
 * - Stocks
 * - Mutual funds
 * - Money market funds
 * - Corporations
 *
 * Key boxes for tax reporting:
 * - Box 1a: Total ordinary dividends → Schedule B, Form 1040 Line 3b
 * - Box 1b: Qualified dividends → Eligible for lower tax rates
 * - Box 2a: Total capital gain distributions → Schedule D
 * - Box 2b: Unrecaptured Section 1250 gain
 * - Box 3: Nondividend distributions (return of capital)
 */

export interface F1099DIVData {
  // Payer information
  payerName: string
  payerAddress: string
  payerTIN: string
  // Recipient information
  recipientName: string
  recipientAddress: string
  recipientTIN: string
  // Account number
  accountNumber?: string
  // FATCA filing requirement
  fatcaFilingRequired: boolean
  // Dividend amounts
  totalOrdinaryDividends: number // Box 1a
  qualifiedDividends: number // Box 1b
  totalCapitalGainDistributions: number // Box 2a
  unrecapturedSection1250Gain: number // Box 2b
  section1202Gain: number // Box 2c
  collectiblesGain: number // Box 2d
  section897OrdinaryDividends: number // Box 2e
  section897CapitalGain: number // Box 2f
  nondividendDistributions: number // Box 3
  federalTaxWithheld: number // Box 4
  section199ADividends: number // Box 5
  investmentExpenses: number // Box 6
  foreignTaxPaid: number // Box 7
  foreignCountry: string // Box 8
  cashLiquidationDistributions: number // Box 9
  noncashLiquidationDistributions: number // Box 10
  exemptInterestDividends: number // Box 12
  privateActivityBondDividends: number // Box 13
  // State tax
  stateTaxWithheld: number // Box 14
  stateId: string // Box 15
  stateDistribution: number // Box 16
}

export default class F1099DIV extends F1040Attachment {
  tag: FormTag = 'f1099div'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF1099DIVData()
  }

  hasF1099DIVData = (): boolean => {
    return false
  }

  f1099DIVData = (): F1099DIVData | undefined => {
    return undefined
  }

  // Box 1a: Total ordinary dividends → Form 1040 Line 3b
  totalOrdinaryDividends = (): number => {
    return this.f1099DIVData()?.totalOrdinaryDividends ?? 0
  }

  // Box 1b: Qualified dividends → Lower tax rate
  qualifiedDividends = (): number => {
    return this.f1099DIVData()?.qualifiedDividends ?? 0
  }

  // Box 2a: Capital gain distributions → Schedule D
  totalCapitalGainDistributions = (): number => {
    return this.f1099DIVData()?.totalCapitalGainDistributions ?? 0
  }

  // Box 3: Nondividend distributions (return of capital)
  nondividendDistributions = (): number => {
    return this.f1099DIVData()?.nondividendDistributions ?? 0
  }

  // Box 4: Federal tax withheld
  federalTaxWithheld = (): number => {
    return this.f1099DIVData()?.federalTaxWithheld ?? 0
  }

  // Box 5: Section 199A dividends (REIT dividends eligible for QBI deduction)
  section199ADividends = (): number => {
    return this.f1099DIVData()?.section199ADividends ?? 0
  }

  // Box 7: Foreign tax paid → Form 1116 or Schedule 3
  foreignTaxPaid = (): number => {
    return this.f1099DIVData()?.foreignTaxPaid ?? 0
  }

  // Box 12: Exempt interest dividends (tax-free)
  exemptInterestDividends = (): number => {
    return this.f1099DIVData()?.exemptInterestDividends ?? 0
  }

  // To Form 1040 Line 3b
  toForm1040Line3b = (): number => this.totalOrdinaryDividends()

  // To Form 1040 Line 3a (qualified dividends)
  toForm1040Line3a = (): number => this.qualifiedDividends()

  // To Schedule D
  toScheduleD = (): number => this.totalCapitalGainDistributions()

  fields = (): Field[] => {
    const data = this.f1099DIVData()

    return [
      // Payer info
      data?.payerName ?? '',
      data?.payerAddress ?? '',
      data?.payerTIN ?? '',
      // Recipient info
      data?.recipientName ?? '',
      data?.recipientAddress ?? '',
      data?.recipientTIN ?? '',
      data?.accountNumber ?? '',
      data?.fatcaFilingRequired ?? false,
      // Dividend amounts
      data?.totalOrdinaryDividends ?? 0, // Box 1a
      data?.qualifiedDividends ?? 0, // Box 1b
      data?.totalCapitalGainDistributions ?? 0, // Box 2a
      data?.unrecapturedSection1250Gain ?? 0, // Box 2b
      data?.section1202Gain ?? 0, // Box 2c
      data?.collectiblesGain ?? 0, // Box 2d
      data?.section897OrdinaryDividends ?? 0, // Box 2e
      data?.section897CapitalGain ?? 0, // Box 2f
      data?.nondividendDistributions ?? 0, // Box 3
      data?.federalTaxWithheld ?? 0, // Box 4
      data?.section199ADividends ?? 0, // Box 5
      data?.investmentExpenses ?? 0, // Box 6
      data?.foreignTaxPaid ?? 0, // Box 7
      data?.foreignCountry ?? '', // Box 8
      data?.cashLiquidationDistributions ?? 0, // Box 9
      data?.noncashLiquidationDistributions ?? 0, // Box 10
      data?.exemptInterestDividends ?? 0, // Box 12
      data?.privateActivityBondDividends ?? 0, // Box 13
      // State
      data?.stateTaxWithheld ?? 0,
      data?.stateId ?? '',
      data?.stateDistribution ?? 0,
      // Routing
      this.toForm1040Line3b(),
      this.toForm1040Line3a(),
      this.toScheduleD()
    ]
  }
}
