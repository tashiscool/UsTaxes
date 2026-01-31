import { BusinessForm } from './BusinessForm'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form943Data, BusinessEntity } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 943 - Employer's Annual Federal Tax Return for Agricultural Employees
 *
 * Used by employers who pay wages to farmworkers (agricultural employees).
 * Similar to Form 941 but filed annually instead of quarterly.
 *
 * Agricultural worker definition:
 * - Farm work including cultivating, harvesting, livestock care
 * - Does NOT include processing/canning/packaging
 *
 * 2025 tax rates:
 * - Social Security: 6.2% each (12.4% total) on wages up to $176,100
 * - Medicare: 1.45% each (2.9% total) on all wages
 * - Additional Medicare: 0.9% on wages over $200,000
 *
 * Due date: January 31 following the tax year
 */

const SS_RATE = 0.124  // Combined 12.4%
const MEDICARE_RATE = 0.029  // Combined 2.9%
const ADDITIONAL_MEDICARE_RATE = 0.009

export default class F943 extends BusinessForm {
  tag: FormTag = 'f943'
  sequenceIndex = 0

  formData: Form943Data

  constructor(data: Form943Data) {
    super()
    this.formData = data
  }

  get entityData(): BusinessEntity {
    return this.formData.entity
  }

  // Line 1: Number of agricultural employees
  l1 = (): number => this.formData.farmworkers.length

  // Line 2: Wages subject to social security tax
  l2 = (): number => this.formData.totalSocialSecurityWages

  // Line 3: Social security tax (line 2 × 12.4%)
  l3 = (): number => Math.round(this.l2() * SS_RATE * 100) / 100

  // Line 4: Wages subject to Medicare tax
  l4 = (): number => this.formData.totalMedicareWages

  // Line 5: Medicare tax (line 4 × 2.9%)
  l5 = (): number => Math.round(this.l4() * MEDICARE_RATE * 100) / 100

  // Line 6: Wages subject to Additional Medicare Tax
  l6 = (): number => {
    return this.formData.farmworkers.reduce((sum, emp) => {
      const excess = Math.max(0, emp.wages - 200000)
      return sum + excess
    }, 0)
  }

  // Line 7: Additional Medicare Tax (line 6 × 0.9%)
  l7 = (): number => Math.round(this.l6() * ADDITIONAL_MEDICARE_RATE * 100) / 100

  // Line 8: Federal income tax withheld
  l8 = (): number => this.formData.federalWithholding

  // Line 9: Total taxes before adjustments (lines 3 + 5 + 7 + 8)
  l9 = (): number => sumFields([this.l3(), this.l5(), this.l7(), this.l8()])

  // Line 10: Current year's adjustments
  l10 = (): number => this.formData.adjustmentForFractions

  // Line 11: Total taxes after adjustments (line 9 ± line 10)
  l11 = (): number => this.l9() + this.l10()

  // Line 12: Qualified small business payroll tax credit
  l12 = (): number => 0

  // Line 13: Total taxes after credits (line 11 - line 12)
  l13 = (): number => Math.max(0, this.l11() - this.l12())

  // Line 14: Total deposits for the year
  l14 = (): number => this.formData.totalDeposits

  // Line 15: Balance due (if line 13 > line 14)
  l15 = (): number => Math.max(0, this.l13() - this.l14())

  // Line 16: Overpayment (if line 14 > line 13)
  l16 = (): number => Math.max(0, this.l14() - this.l13())

  // Deposit schedule
  isMonthlyDepositor = (): boolean => this.formData.depositSchedule === 'monthly'
  isSemiweeklyDepositor = (): boolean => this.formData.depositSchedule === 'semiweekly'

  taxYear = (): number => this.formData.taxYear
  totalTax = (): number => this.l13()
  balanceDue = (): number => this.l15()
  overpayment = (): number => this.l16()

  // Crew leader question
  usedCrewLeader = (): boolean => this.formData.crewLeaderPaid ?? false

  fields = (): Field[] => [
    this.entityName(),
    this.ein(),
    this.address(),
    this.addressLine(),
    this.taxYear(),
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
    this.l14(),
    this.l15(),
    this.l16(),
    this.isMonthlyDepositor(),
    this.isSemiweeklyDepositor(),
    this.usedCrewLeader()
  ]
}
