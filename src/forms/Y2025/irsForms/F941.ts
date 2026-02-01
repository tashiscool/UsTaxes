import { BusinessForm } from './BusinessForm'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import {
  Form941Data,
  BusinessEntity,
  QuarterlyPayrollData
} from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 941 - Employer's Quarterly Federal Tax Return
 *
 * Used by employers to report:
 * - Wages paid to employees
 * - Federal income tax withheld
 * - Both employer and employee share of Social Security and Medicare taxes
 *
 * Key 2025 rates:
 * - Social Security: 6.2% each for employer and employee (12.4% total) on wages up to $176,100
 * - Medicare: 1.45% each for employer and employee (2.9% total) on all wages
 * - Additional Medicare: 0.9% on wages over $200,000 (employee only, no employer match)
 *
 * Filing due dates:
 * - Q1 (Jan-Mar): April 30
 * - Q2 (Apr-Jun): July 31
 * - Q3 (Jul-Sep): October 31
 * - Q4 (Oct-Dec): January 31 (following year)
 *
 * Deposit requirements:
 * - Monthly depositor: Due by 15th of following month
 * - Semi-weekly depositor: Due Wed or Fri after payday
 * - $2,500 de minimis: Can pay with return if liability < $2,500/quarter
 */

// 2025 tax rates
const SS_WAGE_BASE = 176100
const SS_RATE = 0.062 // 6.2% each for employer and employee
const MEDICARE_RATE = 0.0145 // 1.45% each for employer and employee
const ADDITIONAL_MEDICARE_RATE = 0.009 // 0.9% employee only
const ADDITIONAL_MEDICARE_THRESHOLD = 200000

export default class F941 extends BusinessForm {
  tag: FormTag = 'f941'
  sequenceIndex = 0

  formData: Form941Data

  constructor(data: Form941Data) {
    super()
    this.formData = data
  }

  get entityData(): BusinessEntity {
    return this.formData.entity
  }

  quarterData = (): QuarterlyPayrollData => this.formData.quarterData

  // =========================================================================
  // Part 1 - Answer these questions for this quarter
  // =========================================================================

  // Line 1: Number of employees who received wages, tips, or other compensation
  l1 = (): number => this.quarterData().employees.length

  // Line 2: Wages, tips, and other compensation
  l2 = (): number => this.quarterData().totalWages

  // Line 3: Federal income tax withheld from wages, tips, and other compensation
  l3 = (): number => this.quarterData().totalFederalWithholding

  // Line 4: If no wages, tips, and other compensation are subject to social security or Medicare tax
  l4 = (): boolean => this.l5aCol1() === 0 && this.l5cCol1() === 0

  // =========================================================================
  // Lines 5a-5d: Taxable social security and Medicare wages and tips
  // =========================================================================

  // Line 5a: Taxable social security wages
  l5aCol1 = (): number => this.quarterData().totalSocialSecurityWages
  l5aCol2 = (): number => Math.round(this.l5aCol1() * SS_RATE * 2 * 100) / 100 // 12.4% total

  // Line 5b: Taxable social security tips (reported separately)
  l5bCol1 = (): number => this.quarterData().totalTipsReported
  l5bCol2 = (): number => Math.round(this.l5bCol1() * SS_RATE * 2 * 100) / 100

  // Line 5c: Taxable Medicare wages & tips
  l5cCol1 = (): number => this.quarterData().totalMedicareWages
  l5cCol2 = (): number =>
    Math.round(this.l5cCol1() * MEDICARE_RATE * 2 * 100) / 100 // 2.9% total

  // Line 5d: Taxable wages & tips subject to Additional Medicare Tax withholding
  l5dCol1 = (): number => {
    // Sum of wages over $200,000 for each employee
    return this.quarterData().employees.reduce((sum, emp) => {
      const excess = Math.max(0, emp.wages - ADDITIONAL_MEDICARE_THRESHOLD)
      return sum + excess
    }, 0)
  }
  l5dCol2 = (): number =>
    Math.round(this.l5dCol1() * ADDITIONAL_MEDICARE_RATE * 100) / 100

  // Line 5e: Total social security and Medicare taxes (add 5a through 5d, column 2)
  l5e = (): number => {
    return sumFields([
      this.l5aCol2(),
      this.l5bCol2(),
      this.l5cCol2(),
      this.l5dCol2()
    ])
  }

  // Line 5f: Section 3121(q) Notice and Demand - Tax due on unreported tips
  l5f = (): number => 0

  // Line 6: Total taxes before adjustments (add lines 3, 5e, and 5f)
  l6 = (): number => this.l3() + this.l5e() + this.l5f()

  // =========================================================================
  // Lines 7-9: Adjustments
  // =========================================================================

  // Line 7: Current quarter's adjustment for fractions of cents
  l7 = (): number => this.quarterData().adjustmentForFractions

  // Line 8: Current quarter's adjustment for sick pay
  l8 = (): number => this.quarterData().adjustmentForSickPay

  // Line 9: Current quarter's adjustments for tips and group-term life insurance
  l9 = (): number => this.quarterData().adjustmentForTips

  // Line 10: Total taxes after adjustments (line 6 + 7 + 8 + 9)
  l10 = (): number => this.l6() + this.l7() + this.l8() + this.l9()

  // =========================================================================
  // Lines 11-15: Credits and Payments
  // =========================================================================

  // Line 11a: Qualified small business payroll tax credit for increasing research activities
  l11a = (): number => this.quarterData().researchCreditPayroll ?? 0

  // Line 11b: Nonrefundable portion of credit for qualified sick and family leave wages
  // (COVID-era credits, mostly expired but may have carryovers)
  l11b = (): number => 0

  // Line 11c: Reserved for future use
  l11c = (): number => 0

  // Line 11d: Total nonrefundable credits (add lines 11a through 11c)
  l11d = (): number => this.l11a() + this.l11b() + this.l11c()

  // Line 12: Total taxes after adjustments and nonrefundable credits (line 10 minus 11d)
  l12 = (): number => Math.max(0, this.l10() - this.l11d())

  // Line 13a: Total deposits for this quarter
  l13a = (): number => this.quarterData().depositsForQuarter

  // Line 13b: COBRA premium assistance payments
  l13b = (): number => this.quarterData().cobrafPremuimAssistance ?? 0

  // Line 13c: Number of individuals provided COBRA premium assistance
  l13c = (): number => 0

  // Line 13d: Reserved for future use
  l13d = (): number => 0

  // Line 13e: Refundable portion of credit for qualified sick and family leave wages
  l13e = (): number => 0

  // Line 13f: Reserved for future use
  l13f = (): number => 0

  // Line 13g: Total deposits and refundable credits (add 13a, 13b, 13e)
  l13g = (): number => this.l13a() + this.l13b() + this.l13e()

  // Line 14: Balance due (if line 12 > line 13g)
  l14 = (): number => Math.max(0, this.l12() - this.l13g())

  // Line 15: Overpayment (if line 13g > line 12)
  l15 = (): number => Math.max(0, this.l13g() - this.l12())

  // =========================================================================
  // Part 2 - Deposit Schedule and Tax Liability
  // =========================================================================

  // Deposit schedule
  isMonthlyDepositor = (): boolean =>
    this.formData.depositSchedule === 'monthly'
  isSemiweeklyDepositor = (): boolean =>
    this.formData.depositSchedule === 'semiweekly'

  // Monthly tax liability (if monthly depositor)
  month1Liability = (): number => 0 // Would need monthly breakdown
  month2Liability = (): number => 0
  month3Liability = (): number => 0
  totalQuarterLiability = (): number => this.formData.totalLiabilityForQuarter

  // =========================================================================
  // Part 3 - Business Information
  // =========================================================================

  // Is this the final return? (business closed)
  isFinalReturn = (): boolean => false

  // Seasonal employer
  isSeasonalEmployer = (): boolean => false

  // Third-party designee
  hasThirdPartyDesignee = (): boolean => false

  // =========================================================================
  // Helper Methods
  // =========================================================================

  quarter = (): 1 | 2 | 3 | 4 => this.quarterData().quarter
  year = (): number => this.quarterData().year

  quarterEndDate = (): string => {
    const q = this.quarter()
    const year = this.year()
    switch (q) {
      case 1:
        return `March 31, ${year}`
      case 2:
        return `June 30, ${year}`
      case 3:
        return `September 30, ${year}`
      case 4:
        return `December 31, ${year}`
    }
  }

  filingDueDate = (): string => {
    const q = this.quarter()
    const year = this.year()
    switch (q) {
      case 1:
        return `April 30, ${year}`
      case 2:
        return `July 31, ${year}`
      case 3:
        return `October 31, ${year}`
      case 4:
        return `January 31, ${year + 1}`
    }
  }

  // Calculate liability for a single employee
  employeeTaxLiability = (
    wages: number,
    ssWages: number,
    medicareWages: number
  ): {
    federalWithholding: number
    ssEmployerTax: number
    ssEmployeeTax: number
    medicareEmployerTax: number
    medicareEmployeeTax: number
    additionalMedicare: number
  } => {
    const cappedSSWages = Math.min(ssWages, SS_WAGE_BASE)

    return {
      federalWithholding: 0, // Determined by W-4
      ssEmployerTax: Math.round(cappedSSWages * SS_RATE * 100) / 100,
      ssEmployeeTax: Math.round(cappedSSWages * SS_RATE * 100) / 100,
      medicareEmployerTax:
        Math.round(medicareWages * MEDICARE_RATE * 100) / 100,
      medicareEmployeeTax:
        Math.round(medicareWages * MEDICARE_RATE * 100) / 100,
      additionalMedicare:
        wages > ADDITIONAL_MEDICARE_THRESHOLD
          ? Math.round(
              (wages - ADDITIONAL_MEDICARE_THRESHOLD) *
                ADDITIONAL_MEDICARE_RATE *
                100
            ) / 100
          : 0
    }
  }

  // Total tax liability for the quarter
  totalTaxLiability = (): number => this.l12()

  // Balance due or overpayment
  balanceDue = (): number => this.l14()
  overpayment = (): number => this.l15()

  // =========================================================================
  // PDF Fields
  // =========================================================================

  fields = (): Field[] => [
    // Header
    this.entityName(),
    this.ein(),
    this.address(),
    this.addressLine(),
    this.formData.payerNameControl,
    this.quarter(),
    this.year(),
    // Part 1
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    // Line 5
    this.l5aCol1(),
    this.l5aCol2(),
    this.l5bCol1(),
    this.l5bCol2(),
    this.l5cCol1(),
    this.l5cCol2(),
    this.l5dCol1(),
    this.l5dCol2(),
    this.l5e(),
    this.l5f(),
    this.l6(),
    // Adjustments
    this.l7(),
    this.l8(),
    this.l9(),
    this.l10(),
    // Credits
    this.l11a(),
    this.l11b(),
    this.l11c(),
    this.l11d(),
    this.l12(),
    // Payments
    this.l13a(),
    this.l13b(),
    this.l13c(),
    this.l13d(),
    this.l13e(),
    this.l13f(),
    this.l13g(),
    this.l14(),
    this.l15(),
    // Part 2
    this.isMonthlyDepositor(),
    this.isSemiweeklyDepositor(),
    this.month1Liability(),
    this.month2Liability(),
    this.month3Liability(),
    this.totalQuarterLiability()
  ]
}
