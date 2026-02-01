import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 1041-ES - Estimated Income Tax for Estates and Trusts
 *
 * Used by fiduciaries of estates and trusts to pay estimated income tax.
 *
 * Required when the estate or trust expects to owe at least $1,000 in tax
 * after subtracting withholding and credits.
 *
 * Payment schedule:
 * - 1st payment: April 15
 * - 2nd payment: June 15
 * - 3rd payment: September 15
 * - 4th payment: January 15 (of following year)
 */

export interface EstimatedTaxPayment {
  paymentNumber: 1 | 2 | 3 | 4
  dueDate: Date
  amount: number
  datePaid?: Date
  confirmationNumber?: string
}

export interface F1041ESData {
  // Estate/Trust information
  estateTrustName: string
  estateTrustEIN: string
  fiduciaryName: string
  fiduciaryAddress: string
  // Tax year
  taxYear: number
  // Estimated tax calculation
  estimatedTaxableIncome: number
  estimatedTax: number
  estimatedCredits: number
  estimatedOtherTaxes: number
  estimatedTotalTax: number
  // Withholding and prior payments
  expectedWithholding: number
  priorYearOverpaymentApplied: number
  // Payments
  payments: EstimatedTaxPayment[]
  // Annualization
  useAnnualizedIncomeMethod: boolean
}

// 2025 Trust Tax Brackets for estimated tax calculation
const TRUST_TAX_BRACKETS = [
  { min: 0, max: 3050, rate: 0.1 },
  { min: 3050, max: 11450, rate: 0.24 },
  { min: 11450, max: 15650, rate: 0.35 },
  { min: 15650, max: Infinity, rate: 0.37 }
]

export default class F1041ES extends F1040Attachment {
  tag: FormTag = 'f1041es'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.needsEstimatedTax()
  }

  needsEstimatedTax = (): boolean => {
    const fiduciary = this.f1040.info.fiduciaryReturn
    return fiduciary !== undefined
  }

  f1041ESData = (): F1041ESData | undefined => {
    return undefined
  }

  // Estate/Trust info
  estateTrustName = (): string => this.f1041ESData()?.estateTrustName ?? ''
  estateTrustEIN = (): string => this.f1041ESData()?.estateTrustEIN ?? ''
  taxYear = (): number => this.f1041ESData()?.taxYear ?? 2025

  // Compute estimated tax
  computeEstimatedTax = (taxableIncome: number): number => {
    if (taxableIncome <= 0) return 0

    let tax = 0
    let remainingIncome = taxableIncome

    for (const bracket of TRUST_TAX_BRACKETS) {
      if (remainingIncome <= 0) break
      const taxableInBracket = Math.min(
        remainingIncome,
        bracket.max - bracket.min
      )
      tax += taxableInBracket * bracket.rate
      remainingIncome -= taxableInBracket
    }

    return Math.round(tax)
  }

  // Line 1: Estimated taxable income
  l1 = (): number => this.f1041ESData()?.estimatedTaxableIncome ?? 0

  // Line 2: Estimated tax
  l2 = (): number => {
    const provided = this.f1041ESData()?.estimatedTax
    if (provided !== undefined) return provided
    return this.computeEstimatedTax(this.l1())
  }

  // Line 3: Estimated credits
  l3 = (): number => this.f1041ESData()?.estimatedCredits ?? 0

  // Line 4: Tax less credits
  l4 = (): number => Math.max(0, this.l2() - this.l3())

  // Line 5: Other taxes
  l5 = (): number => this.f1041ESData()?.estimatedOtherTaxes ?? 0

  // Line 6: Total estimated tax
  l6 = (): number => this.l4() + this.l5()

  // Line 7: Withholding
  l7 = (): number => this.f1041ESData()?.expectedWithholding ?? 0

  // Line 8: Prior year overpayment
  l8 = (): number => this.f1041ESData()?.priorYearOverpaymentApplied ?? 0

  // Line 9: Total credits and payments
  l9 = (): number => this.l7() + this.l8()

  // Line 10: Balance due
  l10 = (): number => Math.max(0, this.l6() - this.l9())

  // Required quarterly payment
  quarterlyPayment = (): number => {
    const balanceDue = this.l10()
    if (balanceDue < 1000) return 0
    return Math.round(balanceDue / 4)
  }

  // Payment info
  payments = (): EstimatedTaxPayment[] => {
    return this.f1041ESData()?.payments ?? []
  }

  totalPaymentsMade = (): number => {
    return this.payments().reduce((sum, p) => sum + p.amount, 0)
  }

  remainingBalance = (): number => {
    return Math.max(0, this.l10() - this.totalPaymentsMade())
  }

  fields = (): Field[] => {
    const data = this.f1041ESData()
    const payments = this.payments()

    return [
      // Header
      this.estateTrustName(),
      this.estateTrustEIN(),
      data?.fiduciaryName ?? '',
      data?.fiduciaryAddress ?? '',
      this.taxYear(),
      // Worksheet
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
      this.quarterlyPayment(),
      // Annualized method
      data?.useAnnualizedIncomeMethod ?? false,
      // Payment 1
      payments[0]?.dueDate?.toLocaleDateString() ?? '',
      payments[0]?.amount ?? 0,
      payments[0]?.datePaid?.toLocaleDateString() ?? '',
      // Payment 2
      payments[1]?.dueDate?.toLocaleDateString() ?? '',
      payments[1]?.amount ?? 0,
      payments[1]?.datePaid?.toLocaleDateString() ?? '',
      // Payment 3
      payments[2]?.dueDate?.toLocaleDateString() ?? '',
      payments[2]?.amount ?? 0,
      // Payment 4
      payments[3]?.dueDate?.toLocaleDateString() ?? '',
      payments[3]?.amount ?? 0,
      // Totals
      this.totalPaymentsMade(),
      this.remainingBalance()
    ]
  }
}
