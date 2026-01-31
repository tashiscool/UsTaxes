/**
 * Paychex Payroll W-2 Parser
 *
 * Parses W-2 export data from Paychex payroll services.
 * Supports Paychex Flex export formats and year-end tax statements.
 *
 * Paychex W-2 exports typically include:
 * - Employee demographics
 * - Employer information
 * - Federal, state, and local tax data
 * - Box 12 coded amounts
 */

import { IncomeW2, State } from 'ustaxes/core/data'
import { PayrollParseResult, PayrollParser, W2ImportData, parseSSN, parseEIN, parseMoney, isValidState } from './types'

/**
 * Paychex column mappings
 */
const PAYCHEX_COLUMN_MAPPINGS = {
  // Employee info
  employeeSSN: ['employee ssn', 'ssn', 'social security', 'emp ssn', 'ee ssn'],
  employeeFirstName: ['first name', 'emp first name', 'employee first'],
  employeeLastName: ['last name', 'emp last name', 'employee last'],
  employeeName: ['employee name', 'emp name', 'full name'],
  employeeAddress: ['employee address', 'emp address', 'address'],
  employeeCity: ['employee city', 'emp city', 'city'],
  employeeState: ['employee state', 'emp state'],
  employeeZip: ['employee zip', 'emp zip', 'zip code', 'postal code'],

  // Employer info
  employerEIN: ['employer ein', 'ein', 'fein', 'federal ein', 'employer id'],
  employerName: ['employer name', 'company name', 'employer legal name'],
  employerAddress: ['employer address', 'company address', 'er address'],
  employerCity: ['employer city', 'company city', 'er city'],
  employerState: ['employer state', 'company state', 'er state'],
  employerZip: ['employer zip', 'company zip', 'er zip'],

  // W-2 Boxes
  box1: ['box 1', 'wages', 'federal wages', 'gross pay', 'taxable wages'],
  box2: ['box 2', 'federal tax withheld', 'federal withholding', 'fit', 'fed tax'],
  box3: ['box 3', 'ss wages', 'social security wages', 'fica wages'],
  box4: ['box 4', 'ss tax', 'social security tax', 'fica tax', 'ss withheld'],
  box5: ['box 5', 'medicare wages', 'med wages'],
  box6: ['box 6', 'medicare tax', 'med tax', 'medicare withheld'],
  box7: ['box 7', 'ss tips', 'social security tips'],
  box8: ['box 8', 'allocated tips'],
  box10: ['box 10', 'dependent care', 'dcap', 'dependent care benefits'],
  box11: ['box 11', 'nonqualified', 'nqdc', 'nonqualified plans'],

  // Box 12 - Paychex often has separate columns for each code
  box12Code: ['box 12 code', '12 code', 'code 12'],
  box12Amount: ['box 12 amount', '12 amount', 'amount 12'],
  box12D: ['401k', '401(k)', 'box 12d', '12d', 'elective deferrals'],
  box12W: ['hsa', 'hsa employer', 'box 12w', '12w'],
  box12DD: ['health coverage', 'health cost', 'box 12dd', '12dd'],

  // Box 13
  statutory: ['statutory employee', 'statutory', 'box 13 statutory'],
  retirement: ['retirement plan', 'retirement', 'box 13 retirement', 'pension'],
  thirdParty: ['third party sick', 'third party', 'box 13 third party'],

  // Box 14
  box14: ['box 14', 'other', 'other deductions'],

  // State
  stateCode: ['state', 'state code', 'work state', 'state abbrev'],
  stateEIN: ['state ein', 'state id', 'state employer id', 'sui id'],
  stateWages: ['state wages', 'state taxable wages', 'sit wages'],
  stateTax: ['state tax', 'state withheld', 'sit', 'state income tax'],

  // Local
  localWages: ['local wages', 'local taxable', 'lit wages'],
  localTax: ['local tax', 'local withheld', 'lit', 'local income tax'],
  localityName: ['locality', 'local name', 'municipality', 'local jurisdiction']
}

/**
 * Find column index by checking multiple possible header names
 */
function findColumn(headers: string[], possibleNames: string[]): number {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim())
  for (const name of possibleNames) {
    const index = lowerHeaders.findIndex(h => h.includes(name.toLowerCase()))
    if (index >= 0) return index
  }
  return -1
}

export class PaychexParser implements PayrollParser {
  getProviderName(): string {
    return 'Paychex'
  }

  canParse(content: string, headers: string[]): boolean {
    const headerLine = headers.join(' ').toLowerCase()
    const contentLower = content.toLowerCase()

    // Check for Paychex-specific markers
    const hasPaychexMarkers =
      contentLower.includes('paychex') ||
      contentLower.includes('flex') ||
      (headerLine.includes('ee ssn') || headerLine.includes('er ein'))

    // Check for typical Paychex column patterns
    const hasPaychexPatterns =
      headerLine.includes('employer') &&
      headerLine.includes('employee') &&
      (headerLine.includes('wages') || headerLine.includes('box'))

    return hasPaychexMarkers || hasPaychexPatterns
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
      const rowLower = rows[i].map(c => c.toLowerCase())
      if (
        rowLower.some(c => c.includes('ssn') || c.includes('employee')) &&
        rowLower.some(c => c.includes('wages') || c.includes('ein'))
      ) {
        headerRowIndex = i
        break
      }
    }

    const headers = rows[headerRowIndex]

    // Map columns
    const columnMap = {
      employeeSSN: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.employeeSSN),
      employeeFirstName: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.employeeFirstName),
      employeeLastName: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.employeeLastName),
      employeeName: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.employeeName),
      employeeAddress: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.employeeAddress),
      employeeCity: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.employeeCity),
      employeeState: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.employeeState),
      employeeZip: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.employeeZip),
      employerEIN: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.employerEIN),
      employerName: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.employerName),
      employerAddress: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.employerAddress),
      employerCity: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.employerCity),
      employerState: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.employerState),
      employerZip: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.employerZip),
      box1: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.box1),
      box2: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.box2),
      box3: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.box3),
      box4: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.box4),
      box5: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.box5),
      box6: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.box6),
      box7: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.box7),
      box8: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.box8),
      box10: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.box10),
      box11: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.box11),
      box12Code: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.box12Code),
      box12Amount: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.box12Amount),
      box12D: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.box12D),
      box12W: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.box12W),
      box12DD: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.box12DD),
      statutory: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.statutory),
      retirement: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.retirement),
      thirdParty: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.thirdParty),
      box14: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.box14),
      stateCode: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.stateCode),
      stateEIN: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.stateEIN),
      stateWages: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.stateWages),
      stateTax: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.stateTax),
      localWages: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.localWages),
      localTax: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.localTax),
      localityName: findColumn(headers, PAYCHEX_COLUMN_MAPPINGS.localityName)
    }

    // Validate required columns
    if (columnMap.box1 < 0) {
      errors.push({ row: headerRowIndex, message: 'Could not find Wages column' })
    }

    // Parse data rows
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i]

      if (row.length === 0 || row.every(c => c === '')) continue

      try {
        // Parse employee info
        const ssnRaw = columnMap.employeeSSN >= 0 ? row[columnMap.employeeSSN] : ''
        const ssn = parseSSN(ssnRaw)

        // Parse employer EIN
        const einRaw = columnMap.employerEIN >= 0 ? row[columnMap.employerEIN] : ''
        const ein = parseEIN(einRaw)

        // Parse wages
        const wages = columnMap.box1 >= 0 ? parseMoney(row[columnMap.box1]) : 0
        if (wages === 0) continue

        // Build employee name
        let employeeName = ''
        if (columnMap.employeeName >= 0) {
          employeeName = row[columnMap.employeeName].trim()
        } else {
          const firstName = columnMap.employeeFirstName >= 0 ? row[columnMap.employeeFirstName].trim() : ''
          const lastName = columnMap.employeeLastName >= 0 ? row[columnMap.employeeLastName].trim() : ''
          employeeName = [firstName, lastName].filter(Boolean).join(' ')
        }

        // Build employee address
        const employeeAddress = [
          columnMap.employeeAddress >= 0 ? row[columnMap.employeeAddress].trim() : '',
          columnMap.employeeCity >= 0 ? row[columnMap.employeeCity].trim() : '',
          columnMap.employeeState >= 0 ? row[columnMap.employeeState].trim() : '',
          columnMap.employeeZip >= 0 ? row[columnMap.employeeZip].trim() : ''
        ].filter(Boolean).join(', ')

        // Build employer address
        const employerAddress = [
          columnMap.employerAddress >= 0 ? row[columnMap.employerAddress].trim() : '',
          columnMap.employerCity >= 0 ? row[columnMap.employerCity].trim() : '',
          columnMap.employerState >= 0 ? row[columnMap.employerState].trim() : '',
          columnMap.employerZip >= 0 ? row[columnMap.employerZip].trim() : ''
        ].filter(Boolean).join(', ')

        // Parse state code
        let stateCode: State | undefined
        if (columnMap.stateCode >= 0) {
          const stateRaw = row[columnMap.stateCode].trim().toUpperCase()
          if (isValidState(stateRaw)) {
            stateCode = stateRaw
          }
        }

        // Parse Box 12 codes
        const box12: Array<{ code: string; amount: number }> = []

        // Check for specific Box 12 columns (D, W, DD)
        if (columnMap.box12D >= 0) {
          const amount = parseMoney(row[columnMap.box12D])
          if (amount > 0) box12.push({ code: 'D', amount })
        }
        if (columnMap.box12W >= 0) {
          const amount = parseMoney(row[columnMap.box12W])
          if (amount > 0) box12.push({ code: 'W', amount })
        }
        if (columnMap.box12DD >= 0) {
          const amount = parseMoney(row[columnMap.box12DD])
          if (amount > 0) box12.push({ code: 'DD', amount })
        }

        // Check for generic Box 12 code/amount columns
        if (columnMap.box12Code >= 0 && columnMap.box12Amount >= 0) {
          const code = row[columnMap.box12Code].trim().toUpperCase()
          const amount = parseMoney(row[columnMap.box12Amount])
          if (code && amount > 0 && !box12.some(b => b.code === code)) {
            box12.push({ code, amount })
          }
        }

        const w2Data: W2ImportData = {
          employeeSSN: ssn,
          employeeName,
          employeeAddress,
          employerEIN: ein || '',
          employerName: columnMap.employerName >= 0 ? row[columnMap.employerName].trim() : '',
          employerAddress,
          wages,
          federalWithholding: columnMap.box2 >= 0 ? parseMoney(row[columnMap.box2]) : 0,
          ssWages: columnMap.box3 >= 0 ? parseMoney(row[columnMap.box3]) : undefined,
          ssTax: columnMap.box4 >= 0 ? parseMoney(row[columnMap.box4]) : undefined,
          medicareWages: columnMap.box5 >= 0 ? parseMoney(row[columnMap.box5]) : undefined,
          medicareTax: columnMap.box6 >= 0 ? parseMoney(row[columnMap.box6]) : undefined,
          ssTips: columnMap.box7 >= 0 ? parseMoney(row[columnMap.box7]) : undefined,
          allocatedTips: columnMap.box8 >= 0 ? parseMoney(row[columnMap.box8]) : undefined,
          dependentCareBenefits: columnMap.box10 >= 0 ? parseMoney(row[columnMap.box10]) : undefined,
          nonQualifiedPlans: columnMap.box11 >= 0 ? parseMoney(row[columnMap.box11]) : undefined,
          box12,
          statutoryEmployee: columnMap.statutory >= 0 ?
            ['yes', 'true', 'x', '1', 'y'].includes(row[columnMap.statutory].toLowerCase().trim()) : false,
          retirementPlan: columnMap.retirement >= 0 ?
            ['yes', 'true', 'x', '1', 'y'].includes(row[columnMap.retirement].toLowerCase().trim()) : false,
          thirdPartySickPay: columnMap.thirdParty >= 0 ?
            ['yes', 'true', 'x', '1', 'y'].includes(row[columnMap.thirdParty].toLowerCase().trim()) : false,
          box14Description: columnMap.box14 >= 0 ? row[columnMap.box14].trim() : undefined,
          stateCode,
          stateEmployerID: columnMap.stateEIN >= 0 ? row[columnMap.stateEIN].trim() : undefined,
          stateWages: columnMap.stateWages >= 0 ? parseMoney(row[columnMap.stateWages]) : undefined,
          stateTax: columnMap.stateTax >= 0 ? parseMoney(row[columnMap.stateTax]) : undefined,
          localWages: columnMap.localWages >= 0 ? parseMoney(row[columnMap.localWages]) : undefined,
          localTax: columnMap.localTax >= 0 ? parseMoney(row[columnMap.localTax]) : undefined,
          localityName: columnMap.localityName >= 0 ? row[columnMap.localityName].trim() : undefined,
          source: 'Paychex'
        }

        w2s.push(w2Data)
      } catch (e) {
        errors.push({ row: i + 1, message: `Error parsing row: ${e instanceof Error ? e.message : String(e)}` })
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
          if (currentRow.some(cell => cell !== '')) {
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
      if (currentRow.some(cell => cell !== '')) {
        rows.push(currentRow)
      }
    }

    return rows
  }
}

export const paychexParser = new PaychexParser()
