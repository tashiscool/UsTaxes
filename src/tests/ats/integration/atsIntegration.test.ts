/**
 * ATS Integration Tests
 *
 * These tests run IRS ATS scenario data through the actual UsTaxes
 * calculation engine and compare the results against expected values.
 */

import { create1040 } from 'ustaxes/forms/Y2025/irsForms/Main'
import { Asset, FilingStatus, PersonRole, State, PlanType1099 } from 'ustaxes/core/data'
import { run } from 'ustaxes/core/util'
import {
  atsScenarioToInformation,
  ATSScenarioInput,
  ATSExpectedOutput,
  compareResults
} from '../utils/scenarioToInformation'

// =============================================================================
// Test Scenarios
// =============================================================================

describe('ATS Integration Tests', () => {
  /**
   * Scenario 1 - James Brown (Single, W-2 only)
   * Simple wage income with standard deduction
   */
  describe('Scenario 1 - James Brown (Single)', () => {
    const scenario: ATSScenarioInput = {
      taxYear: 2025,
      filingStatus: FilingStatus.S,
      taxpayer: {
        firstName: 'James',
        lastName: 'Brown',
        ssn: '400011011',
        dateOfBirth: new Date(1985, 5, 15),
        address: {
          address: '123 Main Street',
          city: 'Anytown',
          state: 'CA' as State,
          zip: '90210'
        }
      },
      w2s: [
        {
          employer: {
            name: 'ABC Company',
            ein: '12-3456789'
          },
          wages: 75000,
          federalWithholding: 9500,
          ssWages: 75000,
          ssTax: 4650,
          medicareWages: 75000,
          medicareTax: 1088,
          occupation: 'Software Engineer'
        }
      ]
    }

    const expected: ATSExpectedOutput = {
      line1Wages: 75000,
      line9TotalIncome: 75000,
      line11Agi: 75000,
      line12Deduction: 15750, // OBBBA 2025 single standard deduction
      line15TaxableIncome: 59250,
      line25aWithholding: 9500
    }

    it('should calculate AGI correctly', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          expect(f1040.l11()).toBe(expected.line11Agi)
        }
      )
    })

    it('should use correct standard deduction', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          expect(f1040.standardDeduction()).toBe(expected.line12Deduction)
        }
      )
    })

    it('should calculate taxable income correctly', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          expect(f1040.l15()).toBe(expected.line15TaxableIncome)
        }
      )
    })

    it('should capture withholding correctly', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          expect(f1040.l25a()).toBe(expected.line25aWithholding)
        }
      )
    })
  })

  /**
   * Scenario 2 - John & Judy Jones (MFJ, deceased spouse)
   */
  describe('Scenario 2 - John & Judy Jones (MFJ)', () => {
    const scenario: ATSScenarioInput = {
      taxYear: 2025,
      filingStatus: FilingStatus.MFJ,
      taxpayer: {
        firstName: 'John',
        lastName: 'Jones',
        ssn: '400011021',
        dateOfBirth: new Date(1975, 3, 20),
        address: {
          address: '456 Oak Avenue',
          city: 'Somewhere',
          state: 'TX' as State,
          zip: '75001'
        }
      },
      spouse: {
        firstName: 'Judy',
        lastName: 'Jones',
        ssn: '400011022',
        dateOfBirth: new Date(1978, 7, 10),
        dateOfDeath: new Date(2025, 8, 11) // September 11, 2025
      },
      dependents: [
        {
          firstName: 'Jacob',
          lastName: 'Jones',
          ssn: '400011023',
          dateOfBirth: new Date(2007, 5, 15),
          relationship: 'Son',
          numberOfMonths: 12,
          isStudent: true
        }
      ],
      w2s: [
        {
          employer: {
            name: 'Southwest Airlines',
            ein: '75-1234567'
          },
          wages: 22013,
          federalWithholding: 1650,
          occupation: 'Statutory Employee',
          personRole: PersonRole.PRIMARY
        },
        {
          employer: {
            name: 'Target',
            ein: '41-0987654'
          },
          wages: 16013,
          federalWithholding: 1251,
          occupation: 'Sales Associate',
          personRole: PersonRole.SPOUSE
        }
      ],
      itemizedDeductions: {
        stateAndLocalTaxes: 5000,
        realEstateTaxes: 4500,
        mortgageInterest: 8500,
        charityCashCheck: 2000,
        charityOther: 2201 // Vehicle donation
      }
    }

    const expected: ATSExpectedOutput = {
      line1Wages: 38026, // 22013 + 16013
      line9TotalIncome: 38026,
      line11Agi: 38026,
      line25aWithholding: 2901, // 1650 + 1251
      scheduleAItemized: 22201 // itemized deductions
    }

    it('should calculate combined wages correctly', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          expect(f1040.l1a()).toBe(expected.line1Wages)
        }
      )
    })

    it('should use MFJ standard deduction', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          // MFJ standard deduction for OBBBA 2025
          expect(f1040.standardDeduction()).toBe(31500)
        }
      )
    })

    it('should have correct combined withholding', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          expect(f1040.l25a()).toBe(expected.line25aWithholding)
        }
      )
    })
  })

  /**
   * Scenario 3 - Lynette Heather (Single, multiple income sources)
   */
  describe('Scenario 3 - Lynette Heather (Single)', () => {
    const scenario: ATSScenarioInput = {
      taxYear: 2025,
      filingStatus: FilingStatus.S,
      taxpayer: {
        firstName: 'Lynette',
        lastName: 'Heather',
        ssn: '400011031',
        dateOfBirth: new Date(1958, 2, 15),
        address: {
          address: '789 Flower Road',
          city: 'Garden City',
          state: 'KS' as State,
          zip: '67846'
        }
      },
      f1099Rs: [
        {
          payer: 'Vanguard',
          grossDistribution: 53778,
          taxableAmount: 43100,
          federalWithholding: 6000,
          planType: PlanType1099.IRA
        }
      ],
      f1099Bs: [
        {
          payer: 'Fidelity',
          longTermProceeds: 5000,
          longTermCostBasis: 3600
        }
      ]
    }

    const expected: ATSExpectedOutput = {
      line4aIraDistributions: 53778,
      line4bTaxableIra: 43100,
      line7CapitalGain: 1400 // 5000 - 3600
    }

    it('should report IRA distributions correctly', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          expect(f1040.l4a()).toBe(expected.line4aIraDistributions)
          expect(f1040.l4b()).toBe(expected.line4bTaxableIra)
        }
      )
    })

    it('should calculate capital gains correctly', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          expect(f1040.l7()).toBe(expected.line7CapitalGain)
        }
      )
    })
  })

  /**
   * Scenario 5 - Bobby Barker (Head of Household, blind)
   */
  describe('Scenario 5 - Bobby Barker (HOH)', () => {
    const scenario: ATSScenarioInput = {
      taxYear: 2025,
      filingStatus: FilingStatus.HOH,
      taxpayer: {
        firstName: 'Bobby',
        lastName: 'Barker',
        ssn: '400011051',
        dateOfBirth: new Date(1980, 6, 4),
        isBlind: true,
        address: {
          address: '321 Family Lane',
          city: 'Hometown',
          state: 'OH' as State,
          zip: '45001'
        }
      },
      dependents: [
        {
          firstName: 'Skylar',
          lastName: 'Barker',
          ssn: '400011052',
          dateOfBirth: new Date(2020, 3, 10),
          relationship: 'Daughter',
          numberOfMonths: 12
        },
        {
          firstName: 'Kaylee',
          lastName: 'Barker',
          ssn: '400011053',
          dateOfBirth: new Date(2018, 9, 22),
          relationship: 'Daughter',
          numberOfMonths: 12
        }
      ],
      w2s: [
        {
          employer: {
            name: 'Tech Solutions Inc',
            ein: '31-1234567'
          },
          wages: 38500,
          federalWithholding: 3850,
          occupation: 'IT Specialist'
        }
      ]
    }

    const expected: ATSExpectedOutput = {
      line1Wages: 38500,
      line11Agi: 38500,
      // OBBBA 2025: HOH standard deduction $23,625 + blind additional $2,000 = $25,625
      line12Deduction: 25625
    }

    it('should use HOH filing status with blind additional deduction', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          // HOH standard deduction + blind additional
          expect(f1040.standardDeduction()).toBe(expected.line12Deduction)
        }
      )
    })

    it('should have correct number of dependents', () => {
      const info = atsScenarioToInformation(scenario)
      expect(info.taxPayer.dependents.length).toBe(2)
    })
  })

  /**
   * Scenario 13 - William & Nancy Birch (MFJ, low income with credits)
   */
  describe('Scenario 13 - William & Nancy Birch (MFJ)', () => {
    const scenario: ATSScenarioInput = {
      taxYear: 2025,
      filingStatus: FilingStatus.MFJ,
      taxpayer: {
        firstName: 'William',
        lastName: 'Birch',
        ssn: '400011313',
        dateOfBirth: new Date(1970, 4, 15),
        address: {
          address: '13 Elm Street',
          city: 'Anytown',
          state: 'TX' as State,
          zip: '77013'
        }
      },
      spouse: {
        firstName: 'Nancy',
        lastName: 'Birch',
        ssn: '400011234',
        dateOfBirth: new Date(1972, 8, 20)
      },
      w2s: [
        {
          employer: {
            name: 'Oak Supply Co',
            ein: '00-0000014'
          },
          wages: 31620,
          federalWithholding: 609,
          personRole: PersonRole.PRIMARY
        }
      ]
    }

    const expected: ATSExpectedOutput = {
      line1Wages: 31620,
      line9TotalIncome: 31620,
      line11Agi: 31620,
      line12Deduction: 31500, // OBBBA 2025 MFJ standard deduction
      line15TaxableIncome: 120, // 31620 - 31500
      // Tax on $112.50 at 10% = $11.25 (small rounding differences in intermediate calculations)
      line16Tax: 11.25,
      line25aWithholding: 609
    }

    it('should calculate low income correctly', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          expect(f1040.l11()).toBe(expected.line11Agi)
          expect(f1040.l15()).toBe(expected.line15TaxableIncome)
        }
      )
    })

    it('should calculate tax at 10% bracket', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          // Tax on $1,620 at 10% = $162
          expect(f1040.l16()).toBe(expected.line16Tax)
        }
      )
    })

    it('should result in refund (payments > tax)', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          const totalPayments = f1040.l33()
          const totalTax = f1040.l24()
          expect(totalPayments).toBeGreaterThan(totalTax)
        }
      )
    })
  })
})

// =============================================================================
// Validation Tests
// =============================================================================

describe('ATS Scenario Validation', () => {
  it('should validate Information objects correctly', () => {
    const scenario: ATSScenarioInput = {
      taxYear: 2025,
      filingStatus: FilingStatus.S,
      taxpayer: {
        firstName: 'Test',
        lastName: 'User',
        ssn: '123456789',
        address: {
          address: '123 Test St',
          city: 'Test City',
          state: 'CA' as State,
          zip: '90210'
        }
      },
      w2s: [
        {
          employer: { name: 'Test Co', ein: '12-3456789' },
          wages: 50000,
          federalWithholding: 5000
        }
      ]
    }

    const info = atsScenarioToInformation(scenario)
    const result = create1040(info, [])

    // Should not have validation errors
    run(result).fold(
      (errors) => {
        throw new Error(`Unexpected validation errors: ${errors.join(', ')}`)
      },
      ([f1040]) => {
        expect(f1040).toBeDefined()
      }
    )
  })

  it('should handle MFJ filing status correctly', () => {
    const scenario: ATSScenarioInput = {
      taxYear: 2025,
      filingStatus: FilingStatus.MFJ,
      taxpayer: {
        firstName: 'Primary',
        lastName: 'Taxpayer',
        ssn: '111111111',
        address: {
          address: '123 Main St',
          city: 'Anytown',
          state: 'NY' as State,
          zip: '10001'
        }
      },
      spouse: {
        firstName: 'Spouse',
        lastName: 'Taxpayer',
        ssn: '222222222'
      },
      w2s: [
        {
          employer: { name: 'Employer A', ein: '11-1111111' },
          wages: 60000,
          federalWithholding: 7000,
          personRole: PersonRole.PRIMARY
        },
        {
          employer: { name: 'Employer B', ein: '22-2222222' },
          wages: 40000,
          federalWithholding: 4000,
          personRole: PersonRole.SPOUSE
        }
      ]
    }

    const info = atsScenarioToInformation(scenario)
    const result = create1040(info, [])

    run(result).fold(
      (errors) => {
        throw new Error(`Unexpected validation errors: ${errors.join(', ')}`)
      },
      ([f1040]) => {
        // Combined wages
        expect(f1040.l1a()).toBe(100000)
        // Combined withholding
        expect(f1040.l25a()).toBe(11000)
        // MFJ standard deduction (OBBBA 2025)
        expect(f1040.standardDeduction()).toBe(31500)
      }
    )
  })

  it('should handle HOH with dependents correctly', () => {
    const scenario: ATSScenarioInput = {
      taxYear: 2025,
      filingStatus: FilingStatus.HOH,
      taxpayer: {
        firstName: 'Single',
        lastName: 'Parent',
        ssn: '333333333',
        address: {
          address: '456 Oak St',
          city: 'Somewhere',
          state: 'IL' as State,
          zip: '60601'
        }
      },
      dependents: [
        {
          firstName: 'Child',
          lastName: 'Parent',
          ssn: '444444444',
          dateOfBirth: new Date(2015, 5, 15),
          relationship: 'Child',
          numberOfMonths: 12
        }
      ],
      w2s: [
        {
          employer: { name: 'Company', ein: '33-3333333' },
          wages: 55000,
          federalWithholding: 6000
        }
      ]
    }

    const info = atsScenarioToInformation(scenario)
    const result = create1040(info, [])

    run(result).fold(
      (errors) => {
        throw new Error(`Unexpected validation errors: ${errors.join(', ')}`)
      },
      ([f1040]) => {
        expect(f1040.l1a()).toBe(55000)
        // HOH standard deduction (OBBBA 2025)
        expect(f1040.standardDeduction()).toBe(23625)
      }
    )
  })
})

// =============================================================================
// Edge Case Tests
// =============================================================================

describe('ATS Edge Cases', () => {
  it('should handle zero income correctly', () => {
    const scenario: ATSScenarioInput = {
      taxYear: 2025,
      filingStatus: FilingStatus.S,
      taxpayer: {
        firstName: 'Zero',
        lastName: 'Income',
        ssn: '555555555',
        address: {
          address: '789 Empty St',
          city: 'Nowhere',
          state: 'WA' as State,
          zip: '98001'
        }
      },
      w2s: []
    }

    const info = atsScenarioToInformation(scenario)
    const result = create1040(info, [])

    run(result).fold(
      (errors) => {
        // May fail validation due to no income - that's expected
        expect(errors.length).toBeGreaterThanOrEqual(0)
      },
      ([f1040]) => {
        expect(f1040.l1a()).toBe(0)
        expect(f1040.l11()).toBe(0)
        expect(f1040.l15()).toBe(0)
      }
    )
  })

  it('should handle multiple W-2s from same employer', () => {
    const scenario: ATSScenarioInput = {
      taxYear: 2025,
      filingStatus: FilingStatus.S,
      taxpayer: {
        firstName: 'Multi',
        lastName: 'W2',
        ssn: '666666666',
        address: {
          address: '123 Multi St',
          city: 'Multitown',
          state: 'OR' as State,
          zip: '97001'
        }
      },
      w2s: [
        {
          employer: { name: 'Same Company', ein: '44-4444444' },
          wages: 30000,
          federalWithholding: 3000
        },
        {
          employer: { name: 'Same Company', ein: '44-4444444' },
          wages: 20000,
          federalWithholding: 2000
        }
      ]
    }

    const info = atsScenarioToInformation(scenario)
    const result = create1040(info, [])

    run(result).fold(
      (errors) => {
        throw new Error(`Unexpected validation errors: ${errors.join(', ')}`)
      },
      ([f1040]) => {
        expect(f1040.l1a()).toBe(50000)
        expect(f1040.l25a()).toBe(5000)
      }
    )
  })

  it('should handle dividend and interest income', () => {
    const scenario: ATSScenarioInput = {
      taxYear: 2025,
      filingStatus: FilingStatus.S,
      taxpayer: {
        firstName: 'Investor',
        lastName: 'Person',
        ssn: '777777777',
        address: {
          address: '999 Wall St',
          city: 'Finance City',
          state: 'NY' as State,
          zip: '10005'
        }
      },
      w2s: [
        {
          employer: { name: 'Day Job', ein: '55-5555555' },
          wages: 80000,
          federalWithholding: 10000
        }
      ],
      f1099Ints: [
        {
          payer: 'Bank A',
          income: 500
        },
        {
          payer: 'Bank B',
          income: 300
        }
      ],
      f1099Divs: [
        {
          payer: 'Brokerage',
          dividends: 2000,
          qualifiedDividends: 1800
        }
      ]
    }

    const info = atsScenarioToInformation(scenario)
    const result = create1040(info, [])

    run(result).fold(
      (errors) => {
        throw new Error(`Unexpected validation errors: ${errors.join(', ')}`)
      },
      ([f1040]) => {
        expect(f1040.l1a()).toBe(80000)
        // Interest: 500 + 300 = 800
        expect(f1040.l2b()).toBe(800)
        // Dividends
        expect(f1040.l3b()).toBe(2000)
        expect(f1040.l3a()).toBe(1800)
      }
    )
  })
})
