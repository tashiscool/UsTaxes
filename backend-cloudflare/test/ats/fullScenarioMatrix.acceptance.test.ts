/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import type { SubmissionPayload } from '../../src/domain/types'
import { ApiService } from '../../src/services/apiService'
import { SubmissionOrchestrationService } from '../../src/services/submissionOrchestrationService'
import {
  asQueue,
  InMemoryArtifactStore,
  InMemoryQueue,
  InMemoryTaxRepository
} from '../support/inMemoryAdapters'

interface AtsScenarioVector {
  scenarioId: string
  sourceFile: string
  scenarioName: string
  taxYear: number
  filingStatus: string
  formType: '1040' | '1040-NR' | '1040-SS' | '4868' | null
  primaryTIN: string | null
  hasSchedule2: boolean
  hasSchedule3: boolean
  hasScheduleH: boolean
  dependentCount: number
  w2Count: number
  form1099RCount: number
  agi: number | null
  taxableIncome: number | null
  totalTax: number | null
  totalPayments: number | null
  refund: number | null
  amountOwed: number | null
}

const loadScenarioMatrix = (): AtsScenarioVector[] => {
  const currentFile = fileURLToPath(import.meta.url)
  const fixturePath = join(
    dirname(currentFile),
    '..',
    'fixtures',
    'atsScenarioMatrix.json'
  )

  return JSON.parse(readFileSync(fixturePath, 'utf8')) as AtsScenarioVector[]
}

const toPayload = (scenario: AtsScenarioVector): SubmissionPayload => {
  const form1040 =
    scenario.totalTax !== null ||
    scenario.totalPayments !== null ||
    scenario.refund !== null ||
    scenario.amountOwed !== null
      ? {
          totalTax: scenario.totalTax ?? undefined,
          totalPayments: scenario.totalPayments ?? undefined,
          refund: scenario.refund ?? undefined,
          amountOwed: scenario.amountOwed ?? undefined
        }
      : undefined

  return {
    taxYear: scenario.taxYear,
    primaryTIN: scenario.primaryTIN ?? undefined,
    filingStatus: scenario.filingStatus,
    formType: scenario.formType ?? undefined,
    form1040,
    forms: {
      Schedule2: scenario.hasSchedule2,
      Schedule3: scenario.hasSchedule3,
      ScheduleH: scenario.hasScheduleH
    },
    metadata: {
      scenarioId: scenario.scenarioId,
      sourceFile: scenario.sourceFile,
      scenarioName: scenario.scenarioName,
      expectedValues: {
        totalTax: scenario.totalTax ?? undefined,
        totalPayments: scenario.totalPayments ?? undefined,
        refund: scenario.refund ?? undefined,
        amountOwed: scenario.amountOwed ?? undefined
      },
      agi: scenario.agi ?? undefined,
      taxableIncome: scenario.taxableIncome ?? undefined,
      dependentCount: scenario.dependentCount,
      w2Count: scenario.w2Count,
      form1099RCount: scenario.form1099RCount
    }
  }
}

const scenarioMatrix = loadScenarioMatrix()

describe('ATS scenario matrix - backend acceptance', () => {
  it('loads all Direct File ATS scenarios into local test matrix', () => {
    const scenarioIds = new Set(
      scenarioMatrix.map((scenario) => scenario.scenarioId)
    )
    expect(scenarioIds.size).toBe(scenarioMatrix.length)
    expect(scenarioMatrix.length).toBeGreaterThanOrEqual(36)
  })

  it.each(scenarioMatrix)(
    'accepts $scenarioId ($scenarioName)',
    async (scenario: AtsScenarioVector) => {
      const repository = new InMemoryTaxRepository()
      const artifacts = new InMemoryArtifactStore()
      const queue = new InMemoryQueue()

      const api = new ApiService(repository, artifacts, asQueue(queue))
      const orchestration = new SubmissionOrchestrationService(
        repository,
        artifacts
      )

      const created = await api.createReturn({
        taxYear: scenario.taxYear,
        filingStatus: scenario.filingStatus,
        facts: {
          scenarioId: scenario.scenarioId,
          sourceFile: scenario.sourceFile,
          primaryTIN: scenario.primaryTIN
        }
      })

      const submit = await api.submitReturn(created.taxReturn.id, {
        idempotencyKey: crypto.randomUUID(),
        payload: toPayload(scenario)
      })

      expect(submit.idempotent).toBe(false)
      expect(queue.messages).toHaveLength(1)

      await orchestration.processSubmission(queue.messages[0])

      const status = await api.getSubmission(submit.submission.id)
      const ack = await api.getSubmissionAck(submit.submission.id)

      expect(status.submission.status).toBe('accepted')
      expect(ack.status).toBe('accepted')
      expect(ack.ack).toMatchObject({
        ackCode: 'A',
        rejectionCodes: []
      })

      expect(status.events.map((event) => event.status)).toEqual([
        'queued',
        'processing',
        'accepted'
      ])
    }
  )
})
