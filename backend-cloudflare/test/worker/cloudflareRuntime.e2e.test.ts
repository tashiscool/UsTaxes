import { execFileSync } from 'node:child_process'
import { rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { unstable_dev } from 'wrangler'
import type { Unstable_DevWorker } from 'wrangler'

const baseUrl = 'http://127.0.0.1'
const internalToken = 'integration-secret-token'
const directFilePrefix = `${baseUrl}/df/file/api/v1`
const directFileCompatPrefix = `${baseUrl}/api/v1`

type JsonObject = Record<string, unknown>
type WorkerResponse = Awaited<ReturnType<Unstable_DevWorker['fetch']>>

const parseJsonResponse = async <T = unknown>(
  response: WorkerResponse
): Promise<T> => {
  const text = await response.text()
  return (text ? JSON.parse(text) : {}) as T
}

const extractCookieHeader = (response: WorkerResponse): string => {
  const setCookie = response.headers.get('set-cookie')
  expect(setCookie).toBeTruthy()
  return String(setCookie).split(';')[0]
}

const directFileFacts = (taxYear = 2025): JsonObject => ({
  '/taxYear': {
    $type: 'gov.irs.factgraph.persisters.IntWrapper',
    item: taxYear
  },
  '/filingStatus': {
    $type: 'gov.irs.factgraph.persisters.EnumWrapper',
    item: {
      value: ['single'],
      enumOptionsPath: '/filingStatusOptions'
    }
  },
  '/filerResidenceAndIncomeState': {
    $type: 'gov.irs.factgraph.persisters.EnumWrapper',
    item: {
      value: ['ma'],
      enumOptionsPath: '/scopedStateOptions'
    }
  },
  '/filers/#primary/isPrimaryFiler': {
    $type: 'gov.irs.factgraph.persisters.BooleanWrapper',
    item: true
  },
  '/filers/#primary/tin': {
    $type: 'gov.irs.factgraph.persisters.TinWrapper',
    item: {
      area: '400',
      group: '01',
      serial: '1032'
    }
  },
  '/address': {
    $type: 'gov.irs.factgraph.persisters.AddressWrapper',
    item: {
      streetAddress: '2030 Pecan Street',
      city: 'Monroe',
      stateOrProvence: 'MA',
      postalCode: '02301'
    }
  }
})

describe('Cloudflare runtime integration (Worker + D1 + R2 + DO)', () => {
  let worker: Unstable_DevWorker
  let persistTo = ''

  beforeAll(async () => {
    persistTo = mkdtempSync(join(tmpdir(), 'ustaxes-cf-e2e-'))

    execFileSync(
      'npx',
      [
        'wrangler',
        'd1',
        'migrations',
        'apply',
        'USTAXES_DB',
        '--local',
        '--config',
        'wrangler.toml',
        '--persist-to',
        persistTo
      ],
      {
        cwd: process.cwd(),
        stdio: 'pipe'
      }
    )

    worker = await unstable_dev('src/index.ts', {
      config: 'wrangler.toml',
      local: true,
      persistTo,
      vars: {
        INTERNAL_API_TOKEN: internalToken
      },
      experimental: {
        disableExperimentalWarning: true
      }
    })
  }, 120_000)

  afterAll(async () => {
    await worker.stop()
    if (persistTo) {
      rmSync(persistTo, { recursive: true, force: true })
    }
  })

  it('enforces internal auth token on internal routes', async () => {
    const response = await worker.fetch(
      `${baseUrl}/api/v1/internal/submissions/nonexistent/retry`,
      {
        method: 'POST'
      }
    )

    expect(response.status).toBe(401)
  })

  it('processes an accepted submission end-to-end', async () => {
    let response = await worker.fetch(`${baseUrl}/api/v1/returns`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        taxYear: 2025,
        filingStatus: 'single',
        facts: { primaryTIN: '400011032' }
      })
    })
    expect(response.status).toBe(201)
    const created = await parseJsonResponse<JsonObject>(response)
    const taxReturnId = String((created.taxReturn as JsonObject).id)

    response = await worker.fetch(
      `${baseUrl}/api/v1/returns/${taxReturnId}/submit`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          payload: {
            taxYear: 2025,
            primaryTIN: '400011032',
            filingStatus: 'single',
            formType: '1040',
            form1040: {
              totalTax: 2242,
              totalPayments: 2713,
              refund: 471,
              amountOwed: 0
            },
            metadata: {
              scenarioId: 'S1',
              expectedValues: {
                totalTax: 2242,
                totalPayments: 2713,
                refund: 471,
                amountOwed: 0
              }
            }
          }
        })
      }
    )
    expect(response.status).toBe(202)
    const submitted = await parseJsonResponse<JsonObject>(response)
    const submissionId = String((submitted.submission as JsonObject).id)

    response = await worker.fetch(
      `${baseUrl}/api/v1/internal/process/${submissionId}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-token': internalToken
        },
        body: JSON.stringify({ taxReturnId })
      }
    )
    expect(response.status).toBe(200)

    response = await worker.fetch(
      `${baseUrl}/api/v1/submissions/${submissionId}`
    )
    expect(response.status).toBe(200)
    const statusBody = await parseJsonResponse<JsonObject>(response)
    expect((statusBody.submission as JsonObject).status).toBe('accepted')

    response = await worker.fetch(
      `${baseUrl}/api/v1/submissions/${submissionId}/ack`
    )
    expect(response.status).toBe(200)
    const ackBody = await parseJsonResponse<JsonObject>(response)
    expect((ackBody.ack as JsonObject).ackCode).toBe('A')
  })

  it('supports reject then retry with state reset', async () => {
    let response = await worker.fetch(`${baseUrl}/api/v1/returns`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        taxYear: 2025,
        filingStatus: 'single',
        facts: {}
      })
    })
    const created = await parseJsonResponse<JsonObject>(response)
    const taxReturnId = String((created.taxReturn as JsonObject).id)

    response = await worker.fetch(
      `${baseUrl}/api/v1/returns/${taxReturnId}/submit`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          payload: {
            taxYear: 2025,
            filingStatus: 'single',
            formType: '1040',
            form1040: {
              totalTax: 1200,
              totalPayments: 1200,
              refund: 0,
              amountOwed: 0
            }
          }
        })
      }
    )
    const submitted = await parseJsonResponse<JsonObject>(response)
    const submissionId = String((submitted.submission as JsonObject).id)

    response = await worker.fetch(
      `${baseUrl}/api/v1/internal/process/${submissionId}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-token': internalToken
        },
        body: JSON.stringify({ taxReturnId })
      }
    )
    expect(response.status).toBe(200)

    response = await worker.fetch(
      `${baseUrl}/api/v1/submissions/${submissionId}`
    )
    const rejectedStatus = await parseJsonResponse<JsonObject>(response)
    expect((rejectedStatus.submission as JsonObject).status).toBe('rejected')
    expect((rejectedStatus.submission as JsonObject).ackCode).toBe('R')

    response = await worker.fetch(
      `${baseUrl}/api/v1/internal/submissions/${submissionId}/retry`,
      {
        method: 'POST',
        headers: {
          'x-internal-token': internalToken
        }
      }
    )
    expect(response.status).toBe(202)

    response = await worker.fetch(
      `${baseUrl}/api/v1/submissions/${submissionId}`
    )
    const queuedStatus = await parseJsonResponse<JsonObject>(response)
    expect((queuedStatus.submission as JsonObject).status).toBe('queued')
    expect((queuedStatus.submission as JsonObject).ackCode).toBeUndefined()
    expect((queuedStatus.submission as JsonObject).ackMessage).toBeUndefined()
    expect((queuedStatus.submission as JsonObject).lastError).toBeUndefined()
    expect((queuedStatus.submission as JsonObject).processedAt).toBeUndefined()
  })

  it('supports Direct File-compatible taxreturn/state/session/user endpoints', async () => {
    const userHeaders = {
      'content-type': 'application/json',
      'x-user-id': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'x-user-email': 'integration.user@example.test',
      'x-user-tin': '400011032'
    }

    let response = await worker.fetch(`${directFilePrefix}/users/me`, {
      headers: userHeaders
    })
    expect(response.status).toBe(200)
    const userResponse = await parseJsonResponse<JsonObject>(response)
    expect(userResponse.email).toBe('integration.user@example.test')

    response = await worker.fetch(`${directFilePrefix}/session/keep-alive`, {
      headers: userHeaders
    })
    expect(response.status).toBe(200)

    response = await worker.fetch(`${directFilePrefix}/taxreturns`, {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({
        taxYear: 2025,
        facts: directFileFacts(2025)
      })
    })
    expect(response.status).toBe(201)
    const createdTaxReturn = await parseJsonResponse<JsonObject>(response)
    const taxReturnId = String(createdTaxReturn.id)

    response = await worker.fetch(
      `${directFilePrefix}/taxreturns/${taxReturnId}`,
      {
        headers: userHeaders
      }
    )
    expect(response.status).toBe(200)
    const fetchedTaxReturn = await parseJsonResponse<JsonObject>(response)
    expect(fetchedTaxReturn.id).toBe(taxReturnId)

    response = await worker.fetch(`${directFilePrefix}/taxreturns`, {
      headers: userHeaders
    })
    expect(response.status).toBe(200)
    const listed = await parseJsonResponse<JsonObject[]>(response)
    expect(listed.some((taxReturn) => taxReturn.id === taxReturnId)).toBe(true)

    response = await worker.fetch(
      `${directFilePrefix}/taxreturns/${taxReturnId}`,
      {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({
          facts: {
            ...directFileFacts(2025),
            '/address': {
              $type: 'gov.irs.factgraph.persisters.AddressWrapper',
              item: {
                streetAddress: '2045 Pecan Street',
                city: 'Monroe',
                stateOrProvence: 'MA',
                postalCode: '02301'
              }
            }
          }
        })
      }
    )
    expect(response.status).toBe(204)

    response = await worker.fetch(
      `${directFilePrefix}/taxreturns/${taxReturnId}/submit`,
      {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({
          facts: directFileFacts(2025)
        })
      }
    )
    expect(response.status).toBe(202)
    const submissionIdFromHeader = response.headers.get('x-submission-id')
    expect(submissionIdFromHeader).toBeTruthy()
    const submissionId = String(submissionIdFromHeader)

    response = await worker.fetch(
      `${baseUrl}/api/v1/internal/process/${submissionId}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-token': internalToken
        },
        body: JSON.stringify({ taxReturnId })
      }
    )
    expect(response.status).toBe(200)

    response = await worker.fetch(
      `${directFilePrefix}/taxreturns/${taxReturnId}/status`,
      {
        headers: userHeaders
      }
    )
    expect(response.status).toBe(200)
    const status = await parseJsonResponse<JsonObject>(response)
    expect(status.status).toBe('Accepted')

    response = await worker.fetch(
      `${directFilePrefix}/taxreturns/${taxReturnId}/pdf/en`,
      {
        method: 'POST',
        headers: userHeaders
      }
    )
    expect(response.status).toBe(501)
    const pdfError = await parseJsonResponse<JsonObject>(response)
    expect(String(pdfError.error)).toContain('PDF is not yet available')

    response = await worker.fetch(
      `${directFilePrefix}/taxreturns/${taxReturnId}/populate`,
      {
        headers: userHeaders
      }
    )
    expect(response.status).toBe(200)
    const populated = await parseJsonResponse<JsonObject>(response)
    expect(Array.isArray(populated.data)).toBe(true)

    response = await worker.fetch(
      `${directFilePrefix}/state-api/authorization-code`,
      {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({
          taxReturnUuid: taxReturnId,
          taxYear: 2025
        })
      }
    )
    expect(response.status).toBe(202)
    const authorization = await parseJsonResponse<JsonObject>(response)
    expect(typeof authorization.authorizationCode).toBe('string')

    response = await worker.fetch(
      `${directFilePrefix}/state-api/state-profile?stateCode=MA`,
      {
        headers: userHeaders
      }
    )
    expect(response.status).toBe(200)
    const profile = await parseJsonResponse<JsonObject>(response)
    expect((profile.stateProfile as JsonObject).stateCode).toBe('MA')

    response = await worker.fetch(
      `${directFilePrefix}/state-api/state-exported-facts/${submissionId}?stateCode=MA&accountId=acct-123`,
      {
        headers: userHeaders
      }
    )
    expect(response.status).toBe(200)
    const exportedFacts = await parseJsonResponse<JsonObject>(response)
    expect((exportedFacts.exportedFacts as JsonObject).submissionId).toBe(
      submissionId
    )

    response = await worker.fetch(
      `${directFilePrefix}/state-api/status/2025/${taxReturnId}/${submissionId}`,
      {
        headers: userHeaders
      }
    )
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('Accepted')

    response = await worker.fetch(`${directFilePrefix}/taxreturns`, {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({
        taxYear: 2024,
        facts: directFileFacts(2024)
      })
    })
    expect(response.status).toBe(201)
    const signableTaxReturn = await parseJsonResponse<JsonObject>(response)
    const signableTaxReturnId = String(signableTaxReturn.id)

    response = await worker.fetch(
      `${directFilePrefix}/taxreturns/${signableTaxReturnId}/sign`,
      {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({
          facts: directFileFacts(2024),
          intentStatement:
            'I declare under penalties of perjury that this return is true.'
        })
      }
    )
    expect(response.status).toBe(202)
    expect(await response.text()).toContain('Signed request')

    response = await worker.fetch(
      `${directFilePrefix}/taxreturns/${signableTaxReturnId}`,
      {
        headers: userHeaders
      }
    )
    expect(response.status).toBe(200)
    const signedTaxReturn = await parseJsonResponse<JsonObject>(response)
    expect(Array.isArray(signedTaxReturn.taxReturnSubmissions)).toBe(true)
    expect(
      (signedTaxReturn.taxReturnSubmissions as JsonObject[]).length
    ).toBeGreaterThanOrEqual(1)
    expect(signedTaxReturn.isEditable).toBe(false)

    response = await worker.fetch(`${directFileCompatPrefix}/users/me`, {
      headers: userHeaders
    })
    expect(response.status).toBe(200)

    response = await worker.fetch(
      `${directFileCompatPrefix}/taxreturns/${taxReturnId}`,
      {
        headers: userHeaders
      }
    )
    expect(response.status).toBe(200)

    response = await worker.fetch(`${directFilePrefix}/taxreturns`, {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({
        taxYear: 2023,
        facts: {
          '/filers/#primary/tin': {
            $type: 'gov.irs.factgraph.persisters.TinWrapper',
            item: {
              area: '40',
              group: '01',
              serial: '1032'
            }
          }
        }
      })
    })
    expect(response.status).toBe(400)
  })

  it('supports authenticated TaxFlow app sessions end-to-end', async () => {
    let response = await worker.fetch(`${baseUrl}/app/v1/auth/dev-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sub: 'taxflow-user-1',
        email: 'taxflow-user@example.com',
        tin: '400011032',
        displayName: 'TaxFlow User'
      })
    })
    expect(response.status).toBe(201)
    const sessionCookie = extractCookieHeader(response)

    response = await worker.fetch(`${baseUrl}/app/v1/auth/me`, {
      headers: { cookie: sessionCookie }
    })
    expect(response.status).toBe(200)
    const me = await parseJsonResponse<JsonObject>(response)
    expect((me.user as JsonObject).email).toBe('taxflow-user@example.com')

    response = await worker.fetch(`${baseUrl}/app/v1/filing-sessions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: sessionCookie
      },
      body: JSON.stringify({
        localSessionId: 'local-taxflow-session-1',
        name: '2025 TaxFlow Return',
        taxYear: 2025,
        filingStatus: 'single',
        formType: '1040',
        currentPhase: 'review',
        lastScreen: '/review-confirm',
        completionPct: 82,
        estimatedRefund: 1825,
        completedScreens: ['/taxpayer-profile', '/efile-wizard', '/review-confirm'],
        screenData: {
          '/taxpayer-profile': {
            firstName: 'Ava',
            lastName: 'Tester',
            ssn: '400-01-1032',
            priorYearAgi: 12345,
            filingStatus: 'single',
            address: {
              line1: '2030 Pecan Street',
              city: 'Monroe',
              state: 'MA',
              zip: '02301'
            }
          },
          '/efile-wizard': {
            signatureText: 'Ava Tester',
            agreed8879: true,
            priorYearAgi: 12345,
            account: '1234567890'
          },
          '/household': {
            dependents: [
              {
                id: 'dep-1',
                name: 'Jamie Tester',
                dob: '2016-04-14',
                relationship: 'child',
                ssn: '400-22-4444',
                months: '12'
              }
            ]
          },
          '/credits-v2': {
            credits: [
              {
                id: 'ctc',
                title: 'Child Tax Credit',
                shortName: 'CTC',
                status: 'eligible',
                estimatedAmount: 2000,
                entities: [
                  {
                    id: 'dep-1',
                    name: 'Jamie Tester',
                    status: 'eligible'
                  }
                ]
              }
            ]
          },
          '/review-confirm': {
            totalRefund: 1825,
            totalTax: 2242,
            totalPayments: 4067
          }
        }
      })
    })
    expect(response.status).toBe(201)
    const created = await parseJsonResponse<JsonObject>(response)
    const filingSession = created.filingSession as JsonObject
    const filingSessionId = String(filingSession.id)

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/entities/w2/w2-primary`,
      {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: sessionCookie
        },
        body: JSON.stringify({
          status: 'complete',
          label: 'Primary W-2',
          data: {
            employerName: 'Acme Inc.',
            ein: '12-3456789',
            box1Wages: 75000
          }
        })
      }
    )
    expect(response.status).toBe(200)

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/entities/1099_int/1099-interest`,
      {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: sessionCookie
        },
        body: JSON.stringify({
          status: 'complete',
          label: 'Bank interest',
          data: {
            payerName: 'Monroe Savings Bank',
            amounts: {
              amount: 215
            },
            federalWithheld: 0
          }
        })
      }
    )
    expect(response.status).toBe(200)

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/entities`,
      {
        headers: { cookie: sessionCookie }
      }
    )
    expect(response.status).toBe(200)
    const entities = await parseJsonResponse<JsonObject>(response)
    expect((entities.entities as JsonObject[]).length).toBeGreaterThanOrEqual(1)

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/documents`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: sessionCookie
        },
        body: JSON.stringify({
          name: 'w2.pdf',
          mimeType: 'application/pdf',
          status: 'processing',
          cluster: 'w2',
          clusterConfidence: 0.96,
          pages: 1,
          metadata: {
            extractedFields: ['employerName', 'box1Wages']
          }
        })
      }
    )
    expect(response.status).toBe(201)
    const documentBody = await parseJsonResponse<JsonObject>(response)
    const documentId = String((documentBody.document as JsonObject).id)

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/documents/${documentId}`,
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          cookie: sessionCookie
        },
        body: JSON.stringify({
          status: 'confirmed',
          metadata: {
            reviewStatus: 'accepted'
          }
        })
      }
    )
    expect(response.status).toBe(200)

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/checklist`,
      {
        headers: { cookie: sessionCookie }
      }
    )
    expect(response.status).toBe(200)
    const checklist = await parseJsonResponse<JsonObject>(response)
    expect((checklist.checklist as JsonObject).items).toBeTruthy()
    expect((checklist.findings as JsonObject[]).length).toBe(0)
    const checklistItems = (checklist.checklist as JsonObject).items as Record<string, JsonObject>
    expect(checklistItems.household.status).toBe('complete')
    expect(checklistItems.ctc.status).toBe('complete')

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/review`,
      {
        headers: { cookie: sessionCookie }
      }
    )
    expect(response.status).toBe(200)
    const review = await parseJsonResponse<JsonObject>(response)
    expect(Array.isArray((review.review as JsonObject).sections)).toBe(true)

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/returns/sync`,
      {
        method: 'POST',
        headers: { cookie: sessionCookie }
      }
    )
    expect(response.status).toBe(200)
    const syncResult = await parseJsonResponse<JsonObject>(response)
    const taxReturnId = String(syncResult.taxReturnId)
    const facts = syncResult.facts as JsonObject
    expect((facts.incomeSummary as JsonObject).totalW2Wages).toBe(75000)
    expect((facts.incomeSummary as JsonObject).total1099Amount).toBe(215)
    expect(Array.isArray(facts.dependents)).toBe(true)
    expect(((facts.dependents as JsonObject[])[0] as JsonObject).relationship).toBe('child')
    expect((facts.creditSummary as JsonObject).eligibleCount).toBe(1)
    expect((facts.creditSummary as JsonObject).estimatedTotal).toBe(2000)
    expect(Array.isArray(facts.w2Records)).toBe(true)
    expect(Array.isArray(facts.form1099Records)).toBe(true)

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/sign`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: sessionCookie
        },
        body: JSON.stringify({
          intentStatement:
            'I declare under penalties of perjury that this return is true.',
          signerName: 'Ava Tester'
        })
      }
    )
    expect(response.status).toBe(202)

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/submit`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: sessionCookie
        },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID()
        })
      }
    )
    expect(response.status).toBe(202)
    const submitted = await parseJsonResponse<JsonObject>(response)
    const submissionId = String((submitted.submission as JsonObject).id)

    response = await worker.fetch(
      `${baseUrl}/api/v1/internal/process/${submissionId}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-token': internalToken
        },
        body: JSON.stringify({ taxReturnId })
      }
    )
    expect(response.status).toBe(200)

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/submission`,
      {
        headers: { cookie: sessionCookie }
      }
    )
    expect(response.status).toBe(200)
    const submission = await parseJsonResponse<JsonObject>(response)
    expect((submission.submission as JsonObject).lifecycleStatus).toBe('accepted')

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/state-transfer`,
      {
        headers: { cookie: sessionCookie }
      }
    )
    expect(response.status).toBe(200)
    const stateTransfer = await parseJsonResponse<JsonObject>(response)
    expect(((stateTransfer.stateTransfer as JsonObject).profile as JsonObject).stateCode).toBe(
      'MA'
    )

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/state-transfer/authorize`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: sessionCookie
        },
        body: JSON.stringify({
          stateCode: 'MA',
          attested: true
        })
      }
    )
    expect(response.status).toBe(202)
    const authorization = await parseJsonResponse<JsonObject>(response)
    expect(typeof authorization.authorizationCode).toBe('string')
  })

  it('supports app-level rejection repair and retry orchestration', async () => {
    let response = await worker.fetch(`${baseUrl}/app/v1/auth/dev-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sub: 'taxflow-user-2',
        email: 'repair@example.com',
        displayName: 'Repair User'
      })
    })
    expect(response.status).toBe(201)
    const sessionCookie = extractCookieHeader(response)

    response = await worker.fetch(`${baseUrl}/app/v1/filing-sessions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: sessionCookie
      },
      body: JSON.stringify({
        taxYear: 2025,
        filingStatus: 'single',
        formType: '1040',
        currentPhase: 'file',
        screenData: {
          '/taxpayer-profile': {
            firstName: 'Broken',
            lastName: 'Return',
            filingStatus: 'single',
            address: {
              line1: '12 Repair Lane',
              city: 'Boston',
              state: 'MA',
              zip: '02110'
            }
          },
          '/efile-wizard': {
            signatureText: 'Broken Return',
            agreed8879: true
          },
          '/review-confirm': {
            totalRefund: 0,
            totalTax: 1200,
            totalPayments: 500
          }
        }
      })
    })
    expect(response.status).toBe(201)
    const created = await parseJsonResponse<JsonObject>(response)
    const filingSessionId = String((created.filingSession as JsonObject).id)

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/submit`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: sessionCookie
        },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID()
        })
      }
    )
    expect(response.status).toBe(202)
    const submitted = await parseJsonResponse<JsonObject>(response)
    const submissionId = String((submitted.submission as JsonObject).id)
    const taxReturnId = String(submitted.taxReturnId)

    response = await worker.fetch(
      `${baseUrl}/api/v1/internal/process/${submissionId}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-token': internalToken
        },
        body: JSON.stringify({ taxReturnId })
      }
    )
    expect(response.status).toBe(200)

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/submission`,
      {
        headers: { cookie: sessionCookie }
      }
    )
    expect(response.status).toBe(200)
    const rejected = await parseJsonResponse<JsonObject>(response)
    expect((rejected.submission as JsonObject).lifecycleStatus).toBe('rejected')
    expect(Array.isArray((rejected.submission as JsonObject).rejectionErrors)).toBe(true)
    expect(
      ((rejected.submission as JsonObject).rejectionErrors as JsonObject[])[0]?.code
    ).toBe('IND-031')
    expect((rejected.submission as JsonObject).canRetry).toBe(true)

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/submission/retry`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: sessionCookie
        },
        body: JSON.stringify({})
      }
    )
    expect(response.status).toBe(202)
    const retryResult = await parseJsonResponse<JsonObject>(response)
    expect(retryResult.retried).toBe(true)
  })

  it('round-trips advanced TaxFlow entity families through app CRUD', async () => {
    let response = await worker.fetch(`${baseUrl}/app/v1/auth/dev-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sub: 'taxflow-user-advanced-entities',
        email: 'advanced-entities@example.com',
        displayName: 'Advanced Entity User'
      })
    })
    expect(response.status).toBe(201)
    const sessionCookie = extractCookieHeader(response)

    response = await worker.fetch(`${baseUrl}/app/v1/filing-sessions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: sessionCookie
      },
      body: JSON.stringify({
        taxYear: 2025,
        filingStatus: 'single',
        formType: '1040',
        currentPhase: 'income'
      })
    })
    expect(response.status).toBe(201)
    const created = await parseJsonResponse<JsonObject>(response)
    const filingSessionId = String((created.filingSession as JsonObject).id)

    const advancedEntities = [
      {
        entityType: 'schedule_c',
        entityId: 'consulting-business',
        label: 'Consulting LLC',
        data: {
          businessType: 'schedule-c',
          name: 'Consulting LLC',
          grossIncome: '92000',
          cogs: '0'
        }
      },
      {
        entityType: 'k1_entity',
        entityId: 'partnership-k1',
        label: 'Partnership K-1',
        data: {
          businessType: 'k1-partnership',
          name: 'Elm Street Partners',
          k1Box1: '14500',
          k1Box2: '0',
          k1Box3: '0'
        }
      },
      {
        entityType: 'rental_property',
        entityId: 'rental-a',
        label: '12 Rental Ave',
        data: {
          address: '12 Rental Ave',
          type: 'residential',
          grossRents: '28000',
          daysRented: '365',
          expenses: {
            mortgage: '9000',
            taxes: '3200'
          }
        }
      },
      {
        entityType: 'hsa_account',
        entityId: 'hsa-primary',
        label: 'Primary HSA',
        data: {
          coverageType: 'family',
          age55: false,
          employerContributions: '2500',
          yourContributions: '1800',
          totalDistributions: '600',
          qualifiedDistributions: '600',
          nonqualifiedDistributions: '0'
        }
      },
      {
        entityType: 'ira_distribution',
        entityId: 'retirement-primary',
        label: 'Retirement summary',
        data: {
          traditionalContributions: '6500',
          pensionIncome: '12000',
          rothConversion: '0',
          takingRmd: false
        }
      },
      {
        entityType: 'foreign_income_record',
        entityId: 'foreign-income-primary',
        label: 'Foreign salary',
        data: {
          country: 'Canada',
          incomeType: 'salary',
          amount: '43000'
        }
      },
      {
        entityType: 'foreign_account',
        entityId: 'foreign-account-primary',
        label: 'RBC account',
        data: {
          institution: 'Royal Bank of Canada',
          highestBalance: '22000',
          country: 'Canada'
        }
      },
      {
        entityType: 'treaty_claim',
        entityId: 'treaty-claim-primary',
        label: 'US-Canada treaty',
        data: {
          treatyCountry: 'Canada',
          article: 'XV',
          explanation: 'Employment income allocation'
        }
      },
      {
        entityType: 'local_tax_obligation',
        entityId: 'ma-resident',
        label: 'Massachusetts return',
        data: {
          state: 'MA',
          residencyType: 'resident',
          incomeAllocated: '75000',
          stateWithheld: '3200'
        }
      }
    ] as const

    for (const entity of advancedEntities) {
      response = await worker.fetch(
        `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/entities/${entity.entityType}/${entity.entityId}`,
        {
          method: 'PUT',
          headers: {
            'content-type': 'application/json',
            cookie: sessionCookie
          },
          body: JSON.stringify({
            status: 'complete',
            label: entity.label,
            data: entity.data
          })
        }
      )
      expect(response.status).toBe(200)
    }

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/entities`,
      {
        headers: { cookie: sessionCookie }
      }
    )
    expect(response.status).toBe(200)
    const entitiesResponse = await parseJsonResponse<JsonObject>(response)
    const entities = entitiesResponse.entities as JsonObject[]

    expect(
      entities.some(
        (entity) =>
          entity.entityType === 'schedule_c' && entity.id === 'consulting-business'
      )
    ).toBe(true)
    expect(
      entities.some(
        (entity) =>
          entity.entityType === 'k1_entity' && entity.id === 'partnership-k1'
      )
    ).toBe(true)
    expect(
      entities.some(
        (entity) =>
          entity.entityType === 'rental_property' && entity.id === 'rental-a'
      )
    ).toBe(true)
    expect(
      entities.some(
        (entity) =>
          entity.entityType === 'hsa_account' && entity.id === 'hsa-primary'
      )
    ).toBe(true)
    expect(
      entities.some(
        (entity) =>
          entity.entityType === 'ira_distribution' &&
          entity.id === 'retirement-primary'
      )
    ).toBe(true)
    expect(
      entities.some(
        (entity) =>
          entity.entityType === 'foreign_income_record' &&
          entity.id === 'foreign-income-primary'
      )
    ).toBe(true)
    expect(
      entities.some(
        (entity) =>
          entity.entityType === 'foreign_account' &&
          entity.id === 'foreign-account-primary'
      )
    ).toBe(true)
    expect(
      entities.some(
        (entity) =>
          entity.entityType === 'treaty_claim' && entity.id === 'treaty-claim-primary'
      )
    ).toBe(true)
    expect(
      entities.some(
        (entity) =>
          entity.entityType === 'local_tax_obligation' &&
          entity.id === 'ma-resident'
      )
    ).toBe(true)

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/entities/treaty_claim/treaty-claim-primary`,
      {
        method: 'DELETE',
        headers: { cookie: sessionCookie }
      }
    )
    expect(response.status).toBe(200)

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/entities`,
      {
        headers: { cookie: sessionCookie }
      }
    )
    expect(response.status).toBe(200)
    const afterDelete = await parseJsonResponse<JsonObject>(response)
    expect(
      (afterDelete.entities as JsonObject[]).some(
        (entity) =>
          entity.entityType === 'treaty_claim' && entity.id === 'treaty-claim-primary'
      )
    ).toBe(false)
  })
})
