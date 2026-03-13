/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { Field } from 'ustaxes/core/pdfFiller'

/**
 * Form 8839 - Qualified Adoption Expenses
 *
 * 2025 changes:
 * - Maximum credit increased to $17,280 per eligible child.
 * - MAGI phase-out updated to $259,190-$299,190.
 * - A refundable amount of up to $5,000 per child is available.
 */

const adoptionCredit = {
  maxCredit: 17280,
  refundableCapPerChild: 5000,
  phaseOutStart: 259190,
  phaseOutEnd: 299190,
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

  adoptedChildren = (): AdoptedChild[] => {
    return this.f1040.info.adoptedChildren ?? []
  }

  isNeeded = (): boolean => {
    return (
      this.adoptedChildren().length > 0 ||
      this.refundableCredit() > 0 ||
      this.nonrefundableCredit() > 0 ||
      this.carryforward() > 0
    )
  }

  magi = (): number => {
    // MAGI = AGI + foreign earned income exclusion + foreign housing exclusion.
    // Form 4563 is not currently modeled in this workspace.
    return this.f1040.l11() + (this.f1040.f2555?.l45() ?? 0)
  }

  phaseOutPercentage = (): number => {
    const magi = this.magi()

    if (magi <= adoptionCredit.phaseOutStart) {
      return 1
    }

    if (magi >= adoptionCredit.phaseOutEnd) {
      return 0
    }

    const excess = magi - adoptionCredit.phaseOutStart
    return 1 - excess / adoptionCredit.phaseOutRange
  }

  childInfo = (index: number): AdoptedChild | undefined => {
    return this.adoptedChildren()[index]
  }

  private deemedQualifiedExpenses = (child: AdoptedChild): number => {
    if (
      child.specialNeedsChild &&
      !child.foreignChild &&
      child.adoptionFinalized
    ) {
      return adoptionCredit.maxCredit
    }
    return child.qualifiedExpenses
  }

  // Part I - Information About Your Eligible Child or Children

  // Line 2: Maximum adoption credit per child
  l2 = (): number => adoptionCredit.maxCredit

  // Line 3a-3c: Qualified adoption expenses per child
  l3 = (childIndex: number): number => {
    const child = this.childInfo(childIndex)
    if (!child) return 0
    return this.deemedQualifiedExpenses(child)
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

  // Line 9: Enter $259,190 (2025)
  l9 = (): number => adoptionCredit.phaseOutStart

  // Line 10: Phase-out percentage
  l10 = (): number => Math.max(0, 1 - this.phaseOutPercentage())

  // Line 11a: Post-phase-out credit amount for each child
  l11a = (childIndex: number): number => {
    return Math.round(this.l6(childIndex) * this.phaseOutPercentage())
  }

  // Line 11b: Refundable portion for each child (up to $5,000)
  l11b = (childIndex: number): number => {
    return Math.min(this.l11a(childIndex), adoptionCredit.refundableCapPerChild)
  }

  // Line 12: Add line 11a for all children
  l12 = (): number => {
    let total = 0
    for (let i = 0; i < this.adoptedChildren().length; i++) {
      total += this.l11a(i)
    }
    return total
  }

  // Line 13: Refundable adoption credit
  l13 = (): number => {
    let total = 0
    for (let i = 0; i < this.adoptedChildren().length; i++) {
      total += this.l11b(i)
    }
    return total
  }

  // Line 14: Remaining nonrefundable current-year credit
  l14 = (): number => Math.max(0, this.l12() - this.l13())

  // Line 15: Credit carryforward from prior years
  l15 = (): number => this.f1040.info.adoptionCreditCarryforward ?? 0

  // Line 16: Total nonrefundable credit available this year
  l16 = (): number => this.l14() + this.l15()

  // Line 17: Limitation based on tax liability
  l17 = (): number => {
    const tax = this.f1040.l18()
    const otherCredits = sumFields([
      this.f1040.schedule3.l1(),
      this.f1040.schedule3.l2(),
      this.f1040.schedule3.l3(),
      this.f1040.schedule3.l4(),
      this.f1040.schedule3.l5(),
      this.f1040.schedule3.l6a(),
      this.f1040.schedule3.l6b(),
      this.f1040.schedule3.l6c(),
      this.f1040.schedule3.l6l()
    ])
    return Math.max(0, tax - otherCredits)
  }

  // Line 18: Nonrefundable adoption credit
  l18 = (): number => Math.min(this.l16(), this.l17())

  // Line 19: Credit carryforward to next year
  l19 = (): number => Math.max(0, this.l16() - this.l18())

  refundableCredit = (): number => this.l13()
  nonrefundableCredit = (): number => this.l18()
  totalCredit = (): number => this.nonrefundableCredit()
  carryforward = (): number => this.l19()

  fields = (): Field[] => {
    const children = this.adoptedChildren()
    const childFields: Field[] = []

    // Preserve the existing child-field ordering for compatibility with the
    // current PDF-filling path while exposing the updated 2025 calculations.
    for (let i = 0; i < 3; i++) {
      const child = children[i]
      childFields.push(
        child?.name ?? '',
        child?.ssn ?? '',
        child?.birthYear ?? '',
        child?.disabledChild ?? false,
        child?.foreignChild ?? false,
        child?.specialNeedsChild ?? false,
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
      this.l12(),
      this.l13(),
      this.l14(),
      this.l15(),
      this.l16(),
      this.l17(),
      this.l18(),
      this.l19()
    ]
  }
}
