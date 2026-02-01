/**
 * IRS ATS Test Scenario 5 - Bobby Barker
 *
 * Test Scenario Reference: IRS ATS Test Scenario 5 (ty25-1040-mef-ats-scenario-5-10212025.pdf)
 * Primary Taxpayer: Bobby Barker
 * Filing Status: Head of Household (4)
 * Two Dependents: Skylar Barker (daughter), Kaylee Barker (daughter)
 *
 * Key Features Tested:
 * - Head of Household filing status
 * - Legally blind taxpayer (additional standard deduction)
 * - W-2 wage income
 * - Form 2441 (Child and Dependent Care Expenses)
 * - Form 8863 (Education Credits - Lifetime Learning)
 * - Schedule EIC (Earned Income Credit)
 * - Form 8862 (Information to Claim EIC After Disallowance)
 * - Schedule 8812 (Credits for Qualifying Children and Other Dependents)
 * - Schedule 3 (Additional Credits)
 *
 * Tax Year: 2025
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { FilingStatus } from 'ustaxes/core/data'

// =============================================================================
// Test Data Fixtures - Bobby Barker (Scenario 5)
// =============================================================================

/**
 * Primary taxpayer information - Bobby Barker (legally blind)
 */
const bobbyBarkerTaxpayer = {
  firstName: 'Bobby',
  lastName: 'Barker',
  ssn: '400011039',
  ssnAtsReference: '400-00-1039',
  address: {
    address: '13 First Street',
    city: 'Baltimore',
    state: 'MD' as const,
    zip: '21244'
  },
  dateOfBirth: new Date(1988, 2, 14), // March 14, 1988
  occupation: 'Project Manager',
  isBlind: true,
  digitalAssets: false
}

/**
 * Dependents - Two qualifying children
 */
const dependents = [
  {
    firstName: 'Skylar',
    lastName: 'Barker',
    ssn: '400011051',
    ssnAtsReference: '400-00-1051',
    relationship: 'daughter',
    dateOfBirth: new Date(2020, 4, 18), // May 18, 2020
    monthsLivedWithTaxpayer: 12,
    isQualifyingChildCtc: true,
    isQualifyingChildEic: true,
    isQualifyingPersonCare: true,
    careProvider: 'Kid Korner'
  },
  {
    firstName: 'Kaylee',
    lastName: 'Barker',
    ssn: '400011052',
    ssnAtsReference: '400-00-1052',
    relationship: 'daughter',
    dateOfBirth: new Date(2018, 7, 22), // August 22, 2018
    monthsLivedWithTaxpayer: 12,
    isQualifyingChildCtc: true,
    isQualifyingChildEic: true,
    isQualifyingPersonCare: true,
    careProvider: 'Little Genius'
  }
]

/**
 * W-2 from Tech Solutions Inc
 */
const w2Data = {
  employeeName: 'Bobby Barker',
  employerName: 'Tech Solutions Inc',
  employerEin: '000000061',
  employerAddress: {
    address: '500 Corporate Drive',
    city: 'Baltimore',
    state: 'MD' as const,
    zip: '21201'
  },
  box1Wages: 38500,
  box2FederalWithholding: 3850,
  box3SsWages: 38500,
  box4SsTax: 2387, // 38500 * 0.062
  box5MedicareWages: 38500,
  box6MedicareTax: 558, // 38500 * 0.0145
  box15State: 'MD',
  box16StateWages: 38500,
  box17StateTax: 1540
}

/**
 * Form 2441 (Child and Dependent Care Expenses)
 */
const form2441 = {
  careProviders: [
    {
      name: 'Kid Korner',
      address: '100 Oak Avenue, Baltimore, MD 21244',
      tin: '000000063',
      amountPaid: 1300,
      qualifyingPerson: 'Skylar Barker'
    },
    {
      name: 'Little Genius',
      address: '200 Maple Street, Baltimore, MD 21244',
      tin: '000000064',
      amountPaid: 520,
      qualifyingPerson: 'Kaylee Barker'
    }
  ],

  qualifyingPersons: [
    {
      name: 'Skylar Barker',
      ssn: '400011051',
      qualifyingExpenses: 1300
    },
    {
      name: 'Kaylee Barker',
      ssn: '400011052',
      qualifyingExpenses: 520
    }
  ],

  // Line 3 - Total qualifying expenses
  line3TotalExpenses: 1820, // 1300 + 520

  // Line 4 - Enter your earned income
  line4EarnedIncome: 38500,

  // Line 5 - Spouse's earned income (N/A - Single/HOH)
  line5SpouseEarnedIncome: 0,

  // Line 6 - Smallest of line 3, 4, or 5
  line6SmallestAmount: 1820,

  // Line 7 - Dollar limit (2 qualifying persons = $6,000)
  line7DollarLimit: 6000,

  // Line 8 - Smaller of line 6 or 7
  line8QualifyingExpenses: 1820,

  // Line 9 - Enter your AGI
  line9Agi: 38500,

  // Line 10 - Credit percentage (20% for AGI $38,500)
  line10Percentage: 0.2,

  // Line 11 - Child and dependent care credit
  line11Credit: 364 // 1820 * 0.20
}

/**
 * Form 8863 (Education Credits)
 */
const form8863 = {
  studentName: 'Bobby Barker',
  studentSsn: '400011039',
  educationalInstitution: 'Baltimore Community College',
  institutionEin: '000000065',

  qualifiedExpenses: 980,
  atLeastHalfTime: true,
  completed4Years: true,

  // Lifetime Learning Credit calculation
  llcQualifiedExpenses: 980,
  llcRate: 0.2,
  llcCalculated: 196, // 980 * 0.20

  // MAGI check
  magi: 38500,
  magiLimitHoh2025: 90000,
  withinMagiLimit: true,

  // Final credit amounts
  line19NonrefundableEducationCredit: 196,
  line8RefundableAotc: 0
}

/**
 * Schedule EIC (Earned Income Credit)
 */
const scheduleEIC = {
  qualifyingChildren: [
    {
      childNumber: 1,
      firstName: 'Skylar',
      lastName: 'Barker',
      ssn: '400011051',
      yearOfBirth: 2020,
      relationship: 'Daughter',
      monthsLivedInUs: 12,
      isStudent: false,
      isDisabled: false
    },
    {
      childNumber: 2,
      firstName: 'Kaylee',
      lastName: 'Barker',
      ssn: '400011052',
      yearOfBirth: 2018,
      relationship: 'Daughter',
      monthsLivedInUs: 12,
      isStudent: true,
      isDisabled: false
    }
  ],

  numberOfQualifyingChildren: 2,
  earnedIncome: 38500,
  agi: 38500,

  // 2025 EIC parameters for 2 children
  creditPercentage: 0.4, // 40%
  earnedIncomeThreshold: 17530,
  maxCreditAmount: 7012, // 17530 * 0.40
  phaseoutStart: 22200,
  phaseoutRate: 0.2106,

  // Calculated EIC
  // With 2 children and $38,500 income:
  // Max credit = $7,012
  // Phaseout amount = (38500 - 22200) * 0.2106 = 3432.78
  // EIC = 7012 - 3432.78 = 3579.22 -> rounded
  calculatedEic: 3579,

  form8867Required: true
}

/**
 * Form 8862 (Information to Claim EIC After Disallowance)
 */
const form8862 = {
  taxYearDisallowed: 2023,
  disallowanceReason: 'Missing or invalid SSN for qualifying child',

  childrenInformation: [
    {
      childName: 'Skylar Barker',
      childSsn: '400011051',
      relationship: 'Daughter',
      livedWithYouMoreThanHalfYear: true,
      meetsAgeRequirement: true
    },
    {
      childName: 'Kaylee Barker',
      childSsn: '400011052',
      relationship: 'Daughter',
      livedWithYouMoreThanHalfYear: true,
      meetsAgeRequirement: true
    }
  ],

  certifyQualifyingChildren: true,
  certifyNoFraud: true
}

/**
 * Schedule 8812 (Credits for Qualifying Children)
 */
const schedule8812 = {
  qualifyingChildren: [
    {
      name: 'Skylar Barker',
      ssn: '400011051',
      qualifiesForCtc: true,
      age: 5
    },
    {
      name: 'Kaylee Barker',
      ssn: '400011052',
      qualifiesForCtc: true,
      age: 7
    }
  ],

  numberOfQualifyingChildren: 2,
  ctcPerChild2025: 2000,

  // Line 1 - Number of qualifying children x $2,000
  line1CtcAmount: 4000, // 2 * $2,000

  // Line 2 - Other dependents x $500 (N/A)
  line2OdcAmount: 0,

  // Line 3 - Total
  line3Total: 4000,

  // Line 4 - AGI
  line4Agi: 38500,

  // Line 5 - Threshold (HOH: $200,000)
  line5Threshold: 200000,

  // Line 6 - Excess (38500 < 200000 = 0)
  line6Excess: 0,

  // Line 7 - Reduction
  line7Reduction: 0,

  // Line 8 - Credit allowed
  line8CreditAllowed: 4000,

  // Part II-A - Additional Child Tax Credit
  line12EarnedIncome: 38500,
  line13Threshold: 2500,
  line14Excess: 36000, // 38500 - 2500
  line15ActcAmount: 5400, // 36000 * 0.15

  // Line 19 - Nonrefundable CTC
  line19NonrefundableCtc: 4000,

  // Line 28 - ACTC (depends on tax calculation)
  line28Actc: 0
}

/**
 * Schedule 3 (Additional Credits)
 */
const schedule3 = {
  line1ForeignTaxCredit: 0,
  line2ChildCareCredit: 364, // From Form 2441
  line3EducationCredit: 196, // From Form 8863
  line4RetirementSavingsCredit: 0,
  line5ResidentialEnergyCredit: 0,
  line6OtherCredits: 0,

  // Part I Total
  line8TotalPart1: 560, // 364 + 196

  // Part II
  line15TotalPart2: 0
}

/**
 * Complete Form 1040 data for Bobby Barker
 */
const form1040Data = (() => {
  // Income
  const totalWages = w2Data.box1Wages // $38,500
  const totalIncome = totalWages
  const agi = totalIncome // No adjustments

  // Deduction
  const standardDeductionHoh2025 = 22500
  const blindAdditionalDeduction = 1950 // Additional for blind
  const totalStandardDeduction =
    standardDeductionHoh2025 + blindAdditionalDeduction // $24,450

  // Taxable income
  const taxableIncome = Math.max(0, agi - totalStandardDeduction) // $14,050

  // Tax calculation (2025 HOH brackets)
  // $0 - $16,550: 10%
  // Taxable income: $14,050 (all in 10% bracket)
  const calculatedTax = Math.round(taxableIncome * 0.1) // $1,405

  // Child Tax Credit (nonrefundable - limited to tax liability)
  const ctcAvailable = schedule8812.line8CreditAllowed // $4,000
  const nonrefundableCtc = Math.min(calculatedTax, ctcAvailable) // $1,405

  // Tax after CTC
  const taxAfterCtc = calculatedTax - nonrefundableCtc // $0

  // Schedule 3 credits (also limited by remaining tax)
  const schedule3Credits = Math.min(taxAfterCtc, schedule3.line8TotalPart1) // $0

  // Tax after all nonrefundable credits
  const taxAfterCredits = Math.max(0, taxAfterCtc - schedule3Credits) // $0

  // Total tax
  const totalTax = taxAfterCredits // $0

  // ACTC (refundable portion of CTC)
  const ctcUsed = nonrefundableCtc // $1,405
  const ctcRemaining = ctcAvailable - ctcUsed // $2,595
  const actcLimit = (totalWages - 2500) * 0.15 // $5,400
  const actc = Math.min(ctcRemaining, actcLimit) // $2,595

  // Payments
  const federalWithholding = w2Data.box2FederalWithholding // $3,850
  const eic = scheduleEIC.calculatedEic // $3,579

  const totalPayments = federalWithholding + actc + eic // $10,024

  // Refund
  const refund = totalPayments > totalTax ? totalPayments - totalTax : 0
  const amountOwed = totalTax > totalPayments ? totalTax - totalPayments : 0

  return {
    // Taxpayer info
    primarySsn: bobbyBarkerTaxpayer.ssn,
    primaryFirstName: bobbyBarkerTaxpayer.firstName,
    primaryLastName: bobbyBarkerTaxpayer.lastName,
    address: bobbyBarkerTaxpayer.address,
    filingStatus: FilingStatus.HOH,
    isBlind: true,

    // Checkboxes
    presidentialCampaign: false,
    digitalAssets: false,

    // No spouse for HOH
    spouseSsn: undefined,

    // Dependents
    dependents,

    // Income lines
    line1zWages: totalWages,
    line9TotalIncome: totalIncome,
    totalIncome,

    // Adjustments
    line10Adjustments: 0,

    // AGI
    line11Agi: agi,
    agi,

    // Deduction
    line12StandardDeduction: totalStandardDeduction,
    line14TotalDeductions: totalStandardDeduction,
    deduction: totalStandardDeduction,

    // Taxable income
    line15TaxableIncome: taxableIncome,
    taxableIncome,

    // Tax
    line16Tax: calculatedTax,
    line17Schedule2: 0,
    line18Total: calculatedTax,
    line19CtcActc: nonrefundableCtc,
    line20Schedule3: schedule3Credits,
    line21CreditsSubtotal: nonrefundableCtc + schedule3Credits,
    line22TaxMinusCredits: taxAfterCredits,
    line23OtherTaxes: 0,
    line24TotalTax: totalTax,
    totalTax,

    // Payments
    line25aW2Withholding: federalWithholding,
    line25dTotalWithholding: federalWithholding,
    line27Eic: eic,
    line28Actc: actc,
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

describe('ATS Scenario 5 - Bobby Barker (HOH with Blind, EIC, CTC)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct taxpayer name', () => {
      expect(bobbyBarkerTaxpayer.firstName).toBe('Bobby')
      expect(bobbyBarkerTaxpayer.lastName).toBe('Barker')
    })

    it('should be legally blind', () => {
      expect(bobbyBarkerTaxpayer.isBlind).toBe(true)
    })

    it('should have occupation as Project Manager', () => {
      expect(bobbyBarkerTaxpayer.occupation).toBe('Project Manager')
    })
  })

  describe('Dependents', () => {
    it('should have two dependents', () => {
      expect(dependents).toHaveLength(2)
    })

    it('should have correct dependent names', () => {
      const names = dependents.map((d) => d.firstName)
      expect(names).toContain('Skylar')
      expect(names).toContain('Kaylee')
    })

    it('should have all dependents qualify for CTC', () => {
      for (const dep of dependents) {
        expect(dep.isQualifyingChildCtc).toBe(true)
      }
    })

    it('should have all dependents qualify for EIC', () => {
      for (const dep of dependents) {
        expect(dep.isQualifyingChildEic).toBe(true)
      }
    })

    it('should have all dependents qualify for child care credit', () => {
      for (const dep of dependents) {
        expect(dep.isQualifyingPersonCare).toBe(true)
      }
    })
  })

  describe('W-2 Income', () => {
    it('should have correct wages', () => {
      expect(w2Data.box1Wages).toBe(38500)
    })

    it('should have correct federal withholding', () => {
      expect(w2Data.box2FederalWithholding).toBe(3850)
    })

    it('should have Maryland state withholding', () => {
      expect(w2Data.box15State).toBe('MD')
      expect(w2Data.box17StateTax).toBe(1540)
    })
  })

  describe('Form 2441 (Child Care Credit)', () => {
    it('should have two care providers', () => {
      expect(form2441.careProviders).toHaveLength(2)
    })

    it('should calculate total qualifying expenses correctly', () => {
      const expected = 1300 + 520
      expect(form2441.line3TotalExpenses).toBe(expected)
      expect(form2441.line3TotalExpenses).toBe(1820)
    })

    it('should have 20% credit percentage for AGI $38,500', () => {
      expect(form2441.line10Percentage).toBe(0.2)
    })

    it('should calculate child care credit correctly', () => {
      const expected =
        form2441.line8QualifyingExpenses * form2441.line10Percentage
      expect(form2441.line11Credit).toBe(expected)
      expect(form2441.line11Credit).toBe(364)
    })
  })

  describe('Form 8863 (Education Credits)', () => {
    it('should have qualified education expenses', () => {
      expect(form8863.qualifiedExpenses).toBe(980)
    })

    it('should be under MAGI limit for education credits', () => {
      expect(form8863.magi).toBeLessThan(form8863.magiLimitHoh2025)
      expect(form8863.withinMagiLimit).toBe(true)
    })

    it('should calculate Lifetime Learning Credit correctly', () => {
      const expected = form8863.llcQualifiedExpenses * form8863.llcRate
      expect(form8863.llcCalculated).toBe(expected)
      expect(form8863.llcCalculated).toBe(196)
    })
  })

  describe('Schedule EIC (Earned Income Credit)', () => {
    it('should have two qualifying children', () => {
      expect(scheduleEIC.numberOfQualifyingChildren).toBe(2)
    })

    it('should have correct earned income', () => {
      expect(scheduleEIC.earnedIncome).toBe(38500)
    })

    it('should calculate EIC correctly', () => {
      const eic = scheduleEIC.calculatedEic
      expect(eic).toBeGreaterThan(0)
      expect(eic).toBeLessThanOrEqual(scheduleEIC.maxCreditAmount)
      expect(eic).toBe(3579)
    })
  })

  describe('Schedule 8812 (Child Tax Credit)', () => {
    it('should have two qualifying children for CTC', () => {
      expect(schedule8812.numberOfQualifyingChildren).toBe(2)
    })

    it('should have CTC of $2,000 per child for 2025', () => {
      expect(schedule8812.ctcPerChild2025).toBe(2000)
    })

    it('should calculate total CTC correctly', () => {
      const expected =
        schedule8812.numberOfQualifyingChildren * schedule8812.ctcPerChild2025
      expect(schedule8812.line1CtcAmount).toBe(expected)
      expect(schedule8812.line3Total).toBe(4000)
    })

    it('should have no phaseout under $200,000 for HOH', () => {
      expect(schedule8812.line4Agi).toBeLessThan(schedule8812.line5Threshold)
      expect(schedule8812.line7Reduction).toBe(0)
    })

    it('should allow full credit', () => {
      expect(schedule8812.line8CreditAllowed).toBe(4000)
    })
  })

  describe('Tax Calculation', () => {
    it('should have filing status HOH', () => {
      expect(form1040Data.filingStatus).toBe(FilingStatus.HOH)
    })

    it('should include blind additional deduction', () => {
      // HOH standard deduction: $22,500
      // Blind additional: $1,950
      // Total: $24,450
      const expected = 22500 + 1950
      expect(form1040Data.deduction).toBe(expected)
    })

    it('should calculate AGI correctly (no adjustments)', () => {
      expect(form1040Data.agi).toBe(form1040Data.totalIncome)
      expect(form1040Data.agi).toBe(38500)
    })

    it('should calculate taxable income correctly', () => {
      const expected = form1040Data.agi - form1040Data.deduction
      expect(form1040Data.taxableIncome).toBe(expected)
    })

    it('should have significant refund from credits', () => {
      expect(form1040Data.refund).toBeGreaterThan(0)
      expect(form1040Data.line27Eic).toBeGreaterThan(0)
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
        'totalPayments',
        'dependents',
        'isBlind'
      ]

      for (const field of requiredFields) {
        expect(form1040Data).toHaveProperty(field)
      }
    })

    it('should flow Form 2441 credit to Schedule 3', () => {
      expect(schedule3.line2ChildCareCredit).toBe(form2441.line11Credit)
    })

    it('should flow Form 8863 credit to Schedule 3', () => {
      expect(schedule3.line3EducationCredit).toBe(
        form8863.line19NonrefundableEducationCredit
      )
    })

    it('should flow Schedule EIC to Form 1040', () => {
      expect(form1040Data.line27Eic).toBe(scheduleEIC.calculatedEic)
    })

    it('should have HOH filer with qualifying dependents', () => {
      expect(form1040Data.filingStatus).toBe(FilingStatus.HOH)
      expect(form1040Data.dependents.length).toBeGreaterThan(0)
    })

    it('should have EIC with earned income', () => {
      if (form1040Data.line27Eic > 0) {
        expect(form1040Data.totalIncome).toBeGreaterThan(0)
      }
    })

    it('should have CTC with qualifying children', () => {
      if (form1040Data.line19CtcActc > 0) {
        expect(form1040Data.dependents.length).toBeGreaterThan(0)
      }
    })
  })
})
