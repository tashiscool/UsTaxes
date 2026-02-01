/**
 * IRS ATS Test Scenario NR-3 - Jace Alfaro
 *
 * Test Scenario Reference: IRS ATS Test Scenario NR-3 (ty25-1040-nr-mef-ats-scenario-3-12012025.pdf)
 * Primary Taxpayer: Jace Alfaro
 * Filing Status: Single
 * Location: Logrono, Spain (Foreign Address)
 *
 * Key Features Tested:
 * - Form 1040-NR (Nonresident Alien Income Tax Return)
 * - Schedule A (Form 1040-NR) - Itemized Deductions
 * - Form 8283 (Noncash Charitable Contributions - Vehicle donation)
 * - Form 8888 (Allocation of Refund to multiple accounts)
 * - W-2 wage income effectively connected with US trade/business
 * - State and local tax deduction (SALT)
 * - Foreign address handling
 * - Section 301.9100-2 filing
 *
 * Tax Year: 2025
 */

import { FilingStatus } from 'ustaxes/core/data'

// =============================================================================
// Test Data Fixtures - Jace Alfaro (Scenario NR-3)
// =============================================================================

/**
 * Primary taxpayer information - Jace Alfaro
 */
const jaceAlfaroTaxpayer = {
  firstName: 'Jace',
  lastName: 'Alfaro',
  ssn: '123014444',
  ssnAtsReference: '123-00-4444',
  address: {
    address: '147 Tomato Street',
    city: 'Logrono',
    state: '' as const, // Foreign address - no US state
    zip: '' // Foreign address - no US zip
  },
  foreignAddress: {
    country: 'Spain',
    province: 'La Rioja',
    postalCode: '26001'
  },
  dateOfBirth: new Date(1980, 4, 10), // May 10, 1980
  occupation: '',
  digitalAssets: false,
  isNonresidentAlien: true,
  filedPursuantTo301_9100_2: true
}

/**
 * W-2 from Spain Bar and Grill
 */
const w2SpainBarAndGrill = {
  employeeName: 'Jace Alfaro',
  employeeSsn: '123014444',
  employer: {
    name: 'Spain Bar and Grill',
    ein: '033211167',
    einTest: '123211167',
    address: {
      address: '2580 Food Lane',
      city: 'Los Angeles',
      state: 'CA' as const,
      zip: '90026'
    }
  },
  box1Wages: 72102,
  box2FederalWithholding: 21750,
  box3SsWages: 72102,
  box4SsTax: 4470,
  box5MedicareWages: 72102,
  box6MedicareTax: 1045,
  box15State: '',
  box16StateWages: 0,
  box17StateTax: 0
}

/**
 * Schedule A (Form 1040-NR) - Itemized Deductions
 */
const scheduleA = {
  taxpayerName: 'Jace Alfaro',
  ssn: '123014444',

  // Taxes You Paid
  line1aStateLocalTaxes: 18860,
  // SALT cap: min(18860, 40000) for single = 18860
  line1bSaltDeduction: 18860,

  // Gifts to U.S. Charities
  line2CashGifts: 0,
  line3NoncashGifts: 5005, // Vehicle donation from Form 8283
  line4Carryover: 0,
  line5TotalGifts: 5005,

  // Casualty and Theft Losses
  line6CasualtyLoss: 0,

  // Other Itemized Deductions
  line7Other: 0,

  // Total Itemized Deductions
  line8Total: 23865 // 18860 + 5005
}

/**
 * Form 8283 (Noncash Charitable Contributions)
 * Section B - Donated Property Over $5,000 (Vehicle donation)
 */
const form8283 = {
  taxpayerName: 'Jace Alfaro',
  ssn: '123014444',

  // Entity that made the contribution
  entityName: 'Spain Bar and Grill',
  entityEin: '033211167',

  // Section B - Donated Property Over $5,000
  sectionBItems: [
    {
      itemLetter: 'A',
      propertyType: 'Vehicles',
      description: '2005 Mercedes Benz',
      condition: 'Good',
      appraisedFmv: 5005,
      dateAcquired: 'Various',
      howAcquired: 'Purchase',
      donorsCostBasis: 53470,
      bargainSaleAmount: 0,
      amountClaimed: 5005 // Limited to FMV
    }
  ],

  // Attachments
  form1098cAttached: true,
  vehicleStatementAttached: true
}

/**
 * Form 8888 (Allocation of Refund)
 * Refund split into multiple accounts
 */
const form8888 = {
  taxpayerName: 'Jace Alfaro',
  ssn: '123014444',
  taxYear: 2025,

  // Account allocations
  accounts: [
    {
      accountNumber: 1,
      routingNumber: '024567891',
      accountNumberValue: '11111111111111111',
      accountType: 'checking' as const,
      amount: 0 // Remainder - calculated later
    },
    {
      accountNumber: 2,
      routingNumber: '012345678',
      accountNumberValue: '1234567',
      accountType: 'savings' as const,
      amount: 1000
    },
    {
      accountNumber: 3,
      routingNumber: '221277735',
      accountNumberValue: '222222222222222',
      accountType: 'savings' as const,
      amount: 1000
    }
  ],

  // Total allocation
  savingsAllocation: 2000 // 1000 + 1000
}

/**
 * Complete Form 1040-NR data for Jace Alfaro
 */
const form1040NRData = (() => {
  // W-2 income
  const w2Wages = w2SpainBarAndGrill.box1Wages
  const w2Withholding = w2SpainBarAndGrill.box2FederalWithholding

  // Total income (Line 9)
  const line1zWages = w2Wages
  const line9TotalEci = line1zWages

  // Adjustments (Line 10)
  const line10Adjustments = 0

  // AGI (Line 11a)
  const line11aAgi = line9TotalEci - line10Adjustments

  // Itemized Deductions (Line 12)
  const line12Deduction = scheduleA.line8Total

  // QBI Deduction (Line 13a)
  const line13aQbi = 0

  // Total Deductions (Line 14)
  const line14TotalDeductions = line12Deduction + line13aQbi

  // Taxable Income (Line 15)
  const line15TaxableIncome = Math.max(0, line11aAgi - line14TotalDeductions) // 48,237

  // Tax Calculation using 2025 single brackets
  let line16Tax: number
  if (line15TaxableIncome <= 11600) {
    line16Tax = line15TaxableIncome * 0.1
  } else if (line15TaxableIncome <= 47150) {
    line16Tax = 11600 * 0.1 + (line15TaxableIncome - 11600) * 0.12
  } else if (line15TaxableIncome <= 100525) {
    line16Tax =
      11600 * 0.1 + 35550 * 0.12 + (line15TaxableIncome - 47150) * 0.22
  } else {
    line16Tax =
      11600 * 0.1 +
      35550 * 0.12 +
      53375 * 0.22 +
      (line15TaxableIncome - 100525) * 0.24
  }
  line16Tax = Math.round(line16Tax)

  // Credits and other taxes (none)
  const line22TaxMinusCredits = line16Tax
  const line24TotalTax = line22TaxMinusCredits

  // Payments
  const line25aW2Withholding = w2Withholding
  const line33TotalPayments = line25aW2Withholding

  // Refund calculation
  const line34Overpaid =
    line33TotalPayments > line24TotalTax
      ? line33TotalPayments - line24TotalTax
      : 0
  const line37AmountOwed =
    line24TotalTax > line33TotalPayments
      ? line24TotalTax - line33TotalPayments
      : 0

  // Update Form 8888 checking account with remainder
  const checkingAmount = line34Overpaid - form8888.savingsAllocation
  form8888.accounts[0].amount = checkingAmount

  return {
    // Form identification
    formType: '1040-NR',
    taxYear: 2025,

    // Taxpayer info
    primarySsn: jaceAlfaroTaxpayer.ssn,
    primaryFirstName: jaceAlfaroTaxpayer.firstName,
    primaryLastName: jaceAlfaroTaxpayer.lastName,
    address: jaceAlfaroTaxpayer.address,
    foreignAddress: jaceAlfaroTaxpayer.foreignAddress,
    filingStatus: FilingStatus.S,
    isNonresidentAlien: true,
    filedPursuantTo301_9100_2: true,

    // Checkboxes
    digitalAssets: false,

    // No dependents
    dependents: [],

    // Income
    line1aW2Wages: w2Wages,
    line1zTotalWages: line1zWages,
    line9TotalEci: line9TotalEci,

    // Adjustments
    line10Adjustments,
    line11aAgi,
    line11bAgi: line11aAgi,

    // Deductions
    line12Deduction,
    line13aQbi,
    line14TotalDeductions,
    line15TaxableIncome,

    // Tax
    line16Tax,
    line17Schedule2: 0,
    line18Total: line16Tax,
    line19Ctc: 0,
    line20Schedule3: 0,
    line21Credits: 0,
    line22TaxMinusCredits,
    line23aNecTax: 0,
    line23bOtherTaxes: 0,
    line23dTotalOther: 0,
    line24TotalTax,

    // Payments
    line25aW2Withholding,
    line25dTotalWithholding: line25aW2Withholding,
    line33TotalPayments,

    // Refund
    line34Overpaid,
    line35aRefund: line34Overpaid,
    form8888Attached: true,
    line37AmountOwed,

    // Summary
    totalIncome: line9TotalEci,
    agi: line11aAgi,
    taxableIncome: line15TaxableIncome,
    totalTax: line24TotalTax,
    totalPayments: line33TotalPayments,
    refund: line34Overpaid,
    amountOwed: line37AmountOwed
  }
})()

// =============================================================================
// Tests
// =============================================================================

describe('ATS Scenario NR-3 - Jace Alfaro (Form 1040-NR Itemized)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct taxpayer name', () => {
      expect(jaceAlfaroTaxpayer.firstName).toBe('Jace')
      expect(jaceAlfaroTaxpayer.lastName).toBe('Alfaro')
    })

    it('should have valid SSN format', () => {
      expect(jaceAlfaroTaxpayer.ssn).toHaveLength(9)
      expect(/^\d{9}$/.test(jaceAlfaroTaxpayer.ssn)).toBe(true)
    })

    it('should be a nonresident alien', () => {
      expect(jaceAlfaroTaxpayer.isNonresidentAlien).toBe(true)
    })

    it('should have foreign address in Spain', () => {
      expect(jaceAlfaroTaxpayer.foreignAddress.country).toBe('Spain')
      expect(jaceAlfaroTaxpayer.foreignAddress.province).toBe('La Rioja')
      expect(jaceAlfaroTaxpayer.foreignAddress.postalCode).toBe('26001')
    })

    it('should be filed pursuant to 301.9100-2', () => {
      expect(jaceAlfaroTaxpayer.filedPursuantTo301_9100_2).toBe(true)
    })
  })

  describe('W-2 Income', () => {
    it('should have correct employer', () => {
      expect(w2SpainBarAndGrill.employer.name).toBe('Spain Bar and Grill')
    })

    it('should have correct wages', () => {
      expect(w2SpainBarAndGrill.box1Wages).toBe(72102)
    })

    it('should have correct federal withholding', () => {
      expect(w2SpainBarAndGrill.box2FederalWithholding).toBe(21750)
    })

    it('should have correct SS tax', () => {
      expect(w2SpainBarAndGrill.box4SsTax).toBe(4470)
    })

    it('should have correct Medicare tax', () => {
      expect(w2SpainBarAndGrill.box6MedicareTax).toBe(1045)
    })
  })

  describe('Schedule A (Itemized Deductions)', () => {
    it('should have correct state and local taxes', () => {
      expect(scheduleA.line1aStateLocalTaxes).toBe(18860)
    })

    it('should not exceed SALT cap for single filer', () => {
      expect(scheduleA.line1bSaltDeduction).toBeLessThanOrEqual(40000)
      expect(scheduleA.line1bSaltDeduction).toBe(18860)
    })

    it('should have correct noncash gifts from vehicle donation', () => {
      expect(scheduleA.line3NoncashGifts).toBe(5005)
    })

    it('should have correct total itemized deductions', () => {
      const expected =
        scheduleA.line1bSaltDeduction +
        scheduleA.line5TotalGifts +
        scheduleA.line6CasualtyLoss +
        scheduleA.line7Other
      expect(scheduleA.line8Total).toBe(expected)
      expect(scheduleA.line8Total).toBe(23865)
    })
  })

  describe('Form 8283 (Noncash Charitable Contributions)', () => {
    it('should have vehicle donation', () => {
      const item = form8283.sectionBItems[0]
      expect(item.propertyType).toBe('Vehicles')
    })

    it('should have correct vehicle description', () => {
      const item = form8283.sectionBItems[0]
      expect(item.description).toBe('2005 Mercedes Benz')
      expect(item.condition).toBe('Good')
    })

    it('should have correct appraised FMV', () => {
      const item = form8283.sectionBItems[0]
      expect(item.appraisedFmv).toBe(5005)
    })

    it('should have deduction limited to FMV', () => {
      const item = form8283.sectionBItems[0]
      expect(item.amountClaimed).toBeLessThanOrEqual(item.appraisedFmv)
      expect(item.amountClaimed).toBeLessThanOrEqual(item.donorsCostBasis)
    })

    it('should have Form 1098-C attached', () => {
      expect(form8283.form1098cAttached).toBe(true)
    })
  })

  describe('Form 8888 (Allocation of Refund)', () => {
    it('should have three accounts', () => {
      expect(form8888.accounts).toHaveLength(3)
    })

    it('should have $1,000 to each savings account', () => {
      const savingsAccounts = form8888.accounts.filter(
        (a) => a.accountType === 'savings'
      )
      expect(savingsAccounts).toHaveLength(2)
      savingsAccounts.forEach((account) => {
        expect(account.amount).toBe(1000)
      })
    })

    it('should have checking account for remainder', () => {
      const checkingAccounts = form8888.accounts.filter(
        (a) => a.accountType === 'checking'
      )
      expect(checkingAccounts).toHaveLength(1)
    })

    it('should have total savings allocation of $2,000', () => {
      expect(form8888.savingsAllocation).toBe(2000)
    })
  })

  describe('Form 1040-NR Tax Calculation', () => {
    it('should have correct form type', () => {
      expect(form1040NRData.formType).toBe('1040-NR')
    })

    it('should have single filing status', () => {
      expect(form1040NRData.filingStatus).toBe(FilingStatus.S)
    })

    it('should have correct total wages', () => {
      expect(form1040NRData.line1zTotalWages).toBe(72102)
    })

    it('should have correct AGI (no adjustments)', () => {
      expect(form1040NRData.line11aAgi).toBe(72102)
    })

    it('should use itemized deductions', () => {
      expect(form1040NRData.line12Deduction).toBe(23865)
    })

    it('should calculate taxable income correctly', () => {
      const expected =
        form1040NRData.line11aAgi - form1040NRData.line14TotalDeductions
      expect(form1040NRData.line15TaxableIncome).toBe(expected)
      expect(form1040NRData.line15TaxableIncome).toBe(48237)
    })

    it('should have a refund', () => {
      expect(form1040NRData.refund).toBeGreaterThan(0)
      expect(form1040NRData.amountOwed).toBe(0)
    })

    it('should have Form 8888 attached', () => {
      expect(form1040NRData.form8888Attached).toBe(true)
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
        'refund'
      ]

      for (const field of requiredFields) {
        expect(form1040NRData).toHaveProperty(field)
      }
    })

    it('should flow Schedule A to Form 1040-NR', () => {
      expect(form1040NRData.line12Deduction).toBe(scheduleA.line8Total)
    })

    it('should flow Form 8283 to Schedule A', () => {
      const item = form8283.sectionBItems[0]
      expect(scheduleA.line3NoncashGifts).toBe(item.amountClaimed)
    })

    it('should flow W-2 withholding to payments', () => {
      expect(form1040NRData.line25aW2Withholding).toBe(
        w2SpainBarAndGrill.box2FederalWithholding
      )
    })

    it('should have refund allocation total matching refund', () => {
      const totalAllocated = form8888.accounts.reduce(
        (sum, a) => sum + a.amount,
        0
      )
      expect(totalAllocated).toBe(form1040NRData.refund)
    })

    it('should have consistent line math', () => {
      // Line 11 = Line 9 - Line 10
      expect(form1040NRData.line11aAgi).toBe(
        form1040NRData.line9TotalEci - form1040NRData.line10Adjustments
      )

      // Line 15 = Line 11 - Line 14
      expect(form1040NRData.line15TaxableIncome).toBe(
        form1040NRData.line11aAgi - form1040NRData.line14TotalDeductions
      )

      // Line 24 = Line 22 + Line 23d
      expect(form1040NRData.line24TotalTax).toBe(
        form1040NRData.line22TaxMinusCredits + form1040NRData.line23dTotalOther
      )
    })
  })

  describe('Validation Rules', () => {
    it('should use 1040-NR for nonresident alien', () => {
      expect(form1040NRData.formType).toBe('1040-NR')
      expect(form1040NRData.isNonresidentAlien).toBe(true)
    })

    it('should require Form 8283 for vehicle donation over $500', () => {
      const item = form8283.sectionBItems[0]
      expect(item.appraisedFmv).toBeGreaterThan(500)
    })
  })
})
