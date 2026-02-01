import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 8910 - Alternative Motor Vehicle Credit
 *
 * Use this form to claim a credit for qualified fuel cell motor vehicles.
 * This is different from the electric vehicle credit (Form 8936).
 *
 * Qualified vehicles include:
 * - Fuel cell vehicles (hydrogen powered)
 *
 * Credit amounts (2025):
 * - Base credit: $4,000
 * - Additional credit based on fuel economy
 * - Maximum credit varies by vehicle weight class
 *
 * Note: Must be new vehicle placed in service during the tax year.
 * Personal use vehicles go to Schedule 3, Line 6k.
 */

export interface FuelCellVehicle {
  vehicleDescription: string
  vin: string
  datePlacedInService: Date
  vehicleCost: number
  businessUsePercentage: number // 0-100
  fuelCellCredit: number // From manufacturer's certification
}

export default class F8910 extends F1040Attachment {
  sequenceIndex = 999
  tag: FormTag = 'f8910'

  isNeeded = (): boolean => {
    return this.fuelCellVehicles().length > 0
  }

  fuelCellVehicles = (): FuelCellVehicle[] => {
    return (
      (this.f1040.info.fuelCellVehicles as FuelCellVehicle[] | undefined) ?? []
    )
  }

  // Part I - Tentative Credit

  // Line 1: Year, make, model of vehicle
  l1Description = (): string => {
    const vehicles = this.fuelCellVehicles()
    if (vehicles.length === 0) return ''
    return vehicles[0].vehicleDescription
  }

  // Line 2: Vehicle identification number
  l2VIN = (): string => {
    const vehicles = this.fuelCellVehicles()
    if (vehicles.length === 0) return ''
    return vehicles[0].vin
  }

  // Line 3: Enter date vehicle was placed in service
  l3Date = (): string => {
    const vehicles = this.fuelCellVehicles()
    if (vehicles.length === 0) return ''
    return vehicles[0].datePlacedInService.toLocaleDateString()
  }

  // Line 4: Tentative credit (from manufacturer's certification)
  l4 = (): number => {
    return this.fuelCellVehicles().reduce((sum, v) => sum + v.fuelCellCredit, 0)
  }

  // Part II - Credit for Business/Investment Use Part of Vehicle

  // Line 5: Business/investment use percentage
  l5 = (): number => {
    const vehicles = this.fuelCellVehicles()
    if (vehicles.length === 0) return 0
    // Average business use percentage
    const totalPct = vehicles.reduce(
      (sum, v) => sum + v.businessUsePercentage,
      0
    )
    return Math.round(totalPct / vehicles.length)
  }

  // Line 6: Multiply line 4 by line 5 percentage
  l6 = (): number => Math.round(this.l4() * (this.l5() / 100))

  // Part III - Credit for Personal Use Part of Vehicle

  // Line 7: Subtract line 6 from line 4
  l7 = (): number => this.l4() - this.l6()

  // Line 8: Enter limitation based on tax liability (from Tax Liability Limit Worksheet)
  l8 = (): number => {
    // Simplified: limit to income tax minus certain credits
    const taxLiability = this.f1040.l16() ?? 0
    const foreignTaxCredit = this.f1040.schedule3.l1() ?? 0
    const childTaxCredit = this.f1040.schedule8812.l14() ?? 0
    return Math.max(0, taxLiability - foreignTaxCredit - childTaxCredit)
  }

  // Line 9: Enter smaller of line 7 or line 8
  l9 = (): number => Math.min(this.l7(), this.l8())

  // Part IV - Summary

  // Line 10: Business credit (from line 6) - goes to Form 3800
  l10 = (): number => this.l6()

  // Line 11: Personal credit (from line 9) - goes to Schedule 3, Line 6k
  l11 = (): number => this.l9()

  // Line 15: Credit carryforward from prior year
  l15 = (): number => this.f1040.info.fuelCellCreditCarryforward ?? 0

  // Total credit for personal use (Schedule 3, Line 6k)
  personalCredit = (): number => this.l11()

  // Total credit for business use (Form 3800)
  businessCredit = (): number => this.l10()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Part I
    this.l1Description(),
    this.l2VIN(),
    this.l3Date(),
    this.l4(),
    // Part II
    this.l5(),
    this.l6(),
    // Part III
    this.l7(),
    this.l8(),
    this.l9(),
    // Part IV
    this.l10(),
    this.l11(),
    this.l15()
  ]
}
