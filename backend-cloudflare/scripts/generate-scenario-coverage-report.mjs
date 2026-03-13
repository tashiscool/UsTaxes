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

const nodeAtsScenarioDir = path.resolve(
  usTaxesRoot,
  'src',
  'tests',
  'ats',
  'scenarios'
)
const backendAtsTestsDir = path.resolve(backendRoot, 'test', 'ats')
const backendMatrixFixturePath = path.resolve(
  backendRoot,
  'test',
  'fixtures',
  'atsScenarioMatrix.json'
)

const reportsDir = path.resolve(backendRoot, 'reports')
const csvPath = path.resolve(reportsDir, 'scenario_coverage_audit.csv')
const summaryPath = path.resolve(reportsDir, 'scenario_coverage_summary.json')

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

const csvCell = (value) => {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

const toPercent = (numerator, denominator) => {
  if (!denominator) {
    return 0
  }
  return Number(((numerator / denominator) * 100).toFixed(2))
}

const mustExist = (targetPath, label) => {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} not found: ${targetPath}`)
  }
}

mustExist(directFileScenarioDir, 'Direct File ATS scenario directory')
mustExist(nodeAtsScenarioDir, 'UsTaxes Node ATS scenario directory')
mustExist(backendAtsTestsDir, 'Backend ATS test directory')
mustExist(backendMatrixFixturePath, 'Backend ATS matrix fixture')

const scalaScenarioFiles = fs
  .readdirSync(directFileScenarioDir)
  .filter((name) => name.endsWith('.json'))
  .sort((a, b) => a.localeCompare(b))

const scalaByScenario = new Map()
for (const fileName of scalaScenarioFiles) {
  const fullPath = path.join(directFileScenarioDir, fileName)
  const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8'))
  const scenarioId = normalizeScenarioId(raw.scenarioId)
  const existing = scalaByScenario.get(scenarioId) ?? []
  existing.push(fileName)
  scalaByScenario.set(scenarioId, existing)
}

const nodeScenarioFiles = fs
  .readdirSync(nodeAtsScenarioDir)
  .filter((name) => name.endsWith('.test.ts'))
  .sort((a, b) => a.localeCompare(b))

const nodeByScenario = new Map()
for (const fileName of nodeScenarioFiles) {
  const directMatch = fileName.match(/^scenario(\d+)\.test\.ts$/i)
  const nonResidentMatch = fileName.match(/^scenarioNR(\d+)\.test\.ts$/i)

  let scenarioId = null
  if (directMatch) {
    scenarioId = `S${Number(directMatch[1])}`
  } else if (nonResidentMatch) {
    scenarioId = `NR${Number(nonResidentMatch[1])}`
  }

  if (!scenarioId) {
    continue
  }

  const existing = nodeByScenario.get(scenarioId) ?? []
  existing.push(fileName)
  nodeByScenario.set(scenarioId, existing)
}

const backendByScenario = new Map()
const backendAtsFiles = fs
  .readdirSync(backendAtsTestsDir)
  .filter((name) => name.endsWith('.test.ts'))
  .sort((a, b) => a.localeCompare(b))

for (const fileName of backendAtsFiles) {
  const directMatch = fileName.match(/^scenario(\d+)(?:\..+)?\.test\.ts$/i)
  const nonResidentMatch = fileName.match(
    /^scenarioNR(\d+)(?:\..+)?\.test\.ts$/i
  )

  let scenarioId = null
  if (directMatch) {
    scenarioId = `S${Number(directMatch[1])}`
  } else if (nonResidentMatch) {
    scenarioId = `NR${Number(nonResidentMatch[1])}`
  }

  if (!scenarioId) {
    continue
  }

  const existing = backendByScenario.get(scenarioId) ?? []
  existing.push(path.posix.join('test', 'ats', fileName))
  backendByScenario.set(scenarioId, existing)
}

const backendMatrix = JSON.parse(
  fs.readFileSync(backendMatrixFixturePath, 'utf8')
)
for (const row of backendMatrix) {
  const scenarioId = normalizeScenarioId(row.scenarioId)
  const existing = backendByScenario.get(scenarioId) ?? []
  const matrixTestFile = 'test/ats/fullScenarioMatrix.acceptance.test.ts'
  if (!existing.includes(matrixTestFile)) {
    existing.push(matrixTestFile)
  }
  backendByScenario.set(scenarioId, existing)
}

const allScenarioIds = new Set([
  ...scalaByScenario.keys(),
  ...nodeByScenario.keys(),
  ...backendByScenario.keys()
])
const sortedScenarioIds = [...allScenarioIds].sort(compareScenarioIds)

const csvHeader = [
  'scenario_id',
  'in_scala_ats',
  'in_ustaxes_node_ats',
  'backend_cloudflare_tested',
  'scala_files',
  'node_files',
  'backend_test_files',
  'coverage_gap'
]

const csvRows = [csvHeader.join(',')]
for (const scenarioId of sortedScenarioIds) {
  const scalaFiles = scalaByScenario.get(scenarioId) ?? []
  const nodeFiles = nodeByScenario.get(scenarioId) ?? []
  const backendFiles = backendByScenario.get(scenarioId) ?? []

  const inScala = scalaFiles.length > 0
  const inNode = nodeFiles.length > 0
  const inBackend = backendFiles.length > 0
  const gap = (inScala || inNode) && !inBackend

  const row = [
    scenarioId,
    inScala ? 'YES' : 'NO',
    inNode ? 'YES' : 'NO',
    inBackend ? 'YES' : 'NO',
    scalaFiles.join('|'),
    nodeFiles.join('|'),
    backendFiles.join('|'),
    gap ? 'YES' : 'NO'
  ]

  csvRows.push(row.map(csvCell).join(','))
}

const missingInBackend = sortedScenarioIds.filter((scenarioId) => {
  const inScala = (scalaByScenario.get(scenarioId) ?? []).length > 0
  const inNode = (nodeByScenario.get(scenarioId) ?? []).length > 0
  const inBackend = (backendByScenario.get(scenarioId) ?? []).length > 0
  return (inScala || inNode) && !inBackend
})

const onlyInScala = sortedScenarioIds.filter((scenarioId) => {
  const inScala = (scalaByScenario.get(scenarioId) ?? []).length > 0
  const inNode = (nodeByScenario.get(scenarioId) ?? []).length > 0
  return inScala && !inNode
})

const onlyInNode = sortedScenarioIds.filter((scenarioId) => {
  const inScala = (scalaByScenario.get(scenarioId) ?? []).length > 0
  const inNode = (nodeByScenario.get(scenarioId) ?? []).length > 0
  return inNode && !inScala
})

const scalaCount = scalaByScenario.size
const nodeCount = nodeByScenario.size
const backendCount = backendByScenario.size
const unionCount = sortedScenarioIds.length
const backendCoveredInScala = sortedScenarioIds.filter((scenarioId) => {
  const inScala = (scalaByScenario.get(scenarioId) ?? []).length > 0
  const inBackend = (backendByScenario.get(scenarioId) ?? []).length > 0
  return inScala && inBackend
}).length

const backendCoveredInNode = sortedScenarioIds.filter((scenarioId) => {
  const inNode = (nodeByScenario.get(scenarioId) ?? []).length > 0
  const inBackend = (backendByScenario.get(scenarioId) ?? []).length > 0
  return inNode && inBackend
}).length

const backendCoveredInUnion = sortedScenarioIds.filter((scenarioId) => {
  const inUnion =
    (scalaByScenario.get(scenarioId) ?? []).length > 0 ||
    (nodeByScenario.get(scenarioId) ?? []).length > 0
  const inBackend = (backendByScenario.get(scenarioId) ?? []).length > 0
  return inUnion && inBackend
}).length

const summary = {
  generated_at: new Date().toISOString(),
  source_paths: {
    scala_ats_dir: directFileScenarioDir,
    ustaxes_node_ats_dir: nodeAtsScenarioDir,
    backend_ats_dir: backendAtsTestsDir,
    backend_matrix_fixture: backendMatrixFixturePath
  },
  totals: {
    unique_scenarios_union: unionCount,
    scala_ats_scenarios: scalaCount,
    ustaxes_node_ats_scenarios: nodeCount,
    backend_cloudflare_scenarios_tested: backendCount,
    backend_covered_scala_scenarios: backendCoveredInScala,
    backend_covered_node_scenarios: backendCoveredInNode,
    backend_covered_union_scenarios: backendCoveredInUnion
  },
  coverage_percent: {
    backend_vs_scala: toPercent(backendCoveredInScala, scalaCount),
    backend_vs_node: toPercent(backendCoveredInNode, nodeCount),
    backend_vs_union: toPercent(backendCoveredInUnion, unionCount)
  },
  missing_in_backend: missingInBackend,
  differences: {
    only_in_scala: onlyInScala,
    only_in_node: onlyInNode
  },
  fully_covered: missingInBackend.length === 0
}

fs.mkdirSync(reportsDir, { recursive: true })
fs.writeFileSync(csvPath, `${csvRows.join('\n')}\n`, 'utf8')
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')

console.log(
  `Wrote coverage CSV (${sortedScenarioIds.length} scenarios): ${path.relative(
    usTaxesRoot,
    csvPath
  )}`
)
console.log(
  `Wrote coverage summary JSON: ${path.relative(usTaxesRoot, summaryPath)}`
)
