import { afterEach, describe, expect, it, vi } from 'vitest'
import { SignJWT, exportJWK, generateKeyPair } from 'jose'

import type { Env } from '../../src/domain/env'
import type { SubmissionQueueMessage } from '../../src/domain/types'
import {
  buildOidcAuthorizationUrl,
  exchangeOidcCodeForIdentity,
  generatePkceChallenge
} from '../../src/utils/oidc'

const makeEnv = (overrides: Partial<Env> = {}): Env => ({
  USTAXES_DB: {} as D1Database,
  ARTIFACTS_BUCKET: {} as R2Bucket,
  SUBMISSION_QUEUE: {} as Queue<SubmissionQueueMessage>,
  SUBMISSION_ORCHESTRATOR: {} as DurableObjectNamespace,
  ENVIRONMENT: 'production',
  APP_AUTH_SECRET: 'x'.repeat(48),
  APP_OIDC_ISSUER_URL: 'https://issuer.example',
  APP_OIDC_CLIENT_ID: 'taxflow-client',
  APP_OIDC_CLIENT_SECRET: 'y'.repeat(48),
  APP_AUTH_CALLBACK_URL: 'https://freetaxflow.com/api/app/v1/auth/callback',
  APP_OIDC_SCOPES: 'openid profile email',
  ...overrides
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('oidc helpers', () => {
  it('uses explicit configured authorization endpoints without requiring discovery', async () => {
    const fetchSpy = vi.fn()

    const authorizationUrl = await buildOidcAuthorizationUrl(
      makeEnv({
        APP_OIDC_AUTHORIZATION_ENDPOINT: 'https://issuer.example/authorize',
        APP_OIDC_TOKEN_ENDPOINT: 'https://issuer.example/token',
        APP_OIDC_JWKS_JSON: JSON.stringify({ keys: [] })
      }),
      {
        state: 'signed-state',
        nonce: 'signed-nonce',
        codeChallenge: await generatePkceChallenge('pkce-verifier-2')
      },
      fetchSpy as unknown as typeof fetch
    )

    expect(fetchSpy).not.toHaveBeenCalled()
    const parsed = new URL(authorizationUrl)
    expect(parsed.origin).toBe('https://issuer.example')
    expect(parsed.pathname).toBe('/authorize')
    expect(parsed.searchParams.get('client_id')).toBe('taxflow-client')
  })

  it('builds a backend-owned authorization URL with PKCE and nonce', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          issuer: 'https://issuer.example',
          authorization_endpoint: 'https://issuer.example/authorize',
          token_endpoint: 'https://issuer.example/token',
          jwks_uri: 'https://issuer.example/jwks'
        })
      }))
    )

    const authorizationUrl = await buildOidcAuthorizationUrl(makeEnv(), {
      state: 'signed-state',
      nonce: 'signed-nonce',
      codeChallenge: await generatePkceChallenge('pkce-verifier-1')
    })

    const parsed = new URL(authorizationUrl)
    expect(parsed.origin).toBe('https://issuer.example')
    expect(parsed.pathname).toBe('/authorize')
    expect(parsed.searchParams.get('client_id')).toBe('taxflow-client')
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'https://freetaxflow.com/api/app/v1/auth/callback'
    )
    expect(parsed.searchParams.get('scope')).toBe('openid profile email')
    expect(parsed.searchParams.get('state')).toBe('signed-state')
    expect(parsed.searchParams.get('nonce')).toBe('signed-nonce')
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256')
    expect(parsed.searchParams.get('code_challenge')).toBeTruthy()
  })

  it('exchanges an authorization code and verifies the returned ID token', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256')
    const publicJwk = await exportJWK(publicKey)
    publicJwk.alg = 'RS256'
    publicJwk.use = 'sig'
    publicJwk.kid = 'test-key'

    const idToken = await new SignJWT({
      email: 'callback.user@example.com',
      name: 'Callback User',
      nonce: 'signed-nonce'
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer('https://issuer.example')
      .setAudience('taxflow-client')
      .setSubject('callback-user-1')
      .setIssuedAt()
      .setExpirationTime('5m')
      .setJti('test-jti-1')
      .sign(privateKey)

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_resource: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return {
            ok: true,
            json: async () => ({ id_token: idToken })
          } as Response
        }

        return {
          ok: true,
          json: async () => ({
            issuer: 'https://issuer.example',
            authorization_endpoint: 'https://issuer.example/authorize',
            token_endpoint: 'https://issuer.example/token',
            jwks_uri: 'https://issuer.example/jwks'
          })
        } as Response
      })
    )

    const identity = await exchangeOidcCodeForIdentity(
      makeEnv({
        APP_OIDC_JWKS_JSON: JSON.stringify({ keys: [publicJwk] })
      }),
      {
        code: 'auth-code-1',
        nonce: 'signed-nonce',
        codeVerifier: 'pkce-verifier-1'
      }
    )

    expect(identity).toEqual({
      sub: 'callback-user-1',
      email: 'callback.user@example.com',
      displayName: 'Callback User'
    })
  })
})
