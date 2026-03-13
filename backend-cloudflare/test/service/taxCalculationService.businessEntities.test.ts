import { describe, it, expect } from 'vitest'
import {
  TaxCalculationService,
  isBusinessFormType
} from '../../src/services/taxCalculationService'

const svc = new TaxCalculationService()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal default business-entity facts; override per-test. */
const baseBizFacts = (overrides: Record<string, unknown> = {}) => ({
  entityName: 'Test Corp',
  ein: '12-3456789',
  entityType: 'C-Corporation',
  streetAddress: '100 Corporate Blvd',
  city: 'Wilmington',
  zip: '19801',
  naicsCode: '541511',
  productOrService: 'Software',
  accountingMethod: 'accrual',
  taxYear: 2025,
  isFiscalYear: false,
  totalAssets: 500000,
  income: {},
  deductions: {},
  specialDeductions: {},
  scheduleK: {},
  shareholders: [],
  partners: [],
  estimatedTaxPayments: 0,
  ...overrides
})

// ---------------------------------------------------------------------------
// isBusinessFormType utility
// ---------------------------------------------------------------------------

describe('isBusinessFormType', () => {
  it('recognises 1120, 1120-S, 1065, 1041, 990', () => {
    expect(isBusinessFormType('1120')).toBe(true)
    expect(isBusinessFormType('1120-S')).toBe(true)
    expect(isBusinessFormType('1065')).toBe(true)
    expect(isBusinessFormType('1041')).toBe(true)
    expect(isBusinessFormType('990')).toBe(true)
  })

  it('rejects individual form types', () => {
    expect(isBusinessFormType('1040')).toBe(false)
    expect(isBusinessFormType('1040-NR')).toBe(false)
    expect(isBusinessFormType('4868')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// C-Corp (Form 1120) — 21 % flat rate
// ---------------------------------------------------------------------------

describe('C-Corp (Form 1120)', () => {
  it('computes 21% tax on $400K taxable income ($1M receipts - $600K deductions)', () => {
    const result = svc.calculateBusinessEntity(
      '1120',
      baseBizFacts({
        income: {
          grossReceiptsOrSales: 1_000_000,
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
          compensationOfOfficers: 200_000,
          salariesAndWages: 300_000,
          repairsAndMaintenance: 0,
          badDebts: 0,
          rents: 50_000,
          taxesAndLicenses: 20_000,
          interest: 10_000,
          charitableContributions: 5_000,
          depreciation: 15_000,
          depletion: 0,
          advertising: 0,
          pensionPlans: 0,
          employeeBenefits: 0,
          domesticProductionDeduction: 0,
          otherDeductions: 5_000
        }
      })
    )

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.formType).toBe('1120')
    // Total income = $1M gross receipts
    expect(result.totalIncome).toBe(1_000_000)
    // Total deductions = 200K + 300K + 50K + 20K + 10K + 5K + 15K + 5K = 605K
    // (charitable contribution is capped at 10% of income before deduction, but
    //  the full 5K should be allowed since 10% of pre-charity income >> 5K)
    expect(result.totalDeductions).toBeGreaterThan(590_000)
    expect(result.totalDeductions).toBeLessThan(610_000)
    // Taxable income ~ $395K-$400K
    expect(result.taxableIncome).toBeGreaterThan(390_000)
    expect(result.taxableIncome).toBeLessThanOrEqual(400_000)
    // Tax at 21% flat: ~$83K-$84K
    expect(result.totalTax).toBeGreaterThan(80_000)
    expect(result.totalTax).toBeLessThanOrEqual(84_000)
    expect(result.effectiveTaxRate).toBeGreaterThan(0.08)
    expect(result.schedules).toContain('f1120')
    // C-Corp has no pass-through allocations
    expect(result.ownerAllocations).toBeUndefined()
  })

  it('returns zero tax for zero income', () => {
    const result = svc.calculateBusinessEntity('1120', baseBizFacts())
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.totalTax).toBe(0)
    expect(result.taxableIncome).toBe(0)
  })

  it('applies estimated tax payments to reduce amount owed', () => {
    const result = svc.calculateBusinessEntity(
      '1120',
      baseBizFacts({
        income: { grossReceiptsOrSales: 500_000 },
        estimatedTaxPayments: 80_000
      })
    )
    expect(result.success).toBe(true)
    if (!result.success) return
    // Tax = 500K * 21% = 105K, payments 80K -> owed 25K
    expect(result.totalTax).toBe(105_000)
    expect(result.totalPayments).toBe(80_000)
    expect(result.amountOwed).toBe(25_000)
    expect(result.overpayment).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// S-Corp (Form 1120-S) — pass-through to shareholders
// ---------------------------------------------------------------------------

describe('S-Corp (Form 1120-S)', () => {
  it('allocates income to 2 shareholders based on ownership %', () => {
    const result = svc.calculateBusinessEntity(
      '1120-S',
      baseBizFacts({
        entityType: 'S-Corporation',
        income: {
          grossReceiptsOrSales: 600_000,
          returnsAndAllowances: 0,
          costOfGoodsSold: 100_000,
          netGainFromSaleOfAssets: 0,
          otherIncome: 0
        },
        deductions: {
          compensation: 150_000,
          salariesAndWages: 50_000,
          otherDeductions: 0
        },
        shareholders: [
          {
            name: 'Alice Johnson',
            ssn: '111-22-3333',
            ownershipPercentage: 60,
            stockOwned: 600,
            isOfficer: true,
            compensation: 100_000
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
          ordinaryBusinessIncome: 300_000,
          netRentalRealEstateIncome: 0,
          otherNetRentalIncome: 0,
          interestIncome: 5_000,
          dividendIncome: 0,
          qualifiedDividends: 0,
          royalties: 0,
          netShortTermCapitalGain: 0,
          netLongTermCapitalGain: 10_000,
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
        }
      })
    )

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.formType).toBe('1120-S')
    // S-Corps generally have no entity-level tax (unless built-in gains)
    expect(result.totalTax).toBe(0)

    // Should have 2 shareholder allocations
    expect(result.ownerAllocations).toBeDefined()
    expect(result.ownerAllocations!.length).toBe(2)

    // Alice: 60% of $300K ordinary = $180K
    const alice = result.ownerAllocations!.find(
      (a) => a.name === 'Alice Johnson'
    )!
    expect(alice).toBeDefined()
    expect(alice.ownershipPct).toBe(60)
    expect(alice.ordinaryIncome).toBe(180_000)
    expect(alice.interestIncome).toBe(3_000)
    expect(alice.capitalGains).toBe(6_000)
    // S-Corp shareholders don't have SE earnings
    expect(alice.selfEmploymentEarnings).toBe(0)

    // Bob: 40% of $300K ordinary = $120K
    const bob = result.ownerAllocations!.find(
      (a) => a.name === 'Bob Smith'
    )!
    expect(bob).toBeDefined()
    expect(bob.ownershipPct).toBe(40)
    expect(bob.ordinaryIncome).toBe(120_000)
    expect(bob.interestIncome).toBe(2_000)
    expect(bob.capitalGains).toBe(4_000)
  })

  it('reflects entity-level built-in gains tax when present', () => {
    const result = svc.calculateBusinessEntity(
      '1120-S',
      baseBizFacts({
        entityType: 'S-Corporation',
        income: { grossReceiptsOrSales: 200_000 },
        deductions: { compensation: 50_000 },
        shareholders: [
          {
            name: 'Owner',
            ssn: '111223333',
            ownershipPercentage: 100,
            stockOwned: 100,
            isOfficer: true
          }
        ],
        scheduleK: { ordinaryBusinessIncome: 150_000 },
        builtInGainsTax: 10_000
      })
    )
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.totalTax).toBe(10_000)
    expect(result.amountOwed).toBe(10_000)
  })
})

// ---------------------------------------------------------------------------
// Partnership (Form 1065) — pass-through to partners
// ---------------------------------------------------------------------------

describe('Partnership (Form 1065)', () => {
  it('allocates income to 3 partners with varying profit/loss shares', () => {
    const result = svc.calculateBusinessEntity(
      '1065',
      baseBizFacts({
        entityType: 'Partnership',
        income: {
          grossReceiptsOrSales: 900_000,
          returnsAndAllowances: 0,
          costOfGoodsSold: 200_000,
          ordinaryIncome: 0,
          netFarmProfit: 0,
          netGainFromSaleOfAssets: 0,
          otherIncome: 0
        },
        deductions: {
          salariesAndWages: 100_000,
          guaranteedPaymentsToPartners: 150_000,
          otherDeductions: 50_000
        },
        partners: [
          {
            name: 'Partner A',
            tin: '111-22-3333',
            tinType: 'SSN',
            isGeneralPartner: true,
            isLimitedPartner: false,
            isDomestic: true,
            profitSharingPercent: 50,
            lossSharingPercent: 50,
            capitalSharingPercent: 50,
            beginningCapitalAccount: 100_000,
            capitalContributed: 0,
            currentYearIncrease: 0,
            withdrawalsDistributions: 0,
            endingCapitalAccount: 100_000
          },
          {
            name: 'Partner B',
            tin: '444-55-6666',
            tinType: 'SSN',
            isGeneralPartner: true,
            isLimitedPartner: false,
            isDomestic: true,
            profitSharingPercent: 30,
            lossSharingPercent: 30,
            capitalSharingPercent: 30,
            beginningCapitalAccount: 60_000,
            capitalContributed: 0,
            currentYearIncrease: 0,
            withdrawalsDistributions: 0,
            endingCapitalAccount: 60_000
          },
          {
            name: 'Partner C (LP)',
            tin: '777-88-9999',
            tinType: 'SSN',
            isGeneralPartner: false,
            isLimitedPartner: true,
            isDomestic: true,
            profitSharingPercent: 20,
            lossSharingPercent: 20,
            capitalSharingPercent: 20,
            beginningCapitalAccount: 40_000,
            capitalContributed: 0,
            currentYearIncrease: 0,
            withdrawalsDistributions: 0,
            endingCapitalAccount: 40_000
          }
        ],
        scheduleK: {
          ordinaryBusinessIncome: 400_000,
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
          netEarningsSE: 400_000,
          taxExemptInterest: 0,
          otherTaxExemptIncome: 0,
          nondeductibleExpenses: 0,
          cashDistributions: 0,
          propertyDistributions: 0,
          section199AQBI: 0
        }
      })
    )

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.formType).toBe('1065')
    // Partnerships have no entity-level tax
    expect(result.totalTax).toBe(0)
    expect(result.amountOwed).toBe(0)

    // Total income: 900K - 200K COGS = 700K gross profit
    expect(result.totalIncome).toBe(700_000)

    // Should have 3 partner allocations
    expect(result.ownerAllocations).toBeDefined()
    expect(result.ownerAllocations!.length).toBe(3)

    // Partner A: 50% of $400K ordinary = $200K
    const a = result.ownerAllocations![0]
    expect(a.name).toBe('Partner A')
    expect(a.ownershipPct).toBe(50)
    expect(a.ordinaryIncome).toBe(200_000)
    // General partner has SE earnings
    expect(a.selfEmploymentEarnings).toBe(200_000)

    // Partner B: 30% of $400K = $120K
    const b = result.ownerAllocations![1]
    expect(b.name).toBe('Partner B')
    expect(b.ordinaryIncome).toBe(120_000)
    expect(b.selfEmploymentEarnings).toBe(120_000)

    // Partner C (LP): 20% of $400K = $80K, but limited partner has no SE
    const c = result.ownerAllocations![2]
    expect(c.name).toBe('Partner C (LP)')
    expect(c.ordinaryIncome).toBe(80_000)
    // Limited partner does NOT get SE earnings
    expect(c.selfEmploymentEarnings).toBe(0)
  })

  it('handles partnership with no income', () => {
    const result = svc.calculateBusinessEntity(
      '1065',
      baseBizFacts({
        entityType: 'Partnership',
        partners: [
          {
            name: 'Solo Partner',
            tin: '111223333',
            isGeneralPartner: true,
            profitSharingPercent: 100,
            lossSharingPercent: 100
          }
        ]
      })
    )
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.totalIncome).toBe(0)
    expect(result.totalTax).toBe(0)
    expect(result.ownerAllocations!.length).toBe(1)
    expect(result.ownerAllocations![0].ordinaryIncome).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Estate/Trust (Form 1041) — compressed brackets
// ---------------------------------------------------------------------------

describe('Estate/Trust (Form 1041)', () => {
  it('computes tax using 2025 compressed trust brackets for a complex trust', () => {
    // Scenario: Complex trust with $50K interest income, $5K deductions,
    // no distributions -> all income taxed at entity level.
    const result = svc.calculateBusinessEntity(
      '1041',
      baseBizFacts({
        entityType: 'complexTrust',
        entityName: 'Smith Family Trust',
        income: {
          interest: 50_000,
          ordinaryDividends: 0,
          qualifiedDividends: 0,
          businessIncome: 0,
          capitalGainShortTerm: 0,
          capitalGainLongTerm: 0,
          rents: 0,
          royalties: 0,
          farmIncome: 0,
          otherIncome: 0
        },
        deductions: {
          interestExpense: 0,
          taxes: 2_000,
          fiduciaryFees: 3_000,
          charitableDeduction: 0,
          attorneyFees: 0,
          accountantFees: 0,
          otherDeductions: 0
        },
        requiredDistributions: 0,
        otherDistributions: 0,
        estimatedTaxPayments: 0,
        withholding: 0,
        beneficiaries: [],
        fiduciary: {
          name: 'John Trustee',
          title: 'Trustee',
          address: '100 Trust Way',
          ein: '99-8877665',
          phone: '555-1234'
        }
      })
    )

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.formType).toBe('1041')
    expect(result.entityName).toBe('Smith Family Trust')

    // Adjusted total income = $50K - $5K deductions = $45K
    // Complex trust exemption = $100
    // Taxable income = $45K - $0 distributions - $100 exemption = $44,900
    //
    // 2025 trust brackets:
    //   $0 - $3,150 @ 10%         = $315.00
    //   $3,150 - $11,450 @ 24%    = $1,992.00
    //   $11,450 - $15,650 @ 35%   = $1,470.00
    //   $15,650 - $44,900 @ 37%   = $10,822.50
    //                        Total = $14,599.50 -> rounded to $14,600
    expect(result.totalIncome).toBe(50_000)
    expect(result.totalDeductions).toBe(5_000)
    expect(result.taxableIncome).toBe(44_900)
    expect(result.totalTax).toBe(14_600)
    expect(result.amountOwed).toBe(14_600)
    expect(result.overpayment).toBe(0)
    expect(result.schedules).toContain('f1041')
  })

  it('computes correct tax for a decedent estate with higher exemption', () => {
    // Decedent estate gets $600 exemption
    const result = svc.calculateBusinessEntity(
      '1041',
      baseBizFacts({
        entityType: 'decedentEstate',
        entityName: 'Estate of John Doe',
        income: {
          interest: 10_000,
          ordinaryDividends: 5_000
        },
        deductions: {
          fiduciaryFees: 1_000
        },
        requiredDistributions: 0,
        otherDistributions: 0,
        estimatedTaxPayments: 0,
        withholding: 0,
        beneficiaries: []
      })
    )

    expect(result.success).toBe(true)
    if (!result.success) return

    // Total income = $15K, deductions = $1K
    // Adjusted = $14K, exemption = $600
    // Taxable = $14K - $600 = $13,400
    //
    // Brackets:
    //   $0 - $3,150 @ 10%          = $315.00
    //   $3,150 - $11,450 @ 24%     = $1,992.00
    //   $11,450 - $13,400 @ 35%    = $682.50
    //                         Total = $2,989.50 -> rounded to $2,990
    expect(result.taxableIncome).toBe(13_400)
    expect(result.totalTax).toBe(2_990)
  })

  it('simple trust distributes all income (zero entity tax)', () => {
    const result = svc.calculateBusinessEntity(
      '1041',
      baseBizFacts({
        entityType: 'simpleTrust',
        entityName: 'Simple Trust',
        income: {
          interest: 20_000
        },
        deductions: {},
        requiredDistributions: 20_000,
        otherDistributions: 0,
        estimatedTaxPayments: 0,
        withholding: 0,
        beneficiaries: [
          {
            name: 'Beneficiary',
            tin: '111223333',
            percentageShare: 100
          }
        ]
      })
    )

    expect(result.success).toBe(true)
    if (!result.success) return

    // Simple trust distributes all income, so taxable income should be
    // the exemption reduction only:
    // $20K income - $20K distribution (all income) - $300 exemption
    // Since $20K distribution = $20K adjusted income, taxable = $0
    // (exemption can't create negative taxable income)
    expect(result.taxableIncome).toBe(0)
    expect(result.totalTax).toBe(0)
  })

  it('applies estimated tax payments to produce overpayment', () => {
    const result = svc.calculateBusinessEntity(
      '1041',
      baseBizFacts({
        entityType: 'complexTrust',
        income: { interest: 10_000 },
        deductions: {},
        requiredDistributions: 0,
        otherDistributions: 0,
        estimatedTaxPayments: 5_000,
        withholding: 0,
        beneficiaries: []
      })
    )

    expect(result.success).toBe(true)
    if (!result.success) return

    // taxable = $10K - $100 exemption = $9,900
    // Tax:  $3,150 * 10% = $315  +  ($9,900 - $3,150) * 24% = $1,620
    //       Total = $1,935 -> rounded to $1,935
    expect(result.totalTax).toBe(1_935)
    expect(result.totalPayments).toBe(5_000)
    expect(result.overpayment).toBe(3_065)
    expect(result.amountOwed).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Unsupported form type
// ---------------------------------------------------------------------------

describe('Unsupported form types', () => {
  it('returns error for unsupported form type', () => {
    const result = svc.calculateBusinessEntity('8865', baseBizFacts())
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]).toContain('Unsupported')
  })
})
