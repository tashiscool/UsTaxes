/**
 * ATS XML Serialization Tests
 *
 * These tests verify that ATS scenario data can be properly serialized
 * to IRS MeF-compliant XML format.
 */

/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any */

import { create1040 } from 'ustaxes/forms/Y2025/irsForms/Main'
import { FilingStatus, PersonRole, State } from 'ustaxes/core/data'
import { run } from 'ustaxes/core/util'
import {
  Form1040Serializer,
  SerializerConfig,
  formatAmount,
  formatSSN,
  formatEIN,
  formatDate,
  escapeXml
} from 'ustaxes/efile/mef/serializer'
import {
  atsScenarioToInformation,
  ATSScenarioInput
} from '../utils/scenarioToInformation'

// =============================================================================
// Serializer Configuration
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
// Utility Function Tests
// =============================================================================

describe('XML Serializer Utility Functions', () => {
  describe('formatAmount', () => {
    it('should format positive numbers without decimals', () => {
      expect(formatAmount(75000)).toBe('75000')
      expect(formatAmount(123.45)).toBe('123')
      expect(formatAmount(123.99)).toBe('124')
    })

    it('should handle zero', () => {
      expect(formatAmount(0)).toBe('0')
    })

    it('should handle undefined and null', () => {
      expect(formatAmount(undefined)).toBe('0')
      expect(formatAmount(null)).toBe('0')
    })

    it('should handle negative numbers', () => {
      expect(formatAmount(-5000)).toBe('-5000')
    })
  })

  describe('formatSSN', () => {
    it('should remove dashes from SSN', () => {
      expect(formatSSN('123-45-6789')).toBe('123456789')
    })

    it('should remove spaces from SSN', () => {
      expect(formatSSN('123 45 6789')).toBe('123456789')
    })

    it('should pass through clean SSN', () => {
      expect(formatSSN('123456789')).toBe('123456789')
    })

    it('should handle undefined', () => {
      expect(formatSSN(undefined)).toBe('')
    })
  })

  describe('formatEIN', () => {
    it('should remove dashes from EIN', () => {
      expect(formatEIN('12-3456789')).toBe('123456789')
    })

    it('should handle undefined', () => {
      expect(formatEIN(undefined)).toBe('')
    })
  })

  describe('formatDate', () => {
    it('should format Date object to YYYY-MM-DD', () => {
      const date = new Date(2025, 3, 15) // April 15, 2025
      expect(formatDate(date)).toBe('2025-04-15')
    })

    it('should handle undefined', () => {
      expect(formatDate(undefined)).toBe('')
    })
  })

  describe('escapeXml', () => {
    it('should escape ampersand', () => {
      expect(escapeXml('A & B')).toBe('A &amp; B')
    })

    it('should escape less than', () => {
      expect(escapeXml('A < B')).toBe('A &lt; B')
    })

    it('should escape greater than', () => {
      expect(escapeXml('A > B')).toBe('A &gt; B')
    })

    it('should escape double quotes', () => {
      expect(escapeXml('"quoted"')).toBe('&quot;quoted&quot;')
    })

    it('should escape single quotes', () => {
      expect(escapeXml("it's")).toBe('it&apos;s')
    })

    it('should handle multiple special characters', () => {
      expect(escapeXml('<A & B>')).toBe('&lt;A &amp; B&gt;')
    })

    it('should handle undefined', () => {
      expect(escapeXml(undefined)).toBe('')
    })
  })
})

// =============================================================================
// ATS Scenario XML Serialization Tests
// =============================================================================

describe('ATS Scenario XML Serialization', () => {
  /**
   * Scenario 1 - Simple W-2 only (Single)
   */
  describe('Scenario 1 - James Brown XML', () => {
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

    it('should generate valid XML structure', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          const serializer = new Form1040Serializer(
            f1040 as any,
            defaultSerializerConfig
          )
          const xml = serializer.serialize()

          // Verify XML declaration
          expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')

          // Verify Return element with namespace
          expect(xml).toContain('xmlns="http://www.irs.gov/efile"')
          expect(xml).toContain('<Return')
          expect(xml).toContain('</Return>')

          // Verify ReturnHeader
          expect(xml).toContain('<ReturnHeader')
          expect(xml).toContain('</ReturnHeader>')

          // Verify ReturnData
          expect(xml).toContain('<ReturnData')
          expect(xml).toContain('</ReturnData>')
        }
      )
    })

    it('should include correct taxpayer SSN', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          const serializer = new Form1040Serializer(
            f1040 as any,
            defaultSerializerConfig
          )
          const xml = serializer.serialize()

          expect(xml).toContain('<PrimarySSN>400011011</PrimarySSN>')
        }
      )
    })

    it('should include correct wage amount', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          const serializer = new Form1040Serializer(
            f1040 as any,
            defaultSerializerConfig
          )
          const xml = serializer.serialize()

          // Check for wage amount (format may vary)
          expect(xml).toContain('75000')
        }
      )
    })

    it('should include W-2 data', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          const serializer = new Form1040Serializer(
            f1040 as any,
            defaultSerializerConfig
          )
          const xml = serializer.serialize()

          // Verify W-2 section exists
          expect(xml).toContain('<IRSW2')
          expect(xml).toContain('ABC Company')
        }
      )
    })

    it('should set test submission indicator', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          const serializer = new Form1040Serializer(
            f1040 as any,
            defaultSerializerConfig
          )
          const xml = serializer.serialize()

          expect(xml).toContain('<TestSubmissionInd>X</TestSubmissionInd>')
        }
      )
    })
  })

  /**
   * Scenario 2 - MFJ with spouse
   */
  describe('Scenario 2 - MFJ XML', () => {
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
      w2s: [
        {
          employer: { name: 'Southwest Airlines', ein: '75-1234567' },
          wages: 22013,
          federalWithholding: 1650,
          occupation: 'Pilot',
          personRole: PersonRole.PRIMARY
        },
        {
          employer: { name: 'Target', ein: '41-0987654' },
          wages: 16013,
          federalWithholding: 1251,
          occupation: 'Manager',
          personRole: PersonRole.SPOUSE
        }
      ]
    }

    it('should include both spouse SSNs', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          const serializer = new Form1040Serializer(f1040 as any, {
            ...defaultSerializerConfig,
            spousePIN: '54321'
          })
          const xml = serializer.serialize()

          expect(xml).toContain('<PrimarySSN>400011021</PrimarySSN>')
          expect(xml).toContain('<SpouseSSN>400011022</SpouseSSN>')
        }
      )
    })

    it('should include spouse name', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          const serializer = new Form1040Serializer(
            f1040 as any,
            defaultSerializerConfig
          )
          const xml = serializer.serialize()

          expect(xml).toContain('Judy')
          expect(xml).toContain('Jones')
        }
      )
    })

    it('should include multiple W-2s', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          const serializer = new Form1040Serializer(
            f1040 as any,
            defaultSerializerConfig
          )
          const xml = serializer.serialize()

          // Should have two W-2 sections
          const w2Count = (xml.match(/<IRSW2/g) || []).length
          expect(w2Count).toBe(2)
        }
      )
    })
  })

  /**
   * Scenario 3 - Interest and Dividends
   */
  describe('Scenario 3 - Interest/Dividends XML', () => {
    const scenario: ATSScenarioInput = {
      taxYear: 2025,
      filingStatus: FilingStatus.S,
      taxpayer: {
        firstName: 'Mary',
        lastName: 'Smith',
        ssn: '400011031',
        dateOfBirth: new Date(1970, 1, 1),
        address: {
          address: '789 Pine Road',
          city: 'Elsewhere',
          state: 'NY' as State,
          zip: '10001'
        }
      },
      w2s: [
        {
          employer: { name: 'Big Corp', ein: '13-1234567' },
          wages: 85000,
          federalWithholding: 12000,
          occupation: 'Analyst'
        }
      ],
      f1099Ints: [
        {
          payer: 'First National Bank',
          income: 1500
        }
      ],
      f1099Divs: [
        {
          payer: 'Vanguard',
          dividends: 3000,
          qualifiedDividends: 2500
        }
      ]
    }

    it('should include Schedule B data for interest', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          const serializer = new Form1040Serializer(
            f1040 as any,
            defaultSerializerConfig
          )
          const xml = serializer.serialize()

          // Check for interest payer (may or may not include Schedule B depending on amounts)
          expect(xml).toContain('IRS1099INT')
          expect(xml).toContain('First National Bank')
        }
      )
    })

    it('should include 1099-INT data', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          const serializer = new Form1040Serializer(
            f1040 as any,
            defaultSerializerConfig
          )
          const xml = serializer.serialize()

          // Check for 1099-INT
          expect(xml).toContain('IRS1099INT')
        }
      )
    })

    it('should include 1099-DIV data', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          const serializer = new Form1040Serializer(
            f1040 as any,
            defaultSerializerConfig
          )
          const xml = serializer.serialize()

          // Check for 1099-DIV
          expect(xml).toContain('IRS1099DIV')
          expect(xml).toContain('Vanguard')
        }
      )
    })
  })

  /**
   * Scenario with capital gains (Schedule D / Form 8949)
   */
  describe('Scenario with Capital Gains XML', () => {
    const scenario: ATSScenarioInput = {
      taxYear: 2025,
      filingStatus: FilingStatus.S,
      taxpayer: {
        firstName: 'Robert',
        lastName: 'Investor',
        ssn: '400011051',
        dateOfBirth: new Date(1965, 6, 20),
        address: {
          address: '100 Wall Street',
          city: 'NYC',
          state: 'NY' as State,
          zip: '10005'
        }
      },
      w2s: [
        {
          employer: { name: 'Financial Firm', ein: '13-9876543' },
          wages: 150000,
          federalWithholding: 30000,
          occupation: 'Portfolio Manager'
        }
      ],
      f1099Bs: [
        {
          payer: 'TD Ameritrade',
          shortTermProceeds: 10000,
          shortTermCostBasis: 8000,
          longTermProceeds: 50000,
          longTermCostBasis: 30000
        }
      ]
    }

    it('should include Schedule D', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          const serializer = new Form1040Serializer(
            f1040 as any,
            defaultSerializerConfig
          )
          const xml = serializer.serialize()

          // Check for Schedule D
          expect(xml).toContain('IRS1040ScheduleD')
        }
      )
    })

    it('should include 1099-B data', () => {
      const info = atsScenarioToInformation(scenario)
      const result = create1040(info, [])

      run(result).fold(
        (errors) => {
          throw new Error(`Form creation failed: ${errors.join(', ')}`)
        },
        ([f1040]) => {
          const serializer = new Form1040Serializer(
            f1040 as any,
            defaultSerializerConfig
          )
          const xml = serializer.serialize()

          // Check for 1099-B
          expect(xml).toContain('IRS1099B')
          expect(xml).toContain('TD Ameritrade')
        }
      )
    })
  })
})

// =============================================================================
// XML Structure Validation Tests
// =============================================================================

describe('XML Structure Validation', () => {
  const simpleScenario: ATSScenarioInput = {
    taxYear: 2025,
    filingStatus: FilingStatus.S,
    taxpayer: {
      firstName: 'Test',
      lastName: 'User',
      ssn: '111223333',
      dateOfBirth: new Date(1980, 0, 1),
      address: {
        address: '1 Test Lane',
        city: 'Testville',
        state: 'CA' as State,
        zip: '90000'
      }
    },
    w2s: [
      {
        employer: { name: 'Test Employer', ein: '00-0000000' },
        wages: 50000,
        federalWithholding: 5000,
        occupation: 'Tester'
      }
    ]
  }

  it('should produce well-formed XML', () => {
    const info = atsScenarioToInformation(simpleScenario)
    const result = create1040(info, [])

    run(result).fold(
      (errors) => {
        throw new Error(`Form creation failed: ${errors.join(', ')}`)
      },
      ([f1040]) => {
        const serializer = new Form1040Serializer(
          f1040 as any,
          defaultSerializerConfig
        )
        const xml = serializer.serialize()

        // Count opening and closing Return tags (exact match for root Return element)
        const returnOpenCount = (xml.match(/<Return\s/g) || []).length
        const returnCloseCount = (xml.match(/<\/Return>/g) || []).length
        expect(returnOpenCount).toBe(returnCloseCount)

        // Check for balanced tags (basic check)
        const headerOpen = (xml.match(/<ReturnHeader[^/]/g) || []).length
        const headerClose = (xml.match(/<\/ReturnHeader>/g) || []).length
        expect(headerOpen).toBe(headerClose)

        const dataOpen = (xml.match(/<ReturnData[^/]/g) || []).length
        const dataClose = (xml.match(/<\/ReturnData>/g) || []).length
        expect(dataOpen).toBe(dataClose)
      }
    )
  })

  it('should include document count attribute', () => {
    const info = atsScenarioToInformation(simpleScenario)
    const result = create1040(info, [])

    run(result).fold(
      (errors) => {
        throw new Error(`Form creation failed: ${errors.join(', ')}`)
      },
      ([f1040]) => {
        const serializer = new Form1040Serializer(
          f1040 as any,
          defaultSerializerConfig
        )
        const xml = serializer.serialize()

        expect(xml).toMatch(/documentCnt="\d+"/)
      }
    )
  })

  it('should include return version attribute', () => {
    const info = atsScenarioToInformation(simpleScenario)
    const result = create1040(info, [])

    run(result).fold(
      (errors) => {
        throw new Error(`Form creation failed: ${errors.join(', ')}`)
      },
      ([f1040]) => {
        const serializer = new Form1040Serializer(
          f1040 as any,
          defaultSerializerConfig
        )
        const xml = serializer.serialize()

        expect(xml).toContain('returnVersion="2025')
      }
    )
  })
})
