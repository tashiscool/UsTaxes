#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const backendRoot = path.resolve(__dirname, '..')
const usTaxesRoot = path.resolve(backendRoot, '..')

const reportsDir = path.resolve(backendRoot, 'reports')
const matrixFixturePath = path.resolve(
  backendRoot,
  'test',
  'fixtures',
  'atsScenarioMatrix.json'
)
const mefCompliancePath = path.resolve(
  backendRoot,
  'src',
  'services',
  'mefComplianceService.ts'
)
const mefComplianceTestPath = path.resolve(
  backendRoot,
  'test',
  'service',
  'mefComplianceService.test.ts'
)
const orchestrationServicePath = path.resolve(
  backendRoot,
  'src',
  'services',
  'submissionOrchestrationService.ts'
)
const orchestrationBehaviorTestPath = path.resolve(
  backendRoot,
  'test',
  'service',
  'orchestration.behavior.test.ts'
)
const cloudflareE2ePath = path.resolve(
  backendRoot,
  'test',
  'worker',
  'cloudflareRuntime.e2e.test.ts'
)
const operationsFeedPath = path.resolve(
  reportsDir,
  'irs_operational_feeds.json'
)

const requirementCsvPath = path.resolve(
  reportsDir,
  'irs_requirements_readiness_matrix.csv'
)
const scenarioCsvPath = path.resolve(
  reportsDir,
  'irs_official_scenario_coverage.csv'
)
const summaryJsonPath = path.resolve(reportsDir, 'irs_readiness_summary.json')

const officialScenarioDocs = [
  {
    scenarioId: 'S1',
    pdfUrl:
      'https://www.irs.gov/pub/irs-utl/ty25-1040-mef-ats-scenario-1-09192024.pdf'
  },
  {
    scenarioId: 'S2',
    pdfUrl:
      'https://www.irs.gov/pub/irs-utl/ty25-1040-mef-ats-scenario-2-09192024.pdf'
  },
  {
    scenarioId: 'S3',
    pdfUrl:
      'https://www.irs.gov/pub/irs-utl/ty25-1040-mef-ats-scenario-3-09192024.pdf'
  },
  {
    scenarioId: 'S4',
    pdfUrl:
      'https://www.irs.gov/pub/irs-utl/ty25-1040-mef-ats-scenario-4-09192024.pdf'
  },
  {
    scenarioId: 'S5',
    pdfUrl:
      'https://www.irs.gov/pub/irs-utl/ty25-1040-mef-ats-scenario-5-09192024.pdf'
  },
  {
    scenarioId: 'S6',
    pdfUrl:
      'https://www.irs.gov/pub/irs-utl/ty25-1040-mef-ats-scenario-6-09192024.pdf'
  },
  {
    scenarioId: 'S7',
    pdfUrl:
      'https://www.irs.gov/pub/irs-utl/ty25-1040-mef-ats-scenario-7-09192024.pdf'
  },
  {
    scenarioId: 'S8',
    pdfUrl:
      'https://www.irs.gov/pub/irs-utl/ty25-1040-mef-ats-scenario-8-09192024.pdf'
  },
  {
    scenarioId: 'S12',
    pdfUrl:
      'https://www.irs.gov/pub/irs-utl/ty25-1040-mef-ats-scenario-12-11272024.pdf'
  },
  {
    scenarioId: 'S13',
    pdfUrl:
      'https://www.irs.gov/pub/irs-utl/ty25-1040-mef-ats-scenario-13-11272024.pdf'
  },
  {
    scenarioId: 'NR1',
    pdfUrl:
      'https://www.irs.gov/pub/irs-utl/ty25-1040nr-mef-ats-scenario-1-09192024.pdf'
  },
  {
    scenarioId: 'NR2',
    pdfUrl:
      'https://www.irs.gov/pub/irs-utl/ty25-1040nr-mef-ats-scenario-2-09192024.pdf'
  },
  {
    scenarioId: 'NR3',
    pdfUrl:
      'https://www.irs.gov/pub/irs-utl/ty25-1040nr-mef-ats-scenario-3-09192024.pdf'
  },
  {
    scenarioId: 'NR4',
    pdfUrl:
      'https://www.irs.gov/pub/irs-utl/ty25-1040nr-mef-ats-scenario-4-09192024.pdf'
  },
  {
    scenarioId: 'NR12',
    pdfUrl:
      'https://www.irs.gov/pub/irs-utl/ty25-1040nr-mef-ats-scenario-12-11272024.pdf'
  }
]

const scenarioSortKey = (scenarioId) => {
  const match = String(scenarioId)
    .trim()
    .toUpperCase()
    .match(/^(S|NR)(\d+)$/)
  if (!match) {
    return {
      group: 99,
      number: Number.MAX_SAFE_INTEGER,
      id: String(scenarioId)
    }
  }

  return {
    group: match[1] === 'S' ? 0 : 1,
    number: Number(match[2]),
    id: String(scenarioId)
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

const csvCell = (value) => {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

const readText = (targetPath) => fs.readFileSync(targetPath, 'utf8')

if (!fs.existsSync(matrixFixturePath)) {
  throw new Error(`ATS matrix fixture not found: ${matrixFixturePath}`)
}

const matrix = JSON.parse(readText(matrixFixturePath))
const matrixById = new Map()
for (const row of matrix) {
  const scenarioId = String(row.scenarioId).toUpperCase()
  matrixById.set(scenarioId, row)
}

const officialById = new Map(
  officialScenarioDocs.map((item) => [item.scenarioId, item])
)
const allScenarioIds = new Set([...officialById.keys(), ...matrixById.keys()])
const sortedScenarioIds = [...allScenarioIds].sort(compareScenarioIds)

const isAtsTin00Compliant = (tin) => {
  if (typeof tin !== 'string') {
    return false
  }
  const digits = tin.replace(/\D/g, '')
  return /^\d{9}$/.test(digits) && digits.slice(3, 5) === '00'
}

const officialMissingInBackend = officialScenarioDocs
  .map((item) => item.scenarioId)
  .filter((scenarioId) => !matrixById.has(scenarioId))

const officialTinMismatches = officialScenarioDocs
  .map((item) => {
    const row = matrixById.get(item.scenarioId)
    if (!row) {
      return null
    }
    return {
      scenarioId: item.scenarioId,
      tin: row.primaryTIN ?? ''
    }
  })
  .filter((item) => item !== null)
  .filter((item) => !isAtsTin00Compliant(item.tin))

const scenarioCsvRows = [
  [
    'scenario_id',
    'official_irs_scenario',
    'official_pdf_url',
    'in_backend_matrix',
    'backend_source_file',
    'backend_primary_tin',
    'ats_strict_tin_00_compliant'
  ].join(',')
]

for (const scenarioId of sortedScenarioIds) {
  const official = officialById.get(scenarioId)
  const matrixRow = matrixById.get(scenarioId)
  const isOfficial = Boolean(official)
  const inBackend = Boolean(matrixRow)
  const tin =
    inBackend && typeof matrixRow.primaryTIN === 'string'
      ? matrixRow.primaryTIN
      : ''
  const strictTinStatus = isOfficial
    ? isAtsTin00Compliant(tin)
      ? 'YES'
      : 'NO'
    : 'N/A'

  scenarioCsvRows.push(
    [
      scenarioId,
      isOfficial ? 'YES' : 'NO',
      official?.pdfUrl ?? '',
      inBackend ? 'YES' : 'NO',
      inBackend ? matrixRow.sourceFile : '',
      tin,
      strictTinStatus
    ]
      .map(csvCell)
      .join(',')
  )
}

const mefComplianceSource = readText(mefCompliancePath)
const mefComplianceTests = readText(mefComplianceTestPath)
const orchestrationSource = readText(orchestrationServicePath)
const orchestrationBehaviorTests = readText(orchestrationBehaviorTestPath)
const cloudflareE2eTests = readText(cloudflareE2ePath)

const hasSchemaWindowLogic =
  mefComplianceSource.includes('IRS_SCHEMA_RELEASE_WINDOWS') &&
  mefComplianceSource.includes('2025v5.2') &&
  mefComplianceSource.includes('resolveReturnVersion')

const hasSchemaTrackSupport =
  mefComplianceSource.includes('mefSchemaTrack') &&
  mefComplianceSource.includes('production')

const hasReturnVersionTests =
  mefComplianceTests.includes('switches to the next ATS returnVersion') &&
  mefComplianceTests.includes(
    'resolves production track versions independently'
  )

const hasStrictTinLogic = mefComplianceSource.includes('ATS-TIN-00')
const hasStrictTinTests = mefComplianceTests.includes(
  'enforces ATS strict TIN 00 rule'
)
const hasResiliencyModeLogic =
  orchestrationSource.includes('mefOperationalMode') &&
  orchestrationSource.includes('MeF resiliency mode active')
const hasResiliencyModeTests = orchestrationBehaviorTests.includes(
  'requeues once when MeF resiliency mode is active'
)
const hasCloudflareE2e = cloudflareE2eTests.includes(
  'Cloudflare runtime integration'
)

const operationsFeed = fs.existsSync(operationsFeedPath)
  ? JSON.parse(readText(operationsFeedPath))
  : null

const hasKnownIssuesFeedTracking = Boolean(
  operationsFeed?.sources?.known_issues_page?.ok &&
    operationsFeed?.known_issues?.workbookLinkCount > 0 &&
    operationsFeed?.known_issues?.ty2025WorkbookUrl
)

const hasMefStatusSignals = Boolean(
  operationsFeed?.sources?.mef_status_page?.ok &&
    operationsFeed?.mef_status?.hasResiliencyLanguage &&
    operationsFeed?.mef_status?.hasGetAckUnavailableLanguage
)

const requirements = [
  {
    requirement_id: 'REQ-ATS-SCENARIO-COVERAGE',
    category: 'IRS ATS',
    status: officialMissingInBackend.length === 0 ? 'PASS' : 'GAP',
    source_url:
      'https://www.irs.gov/e-file-providers/tax-year-2025-form-1040-series-and-extensions-modernized-e-file-mef-assurance-testing-system-ats-information',
    requirement:
      'Cover all official TY2025 ATS scenario IDs in automated backend tests.',
    evidence:
      officialMissingInBackend.length === 0
        ? `Covered ${officialScenarioDocs.length}/${officialScenarioDocs.length} official scenarios`
        : `Missing official scenarios: ${officialMissingInBackend.join('|')}`,
    implementation_artifacts:
      'test/fixtures/atsScenarioMatrix.json|test/ats/fullScenarioMatrix.acceptance.test.ts'
  },
  {
    requirement_id: 'REQ-ATS-STRICT-TIN-VALIDATION',
    category: 'IRS ATS',
    status: hasStrictTinLogic && hasStrictTinTests ? 'PASS' : 'GAP',
    source_url: 'https://www.irs.gov/pub/irs-pdf/p1436.pdf',
    requirement:
      'In ATS test mode, enforce primary TIN/SSN test pattern with 00 in digits 4 and 5.',
    evidence:
      hasStrictTinLogic && hasStrictTinTests
        ? 'ATS strict TIN rule implemented and unit-tested'
        : 'ATS strict TIN rule is missing from backend validator and/or tests',
    implementation_artifacts:
      'src/services/mefComplianceService.ts|test/service/mefComplianceService.test.ts'
  },
  {
    requirement_id: 'REQ-ATS-FIXTURE-TIN-COMPLIANCE',
    category: 'IRS ATS',
    status: officialTinMismatches.length === 0 ? 'PASS' : 'GAP',
    source_url: 'https://www.irs.gov/pub/irs-pdf/p1436.pdf',
    requirement:
      'Official ATS scenario fixtures should use 00 in TIN digits 4 and 5.',
    evidence:
      officialTinMismatches.length === 0
        ? 'All official ATS scenario vectors satisfy the strict TIN rule'
        : `Non-compliant official scenario vectors: ${officialTinMismatches
            .map((item) => `${item.scenarioId}:${item.tin}`)
            .join('|')}`,
    implementation_artifacts: 'test/fixtures/atsScenarioMatrix.json'
  },
  {
    requirement_id: 'REQ-MEF-RETURN-VERSION-SCHEDULE',
    category: 'IRS MeF Schema',
    status: hasSchemaWindowLogic && hasReturnVersionTests ? 'PASS' : 'GAP',
    source_url:
      'https://www.irs.gov/e-file-providers/tax-year-2025-modernized-e-file-mef-schemas-and-business-rules-for-individual-tax-returns-and-extensions',
    requirement:
      'Select returnVersion using IRS ATS/Production effective-date windows (TY2025 v5.0/v5.1/v5.2).',
    evidence:
      hasSchemaWindowLogic && hasReturnVersionTests
        ? 'Effective-date schema schedule implemented with test coverage'
        : 'Schema returnVersion schedule logic and/or tests are missing',
    implementation_artifacts:
      'src/services/mefComplianceService.ts|test/service/mefComplianceService.test.ts'
  },
  {
    requirement_id: 'REQ-MEF-SCHEMA-TRACK',
    category: 'IRS MeF Schema',
    status: hasSchemaTrackSupport && hasReturnVersionTests ? 'PASS' : 'GAP',
    source_url:
      'https://www.irs.gov/e-file-providers/tax-year-2025-modernized-e-file-mef-schemas-and-business-rules-for-individual-tax-returns-and-extensions',
    requirement:
      'Support ATS and production schema tracks independently for compatibility testing.',
    evidence:
      hasSchemaTrackSupport && hasReturnVersionTests
        ? 'Schema track switch (ats|production) implemented and tested'
        : 'Schema track support and/or tests are missing',
    implementation_artifacts:
      'src/services/mefComplianceService.ts|test/service/mefComplianceService.test.ts'
  },
  {
    requirement_id: 'REQ-MEF-KNOWN-ISSUES-FEED',
    category: 'IRS Operations',
    status: hasKnownIssuesFeedTracking ? 'PASS' : 'GAP',
    source_url:
      'https://www.irs.gov/e-file-providers/known-issues-and-solutions',
    requirement:
      'Ingest or track IRS known-issues workbooks as a gating signal for CI/test baselines.',
    evidence: hasKnownIssuesFeedTracking
      ? `Operational feed sync captured known-issues workbook links (TY2025: ${operationsFeed.known_issues.ty2025WorkbookUrl})`
      : 'IRS known-issues feed sync has not produced a TY2025 workbook snapshot yet',
    implementation_artifacts:
      'scripts/sync-irs-operational-feeds.mjs|reports/irs_operational_feeds.json'
  },
  {
    requirement_id: 'REQ-MEF-STATUS-RESILIENCY',
    category: 'IRS Operations',
    status:
      hasResiliencyModeLogic && hasResiliencyModeTests && hasMefStatusSignals
        ? 'PASS'
        : 'GAP',
    source_url:
      'https://www.irs.gov/e-file-providers/modernized-e-file-mef-status',
    requirement:
      'Model MeF operational/resiliency mode behavior in backend integration tests where applicable.',
    evidence:
      hasResiliencyModeLogic && hasResiliencyModeTests && hasMefStatusSignals
        ? 'Resiliency-mode retry behavior implemented and tested; IRS status feed signals captured'
        : 'Resiliency-mode logic/tests and/or IRS status feed signals are missing',
    implementation_artifacts:
      'src/services/submissionOrchestrationService.ts|test/service/orchestration.behavior.test.ts|reports/irs_operational_feeds.json'
  },
  {
    requirement_id: 'REQ-CF-WORKER-E2E',
    category: 'Cloudflare Runtime',
    status: hasCloudflareE2e ? 'PASS' : 'GAP',
    source_url: 'https://developers.cloudflare.com/workers/',
    requirement:
      'Run end-to-end backend tests on local Cloudflare Worker runtime (D1/R2/DO/Queues).',
    evidence: hasCloudflareE2e
      ? 'Worker runtime integration suite present in backend test tree'
      : 'Worker runtime integration suite is missing',
    implementation_artifacts: 'test/worker/cloudflareRuntime.e2e.test.ts'
  }
]

const requirementCsvRows = [
  [
    'requirement_id',
    'category',
    'status',
    'source_url',
    'requirement',
    'evidence',
    'implementation_artifacts'
  ].join(',')
]

for (const row of requirements) {
  requirementCsvRows.push(
    [
      row.requirement_id,
      row.category,
      row.status,
      row.source_url,
      row.requirement,
      row.evidence,
      row.implementation_artifacts
    ]
      .map(csvCell)
      .join(',')
  )
}

const statusCounts = requirements.reduce((accumulator, requirement) => {
  accumulator[requirement.status] = (accumulator[requirement.status] ?? 0) + 1
  return accumulator
}, /** @type {Record<string, number>} */ ({}))

const summary = {
  generated_at: new Date().toISOString(),
  source_paths: {
    matrix_fixture: matrixFixturePath,
    mef_compliance_service: mefCompliancePath,
    mef_compliance_tests: mefComplianceTestPath,
    submission_orchestration_service: orchestrationServicePath,
    orchestration_behavior_tests: orchestrationBehaviorTestPath,
    cloudflare_e2e_tests: cloudflareE2ePath
  },
  official_ats_scenarios: officialScenarioDocs.length,
  official_ats_covered_in_backend:
    officialScenarioDocs.length - officialMissingInBackend.length,
  official_ats_missing_in_backend: officialMissingInBackend,
  official_ats_tin_non_compliant: officialTinMismatches,
  has_operations_feed_snapshot: Boolean(operationsFeed),
  requirements_total: requirements.length,
  requirement_status_counts: statusCounts
}

fs.mkdirSync(reportsDir, { recursive: true })
fs.writeFileSync(scenarioCsvPath, `${scenarioCsvRows.join('\n')}\n`, 'utf8')
fs.writeFileSync(
  requirementCsvPath,
  `${requirementCsvRows.join('\n')}\n`,
  'utf8'
)
fs.writeFileSync(
  summaryJsonPath,
  `${JSON.stringify(summary, null, 2)}\n`,
  'utf8'
)

console.log(
  `Wrote IRS official scenario coverage CSV: ${path.relative(
    usTaxesRoot,
    scenarioCsvPath
  )}`
)
console.log(
  `Wrote IRS requirement readiness CSV: ${path.relative(
    usTaxesRoot,
    requirementCsvPath
  )}`
)
console.log(
  `Wrote IRS readiness summary JSON: ${path.relative(
    usTaxesRoot,
    summaryJsonPath
  )}`
)
