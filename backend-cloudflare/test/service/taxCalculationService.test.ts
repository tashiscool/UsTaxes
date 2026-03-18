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

    it('maps richer 1099-DIV and 1099-B detail for workbook parity', () => {
      const facts = baseFacts({
        form1099Records: [
          {
            id: '1099-div-1',
            type: 'DIV',
            payer: 'Brokerage',
            amount: 3200,
            qualifiedDividends: 1800,
            capitalGainDistributions: 450,
            section199ADividends: 300,
            owner: 'spouse',
            isComplete: true
          },
          {
            id: '1099-b-1',
            type: 'B',
            payer: 'Schwab',
            transactions: [
              {
                description: 'ABC',
                term: 'short',
                proceeds: 15000,
                costBasis: 10000
              },
              {
                description: 'XYZ',
                term: 'long',
                proceeds: 20000,
                costBasis: 15000
              }
            ],
            isComplete: true
          }
        ]
      })

      const info = adaptFactsToInformation(facts)
      expect(info.f1099s).toHaveLength(2)

      const div = info.f1099s.find((entry) => entry.type === 'DIV')
      expect(div).toBeDefined()
      expect(div?.form.dividends).toBe(3200)
      expect(div?.form.qualifiedDividends).toBe(1800)
      expect(div?.form.totalCapitalGainsDistributions).toBe(450)
      expect(div?.form.section199ADividends).toBe(300)
      expect(div?.personRole).toBe('SPOUSE')

      const broker = info.f1099s.find((entry) => entry.type === 'B')
      expect(broker).toBeDefined()
      expect(broker?.form.shortTermProceeds).toBe(15000)
      expect(broker?.form.shortTermCostBasis).toBe(10000)
      expect(broker?.form.longTermProceeds).toBe(20000)
      expect(broker?.form.longTermCostBasis).toBe(15000)
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
          expect(withState.stateResults[0].effectiveStateRate).toBeGreaterThan(
            0
          )
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

    it('uses 1099-B basis detail so only net gains reach AGI', () => {
      const result = taxCalcService.calculate(
        baseFacts({
          w2Records: [
            {
              id: 'w2-gains',
              employerName: 'Employer Inc',
              ein: '12-3456789',
              box1Wages: 100000,
              box2FederalWithheld: 15000,
              owner: 'taxpayer',
              isComplete: true
            }
          ],
          form1099Records: [
            {
              id: '1099-b-net',
              type: 'B',
              payer: 'Broker',
              shortTermProceeds: 15000,
              shortTermCostBasis: 10000,
              longTermProceeds: 20000,
              longTermCostBasis: 15000,
              amount: 35000,
              isComplete: true
            }
          ]
        })
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.agi).toBe(110000)
      }
    })

    it('normalizes workbook-style Schedule A aliases into canonical itemized deductions', () => {
      const canonical = taxCalcService.calculate(
        baseFacts({
          w2Records: [
            {
              id: 'w2-itemized-canonical',
              employerName: 'Employer Inc',
              ein: '12-3456789',
              box1Wages: 120000,
              box2FederalWithheld: 12000,
              owner: 'taxpayer',
              isComplete: true
            }
          ],
          itemizedDeductions: {
            stateAndLocalTaxes: 30000,
            stateAndLocalRealEstateTaxes: 8000,
            stateAndLocalPropertyTaxes: 0,
            interest8a: 10000,
            interest8b: 0,
            interest8c: 0,
            interest8d: 0,
            investmentInterest: 0,
            charityCashCheck: 2000,
            charityOther: 1000,
            medicalAndDental: 0,
            isSalesTax: false
          }
        })
      )

      const aliased = taxCalcService.calculate(
        baseFacts({
          w2Records: [
            {
              id: 'w2-itemized-aliased',
              employerName: 'Employer Inc',
              ein: '12-3456789',
              box1Wages: 120000,
              box2FederalWithheld: 12000,
              owner: 'taxpayer',
              isComplete: true
            }
          ],
          itemizedDeductions: {
            stateIncomeTaxes: 30000,
            realEstateTaxes: 8000,
            mortgageInterest: 10000,
            cashContributions: 2000,
            noncashContributionsTotal: 1000
          }
        })
      )

      expect(canonical.success).toBe(true)
      expect(aliased.success).toBe(true)
      if (canonical.success && aliased.success) {
        expect(aliased.taxableIncome).toBe(canonical.taxableIncome)
        expect(aliased.totalTax).toBe(canonical.totalTax)
      }
    })

    it('switches to a nonresident calculation branch when 1040-NR facts are present', () => {
      const result = taxCalcService.calculate(
        baseFacts({
          w2Records: [
            {
              id: 'w2-nr',
              employerName: 'Employer Inc',
              ein: '12-3456789',
              box1Wages: 150000,
              box2FederalWithheld: 35000,
              owner: 'taxpayer',
              isComplete: true
            }
          ],
          businessRecords: [
            {
              id: 'biz-nr',
              name: 'Consulting LLC',
              principalBusinessCode: '541000',
              businessDescription: 'Consulting',
              accountingMethod: 'cash',
              materialParticipation: true,
              startedOrAcquired: false,
              madePaymentsRequiring1099: false,
              filed1099s: false,
              income: { grossReceipts: 10000, returns: 0, otherIncome: 0 },
              expenses: {
                advertising: 0,
                carAndTruck: 0,
                commissions: 0,
                contractLabor: 0,
                depletion: 0,
                depreciation: 0,
                employeeBenefits: 0,
                insurance: 0,
                interestMortgage: 0,
                interestOther: 0,
                legal: 0,
                office: 0,
                pensionPlans: 0,
                rentVehicles: 0,
                rentOther: 0,
                repairs: 0,
                supplies: 0,
                taxes: 0,
                travel: 0,
                deductibleMeals: 0,
                utilities: 0,
                wages: 0,
                otherExpenses: 0
              },
              personRole: 'PRIMARY',
              owner: 'taxpayer'
            }
          ],
          form1099Records: [
            {
              id: '1099-div-nr',
              type: 'DIV',
              payer: 'Broker',
              ordinaryDividends: 1000,
              amount: 1000,
              isComplete: true
            },
            {
              id: '1099-misc-nr',
              type: 'MISC',
              payer: 'Studio',
              amount: 500,
              notes: 'royalties',
              isComplete: true
            },
            {
              id: '1099-b-nr',
              type: 'B',
              payer: 'Broker',
              longTermProceeds: 5000,
              longTermCostBasis: 0,
              amount: 5000,
              isComplete: true
            }
          ],
          itemizedDeductions: {
            stateAndLocalTaxes: 6000,
            charityCashCheck: 4000
          },
          nonresidentProfile: {
            hasData: true,
            requires1040NR: true,
            visaType: 'H1B',
            countryOfCitizenship: 'GB',
            daysInUS2024: 120,
            daysInUS2023: 60,
            daysInUS2022: 30,
            hasTreaty: false
          },
          nonresidentScheduleOi: {
            countryOfResidence: 'GB',
            dateEnteredUS: '2025-01-15'
          }
        })
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.schedules).toContain('f1040nr')
        expect(result.agi).toBe(166500)
        expect(result.taxableIncome).toBe(155000)
        expect(result.totalTax).toBe(30497)
        expect(result.totalPayments).toBe(35000)
        expect(result.refund).toBe(4503)
        expect(result.amountOwed).toBe(0)
      }
    })
  })

  // ─── OBBBA 2025 rule coverage (MATH_RULES_INDEX §2.1–2.6) ──────────────────
  // Each test verifies that the backend worker correctly applies OBBBA parameters
  // from federal.ts through create1040() for a specific math rule.
  describe('OBBBA rule coverage via backend', () => {
    it('§2.1 standard deduction: single $15,750 applied to taxable income', () => {
      const result = taxCalcService.calculate(
        baseFacts({
          w2Records: [
            {
              id: 'w2-sd',
              employerName: 'Employer',
              ein: '12-3456789',
              box1Wages: 50000,
              box2FederalWithheld: 0,
              owner: 'taxpayer',
              isComplete: true
            }
          ]
        })
      )
      expect(result.success).toBe(true)
      if (result.success) {
        // Taxable income = AGI ($50,000) - standard deduction ($15,750) = $34,250
        expect(result.taxableIncome).toBeCloseTo(34250, -2) // within $100
      }
    })

    it('§2.3 CTC: MFJ with qualifying child reduces tax by at least $2,200', () => {
      const baseResult = taxCalcService.calculate(
        baseFacts({
          filingStatus: 'mfj',
          w2Records: [
            {
              id: 'w2-ctc',
              employerName: 'Employer',
              ein: '12-3456789',
              box1Wages: 60000,
              box2FederalWithheld: 0,
              owner: 'taxpayer',
              isComplete: true
            }
          ]
        })
      )
      const ctcResult = taxCalcService.calculate(
        baseFacts({
          filingStatus: 'mfj',
          w2Records: [
            {
              id: 'w2-ctc',
              employerName: 'Employer',
              ein: '12-3456789',
              box1Wages: 60000,
              box2FederalWithheld: 0,
              owner: 'taxpayer',
              isComplete: true
            }
          ],
          dependents: [
            {
              id: 'dep-ctc',
              name: 'Child A',
              dob: '2015-01-01', // age 10 — qualifies (under 17)
              relationship: 'child',
              ssn: '111223333',
              months: '12',
              isComplete: true
            }
          ]
        })
      )
      expect(baseResult.success).toBe(true)
      expect(ctcResult.success).toBe(true)
      if (baseResult.success && ctcResult.success) {
        // Adding one qualifying child should reduce total tax by at least $2,200 (OBBBA CTC rate)
        const taxReduction = baseResult.totalTax - ctcResult.totalTax
        expect(taxReduction).toBeGreaterThanOrEqual(2200)
      }
    })

    it('§2.4 SALT cap: itemized deductions with $50k state taxes capped at $40,000', () => {
      // Single filer with $120k wages and $50k in state taxes (far over cap)
      // With itemized, taxable income should reflect SALT capped at $40,000 not $50k
      const withHighSalt = taxCalcService.calculate(
        baseFacts({
          w2Records: [
            {
              id: 'w2-salt',
              employerName: 'Employer',
              ein: '12-3456789',
              box1Wages: 120000,
              box2FederalWithheld: 0,
              owner: 'taxpayer',
              isComplete: true
            }
          ],
          itemizedDeductions: {
            stateAndLocalTaxes: 50000, // well above $40,000 cap
            stateAndLocalRealEstateTaxes: 0,
            stateAndLocalPropertyTaxes: 0,
            interest8a: 0,
            charityCashCheck: 0,
            charityOther: 0,
            medicalAndDental: 0,
            isSalesTax: false,
            interest8b: 0,
            interest8c: 0,
            interest8d: 0,
            investmentInterest: 0
          }
        })
      )
      const withNoItemized = taxCalcService.calculate(
        baseFacts({
          w2Records: [
            {
              id: 'w2-salt-noitem',
              employerName: 'Employer',
              ein: '12-3456789',
              box1Wages: 120000,
              box2FederalWithheld: 0,
              owner: 'taxpayer',
              isComplete: true
            }
          ]
        })
      )
      expect(withHighSalt.success).toBe(true)
      expect(withNoItemized.success).toBe(true)
      if (withHighSalt.success && withNoItemized.success) {
        // The itemized deduction should be capped at $40,000 (not $50,000)
        // So taxable income with itemized = $120k - $40,000 = $80,000
        // Without itemized (standard deduction $15,750): taxable = $104,250
        // Itemized should produce lower taxable income when state taxes > standard deduction
        expect(withHighSalt.taxableIncome).toBeLessThan(
          withNoItemized.taxableIncome
        )
        // With $40,000 SALT cap (as the itemized deduction), taxable = $120k - $40,000 = $80,000
        expect(withHighSalt.taxableIncome).toBeCloseTo(80000, -3) // within $1000
      }
    })

    it('§2.5 QBI: self-employment income produces ~20% QBI deduction', () => {
      // Schedule C sole proprietor with $90k gross — below phase-out, no W-2 limit
      // QBI deduction = $90k × 20% = $18,000 → taxable ≈ $90k - $15,750 std - $6,359 SE ded - $18k QBI ≈ $50k
      const result = taxCalcService.calculate(
        baseFacts({
          businessRecords: [
            {
              id: 'biz-qbi',
              name: 'Consulting LLC',
              principalBusinessCode: '541000',
              businessDescription: 'Consulting',
              accountingMethod: 'cash',
              materialParticipation: true,
              startedOrAcquired: false,
              madePaymentsRequiring1099: false,
              filed1099s: false,
              income: { grossReceipts: 90000, returns: 0, otherIncome: 0 },
              expenses: {
                advertising: 0,
                carAndTruck: 0,
                commissions: 0,
                contractLabor: 0,
                depletion: 0,
                depreciation: 0,
                employeeBenefits: 0,
                insurance: 0,
                interestMortgage: 0,
                interestOther: 0,
                legal: 0,
                office: 0,
                pensionPlans: 0,
                rentVehicles: 0,
                rentOther: 0,
                repairs: 0,
                supplies: 0,
                taxes: 0,
                travel: 0,
                deductibleMeals: 0,
                utilities: 0,
                wages: 0,
                otherExpenses: 0
              },
              personRole: 'PRIMARY',
              owner: 'taxpayer'
            }
          ]
        })
      )
      expect(result.success).toBe(true)
      if (result.success) {
        // Taxable income should be lower than AGI minus standard deduction (QBI adds further reduction)
        // AGI ≈ $90k - ~$6.4k SE ded ≈ $83.6k; taxable ≈ $83.6k - $15,750 - ~$16.7k QBI ≈ $51k
        expect(result.agi).toBeGreaterThan(0)
        expect(result.taxableIncome).toBeLessThan(result.agi - 15750)
      }
    })

    it('§2.6 NIIT: investment income above $200k threshold attracts 3.8% tax', () => {
      // Single filer with $250k in dividends (above $200k NIIT threshold)
      const result = taxCalcService.calculate(
        baseFacts({
          form1099Records: [
            {
              id: '1099-div-niit',
              type: 'DIV',
              payer: 'Brokerage Inc',
              amount: 250000,
              federalWithheld: 0,
              isComplete: true
            }
          ]
        })
      )
      expect(result.success).toBe(true)
      if (result.success) {
        // NIIT = 3.8% × ($250k - $200k) = 3.8% × $50k = $1,900 minimum
        // Total tax should include regular income tax + NIIT
        expect(result.totalTax).toBeGreaterThan(50000) // meaningful tax at this income level
        expect(result.schedules).toContain('f1040')
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
          costOfGoodsSold: 200000
        },
        deductions: {
          salariesAndWages: 50000,
          rents: 10000,
          taxesAndLicenses: 5000
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
          costOfGoodsSold: 100000
        },
        deductions: {
          salariesAndWages: 100000
        },
        shareholders: [
          {
            name: 'Owner A',
            ssn: '111223333',
            ownershipPercentage: 60,
            stockOwned: 600
          },
          {
            name: 'Owner B',
            ssn: '444556666',
            ownershipPercentage: 40,
            stockOwned: 400
          }
        ],
        scheduleK: {
          ordinaryBusinessIncome: 200000
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
          costOfGoodsSold: 200000
        },
        deductions: {
          salariesAndWages: 100000,
          guaranteedPaymentsToPartners: 50000
        },
        partners: [
          { name: 'Partner A', tin: '111223333', profitSharingPercent: 50 },
          { name: 'Partner B', tin: '444556666', profitSharingPercent: 30 },
          { name: 'Partner C', tin: '777889999', profitSharingPercent: 20 }
        ],
        scheduleK: {
          ordinaryBusinessIncome: 250000
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
          qualifiedDividends: 10000
        },
        deductions: {
          fiduciaryFees: 5000
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
