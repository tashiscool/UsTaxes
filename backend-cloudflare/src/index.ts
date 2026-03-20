import { Hono } from 'hono'
import type { Context } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { ZodError } from 'zod'
import { z } from 'zod'

import { D1TaxRepository } from './adapters/d1Repository'
import { R2ArtifactStore } from './adapters/r2ArtifactStore'
import type { Env } from './domain/env'
import type { SubmissionQueueMessage } from './domain/types'
import { SubmissionOrchestrator } from './do/submissionOrchestrator'
import { AppSessionService } from './services/appSessionService'
import { ApiService } from './services/apiService'
import { DirectFileCompatibilityService } from './services/directFileCompatibilityService'
import {
  clearAuthFlowCookie,
  clearAppSessionCookie,
  issueAuthFlowCookie,
  issueAppSessionCookie,
  issueSignedAuthFlowState,
  isDevelopmentLikeEnvironment,
  localDevAuthAllowed,
  requireAppUser,
  verifyAuthFlowCookie,
  verifyAuthFlowState
} from './utils/appAuth'
import {
  buildOidcAuthorizationUrl,
  exchangeOidcCodeForIdentity,
  generatePkceChallenge,
  generatePkceVerifier,
  oidcConfigured
} from './utils/oidc'
import { HttpError, jsonResponse } from './utils/http'
import { assertInternalAuth } from './utils/auth'
import { nowIso } from './utils/time'

const app = new Hono<{ Bindings: Env }>()

// ─── Security headers ────────────────────────────────────────────────────────
app.use('*', secureHeaders())

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use('*', async (c, next) => {
  const origin = c.env.CORS_ORIGIN ?? 'http://localhost:5173'
  return cors({
    origin,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-User-Id',
      'X-User-Email',
      'X-User-Tin'
    ],
    credentials: true,
    maxAge: 86400
  })(c, next)
})

const internalProcessSchema = z.object({
  taxReturnId: z.string().min(2)
})

const authPrepareSchema = z.object({
  redirectUri: z.string().max(2048).optional()
})

const directFilePrefixes = ['/api/v1', '/df/file/api/v1'] as const
const defaultDirectFileUserId = '11111111-1111-1111-1111-111111111111'

const buildServices = (c: Context<{ Bindings: Env }>) => {
  const repository = new D1TaxRepository(c.env.USTAXES_DB)
  const artifacts = new R2ArtifactStore(c.env.ARTIFACTS_BUCKET)
  const apiService = new ApiService(
    repository,
    artifacts,
    c.env.SUBMISSION_QUEUE
  )
  const directFileService = new DirectFileCompatibilityService(
    c.env,
    repository,
    artifacts,
    apiService
  )
  const appSessionService = new AppSessionService(
    c.env,
    repository,
    artifacts,
    apiService
  )

  return {
    repository,
    artifacts,
    apiService,
    directFileService,
    appSessionService
  }
}

const wantsHtmlNavigation = (c: Context<{ Bindings: Env }>): boolean => {
  const secFetchDest = c.req.header('sec-fetch-dest')?.toLowerCase()
  if (secFetchDest === 'document') {
    return true
  }

  const secFetchMode = c.req.header('sec-fetch-mode')?.toLowerCase()
  if (secFetchMode === 'navigate') {
    return true
  }

  const accept = c.req.header('accept')?.toLowerCase() ?? ''
  return accept.includes('text/html')
}

const renderAuthCompletionPage = (redirectUrl: string): string => {
  const serializedRedirect = JSON.stringify(redirectUrl)
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="0;url=${redirectUrl}" />
    <title>Signing you in…</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #f6f8fc;
        color: #0f172a;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: min(28rem, calc(100vw - 2rem));
        background: #ffffff;
        border-radius: 16px;
        padding: 1.5rem;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
      }
      h1 {
        margin: 0 0 0.75rem;
        font-size: 1.25rem;
      }
      p {
        margin: 0;
        line-height: 1.5;
        color: #334155;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Sign-in complete</h1>
      <p>We’re taking you back to TaxFlow now.</p>
    </main>
    <script>
      window.location.replace(${serializedRedirect});
    </script>
  </body>
</html>`
}

const getDirectFileUserContext = (c: Context<{ Bindings: Env }>) => ({
  id: c.req.header('x-user-id') ?? defaultDirectFileUserId,
  email: c.req.header('x-user-email') ?? '',
  tin: c.req.header('x-user-tin') ?? undefined
})

const registerDirectFileRoute = (
  method: 'GET' | 'POST',
  suffix: string,
  handler: (c: Context<{ Bindings: Env }>) => Promise<Response> | Response
) => {
  for (const prefix of directFilePrefixes) {
    app.on(method, `${prefix}${suffix}`, handler)
  }
}

const requireParam = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new HttpError(400, `Missing path parameter: ${name}`)
  }
  return value
}

const setNoStoreHeaders = (c: Context<{ Bindings: Env }>) => {
  c.header('cache-control', 'no-store')
  c.header('pragma', 'no-cache')
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SUBJECT_PATTERN = /^[A-Za-z0-9:_@.\-]{2,128}$/

const normalizeCallbackIdentity = (
  rawSub: string | undefined,
  rawEmail: string | undefined,
  rawTin: string | undefined,
  rawDisplayName: string | undefined
) => {
  const sub = rawSub?.trim()
  if (!sub || !SUBJECT_PATTERN.test(sub)) {
    throw new HttpError(400, 'Invalid callback subject identifier.')
  }

  const email = rawEmail?.trim().toLowerCase()
  if (!email || email.length > 320 || !EMAIL_PATTERN.test(email)) {
    throw new HttpError(400, 'Invalid callback email address.')
  }

  const tinDigits = rawTin?.replace(/\D/g, '')
  if (rawTin && tinDigits && tinDigits.length !== 9) {
    throw new HttpError(400, 'Invalid callback TIN format.')
  }

  const displayName = rawDisplayName?.trim()
  return {
    sub,
    email,
    tin: tinDigits && tinDigits.length === 9 ? tinDigits : undefined,
    displayName: displayName ? displayName.slice(0, 120) : undefined
  }
}

const resolveCallbackIdentity = async (
  c: Context<{ Bindings: Env }>,
  options: { nonce: string; codeVerifier?: string }
) => {
  const code = c.req.query('code')?.trim()
  if (code) {
    if (!options.codeVerifier) {
      throw new HttpError(
        400,
        'Authentication flow cookie is missing the PKCE verifier.'
      )
    }
    return exchangeOidcCodeForIdentity(c.env, {
      code,
      nonce: options.nonce,
      codeVerifier: options.codeVerifier
    })
  }

  if (isDevelopmentLikeEnvironment(c.env)) {
    return normalizeCallbackIdentity(
      c.req.query('sub') ?? c.req.query('userId') ?? c.req.query('id'),
      c.req.query('email'),
      c.req.query('tin') ?? undefined,
      c.req.query('name') ?? undefined
    )
  }

  if (!oidcConfigured(c.env)) {
    throw new HttpError(
      500,
      'OIDC is not configured for this protected environment.'
    )
  }

  throw new HttpError(400, 'Protected callback is missing an authorization code.')
}

const resolveSafeRedirect = (
  requestedRedirect: string | undefined,
  fallbackOrigin: string | undefined
): string => {
  const fallback = fallbackOrigin ?? '/'
  if (!requestedRedirect) {
    return fallback
  }

  if (requestedRedirect.startsWith('/')) {
    return requestedRedirect
  }

  try {
    const target = new URL(requestedRedirect)
    if (!fallbackOrigin) {
      return fallback
    }

    const allowedOrigin = new URL(fallbackOrigin)
    if (target.origin === allowedOrigin.origin) {
      return target.toString()
    }
  } catch {
    return fallback
  }

  return fallback
}

app.get('/health', (c) =>
  c.json({
    service: 'ustaxes-backend-cloudflare',
    status: 'ok',
    timestamp: new Date().toISOString()
  })
)

app.use('*', async (c, next) => {
  c.header('x-ustaxes-backend-version', 'v1')
  c.header('x-ustaxes-request-at', nowIso())
  await next()
})

app.post('/api/v1/returns', async (c) => {
  const { apiService } = buildServices(c)

  const result = await apiService.createReturn(await c.req.json())
  return c.json(result, 201)
})

app.get('/api/v1/returns/:returnId', async (c) => {
  const { apiService } = buildServices(c)

  const result = await apiService.getReturn(c.req.param('returnId'))
  return c.json(result)
})

app.get('/api/v1/returns/:returnId/submissions', async (c) => {
  const { apiService } = buildServices(c)

  const result = await apiService.listReturnSubmissions(c.req.param('returnId'))
  return c.json(result)
})

app.post('/api/v1/returns/:returnId/submit', async (c) => {
  const { apiService } = buildServices(c)

  const result = await apiService.submitReturn(
    c.req.param('returnId'),
    await c.req.json()
  )
  return c.json(result, 202)
})

app.get('/api/v1/submissions/:submissionId', async (c) => {
  const { apiService } = buildServices(c)

  const result = await apiService.getSubmission(c.req.param('submissionId'))
  return c.json(result)
})

app.get('/api/v1/submissions/:submissionId/ack', async (c) => {
  const { apiService } = buildServices(c)

  const result = await apiService.getSubmissionAck(c.req.param('submissionId'))
  return c.json(result)
})

app.get('/api/v1/submissions/:submissionId/payload', async (c) => {
  assertInternalAuth(c)

  const { apiService } = buildServices(c)

  const result = await apiService.getSubmissionPayload(
    c.req.param('submissionId')
  )
  return c.json(result)
})

app.post('/api/v1/internal/process/:submissionId', async (c) => {
  assertInternalAuth(c)

  const submissionId = c.req.param('submissionId')
  const body = internalProcessSchema.parse(await c.req.json())

  const id = c.env.SUBMISSION_ORCHESTRATOR.idFromName(body.taxReturnId)
  const stub = c.env.SUBMISSION_ORCHESTRATOR.get(id)

  const response = await stub.fetch('https://submission-orchestrator/process', {
    method: 'POST',
    body: JSON.stringify({
      submissionId,
      taxReturnId: body.taxReturnId,
      attempt: 1,
      queuedAt: nowIso()
    } as SubmissionQueueMessage)
  })

  if (!response.ok) {
    throw new HttpError(
      response.status,
      `Failed to process submission ${submissionId} via durable orchestrator`
    )
  }

  return c.json({ ok: true })
})

app.post('/api/v1/internal/submissions/:submissionId/retry', async (c) => {
  assertInternalAuth(c)

  const { apiService } = buildServices(c)

  const result = await apiService.retrySubmission(c.req.param('submissionId'))
  return c.json(result, 202)
})

app.post('/app/v1/auth/dev-login', async (c) => {
  setNoStoreHeaders(c)
  if (!localDevAuthAllowed(c.env)) {
    throw new HttpError(403, 'Local development login is disabled')
  }

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const user = {
    sub: String(body.sub ?? crypto.randomUUID()),
    email: String(body.email ?? 'local@taxflow.dev'),
    tin:
      typeof body.tin === 'string' && body.tin.trim().length > 0
        ? body.tin
        : undefined,
    displayName:
      typeof body.displayName === 'string' && body.displayName.trim().length > 0
        ? body.displayName
        : 'Local TaxFlow User'
  }

  const cookie = await issueAppSessionCookie(c.env, user)
  const { appSessionService } = buildServices(c)
  const authenticatedUser = await appSessionService.getAuthenticatedUser({
    ...user,
    exp: Math.floor(Date.now() / 1000) + 60 * 60
  })

  c.header('set-cookie', cookie)
  return c.json({ user: authenticatedUser }, 201)
})

app.post('/app/v1/auth/prepare', async (c) => {
  setNoStoreHeaders(c)
  const body = authPrepareSchema.parse(await c.req.json().catch(() => ({})))
  const nonce = crypto.randomUUID()
  const shouldUseOidc =
    oidcConfigured(c.env) || !isDevelopmentLikeEnvironment(c.env)
  const codeVerifier = shouldUseOidc ? generatePkceVerifier() : undefined
  const state = await issueSignedAuthFlowState(c.env, {
    redirectUri: body.redirectUri,
    nonce,
    issuedAt: Date.now()
  })
  c.header(
    'set-cookie',
    await issueAuthFlowCookie(c.env, {
      nonce,
      codeVerifier
    })
  )

  let authorizationUrl: string | undefined
  if (shouldUseOidc) {
    if (!codeVerifier) {
      throw new HttpError(500, 'OIDC PKCE verifier generation failed.')
    }
    authorizationUrl = await buildOidcAuthorizationUrl(c.env, {
      state,
      nonce,
      codeChallenge: await generatePkceChallenge(codeVerifier)
    })
  }

  return c.json({ state, authorizationUrl }, 201)
})

app.get('/app/v1/auth/callback', async (c) => {
  setNoStoreHeaders(c)
  const callbackError = c.req.query('error')
  if (callbackError) {
    throw new HttpError(400, `Authentication callback failed: ${callbackError}`)
  }

  const state = c.req.query('state')
  const parsedState = await verifyAuthFlowState(c.env, state)
  if (!parsedState) {
    throw new HttpError(400, 'Invalid or expired authentication flow state.')
  }
  const authFlow = await verifyAuthFlowCookie(c.env, c.req.header('cookie'))
  if (
    !parsedState.nonce ||
    !authFlow ||
    authFlow.nonce !== parsedState.nonce
  ) {
    throw new HttpError(400, 'Invalid or expired authentication flow state.')
  }

  const callbackIdentity = await resolveCallbackIdentity(c, authFlow)

  const cookie = await issueAppSessionCookie(c.env, {
    sub: callbackIdentity.sub,
    email: callbackIdentity.email,
    tin: callbackIdentity.tin,
    displayName: callbackIdentity.displayName
  })
  c.header('set-cookie', cookie)
  c.header('set-cookie', clearAuthFlowCookie(c.env), { append: true })
  const redirectUrl = resolveSafeRedirect(parsedState.redirectUri, c.env.CORS_ORIGIN)
  if (wantsHtmlNavigation(c)) {
    return c.html(renderAuthCompletionPage(redirectUrl), 200)
  }
  return c.redirect(redirectUrl)
})

app.post('/app/v1/auth/logout', async (c) => {
  setNoStoreHeaders(c)
  c.header('set-cookie', clearAppSessionCookie(c.env))
  c.header('set-cookie', clearAuthFlowCookie(c.env), { append: true })
  return c.json({ loggedOut: true })
})

app.get('/app/v1/auth/me', async (c) => {
  setNoStoreHeaders(c)
  const user = await requireAppUser(c)
  const { appSessionService } = buildServices(c)
  const authenticatedUser = await appSessionService.getAuthenticatedUser(user)
  return c.json({ user: authenticatedUser })
})

app.post('/app/v1/filing-sessions', async (c) => {
  const user = await requireAppUser(c)
  const { appSessionService } = buildServices(c)
  const result = await appSessionService.createFilingSession(
    await c.req.json().catch(() => ({})),
    user
  )
  return c.json(result, 201)
})

app.get('/app/v1/filing-sessions/:sessionId', async (c) => {
  const user = await requireAppUser(c)
  const { appSessionService } = buildServices(c)
  const result = await appSessionService.getFilingSession(
    c.req.param('sessionId'),
    user
  )
  return c.json(result)
})

app.patch('/app/v1/filing-sessions/:sessionId', async (c) => {
  const user = await requireAppUser(c)
  const { appSessionService } = buildServices(c)
  const result = await appSessionService.patchFilingSession(
    c.req.param('sessionId'),
    await c.req.json().catch(() => ({})),
    user
  )
  return c.json(result)
})

app.get('/app/v1/filing-sessions/:sessionId/entities', async (c) => {
  const user = await requireAppUser(c)
  const { appSessionService } = buildServices(c)
  const result = await appSessionService.listEntities(
    c.req.param('sessionId'),
    user
  )
  return c.json(result)
})

app.put(
  '/app/v1/filing-sessions/:sessionId/entities/:entityType/:entityId',
  async (c) => {
    const user = await requireAppUser(c)
    const { appSessionService } = buildServices(c)
    const result = await appSessionService.putEntity(
      c.req.param('sessionId'),
      c.req.param('entityType'),
      c.req.param('entityId'),
      await c.req.json().catch(() => ({})),
      user
    )
    return c.json(result)
  }
)

app.delete(
  '/app/v1/filing-sessions/:sessionId/entities/:entityType/:entityId',
  async (c) => {
    const user = await requireAppUser(c)
    const { appSessionService } = buildServices(c)
    const result = await appSessionService.deleteEntity(
      c.req.param('sessionId'),
      c.req.param('entityType'),
      c.req.param('entityId'),
      user
    )
    return c.json(result)
  }
)

app.post('/app/v1/filing-sessions/:sessionId/documents', async (c) => {
  const user = await requireAppUser(c)
  const { appSessionService } = buildServices(c)
  const result = await appSessionService.createDocument(
    c.req.param('sessionId'),
    await c.req.json().catch(() => ({})),
    user
  )
  return c.json(result, 201)
})

app.get(
  '/app/v1/filing-sessions/:sessionId/documents/:documentId',
  async (c) => {
    const user = await requireAppUser(c)
    const { appSessionService } = buildServices(c)
    const result = await appSessionService.getDocument(
      c.req.param('sessionId'),
      c.req.param('documentId'),
      user
    )
    return c.json(result)
  }
)

app.patch(
  '/app/v1/filing-sessions/:sessionId/documents/:documentId',
  async (c) => {
    const user = await requireAppUser(c)
    const { appSessionService } = buildServices(c)
    const result = await appSessionService.patchDocument(
      c.req.param('sessionId'),
      c.req.param('documentId'),
      await c.req.json().catch(() => ({})),
      user
    )
    return c.json(result)
  }
)

app.get('/app/v1/filing-sessions/:sessionId/checklist', async (c) => {
  const user = await requireAppUser(c)
  const { appSessionService } = buildServices(c)
  const result = await appSessionService.getChecklist(
    c.req.param('sessionId'),
    user
  )
  return c.json(result)
})

app.get('/app/v1/filing-sessions/:sessionId/review', async (c) => {
  const user = await requireAppUser(c)
  const { appSessionService } = buildServices(c)
  const result = await appSessionService.getReview(
    c.req.param('sessionId'),
    user
  )
  return c.json(result)
})

app.post('/app/v1/filing-sessions/:sessionId/returns/sync', async (c) => {
  const user = await requireAppUser(c)
  const { appSessionService } = buildServices(c)
  const result = await appSessionService.syncReturn(
    c.req.param('sessionId'),
    user
  )
  return c.json(result)
})

app.post('/app/v1/filing-sessions/:sessionId/sign', async (c) => {
  const user = await requireAppUser(c)
  const { appSessionService } = buildServices(c)
  const result = await appSessionService.sign(
    c.req.param('sessionId'),
    await c.req.json().catch(() => ({})),
    user
  )
  return c.json(result, 202)
})

app.post('/app/v1/filing-sessions/:sessionId/submit', async (c) => {
  const user = await requireAppUser(c)
  const { appSessionService } = buildServices(c)
  const result = await appSessionService.submit(
    c.req.param('sessionId'),
    await c.req.json().catch(() => ({})),
    user
  )
  return c.json(result, 202)
})

app.get('/app/v1/filing-sessions/:sessionId/submission', async (c) => {
  const user = await requireAppUser(c)
  const { appSessionService } = buildServices(c)
  const result = await appSessionService.getSubmission(
    c.req.param('sessionId'),
    user
  )
  return c.json(result)
})

app.post('/app/v1/filing-sessions/:sessionId/submission/retry', async (c) => {
  const user = await requireAppUser(c)
  const { appSessionService } = buildServices(c)
  const result = await appSessionService.retrySubmission(
    c.req.param('sessionId'),
    user
  )
  return c.json(result, 202)
})

app.get('/app/v1/filing-sessions/:sessionId/print-mail', async (c) => {
  const user = await requireAppUser(c)
  const { appSessionService } = buildServices(c)
  const result = await appSessionService.getPrintMailPacket(
    c.req.param('sessionId'),
    user
  )
  return c.json(result)
})

app.post('/app/v1/filing-sessions/:sessionId/print-mail', async (c) => {
  const user = await requireAppUser(c)
  const { appSessionService } = buildServices(c)
  const result = await appSessionService.updatePrintMailPacket(
    c.req.param('sessionId'),
    await c.req.json().catch(() => ({})),
    user
  )
  return c.json(result)
})

app.get('/app/v1/filing-sessions/:sessionId/state-transfer', async (c) => {
  const user = await requireAppUser(c)
  const { appSessionService } = buildServices(c)
  const result = await appSessionService.getStateTransfer(
    c.req.param('sessionId'),
    user
  )
  return c.json(result)
})

app.post(
  '/app/v1/filing-sessions/:sessionId/state-transfer/authorize',
  async (c) => {
    const user = await requireAppUser(c)
    const { appSessionService } = buildServices(c)
    const result = await appSessionService.authorizeStateTransfer(
      c.req.param('sessionId'),
      await c.req.json().catch(() => ({})),
      user
    )
    return c.json(result, 202)
  }
)

registerDirectFileRoute('GET', '/users/me', async (c) => {
  const user = getDirectFileUserContext(c)
  return c.json({
    email: user.email
  })
})

registerDirectFileRoute('GET', '/session/keep-alive', async () =>
  jsonResponse({}, 200)
)

registerDirectFileRoute('GET', '/taxreturns', async (c) => {
  const { directFileService } = buildServices(c)
  const response = await directFileService.listTaxReturns(
    getDirectFileUserContext(c)
  )
  return c.json(response)
})

registerDirectFileRoute('GET', '/taxreturns/:id', async (c) => {
  const { directFileService } = buildServices(c)
  const taxReturnId = requireParam(c.req.param('id'), 'id')
  const response = await directFileService.getTaxReturn(
    taxReturnId,
    getDirectFileUserContext(c)
  )
  return c.json(response)
})

registerDirectFileRoute('GET', '/taxreturns/:id/populate', async (c) => {
  const { directFileService } = buildServices(c)
  const taxReturnId = requireParam(c.req.param('id'), 'id')
  const response = await directFileService.getPopulatedData(
    taxReturnId,
    getDirectFileUserContext(c)
  )
  return c.json(response)
})

registerDirectFileRoute('POST', '/taxreturns', async (c) => {
  const { directFileService } = buildServices(c)
  const response = await directFileService.createTaxReturn(
    await c.req.json(),
    getDirectFileUserContext(c)
  )
  const location = new URL(c.req.url)
  location.pathname = `${location.pathname.replace(/\/$/, '')}/${response.id}`
  c.header('location', location.toString())
  return c.json(response, 201)
})

registerDirectFileRoute('POST', '/taxreturns/:id', async (c) => {
  const { directFileService } = buildServices(c)
  const taxReturnId = requireParam(c.req.param('id'), 'id')
  await directFileService.updateTaxReturn(
    taxReturnId,
    await c.req.json(),
    getDirectFileUserContext(c)
  )
  const location = new URL(c.req.url)
  location.pathname = location.pathname.replace(/\/$/, '')
  c.header('location', location.toString())
  return new Response(null, { status: 204 })
})

registerDirectFileRoute('POST', '/taxreturns/:id/submit', async (c) => {
  const { directFileService } = buildServices(c)
  const taxReturnId = requireParam(c.req.param('id'), 'id')
  const response = await directFileService.submitTaxReturn(
    taxReturnId,
    await c.req.json(),
    getDirectFileUserContext(c)
  )
  return new Response(response.message, {
    status: 202,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'x-submission-id': response.submissionId
    }
  })
})

registerDirectFileRoute('POST', '/taxreturns/:id/sign', async (c) => {
  const { directFileService } = buildServices(c)
  const taxReturnId = requireParam(c.req.param('id'), 'id')
  const response = await directFileService.signTaxReturn(
    taxReturnId,
    await c.req.json(),
    getDirectFileUserContext(c)
  )
  return new Response(response, {
    status: 202,
    headers: {
      'content-type': 'text/plain; charset=utf-8'
    }
  })
})

registerDirectFileRoute('GET', '/taxreturns/:id/status', async (c) => {
  const { directFileService } = buildServices(c)
  const taxReturnId = requireParam(c.req.param('id'), 'id')
  const response = await directFileService.getTaxReturnStatus(
    taxReturnId,
    getDirectFileUserContext(c)
  )
  return c.json(response)
})

registerDirectFileRoute(
  'POST',
  '/taxreturns/:id/pdf/:languageCode',
  async (c) => {
    const { directFileService } = buildServices(c)
    const taxReturnId = requireParam(c.req.param('id'), 'id')
    const languageCode = requireParam(
      c.req.param('languageCode'),
      'languageCode'
    )
    const pdf = await directFileService.getTaxReturnPdf(
      taxReturnId,
      languageCode,
      getDirectFileUserContext(c)
    )
    const pdfBuffer = pdf.buffer.slice(
      pdf.byteOffset,
      pdf.byteOffset + pdf.byteLength
    ) as ArrayBuffer
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename=taxreturn-${taxReturnId}.pdf`
      }
    })
  }
)

registerDirectFileRoute('POST', '/state-api/authorization-code', async (c) => {
  const { directFileService } = buildServices(c)
  const response = await directFileService.createAuthorizationCode(
    await c.req.json(),
    getDirectFileUserContext(c)
  )
  return c.json(response, 202)
})

registerDirectFileRoute('GET', '/state-api/state-profile', async (c) => {
  const { directFileService } = buildServices(c)
  const stateCode = c.req.query('stateCode')
  if (!stateCode) {
    throw new HttpError(400, 'stateCode query parameter is required')
  }
  const response = directFileService.getStateProfile(stateCode)
  return c.json(response)
})

registerDirectFileRoute(
  'GET',
  '/state-api/state-exported-facts/:submissionId',
  async (c) => {
    const { directFileService } = buildServices(c)
    const submissionId = requireParam(
      c.req.param('submissionId'),
      'submissionId'
    )
    const stateCode = c.req.query('stateCode')
    const accountId = c.req.query('accountId')

    if (!stateCode || !accountId) {
      throw new HttpError(
        400,
        'stateCode and accountId query parameters are required'
      )
    }

    const response = await directFileService.getStateExportedFacts(
      submissionId,
      stateCode,
      accountId
    )
    return c.json(response)
  }
)

registerDirectFileRoute(
  'GET',
  '/state-api/status/:taxFilingYear/:taxReturnId/:submissionId',
  async (c) => {
    const { directFileService } = buildServices(c)
    const taxFilingYear = Number(c.req.param('taxFilingYear'))
    if (!Number.isInteger(taxFilingYear)) {
      throw new HttpError(400, 'taxFilingYear must be an integer')
    }

    const response = await directFileService.getInternalTaxReturnStatus(
      taxFilingYear,
      requireParam(c.req.param('taxReturnId'), 'taxReturnId'),
      requireParam(c.req.param('submissionId'), 'submissionId')
    )
    return c.json(response)
  }
)

app.onError((err, c) => {
  if (err instanceof ZodError) {
    return jsonResponse(
      {
        error: 'Validation failed',
        issues: err.issues
      },
      400
    )
  }

  if (err instanceof HttpError) {
    return jsonResponse({ error: err.message }, err.status)
  }

  // In production, don't leak internal error details
  const isProd = c.env.ENVIRONMENT === 'production'
  console.error('[ustaxes-backend] Unhandled error:', err.message, err.stack)

  return jsonResponse(
    {
      error: 'Internal server error',
      ...(isProd ? {} : { detail: err.message })
    },
    500
  )
})

export default {
  fetch: app.fetch,
  async queue(
    batch: MessageBatch<SubmissionQueueMessage>,
    env: Env
  ): Promise<void> {
    for (const message of batch.messages) {
      try {
        const id = env.SUBMISSION_ORCHESTRATOR.idFromName(
          message.body.taxReturnId
        )
        const stub = env.SUBMISSION_ORCHESTRATOR.get(id)

        const response = await stub.fetch(
          'https://submission-orchestrator/process',
          {
            method: 'POST',
            body: JSON.stringify(message.body)
          }
        )

        if (!response.ok) {
          if (response.status === 503) {
            message.retry()
            continue
          }

          message.ack()
          continue
        }

        message.ack()
      } catch {
        message.retry()
      }
    }
  }
}

export { SubmissionOrchestrator }
