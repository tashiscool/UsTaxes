import {
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
  type JSONWebKeySet,
  type JWTPayload,
  type JWTVerifyGetKey,
  type JWTVerifyResult,
  type RemoteJWKSetOptions
} from 'jose'

import type { Env } from '../domain/env'
import { HttpError } from './http'

const DEFAULT_SCOPES = 'openid email profile'
const DISCOVERY_PATH = '/.well-known/openid-configuration'
const encoder = new TextEncoder()

type OidcDiscoveryDocument = {
  issuer?: string
  authorization_endpoint?: string
  token_endpoint?: string
  jwks_uri?: string
}

type OidcTokenResponse = {
  access_token?: string
  id_token?: string
  token_type?: string
  expires_in?: number
}

type OidcIdentityClaims = {
  sub: string
  email: string
  displayName?: string
  tin?: string
}

const toBase64Url = (value: Uint8Array): string =>
  btoa(String.fromCharCode(...value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')

const trimToUndefined = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export const oidcConfigured = (env: Env): boolean =>
  !!(
    trimToUndefined(env.APP_OIDC_ISSUER_URL) &&
    trimToUndefined(env.APP_OIDC_CLIENT_ID) &&
    trimToUndefined(env.APP_OIDC_CLIENT_SECRET) &&
    trimToUndefined(env.APP_AUTH_CALLBACK_URL)
  )

const requireOidcValue = (value: string | undefined, label: string): string => {
  if (!value) {
    throw new HttpError(500, `OIDC ${label} is not configured`)
  }
  return value
}

const oidcIssuer = (env: Env): string =>
  requireOidcValue(trimToUndefined(env.APP_OIDC_ISSUER_URL), 'issuer URL')

const oidcClientId = (env: Env): string =>
  requireOidcValue(trimToUndefined(env.APP_OIDC_CLIENT_ID), 'client ID')

const oidcClientSecret = (env: Env): string =>
  requireOidcValue(trimToUndefined(env.APP_OIDC_CLIENT_SECRET), 'client secret')

const oidcRedirectUri = (env: Env): string =>
  requireOidcValue(trimToUndefined(env.APP_AUTH_CALLBACK_URL), 'callback URL')

const oidcScopes = (env: Env): string =>
  trimToUndefined(env.APP_OIDC_SCOPES) ?? DEFAULT_SCOPES

const explicitAuthorizationEndpoint = (env: Env): string | undefined =>
  trimToUndefined(env.APP_OIDC_AUTHORIZATION_ENDPOINT)

const explicitTokenEndpoint = (env: Env): string | undefined =>
  trimToUndefined(env.APP_OIDC_TOKEN_ENDPOINT)

const explicitJwksUrl = (env: Env): string | undefined =>
  trimToUndefined(env.APP_OIDC_JWKS_URL)

const explicitJwksJson = (env: Env): string | undefined =>
  trimToUndefined(env.APP_OIDC_JWKS_JSON)

const explicitOidcConfigComplete = (env: Env): boolean =>
  !!(
    explicitAuthorizationEndpoint(env) &&
    explicitTokenEndpoint(env) &&
    (explicitJwksUrl(env) || explicitJwksJson(env))
  )

const loadDiscoveryDocument = async (
  env: Env,
  fetchImpl: typeof fetch = fetch
): Promise<OidcDiscoveryDocument> => {
  if (explicitOidcConfigComplete(env)) {
    return {
      issuer: oidcIssuer(env),
      authorization_endpoint: explicitAuthorizationEndpoint(env),
      token_endpoint: explicitTokenEndpoint(env),
      jwks_uri: explicitJwksUrl(env)
    }
  }

  const discoveryUrl =
    trimToUndefined(env.APP_OIDC_DISCOVERY_URL) ??
    `${oidcIssuer(env).replace(/\/$/, '')}${DISCOVERY_PATH}`

  const response = await fetchImpl(discoveryUrl, {
    headers: { accept: 'application/json' }
  })

  if (!response.ok) {
    throw new HttpError(
      502,
      `OIDC discovery request failed with status ${response.status}`
    )
  }

  const parsed = (await response.json()) as OidcDiscoveryDocument
  parsed.authorization_endpoint =
    trimToUndefined(env.APP_OIDC_AUTHORIZATION_ENDPOINT) ??
    parsed.authorization_endpoint
  parsed.token_endpoint =
    trimToUndefined(env.APP_OIDC_TOKEN_ENDPOINT) ?? parsed.token_endpoint
  parsed.jwks_uri = trimToUndefined(env.APP_OIDC_JWKS_URL) ?? parsed.jwks_uri

  if (
    !parsed.authorization_endpoint ||
    !parsed.token_endpoint ||
    !parsed.jwks_uri
  ) {
    throw new HttpError(502, 'OIDC discovery document is incomplete')
  }

  return parsed
}

export const generatePkceVerifier = (): string =>
  toBase64Url(crypto.getRandomValues(new Uint8Array(32)))

export const generatePkceChallenge = async (
  verifier: string
): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(verifier))
  return toBase64Url(new Uint8Array(digest))
}

export const buildOidcAuthorizationUrl = async (
  env: Env,
  options: {
    state: string
    nonce: string
    codeChallenge: string
  },
  fetchImpl: typeof fetch = fetch
): Promise<string> => {
  if (!oidcConfigured(env)) {
    throw new HttpError(500, 'OIDC is not configured for this environment')
  }

  const discovery = await loadDiscoveryDocument(env, fetchImpl)
  const url = new URL(discovery.authorization_endpoint as string)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', oidcClientId(env))
  url.searchParams.set('redirect_uri', oidcRedirectUri(env))
  url.searchParams.set('scope', oidcScopes(env))
  url.searchParams.set('state', options.state)
  url.searchParams.set('nonce', options.nonce)
  url.searchParams.set('code_challenge', options.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

const exchangeAuthorizationCode = async (
  env: Env,
  options: { code: string; codeVerifier: string },
  fetchImpl: typeof fetch = fetch
): Promise<OidcTokenResponse> => {
  const discovery = await loadDiscoveryDocument(env, fetchImpl)
  const response = await fetchImpl(discovery.token_endpoint as string, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: options.code,
      client_id: oidcClientId(env),
      client_secret: oidcClientSecret(env),
      redirect_uri: oidcRedirectUri(env),
      code_verifier: options.codeVerifier
    }).toString()
  })

  if (!response.ok) {
    throw new HttpError(
      502,
      `OIDC token exchange failed with status ${response.status}`
    )
  }

  const parsed = (await response.json()) as OidcTokenResponse
  if (!parsed.id_token) {
    throw new HttpError(502, 'OIDC token exchange response is missing id_token')
  }
  return parsed
}

const resolveJwks = async (
  env: Env,
  fetchImpl: typeof fetch = fetch
): Promise<JWTVerifyGetKey> => {
  const localJwks = explicitJwksJson(env)
  if (localJwks) {
    return createLocalJWKSet(JSON.parse(localJwks) as JSONWebKeySet)
  }

  const discovery = await loadDiscoveryDocument(env, fetchImpl)
  const remoteOptions: RemoteJWKSetOptions = {}
  return createRemoteJWKSet(
    new URL(discovery.jwks_uri as string),
    remoteOptions
  )
}

const verifyIdToken = async (
  env: Env,
  idToken: string,
  nonce: string,
  fetchImpl: typeof fetch = fetch
): Promise<JWTVerifyResult<JWTPayload>> => {
  const keySet = await resolveJwks(env, fetchImpl)
  const verified = await jwtVerify(idToken, keySet, {
    issuer: oidcIssuer(env),
    audience: oidcClientId(env)
  })
  if (verified.payload.nonce !== nonce) {
    throw new HttpError(400, 'OIDC identity nonce does not match the auth flow.')
  }
  return verified
}

const parseTin = (payload: JWTPayload): string | undefined => {
  const candidateKeys = ['tin', 'tax_id', 'taxId', 'ssn'] as const
  for (const key of candidateKeys) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return undefined
}

export const exchangeOidcCodeForIdentity = async (
  env: Env,
  options: { code: string; nonce: string; codeVerifier: string },
  fetchImpl: typeof fetch = fetch
): Promise<OidcIdentityClaims> => {
  const tokenResponse = await exchangeAuthorizationCode(
    env,
    { code: options.code, codeVerifier: options.codeVerifier },
    fetchImpl
  )
  const verified = await verifyIdToken(
    env,
    tokenResponse.id_token as string,
    options.nonce,
    fetchImpl
  )
  const payload = verified.payload
  const sub = typeof payload.sub === 'string' ? payload.sub.trim() : ''
  const email = typeof payload.email === 'string' ? payload.email.trim() : ''
  if (!sub || !email) {
    throw new HttpError(
      400,
      'OIDC identity is missing required subject/email claims'
    )
  }

  const displayName =
    typeof payload.name === 'string' && payload.name.trim()
      ? payload.name.trim()
      : typeof payload.preferred_username === 'string' &&
          payload.preferred_username.trim()
        ? payload.preferred_username.trim()
        : undefined

  return {
    sub,
    email,
    displayName,
    tin: parseTin(payload)
  }
}
