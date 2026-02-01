/**
 * IRS ATS Test Scenario NR-1 - Lucas LeBlanc
 *
 * Test Scenario Reference: IRS ATS Test Scenario NR-1 (ty25-1040-nr-mef-ats-scenario-1-10202025.pdf)
 * Primary Taxpayer: Lucas LeBlanc
 * Filing Status: Married Filing Separately (MFS)
 * No Dependents
 *
 * Key Features Tested:
 * - Form 1040-NR (Nonresident Alien Income Tax Return)
 * - Nonresident alien using simplified refund method
 * - Multiple W-2 forms (2 employers)
 * - Schedule C (Profit or Loss From Business - Independent Writer)
 * - Schedule SE with Form 4361 exemption (Minister exemption)
 * - IRA distributions (not taxable - Form 4361 on file)
 * - Form 5329 (Additional Taxes on Qualified Plans)
 * - Foreign address handling (Canada)
 * - Self-select signature PIN method
 *
 * Tax Year: 2025
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

// =============================================================================
// Test Data Fixtures - Lucas LeBlanc (Scenario NR-1)
// =============================================================================

/**
 * Primary taxpayer information - Nonresident Alien
 * ATS Reference SSN: 123-00-1111 (invalid for production)
 * Test SSN: 123011111 (valid format for testing)
 */
const lucasLeBlancTaxpayer = {
  firstName: 'Lucas',
  lastName: 'LeBlanc',
  ssn: '123011111',
  ssnAtsReference: '123-00-1111',
  address: {
    street: '105 Yonge Street',
    city: 'Toronto',
    state: '', // Foreign address - no US state
    zip: '' // Foreign address - no US zip
  },
  foreignAddress: {
    country: 'Canada',
    province: 'Ontario',
    postalCode: 'M4R-1A2'
  },
  dateOfBirth: new Date(1951, 2, 17), // March 17, 1951 - Age 74 in 2025
  occupation: 'Writer',
  digitalAssets: false,
  isNonresidentAlien: true,
  simplifiedRefundMethod: true,
  hasForm4361: true, // Minister exemption from SE tax
  signatureMethod: 'self_select_pin'
}

/**
 * W-2 #1 from Google
 * Primary employment income
 */
const w2Google = {
  employeeName: 'Lucas LeBlanc',
  employeeSsn: '123011111',
  employerName: 'Google',
  employerEin: '000000055',
  employerEinTest: '123456055',
  employerAddress: {
    street: '52 Henry Street',
    city: 'Detroit',
    state: 'MI' as const,
    zip: '48201'
  },
  // Box 1 - Wages, tips, other compensation
  box1Wages: 33255,
  // Box 2 - Federal income tax withheld
  box2FederalWithholding: 4788,
  // Box 3 - Social security wages
  box3SsWages: 33255,
  // Box 4 - Social security tax withheld
  box4SsTax: 2062,
  // Box 5 - Medicare wages and tips
  box5MedicareWages: 33255,
  // Box 6 - Medicare tax withheld
  box6MedicareTax: 482,
  // Boxes 15-20 - State/local (not applicable for nonresident)
  box15State: '',
  box16StateWages: 0,
  box17StateTax: 0
}

/**
 * W-2 #2 from Children of God
 * Secondary employment - possibly church/ministry related
 */
const w2ChildrenOfGod = {
  employeeName: 'Lucas LeBlanc',
  employeeSsn: '123011111',
  employerName: 'Children of God',
  employerEin: '000000013',
  employerEinTest: '123456013',
  employerAddress: {
    street: '107 West Lake Street',
    city: 'Detroit',
    state: 'MI' as const,
    zip: '48201'
  },
  // Box 1 - Wages
  box1Wages: 600,
  // Box 2 - Federal income tax withheld
  box2FederalWithholding: 0,
  // Box 3 - Social security wages
  box3SsWages: 600,
  // Box 4 - Social security tax withheld
  box4SsTax: 37,
  // Box 5 - Medicare wages and tips
  box5MedicareWages: 600,
  // Box 6 - Medicare tax withheld
  box6MedicareTax: 9,
  // Boxes 15-20 - State/local (not applicable)
  box15State: '',
  box16StateWages: 0,
  box17StateTax: 0
}

/**
 * Schedule C - Profit or Loss From Business
 * Self-employment as an independent writer
 * Business code 711510 - Independent artists, writers, and performers
 */
const scheduleC = {
  businessName: '',
  principalBusiness: 'Independent Writer',
  businessCode: '711510',
  businessAddress: {
    street: '105 Yonge Street',
    city: 'Toronto',
    country: 'Canada',
    postalCode: 'M4R-1A2'
  },
  accountingMethod: 'cash',
  materialParticipation: true,
  startedIn2025: false,

  // Part I - Income
  line1GrossReceipts: 27355,
  line2ReturnsAllowances: 0,
  line3GrossReceiptsNet: 27355,
  line4CostOfGoodsSold: 0,
  line5GrossProfit: 27355,
  line6OtherIncome: 0,
  line7GrossIncome: 27355,

  // Part II - Expenses
  line8Advertising: 150,
  line18OfficeExpense: 100,
  line22Supplies: 300,
  line23TaxesLicenses: 125,
  line28TotalExpenses: 675, // 150+100+300+125

  // Line 29 - Tentative profit
  line29TentativeProfit: 26680, // 27355 - 675

  // Line 30 - Home office deduction
  line30HomeOffice: 0,

  // Line 31 - Net profit
  line31NetProfit: 26680
}

/**
 * Schedule SE - Self-Employment Tax
 * Note: Taxpayer has Form 4361 on file (minister exemption)
 */
const scheduleSE = {
  hasForm4361: true,
  isMinister: true,

  // Line 2 - Net profit from Schedule C
  line2NetProfit: 26680,

  // Line 3 - Combined net earnings
  line3Combined: 26680,

  // Line 4a - 92.35% of line 3
  line4aNetEarnings: 24639.08, // 26680 * 0.9235

  // Due to Form 4361 exemption, no SE tax
  seTaxExempt: true,
  line12SeTax: 0,
  line13Deduction: 0
}

/**
 * IRA distribution information
 * Traditional IRA with required minimum distribution
 * Taxpayer is 74 years old, so RMD applies
 */
const iraInfo = {
  accountType: 'Traditional IRA',
  hasRmd: true,

  // Required Minimum Distribution
  rmdAmount: 10000,

  // Actual distribution taken
  distributionAmount: 6500,

  // Form 1040-NR Line 4
  line4aIraDistributions: 6500,
  line4bTaxableAmount: 0, // Not taxable per scenario

  // Shortfall for Form 5329
  rmdShortfall: 3500, // 10000 - 6500

  // Form 4361 affects IRA taxation
  form4361Exemption: true
}

/**
 * Form 5329 - Additional Taxes on Qualified Plans
 * Part IX - Additional Tax on Excess Accumulation
 * Taxpayer did not receive full RMD
 */
const form5329 = {
  // Part IX - Excess Accumulation
  line52bMinimumRequired: 10000, // RMD
  line53bAmountDistributed: 6500, // Actual distribution

  // Shortfall
  rmdShortfall: 3500, // 10000 - 6500

  // Penalty calculation (25% of shortfall per SECURE 2.0 Act)
  penaltyRate: 0.25,
  line54bPenalty: 875, // 3500 * 0.25

  // Total from Part IX
  line55Total: 875
}

/**
 * Schedule 1 - Additional Income and Adjustments
 */
const schedule1 = {
  // Part I - Additional Income
  line3BusinessIncome: 26680, // From Schedule C
  line10TotalAdditionalIncome: 26680,

  // Part II - Adjustments to Income
  line15SeTaxDeduction: 0, // Form 4361 exemption
  line26TotalAdjustments: 0
}

/**
 * Schedule 2 - Additional Taxes
 */
const schedule2 = {
  // Part I - Tax
  line1zAdditions: 0,
  line2Amt: 0,
  line3Total: 0,

  // Part II - Other Taxes
  line4SeTax: 0, // Form 4361 exemption
  line8Form5329: 875, // From Form 5329
  line21TotalOtherTaxes: 875
}

/**
 * Complete Form 1040-NR data for Lucas LeBlanc
 * Tax Year: 2025
 * Filing Status: Married Filing Separately (MFS)
 *
 * Note: Nonresident aliens cannot claim standard deduction
 * (except certain residents of India per US-India tax treaty)
 */
const form1040NRData = (() => {
  // W-2 income totals
  const w2WagesTotal = w2Google.box1Wages + w2ChildrenOfGod.box1Wages // $33,855
  const w2FederalWithholding =
    w2Google.box2FederalWithholding + w2ChildrenOfGod.box2FederalWithholding // $4,788

  // Schedule C income
  const scheduleCProfit = scheduleC.line31NetProfit // $26,680

  // Total effectively connected income (Line 9)
  // For 1040-NR: wages + business income (no IRA since not taxable)
  const iraDistributions = iraInfo.line4aIraDistributions
  const iraTaxable = iraInfo.line4bTaxableAmount

  // Line 1z - Total wages
  const line1zWages = w2WagesTotal // $33,855

  // Line 8 - Additional income from Schedule 1
  const line8Schedule1 = schedule1.line10TotalAdditionalIncome // $26,680

  // Line 9 - Total effectively connected income
  const line9TotalEci = line1zWages + iraTaxable + line8Schedule1 // $60,535

  // Line 10 - Adjustments
  const line10Adjustments = schedule1.line26TotalAdjustments // $0

  // Line 11a - Adjusted Gross Income
  const line11aAgi = line9TotalEci - line10Adjustments // $60,535

  // Line 12 - Itemized deductions (NRA cannot use standard deduction)
  const line12Deduction = 0

  // Line 13a - QBI deduction
  const line13aQbi = 0

  // Line 14 - Total deductions
  const line14TotalDeductions = line12Deduction + line13aQbi

  // Line 15 - Taxable income
  const line15TaxableIncome = Math.max(0, line11aAgi - line14TotalDeductions) // $60,535

  // Line 16 - Tax (using MFS tax brackets)
  // 2025 MFS brackets (same as Single):
  // $0 - $11,600: 10%
  // $11,601 - $47,150: 12%
  // $47,151 - $100,525: 22%
  const taxable = line15TaxableIncome
  let line16Tax: number
  if (taxable <= 11600) {
    line16Tax = taxable * 0.1
  } else if (taxable <= 47150) {
    line16Tax = 11600 * 0.1 + (taxable - 11600) * 0.12
  } else if (taxable <= 100525) {
    line16Tax = 11600 * 0.1 + 35550 * 0.12 + (taxable - 47150) * 0.22
  } else {
    line16Tax =
      11600 * 0.1 + 35550 * 0.12 + 53375 * 0.22 + (taxable - 100525) * 0.24
  }
  line16Tax = Math.round(line16Tax)

  // Line 17 - Schedule 2, line 3
  const line17Schedule2 = schedule2.line3Total // $0

  // Line 18 - Add lines 16 and 17
  const line18Total = line16Tax + line17Schedule2

  // Lines 19-22 - Credits
  const line19Ctc = 0
  const line20Schedule3 = 0
  const line21Credits = line19Ctc + line20Schedule3
  const line22TaxMinusCredits = Math.max(0, line18Total - line21Credits)

  // Line 23 - Other taxes (Schedule 2 line 21 for SE tax, Form 5329)
  const line23bOtherTaxes = schedule2.line21TotalOtherTaxes // $875
  const line23dTotalOther = line23bOtherTaxes

  // Line 24 - Total tax
  const line24TotalTax = line22TaxMinusCredits + line23dTotalOther

  // Line 25 - Federal income tax withheld
  const line25aW2Withholding = w2FederalWithholding
  const line25dTotalWithholding = line25aW2Withholding

  // Line 33 - Total payments
  const line33TotalPayments = line25dTotalWithholding

  // Refund or Amount Owed
  const refund =
    line33TotalPayments > line24TotalTax
      ? line33TotalPayments - line24TotalTax
      : 0
  const amountOwed =
    line24TotalTax > line33TotalPayments
      ? line24TotalTax - line33TotalPayments
      : 0

  return {
    // Form identification
    formType: '1040-NR',
    taxYear: 2025,
    primarySsn: lucasLeBlancTaxpayer.ssn,
    primaryFirstName: lucasLeBlancTaxpayer.firstName,
    primaryLastName: lucasLeBlancTaxpayer.lastName,
    address: lucasLeBlancTaxpayer.address,
    foreignAddress: lucasLeBlancTaxpayer.foreignAddress,
    filingStatus: 2, // MFS on Form 1040-NR (code 2, not 3)
    isNonresidentAlien: true,
    simplifiedRefundMethod: true,

    // Checkboxes
    digitalAssets: false,

    // No dependents
    dependents: [],

    // Income Section (Lines 1-9)
    line1aW2Wages: w2WagesTotal,
    line1zTotalWages: line1zWages,
    line4aIraDistributions: iraDistributions,
    line4bTaxableIra: iraTaxable,
    line8Schedule1: line8Schedule1,
    line9TotalEci: line9TotalEci,

    // Adjustments (Line 10-11)
    line10Adjustments: line10Adjustments,
    line11aAgi: line11aAgi,
    line11bAgi: line11aAgi,

    // Deductions (Lines 12-15)
    line12Deduction: line12Deduction,
    line13aQbi: line13aQbi,
    line14TotalDeductions: line14TotalDeductions,
    line15TaxableIncome: line15TaxableIncome,

    // Tax (Lines 16-24)
    line16Tax: line16Tax,
    line17Schedule2: line17Schedule2,
    line18Total: line18Total,
    line19Ctc: line19Ctc,
    line20Schedule3: line20Schedule3,
    line21Credits: line21Credits,
    line22TaxMinusCredits: line22TaxMinusCredits,
    line23bOtherTaxes: line23bOtherTaxes,
    line23dTotalOther: line23dTotalOther,
    line24TotalTax: line24TotalTax,

    // Payments (Lines 25-33)
    line25aW2Withholding: line25aW2Withholding,
    line25dTotalWithholding: line25dTotalWithholding,
    line33TotalPayments: line33TotalPayments,

    // Refund/Amount Owed (Lines 34-37)
    line34Overpaid: refund,
    line35aRefund: refund,
    line37AmountOwed: amountOwed,

    // Summary values
    totalIncome: line9TotalEci,
    agi: line11aAgi,
    taxableIncome: line15TaxableIncome,
    totalTax: line24TotalTax,
    totalPayments: line33TotalPayments,
    refund: refund,
    amountOwed: amountOwed,

    // Attached forms/schedules
    hasSchedule1: true,
    hasSchedule2: true,
    hasScheduleC: true,
    hasScheduleSE: true,
    hasForm5329: true,
    w2Count: 2,

    // Detailed form data
    w2Google: w2Google,
    w2ChildrenOfGod: w2ChildrenOfGod,
    scheduleC: scheduleC,
    scheduleSE: scheduleSE,
    iraInfo: iraInfo,
    form5329: form5329,
    schedule1: schedule1,
    schedule2: schedule2
  }
})()

// =============================================================================
// Tests
// =============================================================================

describe('ATS Scenario NR-1 - Lucas LeBlanc (Nonresident Alien)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct taxpayer name', () => {
      expect(lucasLeBlancTaxpayer.firstName).toBe('Lucas')
      expect(lucasLeBlancTaxpayer.lastName).toBe('LeBlanc')
    })

    it('should have valid SSN format (9 digits)', () => {
      expect(lucasLeBlancTaxpayer.ssn).toHaveLength(9)
      expect(/^\d{9}$/.test(lucasLeBlancTaxpayer.ssn)).toBe(true)
    })

    it('should be flagged as nonresident alien', () => {
      expect(lucasLeBlancTaxpayer.isNonresidentAlien).toBe(true)
    })

    it('should have foreign address components', () => {
      expect(lucasLeBlancTaxpayer.foreignAddress.country).toBe('Canada')
      expect(lucasLeBlancTaxpayer.foreignAddress.province).toBe('Ontario')
      expect(lucasLeBlancTaxpayer.foreignAddress.postalCode).toBe('M4R-1A2')
    })

    it('should have Form 4361 exemption flag', () => {
      expect(lucasLeBlancTaxpayer.hasForm4361).toBe(true)
    })

    it('should be 74 years old in 2025', () => {
      const dob = lucasLeBlancTaxpayer.dateOfBirth
      const ageIn2025 = 2025 - dob.getFullYear()
      expect(ageIn2025).toBe(74)
    })
  })

  describe('W-2 Income', () => {
    it('should have correct Google wages', () => {
      expect(w2Google.box1Wages).toBe(33255)
    })

    it('should have correct Google withholding', () => {
      expect(w2Google.box2FederalWithholding).toBe(4788)
    })

    it('should have correct Google SS wages', () => {
      expect(w2Google.box3SsWages).toBe(33255)
    })

    it('should have correct Children of God wages', () => {
      expect(w2ChildrenOfGod.box1Wages).toBe(600)
    })

    it('should have no withholding from Children of God', () => {
      expect(w2ChildrenOfGod.box2FederalWithholding).toBe(0)
    })

    it('should calculate total W-2 wages correctly', () => {
      const total = w2Google.box1Wages + w2ChildrenOfGod.box1Wages
      expect(total).toBe(33855)
    })

    it('should calculate total federal withholding correctly', () => {
      const total =
        w2Google.box2FederalWithholding + w2ChildrenOfGod.box2FederalWithholding
      expect(total).toBe(4788)
    })
  })

  describe('Schedule C (Business Income)', () => {
    it('should have correct gross receipts', () => {
      expect(scheduleC.line1GrossReceipts).toBe(27355)
    })

    it('should calculate expenses correctly', () => {
      const expectedExpenses =
        scheduleC.line8Advertising +
        scheduleC.line18OfficeExpense +
        scheduleC.line22Supplies +
        scheduleC.line23TaxesLicenses
      expect(expectedExpenses).toBe(675)
      expect(scheduleC.line28TotalExpenses).toBe(675)
    })

    it('should calculate net profit correctly', () => {
      const expected =
        scheduleC.line7GrossIncome - scheduleC.line28TotalExpenses
      expect(expected).toBe(26680)
      expect(scheduleC.line31NetProfit).toBe(expected)
    })

    it('should have correct business code for writer', () => {
      expect(scheduleC.businessCode).toBe('711510')
    })

    it('should use cash accounting method', () => {
      expect(scheduleC.accountingMethod).toBe('cash')
    })
  })

  describe('Schedule SE (Self-Employment Tax)', () => {
    it('should have Form 4361 exemption claimed', () => {
      expect(scheduleSE.hasForm4361).toBe(true)
      expect(scheduleSE.seTaxExempt).toBe(true)
    })

    it('should have Schedule C profit flow to Schedule SE', () => {
      expect(scheduleSE.line2NetProfit).toBe(scheduleC.line31NetProfit)
    })

    it('should have zero SE tax due to Form 4361 exemption', () => {
      expect(scheduleSE.line12SeTax).toBe(0)
    })

    it('should have zero SE deduction due to exemption', () => {
      expect(scheduleSE.line13Deduction).toBe(0)
    })
  })

  describe('IRA Distribution', () => {
    it('should have correct IRA distribution amount', () => {
      expect(iraInfo.distributionAmount).toBe(6500)
    })

    it('should have IRA not taxable per scenario', () => {
      expect(iraInfo.line4bTaxableAmount).toBe(0)
    })

    it('should have correct RMD amount', () => {
      expect(iraInfo.rmdAmount).toBe(10000)
    })

    it('should calculate RMD shortfall correctly', () => {
      const expected = iraInfo.rmdAmount - iraInfo.distributionAmount
      expect(expected).toBe(3500)
      expect(iraInfo.rmdShortfall).toBe(expected)
    })
  })

  describe('Form 5329 (Additional Taxes)', () => {
    it('should calculate RMD shortfall penalty correctly', () => {
      const shortfall = form5329.rmdShortfall
      const rate = form5329.penaltyRate
      const expectedPenalty = shortfall * rate

      expect(shortfall).toBe(3500)
      expect(rate).toBe(0.25) // SECURE 2.0 reduced rate
      expect(expectedPenalty).toBe(875)
      expect(form5329.line54bPenalty).toBe(expectedPenalty)
    })

    it('should use SECURE 2.0 penalty rate (25% vs old 50%)', () => {
      expect(form5329.penaltyRate).toBe(0.25)
    })
  })

  describe('Form 1040-NR Tax Calculation', () => {
    it('should be form type 1040-NR', () => {
      expect(form1040NRData.formType).toBe('1040-NR')
    })

    it('should have filing status MFS (code 2)', () => {
      expect(form1040NRData.filingStatus).toBe(2)
    })

    it('should have correct total wages on line 1z', () => {
      expect(form1040NRData.line1zTotalWages).toBe(33855)
    })

    it('should calculate AGI correctly', () => {
      const expectedAgi =
        form1040NRData.line1zTotalWages +
        form1040NRData.line4bTaxableIra +
        form1040NRData.line8Schedule1
      expect(form1040NRData.line11aAgi).toBe(expectedAgi)
    })

    it('should not allow standard deduction for NRA', () => {
      expect(form1040NRData.line12Deduction).toBe(0)
    })

    it('should have taxable income equal to AGI for NRA with no deductions', () => {
      expect(form1040NRData.line15TaxableIncome).toBe(form1040NRData.line11aAgi)
    })

    it('should include Form 5329 penalty in other taxes', () => {
      expect(form1040NRData.line23bOtherTaxes).toBe(875)
    })
  })

  describe('Business Rules', () => {
    it('should use Form 1040-NR for nonresident alien', () => {
      expect(form1040NRData.formType).toBe('1040-NR')
      expect(form1040NRData.isNonresidentAlien).toBe(true)
    })

    it('should have Form 4361 exempt SE tax', () => {
      expect(scheduleSE.hasForm4361).toBe(true)
      expect(scheduleSE.line12SeTax).toBe(0)
    })

    it('should include RMD penalty in total tax', () => {
      const form5329Penalty = form1040NRData.form5329.line54bPenalty
      const otherTaxes = form1040NRData.line23bOtherTaxes

      expect(form5329Penalty).toBe(875)
      expect(otherTaxes).toBeGreaterThanOrEqual(form5329Penalty)
    })
  })

  describe('Integration', () => {
    it('should have all required Form 1040-NR fields', () => {
      const requiredFields = [
        'formType',
        'taxYear',
        'primarySsn',
        'primaryFirstName',
        'primaryLastName',
        'filingStatus',
        'isNonresidentAlien',
        'totalIncome',
        'agi',
        'taxableIncome',
        'totalTax',
        'totalPayments'
      ]

      for (const field of requiredFields) {
        expect(form1040NRData).toHaveProperty(field)
      }
    })

    it('should flow Schedule C profit to Schedule 1', () => {
      expect(scheduleC.line31NetProfit).toBe(schedule1.line3BusinessIncome)
    })

    it('should flow Schedule 1 to Form 1040-NR line 8', () => {
      expect(schedule1.line10TotalAdditionalIncome).toBe(
        form1040NRData.line8Schedule1
      )
    })

    it('should flow Form 5329 penalty to Schedule 2', () => {
      expect(form5329.line55Total).toBe(schedule2.line8Form5329)
    })

    it('should flow Schedule 2 to Form 1040-NR line 23b', () => {
      expect(schedule2.line21TotalOtherTaxes).toBe(
        form1040NRData.line23bOtherTaxes
      )
    })

    it('should flow W-2 withholding to payments section', () => {
      const w2Wh =
        form1040NRData.w2Google.box2FederalWithholding +
        form1040NRData.w2ChildrenOfGod.box2FederalWithholding
      expect(form1040NRData.line25aW2Withholding).toBe(w2Wh)
    })

    it('should calculate refund or amount owed correctly', () => {
      const payments = form1040NRData.totalPayments
      const tax = form1040NRData.totalTax
      const refund = form1040NRData.refund
      const owed = form1040NRData.amountOwed

      if (payments > tax) {
        expect(refund).toBe(payments - tax)
        expect(owed).toBe(0)
      } else {
        expect(refund).toBe(0)
        expect(owed).toBe(tax - payments)
      }
    })
  })
})

export {}
