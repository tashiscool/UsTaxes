/**
 * ADP Payroll W-2 Parser
 *
 * Parses W-2 export data from ADP payroll services.
 * Supports ADP's standard W-2 export formats and year-end tax statements.
 *
 * Typical ADP W-2 fields:
 * - Employee SSN, Name, Address
 * - Employer EIN, Name, Address
 * - W-2 Box values (1-20)
 * - State and local tax information
 */

import { IncomeW2, PersonRole, State } from 'ustaxes/core/data'
import {
  PayrollParseResult,
  PayrollParser,
  W2ImportData,
  parseSSN,
  parseEIN,
  parseMoney
} from './types'

/**
 * ADP column mappings for CSV export
 */
const ADP_COLUMN_MAPPINGS = {
  // Employee info
  employeeSSN: [
    'employee ssn',
    'ssn',
    'employee social security',
    'social security number',
    'emp ssn'
  ],
  employeeFirstName: [
    'employee first name',
    'first name',
    'emp first name',
    'first'
  ],
  employeeLastName: [
    'employee last name',
    'last name',
    'emp last name',
    'last'
  ],
  employeeMiddleInitial: [
    'employee middle initial',
    'middle initial',
    'mi',
    'middle'
  ],

  // Employer info
  employerEIN: [
    'employer ein',
    'ein',
    'employer id',
    'federal ein',
    'employer federal id'
  ],
  employerName: ['employer name', 'company name', 'employer', 'company'],
  employerAddress: ['employer address', 'employer street', 'company address'],
  employerCity: ['employer city', 'company city'],
  employerState: ['employer state', 'company state'],
  employerZip: ['employer zip', 'company zip', 'employer postal code'],

  // W-2 Box values
  box1: [
    'box 1',
    'wages tips other comp',
    'wages',
    'gross wages',
    'federal wages'
  ],
  box2: [
    'box 2',
    'federal income tax withheld',
    'federal tax withheld',
    'fit withheld',
    'federal withholding'
  ],
  box3: ['box 3', 'social security wages', 'ss wages', 'fica wages'],
  box4: [
    'box 4',
    'social security tax withheld',
    'ss tax withheld',
    'fica tax'
  ],
  box5: ['box 5', 'medicare wages and tips', 'medicare wages'],
  box6: ['box 6', 'medicare tax withheld', 'medicare tax'],
  box7: ['box 7', 'social security tips', 'ss tips'],
  box8: ['box 8', 'allocated tips'],
  box10: ['box 10', 'dependent care benefits', 'dcap'],
  box11: ['box 11', 'nonqualified plans', 'nonqualified deferred compensation'],
  box12a: ['box 12a', '12a code', '12a amount', 'code a'],
  box12b: ['box 12b', '12b code', '12b amount', 'code b'],
  box12c: ['box 12c', '12c code', '12c amount', 'code c'],
  box12d: ['box 12d', '12d code', '12d amount', 'code d'],
  box13Statutory: ['box 13 statutory', 'statutory employee', 'statutory'],
  box13Retirement: ['box 13 retirement', 'retirement plan', 'retirement'],
  box13ThirdParty: [
    'box 13 third party',
    'third party sick pay',
    'third party'
  ],
  box14: ['box 14', 'other'],

  // State info
  stateCode: ['state', 'state code', 'state abbrev'],
  stateID: ['state id', 'employer state id', 'state employer id'],
  stateWages: ['state wages', 'state taxable wages', 'state income'],
  stateTax: [
    'state tax withheld',
    'state income tax',
    'sit withheld',
    'state withholding'
  ],

  // Local info
  localWages: ['local wages', 'local taxable wages', 'local income'],
  localTax: ['local tax withheld', 'local income tax', 'local withholding'],
  localityName: [
    'locality name',
    'local name',
    'locality',
    'local jurisdiction'
  ]
}

/**
 * Find column index by checking multiple possible header names
 */
function findColumn(headers: string[], possibleNames: string[]): number {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim())
  for (const name of possibleNames) {
    const index = lowerHeaders.findIndex((h) => h.includes(name.toLowerCase()))
    if (index >= 0) return index
  }
  return -1
}

/**
 * Parse Box 12 code and amount from combined or separate fields
 */
function parseBox12(
  row: string[],
  codeCol: number,
  amountCol?: number
): { code?: string; amount?: number } | undefined {
  if (codeCol < 0 || codeCol >= row.length) return undefined

  const value = row[codeCol].trim()
  if (!value) return undefined

  // Check if it's a combined "Code - Amount" format
  const combinedMatch = value.match(/^([A-Z]{1,2})\s*[-:]\s*\$?([\d,.]+)$/i)
  if (combinedMatch) {
    return {
      code: combinedMatch[1].toUpperCase(),
      amount: parseMoney(combinedMatch[2])
    }
  }

  // Check if it's just a code
  if (/^[A-Z]{1,2}$/i.test(value)) {
    const code = value.toUpperCase()
    const amount =
      amountCol !== undefined && amountCol >= 0 && amountCol < row.length
        ? parseMoney(row[amountCol])
        : undefined
    return { code, amount }
  }

  // Try to parse as amount only
  const amount = parseMoney(value)
  if (amount > 0) {
    return { amount }
  }

  return undefined
}

export class ADPParser implements PayrollParser {
  getProviderName(): string {
    return 'ADP'
  }

  canParse(content: string, headers: string[]): boolean {
    const headerLine = headers.join(' ').toLowerCase()
    const contentLower = content.toLowerCase()

    // Check for ADP-specific markers
    const hasADPMarkers =
      contentLower.includes('adp') ||
      contentLower.includes('automatic data processing')

    // Check for W-2 patterns
    const hasW2Patterns =
      (headerLine.includes('box 1') || headerLine.includes('wages')) &&
      (headerLine.includes('box 2') || headerLine.includes('federal')) &&
      (headerLine.includes('ssn') || headerLine.includes('social security'))

    return hasADPMarkers || hasW2Patterns
  }

  parse(content: string): PayrollParseResult {
    const w2s: W2ImportData[] = []
    const errors: { row: number; message: string }[] = []
    const warnings: string[] = []

    // Parse CSV
    const rows = this.parseCSV(content)
    if (rows.length < 2) {
      errors.push({ row: 0, message: 'CSV file is empty or has no data rows' })
      return { w2s, errors, warnings }
    }

    // Find header row (ADP might have intro text)
    let headerRowIndex = 0
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const rowLower = rows[i].map((c) => c.toLowerCase())
      if (
        rowLower.some(
          (c) => c.includes('ssn') || c.includes('social security')
        ) &&
        rowLower.some((c) => c.includes('wages') || c.includes('box'))
      ) {
        headerRowIndex = i
        break
      }
    }

    const headers = rows[headerRowIndex]

    // Map columns
    const columnMap = {
      employeeSSN: findColumn(headers, ADP_COLUMN_MAPPINGS.employeeSSN),
      employeeFirstName: findColumn(
        headers,
        ADP_COLUMN_MAPPINGS.employeeFirstName
      ),
      employeeLastName: findColumn(
        headers,
        ADP_COLUMN_MAPPINGS.employeeLastName
      ),
      employeeMiddleInitial: findColumn(
        headers,
        ADP_COLUMN_MAPPINGS.employeeMiddleInitial
      ),
      employerEIN: findColumn(headers, ADP_COLUMN_MAPPINGS.employerEIN),
      employerName: findColumn(headers, ADP_COLUMN_MAPPINGS.employerName),
      employerAddress: findColumn(headers, ADP_COLUMN_MAPPINGS.employerAddress),
      employerCity: findColumn(headers, ADP_COLUMN_MAPPINGS.employerCity),
      employerState: findColumn(headers, ADP_COLUMN_MAPPINGS.employerState),
      employerZip: findColumn(headers, ADP_COLUMN_MAPPINGS.employerZip),
      box1: findColumn(headers, ADP_COLUMN_MAPPINGS.box1),
      box2: findColumn(headers, ADP_COLUMN_MAPPINGS.box2),
      box3: findColumn(headers, ADP_COLUMN_MAPPINGS.box3),
      box4: findColumn(headers, ADP_COLUMN_MAPPINGS.box4),
      box5: findColumn(headers, ADP_COLUMN_MAPPINGS.box5),
      box6: findColumn(headers, ADP_COLUMN_MAPPINGS.box6),
      box7: findColumn(headers, ADP_COLUMN_MAPPINGS.box7),
      box8: findColumn(headers, ADP_COLUMN_MAPPINGS.box8),
      box10: findColumn(headers, ADP_COLUMN_MAPPINGS.box10),
      box11: findColumn(headers, ADP_COLUMN_MAPPINGS.box11),
      box12a: findColumn(headers, ADP_COLUMN_MAPPINGS.box12a),
      box12b: findColumn(headers, ADP_COLUMN_MAPPINGS.box12b),
      box12c: findColumn(headers, ADP_COLUMN_MAPPINGS.box12c),
      box12d: findColumn(headers, ADP_COLUMN_MAPPINGS.box12d),
      box13Statutory: findColumn(headers, ADP_COLUMN_MAPPINGS.box13Statutory),
      box13Retirement: findColumn(headers, ADP_COLUMN_MAPPINGS.box13Retirement),
      box13ThirdParty: findColumn(headers, ADP_COLUMN_MAPPINGS.box13ThirdParty),
      box14: findColumn(headers, ADP_COLUMN_MAPPINGS.box14),
      stateCode: findColumn(headers, ADP_COLUMN_MAPPINGS.stateCode),
      stateID: findColumn(headers, ADP_COLUMN_MAPPINGS.stateID),
      stateWages: findColumn(headers, ADP_COLUMN_MAPPINGS.stateWages),
      stateTax: findColumn(headers, ADP_COLUMN_MAPPINGS.stateTax),
      localWages: findColumn(headers, ADP_COLUMN_MAPPINGS.localWages),
      localTax: findColumn(headers, ADP_COLUMN_MAPPINGS.localTax),
      localityName: findColumn(headers, ADP_COLUMN_MAPPINGS.localityName)
    }

    // Validate required columns
    if (columnMap.box1 < 0) {
      errors.push({
        row: headerRowIndex,
        message: 'Could not find Wages (Box 1) column'
      })
    }
    if (columnMap.employerEIN < 0) {
      warnings.push('Employer EIN column not found - will need manual entry')
    }

    // Parse data rows
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i]

      if (row.length === 0 || row.every((c) => c === '')) continue

      try {
        // Parse employee SSN
        const ssnRaw =
          columnMap.employeeSSN >= 0 ? row[columnMap.employeeSSN] : ''
        const ssn = parseSSN(ssnRaw)
        if (!ssn) {
          warnings.push(`Row ${i + 1}: Invalid or missing SSN`)
        }

        // Parse employer EIN
        const einRaw =
          columnMap.employerEIN >= 0 ? row[columnMap.employerEIN] : ''
        const ein = parseEIN(einRaw)

        // Parse wages
        const wages = columnMap.box1 >= 0 ? parseMoney(row[columnMap.box1]) : 0
        if (wages === 0) {
          continue // Skip rows without wages
        }

        // Build employee name
        const firstName =
          columnMap.employeeFirstName >= 0
            ? row[columnMap.employeeFirstName].trim()
            : ''
        const lastName =
          columnMap.employeeLastName >= 0
            ? row[columnMap.employeeLastName].trim()
            : ''
        const middleInitial =
          columnMap.employeeMiddleInitial >= 0
            ? row[columnMap.employeeMiddleInitial].trim()
            : ''
        const employeeName = [firstName, middleInitial, lastName]
          .filter(Boolean)
          .join(' ')

        // Parse state code
        let stateCode: State | undefined
        if (columnMap.stateCode >= 0) {
          const stateRaw = row[columnMap.stateCode].trim().toUpperCase()
          if (stateRaw.length === 2) {
            stateCode = stateRaw as State
          }
        }

        // Build employer address
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

        // Parse Box 12 codes
        const box12: Array<{ code: string; amount: number }> = []
        for (const boxKey of [
          'box12a',
          'box12b',
          'box12c',
          'box12d'
        ] as const) {
          const parsed = parseBox12(row, columnMap[boxKey])
          if (parsed?.code && parsed.amount !== undefined) {
            box12.push({ code: parsed.code, amount: parsed.amount })
          }
        }

        // Parse Box 14 (other) - might be comma-separated key:value pairs
        let box14Description: string | undefined
        let box14Amount: number | undefined
        if (columnMap.box14 >= 0) {
          const box14Raw = row[columnMap.box14].trim()
          if (box14Raw) {
            // Try to parse "Description: $Amount" format
            const match = box14Raw.match(/^(.+?):\s*\$?([\d,.]+)$/)
            if (match) {
              box14Description = match[1].trim()
              box14Amount = parseMoney(match[2])
            } else {
              box14Description = box14Raw
            }
          }
        }

        const w2Data: W2ImportData = {
          employeeSSN: ssn,
          employeeName,
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
            columnMap.box13Statutory >= 0
              ? ['yes', 'true', 'x', '1'].includes(
                  row[columnMap.box13Statutory].toLowerCase().trim()
                )
              : false,
          retirementPlan:
            columnMap.box13Retirement >= 0
              ? ['yes', 'true', 'x', '1'].includes(
                  row[columnMap.box13Retirement].toLowerCase().trim()
                )
              : false,
          thirdPartySickPay:
            columnMap.box13ThirdParty >= 0
              ? ['yes', 'true', 'x', '1'].includes(
                  row[columnMap.box13ThirdParty].toLowerCase().trim()
                )
              : false,
          box14Description,
          box14Amount,
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
          source: 'ADP'
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

  /**
   * Convert parsed W2 import data to the application's IncomeW2 format
   */
  toIncomeW2(data: W2ImportData): IncomeW2 {
    const incomeW2: IncomeW2 = {
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
      personRole: PersonRole.PRIMARY,
      occupation: '',
      income: data.wages,
      medicareIncome: data.medicareWages ?? 0,
      fedWithholding: data.federalWithholding,
      ssWages: data.ssWages ?? 0,
      ssWithholding: data.ssTax ?? 0,
      medicareWithholding: data.medicareTax ?? 0,
      state: data.stateCode,
      stateWages: data.stateWages,
      stateWithholding: data.stateTax
    }

    // Add Box 12 codes
    if (data.box12 && data.box12.length > 0) {
      for (const item of data.box12) {
        if (
          item.code === 'D' ||
          item.code === 'E' ||
          item.code === 'G' ||
          item.code === 'H' ||
          item.code === 'S' ||
          item.code === 'AA' ||
          item.code === 'BB'
        ) {
          // 401k and similar retirement contributions
          incomeW2.box12 = incomeW2.box12 || {}
        }
      }
    }

    return incomeW2
  }

  /**
   * Parse CSV content into rows
   */
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

export const adpParser = new ADPParser()
