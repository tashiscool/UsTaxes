import { describe, expect, it } from 'vitest'

import type { Env } from '../../src/domain/env'
import {
  issueAppSessionCookie,
  issueAuthFlowCookie,
  issueSignedAuthFlowState,
  localDevAuthAllowed,
  verifyAuthFlowCookie,
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
    expect(
      localDevAuthAllowed(
        makeEnv({
          ENVIRONMENT: 'production',
          APP_DEV_ALLOW_LOCAL_LOGIN: 'true'
        })
      )
    ).toBe(false)
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

  it('issues auth flow cookies as HttpOnly and round-trips signed PKCE claims', async () => {
    const env = makeEnv({
      ENVIRONMENT: 'production',
      APP_AUTH_SECRET: 'x'.repeat(48),
      APP_AUTH_CALLBACK_URL: 'https://freetaxflow.com/api/app/v1/auth/callback'
    })
    const cookie = await issueAuthFlowCookie(
      env,
      {
        nonce: 'nonce-1',
        codeVerifier: 'pkce-verifier-1'
      }
    )
    const verified = await verifyAuthFlowCookie(env, cookie)

    expect(verified).toEqual(
      expect.objectContaining({
        nonce: 'nonce-1',
        codeVerifier: 'pkce-verifier-1'
      })
    )
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('Domain=freetaxflow.com')
  })

  it('shares protected auth cookies across apex and www callback hosts', async () => {
    const env = makeEnv({
      ENVIRONMENT: 'production',
      APP_AUTH_SECRET: 'x'.repeat(48),
      APP_AUTH_CALLBACK_URL: 'https://freetaxflow.com/api/app/v1/auth/callback'
    })

    const sessionCookie = await issueAppSessionCookie(env, {
      sub: 'user-1',
      email: 'user@example.com'
    })
    const authFlowCookie = await issueAuthFlowCookie(env, {
      nonce: 'nonce-2',
      codeVerifier: 'pkce-verifier-2'
    })

    expect(sessionCookie).toContain('Domain=freetaxflow.com')
    expect(authFlowCookie).toContain('Domain=freetaxflow.com')
  })

  it('rejects tampered auth flow cookies in protected environments', async () => {
    const env = makeEnv({
      ENVIRONMENT: 'production',
      APP_AUTH_SECRET: 'x'.repeat(48)
    })
    const cookie = await issueAuthFlowCookie(env, {
      nonce: 'nonce-1',
      codeVerifier: 'pkce-verifier-1'
    })

    const tamperedCookie = cookie.replace(
      /^app_auth_flow=([^;]+)/,
      (_match, token: string) => `app_auth_flow=${token}tampered`
    )
    await expect(verifyAuthFlowCookie(env, tamperedCookie)).resolves.toBeNull()
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
