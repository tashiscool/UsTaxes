/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { Field } from 'ustaxes/core/pdfFiller'

/**
 * Form 8839 - Qualified Adoption Expenses
 *
 * Credit for qualified adoption expenses.
 * Maximum credit: $16,810 per child (2025)
 * Phase-out begins at MAGI: $252,150 (2025)
 * Phase-out complete at MAGI: $292,150 (2025)
 */

// 2025 adoption credit parameters
const adoptionCredit = {
  maxCredit: 16810,
  phaseOutStart: 252150,
  phaseOutEnd: 292150,
  phaseOutRange: 40000
}

export interface AdoptedChild {
  name: string
  ssn: string
  birthYear: number
  disabledChild: boolean
  foreignChild: boolean
  specialNeedsChild: boolean
  qualifiedExpenses: number
  priorYearExpenses: number
  adoptionFinalized: boolean
  yearAdoptionBegan: number
}

export default class F8839 extends F1040Attachment {
  tag: FormTag = 'f8839'
  sequenceIndex = 38

  isNeeded = (): boolean => {
    return this.adoptedChildren().length > 0 && this.totalCredit() > 0
  }

  adoptedChildren = (): AdoptedChild[] => {
    return this.f1040.info.adoptedChildren ?? []
  }

  // Calculate MAGI for adoption credit
  magi = (): number => {
    // MAGI = AGI + foreign earned income exclusion + foreign housing exclusion
    return this.f1040.l11() + (this.f1040.f2555?.l45() ?? 0)
  }

  // Calculate phase-out percentage
  phaseOutPercentage = (): number => {
    const magi = this.magi()

    if (magi <= adoptionCredit.phaseOutStart) {
      return 1 // Full credit
    }

    if (magi >= adoptionCredit.phaseOutEnd) {
      return 0 // No credit
    }

    // Linear phase-out
    const excess = magi - adoptionCredit.phaseOutStart
    return 1 - excess / adoptionCredit.phaseOutRange
  }

  // Part I - Information About Your Eligible Child or Children

  // Line 1: Child information (up to 3 children per form)
  childInfo = (index: number): AdoptedChild | undefined => {
    return this.adoptedChildren()[index]
  }

  // Part II - Adoption Credit

  // Line 2: Maximum adoption credit per child
  l2 = (): number => adoptionCredit.maxCredit

  // Line 3a-3c: Qualified adoption expenses per child
  l3 = (childIndex: number): number => {
    const child = this.childInfo(childIndex)
    if (!child) return 0
    return child.qualifiedExpenses
  }

  // Line 4a-4c: Prior year expenses claimed
  l4 = (childIndex: number): number => {
    const child = this.childInfo(childIndex)
    if (!child) return 0
    return child.priorYearExpenses
  }

  // Line 5a-5c: Subtract line 4 from line 3
  l5 = (childIndex: number): number => {
    return Math.max(0, this.l3(childIndex) - this.l4(childIndex))
  }

  // Line 6a-6c: Enter smaller of line 2 or line 5
  l6 = (childIndex: number): number => {
    return Math.min(this.l2(), this.l5(childIndex))
  }

  // Line 7: Add amounts on line 6 for all children
  l7 = (): number => {
    let total = 0
    for (let i = 0; i < this.adoptedChildren().length; i++) {
      total += this.l6(i)
    }
    return total
  }

  // Line 8: Modified AGI
  l8 = (): number => this.magi()

  // Line 9: Enter $252,150 (2025)
  l9 = (): number => adoptionCredit.phaseOutStart

  // Line 10: Subtract line 9 from line 8
  l10 = (): number => Math.max(0, this.l8() - this.l9())

  // Line 11: Divide line 10 by $40,000
  l11 = (): number => {
    if (this.l10() <= 0) return 0
    return Math.min(1, this.l10() / adoptionCredit.phaseOutRange)
  }

  // Line 12: Multiply line 7 by line 11
  l12 = (): number => Math.round(this.l7() * this.l11())

  // Line 13: Subtract line 12 from line 7
  l13 = (): number => Math.max(0, this.l7() - this.l12())

  // Line 14: Credit carryforward from prior years
  l14 = (): number => this.f1040.info.adoptionCreditCarryforward ?? 0

  // Line 15: Add lines 13 and 14
  l15 = (): number => this.l13() + this.l14()

  // Part III - Credit Carryforward

  // Line 16: Limitation based on tax liability
  l16 = (): number => {
    const tax = this.f1040.l18()
    const otherCredits = sumFields([
      this.f1040.schedule3.l1(),
      this.f1040.schedule3.l2(),
      this.f1040.schedule3.l3(),
      this.f1040.schedule3.l4(),
      this.f1040.schedule3.l6l()
    ])
    return Math.max(0, tax - otherCredits)
  }

  // Line 17: Adoption credit (smaller of line 15 or line 16)
  l17 = (): number => Math.min(this.l15(), this.l16())

  // Line 18: Credit carryforward to next year
  l18 = (): number => Math.max(0, this.l15() - this.l17())

  // Total credit for Schedule 3
  totalCredit = (): number => this.l17()

  // Carryforward to next year
  carryforward = (): number => this.l18()

  fields = (): Field[] => {
    const children = this.adoptedChildren()
    const childFields: Field[] = []

    // Add fields for up to 3 children
    for (let i = 0; i < 3; i++) {
      const child = children[i]
      childFields.push(
        child.name ?? '',
        child.ssn ?? '',
        child.birthYear ?? '',
        child.disabledChild ?? false,
        child.foreignChild ?? false,
        child.specialNeedsChild ?? false,
        this.l3(i),
        this.l4(i),
        this.l5(i),
        this.l6(i)
      )
    }

    return [
      this.f1040.namesString(),
      this.f1040.info.taxPayer.primaryPerson.ssid,
      ...childFields,
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
      this.l17(),
      this.l18()
    ]
  }
}
