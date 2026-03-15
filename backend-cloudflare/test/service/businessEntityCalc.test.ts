import { describe, it, expect } from 'vitest'
import {
  TaxCalculationService,
  type BusinessEntityResult
} from '../../src/services/taxCalculationService'
import { K1GenerationService } from '../../src/services/k1GenerationService'

const taxCalcService = new TaxCalculationService()
const k1Service = new K1GenerationService()

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal C-Corp facts builder */
const cCorpFacts = (overrides: Record<string, unknown> = {}) => ({
  entityName: 'Acme Corp',
  ein: '12-3456789',
  entityType: 'C-Corporation',
  accountingMethod: 'accrual',
  taxYear: 2025,
  totalAssets: 1000000,
  income: {
    grossReceiptsOrSales: 500000,
    returnsAndAllowances: 0,
    costOfGoodsSold: 0,
    dividendIncome: 0,
    interestIncome: 0,
    grossRents: 0,
    grossRoyalties: 0,
    capitalGainNetIncome: 0,
    netGainFromSaleOfAssets: 0,
    otherIncome: 0
  },
  deductions: {
    compensationOfOfficers: 0,
    salariesAndWages: 200000,
    repairsAndMaintenance: 0,
    badDebts: 0,
    rents: 50000,
    taxesAndLicenses: 20000,
    interest: 0,
    charitableContributions: 0,
    depreciation: 10000,
    depletion: 0,
    advertising: 10000,
    pensionPlans: 0,
    employeeBenefits: 10000,
    domesticProductionDeduction: 0,
    otherDeductions: 0
  },
  specialDeductions: {
    dividendsReceivedDeduction: 0,
    dividendsFromAffiliated: 0,
    dividendsOnDebtFinancedStock: 0,
    dividendsOnCertainPreferred: 0,
    foreignDividends: 0,
    nol: 0
  },
  estimatedTaxPayments: 0,
  extensionPayment: 0,
  priorYearOverpayment: 0,
  ...overrides
})

/** Minimal S-Corp facts builder */
const sCorpFacts = (overrides: Record<string, unknown> = {}) => ({
  entityName: 'TechStart LLC',
  ein: '98-7654321',
  entityType: 'S-Corporation',
  accountingMethod: 'cash',
  taxYear: 2025,
  totalAssets: 500000,
  income: {
    grossReceiptsOrSales: 400000,
    returnsAndAllowances: 0,
    costOfGoodsSold: 0,
    netGainFromSaleOfAssets: 0,
    otherIncome: 0,
    interestIncome: 0,
    dividendIncome: 0,
    grossRents: 0,
    grossRoyalties: 0
  },
  deductions: {
    compensation: 50000,
    salariesAndWages: 100000,
    repairsAndMaintenance: 0,
    badDebts: 0,
    rents: 20000,
    taxesAndLicenses: 10000,
    interest: 0,
    depreciation: 10000,
    depletion: 0,
    advertising: 5000,
    pensionPlans: 0,
    employeeBenefits: 5000,
    otherDeductions: 0
  },
  shareholders: [
    {
      name: 'Alice Johnson',
      ssn: '111-22-3333',
      ownershipPercentage: 60,
      stockOwned: 600,
      isOfficer: true,
      compensation: 50000
    },
    {
      name: 'Bob Smith',
      ssn: '444-55-6666',
      ownershipPercentage: 40,
      stockOwned: 400,
      isOfficer: false
    }
  ],
  scheduleK: {
    ordinaryBusinessIncome: 200000,
    netRentalRealEstateIncome: 0,
    otherNetRentalIncome: 0,
    interestIncome: 0,
    dividendIncome: 0,
    qualifiedDividends: 0,
    royalties: 0,
    netShortTermCapitalGain: 0,
    netLongTermCapitalGain: 0,
    collectibles28Gain: 0,
    unrecaptured1250Gain: 0,
    net1231Gain: 0,
    otherIncome: 0,
    section179Deduction: 0,
    otherDeductions: 0,
    charitableContributions: 0,
    lowIncomeHousingCredit: 0,
    otherCredits: 0,
    netEarningsSE: 0,
    taxExemptInterest: 0,
    otherTaxExemptIncome: 0,
    nondeductibleExpenses: 0,
    cashDistributions: 0,
    propertyDistributions: 0,
    section199AQBI: 0
  },
  estimatedTaxPayments: 0,
  ...overrides
})

/** Minimal Partnership facts builder */
const partnershipFacts = (overrides: Record<string, unknown> = {}) => ({
  entityName: 'Golden Gate Partners',
  ein: '55-1234567',
  entityType: 'General Partnership',
  accountingMethod: 'cash',
  taxYear: 2025,
  totalAssets: 800000,
  income: {
    grossReceiptsOrSales: 600000,
    returnsAndAllowances: 0,
    costOfGoodsSold: 0,
    ordinaryIncome: 0,
    netFarmProfit: 0,
    netGainFromSaleOfAssets: 0,
    otherIncome: 0,
    interestIncome: 0,
    dividendIncome: 0,
    grossRents: 0,
    grossRoyalties: 0,
    net1231Gain: 0
  },
  deductions: {
    salariesAndWages: 100000,
    guaranteedPaymentsToPartners: 50000,
    repairsAndMaintenance: 10000,
    badDebts: 0,
    rents: 30000,
    taxesAndLicenses: 15000,
    interest: 5000,
    depreciation: 20000,
    depletion: 0,
    retirementPlans: 10000,
    employeeBenefits: 5000,
    otherDeductions: 5000
  },
  partners: [
    {
      name: 'Partner Alpha',
      tin: '111-22-3333',
      tinType: 'SSN',
      isGeneralPartner: true,
      isLimitedPartner: false,
      isDomestic: true,
      profitSharingPercent: 50,
      lossSharingPercent: 50,
      capitalSharingPercent: 50,
      beginningCapitalAccount: 100000,
      capitalContributed: 0,
      currentYearIncrease: 0,
      withdrawalsDistributions: 0,
      endingCapitalAccount: 100000
    },
    {
      name: 'Partner Beta',
      tin: '444-55-6666',
      tinType: 'SSN',
      isGeneralPartner: true,
      isLimitedPartner: false,
      isDomestic: true,
      profitSharingPercent: 30,
      lossSharingPercent: 30,
      capitalSharingPercent: 30,
      beginningCapitalAccount: 60000,
      capitalContributed: 0,
      currentYearIncrease: 0,
      withdrawalsDistributions: 0,
      endingCapitalAccount: 60000
    },
    {
      name: 'Partner Gamma',
      tin: '777-88-9999',
      tinType: 'SSN',
      isGeneralPartner: false,
      isLimitedPartner: true,
      isDomestic: true,
      profitSharingPercent: 20,
      lossSharingPercent: 20,
      capitalSharingPercent: 20,
      beginningCapitalAccount: 40000,
      capitalContributed: 0,
      currentYearIncrease: 0,
      withdrawalsDistributions: 0,
      endingCapitalAccount: 40000
    }
  ],
  scheduleK: {
    ordinaryBusinessIncome: 350000,
    netRentalRealEstateIncome: 0,
    otherNetRentalIncome: 0,
    interestIncome: 5000,
    dividendIncome: 3000,
    qualifiedDividends: 0,
    royalties: 0,
    netShortTermCapitalGain: 0,
    netLongTermCapitalGain: 10000,
    collectibles28Gain: 0,
    unrecaptured1250Gain: 0,
    net1231Gain: 0,
    otherIncome: 0,
    section179Deduction: 0,
    otherDeductions: 0,
    charitableContributions: 0,
    lowIncomeHousingCredit: 0,
    otherCredits: 0,
    netEarningsSE: 350000,
    taxExemptInterest: 0,
    otherTaxExemptIncome: 0,
    nondeductibleExpenses: 0,
    cashDistributions: 0,
    propertyDistributions: 0,
    section199AQBI: 0
  },
  liabilitiesAtYearEnd: {
    recourse: 0,
    nonrecourse: 0,
    qualifiedNonrecourse: 0
  },
  capitalAccountMethod: 'tax',
  ...overrides
})

/** Minimal Trust/Estate facts builder */
const trustFacts = (overrides: Record<string, unknown> = {}) => ({
  entityName: 'Smith Family Trust',
  ein: '66-9876543',
  entityType: 'complexTrust',
  dateCreated: '2020-01-15',
  isFinalReturn: false,
  fiduciary: {
    name: 'John Smith',
    title: 'Trustee',
    address: '456 Oak Ave',
    ein: '66-9876543',
    phone: '555-0100'
  },
  beneficiaries: [],
  income: {
    interest: 40000,
    ordinaryDividends: 30000,
    qualifiedDividends: 20000,
    businessIncome: 0,
    capitalGainShortTerm: 10000,
    capitalGainLongTerm: 20000,
    rents: 0,
    royalties: 0,
    farmIncome: 0,
    otherIncome: 0
  },
  deductions: {
    interestExpense: 0,
    taxes: 0,
    fiduciaryFees: 0,
    charitableDeduction: 0,
    attorneyFees: 0,
    accountantFees: 0,
    otherDeductions: 0
  },
  requiredDistributions: 0,
  otherDistributions: 0,
  section645Election: false,
  section663bElection: false,
  estimatedTaxPayments: 0,
  withholding: 0,
  taxYear: 2025,
  ...overrides
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Business Entity Tax Calculations', () => {
  // ─── C-Corp (Form 1120) ─────────────────────────────────────────────────

  describe('C-Corp (Form 1120)', () => {
    it('computes 21% flat rate tax on $200K taxable income', () => {
      const result = taxCalcService.calculateF1120(cCorpFacts())

      expect(result.success).toBe(true)
      if (!result.success) return

      // Income: 500K gross receipts
      // Deductions: 200K wages + 50K rent + 20K tax + 10K dep + 10K adv + 10K benefits = 300K
      // Taxable income: 500K - 300K = 200K
      // Tax at 21%: 42K
      expect(result.formType).toBe('1120')
      expect(result.entityName).toBe('Acme Corp')
      expect(result.totalIncome).toBe(500000)
      expect(result.totalDeductions).toBe(300000)
      expect(result.taxableIncome).toBe(200000)
      expect(result.totalTax).toBe(42000)
      expect(result.effectiveTaxRate).toBeCloseTo(0.084, 2)
      expect(result.schedules).toContain('f1120')
    })

    it('returns zero tax for zero income', () => {
      const result = taxCalcService.calculateF1120(
        cCorpFacts({
          income: {
            grossReceiptsOrSales: 0,
            returnsAndAllowances: 0,
            costOfGoodsSold: 0,
            dividendIncome: 0,
            interestIncome: 0,
            grossRents: 0,
            grossRoyalties: 0,
            capitalGainNetIncome: 0,
            netGainFromSaleOfAssets: 0,
            otherIncome: 0
          },
          deductions: {
            compensationOfOfficers: 0,
            salariesAndWages: 0,
            repairsAndMaintenance: 0,
            badDebts: 0,
            rents: 0,
            taxesAndLicenses: 0,
            interest: 0,
            charitableContributions: 0,
            depreciation: 0,
            depletion: 0,
            advertising: 0,
            pensionPlans: 0,
            employeeBenefits: 0,
            domesticProductionDeduction: 0,
            otherDeductions: 0
          }
        })
      )

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.totalTax).toBe(0)
      expect(result.taxableIncome).toBe(0)
    })

    it('does not produce owner allocations (C-Corps pay entity-level tax)', () => {
      const result = taxCalcService.calculateF1120(cCorpFacts())
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.ownerAllocations).toBeUndefined()
    })

    it('handles estimated tax payments and computes amount owed', () => {
      const result = taxCalcService.calculateF1120(
        cCorpFacts({ estimatedTaxPayments: 30000 })
      )
      expect(result.success).toBe(true)
      if (!result.success) return
      // Tax is 42K, payments 30K, owed 12K
      expect(result.totalTax).toBe(42000)
      expect(result.totalPayments).toBe(30000)
      expect(result.amountOwed).toBe(12000)
      expect(result.overpayment).toBe(0)
    })

    it('computes overpayment when payments exceed tax', () => {
      const result = taxCalcService.calculateF1120(
        cCorpFacts({ estimatedTaxPayments: 50000 })
      )
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.totalTax).toBe(42000)
      expect(result.amountOwed).toBe(0)
      expect(result.overpayment).toBe(8000)
    })
  })

  // ─── S-Corp (Form 1120-S) ──────────────────────────────────────────────

  describe('S-Corp (Form 1120-S)', () => {
    it('has no entity-level tax for ordinary operations', () => {
      const result = taxCalcService.calculateF1120S(sCorpFacts())

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.formType).toBe('1120-S')
      expect(result.entityName).toBe('TechStart LLC')
      // S-Corp: no entity-level ordinary tax
      expect(result.totalTax).toBe(0)
      expect(result.schedules).toContain('f1120s')
    })

    it('allocates income to 2 shareholders by ownership (60%/40%)', () => {
      const result = taxCalcService.calculateF1120S(sCorpFacts())

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.ownerAllocations).toBeDefined()
      expect(result.ownerAllocations).toHaveLength(2)

      const alice = result.ownerAllocations!.find(
        (a) => a.name === 'Alice Johnson'
      )!
      const bob = result.ownerAllocations!.find((a) => a.name === 'Bob Smith')!

      expect(alice.ownershipPct).toBe(60)
      expect(bob.ownershipPct).toBe(40)

      // Schedule K ordinary business income = 200K
      // Alice gets 60% = 120K, Bob gets 40% = 80K
      expect(alice.ordinaryIncome).toBe(120000)
      expect(bob.ordinaryIncome).toBe(80000)

      // S-Corp shareholders do not have SE earnings
      expect(alice.selfEmploymentEarnings).toBe(0)
      expect(bob.selfEmploymentEarnings).toBe(0)
    })

    it('handles built-in gains tax for former C-Corp conversions', () => {
      const result = taxCalcService.calculateF1120S(
        sCorpFacts({ builtInGainsTax: 5000 })
      )
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.totalTax).toBe(5000)
    })
  })

  // ─── Partnership (Form 1065) ──────────────────────────────────────────

  describe('Partnership (Form 1065)', () => {
    it('has no entity-level tax (pass-through)', () => {
      const result = taxCalcService.calculateF1065(partnershipFacts())

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.formType).toBe('1065')
      expect(result.entityName).toBe('Golden Gate Partners')
      expect(result.totalTax).toBe(0)
      expect(result.effectiveTaxRate).toBe(0)
      expect(result.schedules).toContain('f1065')
    })

    it('allocates income to 3 partners (50%/30%/20%)', () => {
      const result = taxCalcService.calculateF1065(partnershipFacts())

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.ownerAllocations).toBeDefined()
      expect(result.ownerAllocations).toHaveLength(3)

      const alpha = result.ownerAllocations!.find(
        (a) => a.name === 'Partner Alpha'
      )!
      const beta = result.ownerAllocations!.find(
        (a) => a.name === 'Partner Beta'
      )!
      const gamma = result.ownerAllocations!.find(
        (a) => a.name === 'Partner Gamma'
      )!

      expect(alpha.ownershipPct).toBe(50)
      expect(beta.ownershipPct).toBe(30)
      expect(gamma.ownershipPct).toBe(20)

      // Ordinary business income from Schedule K = 350K
      // Alpha 50% = 175K, Beta 30% = 105K, Gamma 20% = 70K
      expect(alpha.ordinaryIncome).toBe(175000)
      expect(beta.ordinaryIncome).toBe(105000)
      expect(gamma.ordinaryIncome).toBe(70000)

      // Interest income from Schedule K = 5K
      expect(alpha.interestIncome).toBe(2500)
      expect(beta.interestIncome).toBe(1500)
      expect(gamma.interestIncome).toBe(1000)

      // Capital gains from Schedule K = 10K long-term
      expect(alpha.capitalGains).toBe(5000)
      expect(beta.capitalGains).toBe(3000)
      expect(gamma.capitalGains).toBe(2000)

      // Dividend income from Schedule K = 3K
      expect(alpha.dividendIncome).toBe(1500)
      expect(beta.dividendIncome).toBe(900)
      expect(gamma.dividendIncome).toBe(600)
    })

    it('allocates SE earnings only to general partners', () => {
      const result = taxCalcService.calculateF1065(partnershipFacts())

      expect(result.success).toBe(true)
      if (!result.success) return

      const alpha = result.ownerAllocations!.find(
        (a) => a.name === 'Partner Alpha'
      )!
      const gamma = result.ownerAllocations!.find(
        (a) => a.name === 'Partner Gamma'
      )!

      // Alpha is general partner: gets SE earnings
      // SE earnings from Schedule K = 350K, Alpha 50% = 175K
      expect(alpha.selfEmploymentEarnings).toBe(175000)

      // Gamma is limited partner: NO SE earnings
      expect(gamma.selfEmploymentEarnings).toBe(0)
    })

    it('generates correct K-1 packages', () => {
      const result = taxCalcService.calculateF1065(partnershipFacts())
      expect(result.success).toBe(true)
      if (!result.success) return

      const k1s = k1Service.generateK1s(result)
      expect(k1s).toHaveLength(3)

      const alphaK1 = k1s.find((k) => k.ownerName === 'Partner Alpha')!
      expect(alphaK1.formType).toBe('K-1 (1065)')
      expect(alphaK1.taxYear).toBe(2025)
      expect(alphaK1.entityName).toBe('Golden Gate Partners')
      expect(alphaK1.ownershipPct).toBe(50)

      // Check that line items exist
      const ordinaryLine = alphaK1.lineItems.find((li) => li.lineNumber === '1')
      expect(ordinaryLine).toBeDefined()
      expect(ordinaryLine!.amount).toBe(175000)

      const interestLine = alphaK1.lineItems.find((li) => li.lineNumber === '5')
      expect(interestLine).toBeDefined()
      expect(interestLine!.amount).toBe(2500)
    })
  })

  // ─── Trust/Estate (Form 1041) ─────────────────────────────────────────

  describe('Trust/Estate (Form 1041)', () => {
    it('computes tax using compressed bracket rates on $100K income', () => {
      const result = taxCalcService.calculateF1041(trustFacts())

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.formType).toBe('1041')
      expect(result.entityName).toBe('Smith Family Trust')

      // Total income: 40K interest + 30K dividends + 10K ST cap gains + 20K LT cap gains = 100K
      expect(result.totalIncome).toBe(100000)
      expect(result.totalDeductions).toBe(0)

      // Taxable income: 100K - $100 exemption (complex trust) = $99,900
      // No distributions, so no income distribution deduction
      expect(result.taxableIncome).toBe(99900)

      // 2025 trust brackets (compressed):
      //   0 - 3,150     @ 10%  = 315
      //   3,150 - 11,450 @ 24% = 1,992
      //   11,450 - 15,650 @ 35% = 1,470
      //   15,650+        @ 37%  = (99,900 - 15,650) * 0.37 = 31,172.50
      // Total = 315 + 1992 + 1470 + 31172.50 = 34,949.50 -> rounded = 34,950
      expect(result.totalTax).toBe(34950)
    })

    it('applies correct exemption for simple trusts ($300)', () => {
      const result = taxCalcService.calculateF1041(
        trustFacts({ entityType: 'simpleTrust' })
      )

      expect(result.success).toBe(true)
      if (!result.success) return

      // Simple trust must distribute all income, so distribution deduction = adjusted total income
      // Taxable income = 0 for a simple trust that distributes everything
      expect(result.taxableIncome).toBe(0)
      expect(result.totalTax).toBe(0)
    })

    it('applies correct exemption for decedent estates ($600)', () => {
      const result = taxCalcService.calculateF1041(
        trustFacts({
          entityType: 'decedentEstate',
          requiredDistributions: 0,
          otherDistributions: 0
        })
      )

      expect(result.success).toBe(true)
      if (!result.success) return

      // Decedent estate exemption is $600
      // Taxable income: 100,000 - 600 = 99,400
      expect(result.taxableIncome).toBe(99400)
    })

    it('reduces taxable income by distribution deduction', () => {
      const result = taxCalcService.calculateF1041(
        trustFacts({
          requiredDistributions: 50000,
          otherDistributions: 10000
        })
      )

      expect(result.success).toBe(true)
      if (!result.success) return

      // Distribution deduction = min(100K adjusted income, 50K + 10K) = 60K
      // Taxable income = 100K - 60K - 100 exemption = 39,900
      expect(result.taxableIncome).toBe(39900)

      // Tax on 39,900 using compressed brackets:
      //   0 - 3,150      @ 10% = 315
      //   3,150 - 11,450  @ 24% = 1,992
      //   11,450 - 15,650 @ 35% = 1,470
      //   15,650 - 39,900 @ 37% = (39,900 - 15,650) * 0.37 = 8,972.50
      // Total = 315 + 1992 + 1470 + 8972.50 = 12,749.50 -> rounded = 12,750
      expect(result.totalTax).toBe(12750)
    })

    it('computes overpayment from estimated tax payments', () => {
      const result = taxCalcService.calculateF1041(
        trustFacts({ estimatedTaxPayments: 40000 })
      )

      expect(result.success).toBe(true)
      if (!result.success) return
      // Tax is 34,950, payments are 40,000
      expect(result.totalTax).toBe(34950)
      expect(result.totalPayments).toBe(40000)
      expect(result.amountOwed).toBe(0)
      expect(result.overpayment).toBe(5050)
    })
  })

  // ─── Dispatch method ──────────────────────────────────────────────────

  describe('calculateEntity dispatch', () => {
    it('routes 1120 to C-Corp calculation', () => {
      const result = taxCalcService.calculateEntity(cCorpFacts(), '1120')
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.formType).toBe('1120')
    })

    it('routes 1120-S to S-Corp calculation', () => {
      const result = taxCalcService.calculateEntity(sCorpFacts(), '1120-S')
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.formType).toBe('1120-S')
    })

    it('routes 1065 to Partnership calculation', () => {
      const result = taxCalcService.calculateEntity(partnershipFacts(), '1065')
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.formType).toBe('1065')
    })

    it('routes 1041 to Trust/Estate calculation', () => {
      const result = taxCalcService.calculateEntity(trustFacts(), '1041')
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.formType).toBe('1041')
    })

    it('returns error for unsupported form type', () => {
      const result = taxCalcService.calculateEntity({}, '990')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.errors[0]).toContain('Unsupported')
    })
  })

  // ─── K-1 Generation Service ───────────────────────────────────────────

  describe('K1GenerationService', () => {
    it('generates S-Corp K-1 packages with correct line items', () => {
      const result = taxCalcService.calculateF1120S(sCorpFacts())
      expect(result.success).toBe(true)
      if (!result.success) return

      const k1s = k1Service.generateK1s(result)
      expect(k1s).toHaveLength(2)

      const aliceK1 = k1s.find((k) => k.ownerName === 'Alice Johnson')!
      expect(aliceK1.formType).toBe('K-1 (1120-S)')
      expect(aliceK1.ownershipPct).toBe(60)

      const ordinaryLine = aliceK1.lineItems.find((li) => li.lineNumber === '1')
      expect(ordinaryLine).toBeDefined()
      expect(ordinaryLine!.description).toBe('Ordinary business income (loss)')
      expect(ordinaryLine!.amount).toBe(120000)
    })

    it('returns empty array for C-Corp (no pass-through)', () => {
      const result = taxCalcService.calculateF1120(cCorpFacts())
      expect(result.success).toBe(true)
      if (!result.success) return

      const k1s = k1Service.generateK1s(result)
      expect(k1s).toHaveLength(0)
    })

    it('generates summary with aggregate totals', () => {
      const result = taxCalcService.calculateF1065(partnershipFacts())
      expect(result.success).toBe(true)
      if (!result.success) return

      const summary = k1Service.generateK1Summary(result)
      expect(summary.count).toBe(3)
      expect(summary.aggregateTotalIncome).toBeGreaterThan(0)
    })
  })
})
