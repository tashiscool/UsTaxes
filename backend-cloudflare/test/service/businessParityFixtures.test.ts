import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { TaxCalculationService } from '../../src/services/taxCalculationService'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const MANIFEST_PATH = resolve(
  ROOT,
  'src/tests/ats/business/fixtures/business_fixture_manifest.json'
)

interface FixtureManifestEntry {
  formType: string
  path: string
  scenarioId: string
}

interface OwnerAllocationExpectation {
  name: string
  [key: string]: string | number
}

interface BusinessParityExpectedFailure {
  success: false
  errors?: string[]
  errorsContain?: string[]
}

interface BusinessParityExpectedSuccess extends Record<string, unknown> {
  success?: true
  ownerAllocations?: OwnerAllocationExpectation[]
}

interface BusinessParityFixture {
  scenarioId: string
  formType: string
  description: string
  facts: Record<string, unknown>
  expected: BusinessParityExpectedFailure | BusinessParityExpectedSuccess
}

const service = new TaxCalculationService()

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as {
  fixtures: FixtureManifestEntry[]
}

function loadFixture(entry: FixtureManifestEntry): BusinessParityFixture {
  return JSON.parse(
    readFileSync(resolve(ROOT, entry.path), 'utf8')
  ) as BusinessParityFixture
}

function expectMatchingFields(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>
): void {
  for (const [key, value] of Object.entries(expected)) {
    expect(actual[key]).toEqual(value)
  }
}

describe('business parity fixtures', () => {
  for (const entry of manifest.fixtures) {
    const fixture = loadFixture(entry)

    it(`${fixture.scenarioId} stays aligned`, () => {
      const result = service.calculateBusinessEntity(
        fixture.formType,
        fixture.facts
      )

      if (fixture.expected.success === false) {
        expect(result.success).toBe(false)
        if (result.success) return

        if (fixture.expected.errors !== undefined) {
          expect(result.errors).toEqual(fixture.expected.errors)
        }

        for (const errorFragment of fixture.expected.errorsContain ?? []) {
          expect(result.errors.join(' ')).toContain(errorFragment)
        }
        return
      }

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.formType).toBe(fixture.formType)

      const { ownerAllocations, ...expectedSummary } = fixture.expected
      expectMatchingFields(
        result as unknown as Record<string, unknown>,
        expectedSummary
      )

      if (ownerAllocations !== undefined) {
        expect(result.ownerAllocations).toBeDefined()
        expect(result.ownerAllocations).toHaveLength(ownerAllocations.length)

        for (const expectedAllocation of ownerAllocations) {
          const actual = result.ownerAllocations!.find(
            (allocation) => allocation.name === expectedAllocation.name
          )
          expect(actual).toBeDefined()
          expectMatchingFields(
            actual as unknown as Record<string, unknown>,
            expectedAllocation
          )
        }
      }
    })
  }
})
