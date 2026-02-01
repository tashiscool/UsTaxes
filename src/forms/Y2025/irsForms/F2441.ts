/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import F1040Attachment from './F1040Attachment'
import {
  FilingStatus,
  PersonRole,
  DependentCareProvider
} from 'ustaxes/core/data'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 2441 - Child and Dependent Care Expenses
 *
 * Credit for expenses paid for care of qualifying persons to allow
 * taxpayer (and spouse if married) to work or look for work.
 *
 * 2025 Rules:
 * - Maximum expenses: $3,000 for 1 qualifying person, $6,000 for 2+
 * - Credit rate: 20% to 35% based on AGI
 * - At AGI > $43,000, credit rate is 20%
 * - Qualifying person: Child under 13 or disabled dependent/spouse
 */

// 2025 parameters
const cdccParams = {
  maxExpensesOne: 3000, // Maximum for one qualifying person
  maxExpensesTwo: 6000, // Maximum for two or more
  minCreditRate: 0.2, // 20% minimum credit rate
  maxCreditRate: 0.35, // 35% maximum credit rate
  agiThreshold: 15000, // AGI at which max rate applies
  agiPhaseOutEnd: 43000, // AGI at which min rate applies
  employerBenefitLimit: 5000 // Maximum employer-provided benefits
}

export default class F2441 extends F1040Attachment {
  tag: FormTag = 'f2441'
  sequenceIndex = 21

  isNeeded = (): boolean => {
    return this.hasQualifyingExpenses() && this.l11() > 0
  }

  hasQualifyingExpenses = (): boolean => {
    return (
      (this.f1040.info.dependentCareExpenses ?? 0) > 0 ||
      (this.f1040.info.employerDependentCareBenefits ?? 0) > 0
    )
  }

  // Get qualifying dependents (children under 13 or disabled dependents)
  qualifyingPersons = (): number => {
    const dependents = this.f1040.info.taxPayer.dependents ?? []
    const currentYear = 2025

    let count = 0
    for (const dep of dependents) {
      const birthYear = dep.dateOfBirth.getFullYear()
      const age = currentYear - birthYear

      // Under 13 at end of year OR disabled
      if (age < 13 || dep.qualifyingInfo?.isStudent) {
        count++
      }
    }

    return count
  }

  // Earned income for taxpayer
  earnedIncomePrimary = (): number => {
    // W-2 wages + self-employment income
    const w2Income = this.f1040
      .validW2s()
      .filter((w) => w.personRole === PersonRole.PRIMARY)
      .reduce((sum, w) => sum + w.income, 0)

    const selfEmployment = this.f1040.scheduleC?.netProfit() ?? 0

    return w2Income + Math.max(0, selfEmployment)
  }

  // Earned income for spouse
  earnedIncomeSpouse = (): number => {
    if (this.f1040.info.taxPayer.filingStatus !== FilingStatus.MFJ) {
      return Infinity // Not applicable, use large number to not limit
    }

    const w2Income = this.f1040
      .validW2s()
      .filter((w) => w.personRole === PersonRole.SPOUSE)
      .reduce((sum, w) => sum + w.income, 0)

    return w2Income
  }

  // Part I - Persons or Organizations Who Provided the Care

  providers = (): DependentCareProvider[] => {
    return this.f1040.info.dependentCareProviders ?? []
  }

  // Part II - Credit for Child and Dependent Care Expenses

  // Line 1: Number of qualifying persons
  l1 = (): number => this.qualifyingPersons()

  // Line 2: Qualified expenses paid
  l2 = (): number => {
    return this.f1040.info.dependentCareExpenses ?? 0
  }

  // Line 3: If you had qualifying expenses in prior year, enter amount
  l3 = (): number => 0 // Simplified - prior year carryover

  // Line 4: Enter total of lines 2 and 3
  l4 = (): number => this.l2() + this.l3()

  // Line 5: Maximum expenses ($3,000 for 1, $6,000 for 2+)
  l5 = (): number => {
    return this.l1() >= 2
      ? cdccParams.maxExpensesTwo
      : cdccParams.maxExpensesOne
  }

  // Line 6: Enter smaller of line 4 or line 5
  l6 = (): number => Math.min(this.l4(), this.l5())

  // Line 7: Earned income (you)
  l7 = (): number => this.earnedIncomePrimary()

  // Line 8: Earned income (spouse)
  l8 = (): number => {
    if (this.f1040.info.taxPayer.filingStatus !== FilingStatus.MFJ) {
      return 0 // Not shown if not MFJ
    }
    return this.earnedIncomeSpouse()
  }

  // Line 9: Enter smaller of line 6, 7, or 8
  l9 = (): number => {
    if (this.f1040.info.taxPayer.filingStatus === FilingStatus.MFJ) {
      return Math.min(this.l6(), this.l7(), this.l8())
    }
    return Math.min(this.l6(), this.l7())
  }

  // Line 10: Employer-provided dependent care benefits (W-2 box 10)
  l10 = (): number => {
    // Sum box 10 from all W-2s
    return this.f1040.info.employerDependentCareBenefits ?? 0
  }

  // Line 11: Subtract line 10 from line 9
  l11 = (): number => Math.max(0, this.l9() - this.l10())

  // Line 12: Enter your AGI
  l12 = (): number => this.f1040.l11()

  // Line 13: Credit percentage based on AGI
  l13 = (): number => {
    const agi = this.l12()

    if (agi <= cdccParams.agiThreshold) {
      return cdccParams.maxCreditRate // 35%
    }

    if (agi >= cdccParams.agiPhaseOutEnd) {
      return cdccParams.minCreditRate // 20%
    }

    // Phase out: reduce by 1% for each $2,000 of AGI over $15,000
    const excessAgi = agi - cdccParams.agiThreshold
    const reduction = Math.floor(excessAgi / 2000) * 0.01
    return Math.max(
      cdccParams.minCreditRate,
      cdccParams.maxCreditRate - reduction
    )
  }

  // Line 14: Multiply line 11 by line 13 (credit amount)
  l14 = (): number => {
    return Math.round(this.l11() * this.l13())
  }

  // Line 15: Tax liability limitation (not implemented - simplified)
  l15 = (): number => {
    // Credit is limited to tax liability minus other nonrefundable credits
    return this.f1040.l18() // Simplified
  }

  // Line 16: Credit (smaller of line 14 or line 15)
  l16 = (): number => Math.min(this.l14(), this.l15())

  // Credit amount to Schedule 3
  credit = (): number => this.l16()

  // Part III - Dependent Care Benefits (simplified)

  // Line 17: Total employer-provided benefits
  l17 = (): number => this.l10()

  // Line 18: Forfeited amount
  l18 = (): number => 0

  // Line 19: Subtract line 18 from line 17
  l19 = (): number => this.l17() - this.l18()

  // Line 20: Qualified expenses from line 2
  l20 = (): number => this.l2()

  // Line 21: Enter smaller of line 19 or line 20
  l21 = (): number => Math.min(this.l19(), this.l20())

  // Line 22: Earned income limit
  l22 = (): number => {
    if (this.f1040.info.taxPayer.filingStatus === FilingStatus.MFJ) {
      return Math.min(this.l7(), this.l8())
    }
    return this.l7()
  }

  // Line 23: Enter smaller of line 21 or line 22
  l23 = (): number => Math.min(this.l21(), this.l22())

  // Line 24: $5,000 limit (or $2,500 if MFS)
  l24 = (): number => {
    if (this.f1040.info.taxPayer.filingStatus === FilingStatus.MFS) {
      return 2500
    }
    return cdccParams.employerBenefitLimit
  }

  // Line 25: Taxable benefits (line 19 minus smaller of line 23 or line 24)
  l25 = (): number => {
    const excluded = Math.min(this.l23(), this.l24())
    return Math.max(0, this.l19() - excluded)
  }

  // Line 26: Excluded benefits (goes to Form 1040)
  l26 = (): number => Math.min(this.l23(), this.l24())

  fields = (): Field[] => {
    // Provider information (up to 3 providers)
    const providerFields: Field[] = []
    for (let i = 0; i < 3; i++) {
      const provider = this.providers()[i]
      providerFields.push(
        provider.name ?? '',
        provider.address ?? '',
        provider.tin ?? '',
        provider.amountPaid ?? 0
      )
    }

    return [
      this.f1040.namesString(),
      this.f1040.info.taxPayer.primaryPerson.ssid,
      // Part I - Providers
      ...providerFields,
      // Part II - Credit
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
      // Part III - Benefits
      this.l17(),
      this.l18(),
      this.l19(),
      this.l20(),
      this.l21(),
      this.l22(),
      this.l23(),
      this.l24(),
      this.l25(),
      this.l26()
    ]
  }
}
