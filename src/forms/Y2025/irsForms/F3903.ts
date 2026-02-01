import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { Field } from 'ustaxes/core/pdfFiller'

/**
 * Form 3903 - Moving Expenses
 *
 * Note: Under TCJA (2018-2025), moving expense deduction is ONLY available
 * for members of the Armed Forces on active duty who move due to military orders
 * for permanent change of station.
 *
 * OBBBA 2025: May restore general moving expense deduction
 *
 * Deductible expenses:
 * - Transportation of household goods
 * - Travel (including lodging) to new home
 *
 * NOT deductible:
 * - Meals during the move
 * - Pre-move house hunting
 * - Temporary living expenses
 * - Costs of selling old home / buying new home
 */

export interface MovingExpenses {
  isActiveDutyMilitary: boolean
  militaryOrderDate?: Date
  permanentChangeOfStation: boolean

  // Move locations
  oldAddress: string
  newAddress: string
  distanceMiles: number

  // Deductible expenses
  transportationHouseholdGoods: number
  travelLodging: number
  mileageExpense: number
  parkingAndTolls: number

  // Reimbursements
  employerReimbursement: number
}

// 2025 standard mileage rate for moving (military only)
const movingMileageRate = 0.22 // 22 cents per mile

export default class F3903 extends F1040Attachment {
  tag: FormTag = 'f3903'
  sequenceIndex = 62

  isNeeded = (): boolean => {
    return this.qualifiesForDeduction() && this.totalExpenses() > 0
  }

  movingInfo = (): MovingExpenses | undefined => {
    return this.f1040.info.movingExpenses as MovingExpenses | undefined
  }

  // Check if taxpayer qualifies (military only under TCJA)
  qualifiesForDeduction = (): boolean => {
    const info = this.movingInfo()
    if (!info) return false

    // Under TCJA, only active duty military qualifies
    return info.isActiveDutyMilitary && info.permanentChangeOfStation
  }

  // Line 1: Transportation and storage of household goods
  l1 = (): number => this.movingInfo()?.transportationHouseholdGoods ?? 0

  // Line 2: Travel and lodging expenses
  l2 = (): number => {
    const info = this.movingInfo()
    if (!info) return 0

    // Calculate mileage OR actual expenses
    const mileageExpense =
      info.mileageExpense > 0
        ? info.mileageExpense
        : Math.round(info.distanceMiles * movingMileageRate)

    return sumFields([info.travelLodging, mileageExpense, info.parkingAndTolls])
  }

  // Line 3: Add lines 1 and 2 (total moving expenses)
  l3 = (): number => this.l1() + this.l2()

  totalExpenses = (): number => this.l3()

  // Line 4: Enter reimbursements included in income
  l4 = (): number => {
    const info = this.movingInfo()
    // Reimbursements reported in box 12 code P of W-2 are NOT included in income
    // Only enter reimbursements that were included in income (box 1)
    return info?.employerReimbursement ?? 0
  }

  // Line 5: Deductible moving expenses
  l5 = (): number => {
    if (!this.qualifiesForDeduction()) return 0
    return Math.max(0, this.l3() - this.l4())
  }

  // To Schedule 1 line 14 (or 26 if military)
  deduction = (): number => this.l5()

  // Information for worksheet
  oldAddress = (): string => this.movingInfo()?.oldAddress ?? ''
  newAddress = (): string => this.movingInfo()?.newAddress ?? ''
  distanceMoved = (): number => this.movingInfo()?.distanceMiles ?? 0
  dateOfMove = (): Date | undefined => this.movingInfo()?.militaryOrderDate

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Move info
    this.oldAddress(),
    this.newAddress(),
    this.distanceMoved(),
    this.dateOfMove()?.toLocaleDateString() ?? '',
    // Military info
    this.movingInfo()?.isActiveDutyMilitary ?? false,
    this.movingInfo()?.permanentChangeOfStation ?? false,
    // Lines
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5()
  ]
}
