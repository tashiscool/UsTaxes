/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 5695 - Residential Energy Credits
 *
 * Two credits available:
 *
 * Part I - Residential Clean Energy Credit (Section 25D)
 * - 30% of qualified expenditures (no cap for most items)
 * - Solar electric, solar water heating, fuel cells, small wind, geothermal
 * - Battery storage systems (added by IRA)
 * - Carryforward allowed for amounts exceeding tax liability
 *
 * Part II - Energy Efficient Home Improvement Credit (Section 25C)
 * - 30% of qualified expenditures with annual limits
 * - $1,200 aggregate annual limit for most improvements
 * - $2,000 annual limit for heat pumps, heat pump water heaters, biomass stoves
 * - Total annual limit of $3,200 when both categories claimed
 *
 * 2025 Inflation Reduction Act (IRA) parameters
 */

// 2025 credit rates and limits
const energyCredits = {
  // Part I - Clean Energy Credit
  cleanEnergyCreditRate: 0.3, // 30% credit
  fuelCellPerKwLimit: 500, // $500 per 0.5 kW of capacity

  // Part II - Home Improvement Credit
  homeImprovementCreditRate: 0.3, // 30% credit
  aggregateAnnualLimit: 1200, // $1,200 per year for most items
  heatPumpAnnualLimit: 2000, // $2,000 per year for heat pumps
  totalAnnualLimit: 3200, // $3,200 total per year

  // Item-specific limits within the $1,200 aggregate
  windowsSkylightsLimit: 600, // $600 per year
  exteriorDoorsLimit: 500, // $500 per year ($250 per door)
  homeEnergyAuditLimit: 150 // $150 per year
}

export interface CleanEnergyProperty {
  type:
    | 'solarElectric'
    | 'solarWaterHeating'
    | 'fuelCell'
    | 'smallWind'
    | 'geothermal'
    | 'batteryStorage'
  cost: number
  dateInstalled: Date
  fuelCellKwCapacity?: number // For fuel cells, capacity in kW
}

export interface HomeImprovementProperty {
  type:
    | 'insulation'
    | 'exteriorDoors'
    | 'windowsSkylights'
    | 'centralAC'
    | 'electricPanel'
    | 'heatPump'
    | 'heatPumpWaterHeater'
    | 'biomassStove'
    | 'waterHeater'
    | 'furnace'
    | 'boiler'
    | 'homeEnergyAudit'
  cost: number
  dateInstalled: Date
  doorCount?: number // For exterior doors
}

export default class F5695 extends F1040Attachment {
  tag: FormTag = 'f5695'
  sequenceIndex = 152

  isNeeded = (): boolean => {
    return this.hasCleanEnergyProperty() || this.hasHomeImprovements()
  }

  hasCleanEnergyProperty = (): boolean => {
    return (this.cleanEnergyProperties().length ?? 0) > 0
  }

  hasHomeImprovements = (): boolean => {
    return (this.homeImprovements().length ?? 0) > 0
  }

  cleanEnergyProperties = (): CleanEnergyProperty[] => {
    return (
      (this.f1040.info.cleanEnergyProperties as
        | CleanEnergyProperty[]
        | undefined) ?? []
    )
  }

  homeImprovements = (): HomeImprovementProperty[] => {
    return (
      (this.f1040.info.homeImprovements as
        | HomeImprovementProperty[]
        | undefined) ?? []
    )
  }

  // Part I - Residential Clean Energy Credit

  // Line 1: Qualified solar electric property costs
  l1 = (): number => {
    return this.cleanEnergyProperties()
      .filter((p) => p.type === 'solarElectric')
      .reduce((sum, p) => sum + p.cost, 0)
  }

  // Line 2: Qualified solar water heating property costs
  l2 = (): number => {
    return this.cleanEnergyProperties()
      .filter((p) => p.type === 'solarWaterHeating')
      .reduce((sum, p) => sum + p.cost, 0)
  }

  // Line 3: Qualified fuel cell property costs
  l3 = (): number => {
    return this.cleanEnergyProperties()
      .filter((p) => p.type === 'fuelCell')
      .reduce((sum, p) => sum + p.cost, 0)
  }

  // Line 4: Qualified small wind energy property costs
  l4 = (): number => {
    return this.cleanEnergyProperties()
      .filter((p) => p.type === 'smallWind')
      .reduce((sum, p) => sum + p.cost, 0)
  }

  // Line 5: Qualified geothermal heat pump property costs
  l5 = (): number => {
    return this.cleanEnergyProperties()
      .filter((p) => p.type === 'geothermal')
      .reduce((sum, p) => sum + p.cost, 0)
  }

  // Line 5a: Qualified battery storage technology costs (added by IRA)
  l5a = (): number => {
    return this.cleanEnergyProperties()
      .filter((p) => p.type === 'batteryStorage')
      .reduce((sum, p) => sum + p.cost, 0)
  }

  // Line 6: Add lines 1-5a
  l6 = (): number => {
    return sumFields([
      this.l1(),
      this.l2(),
      this.l3(),
      this.l4(),
      this.l5(),
      this.l5a()
    ])
  }

  // Line 7: Multiply line 6 by 30%
  l7 = (): number => {
    return Math.round(this.l6() * energyCredits.cleanEnergyCreditRate)
  }

  // Line 8: Fuel cell credit limit (capacity × $500)
  l8 = (): number => {
    const fuelCells = this.cleanEnergyProperties().filter(
      (p) => p.type === 'fuelCell'
    )
    const totalKw = fuelCells.reduce(
      (sum, p) => sum + (p.fuelCellKwCapacity ?? 0),
      0
    )
    // $500 per 0.5 kW = $1,000 per kW
    return Math.round(totalKw * 1000)
  }

  // Line 9: Enter the smaller of line 7 or line 8 (for fuel cells only portion)
  l9 = (): number => {
    // This only applies to fuel cell portion of line 7
    const fuelCellCredit = Math.round(
      this.l3() * energyCredits.cleanEnergyCreditRate
    )
    const otherCredit = this.l7() - fuelCellCredit
    const limitedFuelCell = Math.min(fuelCellCredit, this.l8())
    return otherCredit + limitedFuelCell
  }

  // Line 10: Carryforward from prior year (simplified - user input)
  l10 = (): number => {
    return this.f1040.info.cleanEnergyCarryforward ?? 0
  }

  // Line 11: Add lines 9 and 10
  l11 = (): number => this.l9() + this.l10()

  // Line 12: Tax liability limitation
  l12 = (): number => {
    // Tax minus nonrefundable credits already claimed
    const tax = this.f1040.l18()
    const otherCredits = sumFields([
      this.f1040.schedule3.l1(),
      this.f1040.schedule3.l2(),
      this.f1040.schedule3.l3(),
      this.f1040.schedule3.l4()
    ])
    return Math.max(0, tax - otherCredits)
  }

  // Line 13: Residential Clean Energy Credit (smaller of 11 or 12)
  l13 = (): number => Math.min(this.l11(), this.l12())

  // Line 14: Carryforward to next year
  l14 = (): number => Math.max(0, this.l11() - this.l13())

  // Part II - Energy Efficient Home Improvement Credit

  // Line 15: Qualified energy efficiency improvements (insulation, doors, windows, etc.)

  // Line 15a: Insulation and air sealing materials
  l15a = (): number => {
    return this.homeImprovements()
      .filter((p) => p.type === 'insulation')
      .reduce((sum, p) => sum + p.cost, 0)
  }

  // Line 15b: Exterior doors
  l15b = (): number => {
    return this.homeImprovements()
      .filter((p) => p.type === 'exteriorDoors')
      .reduce((sum, p) => sum + p.cost, 0)
  }

  // Line 15c: Windows and skylights
  l15c = (): number => {
    return this.homeImprovements()
      .filter((p) => p.type === 'windowsSkylights')
      .reduce((sum, p) => sum + p.cost, 0)
  }

  // Line 15d: Add lines 15a through 15c
  l15d = (): number => sumFields([this.l15a(), this.l15b(), this.l15c()])

  // Line 16: Multiply line 15d by 30%
  l16 = (): number =>
    Math.round(this.l15d() * energyCredits.homeImprovementCreditRate)

  // Line 17: Apply annual limits for specific items
  l17 = (): number => {
    // Windows/skylights: $600 limit
    const windowsCredit = Math.round(
      this.l15c() * energyCredits.homeImprovementCreditRate
    )
    const windowsLimited = Math.min(
      windowsCredit,
      energyCredits.windowsSkylightsLimit
    )

    // Exterior doors: $500 limit
    const doorsCredit = Math.round(
      this.l15b() * energyCredits.homeImprovementCreditRate
    )
    const doorsLimited = Math.min(doorsCredit, energyCredits.exteriorDoorsLimit)

    // Insulation: no specific item limit
    const insulationCredit = Math.round(
      this.l15a() * energyCredits.homeImprovementCreditRate
    )

    return insulationCredit + windowsLimited + doorsLimited
  }

  // Line 18: Residential energy property expenditures (HVAC, water heaters, etc.)

  // Line 18a: Central air conditioners
  l18a = (): number => {
    return this.homeImprovements()
      .filter((p) => p.type === 'centralAC')
      .reduce((sum, p) => sum + p.cost, 0)
  }

  // Line 18b: Natural gas, propane, or oil water heater
  l18b = (): number => {
    return this.homeImprovements()
      .filter((p) => p.type === 'waterHeater')
      .reduce((sum, p) => sum + p.cost, 0)
  }

  // Line 18c: Natural gas, propane, or oil furnace or hot water boiler
  l18c = (): number => {
    return this.homeImprovements()
      .filter((p) => p.type === 'furnace' || p.type === 'boiler')
      .reduce((sum, p) => sum + p.cost, 0)
  }

  // Line 18d: Electric panel and related equipment
  l18d = (): number => {
    return this.homeImprovements()
      .filter((p) => p.type === 'electricPanel')
      .reduce((sum, p) => sum + p.cost, 0)
  }

  // Line 18e: Add lines 18a through 18d
  l18e = (): number =>
    sumFields([this.l18a(), this.l18b(), this.l18c(), this.l18d()])

  // Line 19: Multiply line 18e by 30%
  l19 = (): number =>
    Math.round(this.l18e() * energyCredits.homeImprovementCreditRate)

  // Line 20: Add lines 17 and 19
  l20 = (): number => this.l17() + this.l19()

  // Line 21: $1,200 aggregate limit
  l21 = (): number => Math.min(this.l20(), energyCredits.aggregateAnnualLimit)

  // Line 22: Heat pumps, heat pump water heaters, and biomass stoves

  // Line 22a: Electric or natural gas heat pump
  l22a = (): number => {
    return this.homeImprovements()
      .filter((p) => p.type === 'heatPump')
      .reduce((sum, p) => sum + p.cost, 0)
  }

  // Line 22b: Electric or natural gas heat pump water heater
  l22b = (): number => {
    return this.homeImprovements()
      .filter((p) => p.type === 'heatPumpWaterHeater')
      .reduce((sum, p) => sum + p.cost, 0)
  }

  // Line 22c: Biomass stove or boiler
  l22c = (): number => {
    return this.homeImprovements()
      .filter((p) => p.type === 'biomassStove')
      .reduce((sum, p) => sum + p.cost, 0)
  }

  // Line 22d: Add lines 22a through 22c
  l22d = (): number => sumFields([this.l22a(), this.l22b(), this.l22c()])

  // Line 23: Multiply line 22d by 30%
  l23 = (): number =>
    Math.round(this.l22d() * energyCredits.homeImprovementCreditRate)

  // Line 24: $2,000 annual limit for heat pumps
  l24 = (): number => Math.min(this.l23(), energyCredits.heatPumpAnnualLimit)

  // Line 25: Home energy audit costs
  l25 = (): number => {
    return this.homeImprovements()
      .filter((p) => p.type === 'homeEnergyAudit')
      .reduce((sum, p) => sum + p.cost, 0)
  }

  // Line 26: Multiply line 25 by 30%
  l26 = (): number =>
    Math.round(this.l25() * energyCredits.homeImprovementCreditRate)

  // Line 27: $150 limit for energy audit
  l27 = (): number => Math.min(this.l26(), energyCredits.homeEnergyAuditLimit)

  // Line 28: Add lines 21, 24, and 27
  l28 = (): number => sumFields([this.l21(), this.l24(), this.l27()])

  // Line 29: Total annual limit check ($3,200 max)
  l29 = (): number => Math.min(this.l28(), energyCredits.totalAnnualLimit)

  // Line 30: Energy Efficient Home Improvement Credit
  // Limited by tax liability after clean energy credit
  l30 = (): number => {
    const remainingTax = Math.max(0, this.l12() - this.l13())
    return Math.min(this.l29(), remainingTax)
  }

  // Summary methods for integration

  // Residential Clean Energy Credit (goes to Schedule 3 line 5)
  cleanEnergyCredit = (): number => this.l13()

  // Energy Efficient Home Improvement Credit (goes to Schedule 3 line 5)
  homeImprovementCredit = (): number => this.l30()

  // Total credit
  totalCredit = (): number => this.l13() + this.l30()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Part I - Clean Energy
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5(),
    this.l5a(),
    this.l6(),
    this.l7(),
    this.l8(),
    this.l9(),
    this.l10(),
    this.l11(),
    this.l12(),
    this.l13(),
    this.l14(),
    // Part II - Home Improvement
    this.l15a(),
    this.l15b(),
    this.l15c(),
    this.l15d(),
    this.l16(),
    this.l17(),
    this.l18a(),
    this.l18b(),
    this.l18c(),
    this.l18d(),
    this.l18e(),
    this.l19(),
    this.l20(),
    this.l21(),
    this.l22a(),
    this.l22b(),
    this.l22c(),
    this.l22d(),
    this.l23(),
    this.l24(),
    this.l25(),
    this.l26(),
    this.l27(),
    this.l28(),
    this.l29(),
    this.l30()
  ]
}
