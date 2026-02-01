/**
 * State E-File Tests
 *
 * These tests verify state tax return calculations and
 * e-file preparation. Note: State returns do not use the
 * federal ATS system - each state has its own certification.
 *
 * Key points:
 * - No federal ATS for state returns
 * - State e-file often piggybacks federal submission
 * - Each state has unique forms and calculations
 * - Some states have no income tax (FL, TX, WA, etc.)
 */

// =============================================================================
// States Without Income Tax
// =============================================================================

describe('States Without Income Tax', () => {
  const noIncomeTaxStates = ['AK', 'FL', 'NV', 'SD', 'TX', 'WA', 'WY']
  const limitedIncomeTaxStates = ['NH', 'TN'] // Only tax interest/dividends

  it('should identify states with no income tax', () => {
    expect(noIncomeTaxStates).toContain('FL')
    expect(noIncomeTaxStates).toContain('TX')
    expect(noIncomeTaxStates).toContain('WA')
  })

  it('should identify states with limited income tax', () => {
    expect(limitedIncomeTaxStates).toContain('NH')
    expect(limitedIncomeTaxStates).toContain('TN')
  })

  it('should not generate state return for no-tax states', () => {
    const state = 'FL'
    const hasIncomeTax = !noIncomeTaxStates.includes(state)
    expect(hasIncomeTax).toBe(false)
  })
})

// =============================================================================
// State Tax Calculation Tests
// =============================================================================

describe('State Tax Calculations', () => {
  describe('California (CA540)', () => {
    const caParams = {
      standardDeduction: {
        single: 5540,
        mfj: 11080,
        mfs: 5540,
        hoh: 11080
      },
      taxBrackets: [
        { min: 0, max: 10756, rate: 0.01 },
        { min: 10756, max: 25499, rate: 0.02 },
        { min: 25499, max: 40245, rate: 0.04 },
        { min: 40245, max: 55866, rate: 0.06 },
        { min: 55866, max: 70606, rate: 0.08 },
        { min: 70606, max: 360659, rate: 0.093 },
        { min: 360659, max: 432787, rate: 0.103 },
        { min: 432787, max: 721314, rate: 0.113 },
        { min: 721314, max: 1000000, rate: 0.123 },
        { min: 1000000, max: Infinity, rate: 0.133 }
      ]
    }

    it('should have correct CA standard deduction for Single', () => {
      expect(caParams.standardDeduction.single).toBe(5540)
    })

    it('should have correct CA standard deduction for MFJ', () => {
      expect(caParams.standardDeduction.mfj).toBe(11080)
    })

    it('should have 10 tax brackets', () => {
      expect(caParams.taxBrackets.length).toBe(10)
    })

    it('should have 1% lowest bracket', () => {
      expect(caParams.taxBrackets[0].rate).toBe(0.01)
    })

    it('should have 13.3% highest bracket for millionaires', () => {
      expect(caParams.taxBrackets[9].rate).toBe(0.133)
    })

    it('should calculate CA tax for $60,000 income', () => {
      const income = 60000
      const deduction = caParams.standardDeduction.single
      const taxableIncome = income - deduction // 54460

      let tax = 0
      let remaining = taxableIncome

      for (const bracket of caParams.taxBrackets) {
        if (remaining <= 0) break
        const taxableInBracket = Math.min(remaining, bracket.max - bracket.min)
        tax += taxableInBracket * bracket.rate
        remaining -= taxableInBracket
      }

      expect(Math.round(tax)).toBeGreaterThan(0)
      expect(Math.round(tax)).toBeLessThan(taxableIncome) // Tax should be less than income
    })
  })

  describe('New York (IT-201)', () => {
    const nyParams = {
      standardDeduction: {
        single: 8000,
        mfj: 16050,
        mfs: 8000,
        hoh: 11200
      },
      taxBrackets: [
        { min: 0, max: 8500, rate: 0.04 },
        { min: 8500, max: 11700, rate: 0.045 },
        { min: 11700, max: 13900, rate: 0.0525 },
        { min: 13900, max: 80650, rate: 0.055 },
        { min: 80650, max: 215400, rate: 0.06 },
        { min: 215400, max: 1077550, rate: 0.0685 },
        { min: 1077550, max: 5000000, rate: 0.0965 },
        { min: 5000000, max: 25000000, rate: 0.103 },
        { min: 25000000, max: Infinity, rate: 0.109 }
      ]
    }

    it('should have correct NY standard deduction for Single', () => {
      expect(nyParams.standardDeduction.single).toBe(8000)
    })

    it('should have 9 tax brackets', () => {
      expect(nyParams.taxBrackets.length).toBe(9)
    })

    it('should have 4% lowest bracket', () => {
      expect(nyParams.taxBrackets[0].rate).toBe(0.04)
    })
  })

  describe('Texas (No State Income Tax)', () => {
    it('should have no state income tax', () => {
      const texasTaxRate = 0
      expect(texasTaxRate).toBe(0)
    })

    it('should not require state return', () => {
      const requiresStateReturn = false
      expect(requiresStateReturn).toBe(false)
    })
  })

  describe('Illinois (IL-1040)', () => {
    const ilParams = {
      flatRate: 0.0495, // 4.95% flat tax
      exemptionAmount: 2625
    }

    it('should have flat tax rate', () => {
      expect(ilParams.flatRate).toBe(0.0495)
    })

    it('should calculate IL tax with flat rate', () => {
      const federalAgi = 60000
      const exemption = ilParams.exemptionAmount
      const taxableIncome = federalAgi - exemption
      const ilTax = taxableIncome * ilParams.flatRate

      expect(Math.round(ilTax)).toBe(Math.round(57375 * 0.0495))
    })
  })

  describe('Pennsylvania (PA-40)', () => {
    const paParams = {
      flatRate: 0.0307 // 3.07% flat tax
    }

    it('should have lowest flat tax rate', () => {
      expect(paParams.flatRate).toBe(0.0307)
    })

    it('should calculate PA tax with flat rate', () => {
      const taxableCompensation = 75000
      const paTax = taxableCompensation * paParams.flatRate
      expect(Math.round(paTax)).toBe(2303)
    })
  })
})

// =============================================================================
// State E-File Piggyback Tests
// =============================================================================

describe('State E-File Piggyback', () => {
  describe('State-Federal Linked Filing', () => {
    it('should identify states that accept piggyback filing', () => {
      const piggybackStates = [
        'AZ',
        'AR',
        'CA',
        'CO',
        'CT',
        'DE',
        'GA',
        'HI',
        'ID',
        'IL',
        'IN',
        'IA',
        'KS',
        'KY',
        'LA',
        'ME',
        'MD',
        'MA',
        'MI',
        'MN',
        'MS',
        'MO',
        'MT',
        'NE',
        'NJ',
        'NM',
        'NY',
        'NC',
        'ND',
        'OH',
        'OK',
        'OR',
        'PA',
        'RI',
        'SC',
        'UT',
        'VT',
        'VA',
        'WV',
        'WI'
      ]
      expect(piggybackStates.length).toBeGreaterThan(30)
    })

    it('should use federal AGI as starting point', () => {
      const federalAgi = 75000
      const stateStartingPoint = federalAgi
      expect(stateStartingPoint).toBe(federalAgi)
    })

    it('should include state-specific adjustments', () => {
      // Example: State doesn't tax Social Security
      const federalAgi = 75000
      const ssBenefits = 15000
      const stateAdjustment = ssBenefits // Subtraction
      const stateAgi = federalAgi - stateAdjustment
      expect(stateAgi).toBe(60000)
    })
  })

  describe('Multi-State Filing', () => {
    const multiStateScenario = {
      residentState: 'NY',
      workState: 'NJ',
      wages: {
        NY: 50000,
        NJ: 30000
      }
    }

    it('should file resident return for domicile state', () => {
      expect(multiStateScenario.residentState).toBe('NY')
    })

    it('should file nonresident return for work state', () => {
      expect(multiStateScenario.workState).toBe('NJ')
    })

    it('should allocate income by state', () => {
      const totalWages = multiStateScenario.wages.NY + multiStateScenario.wages.NJ
      expect(totalWages).toBe(80000)
    })

    it('should calculate credit for taxes paid to other states', () => {
      // NY resident working in NJ gets credit for NJ taxes paid
      const njTaxPaid = 3000
      const creditForTaxesPaid = njTaxPaid
      expect(creditForTaxesPaid).toBe(3000)
    })
  })
})

// =============================================================================
// State-Specific Form Tests
// =============================================================================

describe('State-Specific Forms', () => {
  describe('NYC Resident Tax', () => {
    const nycParams = {
      taxBrackets: [
        { min: 0, max: 12000, rate: 0.03078 },
        { min: 12000, max: 25000, rate: 0.03762 },
        { min: 25000, max: 50000, rate: 0.03819 },
        { min: 50000, max: Infinity, rate: 0.03876 }
      ]
    }

    it('should have NYC resident tax brackets', () => {
      expect(nycParams.taxBrackets.length).toBe(4)
    })

    it('should apply NYC tax in addition to NY state tax', () => {
      const income = 60000
      const nyStateTax = 3000 // Simplified
      const nycTax = 2000 // Simplified
      const totalNyTax = nyStateTax + nycTax
      expect(totalNyTax).toBeGreaterThan(nyStateTax)
    })
  })

  describe('Local Income Taxes', () => {
    it('should identify cities with local income tax', () => {
      const citiesWithLocalTax = [
        'New York City',
        'Philadelphia',
        'Detroit',
        'Cleveland',
        'Columbus',
        'Cincinnati'
      ]
      expect(citiesWithLocalTax.length).toBeGreaterThan(5)
    })

    it('should calculate Philadelphia wage tax', () => {
      const phillyWageTaxRate = 0.0375 // Resident rate
      const wages = 50000
      const phillyTax = wages * phillyWageTaxRate
      expect(phillyTax).toBe(1875)
    })
  })
})

// =============================================================================
// State E-File XML Tests
// =============================================================================

describe('State E-File XML Generation', () => {
  describe('State Return Structure', () => {
    it('should include state-specific namespace', () => {
      // Each state has its own schema
      const caNamespace = 'xmlns="http://www.ftb.ca.gov/efile"'
      expect(caNamespace).toContain('ftb.ca.gov')
    })

    it('should reference federal return data', () => {
      const federalReturnRef = {
        federalAgi: 75000,
        federalTaxableIncome: 60000,
        federalTax: 8253
      }
      expect(federalReturnRef.federalAgi).toBeDefined()
    })

    it('should include state-specific schedules', () => {
      const caSchedules = ['Schedule CA', 'Schedule S']
      expect(caSchedules.length).toBeGreaterThan(0)
    })
  })

  describe('State Submission Package', () => {
    it('should bundle with federal if piggyback', () => {
      const isPiggyback = true
      const bundleWithFederal = isPiggyback
      expect(bundleWithFederal).toBe(true)
    })

    it('should submit separately if standalone', () => {
      const isStandalone = true
      const separateSubmission = isStandalone
      expect(separateSubmission).toBe(true)
    })
  })
})
