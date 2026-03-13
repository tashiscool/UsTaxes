import { SchemaValidator } from '../../../src/efile/validation/schemaValidator'

import type { SubmissionPayload, ReturnFormType } from '../domain/types'
import {
  isValidFilingStatus,
  normalizeFilingStatus
} from '../utils/filingStatus'
import { nowIso } from '../utils/time'

export interface MefComplianceReport {
  checkedAt: string
  formType: ReturnFormType
  schemaTrack: 'ats' | 'production'
  returnVersion: string
  xmlValidationErrors: string[]
  fieldValidationErrors: string[]
}

export type MefComplianceResult =
  | {
      valid: true
      xml: string
      report: MefComplianceReport
    }
  | {
      valid: false
      rejectionCode: string
      rejectionMessage: string
      report: MefComplianceReport
    }

const FILING_STATUS_TO_CODE: Record<string, string> = {
  single: '1',
  mfj: '2',
  mfs: '3',
  hoh: '4',
  qss: '5'
}

const FORM_TYPE_TO_RETURN_CODE: Record<ReturnFormType, string> = {
  '1040': '1040',
  '1040-NR': '1040NR',
  '1040-SS': '1040SS',
  '4868': '4868'
}

type MefSchemaTrack = 'ats' | 'production'

interface SchemaReleaseWindow {
  taxYear: number
  returnVersion: string
  atsEffective: string
  productionEffective: string
}

// IRS TY2025 1040/Extensions schema release timeline:
// https://www.irs.gov/e-file-providers/tax-year-2025-modernized-e-file-mef-schemas-and-business-rules-for-individual-tax-returns-and-extensions
const IRS_SCHEMA_RELEASE_WINDOWS: SchemaReleaseWindow[] = [
  {
    taxYear: 2025,
    returnVersion: '2025v5.0',
    atsEffective: '2025-11-26',
    productionEffective: '2026-01-11'
  },
  {
    taxYear: 2025,
    returnVersion: '2025v5.1',
    atsEffective: '2026-01-25',
    productionEffective: '2026-02-08'
  },
  {
    taxYear: 2025,
    returnVersion: '2025v5.2',
    atsEffective: '2026-03-15',
    productionEffective: '2026-03-29'
  }
]

const STATE_CODES = new Set([
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'DC',
  'FL',
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
  'NV',
  'NH',
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
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'AS',
  'GU',
  'MP',
  'PR',
  'VI',
  'AA',
  'AE',
  'AP'
])

const normalizeDigits = (value: string): string => value.replace(/\D/g, '')

const normalizeAmount = (value: number | undefined): string =>
  Number.isFinite(value) ? String(value ?? 0) : '0'

const xmlEscape = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const xmlNode = (name: string, value: string | number): string =>
  `<${name}>${xmlEscape(String(value))}</${name}>`

const xmlContainer = (
  name: string,
  children: string[],
  attributes?: string
): string => {
  const attr = attributes ? ` ${attributes}` : ''
  return `<${name}${attr}>${children.join('')}</${name}>`
}

const xmlErrorsToMessages = (
  errors: { message: string; element?: string }[]
): string[] =>
  errors.map((error) =>
    error.element ? `${error.element}: ${error.message}` : error.message
  )

const toStartOfDay = (dateValue: string): Date =>
  new Date(`${dateValue}T00:00:00.000Z`)

const asDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

const resolveSchemaTrack = (
  metadata: SubmissionPayload['metadata']
): MefSchemaTrack => {
  const requestedTrack = metadata?.mefSchemaTrack
  if (requestedTrack === 'production') {
    return 'production'
  }
  return 'ats'
}

const resolveSchemaAsOfDate = (
  metadata: SubmissionPayload['metadata']
): Date => {
  const explicit = asDate(metadata?.mefSchemaAsOf)
  return explicit ?? new Date()
}

const resolveReturnVersion = (
  taxYear: number,
  track: MefSchemaTrack,
  asOfDate: Date
): string => {
  const windows = IRS_SCHEMA_RELEASE_WINDOWS.filter(
    (window) => window.taxYear === taxYear
  )
  if (windows.length === 0) {
    return `${taxYear}v5.0`
  }

  const effectiveKey =
    track === 'production' ? 'productionEffective' : 'atsEffective'
  const sorted = [...windows].sort(
    (left, right) =>
      toStartOfDay(left[effectiveKey]).getTime() -
      toStartOfDay(right[effectiveKey]).getTime()
  )

  let selected = sorted[0]
  for (const window of sorted) {
    if (toStartOfDay(window[effectiveKey]).getTime() <= asOfDate.getTime()) {
      selected = window
    }
  }

  return selected.returnVersion
}

const invalidResult = (
  rejectionCode: string,
  rejectionMessage: string,
  report: MefComplianceReport
): MefComplianceResult => ({
  valid: false,
  rejectionCode,
  rejectionMessage,
  report
})

const buildMefXml = (
  payload: SubmissionPayload,
  formType: ReturnFormType,
  normalizedTin: string,
  filingStatusCode: string,
  returnVersion: string
): string => {
  const taxYear = payload.taxYear
  const form1040 = payload.form1040 ?? {}
  const totalTax = normalizeAmount(form1040.totalTax)
  const totalPayments = normalizeAmount(form1040.totalPayments)
  const refund = normalizeAmount(form1040.refund)
  const owed = normalizeAmount(form1040.amountOwed)

  const returnHeader = xmlContainer(
    'ReturnHeader',
    [
      xmlNode('ReturnTs', new Date().toISOString()),
      xmlNode('TaxYr', taxYear),
      xmlNode('ReturnTypeCd', FORM_TYPE_TO_RETURN_CODE[formType]),
      xmlContainer('Filer', [xmlNode('PrimarySSN', normalizedTin)])
    ],
    'binaryAttachmentCnt="0"'
  )

  const returnData = xmlContainer(
    'ReturnData',
    [
      xmlContainer('IRS1040', [
        xmlNode('FilingStatusCd', filingStatusCode),
        xmlNode('TotalIncomeAmt', totalTax),
        xmlNode('AdjustedGrossIncomeAmt', totalTax),
        xmlNode('TotalDeductionsAmt', '0'),
        xmlNode('TaxableIncomeAmt', totalTax),
        xmlNode('TaxAmt', totalTax),
        xmlNode('TotalTaxAmt', totalTax),
        xmlNode('TotalPaymentsAmt', totalPayments),
        xmlNode('RefundAmt', refund),
        xmlNode('OwedAmt', owed)
      ])
    ],
    'documentCnt="1"'
  )

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<Return xmlns="http://www.irs.gov/efile" returnVersion="${returnVersion}">`,
    returnHeader,
    returnData,
    '</Return>'
  ].join('')
}

export const validateMefCompliance = async (
  payload: SubmissionPayload
): Promise<MefComplianceResult> => {
  const formType = payload.formType ?? '1040'
  const schemaTrack = resolveSchemaTrack(payload.metadata)
  const schemaAsOf = resolveSchemaAsOfDate(payload.metadata)
  const returnVersion = resolveReturnVersion(
    payload.taxYear,
    schemaTrack,
    schemaAsOf
  )

  const report: MefComplianceReport = {
    checkedAt: nowIso(),
    formType,
    schemaTrack,
    returnVersion,
    xmlValidationErrors: [],
    fieldValidationErrors: []
  }

  const filingStatus = normalizeFilingStatus(payload.filingStatus)
  if (!isValidFilingStatus(filingStatus)) {
    return invalidResult(
      'R0000-058',
      'Rejected: invalid filing status for MeF payload',
      report
    )
  }

  const tin = payload.primaryTIN
  if (!tin) {
    return invalidResult(
      'IND-031',
      'Rejected: primary TIN is required for MeF payload',
      report
    )
  }

  const normalizedTin = normalizeDigits(tin)
  if (!/^\d{9}$/.test(normalizedTin)) {
    return invalidResult(
      'IND-031',
      'Rejected: primary TIN must be exactly 9 digits',
      report
    )
  }

  const strictAtsTin = payload.metadata?.irsAtsStrictTin === true
  if (strictAtsTin && normalizedTin.slice(3, 5) !== '00') {
    return invalidResult(
      'ATS-TIN-00',
      'Rejected: in ATS strict mode, primary TIN must use 00 in digits 4 and 5',
      report
    )
  }

  const stateCode = payload.metadata?.stateCode
  if (typeof stateCode === 'string' && stateCode.trim().length > 0) {
    const normalizedState = stateCode.trim().toUpperCase()
    if (!STATE_CODES.has(normalizedState)) {
      return invalidResult(
        'R0000-905',
        `Rejected: invalid state code "${normalizedState}"`,
        report
      )
    }
  }

  const filingStatusCode = FILING_STATUS_TO_CODE[filingStatus]
  const xml = buildMefXml(
    payload,
    formType,
    normalizedTin,
    filingStatusCode,
    returnVersion
  )
  const validator = new SchemaValidator(payload.taxYear)

  const schemaResult = await validator.validate(xml, 'Form1040')
  if (!schemaResult.valid) {
    report.xmlValidationErrors = xmlErrorsToMessages(schemaResult.errors)
  }

  const fieldErrors = [
    validator.validateFieldValue(normalizedTin, 'SSNType', 'Form1040'),
    validator.validateFieldValue(
      filingStatusCode,
      'FilingStatusType',
      'Form1040'
    ),
    payload.form1040?.totalTax !== undefined
      ? validator.validateFieldValue(
          String(payload.form1040.totalTax),
          'USAmountType',
          'Form1040'
        )
      : null,
    payload.form1040?.totalPayments !== undefined
      ? validator.validateFieldValue(
          String(payload.form1040.totalPayments),
          'USAmountType',
          'Form1040'
        )
      : null
  ].filter((value): value is NonNullable<typeof value> => value !== null)

  if (fieldErrors.length > 0) {
    report.fieldValidationErrors = xmlErrorsToMessages(fieldErrors)
  }

  if (
    report.xmlValidationErrors.length > 0 ||
    report.fieldValidationErrors.length > 0
  ) {
    return invalidResult(
      'XML-SCHEMA-VALIDATION',
      'Rejected: payload failed MeF JSON/XML validation rules',
      report
    )
  }

  return {
    valid: true,
    xml,
    report
  }
}
