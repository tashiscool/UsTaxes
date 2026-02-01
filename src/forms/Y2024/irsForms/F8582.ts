import { MatrixRow } from './ScheduleE'
import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Field } from 'ustaxes/core/pdfFiller'
import { FilingStatus } from 'ustaxes/core/data'

/* eslint-disable @typescript-eslint/no-unnecessary-condition */

/**
 * Form 8582 - Passive Activity Loss Limitations
 *
 * Used to calculate the amount of passive activity losses that can be
 * deducted in the current year.
 *
 * Key Rules:
 * - Passive losses can only offset passive income
 * - $25,000 special allowance for rental real estate with "active participation"
 * - Phase-out: Allowance reduced by 50% of MAGI over $100,000
 * - Fully phased out at $150,000 MAGI ($75,000 for MFS)
 * - Unused losses are suspended and carried forward
 */

// 2024 passive activity loss limits
const passiveActivityLimits = {
  // Special allowance for rental real estate with active participation
  specialAllowanceMax: 25000,
  // MAGI threshold where phase-out begins
  phaseOutThreshold: {
    [FilingStatus.S]: 100000,
    [FilingStatus.MFJ]: 100000,
    [FilingStatus.MFS]: 50000, // If lived apart all year
    [FilingStatus.HOH]: 100000,
    [FilingStatus.W]: 100000
  },
  // MAGI where special allowance is fully eliminated
  phaseOutComplete: {
    [FilingStatus.S]: 150000,
    [FilingStatus.MFJ]: 150000,
    [FilingStatus.MFS]: 75000, // If lived apart all year
    [FilingStatus.HOH]: 150000,
    [FilingStatus.W]: 150000
  },
  // Phase-out rate (50 cents per dollar over threshold)
  phaseOutRate: 0.5
}

export default class F8582 extends F1040Attachment {
  tag: FormTag = 'f8582'
  sequenceIndex = 8

  isNeeded = (): boolean => {
    // Form is needed if there are passive activity losses
    return this.hasPassiveLosses()
  }

  hasPassiveLosses = (): boolean => {
    const rentalLoss = this.totalRentalLoss()
    const otherPassiveLoss = this.otherPassiveLoss()
    return rentalLoss < 0 || otherPassiveLoss < 0
  }

  // Get rental income/loss from Schedule E
  totalRentalIncome = (): number => {
    const rentalNet = this.f1040.scheduleE.rentalNet()
    let total = 0
    for (const v of rentalNet) {
      total += Math.max(0, v ?? 0)
    }
    return total
  }

  totalRentalLoss = (): number => {
    const rentalNet = this.f1040.scheduleE.rentalNet()
    let total = 0
    for (const v of rentalNet) {
      total += Math.min(0, v ?? 0)
    }
    return total
  }

  // Other passive activity income/loss (K-1, etc.)
  otherPassiveIncome = (): number => {
    // From Schedule K-1s marked as passive
    const k1Income = this.f1040.info.scheduleK1Form1065s
      .filter((k) => k.isPassive)
      .reduce((sum, k) => sum + Math.max(0, k.ordinaryBusinessIncome), 0)
    return k1Income
  }

  otherPassiveLoss = (): number => {
    const k1Loss = this.f1040.info.scheduleK1Form1065s
      .filter((k) => k.isPassive)
      .reduce((sum, k) => sum + Math.min(0, k.ordinaryBusinessIncome), 0)
    return k1Loss
  }

  // Modified AGI for passive loss limitations
  modifiedAgi = (): number => {
    // Start with AGI
    const magi = this.f1040.l11()

    // Add back certain deductions
    // (Simplified - full calculation would include IRA deductions, etc.)
    return magi
  }

  // Part I - 2024 Passive Activity Loss

  // Line 1a: Activities with net income (rental real estate)
  l1a = (): number => this.totalRentalIncome()

  // Line 1b: Activities with net loss (rental real estate)
  l1b = (): number => Math.abs(this.totalRentalLoss())

  // Line 1c: Prior year unallowed losses (rental real estate)
  l1c = (): number => 0 // Would need carryover tracking

  // Line 1d: Combine lines 1a, 1b, and 1c
  l1d = (): number => this.l1a() - this.l1b() - this.l1c()

  // Line 2a: Activities with net income (other passive)
  l2a = (): number => this.otherPassiveIncome()

  // Line 2b: Activities with net loss (other passive)
  l2b = (): number => Math.abs(this.otherPassiveLoss())

  // Line 2c: Prior year unallowed losses (other passive)
  l2c = (): number => 0 // Would need carryover tracking

  // Line 2d: Combine lines 2a, 2b, and 2c
  l2d = (): number => this.l2a() - this.l2b() - this.l2c()

  // Line 3: Combine lines 1d and 2d (total passive income/loss)
  l3 = (): number => this.l1d() + this.l2d()

  // If line 3 is zero or positive, no limitation applies
  // If line 3 is negative, continue to Part II

  // Part II - Special Allowance for Rental Real Estate Activities
  // (Active participation required)

  // Line 4: Enter smaller of loss on line 1d or line 3
  l4 = (): number => {
    if (this.l3() >= 0) return 0
    return Math.min(Math.abs(this.l1d()), Math.abs(this.l3()))
  }

  // Line 5: Modified AGI
  l5 = (): number => this.modifiedAgi()

  // Line 6: Enter $150,000 (or $75,000 if MFS)
  l6 = (): number => {
    const status = this.f1040.info.taxPayer.filingStatus ?? FilingStatus.S
    return passiveActivityLimits.phaseOutComplete[status]
  }

  // Line 7: Subtract line 5 from line 6
  l7 = (): number => Math.max(0, this.l6() - this.l5())

  // Line 8: Multiply line 7 by 50%
  l8 = (): number => Math.round(this.l7() * passiveActivityLimits.phaseOutRate)

  // Line 9: Enter $25,000 (or $12,500 if MFS)
  l9 = (): number => {
    const status = this.f1040.info.taxPayer.filingStatus ?? FilingStatus.S
    if (status === FilingStatus.MFS) {
      return 12500
    }
    return passiveActivityLimits.specialAllowanceMax
  }

  // Line 10: Enter smaller of line 8 or line 9
  l10 = (): number => Math.min(this.l8(), this.l9())

  // Line 11: Enter smaller of line 4 or line 10 (special allowance)
  l11 = (): number => Math.min(this.l4(), this.l10())

  specialAllowance = (): number => this.l11()

  // Part III - Total Losses Allowed

  // Line 12: Add income from all passive activities
  l12 = (): number => this.l1a() + this.l2a()

  // Line 13: Total losses from all passive activities (absolute value)
  l13 = (): number => this.l1b() + this.l2b()

  // Line 14: Add lines 1c and 2c (prior year unallowed losses)
  l14 = (): number => this.l1c() + this.l2c()

  // Line 15: Add lines 12 and 11
  l15 = (): number => this.l12() + this.l11()

  // Line 16: Passive activity loss allowed (smaller of 13+14 or 15)
  l16 = (): number => Math.min(this.l13() + this.l14(), this.l15())

  totalLossAllowed = (): number => this.l16()

  // Unallowed loss (suspended, carried forward)
  suspendedLoss = (): number => {
    const totalLoss = this.l13() + this.l14()
    return Math.max(0, totalLoss - this.l16())
  }

  // For Schedule E - deductible rental loss after limitation
  deductibleRealEstateLossAfterLimitation = (): MatrixRow => {
    const rentalNet = this.f1040.scheduleE.rentalNet()
    const totalRentalLoss = Math.abs(this.totalRentalLoss())

    // If no rental loss or no limitation, return original values
    if (totalRentalLoss === 0) {
      return rentalNet
    }

    // Calculate proportion of each rental's loss to total loss
    const allowedLoss = Math.min(totalRentalLoss, this.totalLossAllowed())
    const allowanceRatio =
      totalRentalLoss > 0 ? allowedLoss / totalRentalLoss : 0

    return rentalNet.map((v) => {
      if (v === undefined || v >= 0) {
        return v // Income passes through unchanged
      }
      // Apply limitation proportionally to each property's loss
      return Math.round(v * allowanceRatio)
    }) as MatrixRow
  }

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Part I
    this.l1a(),
    this.l1b(),
    this.l1c(),
    this.l1d(),
    this.l2a(),
    this.l2b(),
    this.l2c(),
    this.l2d(),
    this.l3(),
    // Part II
    this.l4(),
    this.l5(),
    this.l6(),
    this.l7(),
    this.l8(),
    this.l9(),
    this.l10(),
    this.l11(),
    // Part III
    this.l12(),
    this.l13(),
    this.l14(),
    this.l15(),
    this.l16()
  ]
}
