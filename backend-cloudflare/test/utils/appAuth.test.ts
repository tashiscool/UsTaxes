import { describe, expect, it } from 'vitest'

import type { Env } from '../../src/domain/env'
import {
  issueAppSessionCookie,
  issueAuthFlowCookie,
  issueSignedAuthFlowState,
  localDevAuthAllowed,
  verifyAuthFlowState
} from '../../src/utils/appAuth'
import { HttpError } from '../../src/utils/http'
import type { SubmissionQueueMessage } from '../../src/domain/types'

const makeEnv = (overrides: Partial<Env> = {}): Env => ({
  USTAXES_DB: {} as D1Database,
  ARTIFACTS_BUCKET: {} as R2Bucket,
  SUBMISSION_QUEUE: {} as Queue<SubmissionQueueMessage>,
  SUBMISSION_ORCHESTRATOR: {} as DurableObjectNamespace,
  ENVIRONMENT: 'development',
  ...overrides
})

describe('app auth utilities', () => {
  it('allows local dev auth by default only in development-like environments', () => {
    expect(localDevAuthAllowed(makeEnv())).toBe(true)
    expect(localDevAuthAllowed(makeEnv({ ENVIRONMENT: 'test' }))).toBe(true)
    expect(localDevAuthAllowed(makeEnv({ ENVIRONMENT: 'production' }))).toBe(
      false
    )
  })

  it('rejects weak app secrets in protected environments', async () => {
    await expect(
      issueAppSessionCookie(
        makeEnv({
          ENVIRONMENT: 'production',
          APP_AUTH_SECRET: 'dev-secret-change-in-production'
        }),
        {
          sub: 'user-1',
          email: 'user@example.com'
        }
      )
    ).rejects.toBeInstanceOf(HttpError)
  })

  it('issues auth flow cookies as HttpOnly', () => {
    const cookie = issueAuthFlowCookie(
      makeEnv({ ENVIRONMENT: 'production', APP_AUTH_SECRET: 'x'.repeat(48) }),
      'nonce-1'
    )
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
  })

  it('round-trips signed auth flow state', async () => {
    const env = makeEnv({
      ENVIRONMENT: 'production',
      APP_AUTH_SECRET: 'x'.repeat(48)
    })
    const state = await issueSignedAuthFlowState(env, {
      redirectUri: 'https://freetaxflow.com/review',
      nonce: 'nonce-123',
      issuedAt: Date.now()
    })

    const verified = await verifyAuthFlowState(env, state)
    expect(verified).not.toBeNull()
    expect(verified?.redirectUri).toBe('https://freetaxflow.com/review')
    expect(verified?.nonce).toBe('nonce-123')
  })

  it('rejects unsigned auth flow state in protected environments', async () => {
    const env = makeEnv({
      ENVIRONMENT: 'production',
      APP_AUTH_SECRET: 'x'.repeat(48)
    })
    const unsignedState = btoa(
      JSON.stringify({
        redirectUri: 'https://freetaxflow.com/review',
        nonce: 'nonce-123',
        issuedAt: Date.now()
      })
    )

    await expect(verifyAuthFlowState(env, unsignedState)).resolves.toBeNull()
  })
})
