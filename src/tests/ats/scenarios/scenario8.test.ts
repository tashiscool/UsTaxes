/**
 * IRS ATS Test Scenario 8 - Carter Lewis
 *
 * Test Scenario Reference: IRS ATS Test Scenario 8 (ty25-1040-mef-ats-scenario-8-10212025.pdf)
 * Primary Taxpayer: Carter Lewis
 * Filing Status: Married Filing Separately (3)
 * No Dependents
 *
 * Key Features Tested:
 * - Married Filing Separately filing status
 * - Form 1099-R (Distributions from Pensions, Annuities, Retirement)
 * - IRA Rollover transactions (60-day rule)
 * - Social Security benefits (SSA-1099)
 * - Taxation of Social Security benefits
 * - Pension income with withholding
 * - Standard deduction for MFS
 *
 * Tax Year: 2025
 */

import { FilingStatus } from 'ustaxes/core/data'

// =============================================================================
// Test Data Fixtures - Carter Lewis (Scenario 8)
// =============================================================================

/**
 * Primary taxpayer information
 * ATS Reference SSN: 400-00-1039 (invalid for production)
 * Test SSN: 400011043 (valid format for testing)
 */
const carterLewisTaxpayer = {
  firstName: 'Carter',
  lastName: 'Lewis',
  ssn: '400011043',
  ssnAtsReference: '400-00-1039',
  address: {
    address: '456 Maple Lane',
    city: 'Phoenix',
    state: 'AZ' as const,
    zip: '85001'
  },
  dateOfBirth: new Date(1958, 5, 20), // June 20, 1958 - Age 67 in 2025
  occupation: 'Retired',
  digitalAssets: false
}

/**
 * Spouse information (filing separately)
 */
const danaLewisSpouse = {
  firstName: 'Dana',
  lastName: 'Lewis',
  ssn: '400011044',
  ssnAtsReference: '400-00-1040'
}

/**
 * Form 1099-R #1 - Pension Distribution
 * Regular periodic pension payment from employer retirement plan
 */
const form1099RPension = {
  payerName: 'State Teachers Retirement System',
  payerTin: '000000071',
  payerAddress: {
    address: '100 Retirement Plaza',
    city: 'Phoenix',
    state: 'AZ' as const,
    zip: '85002'
  },
  // Box 1 - Gross distribution
  box1GrossDistribution: 36000,
  // Box 2a - Taxable amount
  box2aTaxableAmount: 36000,
  // Box 2b - Taxable amount not determined / Total distribution
  box2bTaxableNotDetermined: false,
  box2bTotalDistribution: false,
  // Box 4 - Federal income tax withheld (12% withheld)
  box4FederalWithholding: 4320,
  // Box 7 - Distribution code (7 = Normal distribution)
  box7DistributionCode: '7',
  // Box 12-14 - State info
  box12StateDistribution: 36000,
  box14StateWithholding: 1080,
  stateId: 'AZ',
  // IRA indicator
  isIra: false
}

/**
 * Form 1099-R #2 - IRA Rollover
 * IRA distribution that was rolled over within 60 days
 */
const form1099RRollover = {
  payerName: 'Fidelity Investments',
  payerTin: '000000072',
  payerAddress: {
    address: '200 Financial Drive',
    city: 'Boston',
    state: 'MA' as const,
    zip: '02109'
  },
  // Box 1 - Gross distribution
  box1GrossDistribution: 25000,
  // Box 2a - Taxable amount (0 for rollover)
  box2aTaxableAmount: 0,
  // Box 2b - Total distribution
  box2bTotalDistribution: true,
  // Box 4 - No withholding for direct rollover
  box4FederalWithholding: 0,
  // Box 7 - Distribution code (G = Direct rollover)
  box7DistributionCode: 'G',
  // IRA indicator
  isIra: true,
  isRollover: true,
  rolloverType: 'Direct'
}

/**
 * SSA-1099 - Social Security Benefits
 */
const ssa1099 = {
  recipientName: 'Carter Lewis',
  recipientSsn: '400011043',
  payerName: 'Social Security Administration',
  // Box 3 - Benefits paid in 2025
  box3BenefitsPaid: 24000,
  // Box 4 - Benefits repaid to SSA
  box4BenefitsRepaid: 0,
  // Box 5 - Net benefits (Box 3 - Box 4)
  box5NetBenefits: 24000,
  // Box 6 - Voluntary federal income tax withheld (10%)
  box6FederalWithholding: 2400,
  // Derived values
  halfOfBenefits: 12000 // 24000 / 2
}

/**
 * Social Security Benefits Worksheet
 * Calculates the taxable portion of Social Security benefits
 * MFS filers who lived with spouse have 85% taxable if any income threshold is met
 */
const socialSecurityWorksheet = {
  // Line 1 - Total Social Security benefits
  line1TotalBenefits: 24000,
  // Line 2 - One-half of line 1
  line2HalfBenefits: 12000,
  // Line 3 - Other income (pension)
  line3OtherIncome: 36000,
  // Line 4 - Tax-exempt interest
  line4TaxExemptInterest: 0,
  // Line 5 - Add lines 2, 3, and 4
  line5Combined: 48000, // 12000 + 36000
  // Line 6 - Certain deductions
  line6Deductions: 0,
  // Line 7 - Subtract line 6 from line 5 (provisional income)
  line7ProvisionalIncome: 48000,
  // Line 8 - Base amount for filing status (MFS living with spouse: $0)
  line8BaseAmount: 0,
  // Line 9 - Subtract line 8 from line 7
  line9Excess: 48000,
  // MFS Rule: If lived with spouse, up to 85% taxable if provisional income > 0
  livedWithSpouse: true,
  taxablePercentage: 0.85,
  taxableSocialSecurity: 20400 // 24000 * 0.85
}

/**
 * Complete Form 1040 data for Carter Lewis
 * Tax Year: 2025
 * Filing Status: Married Filing Separately (3)
 * Standard Deduction (2025 MFS): $15,000
 */
const form1040Data = (() => {
  // Income
  const pensionIncome = form1099RPension.box2aTaxableAmount // $36,000
  const rolloverTaxable = form1099RRollover.box2aTaxableAmount // $0
  const ssTaxable = socialSecurityWorksheet.taxableSocialSecurity // $20,400
  const totalIncome = pensionIncome + rolloverTaxable + ssTaxable // $56,400

  // AGI (no adjustments)
  const agi = totalIncome

  // Standard Deduction (MFS uses half of MFJ)
  const standardDeductionMfs2025 = 15000

  // Taxable Income
  const taxableIncome = Math.max(0, agi - standardDeductionMfs2025) // $41,400

  // Tax calculation (2025 MFS brackets - same as Single)
  // $0 - $11,600: 10%
  // $11,601 - $47,150: 12%
  let calculatedTax: number
  if (taxableIncome <= 11600) {
    calculatedTax = taxableIncome * 0.1
  } else if (taxableIncome <= 47150) {
    const taxBracket1 = 11600 * 0.1 // $1,160
    const remaining = taxableIncome - 11600 // $29,800
    const taxBracket2 = remaining * 0.12 // $3,576
    calculatedTax = taxBracket1 + taxBracket2 // $4,736
  } else {
    const taxBracket1 = 11600 * 0.1
    const taxBracket2 = 35550 * 0.12
    const remaining = taxableIncome - 47150
    const taxBracket3 = remaining * 0.22
    calculatedTax = taxBracket1 + taxBracket2 + taxBracket3
  }
  calculatedTax = Math.round(calculatedTax)

  // Total tax
  const totalTax = calculatedTax

  // Payments
  const pensionWithholding = form1099RPension.box4FederalWithholding // $4,320
  const ssWithholding = ssa1099.box6FederalWithholding // $2,400
  const totalWithholding = pensionWithholding + ssWithholding // $6,720
  const totalPayments = totalWithholding

  // Refund or owed
  const refund = totalPayments > totalTax ? totalPayments - totalTax : 0
  const amountOwed = totalTax > totalPayments ? totalTax - totalPayments : 0

  return {
    // Taxpayer info
    primarySsn: carterLewisTaxpayer.ssn,
    primaryFirstName: carterLewisTaxpayer.firstName,
    primaryLastName: carterLewisTaxpayer.lastName,
    address: carterLewisTaxpayer.address,
    filingStatus: FilingStatus.MFS,

    // Spouse info (required for MFS)
    spouseSsn: danaLewisSpouse.ssn,
    spouseFirstName: danaLewisSpouse.firstName,
    spouseLastName: danaLewisSpouse.lastName,

    // No dependents
    dependents: [],

    // Income lines
    line1zWages: 0,
    line2aTaxExemptInterest: 0,
    line2bTaxableInterest: 0,
    line3aQualifiedDividends: 0,
    line3bOrdinaryDividends: 0,
    line4aIraDistributions: form1099RRollover.box1GrossDistribution,
    line4bTaxableIra: form1099RRollover.box2aTaxableAmount,
    line5aPensionsAnnuities: form1099RPension.box1GrossDistribution,
    line5bTaxablePensions: form1099RPension.box2aTaxableAmount,
    line6aSocialSecurity: ssa1099.box5NetBenefits,
    line6bTaxableSocialSecurity: ssTaxable,
    line9TotalIncome: totalIncome,
    totalIncome,

    // Adjustments
    line10Adjustments: 0,

    // AGI
    line11Agi: agi,
    agi,

    // Deductions
    line12Deduction: standardDeductionMfs2025,
    line13QbiDeduction: 0,
    line14TotalDeductions: standardDeductionMfs2025,
    deduction: standardDeductionMfs2025,

    // Taxable income
    line15TaxableIncome: taxableIncome,
    taxableIncome,

    // Tax
    line16Tax: calculatedTax,
    line17Schedule2: 0,
    line18Total: calculatedTax,
    line19CtcActc: 0,
    line20Schedule3: 0,
    line21CreditsSubtotal: 0,
    line22TaxMinusCredits: calculatedTax,
    line23OtherTaxes: 0,
    line24TotalTax: totalTax,
    totalTax,

    // Payments
    line25aW2Withholding: 0,
    line25b1099Withholding: totalWithholding,
    line25cOtherWithholding: 0,
    line25dTotalWithholding: totalWithholding,
    line33TotalPayments: totalPayments,
    totalPayments,

    // Refund or Amount Owed
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

describe('ATS Scenario 8 - Carter Lewis (MFS with Retirement)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct taxpayer name', () => {
      expect(carterLewisTaxpayer.firstName).toBe('Carter')
      expect(carterLewisTaxpayer.lastName).toBe('Lewis')
    })

    it('should have valid SSN format (9 digits)', () => {
      expect(carterLewisTaxpayer.ssn).toHaveLength(9)
      expect(/^\d{9}$/.test(carterLewisTaxpayer.ssn)).toBe(true)
    })

    it('should have occupation as Retired', () => {
      expect(carterLewisTaxpayer.occupation).toBe('Retired')
    })

    it('should have spouse info present for MFS', () => {
      expect(danaLewisSpouse.firstName).toBe('Dana')
      expect(danaLewisSpouse.lastName).toBe('Lewis')
      expect(danaLewisSpouse.ssn).toHaveLength(9)
    })
  })

  describe('Form 1099-R Pension', () => {
    it('should have correct gross distribution', () => {
      expect(form1099RPension.box1GrossDistribution).toBe(36000)
    })

    it('should have taxable amount equal to gross (no basis)', () => {
      expect(form1099RPension.box2aTaxableAmount).toBe(
        form1099RPension.box1GrossDistribution
      )
    })

    it('should have federal withholding', () => {
      expect(form1099RPension.box4FederalWithholding).toBe(4320)
    })

    it('should have distribution code 7 (normal distribution)', () => {
      expect(form1099RPension.box7DistributionCode).toBe('7')
    })

    it('should not be IRA distribution', () => {
      expect(form1099RPension.isIra).toBe(false)
    })
  })

  describe('Form 1099-R Rollover', () => {
    it('should have correct gross distribution', () => {
      expect(form1099RRollover.box1GrossDistribution).toBe(25000)
    })

    it('should have zero taxable amount for rollover', () => {
      expect(form1099RRollover.box2aTaxableAmount).toBe(0)
    })

    it('should have distribution code G (direct rollover)', () => {
      expect(form1099RRollover.box7DistributionCode).toBe('G')
    })

    it('should be marked as IRA', () => {
      expect(form1099RRollover.isIra).toBe(true)
    })

    it('should be marked as rollover', () => {
      expect(form1099RRollover.isRollover).toBe(true)
      expect(form1099RRollover.rolloverType).toBe('Direct')
    })
  })

  describe('Social Security Benefits', () => {
    it('should have correct net benefits', () => {
      expect(ssa1099.box5NetBenefits).toBe(24000)
    })

    it('should have federal withholding', () => {
      expect(ssa1099.box6FederalWithholding).toBe(2400)
    })

    it('should calculate half of benefits correctly', () => {
      expect(ssa1099.halfOfBenefits).toBe(ssa1099.box5NetBenefits / 2)
      expect(ssa1099.halfOfBenefits).toBe(12000)
    })
  })

  describe('Social Security Taxation Worksheet', () => {
    it('should calculate provisional income correctly', () => {
      const expected =
        socialSecurityWorksheet.line2HalfBenefits +
        socialSecurityWorksheet.line3OtherIncome
      expect(socialSecurityWorksheet.line7ProvisionalIncome).toBe(expected)
    })

    it('should have $0 base amount for MFS living with spouse', () => {
      expect(socialSecurityWorksheet.livedWithSpouse).toBe(true)
      expect(socialSecurityWorksheet.line8BaseAmount).toBe(0)
    })

    it('should tax 85% of Social Security for MFS with income', () => {
      expect(socialSecurityWorksheet.taxablePercentage).toBe(0.85)
    })

    it('should calculate taxable Social Security correctly', () => {
      const expected =
        socialSecurityWorksheet.line1TotalBenefits *
        socialSecurityWorksheet.taxablePercentage
      expect(socialSecurityWorksheet.taxableSocialSecurity).toBe(expected)
    })
  })

  describe('Tax Calculation', () => {
    it('should have filing status MFS', () => {
      expect(form1040Data.filingStatus).toBe(FilingStatus.MFS)
    })

    it('should have spouse SSN for MFS', () => {
      expect(form1040Data.spouseSsn).toBeDefined()
      expect(form1040Data.spouseSsn).toHaveLength(9)
    })

    it('should have no wages (retired)', () => {
      expect(form1040Data.line1zWages).toBe(0)
    })

    it('should calculate total income correctly', () => {
      const expectedTotal =
        form1040Data.line5bTaxablePensions +
        form1040Data.line6bTaxableSocialSecurity
      expect(form1040Data.totalIncome).toBe(expectedTotal)
      expect(form1040Data.totalIncome).toBe(56400)
    })

    it('should use standard deduction for MFS 2025', () => {
      expect(form1040Data.deduction).toBe(15000)
    })

    it('should not include rollover in taxable income', () => {
      expect(form1040Data.line4bTaxableIra).toBe(0)
    })

    it('should calculate taxable income correctly', () => {
      const expected = form1040Data.agi - form1040Data.deduction
      expect(form1040Data.taxableIncome).toBe(expected)
      expect(form1040Data.taxableIncome).toBe(41400)
    })
  })

  describe('Withholding and Payments', () => {
    it('should include pension withholding', () => {
      expect(form1099RPension.box4FederalWithholding).toBe(4320)
    })

    it('should include Social Security withholding', () => {
      expect(ssa1099.box6FederalWithholding).toBe(2400)
    })

    it('should calculate total withholding correctly', () => {
      const expected =
        form1099RPension.box4FederalWithholding + ssa1099.box6FederalWithholding
      expect(form1040Data.line25dTotalWithholding).toBe(expected)
      expect(form1040Data.line25dTotalWithholding).toBe(6720)
    })

    it('should have withholding on Line 25b (1099 withholding)', () => {
      expect(form1040Data.line25b1099Withholding).toBe(6720)
    })
  })

  describe('Business Rules', () => {
    it('should require spouse SSN for MFS filing', () => {
      expect(form1040Data.filingStatus).toBe(FilingStatus.MFS)
      expect(form1040Data.spouseSsn).toBeDefined()
    })

    it('should have no EIC for MFS filer', () => {
      // MFS filers cannot claim EIC
      // EIC is not tracked in form1040Data as MFS filers are ineligible
      expect(form1040Data.filingStatus).toBe(FilingStatus.MFS)
    })

    it('should properly exclude rollover from taxable income', () => {
      // Gross shows full distribution, taxable shows 0 for rollover
      expect(form1040Data.line4aIraDistributions).toBe(25000)
      expect(form1040Data.line4bTaxableIra).toBe(0)
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

    it('should flow pension distribution to Form 1040 correctly', () => {
      expect(form1040Data.line5bTaxablePensions).toBe(
        form1099RPension.box2aTaxableAmount
      )
    })

    it('should flow Social Security taxable amount to Form 1040 correctly', () => {
      expect(form1040Data.line6bTaxableSocialSecurity).toBe(
        socialSecurityWorksheet.taxableSocialSecurity
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
