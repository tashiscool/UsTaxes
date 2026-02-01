import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { FuelTaxCreditEntry, FuelType } from 'ustaxes/core/data'

/**
 * Form 4136 - Credit for Federal Tax Paid on Fuels
 *
 * Use this form to claim a credit for federal excise taxes paid on fuels
 * used for nontaxable purposes or exempt purposes.
 *
 * Common qualifying uses:
 * - Farming (off-highway use)
 * - Fishing vessels
 * - State and local government use
 * - Nonprofit educational organization use
 * - Export
 * - Aviation (non-commercial)
 *
 * The credit is claimed on Schedule 3, Line 13c.
 */

// 2025 credit rates per gallon
const FUEL_CREDIT_RATES: Record<FuelType, number> = {
  nontaxableUseGasoline: 0.183,
  nontaxableUseAviationGasoline: 0.194,
  nontaxableUseUndyedDiesel: 0.243,
  nontaxableUseUndyedKerosene: 0.243,
  nontaxableUseKeroseneAviation: 0.219,
  exportedDyedFuels: 0.184,
  exportedDyedDiesel: 0.244,
  exportedDyedKerosene: 0.244,
  biodieselMixture: 1.0,
  agribiodiesel: 1.0,
  renewableDiesel: 1.0,
  alternativeFuel: 0.5,
  alternativeFuelMixture: 0.5,
  cngLng: 0.5,
  liquefiedGasFromBiomass: 0.5,
  compressedGasFromBiomass: 0.5,
  sustainableAviationFuel: 1.25 // SAF credit per gallon
}

export default class F4136 extends F1040Attachment {
  tag: FormTag = 'f4136'
  sequenceIndex = 23

  isNeeded = (): boolean => {
    return this.fuelTaxCredits().length > 0
  }

  fuelTaxCredits = (): FuelTaxCreditEntry[] => {
    return this.f1040.info.fuelTaxCredits ?? []
  }

  // Calculate credit for a specific entry
  private calculateCredit(entry: FuelTaxCreditEntry): number {
    const rate = entry.rate ?? FUEL_CREDIT_RATES[entry.fuelType] ?? 0
    return Math.round(entry.gallons * rate * 100) / 100
  }

  // Line 1: Nontaxable Use of Gasoline
  l1Gallons = (): number => {
    return this.fuelTaxCredits()
      .filter((e) => e.fuelType === 'nontaxableUseGasoline')
      .reduce((sum, e) => sum + e.gallons, 0)
  }

  l1Credit = (): number => {
    return this.fuelTaxCredits()
      .filter((e) => e.fuelType === 'nontaxableUseGasoline')
      .reduce((sum, e) => sum + this.calculateCredit(e), 0)
  }

  // Line 2: Nontaxable Use of Aviation Gasoline
  l2Gallons = (): number => {
    return this.fuelTaxCredits()
      .filter((e) => e.fuelType === 'nontaxableUseAviationGasoline')
      .reduce((sum, e) => sum + e.gallons, 0)
  }

  l2Credit = (): number => {
    return this.fuelTaxCredits()
      .filter((e) => e.fuelType === 'nontaxableUseAviationGasoline')
      .reduce((sum, e) => sum + this.calculateCredit(e), 0)
  }

  // Line 3: Nontaxable Use of Undyed Diesel Fuel
  l3Gallons = (): number => {
    return this.fuelTaxCredits()
      .filter((e) => e.fuelType === 'nontaxableUseUndyedDiesel')
      .reduce((sum, e) => sum + e.gallons, 0)
  }

  l3Credit = (): number => {
    return this.fuelTaxCredits()
      .filter((e) => e.fuelType === 'nontaxableUseUndyedDiesel')
      .reduce((sum, e) => sum + this.calculateCredit(e), 0)
  }

  // Line 4: Nontaxable Use of Undyed Kerosene
  l4Gallons = (): number => {
    return this.fuelTaxCredits()
      .filter((e) => e.fuelType === 'nontaxableUseUndyedKerosene')
      .reduce((sum, e) => sum + e.gallons, 0)
  }

  l4Credit = (): number => {
    return this.fuelTaxCredits()
      .filter((e) => e.fuelType === 'nontaxableUseUndyedKerosene')
      .reduce((sum, e) => sum + this.calculateCredit(e), 0)
  }

  // Line 5: Kerosene Used in Aviation
  l5Gallons = (): number => {
    return this.fuelTaxCredits()
      .filter((e) => e.fuelType === 'nontaxableUseKeroseneAviation')
      .reduce((sum, e) => sum + e.gallons, 0)
  }

  l5Credit = (): number => {
    return this.fuelTaxCredits()
      .filter((e) => e.fuelType === 'nontaxableUseKeroseneAviation')
      .reduce((sum, e) => sum + this.calculateCredit(e), 0)
  }

  // Line 8: Biodiesel or Renewable Diesel Mixture Credit
  l8Gallons = (): number => {
    const biodieselTypes: FuelType[] = [
      'biodieselMixture',
      'agribiodiesel',
      'renewableDiesel'
    ]
    return this.fuelTaxCredits()
      .filter((e) => biodieselTypes.includes(e.fuelType))
      .reduce((sum, e) => sum + e.gallons, 0)
  }

  l8Credit = (): number => {
    const biodieselTypes: FuelType[] = [
      'biodieselMixture',
      'agribiodiesel',
      'renewableDiesel'
    ]
    return this.fuelTaxCredits()
      .filter((e) => biodieselTypes.includes(e.fuelType))
      .reduce((sum, e) => sum + this.calculateCredit(e), 0)
  }

  // Line 9: Alternative Fuel Credit
  l9Gallons = (): number => {
    const altFuelTypes: FuelType[] = [
      'alternativeFuel',
      'alternativeFuelMixture',
      'cngLng',
      'liquefiedGasFromBiomass'
    ]
    return this.fuelTaxCredits()
      .filter((e) => altFuelTypes.includes(e.fuelType))
      .reduce((sum, e) => sum + e.gallons, 0)
  }

  l9Credit = (): number => {
    const altFuelTypes: FuelType[] = [
      'alternativeFuel',
      'alternativeFuelMixture',
      'cngLng',
      'liquefiedGasFromBiomass'
    ]
    return this.fuelTaxCredits()
      .filter((e) => altFuelTypes.includes(e.fuelType))
      .reduce((sum, e) => sum + this.calculateCredit(e), 0)
  }

  // Line 17: Total (all credits combined)
  l17 = (): number => {
    return sumFields([
      this.l1Credit(),
      this.l2Credit(),
      this.l3Credit(),
      this.l4Credit(),
      this.l5Credit(),
      this.l8Credit(),
      this.l9Credit()
    ])
  }

  // Credit for Schedule 3, Line 13c
  credit = (): number => this.l17()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Line 1 - Gasoline
    this.l1Gallons(),
    this.l1Credit(),
    // Line 2 - Aviation gasoline
    this.l2Gallons(),
    this.l2Credit(),
    // Line 3 - Diesel
    this.l3Gallons(),
    this.l3Credit(),
    // Line 4 - Kerosene
    this.l4Gallons(),
    this.l4Credit(),
    // Line 5 - Kerosene aviation
    this.l5Gallons(),
    this.l5Credit(),
    // Line 8 - Biodiesel
    this.l8Gallons(),
    this.l8Credit(),
    // Line 9 - Alternative fuel
    this.l9Gallons(),
    this.l9Credit(),
    // Line 17 - Total
    this.l17()
  ]
}
