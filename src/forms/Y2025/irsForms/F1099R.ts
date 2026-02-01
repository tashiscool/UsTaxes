import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 1099-R - Distributions From Pensions, Annuities, Retirement or
 * Profit-Sharing Plans, IRAs, Insurance Contracts, etc.
 *
 * Reports distributions from:
 * - Traditional IRAs
 * - Roth IRAs
 * - 401(k), 403(b), 457 plans
 * - Pension plans
 * - Annuities
 * - Life insurance contracts
 *
 * Key boxes:
 * - Box 1: Gross distribution
 * - Box 2a: Taxable amount
 * - Box 4: Federal tax withheld
 * - Box 7: Distribution code (determines taxability)
 */

export interface F1099RData {
  // Payer information
  payerName: string
  payerAddress: string
  payerTIN: string
  payerPhone: string
  // Recipient information
  recipientName: string
  recipientAddress: string
  recipientTIN: string
  // Account number
  accountNumber?: string
  // Distribution amounts
  grossDistribution: number // Box 1
  taxableAmount: number // Box 2a
  taxableAmountNotDetermined: boolean // Box 2b checkbox
  totalDistribution: boolean // Box 2b checkbox
  capitalGain: number // Box 3
  federalTaxWithheld: number // Box 4
  employeeContributions: number // Box 5
  netUnrealizedAppreciation: number // Box 6
  distributionCode: string // Box 7 (1-9, A-W)
  iraSepSimple: boolean // Box 7 IRA/SEP/SIMPLE checkbox
  otherAmount: number // Box 8
  percentTotalDistribution: number // Box 9a
  totalEmployeeContributions: number // Box 9b
  amountAllocableToIRR: number // Box 10
  firstYearDesignatedRoth: number // Box 11
  // FATCA
  fatcaFilingRequired: boolean // Box 12
  // State tax
  stateTaxWithheld: number // Box 14
  statePayerNumber: string // Box 15
  stateDistribution: number // Box 16
  // Local tax
  localTaxWithheld: number // Box 17
  localityName: string // Box 18
  localDistribution: number // Box 19
}

// Distribution codes and their meanings
const DISTRIBUTION_CODES: Record<string, string> = {
  '1': 'Early distribution, no known exception',
  '2': 'Early distribution, exception applies',
  '3': 'Disability',
  '4': 'Death',
  '5': 'Prohibited transaction',
  '6': 'Section 1035 exchange',
  '7': 'Normal distribution',
  '8': 'Excess contributions plus earnings',
  '9': 'Cost of current life insurance protection',
  A: 'May be eligible for 10-year tax option',
  B: 'Designated Roth distribution',
  C: 'Reportable death benefits under section 6050Y',
  D: 'Annuity payments from nonqualified annuities',
  E: 'Distributions under Employee Plans Compliance Resolution System',
  F: 'Charitable gift annuity',
  G: 'Direct rollover',
  H: 'Direct rollover of designated Roth to Roth IRA',
  J: 'Early distribution from Roth IRA',
  K: 'Distribution of IRA assets not having a readily available FMV',
  L: 'Loans treated as distributions',
  M: 'Qualified plan loan offset',
  N: 'Recharacterized IRA contribution',
  P: 'Excess contributions plus earnings taxable in prior year',
  Q: 'Qualified distribution from Roth IRA',
  R: 'Recharacterized IRA contribution taxable in prior year',
  S: 'Early distribution from SIMPLE IRA in first 2 years',
  T: 'Roth IRA distribution, exception applies',
  U: 'Dividend distribution from ESOP',
  W: 'Charges or payments for qualified long-term care insurance'
}

export default class F1099R extends F1040Attachment {
  tag: FormTag = 'f1099r'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF1099RData()
  }

  hasF1099RData = (): boolean => {
    return false
  }

  f1099RData = (): F1099RData | undefined => {
    return undefined
  }

  // Box 1: Gross distribution
  grossDistribution = (): number => {
    return this.f1099RData()?.grossDistribution ?? 0
  }

  // Box 2a: Taxable amount
  taxableAmount = (): number => {
    return this.f1099RData()?.taxableAmount ?? 0
  }

  // Box 4: Federal tax withheld
  federalTaxWithheld = (): number => {
    return this.f1099RData()?.federalTaxWithheld ?? 0
  }

  // Box 7: Distribution code
  distributionCode = (): string => {
    return this.f1099RData()?.distributionCode ?? ''
  }

  // Distribution code description
  distributionCodeDescription = (): string => {
    return DISTRIBUTION_CODES[this.distributionCode()] ?? 'Unknown'
  }

  // Is this from an IRA/SEP/SIMPLE?
  isIRADistribution = (): boolean => {
    return this.f1099RData()?.iraSepSimple ?? false
  }

  // Is this a rollover?
  isRollover = (): boolean => {
    const code = this.distributionCode()
    return code === 'G' || code === 'H'
  }

  // Is this a Roth distribution?
  isRothDistribution = (): boolean => {
    const code = this.distributionCode()
    return ['B', 'H', 'J', 'Q', 'T'].includes(code)
  }

  // Is this an early distribution (may be subject to 10% penalty)?
  isEarlyDistribution = (): boolean => {
    const code = this.distributionCode()
    return code === '1' || code === 'J' || code === 'S'
  }

  // Is the early distribution exempt from penalty?
  isExemptFromPenalty = (): boolean => {
    const code = this.distributionCode()
    return ['2', '3', '4', 'Q', 'T'].includes(code)
  }

  // To Form 1040 (depends on type)
  toForm1040 = (): { line: string; amount: number } => {
    if (this.isIRADistribution()) {
      return { line: '4b', amount: this.taxableAmount() }
    }
    return { line: '5b', amount: this.taxableAmount() }
  }

  fields = (): Field[] => {
    const data = this.f1099RData()

    return [
      // Payer info
      data?.payerName ?? '',
      data?.payerAddress ?? '',
      data?.payerTIN ?? '',
      data?.payerPhone ?? '',
      // Recipient info
      data?.recipientName ?? '',
      data?.recipientAddress ?? '',
      data?.recipientTIN ?? '',
      data?.accountNumber ?? '',
      // Distribution amounts
      data?.grossDistribution ?? 0, // Box 1
      data?.taxableAmount ?? 0, // Box 2a
      data?.taxableAmountNotDetermined ?? false,
      data?.totalDistribution ?? false,
      data?.capitalGain ?? 0, // Box 3
      data?.federalTaxWithheld ?? 0, // Box 4
      data?.employeeContributions ?? 0, // Box 5
      data?.netUnrealizedAppreciation ?? 0, // Box 6
      data?.distributionCode ?? '', // Box 7
      data?.iraSepSimple ?? false,
      data?.otherAmount ?? 0, // Box 8
      data?.percentTotalDistribution ?? 0, // Box 9a
      data?.totalEmployeeContributions ?? 0, // Box 9b
      data?.amountAllocableToIRR ?? 0, // Box 10
      data?.firstYearDesignatedRoth ?? 0, // Box 11
      data?.fatcaFilingRequired ?? false, // Box 12
      // State
      data?.stateTaxWithheld ?? 0,
      data?.statePayerNumber ?? '',
      data?.stateDistribution ?? 0,
      // Local
      data?.localTaxWithheld ?? 0,
      data?.localityName ?? '',
      data?.localDistribution ?? 0,
      // Analysis
      this.distributionCodeDescription(),
      this.isIRADistribution(),
      this.isRollover(),
      this.isRothDistribution(),
      this.isEarlyDistribution(),
      this.isExemptFromPenalty()
    ]
  }
}
