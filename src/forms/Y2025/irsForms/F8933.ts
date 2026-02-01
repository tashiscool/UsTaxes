import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8933Data } from 'ustaxes/core/data'

/**
 * Form 8933 - Carbon Oxide Sequestration Credit
 *
 * Credit for capturing and sequestering qualified carbon oxide
 * from qualified industrial facilities or direct air capture facilities.
 *
 * Credit rates (2025, inflation-adjusted from IRA base):
 * - Geologic storage: ~$85 per metric ton (base $85)
 * - Enhanced oil recovery: ~$60 per metric ton (base $60)
 * - Utilization: ~$60 per metric ton (base $60)
 *
 * Credit enhancements (Inflation Reduction Act):
 * - 5x multiplier for meeting prevailing wage and apprenticeship requirements
 * - Without requirements: ~$17/$12/$12 per metric ton
 *
 * Facility requirements:
 * - Industrial facility: captures 12,500+ metric tons/year (electric) or 25,000+ (other)
 * - Direct air capture: captures 1,000+ metric tons/year
 *
 * 12-year credit period begins at facility placed in service date.
 */

// 2025 credit rates (base rates, inflation-adjusted)
const carbonCreditRates = {
  geologicStorage: 85, // $ per metric ton
  enhancedOilRecovery: 60, // $ per metric ton
  utilization: 60, // $ per metric ton
  // Without prevailing wage/apprenticeship (base / 5)
  baseGeologicStorage: 17,
  baseEnhancedOilRecovery: 12,
  baseUtilization: 12
}

export default class F8933 extends F1040Attachment {
  tag: FormTag = 'f8933'
  sequenceIndex = 165

  isNeeded = (): boolean => {
    return this.hasCarbonSequestrationCredit()
  }

  hasCarbonSequestrationCredit = (): boolean => {
    const data = this.creditData()
    return (
      data !== undefined &&
      (data.facilities.length > 0 || (data.passthrough8933Credit ?? 0) > 0)
    )
  }

  creditData = (): Form8933Data | undefined => {
    // Would need to add to Information interface
    return undefined
  }

  // Part I - Qualified Carbon Oxide Captured and Disposed

  // Line 1: Geologic storage
  l1Tons = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.facilities
      .filter((f) => f.disposalMethod === 'geologicStorage')
      .reduce((sum, f) => sum + f.metricTonsCaptured, 0)
  }

  l1Credit = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.facilities
      .filter((f) => f.disposalMethod === 'geologicStorage')
      .reduce((sum, f) => sum + f.creditAmount, 0)
  }

  // Line 2: Enhanced oil recovery
  l2Tons = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.facilities
      .filter((f) => f.disposalMethod === 'enhancedOilRecovery')
      .reduce((sum, f) => sum + f.metricTonsCaptured, 0)
  }

  l2Credit = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.facilities
      .filter((f) => f.disposalMethod === 'enhancedOilRecovery')
      .reduce((sum, f) => sum + f.creditAmount, 0)
  }

  // Line 3: Utilization
  l3Tons = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.facilities
      .filter((f) => f.disposalMethod === 'utilization')
      .reduce((sum, f) => sum + f.metricTonsCaptured, 0)
  }

  l3Credit = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.facilities
      .filter((f) => f.disposalMethod === 'utilization')
      .reduce((sum, f) => sum + f.creditAmount, 0)
  }

  // Part II - Total Credit

  // Line 4: Add credits from lines 1-3
  l4 = (): number => this.l1Credit() + this.l2Credit() + this.l3Credit()

  // Line 5: Credit from partnerships, S corps, etc.
  l5 = (): number => this.creditData()?.passthrough8933Credit ?? 0

  // Line 6: Total credit (add lines 4 and 5)
  l6 = (): number => this.l4() + this.l5()

  // Credit for Form 3800
  credit = (): number => this.creditData()?.totalCredit ?? this.l6()

  // Total metric tons captured
  totalMetricTons = (): number => this.l1Tons() + this.l2Tons() + this.l3Tons()

  // Number of facilities
  numberOfFacilities = (): number => this.creditData()?.facilities.length ?? 0

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Geologic storage
    this.l1Tons(),
    this.l1Credit(),
    // Enhanced oil recovery
    this.l2Tons(),
    this.l2Credit(),
    // Utilization
    this.l3Tons(),
    this.l3Credit(),
    // Totals
    this.l4(),
    this.l5(),
    this.l6(),
    this.numberOfFacilities()
  ]
}
