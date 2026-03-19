import {
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
  type JWTPayload,
  type JWK
} from 'jose'

import type { Env } from '../domain/env'
import { HttpError } from './http'

const encoder = new TextEncoder()
const DEFAULT_OIDC_SCOPES = 'openid profile email'

type OidcMetadata = {
  issuer: string
  authorizationEndpoint: string
  tokenEndpoint: string
  jwksUri: string
}

type OidcIdentity = {
  sub: string
  email: string
  tin?: string
  displayName?: string
}

type OidcTokenResponse = {
  id_token?: string
}

type OidcIdTokenClaims = JWTPayload & {
  email?: string
  email_verified?: boolean
  name?: string
  nonce?: string
  preferred_username?: string
  tin?: string
}

const toBase64Url = (value: Uint8Array): string =>
  btoa(Array.from(value, (byte) => String.fromCharCode(byte)).join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')

const requireEnvValue = (value: string | undefined, label: string): string => {
  const normalized = value?.trim()
  if (!normalized) {
    throw new HttpError(500, `${label} is not configured for this environment`)
  }
  return normalized
}

const fetchJson = async <T>(
  resource: string,
  init?: RequestInit
): Promise<T> => {
  const response = await fetch(resource, init)
  if (!response.ok) {
    throw new HttpError(
      502,
      `OIDC upstream request failed (${response.status}) for ${resource}`
    )
  }
  return (await response.json()) as T
}

const discoveryUrl = (env: Env): string => {
  const explicit = env.APP_OIDC_DISCOVERY_URL?.trim()
  if (explicit) {
    return explicit
  }

  const issuer = requireEnvValue(env.APP_OIDC_ISSUER_URL, 'APP_OIDC_ISSUER_URL')
  return `${issuer.replace(/\/+$/g, '')}/.well-known/openid-configuration`
}

export const oidcConfigured = (env: Env): boolean =>
  Boolean(
    env.APP_OIDC_ISSUER_URL?.trim() &&
      env.APP_OIDC_CLIENT_ID?.trim() &&
      env.APP_OIDC_CLIENT_SECRET?.trim() &&
      env.APP_AUTH_CALLBACK_URL?.trim()
  )

const resolveMetadata = async (env: Env): Promise<OidcMetadata> => {
  const issuer = requireEnvValue(env.APP_OIDC_ISSUER_URL, 'APP_OIDC_ISSUER_URL')
  const authorizationEndpoint = env.APP_OIDC_AUTHORIZATION_ENDPOINT?.trim()
  const tokenEndpoint = env.APP_OIDC_TOKEN_ENDPOINT?.trim()
  const hasJwkSource = Boolean(
    env.APP_OIDC_JWKS_JSON?.trim() || env.APP_OIDC_JWKS_URL?.trim()
  )

  if (authorizationEndpoint && tokenEndpoint && hasJwkSource) {
    return {
      issuer,
      authorizationEndpoint,
      tokenEndpoint,
      jwksUri: env.APP_OIDC_JWKS_URL?.trim() || `${issuer}/jwks`
    }
  }

  const discovered = await fetchJson<{
    issuer?: string
    authorization_endpoint?: string
    token_endpoint?: string
    jwks_uri?: string
  }>(discoveryUrl(env))

  return {
    issuer: discovered.issuer?.trim() || issuer,
    authorizationEndpoint:
      env.APP_OIDC_AUTHORIZATION_ENDPOINT?.trim() ||
      requireEnvValue(
        discovered.authorization_endpoint,
        'OIDC authorization endpoint'
      ),
    tokenEndpoint:
      env.APP_OIDC_TOKEN_ENDPOINT?.trim() ||
      requireEnvValue(discovered.token_endpoint, 'OIDC token endpoint'),
    jwksUri:
      env.APP_OIDC_JWKS_URL?.trim() ||
      requireEnvValue(discovered.jwks_uri, 'OIDC JWKS endpoint')
  }
}

const localJwksResolver = (env: Env) => {
  const raw = env.APP_OIDC_JWKS_JSON?.trim()
  if (!raw) {
    return null
  }

  const parsed = JSON.parse(raw) as { keys?: JWK[] } | JWK[]
  const keys = Array.isArray(parsed) ? parsed : parsed.keys
  if (!keys || keys.length === 0) {
    throw new HttpError(500, 'APP_OIDC_JWKS_JSON did not contain any keys')
  }

  return createLocalJWKSet({ keys })
}

const jwksResolver = async (
  env: Env,
  metadata: OidcMetadata
): Promise<JWTVerifyGetKey> => {
  const local = localJwksResolver(env)
  if (local) {
    return local
  }

  return createRemoteJWKSet(new URL(metadata.jwksUri))
}

export const generatePkceVerifier = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return toBase64Url(bytes)
}

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
  }
): Promise<string> => {
  const metadata = await resolveMetadata(env)
  const url = new URL(metadata.authorizationEndpoint)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set(
    'client_id',
    requireEnvValue(env.APP_OIDC_CLIENT_ID, 'APP_OIDC_CLIENT_ID')
  )
  url.searchParams.set(
    'redirect_uri',
    requireEnvValue(env.APP_AUTH_CALLBACK_URL, 'APP_AUTH_CALLBACK_URL')
  )
  url.searchParams.set(
    'scope',
    env.APP_OIDC_SCOPES?.trim() || DEFAULT_OIDC_SCOPES
  )
  url.searchParams.set('state', options.state)
  url.searchParams.set('nonce', options.nonce)
  url.searchParams.set('code_challenge', options.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

export const exchangeOidcCodeForIdentity = async (
  env: Env,
  options: {
    code: string
    nonce: string
    codeVerifier: string
  }
): Promise<OidcIdentity> => {
  const metadata = await resolveMetadata(env)
  const response = await fetchJson<OidcTokenResponse>(metadata.tokenEndpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: options.code,
      client_id: requireEnvValue(env.APP_OIDC_CLIENT_ID, 'APP_OIDC_CLIENT_ID'),
      client_secret: requireEnvValue(
        env.APP_OIDC_CLIENT_SECRET,
        'APP_OIDC_CLIENT_SECRET'
      ),
      redirect_uri: requireEnvValue(
        env.APP_AUTH_CALLBACK_URL,
        'APP_AUTH_CALLBACK_URL'
      ),
      code_verifier: options.codeVerifier
    }).toString()
  })

  const idToken = response.id_token?.trim()
  if (!idToken) {
    throw new HttpError(502, 'OIDC token exchange did not return an ID token')
  }

  const verified = await jwtVerify<OidcIdTokenClaims>(
    idToken,
    await jwksResolver(env, metadata),
    {
      issuer: metadata.issuer,
      audience: requireEnvValue(env.APP_OIDC_CLIENT_ID, 'APP_OIDC_CLIENT_ID')
    }
  )

  const claims = verified.payload
  if (claims.nonce !== options.nonce) {
    throw new HttpError(400, 'OIDC ID token nonce did not match the auth flow')
  }
  const email = claims.email?.trim().toLowerCase()
  if (!claims.sub || !email) {
    throw new HttpError(502, 'OIDC ID token is missing required user claims')
  }

  return {
    sub: claims.sub,
    email,
    tin: claims.tin?.trim() || undefined,
    displayName:
      claims.name?.trim() || claims.preferred_username?.trim() || undefined
  }
}
