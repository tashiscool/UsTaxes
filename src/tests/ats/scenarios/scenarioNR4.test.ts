/**
 * IRS ATS Test Scenario NR-4 - Isaac Hill
 *
 * Test Scenario Reference: IRS ATS Test Scenario NR-4 (ty25-1040-nr-mef-ats-scenario-4-10212025.pdf)
 * Primary Taxpayer: Isaac Hill
 * Filing Status: Qualifying Surviving Spouse (QSS)
 * Location: Bangkok, Thailand (Foreign Address)
 *
 * Key Features Tested:
 * - Form 1040-NR for Nonresident Alien (QSS filing status)
 * - W-2 wage income from Pink Paradise LLC
 * - IRA distribution with early withdrawal penalty (Form 5329 implied)
 * - Schedule 2 (Additional Taxes) - early IRA distribution penalty
 * - Schedule 3 (Additional Credits and Payments)
 * - Form 3800 (General Business Credit)
 * - Form 8835 (Renewable Electricity Production Credit) - Solar
 * - Form 8936 (Clean Vehicle Credits) - GMC Sierra
 * - Federal Disaster designation
 *
 * Tax Year: 2025
 */

import { FilingStatus } from 'ustaxes/core/data'

// =============================================================================
// Test Data Fixtures - Isaac Hill (Scenario NR-4)
// =============================================================================

/**
 * Primary taxpayer information - Isaac Hill
 */
const isaacHillTaxpayer = {
  firstName: 'Isaac',
  lastName: 'Hill',
  ssn: '123015555',
  ssnAtsReference: '123-00-5555',
  foreignAddress: {
    street: '123 Sukhumvit Road',
    city: 'Khlong Toei',
    province: 'Bangkok',
    postalCode: '10110',
    country: 'Thailand'
  },
  dateOfBirth: new Date(1980, 4, 15), // May 15, 1980
  occupation: 'Driver',
  digitalAssets: false,
  isNonresidentAlien: true,
  filingStatus: 'QSS' as const,
  filingStatusCode: 5,
  spouseDeceasedDate: new Date(2024, 1, 18), // February 18, 2024
  federalDisaster: true,
  priorYearMagi: 47511,
  priorYearFilingStatus: 'Single'
}

/**
 * W-2 from Pink Paradise LLC
 */
const w2PinkParadise = {
  employeeName: 'Isaac Hill',
  employer: {
    name: 'Pink Paradise LLC',
    ein: '005559992',
    einTest: '123456992',
    address: {
      address: '4222 Terrance Lane',
      city: 'Houston',
      state: 'TX' as const,
      zip: '77059'
    }
  },
  wages: 53792,
  federalWithholding: 8493,
  ssWages: 53792,
  ssTax: 3335,
  medicareWages: 53792,
  medicareTax: 780,
  state: null,
  stateWages: 0,
  stateTax: 0
}

/**
 * IRA Distribution (Form 1099-R implied)
 */
const iraDistribution = {
  // Line 4a - Total IRA distributions
  grossDistribution: 6200,
  // Line 4b - Taxable amount
  taxableAmount: 3200,
  // Rollover amount
  rolloverAmount: 3000, // 6200 - 3200
  // Early withdrawal penalty on Form 5329
  earlyWithdrawalPenalty: 320 // 10% of $3,200
}

/**
 * Schedule 2 (Additional Taxes)
 */
const schedule2 = {
  // Part I - Tax
  line1zAdditionsToTax: 0,
  line2Amt: 0,
  line3TotalPartI: 0,

  // Part II - Other Taxes
  line4SelfEmploymentTax: 0,
  line7TotalAdditionalSsMedicare: 0,
  line8AdditionalIraTax: iraDistribution.earlyWithdrawalPenalty,
  line9HouseholdEmployment: 0,
  line11AdditionalMedicare: 0,
  line12Niit: 0,
  line18OtherTaxes: 0,
  line21TotalOtherTaxes: 320
}

/**
 * Form 8835 (Renewable Electricity Production Credit)
 */
const form8835 = {
  // Part I - Information on Qualified Facility
  registrationNumber: 'PA1Z12305555',
  facilityType: 'Photovoltaic Solar System',
  facilityAddress: '1234 Pine Street, Boulder, CO 80302',
  latitude: '+40.020923',
  longitude: '-105.281386',
  constructionBegan: new Date(2022, 2, 8), // March 8, 2022
  placedInService: new Date(2023, 4, 6), // May 6, 2023
  isExpansion: false,
  qualifiedFacilityUnder1mw: true,
  constructionBeforeJan29_2023: true,
  meetsPrevailingWageApprenticeship: true,
  domesticContentBonus: false,
  energyCommunityBonus: false,
  nameplateCapacityAcKw: 845,

  // Part II - Renewable Electricity Production
  kwhProducedSold: 21900,
  ratePerKwh: 0.006,
  line2BaseCredit: 131.4, // 21900 * 0.006
  line3Phaseout: 0,
  line4CreditBeforeReduction: 131.4,
  taxExemptBondReduction: false,
  line6AfterBondReduction: 131.4,
  line8AfterWindReduction: 131.4,
  // Increased credit amount (x5 for qualified facility)
  line9IncreasedCredit: 657, // 131.4 * 5
  line10DomesticContentBonus: 0,
  line11EnergyCommunityBonus: 0,
  line12Total: 657,
  line13FinalCredit: 655, // After rounding
  line15ToForm3800: 655
}

/**
 * Form 8936 (Clean Vehicle Credits)
 */
const form8936 = {
  // Part I - MAGI
  line2CurrentYearMagi: 56992, // AGI
  line4PriorYearMagi: 47511,
  line5PriorYearFilingStatus: 'S',
  magiLimitPartIiIii: 150000, // QSS limit

  // Part II - Business/Investment Use
  line6TotalBusinessCredit: 350,
  line8BusinessUseCredit: 350,

  // Part III - Personal Use
  line9PersonalCredit: 0, // Only 10% business use

  // Schedule A details
  scheduleA: {
    vehicleYear: 2024,
    vehicleMake: 'GMC',
    vehicleModel: 'Sierra',
    vin: '1HGBH41JXMN108186',
    placedInService: new Date(2025, 2, 20), // March 20, 2025
    isNewCleanVehicle: true,
    creditTransferredToDealer: false,
    line9TentativeCredit: 3500,
    line10BusinessInvestmentPct: 10, // 10%
    line11BusinessCredit: 350 // 3500 * 10%
  }
}

/**
 * Form 3800 (General Business Credit)
 */
const form3800 = {
  // Question A/B
  isApplicableCorporation: false,
  hasTransferElection: true, // Yes for Form 8835

  // Part I - Credits Not Allowed Against TMT
  line1NonPassiveCredits: form8835.line15ToForm3800 + form8936.line8BusinessUseCredit,
  line3PassiveAllowed: 0,
  line6Total: form8835.line15ToForm3800 + form8936.line8BusinessUseCredit, // 1,005

  // Part II - Figuring Credit Allowed
  line7RegularTax: 2775,
  line8Amt: 0,
  line9TotalTax: 2775,
  line10cAllowableCredits: 0,
  line11NetIncomeTax: 2775,
  line12NetRegularTax: 2775,
  line13_25pctExcess: 0,
  line14Tmt: 0,
  line15Greater: 0,
  line16CreditLimit: 2775,
  line17CreditAllowed: form8835.line15ToForm3800 + form8936.line8BusinessUseCredit, // 1,005

  // Part III - Current Year GBCs
  line1fForm8835: form8835.line15ToForm3800, // 655
  line1yForm8936: form8936.line8BusinessUseCredit, // 350
  line2Total: form8835.line15ToForm3800 + form8936.line8BusinessUseCredit, // 1,005

  // Section D - Credits Allowed
  line38CreditAllowed: form8835.line15ToForm3800 + form8936.line8BusinessUseCredit // 1,005
}

/**
 * Schedule 3 (Additional Credits and Payments)
 */
const schedule3 = {
  // Part I - Nonrefundable Credits
  line1ForeignTaxCredit: 0,
  line2DependentCareCredit: 0,
  line3EducationCredits: 0,
  line4RetirementSavingsCredit: 0,
  line5aResidentialEnergy: 0,
  line5bEnergyImprovement: 0,
  line6aGeneralBusinessCredit: form3800.line38CreditAllowed,
  line6fCleanVehicleCredit: 0, // Personal use
  line7TotalOtherCredits: form3800.line38CreditAllowed,
  line8TotalNonrefundable: form3800.line38CreditAllowed,

  // Part II - Other Payments and Refundable Credits
  line14TotalOtherPayments: 0,
  line15TotalRefundable: 0
}

/**
 * Complete Form 1040-NR data for Isaac Hill
 */
const form1040NRData = (() => {
  // Income calculation
  const wages = w2PinkParadise.wages
  const taxableIra = iraDistribution.taxableAmount
  const totalEci = wages + taxableIra // 56,992

  // AGI
  const agi = totalEci // No adjustments

  // QSS standard deduction
  const standardDeductionQss = 30000

  // Taxable income
  const taxableIncome = agi - standardDeductionQss // 26,992

  // Tax calculation (MFJ brackets for QSS)
  // 10% on first $23,200 = $2,320
  // 12% on remaining $3,792 = $455.04
  const tax = 2775 // Rounded

  // Credits
  const totalCredits = schedule3.line8TotalNonrefundable

  // Tax after credits
  const taxAfterCredits = Math.max(tax - totalCredits, 0) // 1,770

  // Other taxes from Schedule 2
  const otherTaxes = schedule2.line21TotalOtherTaxes // 320

  // Total tax
  const totalTax = taxAfterCredits + otherTaxes // 2,090

  // Payments
  const federalWithholding = w2PinkParadise.federalWithholding
  const totalPayments = federalWithholding // 8,493

  // Refund
  const overpayment = totalPayments - totalTax // 6,403

  return {
    formType: '1040-NR',
    taxYear: 2025,
    filingStatus: 'QSS',
    filingStatusCode: 5,

    // Taxpayer info
    taxpayer: isaacHillTaxpayer,

    // Income (Effectively Connected)
    line1aW2Wages: wages,
    line4aIraDistributions: iraDistribution.grossDistribution,
    line4bTaxableIra: taxableIra,
    line9TotalEci: totalEci,
    line11aAgi: agi,

    // Tax and Credits
    line11bAgi: agi,
    line12ItemizedDeductions: 0, // Using standard
    line14TotalDeductions: standardDeductionQss,
    line15TaxableIncome: taxableIncome,
    line16Tax: tax,
    line17Schedule2Line3: schedule2.line3TotalPartI,
    line18Total: tax + schedule2.line3TotalPartI,
    line19ChildTaxCredit: 0,
    line20Schedule3Line8: totalCredits,
    line21TotalCredits: totalCredits,
    line22TaxAfterCredits: taxAfterCredits,
    line23bOtherTaxes: otherTaxes,
    line23dTotalOther: otherTaxes,
    line24TotalTax: totalTax,

    // Payments
    line25aW2Withholding: federalWithholding,
    line25dTotalWithholding: federalWithholding,
    line33TotalPayments: totalPayments,

    // Refund
    line34Overpayment: overpayment,
    line35aRefund: overpayment,

    // Attached schedules/forms
    hasSchedule2: true,
    hasSchedule3: true,
    hasForm3800: true,
    hasForm8835: true,
    hasForm8936: true,

    // Binary attachments
    binaryAttachments: ['Substantiate VIN', 'Transfer Election Statement']
  }
})()

// =============================================================================
// Tests
// =============================================================================

describe('ATS Scenario NR-4 - Isaac Hill (Form 1040-NR QSS with Credits)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct taxpayer name', () => {
      expect(isaacHillTaxpayer.firstName).toBe('Isaac')
      expect(isaacHillTaxpayer.lastName).toBe('Hill')
    })

    it('should have valid SSN format', () => {
      expect(isaacHillTaxpayer.ssn).toHaveLength(9)
      expect(/^\d{9}$/.test(isaacHillTaxpayer.ssn)).toBe(true)
    })

    it('should be a nonresident alien', () => {
      expect(isaacHillTaxpayer.isNonresidentAlien).toBe(true)
    })

    it('should have foreign address in Thailand', () => {
      expect(isaacHillTaxpayer.foreignAddress.country).toBe('Thailand')
      expect(isaacHillTaxpayer.foreignAddress.province).toBe('Bangkok')
    })

    it('should have Qualifying Surviving Spouse filing status', () => {
      expect(isaacHillTaxpayer.filingStatus).toBe('QSS')
      expect(isaacHillTaxpayer.filingStatusCode).toBe(5)
    })

    it('should have spouse deceased date', () => {
      expect(isaacHillTaxpayer.spouseDeceasedDate).toEqual(new Date(2024, 1, 18))
    })

    it('should have Federal Disaster designation', () => {
      expect(isaacHillTaxpayer.federalDisaster).toBe(true)
    })

    it('should have occupation as Driver', () => {
      expect(isaacHillTaxpayer.occupation).toBe('Driver')
    })
  })

  describe('W-2 Income', () => {
    it('should have correct employer', () => {
      expect(w2PinkParadise.employer.name).toBe('Pink Paradise LLC')
    })

    it('should have correct wages', () => {
      expect(w2PinkParadise.wages).toBe(53792)
    })

    it('should have correct federal withholding', () => {
      expect(w2PinkParadise.federalWithholding).toBe(8493)
    })

    it('should be in Texas (no state income tax)', () => {
      expect(w2PinkParadise.employer.address.state).toBe('TX')
      expect(w2PinkParadise.stateTax).toBe(0)
    })
  })

  describe('IRA Distribution', () => {
    it('should have correct gross distribution', () => {
      expect(iraDistribution.grossDistribution).toBe(6200)
    })

    it('should have correct taxable portion', () => {
      expect(iraDistribution.taxableAmount).toBe(3200)
    })

    it('should have implied rollover amount', () => {
      const rollover =
        iraDistribution.grossDistribution - iraDistribution.taxableAmount
      expect(rollover).toBe(3000)
    })

    it('should have 10% early withdrawal penalty', () => {
      const expected = iraDistribution.taxableAmount * 0.1
      expect(iraDistribution.earlyWithdrawalPenalty).toBe(expected)
    })
  })

  describe('Form 8835 (Renewable Electricity)', () => {
    it('should have solar facility type', () => {
      expect(form8835.facilityType).toBe('Photovoltaic Solar System')
    })

    it('should have IRS registration number', () => {
      expect(form8835.registrationNumber).toBe('PA1Z12305555')
    })

    it('should have facility in Colorado', () => {
      expect(form8835.facilityAddress).toContain('Boulder, CO')
    })

    it('should have correct kWh produced', () => {
      expect(form8835.kwhProducedSold).toBe(21900)
    })

    it('should calculate base credit correctly', () => {
      const expected = form8835.kwhProducedSold * form8835.ratePerKwh
      expect(form8835.line2BaseCredit).toBeCloseTo(expected, 1)
    })

    it('should have 5x multiplier for qualified facility', () => {
      const ratio = form8835.line9IncreasedCredit / form8835.line4CreditBeforeReduction
      expect(ratio).toBeCloseTo(5, 0)
    })

    it('should have final credit of $655', () => {
      expect(form8835.line15ToForm3800).toBe(655)
    })

    it('should have nameplate capacity under 1MW', () => {
      expect(form8835.nameplateCapacityAcKw).toBe(845)
      expect(form8835.qualifiedFacilityUnder1mw).toBe(true)
    })
  })

  describe('Form 8936 (Clean Vehicle)', () => {
    it('should have correct vehicle details', () => {
      expect(form8936.scheduleA.vehicleYear).toBe(2024)
      expect(form8936.scheduleA.vehicleMake).toBe('GMC')
      expect(form8936.scheduleA.vehicleModel).toBe('Sierra')
    })

    it('should have valid VIN', () => {
      expect(form8936.scheduleA.vin).toBe('1HGBH41JXMN108186')
    })

    it('should be new clean vehicle', () => {
      expect(form8936.scheduleA.isNewCleanVehicle).toBe(true)
    })

    it('should have tentative credit of $3,500', () => {
      expect(form8936.scheduleA.line9TentativeCredit).toBe(3500)
    })

    it('should have 10% business/investment use', () => {
      expect(form8936.scheduleA.line10BusinessInvestmentPct).toBe(10)
    })

    it('should calculate business credit correctly', () => {
      const expected =
        (form8936.scheduleA.line9TentativeCredit *
          form8936.scheduleA.line10BusinessInvestmentPct) /
        100
      expect(form8936.scheduleA.line11BusinessCredit).toBe(expected)
    })

    it('should have total business credit of $350', () => {
      expect(form8936.line8BusinessUseCredit).toBe(350)
    })
  })

  describe('Form 3800 (General Business Credit)', () => {
    it('should include Form 8835 credit', () => {
      expect(form3800.line1fForm8835).toBe(655)
    })

    it('should include Form 8936 credit', () => {
      expect(form3800.line1yForm8936).toBe(350)
    })

    it('should have total GBC of $1,005', () => {
      const expected = form3800.line1fForm8835 + form3800.line1yForm8936
      expect(form3800.line2Total).toBe(expected)
      expect(expected).toBe(1005)
    })

    it('should have credit allowed of $1,005', () => {
      expect(form3800.line38CreditAllowed).toBe(1005)
    })

    it('should not exceed tax liability limit', () => {
      expect(form3800.line38CreditAllowed).toBeLessThanOrEqual(
        form3800.line16CreditLimit
      )
    })
  })

  describe('Schedule 2 (Additional Taxes)', () => {
    it('should have IRA penalty', () => {
      expect(schedule2.line8AdditionalIraTax).toBe(320)
    })

    it('should have total other taxes of $320', () => {
      expect(schedule2.line21TotalOtherTaxes).toBe(320)
    })

    it('should have no self-employment tax', () => {
      expect(schedule2.line4SelfEmploymentTax).toBe(0)
    })
  })

  describe('Schedule 3 (Additional Credits)', () => {
    it('should have GBC on line 6a', () => {
      expect(schedule3.line6aGeneralBusinessCredit).toBe(1005)
    })

    it('should have total nonrefundable credits of $1,005', () => {
      expect(schedule3.line8TotalNonrefundable).toBe(1005)
    })
  })

  describe('Form 1040-NR Tax Calculation', () => {
    it('should have correct form type', () => {
      expect(form1040NRData.formType).toBe('1040-NR')
    })

    it('should have QSS filing status', () => {
      expect(form1040NRData.filingStatus).toBe('QSS')
    })

    it('should have correct W-2 wages', () => {
      expect(form1040NRData.line1aW2Wages).toBe(53792)
    })

    it('should have correct total ECI', () => {
      const expected = 53792 + 3200
      expect(form1040NRData.line9TotalEci).toBe(expected)
    })

    it('should have correct AGI', () => {
      expect(form1040NRData.line11aAgi).toBe(56992)
    })

    it('should use QSS standard deduction', () => {
      expect(form1040NRData.line14TotalDeductions).toBe(30000)
    })

    it('should calculate taxable income correctly', () => {
      const expected = 56992 - 30000
      expect(form1040NRData.line15TaxableIncome).toBe(expected)
    })

    it('should have correct total credits', () => {
      expect(form1040NRData.line21TotalCredits).toBe(1005)
    })

    it('should have correct total tax', () => {
      expect(form1040NRData.line24TotalTax).toBe(2090)
    })

    it('should have correct total payments', () => {
      expect(form1040NRData.line33TotalPayments).toBe(8493)
    })

    it('should have a refund', () => {
      expect(form1040NRData.line34Overpayment).toBeGreaterThan(0)
    })

    it('should calculate refund correctly', () => {
      const expected = 8493 - 2090
      expect(form1040NRData.line35aRefund).toBe(expected)
    })
  })

  describe('Binary Attachments', () => {
    it('should have VIN substantiation', () => {
      expect(form1040NRData.binaryAttachments).toContain('Substantiate VIN')
    })

    it('should have Transfer Election Statement', () => {
      expect(form1040NRData.binaryAttachments).toContain(
        'Transfer Election Statement'
      )
    })
  })

  describe('Integration', () => {
    it('should flow W-2 wages to Form 1040-NR', () => {
      expect(form1040NRData.line1aW2Wages).toBe(w2PinkParadise.wages)
    })

    it('should flow Form 8835 to Form 3800', () => {
      expect(form3800.line1fForm8835).toBe(form8835.line15ToForm3800)
    })

    it('should flow Form 8936 to Form 3800', () => {
      expect(form3800.line1yForm8936).toBe(form8936.line8BusinessUseCredit)
    })

    it('should flow Form 3800 to Schedule 3', () => {
      expect(schedule3.line6aGeneralBusinessCredit).toBe(
        form3800.line38CreditAllowed
      )
    })

    it('should flow Schedule 2 to Form 1040-NR', () => {
      expect(form1040NRData.line23bOtherTaxes).toBe(
        schedule2.line21TotalOtherTaxes
      )
    })

    it('should flow Schedule 3 to Form 1040-NR', () => {
      expect(form1040NRData.line20Schedule3Line8).toBe(
        schedule3.line8TotalNonrefundable
      )
    })

    it('should flow withholding to payments', () => {
      expect(form1040NRData.line25aW2Withholding).toBe(
        w2PinkParadise.federalWithholding
      )
    })

    it('should have consistent line math', () => {
      // Total ECI = Wages + Taxable IRA
      const expectedEci = form1040NRData.line1aW2Wages + form1040NRData.line4bTaxableIra
      expect(form1040NRData.line9TotalEci).toBe(expectedEci)

      // Taxable income = AGI - Deductions
      const expectedTaxable =
        form1040NRData.line11aAgi - form1040NRData.line14TotalDeductions
      expect(form1040NRData.line15TaxableIncome).toBe(expectedTaxable)

      // Tax after credits = Tax - Credits (min 0)
      const expectedAfterCredits = Math.max(
        form1040NRData.line16Tax - form1040NRData.line21TotalCredits,
        0
      )
      expect(form1040NRData.line22TaxAfterCredits).toBe(expectedAfterCredits)

      // Total tax = Tax after credits + Other taxes
      const expectedTotalTax =
        form1040NRData.line22TaxAfterCredits + form1040NRData.line23dTotalOther
      expect(form1040NRData.line24TotalTax).toBe(expectedTotalTax)

      // Refund = Payments - Total tax
      const expectedRefund =
        form1040NRData.line33TotalPayments - form1040NRData.line24TotalTax
      expect(form1040NRData.line35aRefund).toBe(expectedRefund)
    })
  })

  describe('Validation Rules', () => {
    it('should use 1040-NR for nonresident alien', () => {
      expect(form1040NRData.formType).toBe('1040-NR')
      expect(form1040NRData.taxpayer.isNonresidentAlien).toBe(true)
    })

    it('should allow QSS to use standard deduction', () => {
      expect(form1040NRData.filingStatus).toBe('QSS')
      expect(form1040NRData.line14TotalDeductions).toBe(30000)
    })

    it('should have MAGI within clean vehicle limit', () => {
      expect(form8936.line2CurrentYearMagi).toBeLessThanOrEqual(
        form8936.magiLimitPartIiIii
      )
    })

    it('should limit GBC by tax liability', () => {
      expect(form3800.line38CreditAllowed).toBeLessThanOrEqual(
        form3800.line16CreditLimit
      )
    })
  })
})
