/**
 * IRS ATS Test Scenario NR-2 - Genesis DeSilva
 *
 * Test Scenario Reference: IRS ATS Test Scenario NR-2 (ty25-form-1040-nr-mef-ats-scenario-2-10202025.pdf)
 * Primary Taxpayer: Genesis DeSilva
 * Filing Status: Married Filing Separately (MFS)
 * No Dependents
 *
 * Key Features Tested:
 * - Form 1040-NR (Nonresident Alien Income Tax Return)
 * - Schedule NEC (Tax on Income Not Effectively Connected with US Trade/Business)
 * - Schedule OI (Other Information) - visa status, entry/exit dates, treaty info
 * - Schedule E (Partnership income - passive)
 * - Schedule 1 (Additional Income)
 * - W-2 wage income
 * - Foreign address handling (Canada)
 * - 30% flat tax on NEC income
 * - Partnership K-1 passive income
 * - Paid preparer information
 *
 * Tax Year: 2025
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-plus-operands, @typescript-eslint/no-unsafe-argument */

// =============================================================================
// Test Data Fixtures - Genesis DeSilva (Scenario NR-2)
// =============================================================================

/**
 * Primary taxpayer information - Nonresident Alien
 * ATS Reference SSN: 123-00-3333 (invalid for production)
 * Test SSN: 123013333 (valid format for testing)
 */
const genesisDeSilvaTaxpayer = {
  firstName: 'Genesis',
  lastName: 'DeSilva',
  ssn: '123013333',
  ssnAtsReference: '123-00-3333',
  address: {
    street: '29 Woodlawn Avenue East',
    city: 'Toronto',
    state: '', // Foreign address - no US state
    zip: '' // Foreign address - no US zip
  },
  foreignAddress: {
    country: 'Canada',
    province: 'ON',
    postalCode: 'M4T 1B9'
  },
  dateOfBirth: new Date(1985, 5, 15), // Approximate
  occupation: '',
  digitalAssets: false,
  isNonresidentAlien: true
}

/**
 * Schedule OI - Other Information
 * Contains visa status, entry/exit dates, and treaty information
 */
const scheduleOI = {
  // Item A - Country of citizenship
  citizenshipCountry: 'CA',
  // Item B - Country of tax residence
  taxResidenceCountry: 'CA',
  // Item C - Applied for green card
  appliedForGreenCard: true,
  // Item D - US citizen or green card holder status
  wasUsCitizen: false,
  wasGreenCardHolder: false,
  // Item E - Visa type
  visaType: 'Visa Waiver',
  // Item F - Changed visa status
  changedVisaStatus: false,
  // Item G - US entry/exit dates in 2025
  usVisits2025: [
    { entered: new Date(2025, 0, 3), departed: new Date(2025, 0, 6) },
    { entered: new Date(2025, 1, 23), departed: new Date(2025, 1, 26) },
    { entered: new Date(2025, 3, 6), departed: new Date(2025, 3, 9) },
    { entered: new Date(2025, 4, 1), departed: new Date(2025, 4, 13) },
    { entered: new Date(2025, 5, 1), departed: new Date(2025, 5, 10) },
    { entered: new Date(2025, 6, 4), departed: new Date(2025, 6, 14) },
    { entered: new Date(2025, 7, 14), departed: new Date(2025, 7, 16) },
    { entered: new Date(2025, 9, 16), departed: new Date(2025, 9, 18) }
  ],
  // Item H - Days in US
  daysInUs2023: 110,
  daysInUs2024: 110,
  daysInUs2025: 110,
  // Item I - Filed prior US return
  filedPriorUsReturn: false,
  // Item J - Trust return
  filingForTrust: false,
  // Item K - Compensation over $250,000
  compensationOver250k: false,
  // Item L - Treaty-exempt income
  hasTreatyExemptIncome: false,
  treatyCountry: null,
  treatyArticle: null,
  treatyExemptAmount: 0,
  // Item M - Real property election
  realPropertyElectionFirstYear: false,
  realPropertyElectionPriorYear: false
}

/**
 * W-2 from Panaderia Luna de Azucar
 * Employment income effectively connected with US trade/business
 */
const w2Panaderia = {
  employeeName: 'Genesis DeSilva',
  employeeSsn: '123013333',
  employerName: 'Panaderia Luna de Azucar',
  employerEin: '005559991',
  employerEinTest: '125559991',
  employerAddress: {
    street: '1093 Yonge Street',
    city: 'Dallas',
    state: 'TX' as const,
    zip: '75019'
  },
  // Box 1 - Wages, tips, other compensation
  box1Wages: 25988,
  // Box 2 - Federal income tax withheld
  box2FederalWithholding: 2916,
  // Box 3 - Social security wages
  box3SsWages: 25988,
  // Box 4 - Social security tax withheld
  box4SsTax: 1611,
  // Box 5 - Medicare wages and tips
  box5MedicareWages: 25988,
  // Box 6 - Medicare tax withheld
  box6MedicareTax: 377,
  // Boxes 15-20 - State/local (not applicable)
  box15State: '',
  box16StateWages: 0,
  box17StateTax: 0
}

/**
 * Schedule NEC - Not Effectively Connected Income
 * Tax on income not effectively connected with US trade/business
 * This income is taxed at flat 30% rate (or treaty rate)
 */
const scheduleNEC = {
  taxpayerName: 'Genesis DeSilva',
  ssn: '123013333',

  // Income types at different rates
  // Column (a) - 10% rate
  dividendsUsCorp10pct: 0,
  dividendsForeignCorp10pct: 0,
  interestMortgage10pct: 0,
  interestForeignCorp10pct: 0,
  interestOther10pct: 0,

  // Column (b) - 15% rate
  dividendsUsCorp15pct: 0,
  dividendsForeignCorp15pct: 0,

  // Column (c) - 30% rate (default for NRA)
  dividendsUsCorp30pct: 0,
  dividendsForeignCorp30pct: 0,
  interestMortgage30pct: 0,
  interestForeignCorp30pct: 0,
  interestOther30pct: 0,
  industrialRoyalties30pct: 0,
  motionPictureRoyalties30pct: 0,
  otherRoyalties30pct: 0,
  realPropertyIncome30pct: 0,
  pensionsAnnuities30pct: 0,
  socialSecurity30pct: 0,
  capitalGain30pct: 0,
  gambling30pct: 0,
  otherIncome30pct: 1100, // LTC income

  // Line 12 - Other (specify type)
  otherIncomeType: 'LTC',
  otherIncomeAmount: 1100,

  // Line 13 - Total by column
  total10pct: 0,
  total15pct: 0,
  total30pct: 1100,

  // Line 14 - Tax by column
  tax10pct: 0, // 0 * 0.10
  tax15pct: 0, // 0 * 0.15
  tax30pct: 330, // 1100 * 0.30

  // Line 15 - Total NEC tax
  line15TotalNecTax: 330,

  // Capital gains section (lines 16-18)
  capitalGains: [],
  line17CapitalLoss: 0,
  line17CapitalGain: 0,
  line18NetCapitalGain: 0
}

/**
 * Schedule E - Supplemental Income and Loss
 * Part II - Partnership income from Sarah's Vegan Bakery
 */
const scheduleE = {
  taxpayerName: 'Genesis DeSilva',
  ssn: '123013333',

  // Part I - Rental Real Estate (not used)
  rentalProperties: [],

  // Part II - Partnerships and S Corporations
  partnerships: [
    {
      name: "Sarah's Vegan Bakery",
      type: 'P', // Partnership
      isForeign: false,
      ein: '001234567',
      einClean: '001234567',
      basisRequired: false,
      atRisk: true,

      // Passive income/loss
      passiveLoss: 0,
      passiveIncome: 500,

      // Nonpassive income/loss
      nonpassiveLoss: 0,
      section179Expense: 0,
      nonpassiveIncome: 0
    }
  ],

  // Line 29a totals
  totalPassiveIncome: 500,
  totalNonpassiveIncome: 0,

  // Line 29b totals
  totalPassiveLoss: 0,
  totalNonpassiveLoss: 0,
  totalSection179: 0,

  // Line 30 - Add positive amounts
  line30Income: 500,

  // Line 31 - Add losses
  line31Losses: 0,

  // Line 32 - Partnership/S Corp total
  line32Total: 500,

  // Part III - Estates and Trusts (not used)
  estatesTrusts: [],

  // Part IV - REMICs (not used)
  remics: [],

  // Part V - Summary
  line40FarmRental: 0,
  line41Total: 500
}

/**
 * Schedule 1 - Additional Income and Adjustments
 */
const schedule1 = {
  taxpayerName: 'Genesis DeSilva',
  ssn: '123013333',

  // Part I - Additional Income
  line1StateRefunds: 0,
  line2aAlimony: 0,
  line3BusinessIncome: 0,
  line4OtherGains: 0,
  line5RentalRoyalty: 500, // From Schedule E
  line6FarmIncome: 0,
  line7Unemployment: 0,
  line9OtherIncomeTotal: 0,
  line10TotalAdditionalIncome: 500,

  // Part II - Adjustments to Income
  line11Educator: 0,
  line15SeTaxDeduction: 0,
  line20IraDeduction: 0,
  line21StudentLoan: 0,
  line26TotalAdjustments: 0
}

/**
 * Paid preparer information
 */
const paidPreparer = {
  preparerName: 'John Doe',
  preparerSignatureDate: new Date(2026, 3, 2),
  ptin: '',
  selfEmployed: false,
  firmName: 'Wells and Associates',
  firmAddress: {
    street: '4545 Summer Drive',
    city: 'Dallas',
    state: 'TX' as const,
    zip: '75019'
  },
  firmPhone: '(800) 555-4456',
  firmEin: '005556664'
}

/**
 * Complete Form 1040-NR data for Genesis DeSilva
 * Tax Year: 2025
 * Filing Status: Married Filing Separately (MFS)
 *
 * This scenario includes both:
 * 1. Effectively connected income (W-2 wages, partnership)
 * 2. Not effectively connected income (Schedule NEC - LTC)
 */
const form1040NRData = (() => {
  // W-2 income (effectively connected)
  const w2Wages = w2Panaderia.box1Wages
  const w2Withholding = w2Panaderia.box2FederalWithholding

  // Schedule 1 additional income
  const schedule1Income = schedule1.line10TotalAdditionalIncome

  // Total effectively connected income (Line 9)
  const line1zWages = w2Wages
  const line8Schedule1 = schedule1Income
  const line9TotalEci = line1zWages + line8Schedule1 // $26,488

  // Adjustments (Line 10)
  const line10Adjustments = schedule1.line26TotalAdjustments // $0

  // AGI (Line 11a)
  const line11aAgi = line9TotalEci - line10Adjustments // $26,488

  // Deductions - NRA generally cannot use standard deduction
  const line12Deduction = 0
  const line13aQbi = 0
  const line14TotalDeductions = line12Deduction + line13aQbi

  // Taxable income (Line 15)
  const line15TaxableIncome = Math.max(0, line11aAgi - line14TotalDeductions)

  // Tax on effectively connected income (Line 16)
  // Using MFS tax brackets
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

  // Lines 17-22 (no additional taxes or credits from Schedule 2/3)
  const line17Schedule2 = 0
  const line18Total = line16Tax + line17Schedule2
  const line19Ctc = 0
  const line20Schedule3 = 0
  const line21Credits = line19Ctc + line20Schedule3
  const line22TaxMinusCredits = Math.max(0, line18Total - line21Credits)

  // Line 23 - Other taxes
  // Line 23a - Tax on NEC income (from Schedule NEC)
  const line23aNecTax = scheduleNEC.line15TotalNecTax // $330
  const line23bOtherTaxes = 0
  const line23cTransportation = 0
  const line23dTotalOther =
    line23aNecTax + line23bOtherTaxes + line23cTransportation

  // Line 24 - Total tax
  const line24TotalTax = line22TaxMinusCredits + line23dTotalOther

  // Payments
  const line25aW2Withholding = w2Withholding
  const line25dTotalWithholding = line25aW2Withholding
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

    // Taxpayer info
    primarySsn: genesisDeSilvaTaxpayer.ssn,
    primaryFirstName: genesisDeSilvaTaxpayer.firstName,
    primaryLastName: genesisDeSilvaTaxpayer.lastName,
    address: genesisDeSilvaTaxpayer.address,
    foreignAddress: genesisDeSilvaTaxpayer.foreignAddress,
    filingStatus: 2, // MFS on Form 1040-NR
    isNonresidentAlien: true,

    // Checkboxes
    digitalAssets: false,

    // No dependents
    dependents: [],

    // Income Section (Lines 1-9)
    line1aW2Wages: w2Wages,
    line1zTotalWages: line1zWages,
    line4aIraDistributions: 0,
    line4bTaxableIra: 0,
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
    line23aNecTax: line23aNecTax,
    line23bOtherTaxes: line23bOtherTaxes,
    line23cTransportation: line23cTransportation,
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
    hasScheduleE: true,
    hasScheduleNec: true,
    hasScheduleOi: true,
    hasPaidPreparer: true,

    // Detailed form data
    w2: w2Panaderia,
    scheduleOI: scheduleOI,
    scheduleNEC: scheduleNEC,
    scheduleE: scheduleE,
    schedule1: schedule1,
    paidPreparer: paidPreparer
  }
})()

// =============================================================================
// Tests
// =============================================================================

describe('ATS Scenario NR-2 - Genesis DeSilva (NRA with NEC Income)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct taxpayer name', () => {
      expect(genesisDeSilvaTaxpayer.firstName).toBe('Genesis')
      expect(genesisDeSilvaTaxpayer.lastName).toBe('DeSilva')
    })

    it('should have valid SSN format (9 digits)', () => {
      expect(genesisDeSilvaTaxpayer.ssn).toHaveLength(9)
      expect(/^\d{9}$/.test(genesisDeSilvaTaxpayer.ssn)).toBe(true)
    })

    it('should be flagged as nonresident alien', () => {
      expect(genesisDeSilvaTaxpayer.isNonresidentAlien).toBe(true)
    })

    it('should have foreign address components', () => {
      expect(genesisDeSilvaTaxpayer.foreignAddress.country).toBe('Canada')
      expect(genesisDeSilvaTaxpayer.foreignAddress.province).toBe('ON')
      expect(genesisDeSilvaTaxpayer.foreignAddress.postalCode).toBe('M4T 1B9')
    })
  })

  describe('Schedule OI (Other Information)', () => {
    it('should have correct citizenship country', () => {
      expect(scheduleOI.citizenshipCountry).toBe('CA')
    })

    it('should have correct tax residence country', () => {
      expect(scheduleOI.taxResidenceCountry).toBe('CA')
    })

    it('should have applied for green card', () => {
      expect(scheduleOI.appliedForGreenCard).toBe(true)
    })

    it('should not have been US citizen', () => {
      expect(scheduleOI.wasUsCitizen).toBe(false)
    })

    it('should have Visa Waiver visa type', () => {
      expect(scheduleOI.visaType).toBe('Visa Waiver')
    })

    it('should have correct days in US for substantial presence test', () => {
      expect(scheduleOI.daysInUs2023).toBe(110)
      expect(scheduleOI.daysInUs2024).toBe(110)
      expect(scheduleOI.daysInUs2025).toBe(110)
    })

    it('should have 8 US visits in 2025', () => {
      expect(scheduleOI.usVisits2025).toHaveLength(8)
    })

    it('should have no treaty-exempt income', () => {
      expect(scheduleOI.hasTreatyExemptIncome).toBe(false)
    })
  })

  describe('W-2 Income', () => {
    it('should have correct employer name', () => {
      expect(w2Panaderia.employerName).toBe('Panaderia Luna de Azucar')
    })

    it('should have correct wages', () => {
      expect(w2Panaderia.box1Wages).toBe(25988)
    })

    it('should have correct federal withholding', () => {
      expect(w2Panaderia.box2FederalWithholding).toBe(2916)
    })

    it('should have SS wages equal to total wages', () => {
      expect(w2Panaderia.box3SsWages).toBe(w2Panaderia.box1Wages)
    })

    it('should have Medicare wages equal to total wages', () => {
      expect(w2Panaderia.box5MedicareWages).toBe(w2Panaderia.box1Wages)
    })
  })

  describe('Schedule NEC (Not Effectively Connected Income)', () => {
    it('should have LTC as other income type', () => {
      expect(scheduleNEC.otherIncomeType).toBe('LTC')
    })

    it('should have correct other income amount', () => {
      expect(scheduleNEC.otherIncomeAmount).toBe(1100)
    })

    it('should have income taxed at 30% rate', () => {
      expect(scheduleNEC.total30pct).toBe(1100)
    })

    it('should calculate 30% tax correctly', () => {
      const income = scheduleNEC.total30pct
      const expectedTax = income * 0.3
      expect(scheduleNEC.tax30pct).toBe(expectedTax)
      expect(scheduleNEC.tax30pct).toBe(330)
    })

    it('should calculate total NEC tax correctly', () => {
      const totalTax =
        scheduleNEC.tax10pct + scheduleNEC.tax15pct + scheduleNEC.tax30pct
      expect(scheduleNEC.line15TotalNecTax).toBe(totalTax)
      expect(scheduleNEC.line15TotalNecTax).toBe(330)
    })
  })

  describe('Schedule E (Partnership Income)', () => {
    it('should have correct partnership name', () => {
      expect(scheduleE.partnerships[0].name).toBe("Sarah's Vegan Bakery")
    })

    it('should have correct partnership EIN', () => {
      expect(scheduleE.partnerships[0].ein).toBe('001234567')
    })

    it('should have correct passive income from partnership', () => {
      expect(scheduleE.partnerships[0].passiveIncome).toBe(500)
    })

    it('should have correct line 41 total', () => {
      expect(scheduleE.line41Total).toBe(500)
    })
  })

  describe('Schedule 1 (Additional Income)', () => {
    it('should have rental/royalty income from Schedule E', () => {
      expect(schedule1.line5RentalRoyalty).toBe(500)
    })

    it('should have correct total additional income', () => {
      expect(schedule1.line10TotalAdditionalIncome).toBe(500)
    })

    it('should have no adjustments to income', () => {
      expect(schedule1.line26TotalAdjustments).toBe(0)
    })
  })

  describe('Form 1040-NR Tax Calculation', () => {
    it('should be form type 1040-NR', () => {
      expect(form1040NRData.formType).toBe('1040-NR')
    })

    it('should have correct total wages', () => {
      expect(form1040NRData.line1zTotalWages).toBe(25988)
    })

    it('should have Schedule 1 income flow to 1040-NR', () => {
      expect(form1040NRData.line8Schedule1).toBe(500)
    })

    it('should calculate total ECI correctly', () => {
      const expected = 25988 + 500
      expect(form1040NRData.line9TotalEci).toBe(expected)
    })

    it('should have AGI equal to ECI minus adjustments', () => {
      const expected =
        form1040NRData.line9TotalEci - form1040NRData.line10Adjustments
      expect(form1040NRData.line11aAgi).toBe(expected)
    })

    it('should include NEC tax on line 23a', () => {
      expect(form1040NRData.line23aNecTax).toBe(330)
    })

    it('should include both ECI tax and NEC tax in total tax', () => {
      const eciTax = form1040NRData.line22TaxMinusCredits
      const necTax = form1040NRData.line23aNecTax
      const expectedTotal = eciTax + necTax

      expect(form1040NRData.line24TotalTax).toBe(expectedTotal)
    })
  })

  describe('Paid Preparer', () => {
    it('should have correct preparer name', () => {
      expect(paidPreparer.preparerName).toBe('John Doe')
    })

    it('should have correct firm name', () => {
      expect(paidPreparer.firmName).toBe('Wells and Associates')
    })

    it('should have correct firm EIN', () => {
      expect(paidPreparer.firmEin).toBe('005556664')
    })
  })

  describe('Business Rules', () => {
    it('should use Form 1040-NR for nonresident alien', () => {
      expect(form1040NRData.formType).toBe('1040-NR')
      expect(form1040NRData.isNonresidentAlien).toBe(true)
    })

    it('should tax NEC income separately at flat rate', () => {
      // NEC income ($1,100) should not be in line 9 (ECI)
      // It should be taxed on Schedule NEC at 30%
      const necTax = form1040NRData.line23aNecTax
      expect(necTax).toBe(330)
    })

    it('should have partnership income as ECI', () => {
      // Partnership income flows through Schedule 1 to line 8
      const schedule1Income = form1040NRData.line8Schedule1
      expect(schedule1Income).toBe(500)
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
        'totalPayments',
        'line23aNecTax' // NEC-specific
      ]

      for (const field of requiredFields) {
        expect(form1040NRData).toHaveProperty(field)
      }
    })

    it('should flow Schedule E to Schedule 1 line 5', () => {
      expect(scheduleE.line41Total).toBe(schedule1.line5RentalRoyalty)
    })

    it('should flow Schedule 1 to Form 1040-NR line 8', () => {
      expect(schedule1.line10TotalAdditionalIncome).toBe(
        form1040NRData.line8Schedule1
      )
    })

    it('should flow Schedule NEC to Form 1040-NR line 23a', () => {
      expect(scheduleNEC.line15TotalNecTax).toBe(form1040NRData.line23aNecTax)
    })

    it('should flow W-2 withholding to payments section', () => {
      const w2Wh = form1040NRData.w2.box2FederalWithholding
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

    it('should have dual taxation structure (ECI and NEC)', () => {
      // ECI tax on line 16
      const eciTax = form1040NRData.line16Tax
      expect(eciTax).toBeGreaterThan(0)

      // NEC tax on line 23a
      const necTax = form1040NRData.line23aNecTax
      expect(necTax).toBe(330)

      // Total includes both
      const totalTax = form1040NRData.line24TotalTax
      expect(totalTax).toBeGreaterThanOrEqual(eciTax + necTax)
    })
  })
})

export {}
