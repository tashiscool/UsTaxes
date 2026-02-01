import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { Field } from 'ustaxes/core/pdfFiller'
import { fica } from '../data/federal'

/**
 * Schedule H (Form 1040) - Household Employment Taxes
 *
 * "Nanny Tax" - Used to report employment taxes for household employees
 * (nannies, housekeepers, gardeners, etc.)
 *
 * Requirements:
 * - Cash wages ≥ $2,700 (2025) triggers Social Security/Medicare
 * - Cash wages ≥ $1,000 in any quarter triggers FUTA
 */

// 2025 thresholds
const householdTax = {
  socialSecurityThreshold: 2700, // Threshold for SS/Medicare taxes
  futaThreshold: 1000, // Quarterly threshold for FUTA
  futaRate: 0.006, // 0.6% FUTA rate (after state credit)
  futaWageLimit: 7000, // FUTA wage base per employee
  socialSecurityRate: 0.062,
  medicareRate: 0.0145
}

export interface HouseholdEmployee {
  name: string
  ssn: string
  cashWages: number
  federalWithholding: number
  stateWithholding: number
  socialSecurityWithheld: number
  medicareWithheld: number
}

export default class ScheduleH extends F1040Attachment {
  tag: FormTag = 'f1040sh'
  sequenceIndex = 44

  isNeeded = (): boolean => {
    return (
      this.hasHouseholdEmployees() &&
      this.totalWages() >= householdTax.socialSecurityThreshold
    )
  }

  hasHouseholdEmployees = (): boolean => {
    return (this.f1040.info.householdEmployees?.length ?? 0) > 0
  }

  employees = (): HouseholdEmployee[] => {
    return (
      (this.f1040.info.householdEmployees as HouseholdEmployee[] | undefined) ??
      []
    )
  }

  totalWages = (): number => {
    return this.employees().reduce((sum, emp) => sum + emp.cashWages, 0)
  }

  // Part I - Social Security, Medicare, and Federal Income Tax

  // Line A: Did you pay cash wages ≥ threshold?
  lineA = (): boolean =>
    this.totalWages() >= householdTax.socialSecurityThreshold

  // Line B: Did you withhold federal income tax?
  lineB = (): boolean => {
    return this.employees().some((emp) => emp.federalWithholding > 0)
  }

  // Line 1: Total cash wages subject to social security
  l1 = (): number => {
    if (!this.lineA()) return 0
    // Cap at Social Security wage base per employee
    return this.employees().reduce((sum, emp) => {
      return sum + Math.min(emp.cashWages, fica.maxIncomeSSTaxApplies)
    }, 0)
  }

  // Line 2: Social security tax (line 1 × 12.4%)
  l2 = (): number => Math.round(this.l1() * householdTax.socialSecurityRate * 2)

  // Line 3: Total cash wages subject to Medicare
  l3 = (): number => {
    if (!this.lineA()) return 0
    return this.totalWages()
  }

  // Line 4: Medicare tax (line 3 × 2.9%)
  l4 = (): number => Math.round(this.l3() * householdTax.medicareRate * 2)

  // Line 5: Additional Medicare tax on wages > $200,000
  l5 = (): number => {
    const threshold = 200000
    const excess = Math.max(0, this.l3() - threshold)
    return Math.round(excess * 0.009) // 0.9% employee portion only
  }

  // Line 6: Total social security, Medicare, and additional Medicare
  l6 = (): number => sumFields([this.l2(), this.l4(), this.l5()])

  // Line 7a: Federal income tax withheld
  l7a = (): number => {
    return this.employees().reduce(
      (sum, emp) => sum + emp.federalWithholding,
      0
    )
  }

  // Line 7b: Social security and Medicare withheld from employee
  l7b = (): number => {
    return this.employees().reduce((sum, emp) => {
      return sum + emp.socialSecurityWithheld + emp.medicareWithheld
    }, 0)
  }

  // Line 8: Total household employment taxes (line 6 + 7a + 7b adjustment)
  l8 = (): number => {
    // Employer pays half of SS/Medicare, employee pays half
    // Plus any federal withholding
    return sumFields([this.l6(), this.l7a()])
  }

  // Part II - Federal Unemployment (FUTA) Tax

  // Line C: Did you pay $1,000+ in any quarter?
  lineC = (): boolean => {
    // Simplified - check if total wages suggest quarterly threshold met
    return this.totalWages() >= householdTax.futaThreshold * 4
  }

  // Line 9: Did any state have unemployment law?
  l9 = (): boolean => true // Assume yes for most cases

  // Line 10: FUTA wages (max $7,000 per employee)
  l10 = (): number => {
    if (!this.lineC()) return 0
    return this.employees().reduce((sum, emp) => {
      return sum + Math.min(emp.cashWages, householdTax.futaWageLimit)
    }, 0)
  }

  // Line 11: FUTA tax before adjustments
  l11 = (): number => Math.round(this.l10() * 0.06) // 6% gross rate

  // Line 12: State unemployment tax credit
  l12 = (): number => {
    // Maximum credit is 5.4% of wages
    return Math.round(this.l10() * 0.054)
  }

  // Line 13: FUTA tax (line 11 - line 12)
  l13 = (): number => Math.max(0, this.l11() - this.l12())

  // Part III - Total Household Employment Taxes

  // Line 14: Total taxes (line 8 + line 13)
  l14 = (): number => this.l8() + this.l13()

  // Line 15: Advance EIC payments (generally 0 now)
  l15 = (): number => 0

  // Line 16: Subtract line 15 from line 14
  l16 = (): number => this.l14() - this.l15()

  // Line 17: Amounts already deposited
  l17 = (): number => this.f1040.info.householdTaxDeposits ?? 0

  // Line 18: Amount you owe (line 16 - line 17)
  l18 = (): number => Math.max(0, this.l16() - this.l17())

  // Line 19: Overpayment
  l19 = (): number => Math.max(0, this.l17() - this.l16())

  // To Schedule 2 line 9
  totalTax = (): number => this.l16()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.f1040.info.taxPayer.primaryPerson.ein ?? '',
    // Part I
    this.lineA(),
    this.lineB(),
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5(),
    this.l6(),
    this.l7a(),
    this.l7b(),
    this.l8(),
    // Part II
    this.lineC(),
    this.l9(),
    this.l10(),
    this.l11(),
    this.l12(),
    this.l13(),
    // Part III
    this.l14(),
    this.l15(),
    this.l16(),
    this.l17(),
    this.l18(),
    this.l19()
  ]
}
