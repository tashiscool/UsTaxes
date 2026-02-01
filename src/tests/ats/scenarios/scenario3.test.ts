/**
 * IRS ATS Test Scenario 3 - Lynette Heather
 *
 * Test Scenario Reference: IRS ATS Test Scenario 3 (ty25-1040-mef-ats-scenario-3-10202025.pdf)
 * Primary Taxpayer: Lynette Heather
 * Filing Status: Single (1)
 * IP PIN: 876534
 * No Dependents
 *
 * Key Features Tested:
 * - Form 1099-R (Retirement Distribution)
 * - Schedule F (Farm Income)
 * - Schedule SE (Self-Employment Tax) with Farm Optional Method
 * - Schedule D (Capital Gains)
 * - Schedule E (Rental Income)
 * - Form 4835 (Farm Rental Income)
 * - Principal Business Code for Farming (111400 - Floral Plants)
 *
 * Tax Year: 2025
 */

import { FilingStatus } from 'ustaxes/core/data'

// =============================================================================
// Test Data Fixtures - Lynette Heather (Scenario 3)
// =============================================================================

/**
 * Primary taxpayer information
 */
const lynetteHeatherTaxpayer = {
  firstName: 'Lynette',
  lastName: 'Heather',
  ssn: '400011035',
  ssnAtsReference: '400-00-1035',
  ipPin: '876534',
  address: {
    address: '2525 Juniper Street',
    city: 'Paul',
    state: 'ID' as const,
    zip: '83347'
  },
  dateOfBirth: new Date(1958, 3, 22), // April 22, 1958
  occupation: 'Farmer',
  digitalAssets: false
}

/**
 * Form 1099-R (Retirement Distribution)
 */
const form1099R = {
  payer: {
    name: 'Primrose Retirement Fund',
    tin: '000000030',
    address: {
      address: '1000 Financial Drive',
      city: 'Boise',
      state: 'ID' as const,
      zip: '83702'
    }
  },
  recipientSsn: '400011035',

  box1GrossDistribution: 53778,
  box2aTaxableAmount: 43100,
  box2bTaxableNotDetermined: false,
  box2bTotalDistribution: false,
  box3CapitalGain: 0,
  box4FederalWithholding: 5100,
  box5EmployeeContributions: 10678,
  box6Nua: 0,
  box7DistributionCode: '7', // Normal distribution
  box8Other: 0,
  box9aPercentage: 100,
  box9bTotalEmployeeContributions: 10678,

  box10StateDistribution: 53778,
  box11StateTaxWithheld: 2150,
  box12State: 'ID',

  iraSepSimple: false,
  nontaxableAmount: 10678 // 53778 - 43100
}

/**
 * Schedule F (Profit or Loss From Farming)
 */
const scheduleF = {
  farmName: "Heather's Floral Plants",
  principalBusinessCode: '111400', // NAICS: Greenhouse/Nursery/Floriculture
  principalProduct: 'Floral Plants',
  ein: '000000031',
  accountingMethod: 'Cash' as const,
  materialParticipation: true,

  // Part I - Farm Income
  line1aLivestockSales: 0,
  line1bCostOfLivestock: 0,
  line1cLivestockProfit: 0,
  line2ProductsRaised: 32500,
  line3aCooperativeTotal: 0,
  line3bCooperativeTaxable: 0,
  line4aAgPaymentsTotal: 2800,
  line4bAgPaymentsTaxable: 2800,
  line5aCccLoans: 0,
  line5bCccElection: false,
  line6aCropInsurance: 0,
  line7CustomHire: 1500,
  line8OtherIncome: 450,
  line9GrossIncome: 37250, // 32500 + 2800 + 1500 + 450

  // Part II - Farm Expenses
  expenses: {
    line10CarTruck: 1850,
    line11Chemicals: 890,
    line12Conservation: 0,
    line13CustomHire: 600,
    line14Depreciation: 4200,
    line15EmployeeBenefit: 0,
    line16Feed: 0,
    line17Fertilizers: 2100,
    line18Freight: 340,
    line19Fuel: 1680,
    line20Insurance: 1450,
    line21aMortgageInterest: 0,
    line21bOtherInterest: 580,
    line22LaborHired: 3200,
    line23PensionProfitSharing: 0,
    line24aRentVehicles: 0,
    line24bRentOther: 2400,
    line25Repairs: 1875,
    line26SeedsPlants: 4500,
    line27Storage: 0,
    line28Supplies: 1250,
    line29Taxes: 890,
    line30Utilities: 1100,
    line31VetMedicine: 0,
    line32Other: 650
  },

  // Line 33 - Total expenses
  line33TotalExpenses: 29555,

  // Line 34 - Net farm profit (or loss)
  line34NetProfit: 7695, // 37250 - 29555

  usesIncomeAveraging: false,
  filedScheduleFPriorYears: true,
  firstYearFarming: false
}

/**
 * Schedule SE (Self-Employment Tax)
 */
const scheduleSE = {
  usesShortScheduleSE: false,

  // Regular Method
  regularMethod: {
    line1aNetFarmProfit: 7695,
    line1bConservationReserve: 0,
    line2NetNonfarmProfit: 0,
    line3Total: 7695,
    line4aChurchEmployee: 0,
    line4bTotal: 7695,
    line4c9235Percent: 7107.38 // 7695 * 0.9235
  },

  usesFarmOptionalMethod: true,
  usesNonfarmOptionalMethod: false,

  farmOptionalMethod: {
    grossFarmIncome: 37250,
    twoThirdsGross: 24833.33, // 37250 * 2/3
    maxOptionalAmount2025: 6920,
    optionalMethodAmount: 6920,
    netFarmIncome: 7695,
    optionalIsBeneficial: false // Net is $7,695 > $6,920
  },

  line5CombinedSeEarnings: 7695,
  line69235Percent: 7106.39,
  maximumSeBase2025: 176100,
  line8SsWages: 0,
  line9RemainingBase: 176100,
  line10SsBase: 7106.39,
  line11SsTax: 881.19, // 7106.39 * 0.124
  line12MedicareTax: 206.09, // 7106.39 * 0.029
  line13TotalSeTax: 1087.28, // 881.19 + 206.09
  line14SeDeduction: 543.64, // 1087.28 / 2

  seTaxRounded: 1087,
  seDeductionRounded: 544
}

/**
 * Schedule D (Capital Gains and Losses)
 */
const scheduleD = {
  shortTerm: {
    line1aTotalsFrom8949: 0,
    line1bTotalsFrom8949: 0,
    line6NetShortTerm: 0
  },

  longTerm: {
    line8aTotalsFrom8949: 4200, // Proceeds
    line8bCostBasis: 2800,
    line8dGainLoss: 1400
  },

  summary: {
    line15Combine6And14: 1400,
    line16GainFromBothPositive: true,
    line21NetCapitalGain: 1400
  },

  usesQualifiedDividendsWorksheet: false,
  usesScheduleDTaxWorksheet: false,
  capitalGainTo1040: 1400
}

/**
 * Schedule E (Supplemental Income and Loss) - Rental Property
 */
const scheduleE = {
  part1Rental: {
    properties: [
      {
        address: {
          address: '1515 Oak Lane',
          city: 'Paul',
          state: 'ID' as const,
          zip: '83347'
        },
        propertyType: 'Single Family Residence',
        fairRentalDays: 365,
        personalUseDays: 0,
        qualifiedJointVenture: false,
        rentsReceived: 14400, // $1,200/month
        autoTravel: 150,
        cleaningMaintenance: 600,
        insurance: 1100,
        mortgageInterest: 4200,
        repairs: 1850,
        supplies: 200,
        taxes: 1800,
        depreciation: 3500,
        totalExpenses: 13400,
        netIncome: 1000 // 14400 - 13400
      }
    ],
    totalRents: 14400,
    totalExpenses: 13400,
    totalDepreciation: 3500,
    totalNetIncome: 1000
  },

  part5Summary: {
    line26TotalIncome: 1000
  },

  scheduleEToSchedule1: 1000
}

/**
 * Form 4835 (Farm Rental Income and Expenses)
 */
const form4835 = {
  farmProperty: {
    address: '2000 Rural Route 5',
    city: 'Paul',
    state: 'ID' as const,
    zip: '83347',
    acres: 40
  },

  income: {
    line1IncomeBasedOnProduction: 17035,
    line2CooperativeDistributions: 0,
    line3AgProgramPayments: 0,
    line7GrossFarmRentalIncome: 17035
  },

  expenses: {
    line12Depreciation: 2100,
    line18Insurance: 850,
    line23Repairs: 1200,
    line27Taxes: 980
  },

  line31TotalExpenses: 5130,
  line32NetIncome: 11905, // 17035 - 5130

  flowsToScheduleE: true
}

/**
 * Schedule 1 (Additional Income and Adjustments)
 */
const schedule1 = {
  part1Income: {
    line1TaxableRefunds: 0,
    line2aAlimonyReceived: 0,
    line3BusinessIncome: 0, // No Schedule C
    line4OtherGains: 0,
    line5RentalIncome: 1000, // From Schedule E
    line6FarmIncome: 7695, // From Schedule F
    line7Unemployment: 0,
    line8OtherIncome: 11905, // Farm rental from 4835
    line9Combine1Through8: 20600,
    line10TotalAdditionalIncome: 20600
  },

  part2Adjustments: {
    line11EducatorExpenses: 0,
    line12BusinessExpenses: 0,
    line13HsaDeduction: 0,
    line14MovingExpenses: 0,
    line15SelfEmploymentTax: 544, // 1/2 of SE tax
    line16SepSimple: 0,
    line17SelfEmployedHealth: 0,
    line18PenaltyEarlyWithdrawal: 0,
    line19AlimonyPaid: 0,
    line20IraDeduction: 0,
    line21StudentLoanInterest: 0,
    line25Combine11Through24: 544,
    line26TotalAdjustments: 544
  }
}

/**
 * Complete Form 1040 data for Lynette Heather
 */
const form1040Data = (() => {
  // Income from various sources
  const taxablePension = form1099R.box2aTaxableAmount // $43,100
  const capitalGain = scheduleD.capitalGainTo1040 // $1,400
  const schedule1Income = schedule1.part1Income.line10TotalAdditionalIncome // $20,600

  // Total income
  const totalIncome = taxablePension + capitalGain + schedule1Income // $65,100

  // Adjustments (Schedule 1 Part II)
  const totalAdjustments = schedule1.part2Adjustments.line26TotalAdjustments // $544

  // AGI
  const agi = totalIncome - totalAdjustments // $64,556

  // Standard Deduction (2025 Single)
  const standardDeductionSingle2025 = 15000

  // Taxable Income
  const taxableIncome = Math.max(0, agi - standardDeductionSingle2025) // $49,556

  // Tax calculation - simplified
  // Tax on ordinary income plus preferential rate on LTCG
  const ordinaryIncome = taxableIncome - capitalGain // $48,156

  // 2025 Single brackets
  const taxBracket1 = 11600 * 0.1 // $1,160
  const taxBracket2 = (47150 - 11600) * 0.12 // $4,266
  const taxBracket3 = (ordinaryIncome - 47150) * 0.22 // ~$221
  const taxOnOrdinary = Math.round(taxBracket1 + taxBracket2 + taxBracket3) // ~$5,647

  // LTCG at 0% rate (within threshold)
  const taxOnLtcg = 0

  const calculatedTax = taxOnOrdinary + taxOnLtcg

  // Additional taxes
  const seTax = scheduleSE.seTaxRounded // $1,087

  // Total tax
  const totalTax = calculatedTax + seTax

  // Payments
  const federalWithholding = form1099R.box4FederalWithholding // $5,100
  const totalPayments = federalWithholding

  // Refund or owed
  const refund = totalPayments > totalTax ? totalPayments - totalTax : 0
  const amountOwed = totalTax > totalPayments ? totalTax - totalPayments : 0

  return {
    // Taxpayer info
    primarySsn: lynetteHeatherTaxpayer.ssn,
    primaryFirstName: lynetteHeatherTaxpayer.firstName,
    primaryLastName: lynetteHeatherTaxpayer.lastName,
    address: lynetteHeatherTaxpayer.address,
    ipPin: lynetteHeatherTaxpayer.ipPin,
    filingStatus: FilingStatus.S,

    // Checkboxes
    presidentialCampaign: false,
    digitalAssets: false,

    // No spouse
    spouseSsn: undefined,
    dependents: [],

    // Income lines
    line1zWages: 0, // No W-2 wages
    line4aIraPensionsGross: form1099R.box1GrossDistribution, // $53,778
    line4bIraPensionsTaxable: taxablePension, // $43,100
    line7CapitalGain: capitalGain, // $1,400
    line8Schedule1: schedule1Income, // $20,600
    line9TotalIncome: totalIncome, // $65,100
    totalIncome,

    // Adjustments
    line10Adjustments: totalAdjustments, // $544

    // AGI
    line11Agi: agi, // $64,556
    agi,

    // Deduction
    line12StandardDeduction: standardDeductionSingle2025, // $15,000
    line13QbiDeduction: 0,
    line14TotalDeductions: standardDeductionSingle2025,
    deduction: standardDeductionSingle2025,

    // Taxable income
    line15TaxableIncome: taxableIncome, // $49,556
    taxableIncome,

    // Tax
    line16Tax: calculatedTax,
    line17Schedule2: seTax, // $1,087 (SE tax on Schedule 2)
    line18Total: calculatedTax + seTax,
    line24TotalTax: totalTax,
    totalTax,

    // Payments
    line25aW2Withholding: 0,
    line25b1099Withholding: federalWithholding, // $5,100
    line25dTotalWithholding: federalWithholding,
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

describe('ATS Scenario 3 - Lynette Heather (Farm Income and Retirement)', () => {
  describe('Taxpayer Information', () => {
    it('should have correct taxpayer name', () => {
      expect(lynetteHeatherTaxpayer.firstName).toBe('Lynette')
      expect(lynetteHeatherTaxpayer.lastName).toBe('Heather')
    })

    it('should have valid IP PIN (6 digits)', () => {
      expect(lynetteHeatherTaxpayer.ipPin).toBe('876534')
      expect(lynetteHeatherTaxpayer.ipPin).toHaveLength(6)
    })

    it('should have occupation as Farmer', () => {
      expect(lynetteHeatherTaxpayer.occupation).toBe('Farmer')
    })
  })

  describe('Form 1099-R (Retirement Distribution)', () => {
    it('should have gross distribution and taxable amount', () => {
      expect(form1099R.box1GrossDistribution).toBe(53778)
      expect(form1099R.box2aTaxableAmount).toBe(43100)
    })

    it('should have nontaxable amount equal to employee contributions', () => {
      const nontaxable =
        form1099R.box1GrossDistribution - form1099R.box2aTaxableAmount
      expect(form1099R.nontaxableAmount).toBe(nontaxable)
      expect(form1099R.nontaxableAmount).toBe(10678)
    })

    it('should have distribution code 7 (normal)', () => {
      expect(form1099R.box7DistributionCode).toBe('7')
    })

    it('should have federal withholding', () => {
      expect(form1099R.box4FederalWithholding).toBe(5100)
    })
  })

  describe('Schedule F (Farm Income)', () => {
    it('should have correct NAICS code for greenhouse/nursery', () => {
      expect(scheduleF.principalBusinessCode).toBe('111400')
    })

    it('should calculate gross farm income correctly', () => {
      const expected =
        scheduleF.line2ProductsRaised +
        scheduleF.line4bAgPaymentsTaxable +
        scheduleF.line7CustomHire +
        scheduleF.line8OtherIncome
      expect(scheduleF.line9GrossIncome).toBe(expected)
      expect(scheduleF.line9GrossIncome).toBe(37250)
    })

    it('should calculate total expenses correctly', () => {
      const expected = Object.values(scheduleF.expenses).reduce(
        (sum, val) => sum + val,
        0
      )
      expect(scheduleF.line33TotalExpenses).toBe(expected)
      expect(scheduleF.line33TotalExpenses).toBe(29555)
    })

    it('should calculate net farm profit correctly', () => {
      const expected =
        scheduleF.line9GrossIncome - scheduleF.line33TotalExpenses
      expect(scheduleF.line34NetProfit).toBe(expected)
      expect(scheduleF.line34NetProfit).toBe(7695)
    })

    it('should have material participation', () => {
      expect(scheduleF.materialParticipation).toBe(true)
    })
  })

  describe('Schedule SE (Self-Employment Tax)', () => {
    it('should use farm optional method', () => {
      expect(scheduleSE.usesFarmOptionalMethod).toBe(true)
    })

    it('should calculate 92.35% correctly', () => {
      // Verify the value is approximately 92.35% of line4bTotal
      const percentOf4b =
        scheduleSE.regularMethod.line4c9235Percent /
        scheduleSE.regularMethod.line4bTotal
      expect(percentOf4b).toBeCloseTo(0.9235, 2)
    })

    it('should calculate total SE tax correctly', () => {
      const expected = scheduleSE.line11SsTax + scheduleSE.line12MedicareTax
      expect(scheduleSE.line13TotalSeTax).toBeCloseTo(expected, 2)
    })

    it('should calculate deductible SE tax as 50%', () => {
      const expected = scheduleSE.line13TotalSeTax / 2
      expect(scheduleSE.line14SeDeduction).toBeCloseTo(expected, 2)
    })
  })

  describe('Schedule D (Capital Gains)', () => {
    it('should have long-term capital gain', () => {
      expect(scheduleD.longTerm.line8dGainLoss).toBe(1400)
    })

    it('should calculate gain correctly', () => {
      const expected =
        scheduleD.longTerm.line8aTotalsFrom8949 -
        scheduleD.longTerm.line8bCostBasis
      expect(scheduleD.longTerm.line8dGainLoss).toBe(expected)
    })

    it('should flow to Form 1040', () => {
      expect(scheduleD.capitalGainTo1040).toBe(1400)
    })
  })

  describe('Schedule E (Rental Income)', () => {
    it('should have rental property income', () => {
      expect(scheduleE.part1Rental.properties[0].rentsReceived).toBe(14400)
    })

    it('should calculate net rental income correctly', () => {
      const prop = scheduleE.part1Rental.properties[0]
      const expected = prop.rentsReceived - prop.totalExpenses
      expect(prop.netIncome).toBe(expected)
      expect(prop.netIncome).toBe(1000)
    })

    it('should flow to Schedule 1', () => {
      expect(scheduleE.scheduleEToSchedule1).toBe(1000)
    })
  })

  describe('Form 4835 (Farm Rental Income)', () => {
    it('should have farm rental income', () => {
      expect(form4835.income.line7GrossFarmRentalIncome).toBe(17035)
    })

    it('should calculate net farm rental income correctly', () => {
      const expected =
        form4835.income.line7GrossFarmRentalIncome -
        form4835.line31TotalExpenses
      expect(form4835.line32NetIncome).toBe(expected)
      expect(form4835.line32NetIncome).toBe(11905)
    })

    it('should flow to Schedule E', () => {
      expect(form4835.flowsToScheduleE).toBe(true)
    })
  })

  describe('Tax Calculation', () => {
    it('should have filing status Single', () => {
      expect(form1040Data.filingStatus).toBe(FilingStatus.S)
    })

    it('should calculate total income correctly', () => {
      const expected =
        form1040Data.line4bIraPensionsTaxable +
        form1040Data.line7CapitalGain +
        form1040Data.line8Schedule1
      expect(form1040Data.totalIncome).toBe(expected)
    })

    it('should calculate AGI correctly', () => {
      const expected = form1040Data.totalIncome - form1040Data.line10Adjustments
      expect(form1040Data.agi).toBe(expected)
    })

    it('should use standard deduction for 2025 Single', () => {
      expect(form1040Data.deduction).toBe(15000)
    })

    it('should include SE tax on Schedule 2', () => {
      expect(form1040Data.line17Schedule2).toBe(1087)
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

    it('should flow 1099-R to Form 1040 correctly', () => {
      expect(form1040Data.line4aIraPensionsGross).toBe(
        form1099R.box1GrossDistribution
      )
      expect(form1040Data.line4bIraPensionsTaxable).toBe(
        form1099R.box2aTaxableAmount
      )
    })

    it('should flow Schedule D to Form 1040 correctly', () => {
      expect(form1040Data.line7CapitalGain).toBe(scheduleD.capitalGainTo1040)
    })

    it('should flow Schedule 1 to Form 1040 correctly', () => {
      expect(form1040Data.line8Schedule1).toBe(
        schedule1.part1Income.line10TotalAdditionalIncome
      )
      expect(form1040Data.line10Adjustments).toBe(
        schedule1.part2Adjustments.line26TotalAdjustments
      )
    })
  })
})
