import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 4952 - Investment Interest Expense Deduction
 *
 * Used to figure the amount of investment interest expense you can deduct
 * for the current year and the amount to carry forward to future years.
 *
 * Investment interest is interest paid on money borrowed to purchase
 * taxable investments (stocks, bonds, land held for investment, etc.)
 *
 * Key rules:
 * - Deduction limited to net investment income
 * - Excess carries forward to future years
 * - Can elect to treat capital gains as investment income (but loses preferential rate)
 */
export default class F4952 extends F1040Attachment {
  tag: FormTag = 'f4952'
  sequenceIndex = 51

  isNeeded = (): boolean => {
    return this.totalInvestmentInterest() > 0
  }

  // Get investment interest from user data
  totalInvestmentInterest = (): number => {
    return this.f1040.info.investmentInterestExpense ?? 0
  }

  // Prior year carryforward
  priorYearCarryforward = (): number => {
    return this.f1040.info.investmentInterestCarryforward ?? 0
  }

  // Part I - Total Investment Interest Expense

  // Line 1: Investment interest expense paid or accrued in current year
  l1 = (): number => this.totalInvestmentInterest()

  // Line 2: Disallowed investment interest expense from prior years (carryforward)
  l2 = (): number => this.priorYearCarryforward()

  // Line 3: Total investment interest expense (add lines 1 and 2)
  l3 = (): number => this.l1() + this.l2()

  // Part II - Net Investment Income

  // Line 4a: Gross income from property held for investment
  // (excludes Alaska Permanent Fund dividends, net gain from disposition)
  l4a = (): number => {
    // Interest and dividend income that's investment income
    const interestIncome = this.f1040.l2b() ?? 0
    const dividendIncome = this.f1040.l3b() ?? 0
    return interestIncome + dividendIncome
  }

  // Line 4b: Qualified dividends included on line 4a
  l4b = (): number => {
    // Qualified dividends that the taxpayer elects NOT to treat as investment income
    // (to keep preferential rate)
    return this.f1040.l3a() ?? 0
  }

  // Line 4c: Subtract line 4b from line 4a
  l4c = (): number => Math.max(0, this.l4a() - this.l4b())

  // Line 4d: Net gain from disposition of property held for investment
  l4d = (): number => {
    // Capital gains from investment property
    const capitalGains = this.f1040.l7() ?? 0
    return Math.max(0, capitalGains)
  }

  // Line 4e: Net capital gain from disposition of property held for investment
  // (Enter as positive number - this is the amount at preferential rates)
  l4e = (): number => {
    // Long-term capital gains that get preferential treatment
    const scheduleD = this.f1040.scheduleD
    if (scheduleD.isNeeded()) {
      const ltcg = scheduleD.l15() ?? 0
      return Math.max(0, ltcg)
    }
    return 0
  }

  // Line 4f: Amount you elect to include as investment income
  // (Capital gains/qualified dividends elected to be taxed at ordinary rates)
  l4f = (): number => {
    return this.f1040.info.capitalGainsElectedAsInvestmentIncome ?? 0
  }

  // Line 4g: Subtract line 4f from line 4e
  l4g = (): number => Math.max(0, this.l4e() - this.l4f())

  // Line 4h: Subtract line 4g from line 4d
  l4h = (): number => Math.max(0, this.l4d() - this.l4g())

  // Line 5: Investment expenses (from Schedule A if itemizing)
  l5 = (): number => {
    // Investment expenses are no longer deductible as misc itemized deductions
    // under TCJA (2018-2025), so this is typically 0
    return 0
  }

  // Line 6: Net investment income (add lines 4c, 4h, and subtract line 5)
  l6 = (): number => Math.max(0, this.l4c() + this.l4h() - this.l5())

  // Part III - Investment Interest Expense Deduction

  // Line 7: Disallowed investment interest expense to be carried forward
  // (Subtract line 6 from line 3, if zero or less, enter 0)
  l7 = (): number => Math.max(0, this.l3() - this.l6())

  // Line 8: Investment interest expense deduction
  // (Enter smaller of line 3 or line 6)
  l8 = (): number => Math.min(this.l3(), this.l6())

  // Amount deductible on Schedule A
  deduction = (): number => this.l8()

  // Carryforward to next year
  carryforward = (): number => this.l7()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Part I
    this.l1(),
    this.l2(),
    this.l3(),
    // Part II
    this.l4a(),
    this.l4b(),
    this.l4c(),
    this.l4d(),
    this.l4e(),
    this.l4f(),
    this.l4g(),
    this.l4h(),
    this.l5(),
    this.l6(),
    // Part III
    this.l7(),
    this.l8()
  ]
}
