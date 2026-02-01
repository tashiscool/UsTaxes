import { BusinessForm } from './BusinessForm'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form945Data, BusinessEntity } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 945 - Annual Return of Withheld Federal Income Tax
 *
 * Used to report federal income tax withheld from NON-PAYROLL payments:
 * - Pensions and annuities
 * - Military retirement
 * - Gambling winnings
 * - Backup withholding on interest, dividends, etc.
 * - Indian gaming profits
 * - Voluntary withholding on government payments
 *
 * This is NOT for regular employee wages (use 941/944 for those).
 *
 * Due date: January 31 following the tax year
 */

export default class F945 extends BusinessForm {
  tag: FormTag = 'f945'
  sequenceIndex = 0

  formData: Form945Data

  constructor(data: Form945Data) {
    super()
    this.formData = data
  }

  get entityData(): BusinessEntity {
    return this.formData.entity
  }

  // Line 1: Federal income tax withheld
  l1 = (): number => this.formData.totalWithholding

  // Breakdown of withholding sources
  pensionWithholding = (): number => this.formData.pensionWithholding
  gamblingWithholding = (): number => this.formData.gamblingWithholding
  backupWithholding = (): number => this.formData.backupWithholding
  indianGamingWithholding = (): number => this.formData.indianGamingWithholding

  // Line 2: Adjustments (fractions of cents, sick pay, etc.)
  l2 = (): number => this.formData.adjustmentForFractions

  // Line 3: Total taxes (line 1 ± line 2)
  l3 = (): number => this.l1() + this.l2()

  // Line 4: Total deposits for the year
  l4 = (): number => this.formData.totalDeposits

  // Line 5: Balance due (if line 3 > line 4)
  l5 = (): number => Math.max(0, this.l3() - this.l4())

  // Line 6: Overpayment (if line 4 > line 3)
  l6 = (): number => Math.max(0, this.l4() - this.l3())

  // Monthly tax liability (if monthly depositor)
  month1 = (): number => 0 // Would need monthly breakdown
  month2 = (): number => 0
  month3 = (): number => 0
  month4 = (): number => 0
  month5 = (): number => 0
  month6 = (): number => 0
  month7 = (): number => 0
  month8 = (): number => 0
  month9 = (): number => 0
  month10 = (): number => 0
  month11 = (): number => 0
  month12 = (): number => 0

  totalMonthlyLiability = (): number => {
    return sumFields([
      this.month1(),
      this.month2(),
      this.month3(),
      this.month4(),
      this.month5(),
      this.month6(),
      this.month7(),
      this.month8(),
      this.month9(),
      this.month10(),
      this.month11(),
      this.month12()
    ])
  }

  // Deposit schedule
  isMonthlyDepositor = (): boolean =>
    this.formData.depositSchedule === 'monthly'
  isSemiweeklyDepositor = (): boolean =>
    this.formData.depositSchedule === 'semiweekly'

  taxYear = (): number => this.formData.taxYear
  totalTax = (): number => this.l3()
  balanceDue = (): number => this.l5()
  overpayment = (): number => this.l6()

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
    this.isMonthlyDepositor(),
    this.isSemiweeklyDepositor(),
    // Monthly breakdown
    this.month1(),
    this.month2(),
    this.month3(),
    this.month4(),
    this.month5(),
    this.month6(),
    this.month7(),
    this.month8(),
    this.month9(),
    this.month10(),
    this.month11(),
    this.month12(),
    this.totalMonthlyLiability()
  ]
}
