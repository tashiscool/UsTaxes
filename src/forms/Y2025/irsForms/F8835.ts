import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8835Data } from 'ustaxes/core/data'

/**
 * Form 8835 - Renewable Electricity Production Credit
 *
 * Credit for electricity produced from qualified renewable energy resources
 * and sold to an unrelated party.
 *
 * Qualified energy resources (IRC Section 45):
 * - Wind
 * - Closed-loop biomass
 * - Open-loop biomass
 * - Geothermal energy
 * - Solar energy (facilities placed in service before 2006)
 * - Small irrigation power
 * - Municipal solid waste (landfill gas and trash)
 * - Qualified hydropower
 * - Marine and hydrokinetic renewable energy
 *
 * Credit rates (2025, inflation-adjusted):
 * - Full rate: ~2.9 cents per kWh (wind, closed-loop biomass, geothermal)
 * - Half rate: ~1.45 cents per kWh (open-loop biomass, small irrigation,
 *   landfill gas, trash, hydropower, marine hydrokinetic)
 *
 * 10-year credit period from date facility placed in service.
 */

// 2025 credit rates per kWh (inflation-adjusted from 1992 base of 1.5 cents)
const renewableCreditRates = {
  fullRate: 0.029, // ~2.9 cents for wind, closed-loop biomass, geothermal
  halfRate: 0.0145 // ~1.45 cents for other qualifying facilities
}

export default class F8835 extends F1040Attachment {
  tag: FormTag = 'f8835'
  sequenceIndex = 100

  isNeeded = (): boolean => {
    return this.hasRenewableElectricityCredit()
  }

  hasRenewableElectricityCredit = (): boolean => {
    const data = this.creditData()
    return (
      data !== undefined &&
      (data.facilities.length > 0 || (data.passthrough8835Credit ?? 0) > 0)
    )
  }

  creditData = (): Form8835Data | undefined => {
    // Would need to add to Information interface
    return undefined
  }

  // Helper to determine if facility qualifies for full rate
  isFullRateFacility = (type: string): boolean => {
    return ['wind', 'closedLoopBiomass', 'geothermal'].includes(type)
  }

  // Part I - Electricity Produced at Qualified Facilities

  // Line 1: Kilowatt-hours produced and sold (full rate facilities)
  l1kWh = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.facilities
      .filter((f) => this.isFullRateFacility(f.facilityType))
      .reduce((sum, f) => sum + f.kilowattHoursProduced, 0)
  }

  l1Credit = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.facilities
      .filter((f) => this.isFullRateFacility(f.facilityType))
      .reduce((sum, f) => sum + f.creditAmount, 0)
  }

  // Line 2: Kilowatt-hours produced and sold (half rate facilities)
  l2kWh = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.facilities
      .filter((f) => !this.isFullRateFacility(f.facilityType))
      .reduce((sum, f) => sum + f.kilowattHoursProduced, 0)
  }

  l2Credit = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.facilities
      .filter((f) => !this.isFullRateFacility(f.facilityType))
      .reduce((sum, f) => sum + f.creditAmount, 0)
  }

  // Part II - Phaseout for Government Grants, Tax-Exempt Bonds, Subsidized Financing

  // Line 3: Government grants received
  l3 = (): number => 0 // Would reduce credit

  // Line 4: Tax-exempt bond financing
  l4 = (): number => 0 // Would reduce credit

  // Line 5: Subsidized energy financing
  l5 = (): number => 0 // Would reduce credit

  // Part III - Total Credit

  // Line 6: Add lines 1 and 2 credits
  l6 = (): number => this.l1Credit() + this.l2Credit()

  // Line 7: Reduction for government assistance (lines 3-5)
  l7 = (): number => 0

  // Line 8: Subtract line 7 from line 6
  l8 = (): number => Math.max(0, this.l6() - this.l7())

  // Line 9: Passthrough credit
  l9 = (): number => this.creditData()?.passthrough8835Credit ?? 0

  // Line 10: Total credit (add lines 8 and 9)
  l10 = (): number => this.l8() + this.l9()

  // Credit for Form 3800
  credit = (): number => this.creditData()?.totalCredit ?? this.l10()

  // Total kilowatt-hours
  totalKWh = (): number => this.l1kWh() + this.l2kWh()

  // Number of facilities
  numberOfFacilities = (): number => this.creditData()?.facilities.length ?? 0

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Full rate facilities
    this.l1kWh(),
    this.l1Credit(),
    // Half rate facilities
    this.l2kWh(),
    this.l2Credit(),
    // Reductions
    this.l3(),
    this.l4(),
    this.l5(),
    // Totals
    this.l6(),
    this.l7(),
    this.l8(),
    this.l9(),
    this.l10(),
    this.numberOfFacilities()
  ]
}
