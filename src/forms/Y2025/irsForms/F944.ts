import { BusinessForm } from './BusinessForm'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form944Data, BusinessEntity } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 944 - Employer's ANNUAL Federal Tax Return
 *
 * For employers with annual employment tax liability of $1,000 or less.
 * This is an annual version of Form 941 for very small employers.
 *
 * Eligibility:
 * - Must be notified by IRS to file Form 944
 * - Annual SS, Medicare, and withheld income tax <= $1,000
 *
 * 2025 tax rates:
 * - Social Security: 6.2% each (employer + employee = 12.4%)
 * - Medicare: 1.45% each (employer + employee = 2.9%)
 * - SS wage base: $176,100
 */

const SS_RATE = 0.124  // Combined employer + employee
const MEDICARE_RATE = 0.029  // Combined employer + employee

export default class F944 extends BusinessForm {
  tag: FormTag = 'f944'
  sequenceIndex = 0

  formData: Form944Data

  constructor(data: Form944Data) {
    super()
    this.formData = data
  }

  get entityData(): BusinessEntity {
    return this.formData.entity
  }

  // Line 1: Wages, tips, and other compensation
  l1 = (): number => this.formData.totalWages

  // Line 2: Federal income tax withheld
  l2 = (): number => this.formData.totalFederalWithholding

  // Line 3: If no wages subject to SS or Medicare tax, check here
  l3 = (): boolean => this.l4aCol1() === 0 && this.l4cCol1() === 0

  // Line 4a: Taxable social security wages
  l4aCol1 = (): number => this.formData.totalSocialSecurityWages
  l4aCol2 = (): number => Math.round(this.l4aCol1() * SS_RATE * 100) / 100

  // Line 4b: Taxable social security tips
  l4bCol1 = (): number => this.formData.totalTipsReported
  l4bCol2 = (): number => Math.round(this.l4bCol1() * SS_RATE * 100) / 100

  // Line 4c: Taxable Medicare wages & tips
  l4cCol1 = (): number => this.formData.totalMedicareWages
  l4cCol2 = (): number => Math.round(this.l4cCol1() * MEDICARE_RATE * 100) / 100

  // Line 4d: Taxable wages subject to Additional Medicare Tax
  l4dCol1 = (): number => {
    return this.formData.employees.reduce((sum, emp) => {
      const excess = Math.max(0, emp.wages - 200000)
      return sum + excess
    }, 0)
  }
  l4dCol2 = (): number => Math.round(this.l4dCol1() * 0.009 * 100) / 100

  // Line 4e: Total social security and Medicare taxes
  l4e = (): number => {
    return sumFields([this.l4aCol2(), this.l4bCol2(), this.l4cCol2(), this.l4dCol2()])
  }

  // Line 5: Total taxes before adjustments (line 2 + line 4e)
  l5 = (): number => this.l2() + this.l4e()

  // Line 6: Current year's adjustments (fractions of cents)
  l6 = (): number => this.formData.adjustmentForFractions

  // Line 7: Current year's adjustments (sick pay)
  l7 = (): number => this.formData.adjustmentForSickPay

  // Line 8: Current year's adjustments (tips and group-term life)
  l8 = (): number => this.formData.adjustmentForTips

  // Line 9: Total taxes after adjustments
  l9 = (): number => this.l5() + this.l6() + this.l7() + this.l8()

  // Line 10: Qualified small business payroll tax credit for research
  l10 = (): number => this.formData.researchCredit ?? 0

  // Line 11: Total taxes after credits (line 9 - line 10)
  l11 = (): number => Math.max(0, this.l9() - this.l10())

  // Line 12: Total deposits for the year
  l12 = (): number => this.formData.totalDeposits

  // Line 13: COBRA premium assistance payments
  l13 = (): number => this.formData.cobraCredits ?? 0

  // Line 14: Total deposits and credits (line 12 + line 13)
  l14 = (): number => this.l12() + this.l13()

  // Line 15: Balance due (if line 11 > line 14)
  l15 = (): number => Math.max(0, this.l11() - this.l14())

  // Line 16: Overpayment (if line 14 > line 11)
  l16 = (): number => Math.max(0, this.l14() - this.l11())

  taxYear = (): number => this.formData.taxYear
  employeeCount = (): number => this.formData.employees.length
  totalTax = (): number => this.l11()
  balanceDue = (): number => this.l15()
  overpayment = (): number => this.l16()

  fields = (): Field[] => [
    this.entityName(),
    this.ein(),
    this.address(),
    this.addressLine(),
    this.taxYear(),
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4aCol1(),
    this.l4aCol2(),
    this.l4bCol1(),
    this.l4bCol2(),
    this.l4cCol1(),
    this.l4cCol2(),
    this.l4dCol1(),
    this.l4dCol2(),
    this.l4e(),
    this.l5(),
    this.l6(),
    this.l7(),
    this.l8(),
    this.l9(),
    this.l10(),
    this.l11(),
    this.l12(),
    this.l13(),
    this.l14(),
    this.l15(),
    this.l16()
  ]
}
