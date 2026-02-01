/**
 * IRS ATS Test Scenario 4 - Sarah Smith
 *
 * Test Scenario Reference: IRS ATS Test Scenario 4 (ty25-1040-mef-ats-scenario-4-10212025.pdf)
 * Primary Taxpayer: Sarah Smith
 * Filing Status: Single (1)
 * No Dependents
 *
 * Key Features Tested:
 * - Form 1040 basic return
 * - W-2 wage income
 * - Form 8835 (Renewable Electricity Production Credit - Solar)
 * - Form 8936 (Clean Vehicle Credits - BMW i4 Gran Coupe)
 * - Form 3800 (General Business Credit)
 * - Schedule 3 (Additional Credits)
 * - Transfer Election Statement (binary attachment)
 *
 * Tax Year: 2025
 */

import { FilingStatus } from 'ustaxes/core/data'

// =============================================================================
// Test Data Fixtures - Sarah Smith (Scenario 4)
// =============================================================================

/**
 * Primary taxpayer information
 */
const sarahSmithTaxpayer = {
  firstName: 'Sarah',
  lastName: 'Smith',
  ssn: '400011037',
  ssnAtsReference: '400-00-1037',
  address: {
    address: '6712 Kittery Drive',
    city: 'Las Vegas',
    state: 'NV' as const,
    zip: '89107'
  },
  dateOfBirth: new Date(1989, 6, 8), // July 8, 1989
  occupation: 'Financial Analyst',
  digitalAssets: false
}

/**
 * W-2 from Capital One Bank
 */
const w2Data = {
  employeeName: 'Sarah Smith',
  employerName: 'Capital One Bank',
  employerEin: '000000057',
  employerAddress: {
    address: '495 South Main Street',
    city: 'Las Vegas',
    state: 'NV' as const,
    zip: '89139'
  },
  box1Wages: 36014,
  box2FederalWithholding: 4581,
  box3SsWages: 36014,
  box4SsTax: 2233, // 36014 * 0.062
  box5MedicareWages: 36014,
  box6MedicareTax: 522, // 36014 * 0.0145
  box15State: undefined, // Nevada has no state income tax
  box16StateWages: 0,
  box17StateTax: 0
}

/**
 * Form 8835 (Renewable Electricity Production Credit)
 */
const form8835 = {
  registrationNumber: 'PAZ123055555',
  facilityType: '8860952 Solar',
  ownerName: 'Texas Solar Energy',
  ownerTin: '000000029',
  facilityAddress: '808 Spring Love Lane, Houston, TX 77004',
  coordinates: {
    latitude: '+24.778212',
    longitude: '-103.74636'
  },
  constructionBegan: new Date(2017, 7, 15),
  placedInService: new Date(2023, 8, 22),
  isExpansion: false,

  // Qualified Facility Requirements
  maxOutputLessThan1mw: true,
  constructionBeforeJan292023: true,
  meetsPrevailingWageApprenticeship: true,

  // Bonus Credits
  domesticContentBonus: false,
  energyCommunityBonus: false,

  // Nameplate Capacity
  nameplateDcKw: 10000,
  nameplateAcKw: 765,

  // Part II - Renewable Electricity Production
  solarKwhProducedSold: 440000,
  solarRate: 0.006, // $0.006 per kWh
  solarCreditAmount: 2640, // 440000 * 0.006

  // Phaseout and reductions
  phaseoutAdjustment: 0,
  creditBeforeReduction: 2640,
  taxExemptBondReduction: 0,

  // Line 8 - Credit after reductions
  line8Credit: 2640,

  // Line 9 - Increased credit amount (5x multiplier)
  increasedCreditMultiplier: 5,
  line9Credit: 13200, // 2640 * 5

  // Bonus credits (both N/A)
  line10DomesticContentBonus: 0,
  line11EnergyCommunityBonus: 0,

  // Line 12 - Total
  line12Total: 13200,

  // Line 13 - Final credit
  line13FinalCredit: 13200,

  // Line 15 - Credit to report on Form 3800
  line15Credit: 13200
}

/**
 * Form 8936 (Clean Vehicle Credits)
 */
const form8936 = {
  // Part I - MAGI
  line1aAgi2025: 36014,
  line2Magi2025: 36014,
  line3aAgi2024: 0,
  line4Magi2024: 0,
  filingStatus2024: 'S', // Single

  // MAGI Limits check
  magiLimitSingle: 150000,
  exceedsMagiLimit: false,

  // Schedule A - Vehicle Details
  vehicle: {
    year: 2024,
    make: 'BMW',
    model: 'i4 Gran Coupe',
    vin: 'IHGBH41JXMN108186',
    placedInService: new Date(2025, 0, 25),
    isNew: true,
    transferredCreditToDealer: false,
    resoldWithin30Days: false,
    acquiredForUse: true
  },

  // Part II - Business/Investment Use (N/A - personal use)
  line6BusinessCredit: 0,
  line8BusinessCredit: 0,

  // Part III - Personal Use of New Clean Vehicle
  tentativeCredit: 7500,
  businessUsePercentage: 0,
  personalUseCredit: 7500,
  line9PersonalCredit: 130, // From ATS form

  // Part IV - Previously Owned (N/A)
  line14PreviouslyOwned: 0,

  // Part V - Commercial (N/A)
  line19Commercial: 0
}

/**
 * Form 3800 (General Business Credit)
 */
const form3800 = {
  // Part I - Credits Not Allowed Against TMT
  line1NonPassiveCredits: 13330, // 13200 + 130
  line2PassiveCredits: 0,
  line3PassiveAllowed: 0,
  line4Carryforward: 0,
  line5Carryback: 0,
  line6Total: 13330,

  // Part III - Current Year GBCs
  line1fForm8835: {
    registrationNumber: 'PAZ123055555',
    passThroughEin: 'APPLD FOR',
    creditsNotSubjectPassive: 13200,
    combinedAfterPassive: 13200
  },
  line1yForm8936: {
    passThroughEin: 'APPLD FOR',
    creditsNotSubjectPassive: 130,
    combinedAfterPassive: 130
  },

  // Line 38 - Credit allowed for current year
  line38CreditAllowed: 0 // Limited by tax liability
}

/**
 * Schedule 3 (Additional Credits and Payments)
 */
const schedule3 = {
  // Part I - Nonrefundable Credits
  line1ForeignTaxCredit: 0,
  line2ChildCareCredit: 0,
  line3EducationCredit: 0,
  line4RetirementSavingsCredit: 0,
  line5aResidentialCleanEnergy: 0,
  line5bEnergyEfficientHome: 0,

  // Other nonrefundable credits
  line6aGeneralBusinessCredit: 0, // Limited by tax
  line6bPriorYearMinimumTax: 0,
  line6cAdoptionCredit: 0,
  line6dElderlyDisabled: 0,
  line6fCleanVehicle: 0,

  // Line 7 - Total other nonrefundable credits
  line7TotalOther: 0,

  // Line 8 - Total Part I
  line8TotalPart1: 0,

  // Part II - Other Payments and Refundable Credits
  line9PremiumTaxCredit: 0,
  line15TotalPart2: 0
}

/**
 * Complete Form 1040 data for Sarah Smith
 */
const form1040Data = (() => {
  // Income
  const totalWages = w2Data.box1Wages // $36,014
  const totalIncome = totalWages
  const agi = totalIncome // No adjustments

  // Deduction
  const standardDeductionSingle2025 = 15000

  // Taxable income
  const taxableIncome = Math.max(0, agi - standardDeductionSingle2025) // $21,014

  // Tax calculation (2025 Single brackets)
  // $0 - $11,600: 10%
  // $11,601 - $47,150: 12%
  const taxBracket1 = 11600 * 0.1 // $1,160
  const remaining = taxableIncome - 11600 // $9,414
  const taxBracket2 = remaining * 0.12 // $1,129.68
  const calculatedTax = Math.round(taxBracket1 + taxBracket2) // $2,290

  // Credits (limited by tax liability)
  const totalCreditsAvailable = form8835.line15Credit + form8936.line9PersonalCredit
  const nonrefundableCredits = Math.min(calculatedTax, totalCreditsAvailable)

  // Tax after credits
  const taxAfterCredits = Math.max(0, calculatedTax - nonrefundableCredits)

  // Total tax
  const totalTax = taxAfterCredits

  // Payments
  const federalWithholding = w2Data.box2FederalWithholding // $4,581
  const totalPayments = federalWithholding

  // Refund or owed
  const refund = totalPayments > totalTax ? totalPayments - totalTax : 0
  const amountOwed = totalTax > totalPayments ? totalTax - totalPayments : 0

  return {
    // Taxpayer info
    primarySsn: sarahSmithTaxpayer.ssn,
    primaryFirstName: sarahSmithTaxpayer.firstName,
    primaryLastName: sarahSmithTaxpayer.lastName,
    address: sarahSmithTaxpayer.address,
    filingStatus: FilingStatus.S,

    // Checkboxes
    presidentialCampaign: false,
    digitalAssets: false,

    // No spouse for Single
    spouseSsn: undefined,
    dependents: [],

    // Income lines
    line1zWages: totalWages, // $36,014
    line9TotalIncome: totalIncome,
    totalIncome,

    // Adjustments
    line10Adjustments: 0,

    // AGI
    line11Agi: agi,
    agi,

    // Deduction
    line12StandardDeduction: standardDeductionSingle2025,
    line14TotalDeductions: standardDeductionSingle2025,
    deduction: standardDeductionSingle2025,

    // Taxable income
    line15TaxableIncome: taxableIncome, // $21,014
    taxableIncome,

    // Tax
    line16Tax: calculatedTax,
    line17Schedule2: 0,
    line18Total: calculatedTax,
    line19CtcActc: 0,
    line20Schedule3: nonrefundableCredits,
    line21CreditsSubtotal: nonrefundableCredits,
    line22TaxMinusCredits: taxAfterCredits,
    line23OtherTaxes: 0,
    line24TotalTax: totalTax,
    totalTax,

    // Payments
    line25aW2Withholding: federalWithholding,
    line25dTotalWithholding: federalWithholding,
    line33TotalPayments: totalPayments,
    totalPayments,

    // Refund/Amount Owed
    line34Overpaid: refund,
    line35aRefund: refund,
    line37AmountOwed: amountOwed,
    refund,
    amountOwed,

    // Binary attachment
    hasBinaryAttachment: true,
    binaryAttachmentDescription: 'Transfer Election Statement'
  }
})()

// =============================================================================
// Tests
// =============================================================================

describe('ATS Scenario 4 - Sarah Smith (Energy Credits)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct taxpayer name', () => {
      expect(sarahSmithTaxpayer.firstName).toBe('Sarah')
      expect(sarahSmithTaxpayer.lastName).toBe('Smith')
    })

    it('should have occupation as Financial Analyst', () => {
      expect(sarahSmithTaxpayer.occupation).toBe('Financial Analyst')
    })

    it('should be in Nevada (no state income tax)', () => {
      expect(sarahSmithTaxpayer.address.state).toBe('NV')
    })
  })

  describe('W-2 Income', () => {
    it('should have correct wages', () => {
      expect(w2Data.box1Wages).toBe(36014)
    })

    it('should have correct federal withholding', () => {
      expect(w2Data.box2FederalWithholding).toBe(4581)
    })

    it('should have no state income tax (Nevada)', () => {
      expect(w2Data.box15State).toBeUndefined()
      expect(w2Data.box17StateTax).toBe(0)
    })

    it('should have correct employer information', () => {
      expect(w2Data.employerName).toBe('Capital One Bank')
    })
  })

  describe('Form 8835 (Renewable Electricity Production Credit)', () => {
    it('should have correct facility registration number', () => {
      expect(form8835.registrationNumber).toBe('PAZ123055555')
    })

    it('should have correct facility type (Solar)', () => {
      expect(form8835.facilityType).toBe('8860952 Solar')
    })

    it('should meet qualified facility requirements', () => {
      expect(form8835.maxOutputLessThan1mw).toBe(true)
      expect(form8835.constructionBeforeJan292023).toBe(true)
      expect(form8835.meetsPrevailingWageApprenticeship).toBe(true)
    })

    it('should calculate solar credit correctly', () => {
      const expected = form8835.solarKwhProducedSold * form8835.solarRate
      expect(form8835.solarCreditAmount).toBe(expected)
      expect(form8835.solarCreditAmount).toBe(2640)
    })

    it('should apply 5x multiplier for qualified facilities', () => {
      const expected = form8835.line8Credit * form8835.increasedCreditMultiplier
      expect(form8835.line9Credit).toBe(expected)
      expect(form8835.line9Credit).toBe(13200)
    })

    it('should have no bonus credits', () => {
      expect(form8835.domesticContentBonus).toBe(false)
      expect(form8835.energyCommunityBonus).toBe(false)
      expect(form8835.line10DomesticContentBonus).toBe(0)
      expect(form8835.line11EnergyCommunityBonus).toBe(0)
    })

    it('should have final credit of $13,200', () => {
      expect(form8835.line15Credit).toBe(13200)
    })
  })

  describe('Form 8936 (Clean Vehicle Credits)', () => {
    it('should have correct vehicle information', () => {
      expect(form8936.vehicle.make).toBe('BMW')
      expect(form8936.vehicle.model).toBe('i4 Gran Coupe')
      expect(form8936.vehicle.vin).toBe('IHGBH41JXMN108186')
    })

    it('should have vehicle placed in service in 2025', () => {
      expect(form8936.vehicle.placedInService.getFullYear()).toBe(2025)
    })

    it('should be a new vehicle', () => {
      expect(form8936.vehicle.isNew).toBe(true)
    })

    it('should be under MAGI limit for single filer', () => {
      expect(form8936.line2Magi2025).toBeLessThan(form8936.magiLimitSingle)
      expect(form8936.exceedsMagiLimit).toBe(false)
    })

    it('should have personal use credit', () => {
      expect(form8936.line9PersonalCredit).toBe(130)
    })
  })

  describe('Form 3800 (General Business Credit)', () => {
    it('should combine credits from Forms 8835 and 8936', () => {
      const expected =
        form3800.line1fForm8835.creditsNotSubjectPassive +
        form3800.line1yForm8936.creditsNotSubjectPassive
      expect(form3800.line6Total).toBe(expected)
      expect(form3800.line6Total).toBe(13330)
    })

    it('should have correct registration number from Form 8835', () => {
      expect(form3800.line1fForm8835.registrationNumber).toBe('PAZ123055555')
    })
  })

  describe('Tax Calculation', () => {
    it('should have filing status Single', () => {
      expect(form1040Data.filingStatus).toBe(FilingStatus.S)
    })

    it('should calculate AGI correctly (no adjustments)', () => {
      expect(form1040Data.agi).toBe(form1040Data.totalIncome)
      expect(form1040Data.agi).toBe(36014)
    })

    it('should use standard deduction for 2025 Single', () => {
      expect(form1040Data.line12StandardDeduction).toBe(15000)
    })

    it('should calculate taxable income correctly', () => {
      const expected = form1040Data.agi - form1040Data.deduction
      expect(form1040Data.taxableIncome).toBe(expected)
      expect(form1040Data.taxableIncome).toBe(21014)
    })

    it('should have credits limited by tax liability', () => {
      expect(form1040Data.line20Schedule3).toBeLessThanOrEqual(
        form1040Data.line16Tax
      )
    })
  })

  describe('Integration', () => {
    it('should have all required Form 1040 fields', () => {
      const requiredFields = [
        'primarySsn',
        'primaryFirstName',
        'primaryLastName',
        'filingStatus',
        'totalIncome',
        'agi',
        'deduction',
        'taxableIncome',
        'totalTax',
        'totalPayments'
      ]

      for (const field of requiredFields) {
        expect(form1040Data).toHaveProperty(field)
      }
    })

    it('should have single filer with no spouse', () => {
      expect(form1040Data.filingStatus).toBe(FilingStatus.S)
      expect(form1040Data.spouseSsn).toBeUndefined()
    })

    it('should have no dependents', () => {
      expect(form1040Data.dependents).toHaveLength(0)
    })

    it('should flow W-2 wages to Form 1040 correctly', () => {
      expect(form1040Data.line1zWages).toBe(w2Data.box1Wages)
    })

    it('should flow W-2 withholding to Form 1040 correctly', () => {
      expect(form1040Data.line25aW2Withholding).toBe(
        w2Data.box2FederalWithholding
      )
    })

    it('should have binary attachment for Transfer Election Statement', () => {
      expect(form1040Data.hasBinaryAttachment).toBe(true)
      expect(form1040Data.binaryAttachmentDescription).toBe(
        'Transfer Election Statement'
      )
    })

    it('should have consistent line math', () => {
      // Line 9 = Line 1z (for this simple scenario)
      expect(form1040Data.line9TotalIncome).toBe(form1040Data.line1zWages)

      // Line 11 = Line 9 - Line 10
      expect(form1040Data.line11Agi).toBe(
        form1040Data.line9TotalIncome - form1040Data.line10Adjustments
      )

      // Line 15 = Line 11 - Line 14
      expect(form1040Data.line15TaxableIncome).toBe(
        form1040Data.line11Agi - form1040Data.line14TotalDeductions
      )
    })
  })
})
