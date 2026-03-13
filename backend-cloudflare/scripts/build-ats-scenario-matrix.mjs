#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const backendRoot = path.resolve(__dirname, '..')
const usTaxesRoot = path.resolve(backendRoot, '..')
const defaultDirectFileScenarioDir = path.resolve(
  usTaxesRoot,
  '..',
  'direct-file-easy-webui',
  'direct-file',
  'backend',
  'src',
  'test',
  'resources',
  'ats-scenarios'
)

const directFileScenarioDir = process.env.DIRECT_FILE_ATS_DIR
  ? path.resolve(process.env.DIRECT_FILE_ATS_DIR)
  : defaultDirectFileScenarioDir

const outputPath = path.resolve(
  backendRoot,
  'test',
  'fixtures',
  'atsScenarioMatrix.json'
)

const filingStatusByCode = {
  1: 'single',
  2: 'mfj',
  3: 'mfs',
  4: 'hoh',
  5: 'qss'
}

const OFFICIAL_IRS_ATS_SCENARIOS = new Set([
  'S1',
  'S2',
  'S3',
  'S4',
  'S5',
  'S6',
  'S7',
  'S8',
  'S12',
  'S13',
  'NR1',
  'NR2',
  'NR3',
  'NR4',
  'NR12'
])

const normalizeScenarioId = (rawScenarioId) => {
  const value = String(rawScenarioId).trim().toUpperCase()
  if (/^\d+$/.test(value)) {
    return `S${value}`
  }
  if (/^S\d+$/.test(value)) {
    return value
  }
  if (/^NR-\d+$/.test(value)) {
    return value.replace('-', '')
  }
  if (/^NR\d+$/.test(value)) {
    return value
  }
  return value.replace(/[^A-Z0-9]/g, '')
}

const normalizeFilingStatus = (rawStatus) => {
  if (typeof rawStatus === 'number') {
    const mapped = filingStatusByCode[rawStatus]
    if (!mapped) {
      throw new Error(`Unsupported numeric filing status: ${rawStatus}`)
    }
    return mapped
  }

  if (typeof rawStatus !== 'string') {
    throw new Error(`Unsupported filing status type: ${typeof rawStatus}`)
  }

  const normalized = rawStatus
    .trim()
    .toLowerCase()
    .replace(/[-_\s]/g, '')

  if (normalized === 'single') return 'single'
  if (normalized === 'mfj' || normalized === 'marriedfilingjointly')
    return 'mfj'
  if (normalized === 'mfs' || normalized === 'marriedfilingseparately')
    return 'mfs'
  if (normalized === 'hoh' || normalized === 'headofhousehold') return 'hoh'
  if (normalized === 'qss' || normalized === 'qualifyingsurvivingspouse')
    return 'qss'

  throw new Error(`Unsupported string filing status: ${rawStatus}`)
}

const normalizeFormType = (rawFormType) => {
  if (typeof rawFormType !== 'string') {
    return null
  }

  const compact = rawFormType.trim().toUpperCase().replace(/\s+/g, '')
  if (compact === '1040') return '1040'
  if (compact === '1040NR') return '1040-NR'
  if (compact === '1040SS') return '1040-SS'
  if (compact === '4868') return '4868'
  return null
}

const numberOrNull = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  return value
}

const normalizeAtsTinForOfficialScenario = (scenarioId, primaryTIN) => {
  if (!primaryTIN || !OFFICIAL_IRS_ATS_SCENARIOS.has(scenarioId)) {
    return primaryTIN
  }

  if (!/^\d{9}$/.test(primaryTIN)) {
    return primaryTIN
  }

  return `${primaryTIN.slice(0, 3)}00${primaryTIN.slice(5)}`
}

const scenarioSortKey = (scenarioId) => {
  const match = scenarioId.match(/^(S|NR)(\d+)$/)
  if (!match) {
    return { group: 99, number: Number.MAX_SAFE_INTEGER, id: scenarioId }
  }

  return {
    group: match[1] === 'S' ? 0 : 1,
    number: Number(match[2]),
    id: scenarioId
  }
}

const compareScenarioIds = (leftId, rightId) => {
  const left = scenarioSortKey(leftId)
  const right = scenarioSortKey(rightId)

  if (left.group !== right.group) {
    return left.group - right.group
  }
  if (left.number !== right.number) {
    return left.number - right.number
  }
  return left.id.localeCompare(right.id)
}

if (!fs.existsSync(directFileScenarioDir)) {
  throw new Error(
    `Direct File ATS scenario directory not found: ${directFileScenarioDir}`
  )
}

const scenarioFiles = fs
  .readdirSync(directFileScenarioDir)
  .filter((name) => name.endsWith('.json'))
  .sort((a, b) => a.localeCompare(b))

if (scenarioFiles.length === 0) {
  throw new Error(
    `No ATS scenario JSON files found in: ${directFileScenarioDir}`
  )
}

const matrixEntries = scenarioFiles.map((fileName) => {
  const fullPath = path.join(directFileScenarioDir, fileName)
  const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8'))

  const scenarioId = normalizeScenarioId(raw.scenarioId)
  const filingStatus = normalizeFilingStatus(raw.filingStatus)
  const inferredFormType = fileName.includes('scenario-nr') ? '1040-NR' : null
  const formType = normalizeFormType(raw.formType) ?? inferredFormType
  const ssn = raw.primaryTaxpayer?.ssn ?? raw.primaryFiler?.personSSN ?? null
  const rawPrimaryTIN =
    typeof ssn === 'string' ? ssn.replace(/\D/g, '') || null : null
  const primaryTIN = normalizeAtsTinForOfficialScenario(
    scenarioId,
    rawPrimaryTIN
  )

  const expected = raw.expectedValues ?? {}
  const totalTax = numberOrNull(expected.totalTax)
  const totalPayments = numberOrNull(expected.totalPayments)
  const refund = numberOrNull(expected.refund)
  const amountOwed = numberOrNull(expected.amountOwed)
  const agi = numberOrNull(expected.agi)
  const taxableIncome = numberOrNull(expected.taxableIncome)

  return {
    scenarioId,
    sourceFile: fileName,
    scenarioName: raw.scenarioName ?? raw.description ?? scenarioId,
    taxYear: Number(raw.taxYear),
    filingStatus,
    formType,
    primaryTIN,
    hasSchedule2: raw.hasSchedule2 === true,
    hasSchedule3: raw.hasSchedule3 === true,
    hasScheduleH: raw.hasScheduleH === true,
    dependentCount: Array.isArray(raw.dependents) ? raw.dependents.length : 0,
    w2Count: Array.isArray(raw.w2Forms) ? raw.w2Forms.length : 0,
    form1099RCount: Array.isArray(raw.form1099Rs) ? raw.form1099Rs.length : 0,
    agi,
    taxableIncome,
    totalTax,
    totalPayments,
    refund,
    amountOwed
  }
})

matrixEntries.sort((left, right) =>
  compareScenarioIds(left.scenarioId, right.scenarioId)
)

const duplicates = new Set()
const seenScenarioIds = new Set()
for (const scenario of matrixEntries) {
  if (seenScenarioIds.has(scenario.scenarioId)) {
    duplicates.add(scenario.scenarioId)
  }
  seenScenarioIds.add(scenario.scenarioId)
}

if (duplicates.size > 0) {
  throw new Error(
    `Duplicate scenario IDs detected: ${[...duplicates].join(', ')}`
  )
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(
  outputPath,
  `${JSON.stringify(matrixEntries, null, 2)}\n`,
  'utf8'
)

console.log(
  `Wrote ${matrixEntries.length} ATS scenario vectors to ${path.relative(
    usTaxesRoot,
    outputPath
  )}`
)
console.log(`Source directory: ${directFileScenarioDir}`)
