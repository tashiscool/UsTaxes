import type { ArtifactStore } from '../adapters/artifactStore'
import type { TaxRepository } from '../adapters/repository'
import { evaluateSubmissionPayload } from './ackEngine'
import type { SubmissionPayload, SubmissionQueueMessage } from '../domain/types'
import { validateMefCompliance } from './mefComplianceService'
import { nowIso } from '../utils/time'

const TERMINAL_STATUSES = new Set(['accepted', 'rejected', 'failed'])
const MAX_PROCESSING_ATTEMPTS = 3

export class RetryableSubmissionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RetryableSubmissionError'
  }
}

export class SubmissionOrchestrationService {
  constructor(
    private readonly repository: TaxRepository,
    private readonly artifacts: ArtifactStore
  ) {}

  async processSubmission(message: SubmissionQueueMessage): Promise<void> {
    const submission = await this.repository.getSubmission(message.submissionId)
    if (!submission) {
      return
    }

    if (TERMINAL_STATUSES.has(submission.status)) {
      return
    }

    const taxReturn = await this.repository.getTaxReturn(submission.taxReturnId)
    if (!taxReturn) {
      await this.repository.updateSubmissionStatus(submission.id, 'failed', {
        ackCode: 'F',
        ackMessage: 'Failed: associated tax return not found',
        lastError: 'Associated tax return missing',
        processedAt: nowIso()
      })
      await this.repository.addSubmissionEvent(
        submission.id,
        'failed',
        'Associated tax return missing in repository'
      )
      return
    }

    const attemptCount = await this.repository.incrementSubmissionAttempt(
      submission.id
    )

    await this.repository.updateSubmissionStatus(submission.id, 'processing')
    await this.repository.updateTaxReturnStatus(
      submission.taxReturnId,
      'processing'
    )
    await this.repository.addSubmissionEvent(
      submission.id,
      'processing',
      `Submission processing started by durable orchestrator (attempt ${attemptCount})`
    )

    const payload = await this.artifacts.getJson<SubmissionPayload>(
      submission.payloadKey
    )

    if (!payload) {
      await this.repository.updateSubmissionStatus(submission.id, 'failed', {
        ackCode: 'F',
        ackMessage: 'Failed: submission payload not found in artifact store',
        lastError: 'Submission payload missing in artifact store',
        processedAt: nowIso()
      })
      await this.repository.updateTaxReturnStatus(
        submission.taxReturnId,
        'failed'
      )
      await this.repository.addSubmissionEvent(
        submission.id,
        'failed',
        'Submission payload missing in R2'
      )
      return
    }

    if (payload.taxYear !== taxReturn.taxYear) {
      await this.repository.updateSubmissionStatus(submission.id, 'rejected', {
        ackCode: 'R',
        ackMessage: 'Rejected: tax year does not match return record',
        processedAt: nowIso()
      })
      await this.repository.updateTaxReturnStatus(
        submission.taxReturnId,
        'rejected'
      )
      await this.repository.addSubmissionEvent(
        submission.id,
        'rejected',
        'Submission rejected: R0000-902'
      )
      await this.artifacts.putJson(`submissions/${submission.id}/ack.json`, {
        status: 'rejected',
        ackCode: 'R',
        ackMessage: 'Rejected: tax year does not match return record',
        rejectionCodes: ['R0000-902'],
        submissionId: submission.id,
        taxReturnId: submission.taxReturnId
      })
      return
    }

    const mefCompliance = await validateMefCompliance(payload)
    await this.artifacts.putJson(
      `submissions/${submission.id}/mef-rules-report.json`,
      {
        submissionId: submission.id,
        taxReturnId: submission.taxReturnId,
        ...mefCompliance.report
      }
    )

    if (!mefCompliance.valid) {
      await this.repository.updateSubmissionStatus(submission.id, 'rejected', {
        ackCode: 'R',
        ackMessage: mefCompliance.rejectionMessage,
        processedAt: nowIso()
      })
      await this.repository.updateTaxReturnStatus(
        submission.taxReturnId,
        'rejected'
      )
      await this.repository.addSubmissionEvent(
        submission.id,
        'rejected',
        `Submission rejected by MeF JSON/XML rules: ${mefCompliance.rejectionCode}`
      )
      await this.artifacts.putJson(`submissions/${submission.id}/ack.json`, {
        status: 'rejected',
        ackCode: 'R',
        ackMessage: mefCompliance.rejectionMessage,
        rejectionCodes: [mefCompliance.rejectionCode],
        submissionId: submission.id,
        taxReturnId: submission.taxReturnId
      })
      return
    }

    await this.artifacts.putJson(
      `submissions/${submission.id}/mef-return.xml.json`,
      {
        xml: mefCompliance.xml,
        generatedAt: nowIso()
      }
    )

    const operationalMode = payload.metadata?.mefOperationalMode
    if (operationalMode === 'resiliency' && attemptCount === 1) {
      await this.repository.updateSubmissionStatus(submission.id, 'queued', {
        lastError:
          'MeF resiliency mode active: acknowledgements temporarily unavailable'
      })
      await this.repository.updateTaxReturnStatus(
        submission.taxReturnId,
        'queued'
      )
      await this.repository.addSubmissionEvent(
        submission.id,
        'queued',
        'MeF resiliency mode active: SendSubmissions accepted, acknowledgment retrieval deferred'
      )
      throw new RetryableSubmissionError(
        'MeF resiliency mode active: retry once normal operations resume'
      )
    }

    try {
      const ack = evaluateSubmissionPayload(payload)

      await this.repository.updateSubmissionStatus(submission.id, ack.status, {
        ackCode: ack.ackCode,
        ackMessage: ack.ackMessage,
        processedAt: nowIso()
      })
      await this.repository.updateTaxReturnStatus(
        submission.taxReturnId,
        ack.status
      )
      await this.repository.addSubmissionEvent(
        submission.id,
        ack.status,
        ack.rejectionCodes.length > 0
          ? `Submission ${ack.status}: ${ack.rejectionCodes.join(', ')}`
          : `Submission ${ack.status}`
      )

      await this.artifacts.putJson(`submissions/${submission.id}/ack.json`, {
        ...ack,
        submissionId: submission.id,
        taxReturnId: submission.taxReturnId
      })
    } catch (error) {
      if (attemptCount >= MAX_PROCESSING_ATTEMPTS) {
        await this.repository.updateSubmissionStatus(submission.id, 'failed', {
          ackCode: 'F',
          ackMessage: 'Failed: processing retries exceeded maximum attempts',
          lastError:
            error instanceof Error
              ? error.message
              : 'Unknown processing failure',
          processedAt: nowIso()
        })
        await this.repository.updateTaxReturnStatus(
          submission.taxReturnId,
          'failed'
        )
        await this.repository.addSubmissionEvent(
          submission.id,
          'failed',
          'Submission failed after max retry attempts'
        )
        return
      }

      await this.repository.updateSubmissionStatus(submission.id, 'queued', {
        lastError:
          error instanceof Error ? error.message : 'Unknown transient error'
      })
      await this.repository.updateTaxReturnStatus(
        submission.taxReturnId,
        'queued'
      )
      await this.repository.addSubmissionEvent(
        submission.id,
        'queued',
        `Submission requeued after transient processing failure (attempt ${attemptCount})`
      )
      throw new RetryableSubmissionError(
        error instanceof Error
          ? error.message
          : 'Unknown transient processing failure'
      )
    }
  }
}
