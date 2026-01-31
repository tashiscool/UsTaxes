import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form3468Data } from 'ustaxes/core/data'

/**
 * Form 3468 - Investment Credit
 *
 * Credit for investments in rehabilitation of historic structures
 * and energy property.
 *
 * Rehabilitation Credit:
 * - 20% for certified historic structures
 * - Must be substantial rehabilitation
 * - Building must be depreciable
 *
 * Energy Credit (Inflation Reduction Act enhancements):
 * - Solar: 30% (6% base + prevailing wage/apprenticeship bonus)
 * - Geothermal: 30%
 * - Fuel cells: 30%
 * - Microturbines: 30%
 * - CHP (combined heat & power): 30%
 * - Small wind: 30%
 * - Offshore wind: 30%
 * - Geothermal heat pumps: 30%
 * - Waste energy recovery: 30%
 *
 * Bonus credits available for:
 * - Energy communities: +10%
 * - Domestic content: +10%
 * - Low-income communities: up to +20%
 */

// 2025 credit rates
const investmentCreditRates = {
  // Rehabilitation
  historicRehab: 0.20,          // 20% for certified historic structures
  // Energy - with prevailing wage/apprenticeship
  solarWithBonus: 0.30,
  geothermalWithBonus: 0.30,
  fuelCellWithBonus: 0.30,
  microturbineWithBonus: 0.30,
  chpWithBonus: 0.30,
  smallWindWithBonus: 0.30,
  offshoreWindWithBonus: 0.30,
  geothermalHeatPumpWithBonus: 0.30,
  wasteEnergyWithBonus: 0.30,
  // Energy - base rates (without prevailing wage/apprenticeship)
  solarBase: 0.06,
  geothermalBase: 0.06,
  fuelCellBase: 0.06,
  microturbineBase: 0.06,
  chpBase: 0.06,
  smallWindBase: 0.06,
  offshoreWindBase: 0.06,
  geothermalHeatPumpBase: 0.06,
  wasteEnergyBase: 0.06
}

export default class F3468 extends F1040Attachment {
  tag: FormTag = 'f3468'
  sequenceIndex = 52

  isNeeded = (): boolean => {
    return this.hasInvestmentCredit()
  }

  hasInvestmentCredit = (): boolean => {
    const data = this.creditData()
    return data !== undefined && (
      data.rehabilitatedBuildings.length > 0 ||
      data.energyProperty.length > 0 ||
      (data.advancedEnergyProjectCredit ?? 0) > 0 ||
      (data.passthrough3468Credit ?? 0) > 0
    )
  }

  creditData = (): Form3468Data | undefined => {
    // Would need to add to Information interface
    return undefined
  }

  // Part I - Rehabilitation Credit

  // Line 1: Certified historic structures
  l1Basis = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.rehabilitatedBuildings.reduce((sum, b) => sum + b.qualifiedRehabilitationExpenditures, 0)
  }

  l1Credit = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.rehabilitatedBuildings.reduce((sum, b) => sum + b.creditAmount, 0)
  }

  // Part II - Energy Credit

  // Line 2: Solar energy property
  l2Basis = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.energyProperty
      .filter(p => p.propertyType === 'solar')
      .reduce((sum, p) => sum + p.basisForCredit, 0)
  }

  l2Credit = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.energyProperty
      .filter(p => p.propertyType === 'solar')
      .reduce((sum, p) => sum + p.creditAmount, 0)
  }

  // Line 3: Geothermal property
  l3Basis = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.energyProperty
      .filter(p => p.propertyType === 'geothermal')
      .reduce((sum, p) => sum + p.basisForCredit, 0)
  }

  l3Credit = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.energyProperty
      .filter(p => p.propertyType === 'geothermal')
      .reduce((sum, p) => sum + p.creditAmount, 0)
  }

  // Line 4: Fuel cell property
  l4Basis = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.energyProperty
      .filter(p => p.propertyType === 'fuelCell')
      .reduce((sum, p) => sum + p.basisForCredit, 0)
  }

  l4Credit = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.energyProperty
      .filter(p => p.propertyType === 'fuelCell')
      .reduce((sum, p) => sum + p.creditAmount, 0)
  }

  // Line 5: All other energy property
  l5Basis = (): number => {
    const data = this.creditData()
    if (!data) return 0
    const otherTypes = ['microturbine', 'chp', 'smallWind', 'offshoreWind', 'geothermalHeatPump', 'wasteEnergyRecovery']
    return data.energyProperty
      .filter(p => otherTypes.includes(p.propertyType))
      .reduce((sum, p) => sum + p.basisForCredit, 0)
  }

  l5Credit = (): number => {
    const data = this.creditData()
    if (!data) return 0
    const otherTypes = ['microturbine', 'chp', 'smallWind', 'offshoreWind', 'geothermalHeatPump', 'wasteEnergyRecovery']
    return data.energyProperty
      .filter(p => otherTypes.includes(p.propertyType))
      .reduce((sum, p) => sum + p.creditAmount, 0)
  }

  // Part III - Summary

  // Line 6: Total rehabilitation credit
  totalRehabCredit = (): number => this.l1Credit()

  // Line 7: Total energy credit
  totalEnergyCredit = (): number => this.l2Credit() + this.l3Credit() + this.l4Credit() + this.l5Credit()

  // Line 8: Advanced energy project credit
  l8 = (): number => this.creditData()?.advancedEnergyProjectCredit ?? 0

  // Line 9: Passthrough investment credit
  l9 = (): number => this.creditData()?.passthrough3468Credit ?? 0

  // Line 10: Total investment credit
  l10 = (): number => this.totalRehabCredit() + this.totalEnergyCredit() + this.l8() + this.l9()

  // Credit for Form 3800
  credit = (): number => this.creditData()?.totalCredit ?? this.l10()

  // Total basis
  totalBasis = (): number => this.l1Basis() + this.l2Basis() + this.l3Basis() + this.l4Basis() + this.l5Basis()

  // Number of properties
  numberOfProperties = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.rehabilitatedBuildings.length + data.energyProperty.length
  }

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson?.ssid,
    // Rehabilitation
    this.l1Basis(),
    this.l1Credit(),
    // Solar
    this.l2Basis(),
    this.l2Credit(),
    // Geothermal
    this.l3Basis(),
    this.l3Credit(),
    // Fuel cell
    this.l4Basis(),
    this.l4Credit(),
    // Other energy
    this.l5Basis(),
    this.l5Credit(),
    // Totals
    this.totalRehabCredit(),
    this.totalEnergyCredit(),
    this.l8(),
    this.l9(),
    this.l10()
  ]
}
