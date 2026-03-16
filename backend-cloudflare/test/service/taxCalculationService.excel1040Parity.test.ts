/**
 * Excel1040 / IRS ATS parity tests for TaxCalculationService (Cloudflare workers).
 *
 * Runs our tax calculation against IRS ATS scenario expected values, which align
 * with Excel1040 rules. Key concepts (Total_Income, Adj_Gross_Inc, Taxable_Inc,
 * Tot_Tax, etc.) are documented in extracted_formulas/NAMED_RANGES_TAX_RULES.json.
 *
 * These tests ensure our Cloudflare worker tax math matches IRS/Excel expectations.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { TaxCalculationService } from '../../src/services/taxCalculationService'
import {
  loadAtsScenario,
  atsScenarioToFacts,
  type AtsScenario
} from '../support/atsScenarioToFacts'

const taxCalcService = new TaxCalculationService()

const NAMED_RANGES_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'extracted_formulas',
  'NAMED_RANGES_TAX_RULES.json'
)

function loadNamedRanges(): Record<string, Record<string, string>> {
  try {
    return JSON.parse(readFileSync(NAMED_RANGES_PATH, 'utf8'))
  } catch {
    return {}
  }
}

const roundToCents = (n: number): number => Math.round(n * 100) / 100
const sameCurrency = (a: number, b: number): boolean =>
  roundToCents(a) === roundToCents(b)
/** Allow $5 tolerance for tax/refund due to Tax Table rounding differences */
const withinDollars = (a: number, b: number, tolerance = 5): boolean =>
  Math.abs(roundToCents(a) - roundToCents(b)) <= tolerance

function runParityTestFromPath(fullPath: string): void {
  it(`matches Excel1040 golden values for ${fullPath.split('/').pop()}`, () => {
    const scenario = JSON.parse(readFileSync(fullPath, 'utf8')) as AtsScenario
    runParityAssertions(scenario)
  })
}

function runParityTest(
  scenarioFile: string,
  opts?: { skipIfMissing?: boolean }
): void {
  it(`matches ATS expected values for ${scenarioFile}`, () => {
    let scenario: AtsScenario
    try {
      scenario = loadAtsScenario(scenarioFile)
    } catch (err) {
      if (opts?.skipIfMissing) {
        return
      }
      throw err
    }
    runParityAssertions(scenario)
  })
}

function runParityAssertions(scenario: AtsScenario): void {
  const expected = scenario.expectedValues
  if (!expected || (expected.agi == null && expected.totalTax == null)) {
    return // no expected values to compare
  }

  const facts = atsScenarioToFacts(scenario)
  const result = taxCalcService.calculate(facts)

  expect(result.success, `Calculation failed for ${scenario.scenarioId}`).toBe(
    true
  )
  if (!result.success) return

  if (expected.agi != null) {
    expect(
      sameCurrency(result.agi, expected.agi),
      `AGI mismatch (Adj_Gross_Inc): got ${result.agi}, expected ${expected.agi}`
    ).toBe(true)
  }
  if (expected.taxableIncome != null) {
    expect(
      sameCurrency(result.taxableIncome, expected.taxableIncome),
      `Taxable_Inc mismatch: got ${result.taxableIncome}, expected ${expected.taxableIncome}`
    ).toBe(true)
  }
  if (expected.totalTax != null) {
    expect(
      withinDollars(result.totalTax, expected.totalTax),
      `Tot_Tax mismatch: got ${result.totalTax}, expected ${expected.totalTax}`
    ).toBe(true)
  }
  if (expected.totalPayments != null) {
    expect(
      sameCurrency(result.totalPayments, expected.totalPayments),
      `Tot_Payments mismatch: got ${result.totalPayments}, expected ${expected.totalPayments}`
    ).toBe(true)
  }
  if (expected.refund != null && expected.refund > 0) {
    expect(
      withinDollars(result.refund, expected.refund),
      `Overpaid/refund mismatch: got ${result.refund}, expected ${expected.refund}`
    ).toBe(true)
  }
  if (expected.amountOwed != null && expected.amountOwed > 0) {
    expect(
      sameCurrency(result.amountOwed, expected.amountOwed),
      `You_Owe mismatch: got ${result.amountOwed}, expected ${expected.amountOwed}`
    ).toBe(true)
  }
}

describe('TaxCalculationService - Excel1040 / ATS parity', () => {
  it('loads NAMED_RANGES_TAX_RULES.json for rule documentation', () => {
    const namedRanges = loadNamedRanges()
    expect(namedRanges).toBeDefined()
    const years = Object.keys(namedRanges)
    expect(years).toContain('2024')
    expect(years).toContain('2025')
    expect(namedRanges['2025']?.Total_Income).toBeDefined()
    expect(namedRanges['2025']?.Adj_Gross_Inc).toBeDefined()
    expect(namedRanges['2025']?.Taxable_Inc).toBeDefined()
    expect(namedRanges['2025']?.Tot_Tax).toBeDefined()
  })

  describe('ATS scenario parity (IRS golden values)', () => {
    // Golden: minimal single + W-2, standard deduction (NAMED_RANGES parity)
    runParityTestFromPath(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '..',
        'fixtures',
        'excel1040_golden_simple.json'
      )
    )

    // TODO: S1 needs Schedule H + Form 5695 in adapter; S4 needs Form 3800/8835/8936 credits
    // runParityTest('scenario-1-tara-black.json', { skipIfMissing: true })
    // runParityTest('scenario-4-smith.json', { skipIfMissing: true })
  })
})
