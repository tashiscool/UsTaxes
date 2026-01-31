import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { FuelTaxCreditEntry, FuelType } from 'ustaxes/core/data'
import { fuelTaxRates } from '../data/federal'

/**
 * Form 4136 - Credit for Federal Tax Paid on Fuels
 *
 * Used to claim a credit for certain nontaxable uses of fuel,
 * exported fuels, and alternative fuel credits.
 *
 * IRC Section 34 - Certain uses of gasoline and special fuels
 * IRC Section 40A - Biodiesel and renewable diesel used as fuel
 * IRC Section 6426 - Credit for alcohol fuel, biodiesel, and alternative fuel mixtures
 * IRC Section 6427 - Fuels not used for taxable purposes
 *
 * Referenced by Schedule 3, Line 12
 */
export default class F4136 extends F1040Attachment {
  tag: FormTag = 'f4136'
  sequenceIndex = 23

  get fuelCredits(): FuelTaxCreditEntry[] {
    return this.f1040.info.fuelTaxCredits ?? []
  }

  isNeeded = (): boolean => this.fuelCredits.length > 0

  /**
   * Get the tax rate for a specific fuel type
   */
  private getRate(fuelType: FuelType, customRate?: number): number {
    if (customRate !== undefined) {
      return customRate
    }
    return fuelTaxRates[fuelType]
  }

  /**
   * Calculate credit for a specific fuel type
   */
  private creditForType(fuelType: FuelType): number {
    return this.fuelCredits
      .filter((entry) => entry.fuelType === fuelType)
      .reduce((total, entry) => {
        const rate = this.getRate(fuelType, entry.rate)
        return total + entry.gallons * rate
      }, 0)
  }

  /**
   * Get gallons for a specific fuel type
   */
  private gallonsForType(fuelType: FuelType): number {
    return this.fuelCredits
      .filter((entry) => entry.fuelType === fuelType)
      .reduce((total, entry) => total + entry.gallons, 0)
  }

  // Line 1 - Nontaxable Use of Gasoline
  l1Gallons = (): number => this.gallonsForType('nontaxableUseGasoline')
  l1Credit = (): number => this.creditForType('nontaxableUseGasoline')

  // Line 2 - Nontaxable Use of Aviation Gasoline
  l2Gallons = (): number => this.gallonsForType('nontaxableUseAviationGasoline')
  l2Credit = (): number => this.creditForType('nontaxableUseAviationGasoline')

  // Line 3 - Nontaxable Use of Undyed Diesel Fuel
  l3Gallons = (): number => this.gallonsForType('nontaxableUseUndyedDiesel')
  l3Credit = (): number => this.creditForType('nontaxableUseUndyedDiesel')

  // Line 4 - Nontaxable Use of Undyed Kerosene
  l4Gallons = (): number => this.gallonsForType('nontaxableUseUndyedKerosene')
  l4Credit = (): number => this.creditForType('nontaxableUseUndyedKerosene')

  // Line 5 - Kerosene Used in Aviation
  l5Gallons = (): number => this.gallonsForType('nontaxableUseKeroseneAviation')
  l5Credit = (): number => this.creditForType('nontaxableUseKeroseneAviation')

  // Line 6 - Exported Dyed Fuels
  l6aGallons = (): number => this.gallonsForType('exportedDyedDiesel')
  l6aCredit = (): number => this.creditForType('exportedDyedDiesel')
  l6bGallons = (): number => this.gallonsForType('exportedDyedKerosene')
  l6bCredit = (): number => this.creditForType('exportedDyedKerosene')

  // Line 7 - Biodiesel, Renewable Diesel, or Sustainable Aviation Fuel Mixture
  l7aGallons = (): number => this.gallonsForType('biodieselMixture')
  l7aCredit = (): number => this.creditForType('biodieselMixture')
  l7bGallons = (): number => this.gallonsForType('agribiodiesel')
  l7bCredit = (): number => this.creditForType('agribiodiesel')
  l7cGallons = (): number => this.gallonsForType('renewableDiesel')
  l7cCredit = (): number => this.creditForType('renewableDiesel')

  // Line 8 - Alternative Fuel Credit
  l8Gallons = (): number => this.gallonsForType('alternativeFuel')
  l8Credit = (): number => this.creditForType('alternativeFuel')

  // Line 9 - Alternative Fuel Mixture Credit
  l9Gallons = (): number => this.gallonsForType('alternativeFuelMixture')
  l9Credit = (): number => this.creditForType('alternativeFuelMixture')

  // Line 10 - CNG and LNG
  l10Gallons = (): number => this.gallonsForType('cngLng')
  l10Credit = (): number => this.creditForType('cngLng')

  // Line 11 - Liquefied Gas from Biomass
  l11Gallons = (): number => this.gallonsForType('liquefiedGasFromBiomass')
  l11Credit = (): number => this.creditForType('liquefiedGasFromBiomass')

  // Line 12 - Compressed Gas from Biomass
  l12Gallons = (): number => this.gallonsForType('compressedGasFromBiomass')
  l12Credit = (): number => this.creditForType('compressedGasFromBiomass')

  // Line 13 - Sustainable Aviation Fuel
  l13Gallons = (): number => this.gallonsForType('sustainableAviationFuel')
  l13Credit = (): number => this.creditForType('sustainableAviationFuel')

  /**
   * Total credit - sum of all line credits
   * This goes to Schedule 3, Line 12
   */
  totalCredit = (): number => {
    return Math.round(
      this.l1Credit() +
        this.l2Credit() +
        this.l3Credit() +
        this.l4Credit() +
        this.l5Credit() +
        this.l6aCredit() +
        this.l6bCredit() +
        this.l7aCredit() +
        this.l7bCredit() +
        this.l7cCredit() +
        this.l8Credit() +
        this.l9Credit() +
        this.l10Credit() +
        this.l11Credit() +
        this.l12Credit() +
        this.l13Credit()
    )
  }

  /**
   * Credit for Schedule 3 Line 12
   */
  credit = (): number | undefined => {
    const total = this.totalCredit()
    return total > 0 ? total : undefined
  }

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Line 1 - Nontaxable use of gasoline
    this.l1Gallons() || undefined,
    this.l1Credit() || undefined,
    // Line 2 - Aviation gasoline
    this.l2Gallons() || undefined,
    this.l2Credit() || undefined,
    // Line 3 - Undyed diesel
    this.l3Gallons() || undefined,
    this.l3Credit() || undefined,
    // Line 4 - Undyed kerosene
    this.l4Gallons() || undefined,
    this.l4Credit() || undefined,
    // Line 5 - Kerosene aviation
    this.l5Gallons() || undefined,
    this.l5Credit() || undefined,
    // Line 6 - Exported dyed fuels
    this.l6aGallons() || undefined,
    this.l6aCredit() || undefined,
    this.l6bGallons() || undefined,
    this.l6bCredit() || undefined,
    // Line 7 - Biodiesel/renewable
    this.l7aGallons() || undefined,
    this.l7aCredit() || undefined,
    this.l7bGallons() || undefined,
    this.l7bCredit() || undefined,
    this.l7cGallons() || undefined,
    this.l7cCredit() || undefined,
    // Line 8 - Alternative fuel
    this.l8Gallons() || undefined,
    this.l8Credit() || undefined,
    // Line 9 - Alternative fuel mixture
    this.l9Gallons() || undefined,
    this.l9Credit() || undefined,
    // Line 10 - CNG/LNG
    this.l10Gallons() || undefined,
    this.l10Credit() || undefined,
    // Line 11 - Liquefied gas biomass
    this.l11Gallons() || undefined,
    this.l11Credit() || undefined,
    // Line 12 - Compressed gas biomass
    this.l12Gallons() || undefined,
    this.l12Credit() || undefined,
    // Line 13 - SAF
    this.l13Gallons() || undefined,
    this.l13Credit() || undefined,
    // Total
    this.totalCredit() || undefined
  ]
}
