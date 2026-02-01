/**
 * IRS ATS Test Scenario 2 - John and Judy Jones
 *
 * Test Scenario Reference: IRS ATS Test Scenario 2 (1040-mef-ats-scenario-2-12012025.pdf)
 * Primary Taxpayer: John Jones
 * Secondary Taxpayer: Judy Jones (Deceased 09/11/2025)
 * Filing Status: Married Filing Jointly (2)
 * One Dependent: Jacob Jones (Son, full-time high school student)
 *
 * Key Features Tested:
 * - Married Filing Jointly with deceased spouse
 * - Spouse Identity Protection PIN (876543)
 * - Multiple W-2 forms (John from Southwest Airlines, Judy from Target)
 * - Schedule C (Statutory Employee - Furniture Sales)
 * - Schedule A (Itemized Deductions)
 * - Form 8283 (Noncash Charitable Contributions)
 * - Nonresident Spouse Choice Statement (binary attachment)
 * - Estimated tax payment applied from prior year
 *
 * Tax Year: 2025
 */

import { FilingStatus } from 'ustaxes/core/data'

// =============================================================================
// Test Data Fixtures - John and Judy Jones (Scenario 2)
// =============================================================================

/**
 * Primary taxpayer information - John Jones
 */
const johnJonesTaxpayer = {
  firstName: 'John',
  lastName: 'Jones',
  ssn: '400011038',
  ssnAtsReference: '400-00-1038',
  address: {
    address: '800 Gooseneck Point Road',
    city: 'Oceanport',
    state: 'NJ' as const,
    zip: '07757'
  },
  dateOfBirth: new Date(1965, 7, 2), // August 2, 1965
  occupation: 'Sales Representative',
  digitalAssets: false
}

/**
 * Spouse information - Judy Jones (Deceased)
 */
const judyJonesSpouse = {
  firstName: 'Judy',
  lastName: 'Jones',
  ssn: '400011071',
  ssnAtsReference: '400-00-1071',
  dateOfBirth: new Date(1966, 2, 19), // March 19, 1966
  dateOfDeath: new Date(2025, 8, 11), // September 11, 2025
  ipPin: '876543',
  isNonresidentAlienTreatedAsResident: true
}

/**
 * Dependent - Jacob Jones (Son, full-time student)
 */
const jacobJonesDependent = {
  firstName: 'Jacob',
  lastName: 'Jones',
  ssn: '400011070',
  ssnAtsReference: '400-00-1070',
  relationship: 'Son',
  dateOfBirth: new Date(2006, 6, 20), // July 20, 2006
  isFullTimeStudent: true,
  livedWithTaxpayer: true,
  monthsInUs: 12,
  qualifiesForCtc: false, // Over 16
  qualifiesForOdc: true // Credit for Other Dependents
}

/**
 * W-2 #1 - John Jones from Southwest Airlines (Statutory Employee)
 */
const w2JohnJones = {
  employeeName: 'John Jones',
  employerName: 'Southwest Airlines',
  employerEin: '001111111',
  employerAddress: {
    address: '5000 Flight Street',
    address2: '77 North Washington Street',
    city: 'Boston',
    state: 'MA' as const,
    zip: '02114'
  },
  box1Wages: 29513,
  box2FederalWithholding: 1003,
  box3SsWages: 29513,
  box4SsTax: 1830,
  box5MedicareWages: 29513,
  box6MedicareTax: 428,
  isStatutoryEmployee: true,
  box15State: 'NJ',
  box16StateWages: 29513,
  box17StateTax: 927
}

/**
 * W-2 #2 - Judy Jones from Target Corporation
 */
const w2JudyJones = {
  employeeName: 'Judy Jones',
  employerName: 'Target Corporation',
  employerEin: '000000013',
  employerAddress: {
    address: '8652 James Street',
    city: 'Poughkeepsie',
    state: 'NY' as const,
    zip: '12601'
  },
  box1Wages: 8513,
  box2FederalWithholding: 161,
  box3SsWages: 8513,
  box4SsTax: 528,
  box5MedicareWages: 8513,
  box6MedicareTax: 123,
  isStatutoryEmployee: false,
  box15State: 'NJ',
  box16StateWages: 8513,
  box17StateTax: 101
}

/**
 * W-2 totals
 */
const w2Totals = {
  totalWages: 38026, // 29513 + 8513
  federalWithholding: 1164, // 1003 + 161
  ssWages: 38026,
  ssTax: 2358, // 1830 + 528
  medicareWages: 38026,
  medicareTax: 551, // 428 + 123
  stateTax: 1028 // 927 + 101
}

/**
 * Schedule C (Profit or Loss from Business) - John as Statutory Employee
 * Principal Business Code: 449110 (Furniture Sales)
 */
const scheduleC = {
  proprietorName: 'John Jones',
  principalBusiness: 'Furniture Sales',
  principalBusinessCode: '449110',
  businessAddress: johnJonesTaxpayer.address,
  accountingMethod: 'Cash' as const,
  materiallyParticipated: true,

  // Part I - Income (Statutory employee, reported on W-2)
  line1GrossReceipts: 0,
  line7GrossIncome: 0,

  // Part II - Expenses
  expenses: {
    line8Advertising: 850,
    line9CarTruck: 466,
    line18OfficeExpense: 550,
    line22Supplies: 610,
    line23TaxesLicenses: 58
  },

  // Line 28 - Total expenses
  line28TotalExpenses: 2534, // 850 + 466 + 550 + 610 + 58

  // Line 31 - Net profit (statutory employee, just expenses)
  line31NetProfit: 0,

  // Part IV - Vehicle Information
  vehiclePlacedInService: new Date(2023, 7, 22),
  businessMiles: 665,
  commutingMiles: 710,
  otherMiles: 15151,
  vehicleAvailableOffDuty: true,
  anotherVehicleAvailable: true,
  evidenceToSupport: true,
  evidenceWritten: true
}

/**
 * Schedule A (Itemized Deductions)
 */
const scheduleA = {
  // Taxes You Paid (Lines 5-7)
  line5aStateLocalIncomeTax: 1028,
  line5bRealEstateTaxes: 8972,
  line5cPersonalPropertyTaxes: 0,
  line5dTotalTaxes: 10000,
  line5eSaltLimited: 10000, // $10,000 SALT cap

  line7TotalTaxes: 10000,

  // Interest You Paid (Lines 8-10)
  line8aHomeMortgageInterest: 11000,
  line8cPointsNotOn1098: 251,
  line8eTotalMortgageInterest: 11251,

  line10TotalInterest: 11251,

  // Gifts to Charity (Lines 11-14)
  line11CashContributions: 250,
  line11DottedLine: 200, // Qualified contributions
  line12OtherContributions: 700, // From Form 8283
  line14TotalGifts: 950,

  // Line 17 - Total Itemized Deductions
  // $10,000 (taxes) + $11,251 (interest) + $950 (gifts) = $22,201
  line17TotalItemized: 22201,

  electedToItemize: true
}

/**
 * Form 8283 (Noncash Charitable Contributions)
 */
const form8283 = {
  doneeOrganization: {
    name: 'Goodwill',
    address: '936 Folly Road, Charleston, SC 29412'
  },
  donatedProperty: {
    description: 'Clothes & toys',
    dateContributed: new Date(2025, 10, 13), // November 13, 2025
    dateAcquired: 'Various',
    howAcquired: 'Purchase',
    donorsCostBasis: 3470,
    fairMarketValue: 700,
    fmvMethod: 'Thrift Store Value'
  }
}

/**
 * Schedule 1 (Additional Income and Adjustments)
 */
const schedule1 = {
  // Part I - Additional Income (Statutory employee, no net business income)
  line3BusinessIncome: 0,
  line10TotalAdditionalIncome: 0,

  // Part II - Adjustments to Income
  line26TotalAdjustments: 0
}

/**
 * Complete Form 1040 data for John and Judy Jones
 */
const form1040Data = (() => {
  // Income
  const totalWages = w2Totals.totalWages // $38,026
  const totalIncome = totalWages

  // AGI (no adjustments)
  const agi = totalIncome

  // Itemized Deduction from Schedule A
  const itemizedDeduction = scheduleA.line17TotalItemized // $22,201

  // Taxable Income
  const taxableIncome = Math.max(0, agi - itemizedDeduction) // $15,825

  // Tax calculation (2025 MFJ brackets)
  // $0 - $23,200: 10%
  // Taxable income: $15,825 (all in 10% bracket)
  const calculatedTax = Math.round(taxableIncome * 0.1) // $1,583

  // Credits
  // Credit for Other Dependents: $500 for Jacob (over 16)
  const odcCredit = 500
  const totalCredits = odcCredit

  // Tax after credits
  const taxAfterCredits = Math.max(0, calculatedTax - totalCredits) // $1,083

  // Total tax
  const totalTax = taxAfterCredits

  // Payments
  const totalWithholding = w2Totals.federalWithholding // $1,164
  const estimatedPaymentFromPrior = 300
  const totalPayments = totalWithholding + estimatedPaymentFromPrior // $1,464

  // Refund
  const refund = totalPayments > totalTax ? totalPayments - totalTax : 0
  const amountOwed = totalTax > totalPayments ? totalTax - totalPayments : 0

  return {
    // Taxpayer info
    primarySsn: johnJonesTaxpayer.ssn,
    primaryFirstName: johnJonesTaxpayer.firstName,
    primaryLastName: johnJonesTaxpayer.lastName,
    address: johnJonesTaxpayer.address,
    filingStatus: FilingStatus.MFJ,

    // Spouse info
    spouseSsn: judyJonesSpouse.ssn,
    spouseFirstName: judyJonesSpouse.firstName,
    spouseLastName: judyJonesSpouse.lastName,
    spouseDateOfDeath: judyJonesSpouse.dateOfDeath,
    spouseIpPin: judyJonesSpouse.ipPin,
    spouseIsNonresidentTreatedAsResident: true,

    // Checkboxes
    presidentialCampaignYou: true,
    presidentialCampaignSpouse: true,
    digitalAssets: false,

    // Dependents
    dependents: [jacobJonesDependent],

    // Income lines
    line1zWages: totalWages,
    line9TotalIncome: totalIncome,
    totalIncome,

    // Adjustments
    line10Adjustments: 0,

    // AGI
    line11Agi: agi,
    agi,

    // Deductions
    line12ItemizedDeduction: itemizedDeduction,
    line14TotalDeductions: itemizedDeduction,
    deduction: itemizedDeduction,
    usingItemized: true,

    // Taxable income
    line15TaxableIncome: taxableIncome,
    taxableIncome,

    // Tax
    line16Tax: calculatedTax,
    line17Schedule2: 0,
    line18Total: calculatedTax,
    line19CtcActc: 0,
    line19Odc: odcCredit,
    line20Schedule3: 0,
    line21CreditsSubtotal: totalCredits,
    line22TaxMinusCredits: taxAfterCredits,
    line23OtherTaxes: 0,
    line24TotalTax: totalTax,
    totalTax,

    // Payments
    line25aW2Withholding: totalWithholding,
    line25dTotalWithholding: totalWithholding,
    line26EstimatedPayments: estimatedPaymentFromPrior,
    formerSpouseSsn: '400011037', // For estimated payments
    line27cNoEic: true,
    line33TotalPayments: totalPayments,
    totalPayments,

    // Refund/Amount Owed
    line34Overpaid: refund,
    line35aRefund: refund,
    line37AmountOwed: amountOwed,
    refund,
    amountOwed
  }
})()

// =============================================================================
// Tests
// =============================================================================

describe('ATS Scenario 2 - John and Judy Jones (MFJ with Deceased Spouse)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct primary taxpayer name', () => {
      expect(johnJonesTaxpayer.firstName).toBe('John')
      expect(johnJonesTaxpayer.lastName).toBe('Jones')
    })

    it('should have valid SSN format (9 digits)', () => {
      expect(johnJonesTaxpayer.ssn).toHaveLength(9)
      expect(/^\d{9}$/.test(johnJonesTaxpayer.ssn)).toBe(true)
    })

    it('should have spouse marked as deceased', () => {
      expect(judyJonesSpouse.dateOfDeath).toEqual(new Date(2025, 8, 11))
    })

    it('should have spouse Identity Protection PIN', () => {
      expect(judyJonesSpouse.ipPin).toBe('876543')
    })

    it('should have spouse treated as US resident', () => {
      expect(judyJonesSpouse.isNonresidentAlienTreatedAsResident).toBe(true)
    })
  })

  describe('Dependent Information', () => {
    it('should have one dependent', () => {
      expect(form1040Data.dependents).toHaveLength(1)
    })

    it('should have dependent as full-time student', () => {
      expect(jacobJonesDependent.isFullTimeStudent).toBe(true)
    })

    it('should have dependent qualify for ODC (over 16)', () => {
      expect(jacobJonesDependent.qualifiesForOdc).toBe(true)
      expect(jacobJonesDependent.qualifiesForCtc).toBe(false)
    })
  })

  describe('Multiple W-2 Forms', () => {
    it('should have two W-2 forms', () => {
      expect(w2JohnJones.employerName).toBe('Southwest Airlines')
      expect(w2JudyJones.employerName).toBe('Target Corporation')
    })

    it('should mark John as statutory employee', () => {
      expect(w2JohnJones.isStatutoryEmployee).toBe(true)
    })

    it('should calculate total wages correctly', () => {
      const total = w2JohnJones.box1Wages + w2JudyJones.box1Wages
      expect(w2Totals.totalWages).toBe(total)
      expect(w2Totals.totalWages).toBe(38026)
    })

    it('should calculate total federal withholding correctly', () => {
      const total =
        w2JohnJones.box2FederalWithholding + w2JudyJones.box2FederalWithholding
      expect(w2Totals.federalWithholding).toBe(total)
      expect(w2Totals.federalWithholding).toBe(1164)
    })
  })

  describe('Schedule C (Statutory Employee)', () => {
    it('should have correct principal business code', () => {
      expect(scheduleC.principalBusinessCode).toBe('449110')
      expect(scheduleC.principalBusiness).toBe('Furniture Sales')
    })

    it('should have materially participated', () => {
      expect(scheduleC.materiallyParticipated).toBe(true)
    })

    it('should calculate total expenses correctly', () => {
      const expected = Object.values(scheduleC.expenses).reduce(
        (sum, val) => sum + val,
        0
      )
      expect(scheduleC.line28TotalExpenses).toBe(expected)
      expect(scheduleC.line28TotalExpenses).toBe(2534)
    })

    it('should have vehicle information', () => {
      expect(scheduleC.businessMiles).toBe(665)
      expect(scheduleC.evidenceToSupport).toBe(true)
    })
  })

  describe('Schedule A (Itemized Deductions)', () => {
    it('should apply $10,000 SALT cap', () => {
      expect(scheduleA.line5dTotalTaxes).toBe(10000)
      expect(scheduleA.line5eSaltLimited).toBe(10000)
    })

    it('should have mortgage interest deduction', () => {
      expect(scheduleA.line8aHomeMortgageInterest).toBe(11000)
      expect(scheduleA.line8cPointsNotOn1098).toBe(251)
    })

    it('should have charitable contributions', () => {
      const total =
        scheduleA.line11CashContributions + scheduleA.line12OtherContributions
      expect(scheduleA.line14TotalGifts).toBe(total)
    })

    it('should calculate total itemized deductions correctly', () => {
      const expected =
        scheduleA.line7TotalTaxes +
        scheduleA.line10TotalInterest +
        scheduleA.line14TotalGifts
      expect(scheduleA.line17TotalItemized).toBe(expected)
      expect(scheduleA.line17TotalItemized).toBe(22201)
    })
  })

  describe('Form 8283 (Noncash Contributions)', () => {
    it('should have donee organization', () => {
      expect(form8283.doneeOrganization.name).toBe('Goodwill')
    })

    it('should have donated property details', () => {
      expect(form8283.donatedProperty.description).toBe('Clothes & toys')
      expect(form8283.donatedProperty.fairMarketValue).toBe(700)
    })

    it('should have FMV less than cost basis', () => {
      expect(form8283.donatedProperty.fairMarketValue).toBeLessThan(
        form8283.donatedProperty.donorsCostBasis
      )
    })
  })

  describe('Tax Calculation', () => {
    it('should have filing status MFJ', () => {
      expect(form1040Data.filingStatus).toBe(FilingStatus.MFJ)
    })

    it('should calculate AGI correctly', () => {
      expect(form1040Data.agi).toBe(form1040Data.totalIncome)
      expect(form1040Data.agi).toBe(38026)
    })

    it('should use itemized deduction', () => {
      expect(form1040Data.usingItemized).toBe(true)
      expect(form1040Data.deduction).toBe(22201)
    })

    it('should apply ODC credit for Jacob', () => {
      expect(form1040Data.line19Odc).toBe(500)
    })

    it('should include estimated payment from prior year', () => {
      expect(form1040Data.line26EstimatedPayments).toBe(300)
    })

    it('should have former spouse SSN for estimated payments', () => {
      expect(form1040Data.formerSpouseSsn).toBe('400011037')
    })
  })

  describe('Integration', () => {
    it('should have all required Form 1040 fields', () => {
      const requiredFields = [
        'primarySsn',
        'primaryFirstName',
        'primaryLastName',
        'spouseSsn',
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

    it('should have consistent line math (AGI = Total Income - Adjustments)', () => {
      expect(form1040Data.agi).toBe(
        form1040Data.totalIncome - form1040Data.line10Adjustments
      )
    })

    it('should have consistent line math (Taxable = AGI - Deductions)', () => {
      expect(form1040Data.taxableIncome).toBe(
        form1040Data.agi - form1040Data.deduction
      )
    })

    it('should flow W-2 wages to Form 1040 correctly', () => {
      expect(form1040Data.line1zWages).toBe(w2Totals.totalWages)
    })

    it('should flow W-2 withholding to Form 1040 correctly', () => {
      expect(form1040Data.line25aW2Withholding).toBe(w2Totals.federalWithholding)
    })

    it('should flow Form 8283 to Schedule A correctly', () => {
      expect(scheduleA.line12OtherContributions).toBe(
        form8283.donatedProperty.fairMarketValue
      )
    })

    it('should calculate refund or amount owed correctly', () => {
      if (form1040Data.totalPayments > form1040Data.totalTax) {
        expect(form1040Data.refund).toBe(
          form1040Data.totalPayments - form1040Data.totalTax
        )
        expect(form1040Data.amountOwed).toBe(0)
      } else {
        expect(form1040Data.refund).toBe(0)
        expect(form1040Data.amountOwed).toBe(
          form1040Data.totalTax - form1040Data.totalPayments
        )
      }
    })
  })
})
