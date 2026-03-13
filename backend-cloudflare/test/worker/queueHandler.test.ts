import { describe, expect, it, vi } from 'vitest'

import worker from '../../src/index'
import type { Env } from '../../src/domain/env'
import type { SubmissionQueueMessage } from '../../src/domain/types'

const makeQueueMessage = (body: SubmissionQueueMessage) => {
  const ack = vi.fn()
  const retry = vi.fn()
  return {
    body,
    ack,
    retry
  }
}

const makeEnv = (status: number): Env => {
  const stub = {
    fetch: vi.fn(async () => new Response('ok', { status }))
  }

  return {
    SUBMISSION_ORCHESTRATOR: {
      idFromName: vi.fn(
        () => 'do-id'
      ) as unknown as DurableObjectNamespace['idFromName'],
      get: vi.fn(() => stub) as unknown as DurableObjectNamespace['get']
    } as DurableObjectNamespace,
    USTAXES_DB: {} as D1Database,
    ARTIFACTS_BUCKET: {} as R2Bucket,
    SUBMISSION_QUEUE: {} as Queue<SubmissionQueueMessage>,
    INTERNAL_API_TOKEN: undefined
  }
}

describe('worker queue handler', () => {
  it('acknowledges message when orchestrator processing succeeds', async () => {
    const message = makeQueueMessage({
      submissionId: 'sub-1',
      taxReturnId: 'ret-1',
      attempt: 1,
      queuedAt: '2026-03-12T00:00:00.000Z'
    })
    const env = makeEnv(200)

    await worker.queue(
      {
        messages: [message]
      } as unknown as MessageBatch<SubmissionQueueMessage>,
      env
    )

    expect(message.ack).toHaveBeenCalledTimes(1)
    expect(message.retry).not.toHaveBeenCalled()
  })

  it('retries message when orchestrator returns 503', async () => {
    const message = makeQueueMessage({
      submissionId: 'sub-2',
      taxReturnId: 'ret-2',
      attempt: 2,
      queuedAt: '2026-03-12T00:00:00.000Z'
    })
    const env = makeEnv(503)

    await worker.queue(
      {
        messages: [message]
      } as unknown as MessageBatch<SubmissionQueueMessage>,
      env
    )

    expect(message.retry).toHaveBeenCalledTimes(1)
    expect(message.ack).not.toHaveBeenCalled()
  })

  it('acknowledges message when orchestrator returns non-retryable error', async () => {
    const message = makeQueueMessage({
      submissionId: 'sub-3',
      taxReturnId: 'ret-3',
      attempt: 3,
      queuedAt: '2026-03-12T00:00:00.000Z'
    })
    const env = makeEnv(500)

    await worker.queue(
      {
        messages: [message]
      } as unknown as MessageBatch<SubmissionQueueMessage>,
      env
    )

    expect(message.ack).toHaveBeenCalledTimes(1)
    expect(message.retry).not.toHaveBeenCalled()
  })
})
