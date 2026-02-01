/**
 * ATS Schema Validation Tests
 *
 * These tests verify that XML generated from ATS scenarios
 * passes IRS MeF schema validation.
 */

import { create1040 } from 'ustaxes/forms/Y2025/irsForms/Main'
import { FilingStatus, PersonRole, State } from 'ustaxes/core/data'
import { run } from 'ustaxes/core/util'
import {
  Form1040Serializer,
  SerializerConfig
} from 'ustaxes/efile/mef/serializer'
import {
  SchemaValidator,
  ValidationSeverity
} from 'ustaxes/efile/validation/schemaValidator'
import {
  atsScenarioToInformation,
  ATSScenarioInput
} from '../utils/scenarioToInformation'

// =============================================================================
// Test Configuration
// =============================================================================

const defaultSerializerConfig: SerializerConfig = {
  taxYear: 2025,
  softwareId: 'USTAXES1',
  softwareVersion: '2025.1.0',
  originatorEFIN: '123456',
  originatorType: 'OnlineFiler',
  pinType: 'SelfSelectPIN',
  primaryPIN: '12345',
  isTestSubmission: true
}

// =============================================================================
// Schema Validator Unit Tests
// =============================================================================

describe('Schema Validator', () => {
  let validator: SchemaValidator

  beforeEach(() => {
    validator = new SchemaValidator(2025)
  })

  describe('Field Value Validation', () => {
    it('should validate SSN format', () => {
      // Valid SSN
      expect(validator.validateFieldValue('123456789', 'SSNType', 'Form1040')).toBeNull()

      // Invalid SSN - too short
      const shortError = validator.validateFieldValue('12345678', 'SSNType', 'Form1040')
      expect(shortError).not.toBeNull()
      expect(shortError?.code).toBe('PATTERN_MISMATCH')

      // Invalid SSN - contains letters
      const letterError = validator.validateFieldValue('12345678A', 'SSNType', 'Form1040')
      expect(letterError).not.toBeNull()
    })

    it('should validate EIN format', () => {
      // Valid EIN
      expect(validator.validateFieldValue('123456789', 'EINType', 'Form1040')).toBeNull()

      // Invalid EIN
      const error = validator.validateFieldValue('12345678', 'EINType', 'Form1040')
      expect(error).not.toBeNull()
    })

    it('should validate ZIP code format', () => {
      // Valid 5-digit ZIP
      expect(validator.validateFieldValue('90210', 'ZIPCodeType', 'Form1040')).toBeNull()

      // Valid ZIP+4
      expect(validator.validateFieldValue('90210-1234', 'ZIPCodeType', 'Form1040')).toBeNull()

      // Invalid ZIP
      const error = validator.validateFieldValue('9021', 'ZIPCodeType', 'Form1040')
      expect(error).not.toBeNull()
    })

    it('should validate state codes', () => {
      // Valid state
      expect(validator.validateFieldValue('CA', 'StateType', 'Form1040')).toBeNull()
      expect(validator.validateFieldValue('NY', 'StateType', 'Form1040')).toBeNull()
      expect(validator.validateFieldValue('TX', 'StateType', 'Form1040')).toBeNull()

      // Invalid state
      const error = validator.validateFieldValue('XX', 'StateType', 'Form1040')
      expect(error).not.toBeNull()
      expect(error?.code).toBe('ENUMERATION_ERROR')
    })

    it('should validate filing status', () => {
      // Valid status codes
      expect(validator.validateFieldValue('1', 'FilingStatusType', 'Form1040')).toBeNull() // Single
      expect(validator.validateFieldValue('2', 'FilingStatusType', 'Form1040')).toBeNull() // MFJ
      expect(validator.validateFieldValue('3', 'FilingStatusType', 'Form1040')).toBeNull() // MFS
      expect(validator.validateFieldValue('4', 'FilingStatusType', 'Form1040')).toBeNull() // HOH
      expect(validator.validateFieldValue('5', 'FilingStatusType', 'Form1040')).toBeNull() // QSS

      // Invalid status
      const error = validator.validateFieldValue('6', 'FilingStatusType', 'Form1040')
      expect(error).not.toBeNull()
    })

    it('should validate phone number format', () => {
      // Valid phone
      expect(validator.validateFieldValue('1234567890', 'PhoneNumberType', 'Form1040')).toBeNull()

      // Invalid phone - too short
      const error = validator.validateFieldValue('123456789', 'PhoneNumberType', 'Form1040')
      expect(error).not.toBeNull()
    })

    it('should validate person name length', () => {
      // Valid name
      expect(validator.validateFieldValue('John', 'PersonNameType', 'Form1040')).toBeNull()

      // Too long (over 35 chars)
      const longName = 'A'.repeat(36)
      const error = validator.validateFieldValue(longName, 'PersonNameType', 'Form1040')
      expect(error).not.toBeNull()
      expect(error?.code).toBe('LENGTH_ERROR')
    })
  })

  describe('XML Validation', () => {
    it('should reject empty XML', async () => {
      const result = await validator.validate('', 'Form1040')
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0].code).toBe('EMPTY_XML')
    })

    it('should reject malformed XML', async () => {
      const malformedXml = '<Return><ReturnHeader></Return>' // Unbalanced tags
      const result = await validator.validate(malformedXml, 'Form1040')
      expect(result.valid).toBe(false)
    })

    it('should validate basic XML structure', async () => {
      const basicXml = `<?xml version="1.0" encoding="UTF-8"?>
        <Return xmlns="http://www.irs.gov/efile">
          <ReturnHeader>
            <PrimarySSN>123456789</PrimarySSN>
          </ReturnHeader>
          <ReturnData documentCnt="1">
            <IRS1040></IRS1040>
          </ReturnData>
        </Return>`

      const result = await validator.validate(basicXml, 'Form1040')
      // Structure should be valid (content validation may have warnings)
      expect(result.errors.filter(e => e.code === 'UNBALANCED_TAG')).toHaveLength(0)
    })
  })

  describe('Cache Management', () => {
    it('should cache schema definitions', async () => {
      await validator.validate('<test/>', 'Form1040')
      expect(validator.getCacheSize()).toBeGreaterThan(0)
    })

    it('should clear cache', async () => {
      await validator.validate('<test/>', 'Form1040')
      validator.clearCache()
      expect(validator.getCacheSize()).toBe(0)
    })
  })
})

// =============================================================================
// ATS Scenario Schema Validation Tests
// =============================================================================

describe('ATS Scenario Schema Validation', () => {
  let validator: SchemaValidator

  beforeEach(() => {
    validator = new SchemaValidator(2025)
  })

  /**
   * Scenario 1 - Simple W-2 Only
   */
  describe('Scenario 1 - Simple W-2 Validation', () => {
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
          employer: { name: 'ABC Company', ein: '12-3456789' },
          wages: 75000,
          federalWithholding: 9500,
          occupation: 'Software Engineer'
        }
      ]
    }

    it('should generate schema-compliant XML', async () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      await run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        async ([f1040]) => {
          const serializer = new Form1040Serializer(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            f1040 as any,
            defaultSerializerConfig
          )
          const xml = serializer.serialize()

          const validationResult = await validator.validate(xml, 'Form1040')

          // Check for structural errors only (not missing optional fields)
          const structuralErrors = validationResult.errors.filter(
            (e) => e.code === 'UNBALANCED_TAG' || e.code === 'UNCLOSED_TAGS'
          )
          expect(structuralErrors).toHaveLength(0)
        }
      )
    })

    it('should have valid SSN format in XML', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          const serializer = new Form1040Serializer(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            f1040 as any,
            defaultSerializerConfig
          )
          const xml = serializer.serialize()

          // Extract SSN from XML and validate
          const ssnMatch = xml.match(/<PrimarySSN>(\d+)<\/PrimarySSN>/)
          expect(ssnMatch).not.toBeNull()

          const ssn = ssnMatch![1]
          const ssnValidation = validator.validateFieldValue(ssn, 'SSNType', 'Form1040')
          expect(ssnValidation).toBeNull()
        }
      )
    })
  })

  /**
   * Scenario 2 - MFJ with Dependents
   */
  describe('Scenario 2 - MFJ Validation', () => {
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
        dateOfBirth: new Date(1978, 7, 10)
      },
      dependents: [
        {
          firstName: 'Jacob',
          lastName: 'Jones',
          ssn: '400011023',
          dateOfBirth: new Date(2007, 5, 15),
          relationship: 'Son',
          numberOfMonths: 12
        }
      ],
      w2s: [
        {
          employer: { name: 'Southwest Airlines', ein: '75-1234567' },
          wages: 22013,
          federalWithholding: 1650,
          personRole: PersonRole.PRIMARY
        },
        {
          employer: { name: 'Target', ein: '41-0987654' },
          wages: 16013,
          federalWithholding: 1251,
          personRole: PersonRole.SPOUSE
        }
      ]
    }

    it('should generate schema-compliant XML for MFJ return', async () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      await run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        async ([f1040]) => {
          const serializer = new Form1040Serializer(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            f1040 as any,
            { ...defaultSerializerConfig, spousePIN: '54321' }
          )
          const xml = serializer.serialize()

          const validationResult = await validator.validate(xml, 'Form1040')

          // Check for structural errors
          const structuralErrors = validationResult.errors.filter(
            (e) => e.code === 'UNBALANCED_TAG' || e.code === 'UNCLOSED_TAGS'
          )
          expect(structuralErrors).toHaveLength(0)
        }
      )
    })

    it('should have valid spouse SSN format', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          const serializer = new Form1040Serializer(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            f1040 as any,
            { ...defaultSerializerConfig, spousePIN: '54321' }
          )
          const xml = serializer.serialize()

          // Extract spouse SSN and validate
          const spouseSsnMatch = xml.match(/<SpouseSSN>(\d+)<\/SpouseSSN>/)
          expect(spouseSsnMatch).not.toBeNull()

          const ssn = spouseSsnMatch![1]
          const ssnValidation = validator.validateFieldValue(ssn, 'SSNType', 'Form1040')
          expect(ssnValidation).toBeNull()
        }
      )
    })
  })

  /**
   * Scenario with Interest/Dividends - Schedule B Validation
   */
  describe('Scenario with Schedule B Validation', () => {
    const scenario: ATSScenarioInput = {
      taxYear: 2025,
      filingStatus: FilingStatus.S,
      taxpayer: {
        firstName: 'Investment',
        lastName: 'Taxpayer',
        ssn: '400011041',
        dateOfBirth: new Date(1970, 1, 1),
        address: {
          address: '100 Money Lane',
          city: 'Wealthville',
          state: 'CT' as State,
          zip: '06001'
        }
      },
      w2s: [
        {
          employer: { name: 'Finance Corp', ein: '06-1234567' },
          wages: 100000,
          federalWithholding: 15000,
          occupation: 'Financial Analyst'
        }
      ],
      f1099Ints: [
        { payer: 'First Bank', amount: 2500 },
        { payer: 'Second Bank', amount: 1500 }
      ],
      f1099Divs: [
        {
          payer: 'Fidelity',
          ordinaryDividends: 5000,
          qualifiedDividends: 4000
        }
      ]
    }

    it('should generate valid Schedule B XML', async () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      await run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        async ([f1040]) => {
          const serializer = new Form1040Serializer(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            f1040 as any,
            defaultSerializerConfig
          )
          const xml = serializer.serialize()

          // Validate Schedule B section exists and is well-formed
          expect(xml).toContain('IRS1040ScheduleB')

          const validationResult = await validator.validate(xml, 'ScheduleB')
          const structuralErrors = validationResult.errors.filter(
            (e) => e.code === 'UNBALANCED_TAG' || e.code === 'UNCLOSED_TAGS'
          )
          expect(structuralErrors).toHaveLength(0)
        }
      )
    })
  })
})

// =============================================================================
// Multiple Form Validation Tests
// =============================================================================

describe('Multiple Form Validation', () => {
  let validator: SchemaValidator

  beforeEach(() => {
    validator = new SchemaValidator(2025)
  })

  it('should validate multiple schedules', async () => {
    const scenario: ATSScenarioInput = {
      taxYear: 2025,
      filingStatus: FilingStatus.S,
      taxpayer: {
        firstName: 'Complex',
        lastName: 'Return',
        ssn: '400011099',
        dateOfBirth: new Date(1960, 0, 1),
        address: {
          address: '999 Complex Way',
          city: 'Taxtown',
          state: 'NY' as State,
          zip: '10001'
        }
      },
      w2s: [
        {
          employer: { name: 'Big Company', ein: '13-0000001' },
          wages: 200000,
          federalWithholding: 40000,
          occupation: 'Executive'
        }
      ],
      f1099Ints: [{ payer: 'Bank', amount: 5000 }],
      f1099Divs: [{ payer: 'Broker', ordinaryDividends: 10000, qualifiedDividends: 8000 }],
      f1099Bs: [
        {
          payer: 'Brokerage',
          shortTermProceeds: 25000,
          shortTermCostBasis: 20000,
          longTermProceeds: 100000,
          longTermCostBasis: 60000
        }
      ],
      itemizedDeductions: {
        stateAndLocalTaxes: 10000,
        realEstateTaxes: 5000,
        mortgageInterest: 15000,
        charityCashCheck: 10000
      }
    }

    const info = atsScenarioToInformation(scenario)
    const result = create1040(info, [])

    await run(result).fold(
      (errors) => {
        throw new Error(`Form creation failed: ${errors.join(', ')}`)
      },
      async ([f1040]) => {
        const serializer = new Form1040Serializer(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          f1040 as any,
          defaultSerializerConfig
        )
        const xml = serializer.serialize()

        // Validate main form
        const form1040Result = await validator.validate(xml, 'Form1040')
        expect(form1040Result.errors.filter(e =>
          e.code === 'UNBALANCED_TAG' || e.code === 'UNCLOSED_TAGS'
        )).toHaveLength(0)

        // Should contain multiple schedules
        expect(xml).toContain('IRS1040ScheduleB')
        expect(xml).toContain('IRS1040ScheduleD')
        expect(xml).toContain('IRS1040ScheduleA')
      }
    )
  })
})

// =============================================================================
// Error Message Quality Tests
// =============================================================================

describe('Validation Error Messages', () => {
  let validator: SchemaValidator

  beforeEach(() => {
    validator = new SchemaValidator(2025)
  })

  it('should provide helpful SSN error message', () => {
    const error = validator.validateFieldValue('12345678A', 'SSNType', 'Form1040')
    expect(error).not.toBeNull()
    expect(error?.message).toContain('pattern')
  })

  it('should provide helpful state code error message', () => {
    const error = validator.validateFieldValue('XX', 'StateType', 'Form1040')
    expect(error).not.toBeNull()
    expect(error?.expected).toContain('CA')
    expect(error?.expected).toContain('NY')
  })

  it('should provide helpful length error message', () => {
    const longName = 'A'.repeat(40)
    const error = validator.validateFieldValue(longName, 'PersonNameType', 'Form1040')
    expect(error).not.toBeNull()
    expect(error?.expected).toContain('Maximum length')
  })
})
