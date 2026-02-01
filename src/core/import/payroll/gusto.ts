/**
 * Gusto Payroll W-2 Parser
 *
 * Parses W-2 export data from Gusto payroll services.
 * Supports Gusto's standard CSV export format.
 *
 * Gusto typically exports W-2 data with clear column headers
 * matching the W-2 box numbers.
 */

import { IncomeW2, State } from 'ustaxes/core/data'
import {
  PayrollParseResult,
  PayrollParser,
  W2ImportData,
  parseSSN,
  parseEIN,
  parseMoney,
  isValidState
} from './types'

/**
 * Gusto column mappings
 */
const GUSTO_COLUMN_MAPPINGS = {
  // Employee info
  employeeSSN: [
    'employee ssn',
    'ssn',
    'social security number',
    'employee social'
  ],
  employeeFirstName: ['first name', 'employee first name', 'first'],
  employeeLastName: ['last name', 'employee last name', 'last'],
  employeeMiddleName: ['middle name', 'middle initial', 'mi'],
  employeeAddress: ['street address', 'address', 'employee address', 'street'],
  employeeCity: ['city', 'employee city'],
  employeeState: ['state', 'employee state'],
  employeeZip: ['zip', 'zip code', 'postal code', 'employee zip'],

  // Employer info
  employerEIN: ['employer ein', 'ein', 'federal ein', 'company ein'],
  employerName: [
    'employer name',
    'company name',
    'employer legal name',
    'business name'
  ],
  employerAddress: ['employer street', 'employer address', 'company address'],
  employerCity: ['employer city', 'company city'],
  employerState: ['employer state', 'company state'],
  employerZip: ['employer zip', 'company zip'],

  // W-2 Boxes - Gusto often uses "Box X" format
  box1: [
    'box 1',
    'wages tips other compensation',
    'federal wages',
    'gross wages'
  ],
  box2: [
    'box 2',
    'federal income tax withheld',
    'federal tax',
    'federal withholding'
  ],
  box3: ['box 3', 'social security wages', 'ss wages'],
  box4: ['box 4', 'social security tax withheld', 'ss tax'],
  box5: ['box 5', 'medicare wages and tips', 'medicare wages'],
  box6: ['box 6', 'medicare tax withheld', 'medicare tax'],
  box7: ['box 7', 'social security tips'],
  box8: ['box 8', 'allocated tips'],
  box10: ['box 10', 'dependent care benefits'],
  box11: ['box 11', 'nonqualified plans'],

  // Box 12 - Gusto typically has separate columns
  box12aCode: ['box 12a code', '12a code'],
  box12aAmount: ['box 12a amount', '12a amount'],
  box12bCode: ['box 12b code', '12b code'],
  box12bAmount: ['box 12b amount', '12b amount'],
  box12cCode: ['box 12c code', '12c code'],
  box12cAmount: ['box 12c amount', '12c amount'],
  box12dCode: ['box 12d code', '12d code'],
  box12dAmount: ['box 12d amount', '12d amount'],

  // Common Box 12 codes as separate columns
  retirement401k: [
    '401k contributions',
    '401k',
    'elective deferrals',
    'box 12d'
  ],
  hsaContributions: ['hsa contributions', 'hsa employer', 'box 12w'],
  healthCoverage: ['health coverage cost', 'health insurance cost', 'box 12dd'],
  rothContributions: ['roth 401k', 'roth contributions', 'box 12aa'],

  // Box 13
  statutory: ['statutory employee', 'box 13 statutory'],
  retirement: ['retirement plan', 'box 13 retirement', 'pension plan'],
  thirdParty: ['third party sick pay', 'box 13 third party'],

  // Box 14
  box14: ['box 14', 'other', 'other amounts'],

  // State info (Box 15-17)
  stateCode: ['state worked', 'w2 state', 'state code'],
  stateID: ['state employer id', 'state id number', 'state ein'],
  stateWages: ['state wages', 'box 16', 'state taxable wages'],
  stateTax: ['state income tax', 'box 17', 'state tax withheld'],

  // Local info (Box 18-20)
  localWages: ['local wages', 'box 18'],
  localTax: ['local income tax', 'box 19', 'local tax withheld'],
  localityName: ['locality name', 'box 20', 'local jurisdiction']
}

/**
 * Find column index
 */
function findColumn(headers: string[], possibleNames: string[]): number {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim())
  for (const name of possibleNames) {
    const index = lowerHeaders.findIndex((h) => h.includes(name.toLowerCase()))
    if (index >= 0) return index
  }
  return -1
}

export class GustoParser implements PayrollParser {
  getProviderName(): string {
    return 'Gusto'
  }

  canParse(content: string, headers: string[]): boolean {
    const headerLine = headers.join(' ').toLowerCase()
    const contentLower = content.toLowerCase()

    // Check for Gusto-specific markers
    const hasGustoMarkers =
      contentLower.includes('gusto') || contentLower.includes('zenpayroll') // Gusto's former name

    // Check for typical Gusto patterns
    const hasGustoPatterns =
      headerLine.includes('box 1') &&
      headerLine.includes('box 2') &&
      (headerLine.includes('employee') || headerLine.includes('ssn'))

    return hasGustoMarkers || hasGustoPatterns
  }

  parse(content: string): PayrollParseResult {
    const w2s: W2ImportData[] = []
    const errors: { row: number; message: string }[] = []
    const warnings: string[] = []

    const rows = this.parseCSV(content)
    if (rows.length < 2) {
      errors.push({ row: 0, message: 'CSV file is empty or has no data rows' })
      return { w2s, errors, warnings }
    }

    // Find header row
    let headerRowIndex = 0
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const rowLower = rows[i].map((c) => c.toLowerCase())
      if (
        rowLower.some((c) => c.includes('box 1') || c.includes('wages')) &&
        rowLower.some((c) => c.includes('ssn') || c.includes('employee'))
      ) {
        headerRowIndex = i
        break
      }
    }

    const headers = rows[headerRowIndex]

    // Map columns
    const columnMap = {
      employeeSSN: findColumn(headers, GUSTO_COLUMN_MAPPINGS.employeeSSN),
      employeeFirstName: findColumn(
        headers,
        GUSTO_COLUMN_MAPPINGS.employeeFirstName
      ),
      employeeLastName: findColumn(
        headers,
        GUSTO_COLUMN_MAPPINGS.employeeLastName
      ),
      employeeMiddleName: findColumn(
        headers,
        GUSTO_COLUMN_MAPPINGS.employeeMiddleName
      ),
      employeeAddress: findColumn(
        headers,
        GUSTO_COLUMN_MAPPINGS.employeeAddress
      ),
      employeeCity: findColumn(headers, GUSTO_COLUMN_MAPPINGS.employeeCity),
      employeeState: findColumn(headers, GUSTO_COLUMN_MAPPINGS.employeeState),
      employeeZip: findColumn(headers, GUSTO_COLUMN_MAPPINGS.employeeZip),
      employerEIN: findColumn(headers, GUSTO_COLUMN_MAPPINGS.employerEIN),
      employerName: findColumn(headers, GUSTO_COLUMN_MAPPINGS.employerName),
      employerAddress: findColumn(
        headers,
        GUSTO_COLUMN_MAPPINGS.employerAddress
      ),
      employerCity: findColumn(headers, GUSTO_COLUMN_MAPPINGS.employerCity),
      employerState: findColumn(headers, GUSTO_COLUMN_MAPPINGS.employerState),
      employerZip: findColumn(headers, GUSTO_COLUMN_MAPPINGS.employerZip),
      box1: findColumn(headers, GUSTO_COLUMN_MAPPINGS.box1),
      box2: findColumn(headers, GUSTO_COLUMN_MAPPINGS.box2),
      box3: findColumn(headers, GUSTO_COLUMN_MAPPINGS.box3),
      box4: findColumn(headers, GUSTO_COLUMN_MAPPINGS.box4),
      box5: findColumn(headers, GUSTO_COLUMN_MAPPINGS.box5),
      box6: findColumn(headers, GUSTO_COLUMN_MAPPINGS.box6),
      box7: findColumn(headers, GUSTO_COLUMN_MAPPINGS.box7),
      box8: findColumn(headers, GUSTO_COLUMN_MAPPINGS.box8),
      box10: findColumn(headers, GUSTO_COLUMN_MAPPINGS.box10),
      box11: findColumn(headers, GUSTO_COLUMN_MAPPINGS.box11),
      box12aCode: findColumn(headers, GUSTO_COLUMN_MAPPINGS.box12aCode),
      box12aAmount: findColumn(headers, GUSTO_COLUMN_MAPPINGS.box12aAmount),
      box12bCode: findColumn(headers, GUSTO_COLUMN_MAPPINGS.box12bCode),
      box12bAmount: findColumn(headers, GUSTO_COLUMN_MAPPINGS.box12bAmount),
      box12cCode: findColumn(headers, GUSTO_COLUMN_MAPPINGS.box12cCode),
      box12cAmount: findColumn(headers, GUSTO_COLUMN_MAPPINGS.box12cAmount),
      box12dCode: findColumn(headers, GUSTO_COLUMN_MAPPINGS.box12dCode),
      box12dAmount: findColumn(headers, GUSTO_COLUMN_MAPPINGS.box12dAmount),
      retirement401k: findColumn(headers, GUSTO_COLUMN_MAPPINGS.retirement401k),
      hsaContributions: findColumn(
        headers,
        GUSTO_COLUMN_MAPPINGS.hsaContributions
      ),
      healthCoverage: findColumn(headers, GUSTO_COLUMN_MAPPINGS.healthCoverage),
      rothContributions: findColumn(
        headers,
        GUSTO_COLUMN_MAPPINGS.rothContributions
      ),
      statutory: findColumn(headers, GUSTO_COLUMN_MAPPINGS.statutory),
      retirement: findColumn(headers, GUSTO_COLUMN_MAPPINGS.retirement),
      thirdParty: findColumn(headers, GUSTO_COLUMN_MAPPINGS.thirdParty),
      box14: findColumn(headers, GUSTO_COLUMN_MAPPINGS.box14),
      stateCode: findColumn(headers, GUSTO_COLUMN_MAPPINGS.stateCode),
      stateID: findColumn(headers, GUSTO_COLUMN_MAPPINGS.stateID),
      stateWages: findColumn(headers, GUSTO_COLUMN_MAPPINGS.stateWages),
      stateTax: findColumn(headers, GUSTO_COLUMN_MAPPINGS.stateTax),
      localWages: findColumn(headers, GUSTO_COLUMN_MAPPINGS.localWages),
      localTax: findColumn(headers, GUSTO_COLUMN_MAPPINGS.localTax),
      localityName: findColumn(headers, GUSTO_COLUMN_MAPPINGS.localityName)
    }

    // Validate
    if (columnMap.box1 < 0) {
      errors.push({
        row: headerRowIndex,
        message: 'Could not find Box 1 (Wages) column'
      })
    }

    // Parse data rows
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i]

      if (row.length === 0 || row.every((c) => c === '')) continue

      try {
        const ssnRaw =
          columnMap.employeeSSN >= 0 ? row[columnMap.employeeSSN] : ''
        const ssn = parseSSN(ssnRaw)

        const einRaw =
          columnMap.employerEIN >= 0 ? row[columnMap.employerEIN] : ''
        const ein = parseEIN(einRaw)

        const wages = columnMap.box1 >= 0 ? parseMoney(row[columnMap.box1]) : 0
        if (wages === 0) continue

        // Build employee name
        const firstName =
          columnMap.employeeFirstName >= 0
            ? row[columnMap.employeeFirstName].trim()
            : ''
        const middleName =
          columnMap.employeeMiddleName >= 0
            ? row[columnMap.employeeMiddleName].trim()
            : ''
        const lastName =
          columnMap.employeeLastName >= 0
            ? row[columnMap.employeeLastName].trim()
            : ''
        const employeeName = [firstName, middleName, lastName]
          .filter(Boolean)
          .join(' ')

        // Build addresses
        const employeeAddress = [
          columnMap.employeeAddress >= 0
            ? row[columnMap.employeeAddress].trim()
            : '',
          columnMap.employeeCity >= 0 ? row[columnMap.employeeCity].trim() : '',
          columnMap.employeeState >= 0
            ? row[columnMap.employeeState].trim()
            : '',
          columnMap.employeeZip >= 0 ? row[columnMap.employeeZip].trim() : ''
        ]
          .filter(Boolean)
          .join(', ')

        const employerAddress = [
          columnMap.employerAddress >= 0
            ? row[columnMap.employerAddress].trim()
            : '',
          columnMap.employerCity >= 0 ? row[columnMap.employerCity].trim() : '',
          columnMap.employerState >= 0
            ? row[columnMap.employerState].trim()
            : '',
          columnMap.employerZip >= 0 ? row[columnMap.employerZip].trim() : ''
        ]
          .filter(Boolean)
          .join(', ')

        // Parse state
        let stateCode: State | undefined
        if (columnMap.stateCode >= 0) {
          const stateRaw = row[columnMap.stateCode].trim().toUpperCase()
          if (isValidState(stateRaw)) {
            stateCode = stateRaw
          }
        }

        // Parse Box 12
        const box12: Array<{ code: string; amount: number }> = []

        // Check specific columns
        if (columnMap.retirement401k >= 0) {
          const amount = parseMoney(row[columnMap.retirement401k])
          if (amount > 0) box12.push({ code: 'D', amount })
        }
        if (columnMap.hsaContributions >= 0) {
          const amount = parseMoney(row[columnMap.hsaContributions])
          if (amount > 0) box12.push({ code: 'W', amount })
        }
        if (columnMap.healthCoverage >= 0) {
          const amount = parseMoney(row[columnMap.healthCoverage])
          if (amount > 0) box12.push({ code: 'DD', amount })
        }
        if (columnMap.rothContributions >= 0) {
          const amount = parseMoney(row[columnMap.rothContributions])
          if (amount > 0) box12.push({ code: 'AA', amount })
        }

        // Check code/amount pairs
        const box12Pairs = [
          { code: columnMap.box12aCode, amount: columnMap.box12aAmount },
          { code: columnMap.box12bCode, amount: columnMap.box12bAmount },
          { code: columnMap.box12cCode, amount: columnMap.box12cAmount },
          { code: columnMap.box12dCode, amount: columnMap.box12dAmount }
        ]

        for (const pair of box12Pairs) {
          if (pair.code >= 0 && pair.amount >= 0) {
            const code = row[pair.code].trim().toUpperCase()
            const amount = parseMoney(row[pair.amount])
            if (code && amount > 0 && !box12.some((b) => b.code === code)) {
              box12.push({ code, amount })
            }
          }
        }

        const w2Data: W2ImportData = {
          employeeSSN: ssn,
          employeeName,
          employeeAddress,
          employerEIN: ein || '',
          employerName:
            columnMap.employerName >= 0
              ? row[columnMap.employerName].trim()
              : '',
          employerAddress,
          wages,
          federalWithholding:
            columnMap.box2 >= 0 ? parseMoney(row[columnMap.box2]) : 0,
          ssWages:
            columnMap.box3 >= 0 ? parseMoney(row[columnMap.box3]) : undefined,
          ssTax:
            columnMap.box4 >= 0 ? parseMoney(row[columnMap.box4]) : undefined,
          medicareWages:
            columnMap.box5 >= 0 ? parseMoney(row[columnMap.box5]) : undefined,
          medicareTax:
            columnMap.box6 >= 0 ? parseMoney(row[columnMap.box6]) : undefined,
          ssTips:
            columnMap.box7 >= 0 ? parseMoney(row[columnMap.box7]) : undefined,
          allocatedTips:
            columnMap.box8 >= 0 ? parseMoney(row[columnMap.box8]) : undefined,
          dependentCareBenefits:
            columnMap.box10 >= 0 ? parseMoney(row[columnMap.box10]) : undefined,
          nonQualifiedPlans:
            columnMap.box11 >= 0 ? parseMoney(row[columnMap.box11]) : undefined,
          box12,
          statutoryEmployee:
            columnMap.statutory >= 0
              ? ['yes', 'true', 'x', '1', 'y'].includes(
                  row[columnMap.statutory].toLowerCase().trim()
                )
              : false,
          retirementPlan:
            columnMap.retirement >= 0
              ? ['yes', 'true', 'x', '1', 'y'].includes(
                  row[columnMap.retirement].toLowerCase().trim()
                )
              : box12.some((b) =>
                  ['D', 'E', 'G', 'H', 'S', 'AA', 'BB', 'EE'].includes(b.code)
                ),
          thirdPartySickPay:
            columnMap.thirdParty >= 0
              ? ['yes', 'true', 'x', '1', 'y'].includes(
                  row[columnMap.thirdParty].toLowerCase().trim()
                )
              : false,
          box14Description:
            columnMap.box14 >= 0 ? row[columnMap.box14].trim() : undefined,
          stateCode,
          stateEmployerID:
            columnMap.stateID >= 0 ? row[columnMap.stateID].trim() : undefined,
          stateWages:
            columnMap.stateWages >= 0
              ? parseMoney(row[columnMap.stateWages])
              : undefined,
          stateTax:
            columnMap.stateTax >= 0
              ? parseMoney(row[columnMap.stateTax])
              : undefined,
          localWages:
            columnMap.localWages >= 0
              ? parseMoney(row[columnMap.localWages])
              : undefined,
          localTax:
            columnMap.localTax >= 0
              ? parseMoney(row[columnMap.localTax])
              : undefined,
          localityName:
            columnMap.localityName >= 0
              ? row[columnMap.localityName].trim()
              : undefined,
          source: 'Gusto'
        }

        w2s.push(w2Data)
      } catch (e) {
        errors.push({
          row: i + 1,
          message: `Error parsing row: ${
            e instanceof Error ? e.message : String(e)
          }`
        })
      }
    }

    return { w2s, errors, warnings }
  }

  toIncomeW2(data: W2ImportData): IncomeW2 {
    return {
      employer: {
        EIN: data.employerEIN,
        employerName: data.employerName,
        address: {
          address: data.employerAddress || '',
          city: '',
          state: undefined,
          zip: undefined
        }
      },
      personRole: 'PRIMARY',
      occupation: '',
      income: data.wages,
      fedWithholding: data.federalWithholding,
      ssWages: data.ssWages,
      ssWithholding: data.ssTax,
      medicareWages: data.medicareWages,
      medicareWithholding: data.medicareTax,
      state: data.stateCode,
      stateWages: data.stateWages,
      stateWithholding: data.stateTax
    }
  }

  private parseCSV(content: string): string[][] {
    const rows: string[][] = []
    let currentRow: string[] = []
    let currentCell = ''
    let inQuotes = false

    for (let i = 0; i < content.length; i++) {
      const char = content[i]
      const nextChar = content[i + 1]

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          currentCell += '"'
          i++
        } else if (char === '"') {
          inQuotes = false
        } else {
          currentCell += char
        }
      } else {
        if (char === '"') {
          inQuotes = true
        } else if (char === ',') {
          currentRow.push(currentCell.trim())
          currentCell = ''
        } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
          currentRow.push(currentCell.trim())
          if (currentRow.some((cell) => cell !== '')) {
            rows.push(currentRow)
          }
          currentRow = []
          currentCell = ''
          if (char === '\r') i++
        } else if (char !== '\r') {
          currentCell += char
        }
      }
    }

    if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell.trim())
      if (currentRow.some((cell) => cell !== '')) {
        rows.push(currentRow)
      }
    }

    return rows
  }
}

export const gustoParser = new GustoParser()
