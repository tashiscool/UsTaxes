import { describe, expect, it } from 'vitest'

import worker from '../../src/index'
import type { Env } from '../../src/domain/env'
import type { SubmissionQueueMessage } from '../../src/domain/types'

const makeEnv = (): Env => ({
  SUBMISSION_ORCHESTRATOR: {} as DurableObjectNamespace,
  USTAXES_DB: {} as D1Database,
  ARTIFACTS_BUCKET: {} as R2Bucket,
  SUBMISSION_QUEUE: {} as Queue<SubmissionQueueMessage>,
  INTERNAL_API_TOKEN: 'secret-token'
})

describe('worker internal auth', () => {
  it('rejects internal endpoint request without token', async () => {
    const response = await worker.fetch(
      new Request('http://localhost/api/v1/internal/submissions/sub-id/retry', {
        method: 'POST'
      }),
      makeEnv()
    )

    expect(response.status).toBe(401)
  })
})
