import F1040Attachment from './F1040Attachment'
import { PersonRole } from 'ustaxes/core/data'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { Field } from 'ustaxes/core/pdfFiller'

/**
 * Form 2106 - Employee Business Expenses
 *
 * Note: Under TCJA (2018-2025), unreimbursed employee business expenses
 * are NO LONGER deductible for most taxpayers. Form 2106 is only used by:
 *
 * 1. Armed Forces reservists
 * 2. Qualified performing artists
 * 3. Fee-basis state or local government officials
 * 4. Employees with impairment-related work expenses
 *
 * For these eligible taxpayers, expenses are claimed on Schedule 1, line 12
 * (not as itemized deductions subject to 2% AGI floor).
 *
 * Vehicle expense methods:
 * - Standard mileage rate: 67 cents per mile for 2025
 * - Actual expense method: Depreciation, gas, insurance, repairs, etc.
 */

// 2025 Standard mileage rate for business use
const STANDARD_MILEAGE_RATE = 0.67 // 67 cents per mile

// 2025 Depreciation limits for luxury vehicles (Section 280F)
const DEPRECIATION_LIMITS = {
  year1: 12200, // First year limit
  year2: 19500, // Second year limit
  year3: 11700, // Third year limit
  year4Plus: 6960 // Fourth and subsequent years
}

export type VehicleExpenseMethod = 'standard' | 'actual'

export interface VehicleInfo {
  dateFirstUsed: Date
  totalMiles: number
  businessMiles: number
  commutingMiles: number
  otherMiles: number
  availableForPersonalUse: boolean
  evidenceToSupportDeduction: boolean
  writtenEvidenceSupport: boolean
  vehicleUsedForAnotherJob: boolean
}

export interface ActualVehicleExpenses {
  gasoline: number
  oilChanges: number
  repairs: number
  insurance: number
  vehicleRentals: number
  licenses: number
  depreciation: number
  garageRent: number
  tires: number
  tolls: number
  parking: number
  otherExpenses: number
}

export interface EmployeeBusinessExpenses {
  // Eligibility category
  eligibleCategory: 'reservist' | 'performer' | 'government' | 'impairment'

  // Vehicle information (up to 2 vehicles)
  vehicles: VehicleInfo[]
  vehicleExpenseMethod: VehicleExpenseMethod

  // Actual vehicle expenses (if using actual method)
  actualExpenses?: ActualVehicleExpenses

  // Part I: Employee Business Expenses
  vehicleExpenses: number // Line 1
  parkingTollsTransportation: number // Line 2
  travelExpenses: number // Line 3
  otherBusinessExpenses: number // Line 4 (meals at 50%)
  otherExpensesDescription: string

  // Reimbursements
  reimbursementsNotIncludedInW2: number // Line 7 (substantiated)
  reimbursementsIncludedInW2: number // From W-2 box 12 code L
}

export default class F2106 extends F1040Attachment {
  tag: FormTag = 'f2106'
  sequenceIndex = 129 // Sequence number for Form 2106

  isNeeded = (): boolean => {
    return this.isEligible() && this.totalExpenses() > 0
  }

  expenseInfo = (): EmployeeBusinessExpenses | undefined => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    return (this.f1040.info as any).employeeBusinessExpenses as
      | EmployeeBusinessExpenses
      | undefined
  }

  // Check if taxpayer is in an eligible category
  isEligible = (): boolean => {
    const info = this.expenseInfo()
    if (!info) return false

    // Only these categories can deduct under TCJA
    const eligibleCategories = [
      'reservist',
      'performer',
      'government',
      'impairment'
    ]
    return eligibleCategories.includes(info.eligibleCategory)
  }

  // Get eligibility category description
  eligibilityDescription = (): string => {
    const info = this.expenseInfo()
    switch (info?.eligibleCategory) {
      case 'reservist':
        return 'Armed Forces reservist'
      case 'performer':
        return 'Qualified performing artist'
      case 'government':
        return 'Fee-basis state/local government official'
      case 'impairment':
        return 'Employee with impairment-related work expenses'
      default:
        return ''
    }
  }

  // ============================================================================
  // Part I - Employee Business Expenses
  // ============================================================================

  // Line 1: Vehicle expenses (from Part II or standard mileage)
  l1 = (): number => {
    const info = this.expenseInfo()
    if (!info) return 0

    if (info.vehicleExpenseMethod === 'standard') {
      return this.standardMileageDeduction()
    }

    return info.vehicleExpenses
  }

  // Line 2: Parking fees, tolls, and transportation
  l2 = (): number => this.expenseInfo()?.parkingTollsTransportation ?? 0

  // Line 3: Travel expenses while away from home
  // Includes lodging, transportation (not meals)
  l3 = (): number => this.expenseInfo()?.travelExpenses ?? 0

  // Line 4: Business expenses not included above
  // Meals are 50% deductible
  l4 = (): number => {
    const otherExpenses = this.expenseInfo()?.otherBusinessExpenses ?? 0
    // Apply 50% limitation to meal expenses
    return Math.round(otherExpenses * 0.5)
  }

  // Line 5: Total expenses (add lines 1-4)
  l5 = (): number => sumFields([this.l1(), this.l2(), this.l3(), this.l4()])

  // Line 6: Reimbursements from employer included in W-2 box 1
  l6 = (): number => this.expenseInfo()?.reimbursementsIncludedInW2 ?? 0

  // Line 7: Substantiated reimbursements NOT included in W-2
  l7 = (): number => this.expenseInfo()?.reimbursementsNotIncludedInW2 ?? 0

  // Line 8: Total reimbursements (line 6 + line 7)
  l8 = (): number => this.l6() + this.l7()

  // Line 9: Expenses subject to 2% AGI limitation (pre-TCJA logic)
  // Under TCJA, this goes to Schedule 1 for eligible categories
  l9 = (): number => Math.max(0, this.l5() - this.l8())

  // Line 10: Unreimbursed employee business expenses
  // This amount goes to Schedule 1, line 12
  l10 = (): number => this.l9()

  totalExpenses = (): number => this.l5()

  // ============================================================================
  // Part II - Vehicle Expenses
  // ============================================================================

  // Get vehicle info for a specific vehicle (0 or 1)
  vehicle = (index: number): VehicleInfo | undefined => {
    return this.expenseInfo()?.vehicles[index]
  }

  // Calculate standard mileage deduction
  standardMileageDeduction = (): number => {
    const vehicles = this.expenseInfo()?.vehicles ?? []
    let totalBusinessMiles = 0

    for (const vehicle of vehicles) {
      totalBusinessMiles += vehicle.businessMiles
    }

    return Math.round(totalBusinessMiles * STANDARD_MILEAGE_RATE)
  }

  // Calculate business use percentage for a vehicle
  businessUsePercentage = (vehicleIndex: number): number => {
    const vehicle = this.vehicle(vehicleIndex)
    if (!vehicle || vehicle.totalMiles === 0) return 0

    return Math.round((vehicle.businessMiles / vehicle.totalMiles) * 100)
  }

  // Section A: General vehicle information
  vehicleDatePlacedInService = (index: number): Date | undefined => {
    return this.vehicle(index)?.dateFirstUsed
  }

  vehicleTotalMiles = (index: number): number => {
    return this.vehicle(index)?.totalMiles ?? 0
  }

  vehicleBusinessMiles = (index: number): number => {
    return this.vehicle(index)?.businessMiles ?? 0
  }

  vehicleCommutingMiles = (index: number): number => {
    return this.vehicle(index)?.commutingMiles ?? 0
  }

  vehicleOtherMiles = (index: number): number => {
    return this.vehicle(index)?.otherMiles ?? 0
  }

  // Section B: Standard Mileage Rate
  standardMileageRate = (): number => STANDARD_MILEAGE_RATE

  // Line 22a: Business miles (for standard mileage)
  l22a = (vehicleIndex: number): number => {
    return this.vehicle(vehicleIndex)?.businessMiles ?? 0
  }

  // Line 22b: Standard mileage rate
  l22b = (): number => STANDARD_MILEAGE_RATE

  // Line 22c: Standard mileage deduction (22a x 22b)
  l22c = (vehicleIndex: number): number => {
    return Math.round(this.l22a(vehicleIndex) * this.l22b())
  }

  // Section C: Actual Expenses
  actualExpenses = (): ActualVehicleExpenses | undefined => {
    return this.expenseInfo()?.actualExpenses
  }

  // Line 23: Gasoline, oil, repairs, etc.
  l23 = (): number => {
    const exp = this.actualExpenses()
    if (!exp) return 0
    return sumFields([
      exp.gasoline,
      exp.oilChanges,
      exp.repairs,
      exp.tires,
      exp.otherExpenses
    ])
  }

  // Line 24: Vehicle rentals
  l24 = (): number => this.actualExpenses()?.vehicleRentals ?? 0

  // Line 25: Inclusion amount (for leased vehicles)
  l25 = (): number => 0 // Calculated from IRS tables

  // Line 26: Value of employer-provided vehicle
  l26 = (): number => 0

  // Line 27: Depreciation (see Section D)
  l27 = (): number => this.depreciation()

  // Line 28: Total actual expenses
  l28 = (): number => sumFields([this.l23(), this.l24(), this.l27()])

  // Line 29: Business use percentage
  l29 = (): number => {
    // Average business use across all vehicles
    const vehicles = this.expenseInfo()?.vehicles ?? []
    if (vehicles.length === 0) return 0

    let totalMiles = 0
    let totalBusinessMiles = 0

    for (const vehicle of vehicles) {
      totalMiles += vehicle.totalMiles
      totalBusinessMiles += vehicle.businessMiles
    }

    if (totalMiles === 0) return 0
    return Math.round((totalBusinessMiles / totalMiles) * 100)
  }

  // Line 30: Business portion of actual expenses (line 28 x line 29%)
  l30 = (): number => {
    return Math.round(this.l28() * (this.l29() / 100))
  }

  // Section D: Depreciation
  depreciation = (): number => {
    const exp = this.actualExpenses()
    if (!exp) return 0

    // Use provided depreciation amount (already calculated per Section 280F limits)
    return exp.depreciation
  }

  // Maximum depreciation allowed based on year
  maxDepreciation = (year: number): number => {
    switch (year) {
      case 1:
        return DEPRECIATION_LIMITS.year1
      case 2:
        return DEPRECIATION_LIMITS.year2
      case 3:
        return DEPRECIATION_LIMITS.year3
      default:
        return DEPRECIATION_LIMITS.year4Plus
    }
  }

  // ============================================================================
  // 2% AGI Floor Calculation (historical - not applicable under TCJA for most)
  // ============================================================================

  // Calculate 2% of AGI (for reference, though not used for eligible categories)
  twoPercentAGI = (): number => {
    return Math.round(this.f1040.l11() * 0.02)
  }

  // Amount deductible after 2% floor (historical calculation)
  amountAfterAGIFloor = (): number => {
    const unreimbursed = this.l10()
    const floor = this.twoPercentAGI()
    return Math.max(0, unreimbursed - floor)
  }

  // ============================================================================
  // Deduction to Schedule 1
  // ============================================================================

  // Amount going to Schedule 1, line 12 (for eligible categories)
  toSchedule1 = (): number => {
    if (!this.isEligible()) return 0
    return this.l10()
  }

  fields = (): Field[] => {
    const info = this.expenseInfo()
    const vehicle1 = this.vehicle(0)
    const vehicle2 = this.vehicle(1)

    return [
      // Header
      this.f1040.namesString(),
      this.f1040.info.taxPayer.primaryPerson.ssid,
      this.f1040.occupation(PersonRole.PRIMARY) ?? '',
      // Eligibility
      this.eligibilityDescription(),
      info?.eligibleCategory === 'reservist',
      info?.eligibleCategory === 'performer',
      info?.eligibleCategory === 'government',
      info?.eligibleCategory === 'impairment',
      // Part I - Employee Business Expenses
      this.l1(),
      this.l2(),
      this.l3(),
      this.l4(),
      info?.otherExpensesDescription ?? '',
      this.l5(),
      this.l6(),
      this.l7(),
      this.l8(),
      this.l9(),
      this.l10(),
      // Part II - Vehicle Expenses
      // Vehicle 1
      vehicle1?.dateFirstUsed.toLocaleDateString() ?? '',
      vehicle1?.totalMiles ?? 0,
      vehicle1?.businessMiles ?? 0,
      vehicle1?.commutingMiles ?? 0,
      vehicle1?.otherMiles ?? 0,
      vehicle1?.availableForPersonalUse ?? false,
      !(vehicle1?.availableForPersonalUse ?? true),
      vehicle1?.evidenceToSupportDeduction ?? false,
      !(vehicle1?.evidenceToSupportDeduction ?? true),
      vehicle1?.writtenEvidenceSupport ?? false,
      !(vehicle1?.writtenEvidenceSupport ?? true),
      // Vehicle 2
      vehicle2?.dateFirstUsed.toLocaleDateString() ?? '',
      vehicle2?.totalMiles ?? 0,
      vehicle2?.businessMiles ?? 0,
      vehicle2?.commutingMiles ?? 0,
      vehicle2?.otherMiles ?? 0,
      vehicle2?.availableForPersonalUse ?? false,
      !(vehicle2?.availableForPersonalUse ?? true),
      vehicle2?.evidenceToSupportDeduction ?? false,
      !(vehicle2?.evidenceToSupportDeduction ?? true),
      vehicle2?.writtenEvidenceSupport ?? false,
      !(vehicle2?.writtenEvidenceSupport ?? true),
      // Section B: Standard Mileage Rate
      info?.vehicleExpenseMethod === 'standard',
      this.l22a(0),
      this.l22b(),
      this.l22c(0),
      this.l22a(1),
      this.l22c(1),
      this.standardMileageDeduction(),
      // Section C: Actual Expenses
      info?.vehicleExpenseMethod === 'actual',
      this.l23(),
      this.l24(),
      this.l25(),
      this.l26(),
      this.l27(),
      this.l28(),
      this.l29(),
      this.l30(),
      // 2% AGI info (for reference)
      this.twoPercentAGI(),
      this.amountAfterAGIFloor(),
      // Amount to Schedule 1
      this.toSchedule1()
    ]
  }
}
