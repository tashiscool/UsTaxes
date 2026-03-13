import { FilingStatus } from 'ustaxes/core/data'
import { BusinessRulesEngine } from 'ustaxes/efile/validation/businessRules'

describe('BusinessRulesEngine expanded TY2025 coverage', () => {
  const engine = new BusinessRulesEngine()

  it('flags capped OBBBA overtime deductions', () => {
    const errors = engine.check(
      {
        overtimeDeduction: 12000,
      } as any,
      2025
    )

    expect(errors.some((error) => error.ruleId === 'OBBBA001')).toBe(true)
  })

  it('flags Trump Savings Account contributions above the annual limit', () => {
    const errors = engine.check(
      {
        trumpAccountContributions: 5500,
        trumpAccountAge: 7,
      } as any,
      2025
    )

    expect(errors.some((error) => error.ruleId === 'OBBBA006')).toBe(true)
  })

  it('flags S-corp distributions that exceed shareholder basis', () => {
    const errors = engine.check(
      {
        sCorpBasisBeginning: 10000,
        sCorpBasisIncome: 3000,
        sCorpBasisDistributions: 15000,
      } as any,
      2025
    )

    expect(errors.some((error) => error.ruleId === 'BE001')).toBe(true)
  })

  it('flags HOH returns without a qualifying dependent', () => {
    const errors = engine.check(
      {
        filingStatus: FilingStatus.HOH,
        dependentCount: 0,
      } as any,
      2025
    )

    expect(errors.some((error) => error.ruleId === 'FS001')).toBe(true)
  })
})
