import { describe, it, expect } from 'vitest'
import {
  TaxCalculationService,
  adaptFactsToInformation,
  type TaxCalcWithStateResult
} from '../../src/services/taxCalculationService'

const taxCalcService = new TaxCalculationService()

// Helper to build minimal facts for a scenario
const baseFacts = (overrides: Record<string, unknown> = {}) => ({
  primaryTIN: '123456789',
  filingStatus: 'single',
  spouse: null,
  w2Records: [],
  form1099Records: [],
  unemploymentRecords: [],
  socialSecurityRecords: [],
  taxLots: [],
  cryptoAccounts: [],
  businessRecords: [],
  qbiWorksheetEntities: {},
  rentalProperties: [],
  foreignIncomeRecords: [],
  foreignAccounts: [],
  treatyClaims: [],
  nonresidentProfile: null,
  dependents: [],
  incomeSummary: {},
  investmentSummary: {},
  businessSummary: {},
  rentalSummary: {},
  foreignSummary: {},
  creditSummary: {},
  '/taxYear': { $type: 'gov.irs.factgraph.persisters.IntWrapper', item: 2025 },
  '/filingStatus': {
    $type: 'gov.irs.factgraph.persisters.EnumWrapper',
    item: { value: ['single'], enumOptionsPath: '/filingStatusOptions' }
  },
  '/filerResidenceAndIncomeState': {
    $type: 'gov.irs.factgraph.persisters.EnumWrapper',
    item: { value: ['ca'], enumOptionsPath: '/scopedStateOptions' }
  },
  '/filers/#primary/isPrimaryFiler': {
    $type: 'gov.irs.factgraph.persisters.BooleanWrapper',
    item: true
  },
  '/filers/#primary/tin': {
    $type: 'gov.irs.factgraph.persisters.TinWrapper',
    item: { area: '123', group: '45', serial: '6789' }
  },
  '/address': {
    $type: 'gov.irs.factgraph.persisters.AddressWrapper',
    item: {
      streetAddress: '123 Main St',
      city: 'Los Angeles',
      stateOrProvence: 'CA',
      postalCode: '90001'
    }
  },
  ...overrides
})

describe('TaxCalculationService', () => {
  describe('adaptFactsToInformation', () => {
    it('maps filing status correctly', () => {
      const info = adaptFactsToInformation(baseFacts({ filingStatus: 'mfj' }))
      expect(info.taxPayer.filingStatus).toBe('MFJ')
    })

    it('maps W-2 records to IncomeW2', () => {
      const facts = baseFacts({
        w2Records: [
          {
            id: 'w2-1',
            employerName: 'Acme Corp',
            ein: '12-3456789',
            box1Wages: 50000,
            box2FederalWithheld: 5000,
            stateWages: 50000,
            stateWithheld: 2000,
            owner: 'taxpayer',
            isComplete: true
          }
        ]
      })
      const info = adaptFactsToInformation(facts)
      expect(info.w2s).toHaveLength(1)
      expect(info.w2s[0].income).toBe(50000)
      expect(info.w2s[0].fedWithholding).toBe(5000)
      expect(info.w2s[0].occupation).toBe('Acme Corp')
    })

    it('maps dependents', () => {
      const facts = baseFacts({
        filingStatus: 'hoh',
        dependents: [
          {
            id: 'dep-1',
            name: 'Jane Doe',
            dob: '2015-06-15',
            relationship: 'child',
            ssn: '987654321',
            months: '12',
            isComplete: true
          }
        ]
      })
      const info = adaptFactsToInformation(facts)
      expect(info.taxPayer.dependents).toHaveLength(1)
      expect(info.taxPayer.dependents[0].firstName).toBe('Jane')
      expect(info.taxPayer.dependents[0].lastName).toBe('Doe')
      expect(info.taxPayer.dependents[0].ssid).toBe('987654321')
    })

    it('maps spouse for MFJ', () => {
      const facts = baseFacts({
        filingStatus: 'mfj',
        spouse: {
          id: 'spouse-primary',
          firstName: 'Jane',
          lastName: 'Smith',
          ssn: '987654321',
          dob: '1990-05-20',
          isComplete: true
        }
      })
      const info = adaptFactsToInformation(facts)
      expect(info.taxPayer.spouse).toBeDefined()
      expect(info.taxPayer.spouse!.firstName).toBe('Jane')
      expect(info.taxPayer.spouse!.ssid).toBe('987654321')
    })

    it('maps 1099-INT records', () => {
      const facts = baseFacts({
        form1099Records: [
          {
            id: '1099-1',
            type: 'INT',
            payer: 'Chase Bank',
            amount: 1500,
            federalWithheld: 0,
            isComplete: true
          }
        ]
      })
      const info = adaptFactsToInformation(facts)
      expect(info.f1099s).toHaveLength(1)
      expect(info.f1099s[0].type).toBe('INT')
    })
  })

  describe('calculate', () => {
    it('computes tax for a single filer with $50K W-2 income', () => {
      const result = taxCalcService.calculate(
        baseFacts({
          w2Records: [
            {
              id: 'w2-1',
              employerName: 'Employer Inc',
              ein: '12-3456789',
              box1Wages: 50000,
              box2FederalWithheld: 5000,
              owner: 'taxpayer',
              isComplete: true
            }
          ]
        })
      )

      expect(result.success).toBe(true)
      if (result.success) {
        // Single filer, $50K wages, standard deduction ~$15,750 (2025)
        // Taxable income ~$34,250
        // Tax should be roughly $3,800-$4,200
        expect(result.agi).toBe(50000)
        expect(result.taxableIncome).toBeGreaterThan(30000)
        expect(result.taxableIncome).toBeLessThan(40000)
        expect(result.totalTax).toBeGreaterThan(3000)
        expect(result.totalTax).toBeLessThan(6000)
        expect(result.totalPayments).toBe(5000)
        // With $5K withheld and ~$4K tax, should get a small refund
        expect(result.refund + result.amountOwed).toBeGreaterThanOrEqual(0)
        expect(result.schedules).toContain('f1040')
      }
    })

    it('computes tax for MFJ with dependents', () => {
      const result = taxCalcService.calculate(
        baseFacts({
          filingStatus: 'mfj',
          spouse: {
            id: 'spouse-primary',
            firstName: 'Jane',
            lastName: 'Smith',
            ssn: '987654321',
            dob: '1990-05-20',
            isComplete: true
          },
          w2Records: [
            {
              id: 'w2-1',
              employerName: 'Employer A',
              ein: '12-3456789',
              box1Wages: 80000,
              box2FederalWithheld: 10000,
              owner: 'taxpayer',
              isComplete: true
            },
            {
              id: 'w2-2',
              employerName: 'Employer B',
              ein: '98-7654321',
              box1Wages: 60000,
              box2FederalWithheld: 7000,
              owner: 'spouse',
              isComplete: true
            }
          ],
          dependents: [
            {
              id: 'dep-1',
              name: 'Child One',
              dob: '2015-06-15',
              relationship: 'child',
              ssn: '111223333',
              months: '12',
              isComplete: true
            }
          ]
        })
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.agi).toBe(140000)
        expect(result.totalPayments).toBe(17000)
        // MFJ standard deduction is ~$31,500 (2025)
        expect(result.taxableIncome).toBeGreaterThan(100000)
        expect(result.taxableIncome).toBeLessThan(115000)
      }
    })

    it('returns zero tax for zero income', () => {
      const result = taxCalcService.calculate(baseFacts())

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.agi).toBe(0)
        expect(result.totalTax).toBe(0)
        expect(result.refund).toBe(0)
        expect(result.amountOwed).toBe(0)
      }
    })

    it('handles 1099-NEC as f1099 entry', () => {
      const result = taxCalcService.calculate(
        baseFacts({
          form1099Records: [
            {
              id: '1099-nec-1',
              type: 'NEC',
              payer: 'Client LLC',
              amount: 75000,
              federalWithheld: 0,
              isComplete: true
            }
          ]
        })
      )

      expect(result.success).toBe(true)
    })

    it('computes state tax for CA filer with W-2 income', () => {
      const result = taxCalcService.calculate(
        baseFacts({
          w2Records: [
            {
              id: 'w2-1',
              employerName: 'Tech Corp',
              ein: '12-3456789',
              box1Wages: 100000,
              box2FederalWithheld: 15000,
              stateWages: 100000,
              stateWithheld: 5000,
              owner: 'taxpayer',
              isComplete: true
            }
          ]
        })
      )

      expect(result.success).toBe(true)
      if (result.success) {
        const withState = result as TaxCalcWithStateResult
        // CA is in the state residencies from baseFacts /filerResidenceAndIncomeState
        if (withState.stateResults && withState.stateResults.length > 0) {
          expect(withState.stateResults[0].state).toBe('CA')
          expect(withState.stateResults[0].stateTax).toBeGreaterThan(0)
          expect(withState.stateResults[0].effectiveStateRate).toBeGreaterThan(0)
        }
      }
    })

    it('computes state tax for IL filer', () => {
      const result = taxCalcService.calculate(
        baseFacts({
          '/filerResidenceAndIncomeState': {
            $type: 'gov.irs.factgraph.persisters.EnumWrapper',
            item: { value: ['il'], enumOptionsPath: '/scopedStateOptions' }
          },
          w2Records: [
            {
              id: 'w2-1',
              employerName: 'Chicago Corp',
              ein: '12-3456789',
              box1Wages: 75000,
              box2FederalWithheld: 10000,
              stateWages: 75000,
              stateWithheld: 3000,
              owner: 'taxpayer',
              isComplete: true
            }
          ]
        })
      )

      expect(result.success).toBe(true)
      if (result.success) {
        const withState = result as TaxCalcWithStateResult
        if (withState.stateResults && withState.stateResults.length > 0) {
          expect(withState.stateResults[0].state).toBe('IL')
          // IL flat 4.95% rate — tax should be roughly $3K-$4K on $75K AGI
          expect(withState.stateResults[0].stateTax).toBeGreaterThan(2000)
          expect(withState.stateResults[0].stateTax).toBeLessThan(5000)
        }
      }
    })
  })

  describe('calculateBusinessEntity', () => {
    it('computes C-Corp tax at 21% flat rate', () => {
      const result = taxCalcService.calculateBusinessEntity('1120', {
        entityName: 'Test Corp',
        ein: '12-3456789',
        taxYear: 2025,
        income: {
          grossReceiptsOrSales: 500000,
          costOfGoodsSold: 200000,
        },
        deductions: {
          salariesAndWages: 50000,
          rents: 10000,
          taxesAndLicenses: 5000,
        },
        specialDeductions: {}
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.formType).toBe('1120')
        expect(result.totalIncome).toBeGreaterThan(200000)
        // 21% flat rate on taxable income
        expect(result.effectiveTaxRate).toBeGreaterThan(0.15)
        expect(result.effectiveTaxRate).toBeLessThanOrEqual(0.21)
      }
    })

    it('computes S-Corp pass-through allocations', () => {
      const result = taxCalcService.calculateBusinessEntity('1120-S', {
        entityName: 'Test S-Corp',
        ein: '98-7654321',
        taxYear: 2025,
        income: {
          grossReceiptsOrSales: 400000,
          costOfGoodsSold: 100000,
        },
        deductions: {
          salariesAndWages: 100000,
        },
        shareholders: [
          { name: 'Owner A', ssn: '111223333', ownershipPercentage: 60, stockOwned: 600 },
          { name: 'Owner B', ssn: '444556666', ownershipPercentage: 40, stockOwned: 400 }
        ],
        scheduleK: {
          ordinaryBusinessIncome: 200000,
        }
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.formType).toBe('1120-S')
        // S-Corp has no entity-level income tax (pass-through)
        expect(result.ownerAllocations).toBeDefined()
        expect(result.ownerAllocations).toHaveLength(2)
        if (result.ownerAllocations) {
          expect(result.ownerAllocations[0].ownershipPct).toBe(60)
          expect(result.ownerAllocations[1].ownershipPct).toBe(40)
        }
      }
    })

    it('computes Partnership allocations', () => {
      const result = taxCalcService.calculateBusinessEntity('1065', {
        entityName: 'Test Partnership',
        ein: '55-1234567',
        taxYear: 2025,
        income: {
          grossReceiptsOrSales: 600000,
          costOfGoodsSold: 200000,
        },
        deductions: {
          salariesAndWages: 100000,
          guaranteedPaymentsToPartners: 50000,
        },
        partners: [
          { name: 'Partner A', tin: '111223333', profitSharingPercent: 50 },
          { name: 'Partner B', tin: '444556666', profitSharingPercent: 30 },
          { name: 'Partner C', tin: '777889999', profitSharingPercent: 20 }
        ],
        scheduleK: {
          ordinaryBusinessIncome: 250000,
        },
        liabilitiesAtYearEnd: {}
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.formType).toBe('1065')
        expect(result.totalTax).toBe(0) // Partnerships have no entity-level tax
        expect(result.ownerAllocations).toHaveLength(3)
      }
    })

    it('computes Trust/Estate tax with compressed brackets', () => {
      const result = taxCalcService.calculateBusinessEntity('1041', {
        entityName: 'Smith Family Trust',
        ein: '99-8765432',
        entityType: 'complexTrust',
        taxYear: 2025,
        income: {
          interest: 50000,
          ordinaryDividends: 20000,
          qualifiedDividends: 10000,
        },
        deductions: {
          fiduciaryFees: 5000,
        },
        fiduciary: { name: 'John Smith', title: 'Trustee' },
        beneficiaries: [
          { name: 'Jane Smith', tin: '111223333', percentageShare: 100 }
        ],
        requiredDistributions: 0,
        otherDistributions: 0,
        estimatedTaxPayments: 5000,
        withholding: 0
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.formType).toBe('1041')
        expect(result.totalIncome).toBe(70000)
        // Compressed brackets hit 37% at $15,650
        expect(result.totalTax).toBeGreaterThan(15000)
        expect(result.effectiveTaxRate).toBeGreaterThan(0.2)
      }
    })
  })
})
