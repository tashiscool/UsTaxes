import { BusinessForm } from './BusinessForm'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form2290Data, BusinessEntity, HeavyVehicle } from 'ustaxes/core/data'

/**
 * Form 2290 - Heavy Highway Vehicle Use Tax Return
 *
 * Annual tax on heavy highway motor vehicles (55,000+ pounds).
 * The tax helps fund highway construction and maintenance.
 *
 * Tax period: July 1 - June 30 (following year)
 * Due: Last day of month following first use month
 *   - July first use = August 31 deadline
 *
 * 2025 Tax rates by weight category:
 * - 55,000-75,000 lbs: $100-$550 (graduated)
 * - Over 75,000 lbs: $550 max
 * - Logging vehicles: 75% of regular tax
 * - Suspended vehicles (<5,000 miles, <7,500 ag): $0
 *
 * Electronic filing required if 25+ vehicles
 */

// Tax table for 2025 (annual amounts)
const TAX_TABLE: Record<string, number> = {
  'A': 0,      // 55,000 lbs (suspended)
  'B': 0,      // Logging suspended
  'C': 100,    // 55,001-56,000 lbs
  'D': 122,    // 56,001-57,000 lbs
  'E': 144,    // 57,001-58,000 lbs
  'F': 166,    // 58,001-59,000 lbs
  'G': 188,    // 59,001-60,000 lbs
  'H': 210,    // 60,001-61,000 lbs
  'I': 232,    // 61,001-62,000 lbs
  'J': 254,    // 62,001-63,000 lbs
  'K': 276,    // 63,001-64,000 lbs
  'L': 298,    // 64,001-65,000 lbs
  'M': 320,    // 65,001-66,000 lbs
  'N': 342,    // 66,001-67,000 lbs
  'O': 364,    // 67,001-68,000 lbs
  'P': 386,    // 68,001-69,000 lbs
  'Q': 408,    // 69,001-70,000 lbs
  'R': 430,    // 70,001-71,000 lbs
  'S': 452,    // 71,001-72,000 lbs
  'T': 474,    // 72,001-73,000 lbs
  'U': 496,    // 73,001-74,000 lbs
  'V': 550     // 75,001+ lbs
}

export default class F2290 extends BusinessForm {
  tag: FormTag = 'f2290'
  sequenceIndex = 0

  formData: Form2290Data

  constructor(data: Form2290Data) {
    super()
    this.formData = data
  }

  get entityData(): BusinessEntity {
    return this.formData.entity
  }

  vehicles = (): HeavyVehicle[] => this.formData.vehicles
  taxPeriod = (): string => this.formData.taxPeriod
  taxYear = (): number => this.formData.taxYear

  // Part I - Figuring the Tax

  // Line 1: Taxable vehicles
  taxableVehicles = (): HeavyVehicle[] => {
    return this.vehicles().filter(v => !v.suspended)
  }

  // Line 2: Total number of taxable vehicles
  l2 = (): number => this.formData.totalTaxableVehicles

  // Suspended vehicles (mileage under limit)
  suspendedVehicles = (): HeavyVehicle[] => {
    return this.vehicles().filter(v => v.suspended)
  }

  // Line 3: Total number of suspended vehicles
  l3 = (): number => this.formData.totalSuspendedVehicles

  // Calculate tax for a single vehicle
  calculateVehicleTax = (vehicle: HeavyVehicle): number => {
    if (vehicle.suspended) return 0

    const baseTax = TAX_TABLE[vehicle.categoryLetter] ?? 550

    // Prorate for partial year (first use month)
    const monthsRemaining = 12 - vehicle.firstUseMonth + 1
    const proratedTax = Math.round((baseTax * monthsRemaining / 12) * 100) / 100

    // Logging vehicles get 75% rate
    if (vehicle.loggingUse) {
      return Math.round(proratedTax * 0.75 * 100) / 100
    }

    return proratedTax
  }

  // Line 4: Tax from vehicles
  l4 = (): number => {
    return this.taxableVehicles().reduce((sum, v) => sum + this.calculateVehicleTax(v), 0)
  }

  // Line 5: Additional tax from increase in taxable gross weight
  l5 = (): number => 0  // For weight increases during the year

  // Line 6: Total tax (line 4 + line 5)
  l6 = (): number => this.l4() + this.l5()

  // Part II - Credits

  // Line 7: Credit for tax paid on vehicles sold, destroyed, or stolen
  l7 = (): number => this.formData.creditForVehiclesSold

  // Line 8: Credit for low-mileage vehicles
  l8 = (): number => this.formData.creditForLowMileage

  // Line 9: Credit from prior year overpayment
  l9 = (): number => this.formData.priorYearCredit ?? 0

  // Line 10: Total credits (lines 7 + 8 + 9)
  l10 = (): number => this.l7() + this.l8() + this.l9()

  // Part III - Tax Due or Refund

  // Line 11: Tax due (line 6 - line 10, if positive)
  l11 = (): number => Math.max(0, this.l6() - this.l10())

  // Line 12: Refund (line 10 - line 6, if positive)
  l12 = (): number => Math.max(0, this.l10() - this.l6())

  // Total tax
  totalTax = (): number => this.formData.totalTax
  amountDue = (): number => this.formData.amountDue

  // Electronic filing required?
  requiresElectronicFiling = (): boolean => this.formData.electronicFilingRequired

  // Get weight category letter based on gross weight
  static getWeightCategory(grossWeight: number): string {
    if (grossWeight <= 55000) return 'A'
    if (grossWeight <= 56000) return 'C'
    if (grossWeight <= 57000) return 'D'
    if (grossWeight <= 58000) return 'E'
    if (grossWeight <= 59000) return 'F'
    if (grossWeight <= 60000) return 'G'
    if (grossWeight <= 61000) return 'H'
    if (grossWeight <= 62000) return 'I'
    if (grossWeight <= 63000) return 'J'
    if (grossWeight <= 64000) return 'K'
    if (grossWeight <= 65000) return 'L'
    if (grossWeight <= 66000) return 'M'
    if (grossWeight <= 67000) return 'N'
    if (grossWeight <= 68000) return 'O'
    if (grossWeight <= 69000) return 'P'
    if (grossWeight <= 70000) return 'Q'
    if (grossWeight <= 71000) return 'R'
    if (grossWeight <= 72000) return 'S'
    if (grossWeight <= 73000) return 'T'
    if (grossWeight <= 74000) return 'U'
    return 'V'  // 75,001+ lbs
  }

  fields = (): Field[] => [
    this.entityName(),
    this.ein(),
    this.address(),
    this.addressLine(),
    this.taxPeriod(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5(),
    this.l6(),
    this.l7(),
    this.l8(),
    this.l9(),
    this.l10(),
    this.l11(),
    this.l12(),
    this.requiresElectronicFiling()
  ]
}
