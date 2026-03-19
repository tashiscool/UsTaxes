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

const createWorkerHarness = async (): Promise<{
  worker: Unstable_DevWorker
  persistTo: string
}> => {
  const persistTo = mkdtempSync(join(tmpdir(), 'ustaxes-cf-e2e-'))

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

  const worker = await unstable_dev('src/index.ts', {
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

  return { worker, persistTo }
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
    const harness = await createWorkerHarness()
    worker = harness.worker
    persistTo = harness.persistTo
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
        completedScreens: [
          '/taxpayer-profile',
          '/efile-wizard',
          '/review-confirm'
        ],
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
    const checklistItems = (checklist.checklist as JsonObject).items as Record<
      string,
      JsonObject
    >
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
    expect(
      ((facts.dependents as JsonObject[])[0] as JsonObject).relationship
    ).toBe('child')
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
    expect((submission.submission as JsonObject).lifecycleStatus).toBe(
      'accepted'
    )

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/state-transfer`,
      {
        headers: { cookie: sessionCookie }
      }
    )
    expect(response.status).toBe(200)
    const stateTransfer = await parseJsonResponse<JsonObject>(response)
    expect(
      ((stateTransfer.stateTransfer as JsonObject).profile as JsonObject)
        .stateCode
    ).toBe('MA')

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

  it('prepares and completes a signed auth callback flow', async () => {
    let response = await worker.fetch(`${baseUrl}/app/v1/auth/prepare`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        redirectUri: 'http://localhost:5173/review-confirm'
      })
    })

    expect(response.status).toBe(201)
    const authFlowCookie = extractCookieHeader(response)
    const prepared = await parseJsonResponse<{ state?: string }>(response)
    expect(prepared.state).toBeTruthy()
    expect(authFlowCookie).toContain('app_auth_flow=')

    response = await worker.fetch(
      `${baseUrl}/app/v1/auth/callback?state=${encodeURIComponent(
        String(prepared.state)
      )}&sub=callback-user-1&email=callback.user%40example.com&tin=400011032&name=Callback%20User`,
      {
        redirect: 'manual',
        headers: {
          cookie: authFlowCookie
        }
      }
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(
      'http://localhost:5173/review-confirm'
    )
    const callbackSetCookie = response.headers.get('set-cookie')
    expect(callbackSetCookie).toContain('app_session_id=')
    expect(callbackSetCookie).toContain('app_auth_flow=;')

    const sessionCookie = extractCookieHeader(response)
    response = await worker.fetch(`${baseUrl}/app/v1/auth/me`, {
      headers: {
        cookie: sessionCookie
      }
    })

    expect(response.status).toBe(200)
    const me = await parseJsonResponse<JsonObject>(response)
    expect((me.user as JsonObject).email).toBe('callback.user@example.com')
  })

  it('surfaces Form 990 as expert-required and blocks self-serve submit', async () => {
    let response = await worker.fetch(`${baseUrl}/app/v1/auth/dev-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sub: 'taxflow-user-990',
        email: 'nonprofit@example.com',
        displayName: 'Nonprofit User'
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
        formType: '990',
        currentPhase: 'review',
        screenData: {
          '/taxpayer-profile': {
            firstName: 'Nora',
            lastName: 'Nonprofit',
            ssn: '400-01-1099',
            filingStatus: 'single',
            address: {
              line1: '88 Charity Way',
              city: 'Boston',
              state: 'MA',
              zip: '02110'
            }
          },
          '/business-entity': {
            entityName: 'Helping Hands Foundation',
            ein: '12-3456789',
            grossReceipts: 42000
          },
          '/efile-wizard': {
            signatureText: 'Nora Nonprofit',
            agreed8879: true
          }
        }
      })
    })
    expect(response.status).toBe(201)
    const created = await parseJsonResponse<JsonObject>(response)
    const filingSessionId = String((created.filingSession as JsonObject).id)

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/checklist`,
      {
        headers: { cookie: sessionCookie }
      }
    )
    expect(response.status).toBe(200)
    const checklist = await parseJsonResponse<JsonObject>(response)
    expect(
      (checklist.businessFormCapability as JsonObject).supportLevel as string
    ).toBe('expert_required')
    expect(
      (checklist.businessFormCapability as JsonObject).smallNonprofitHint
    ).toBe(true)
    expect(
      (checklist.findings as JsonObject[]).some(
        (finding) =>
          String((finding as JsonObject).message).includes('expert') ||
          String((finding as JsonObject).message).includes('Form 990')
      )
    ).toBe(true)

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/review`,
      {
        headers: { cookie: sessionCookie }
      }
    )
    expect(response.status).toBe(200)
    const review = await parseJsonResponse<JsonObject>(response)
    expect(
      (review.businessFormCapability as JsonObject).supportLevel as string
    ).toBe('expert_required')

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
    expect(response.status).toBe(409)
    const blocked = await parseJsonResponse<JsonObject>(response)
    expect(String(blocked.error)).toContain('Form 990')
  }, 120_000)

  it(
    'supports self-service 1120, 1120-S, 1065, and 1041 entity-return sync and review flows',
    async () => {
      let response = await worker.fetch(`${baseUrl}/app/v1/auth/dev-login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sub: 'taxflow-user-business-forms',
          email: 'business.forms@example.com',
          displayName: 'Business Forms User'
        })
      })
      expect(response.status).toBe(201)
      const sessionCookie = extractCookieHeader(response)

      const scenarios = [
        {
          formType: '1120',
          entityName: 'Atlas C Corp',
          scheduleTag: 'f1120',
          businessScreen: {
            entityName: 'Atlas C Corp',
            ein: '12-3456789',
            entityType: 'C-Corporation',
            principalBusinessActivity: 'Software publishing',
            principalProductOrService: 'Tax software',
            totalAssets: '850000',
            income: {
              grossReceiptsOrSales: '900000',
              interestIncome: '5000'
            },
            deductions: {
              compensationOfOfficers: '120000',
              salariesAndWages: '220000',
              rents: '50000',
              taxesAndLicenses: '15000',
              interest: '8000',
              depreciation: '12000',
              otherDeductions: '10000'
            }
          }
        },
        {
          formType: '1120-S',
          entityName: 'Beacon S Corp',
          scheduleTag: 'f1120s',
          businessScreen: {
            entityName: 'Beacon S Corp',
            ein: '23-4567890',
            entityType: 'S-Corporation',
            principalBusinessActivity: 'Consulting',
            principalProductOrService: 'Strategy services',
            totalAssets: '420000',
            income: {
              grossReceiptsOrSales: '650000',
              ordinaryIncome: '250000',
              interestIncome: '4000'
            },
            deductions: {
              compensation: '90000',
              salariesAndWages: '60000',
              rents: '25000',
              taxesAndLicenses: '14000',
              interest: '5000',
              otherDeductions: '7000'
            },
            scheduleK: {
              ordinaryBusinessIncome: '250000',
              interestIncome: '4000',
              netLongTermCapitalGain: '10000'
            },
            shareholders: [
              {
                id: 'sh-1',
                name: 'Alice Founder',
                tin: '111223333',
                ownershipPercentage: '60',
                stockOwned: '60',
                isOfficer: true,
                compensation: '90000'
              },
              {
                id: 'sh-2',
                name: 'Ben Operator',
                tin: '444556666',
                ownershipPercentage: '40',
                stockOwned: '40',
                isOfficer: false,
                compensation: '0'
              }
            ]
          }
        },
        {
          formType: '1065',
          entityName: 'Cedar Partners LLC',
          scheduleTag: 'f1065',
          businessScreen: {
            entityName: 'Cedar Partners LLC',
            ein: '34-5678901',
            entityType: 'Partnership',
            principalBusinessActivity: 'Real estate operations',
            principalProductOrService: 'Rental management',
            totalAssets: '980000',
            capitalAccountMethod: 'tax',
            income: {
              grossReceiptsOrSales: '720000',
              ordinaryIncome: '280000',
              rents: '240000'
            },
            deductions: {
              salariesAndWages: '70000',
              guaranteedPaymentsToPartners: '50000',
              rents: '18000',
              taxesAndLicenses: '16000',
              interest: '9000',
              retirementPlans: '4000',
              otherDeductions: '12000'
            },
            scheduleK: {
              ordinaryBusinessIncome: '280000',
              netRentalRealEstateIncome: '240000',
              charitableContributions: '5000'
            },
            partners: [
              {
                id: 'p-1',
                name: 'Nina Partner',
                tin: '555667777',
                tinType: 'SSN',
                profitSharingPercent: '55',
                lossSharingPercent: '55',
                capitalSharingPercent: '55',
                beginningCapitalAccount: '100000',
                capitalContributed: '25000',
                currentYearIncrease: '15000',
                withdrawalsDistributions: '10000',
                endingCapitalAccount: '130000',
                isGeneralPartner: true
              },
              {
                id: 'p-2',
                name: 'Omar Partner',
                tin: '888990000',
                tinType: 'SSN',
                profitSharingPercent: '45',
                lossSharingPercent: '45',
                capitalSharingPercent: '45',
                beginningCapitalAccount: '90000',
                capitalContributed: '15000',
                currentYearIncrease: '12000',
                withdrawalsDistributions: '8000',
                endingCapitalAccount: '109000',
                isGeneralPartner: false
              }
            ]
          }
        },
        {
          formType: '1041',
          entityName: 'Harbor Family Trust',
          scheduleTag: 'f1041',
          businessScreen: {
            entityName: 'Harbor Family Trust',
            ein: '45-6789012',
            entityType: 'complexTrust',
            principalBusinessActivity: 'Trust administration',
            principalProductOrService: 'Fiduciary management',
            totalAssets: '610000',
            dateCreated: '2021-06-01',
            income: {
              interestIncome: '12000',
              ordinaryDividends: '8000',
              qualifiedDividends: '5000',
              capitalGainLongTerm: '15000'
            },
            deductions: {
              taxes: '3000',
              interestExpense: '1000',
              charitableContributions: '2000',
              attorneyAccountantFees: '4500',
              otherDeductions: '2500'
            },
            fiduciary: {
              name: 'Taylor Trustee',
              tin: '101112222',
              address: '10 Trustee Plaza'
            },
            beneficiaries: [
              {
                id: 'b-1',
                name: 'Avery Beneficiary',
                tin: '212223333',
                address: '1 Ocean Ave',
                percentageShare: '60',
                ordinaryIncome: '9000',
                qualifiedDividends: '3000',
                capitalGains: '9000',
                otherIncome: '0',
                deductions: '500',
                credits: '0'
              }
            ]
          }
        }
      ] as const

      for (const scenario of scenarios) {
        response = await worker.fetch(`${baseUrl}/app/v1/filing-sessions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: sessionCookie
          },
          body: JSON.stringify({
            taxYear: 2025,
            filingStatus: 'single',
            formType: scenario.formType,
            currentPhase: 'review',
            screenData: {
              '/taxpayer-profile': {
                firstName: 'Pat',
                lastName: 'Entity',
                ssn: '400-01-2040',
                filingStatus: 'single',
                address: {
                  line1: '500 Market St',
                  city: 'Wilmington',
                  state: 'DE',
                  zip: '19801'
                }
              },
              '/business-entity': scenario.businessScreen,
              '/efile-wizard': {
                signatureText: `Pat Entity ${scenario.formType}`,
                agreed8879: true
              }
            }
          })
        })
        expect(response.status).toBe(201)
        const created = await parseJsonResponse<JsonObject>(response)
        const filingSessionId = String((created.filingSession as JsonObject).id)

        response = await worker.fetch(
          `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/checklist`,
          {
            headers: { cookie: sessionCookie }
          }
        )
        expect(response.status).toBe(200)
        const checklist = await parseJsonResponse<JsonObject>(response)
        const capability = checklist.businessFormCapability as JsonObject
        expect(capability.supportLevel).toBe('self_service_supported')
        expect(capability.hasMinimumData).toBe(true)
        expect(capability.readiness).toBe('ready')

        response = await worker.fetch(
          `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/review`,
          {
            headers: { cookie: sessionCookie }
          }
        )
        expect(response.status).toBe(200)
        const review = await parseJsonResponse<JsonObject>(response)
        expect(
          (review.businessFormCapability as JsonObject).supportLevel
        ).toBe('self_service_supported')

        response = await worker.fetch(
          `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/returns/sync`,
          {
            method: 'POST',
            headers: { cookie: sessionCookie }
          }
        )
        expect(response.status).toBe(200)
        const sync = await parseJsonResponse<JsonObject>(response)
        const taxSummary = sync.taxSummary as JsonObject
        expect(taxSummary.formType).toBe(scenario.formType)
        expect(taxSummary.entityName).toBe(scenario.entityName)
        expect(Number(taxSummary.totalIncome ?? 0)).toBeGreaterThan(0)
        expect(Number(taxSummary.totalDeductions ?? 0)).toBeGreaterThanOrEqual(0)
        expect((taxSummary.schedules as string[]).includes(scenario.scheduleTag)).toBe(
          true
        )
        if (scenario.formType === '1120-S' || scenario.formType === '1065') {
          expect(Array.isArray(taxSummary.ownerAllocations)).toBe(true)
          const ownerAllocations = taxSummary.ownerAllocations as JsonObject[]
          expect(ownerAllocations.length).toBeGreaterThan(0)
          const ownerNames = ownerAllocations.map((allocation) =>
            String(allocation.name)
          )
          if (scenario.formType === '1120-S') {
            expect(ownerNames).toContain('Alice Founder')
            expect(ownerNames).toContain('Ben Operator')
          } else {
            expect(ownerNames).toContain('Nina Partner')
            expect(ownerNames).toContain('Omar Partner')
          }
        }

        if (scenario.formType === '1041') {
          expect(Number(taxSummary.adjustedTotalIncome ?? 0)).toBeGreaterThan(0)
          expect(Number(taxSummary.distributionDeduction ?? 0)).toBeGreaterThanOrEqual(0)
          expect(Number(taxSummary.exemption ?? 0)).toBe(100)
          expect(Number(taxSummary.beneficiaryCount ?? 0)).toBe(1)
        }
      }
    },
    120_000
  )

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
    expect(
      Array.isArray((rejected.submission as JsonObject).rejectionErrors)
    ).toBe(true)
    expect(
      ((rejected.submission as JsonObject).rejectionErrors as JsonObject[])[0]
        ?.code
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
          entity.entityType === 'schedule_c' &&
          entity.id === 'consulting-business'
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
          entity.entityType === 'treaty_claim' &&
          entity.id === 'treaty-claim-primary'
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
          entity.entityType === 'treaty_claim' &&
          entity.id === 'treaty-claim-primary'
      )
    ).toBe(false)
  })

  it(
    'derives spouse, unemployment, and investment facts from TaxFlow entities',
    { timeout: 240000 },
    async () => {
      let response = await worker.fetch(`${baseUrl}/app/v1/auth/dev-login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sub: 'taxflow-user-derived-facts',
          email: 'derived-facts@example.com',
          displayName: 'Derived Facts User'
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
          filingStatus: 'mfj',
          formType: '1040',
          screenData: {
            '/taxpayer-profile': {
              firstName: 'Jordan',
              lastName: 'Example',
              ssn: '400-01-5555',
              filingStatus: 'mfj',
              address: {
                line1: '45 Example St',
                city: 'Boston',
                state: 'MA',
                zip: '02110'
              }
            },
            '/efile-wizard': {
              signatureText: 'Jordan Example'
            }
          }
        })
      })
      expect(response.status).toBe(201)
      const created = await parseJsonResponse<JsonObject>(response)
      const filingSessionId = String((created.filingSession as JsonObject).id)

      const payloads = [
        {
          entityType: 'spouse',
          entityId: 'spouse-primary',
          label: 'Taylor Example',
          data: {
            filingStatus: 'mfj',
            firstName: 'Taylor',
            lastName: 'Example',
            ssn: '400-01-7777',
            dob: '1987-04-11',
            occupation: 'Teacher',
            nonresident: false,
            spouseDeceased: false
          }
        },
        {
          entityType: 'unemployment_record',
          entityId: 'unemployment-primary',
          label: 'Unemployment compensation',
          data: {
            amount: 6400,
            federalWithheld: 640,
            repaidAmount: 0
          }
        },
        {
          entityType: 'ssa_record',
          entityId: 'ssa-primary',
          label: 'Social Security benefits',
          data: {
            grossAmount: 18000,
            federalWithheld: 0,
            otherIncome: 42000,
            filingStatus: 'mfj',
            taxableEstimate: 9000
          }
        },
        {
          entityType: 'crypto_account',
          entityId: 'coinbase',
          label: 'Coinbase',
          data: {
            name: 'Coinbase',
            status: 'connected',
            txCount: 27,
            source: 'crypto_console'
          }
        },
        {
          entityType: 'tax_lot',
          entityId: 'crypto-1',
          label: 'BTC',
          data: {
            source: 'crypto_console',
            security: 'BTC',
            securityType: 'crypto',
            transactionType: 'sell',
            acquisitionDate: '2023-03-01',
            saleDate: '2024-06-01',
            proceeds: 12500,
            costBasis: 9100,
            gain: 3400,
            term: 'long'
          }
        }
      ] as const

      for (const payload of payloads) {
        response = await worker.fetch(
          `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/entities/${payload.entityType}/${payload.entityId}`,
          {
            method: 'PUT',
            headers: {
              'content-type': 'application/json',
              cookie: sessionCookie
            },
            body: JSON.stringify({
              status: 'complete',
              label: payload.label,
              data: payload.data
            })
          }
        )
        expect(response.status).toBe(200)
      }

      response = await worker.fetch(
        `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/returns/sync`,
        {
          method: 'POST',
          headers: { cookie: sessionCookie }
        }
      )
      expect(response.status).toBe(200)
      const syncResult = await parseJsonResponse<JsonObject>(response)
      const facts = syncResult.facts as JsonObject
      expect((facts.spouse as JsonObject).firstName).toBe('Taylor')
      expect((facts.incomeSummary as JsonObject).totalUnemployment).toBe(6400)
      expect((facts.incomeSummary as JsonObject).totalSocialSecurityGross).toBe(
        18000
      )
      expect((facts.investmentSummary as JsonObject).cryptoAccountCount).toBe(1)
      expect((facts.investmentSummary as JsonObject).taxLotCount).toBe(1)
      expect((facts.investmentSummary as JsonObject).netCapitalGain).toBe(3400)

      response = await worker.fetch(
        `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/checklist`,
        {
          headers: { cookie: sessionCookie }
        }
      )
      expect(response.status).toBe(200)
      const checklist = await parseJsonResponse<JsonObject>(response)
      const checklistItems = (checklist.checklist as JsonObject)
        .items as Record<string, JsonObject>
      expect(checklistItems.spouse.status).toBe('complete')
      expect(checklistItems['unemployment-ss'].status).toBe('complete')
      expect(checklistItems.investments.status).toBe('complete')
    }
  )

  it(
    'syncs workbook-aligned screen data for unemployment, SSA, student loans, and retirement',
    { timeout: 240000 },
    async () => {
      const isolated = await createWorkerHarness()
      const isolatedWorker = isolated.worker
      const isolatedPersist = isolated.persistTo

      try {
      let response = await isolatedWorker.fetch(`${baseUrl}/app/v1/auth/dev-login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sub: 'taxflow-user-workbook-cluster',
          email: 'workbook-cluster@example.com',
          displayName: 'Workbook Cluster User'
        })
      })
      expect(response.status).toBe(201)
      const sessionCookie = extractCookieHeader(response)

      response = await isolatedWorker.fetch(`${baseUrl}/app/v1/filing-sessions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: sessionCookie
        },
        body: JSON.stringify({
          taxYear: 2025,
          filingStatus: 'single',
          formType: '1040',
          screenData: {
            '/taxpayer-profile': {
              firstName: 'Morgan',
              lastName: 'Workbook',
              ssn: '400-01-4444',
              filingStatus: 'single',
              address: {
                line1: '88 Ledger St',
                city: 'Denver',
                state: 'CO',
                zip: '80202'
              }
            },
            '/student-loan': {
              paidStudentLoanInterest: true,
              interestPaid: '2500',
              lenderName: 'MOHELA',
              loanForDegree: true,
              filingStatus: 'single',
              estimatedAGI: '60000'
            },
            '/unemployment-ss': {
              hasUnemployment: true,
              hasSS: true,
              form: {
                unemploymentAmount: '5000',
                unemploymentWithheld: '500',
                repaidAmount: '0',
                ssGrossAmount: '12000',
                ssWithheld: '0',
                otherIncome: '40000',
                filingStatus: 'single'
              }
            },
            '/ira-retirement': {
              sections: {
                contributions: true,
                rmd: false,
                pension: true,
                conversion: false
              },
              form: {
                age: '63',
                hasWorkplacePlan: 'no',
                filingStatus: 'single',
                magi: '60000',
                traditionalContribution: '3000',
                rothContribution: '',
                nonDeductibleBasis: '0',
                rmdAmount: '',
                rmdTaken: '',
                pensionIncome: '9000',
                pensionTaxable: '9000',
                conversionAmount: '',
                priorBasis: '0'
              }
            }
          }
        })
      })
      expect(response.status).toBe(201)
      const created = await parseJsonResponse<JsonObject>(response)
      const filingSessionId = String((created.filingSession as JsonObject).id)

      response = await isolatedWorker.fetch(
        `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/entities/w2/w2-primary-${filingSessionId}`,
        {
          method: 'PUT',
          headers: {
            'content-type': 'application/json',
            cookie: sessionCookie
          },
          body: JSON.stringify({
            status: 'complete',
            label: 'Employer Inc',
            data: {
              employerName: 'Employer Inc',
              ein: '12-3456789',
              box1Wages: 40000,
              box2FederalWithheld: 4000,
              owner: 'taxpayer'
            }
          })
        }
      )
      expect(response.status).toBe(200)

      response = await isolatedWorker.fetch(
        `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/returns/sync`,
        {
          method: 'POST',
          headers: { cookie: sessionCookie }
        }
      )
      expect(response.status).toBe(200)
      const syncResult = await parseJsonResponse<JsonObject>(response)
      const facts = syncResult.facts as JsonObject
      const incomeSummary = facts.incomeSummary as JsonObject
      const taxSummary = syncResult.taxSummary as JsonObject

      expect(((facts.studentLoanRecords as JsonObject[])[0] as JsonObject).interestPaid).toBe(2500)
      expect(((facts.unemploymentRecords as JsonObject[])[0] as JsonObject).amount).toBe(5000)
      expect(((facts.socialSecurityRecords as JsonObject[])[0] as JsonObject).grossAmount).toBe(12000)
      expect(((facts.iraContributions as JsonObject[])[0] as JsonObject).traditionalContributions).toBe(3000)
      expect(((facts.iraAccounts as JsonObject[])[0] as JsonObject).grossDistribution).toBe(9000)
      expect((incomeSummary.totalRetirementDistributions as number)).toBe(9000)
      expect((incomeSummary.totalUnemployment as number)).toBe(5000)
      expect((incomeSummary.totalSocialSecurityGross as number)).toBe(12000)
      expect((taxSummary.agi as number)).toBeGreaterThanOrEqual(42500)
      expect((taxSummary.totalPayments as number)).toBeGreaterThanOrEqual(4500)

      response = await isolatedWorker.fetch(
        `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/checklist`,
        {
          headers: { cookie: sessionCookie }
        }
      )
      expect(response.status).toBe(200)
      const checklist = await parseJsonResponse<JsonObject>(response)
      const checklistItems = (checklist.checklist as JsonObject)
        .items as Record<string, JsonObject>
      expect(checklistItems['unemployment-ss'].status).toBe('complete')
      expect(checklistItems.retirement.status).toBe('complete')

      response = await isolatedWorker.fetch(
        `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/review`,
        {
          headers: { cookie: sessionCookie }
        }
      )
      expect(response.status).toBe(200)
      const review = await parseJsonResponse<JsonObject>(response)
      const sections = (review.review as JsonObject).sections as JsonObject[]
      const incomeSection = sections.find(
        (section) => section.id === 'income'
      ) as JsonObject | undefined
      expect(incomeSection).toBeDefined()
      const rows = (incomeSection?.rows as JsonObject[]) ?? []
      expect(
        rows.some(
          (row) =>
            row.label === 'Retirement distributions' && row.value === '$9,000'
        )
      ).toBe(true)
      } finally {
        await isolatedWorker.stop()
        rmSync(isolatedPersist, { recursive: true, force: true })
      }
    }
  )

  it(
    'syncs workbook-aligned screen data for Forms 4137, 8919, and 8801',
    { timeout: 120000 },
    async () => {
      let response = await worker.fetch(`${baseUrl}/app/v1/auth/dev-login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sub: 'taxflow-user-workbook-tax-forms',
          email: 'workbook-tax-forms@example.com',
          displayName: 'Workbook Tax Forms User'
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
          screenData: {
            '/taxpayer-profile': {
              firstName: 'Jordan',
              lastName: 'Workbook',
              ssn: '400-01-5555',
              filingStatus: 'single',
              address: {
                line1: '77 Payroll Ave',
                city: 'Phoenix',
                state: 'AZ',
                zip: '85004'
              }
            },
            '/form-4137': {
              hasUnreportedTips: true,
              unreportedTips: '10000'
            },
            '/form-8919': {
              hasUncollectedWages: true,
              employers: [
                {
                  id: 'misclassified-1',
                  employerName: 'Shifted Employer',
                  employerEIN: '98-7654321',
                  wagesReceived: '20000',
                  reasonCode: 'A'
                }
              ]
            },
            '/form-8801': {
              hasAmtCredit: true,
              priorYearAmtCredit: '5000',
              priorYearAmtCreditCarryforward: '1000'
            }
          }
        })
      })
      expect(response.status).toBe(201)
      const created = await parseJsonResponse<JsonObject>(response)
      const filingSessionId = String((created.filingSession as JsonObject).id)

      response = await worker.fetch(
        `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/entities/w2/w2-tax-forms-${filingSessionId}`,
        {
          method: 'PUT',
          headers: {
            'content-type': 'application/json',
            cookie: sessionCookie
          },
          body: JSON.stringify({
            status: 'complete',
            label: 'Metro Hospitality',
            data: {
              employerName: 'Metro Hospitality',
              ein: '12-3456789',
              box1Wages: 170000,
              box2FederalWithheld: 24000,
              socialSecurityWages: 170000,
              medicareWages: 170000,
              owner: 'taxpayer'
            }
          })
        }
      )
      expect(response.status).toBe(200)

      response = await worker.fetch(
        `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/returns/sync`,
        {
          method: 'POST',
          headers: { cookie: sessionCookie }
        }
      )
      expect(response.status).toBe(200)
      const syncResult = await parseJsonResponse<JsonObject>(response)
      const facts = syncResult.facts as JsonObject
      const taxSummary = syncResult.taxSummary as JsonObject

      expect(facts.unreportedTipIncome).toBe(10000)
      expect(
        ((facts.uncollectedSSTaxWages as JsonObject[])[0] as JsonObject)
          .wagesReceived
      ).toBe(20000)
      expect(
        ((facts.uncollectedSSTaxWages as JsonObject[])[0] as JsonObject)
          .reasonCode
      ).toBe('A')
      expect(facts.priorYearAmtCredit).toBe(5000)
      expect(facts.priorYearAmtCreditCarryforward).toBe(1000)
      expect((taxSummary.totalTax as number)).toBeGreaterThan(0)
      expect((taxSummary.totalPayments as number)).toBe(24000)

      response = await worker.fetch(
        `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/checklist`,
        {
          headers: { cookie: sessionCookie }
        }
      )
      expect(response.status).toBe(200)
      const checklist = await parseJsonResponse<JsonObject>(response)
      const checklistItems = (checklist.checklist as JsonObject)
        .items as Record<string, JsonObject>
      expect(checklistItems['form-4137'].status).toBe('complete')
      expect(checklistItems['form-8919'].status).toBe('complete')
      expect(checklistItems['form-8801'].status).toBe('complete')

      response = await worker.fetch(
        `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/review`,
        {
          headers: { cookie: sessionCookie }
        }
      )
      expect(response.status).toBe(200)
      const review = await parseJsonResponse<JsonObject>(response)
      const sections = (review.review as JsonObject).sections as JsonObject[]
      const incomeSection = sections.find(
        (section) => section.id === 'income'
      ) as JsonObject | undefined
      const creditsSection = sections.find(
        (section) => section.id === 'household-credits'
      ) as JsonObject | undefined
      const incomeRows = (incomeSection?.rows as JsonObject[]) ?? []
      const creditRows = (creditsSection?.rows as JsonObject[]) ?? []

      expect(
        incomeRows.some(
          (row) =>
            row.label === 'Unreported tip income (Form 4137)' &&
            row.value === '$10,000'
        )
      ).toBe(true)
      expect(
        incomeRows.some(
          (row) =>
            row.label === 'Uncollected SS/Medicare wages (Form 8919)' &&
            row.value === '$20,000'
        )
      ).toBe(true)
      expect(
        creditRows.some(
          (row) =>
            row.label === 'Prior-year AMT credit inputs' &&
            row.value === '$5,000 current + $1,000 carryforward'
        )
      ).toBe(true)
    }
  )

  it(
    'ignores stale Form 4137, 8919, and 8801 values when the filer opts out',
    { timeout: 120000 },
    async () => {
      let response = await worker.fetch(`${baseUrl}/app/v1/auth/dev-login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sub: 'taxflow-user-workbook-tax-forms-opt-out',
          email: 'workbook-tax-forms-opt-out@example.com',
          displayName: 'Workbook Tax Forms Opt Out User'
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
          screenData: {
            '/taxpayer-profile': {
              firstName: 'Casey',
              lastName: 'Optout',
              ssn: '400-01-5566',
              filingStatus: 'single',
              address: {
                line1: '12 Toggle St',
                city: 'Tucson',
                state: 'AZ',
                zip: '85701'
              }
            },
            '/form-4137': {
              hasUnreportedTips: false,
              unreportedTips: '10000'
            },
            '/form-8919': {
              hasUncollectedWages: false,
              employers: [
                {
                  id: 'stale-1',
                  employerName: 'Old Employer',
                  employerEIN: '98-7654321',
                  wagesReceived: '20000',
                  reasonCode: 'A'
                }
              ]
            },
            '/form-8801': {
              hasAmtCredit: false,
              priorYearAmtCredit: '5000',
              priorYearAmtCreditCarryforward: '1000'
            }
          }
        })
      })
      expect(response.status).toBe(201)
      const created = await parseJsonResponse<JsonObject>(response)
      const filingSessionId = String((created.filingSession as JsonObject).id)

      response = await worker.fetch(
        `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/entities/w2/w2-tax-forms-optout-${filingSessionId}`,
        {
          method: 'PUT',
          headers: {
            'content-type': 'application/json',
            cookie: sessionCookie
          },
          body: JSON.stringify({
            status: 'complete',
            label: 'Metro Hospitality',
            data: {
              employerName: 'Metro Hospitality',
              ein: '12-3456789',
              box1Wages: 170000,
              box2FederalWithheld: 24000,
              socialSecurityWages: 170000,
              medicareWages: 170000,
              owner: 'taxpayer'
            }
          })
        }
      )
      expect(response.status).toBe(200)

      response = await worker.fetch(
        `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/returns/sync`,
        {
          method: 'POST',
          headers: { cookie: sessionCookie }
        }
      )
      expect(response.status).toBe(200)
      const syncResult = await parseJsonResponse<JsonObject>(response)
      const facts = syncResult.facts as JsonObject

      expect(facts.unreportedTipIncome ?? null).toBeNull()
      expect(
        Array.isArray(facts.uncollectedSSTaxWages)
          ? (facts.uncollectedSSTaxWages as JsonObject[]).length
          : 0
      ).toBe(0)
      expect(facts.priorYearAmtCredit ?? null).toBeNull()
      expect(facts.priorYearAmtCreditCarryforward ?? null).toBeNull()

      response = await worker.fetch(
        `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/checklist`,
        {
          headers: { cookie: sessionCookie }
        }
      )
      expect(response.status).toBe(200)
      const checklist = await parseJsonResponse<JsonObject>(response)
      const checklistItems = (checklist.checklist as JsonObject)
        .items as Record<string, JsonObject>
      expect(checklistItems['form-4137'].status).toBe('skipped')
      expect(checklistItems['form-8919'].status).toBe('skipped')
      expect(checklistItems['form-8801'].status).toBe('skipped')
    }
  )

  it('generates and updates a print-and-mail packet for TaxFlow sessions', async () => {
    let response = await worker.fetch(`${baseUrl}/app/v1/auth/dev-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sub: 'taxflow-user-print-mail',
        email: 'print-mail@example.com',
        displayName: 'Print Mail User'
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
        filingStatus: 'mfj',
        formType: '1040',
        screenData: {
          '/taxpayer-profile': {
            firstName: 'Pat',
            lastName: 'Paperfiler',
            ssn: '400-01-6666',
            address: {
              line1: '98 Filing Lane',
              city: 'Portland',
              state: 'OR',
              zip: '97201'
            }
          },
          '/review-confirm': {
            totalTax: 2400,
            totalPayments: 1800,
            totalRefund: 0
          },
          '/print-mail': {
            reason: 'no-efile'
          }
        }
      })
    })
    expect(response.status).toBe(201)
    const created = await parseJsonResponse<JsonObject>(response)
    const filingSessionId = String((created.filingSession as JsonObject).id)

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/print-mail`,
      {
        method: 'GET',
        headers: { cookie: sessionCookie }
      }
    )
    expect(response.status).toBe(200)
    const initialPacket = await parseJsonResponse<JsonObject>(response)
    const initialPrintMail = initialPacket.printMail as JsonObject
    expect(initialPrintMail.packetStatus).toBe('ready')
    expect((initialPrintMail.mailingAddress as JsonObject).withPayment).toBe(
      true
    )
    expect(
      Array.isArray((initialPrintMail.mailingAddress as JsonObject).lines)
    ).toBe(true)
    expect(Array.isArray(initialPrintMail.checklist)).toBe(true)
    expect(String(initialPrintMail.packetKey)).toContain(
      '/print-mail/packet.json'
    )

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/print-mail`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: sessionCookie
        },
        body: JSON.stringify({
          reason: 'prefer-paper',
          markMailed: true
        })
      }
    )
    expect(response.status).toBe(200)
    const updatedPacket = await parseJsonResponse<JsonObject>(response)
    const updatedPrintMail = updatedPacket.printMail as JsonObject
    expect(updatedPrintMail.reason).toBe('prefer-paper')
    expect(updatedPrintMail.packetStatus).toBe('mailed')
    expect((updatedPrintMail.returnSummary as JsonObject).amountOwed).toBe(600)
  })

  it(
    'preserves richer 1099 detail, itemized deductions, and nonresident facts through TaxFlow sync',
    async () => {
    let response = await worker.fetch(`${baseUrl}/app/v1/auth/dev-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sub: 'taxflow-user-workbook-parity',
        email: 'workbook-parity@example.com',
        displayName: 'Workbook Parity User'
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
        screenData: {
          '/taxpayer-profile': {
            firstName: 'Dana',
            lastName: 'Parity',
            ssn: '400-02-9999',
            filingStatus: 'single',
            address: {
              line1: '44 Harbor St',
              city: 'Portland',
              state: 'OR',
              zip: '97201'
            }
          },
          '/w2': {
            w2s: [
              {
                id: 'w2-1',
                employerName: 'Employer Inc',
                ein: '12-3456789',
                box1: 150000,
                box2: 35000,
                owner: 'taxpayer'
              }
            ]
          },
          '/1099': {
            records: [
              {
                id: 'int-1',
                type: '1099-INT',
                payer: 'City Bank',
                amount: 1500,
                taxExemptInterest: 250,
                foreignTaxPaid: 10
              },
              {
                id: 'div-1',
                type: '1099-DIV',
                payer: 'Brokerage',
                amount: 3200,
                qualifiedDividends: 1800,
                capitalGainDistributions: 450,
                section199ADividends: 300,
                exemptInterestDividends: 125,
                foreignTaxPaid: 75
              },
              {
                id: 'b-1',
                type: '1099-B',
                payer: 'Schwab',
                transactions: [
                  {
                    description: 'ABC',
                    term: 'short',
                    proceeds: 15000,
                    costBasis: 10000
                  },
                  {
                    description: 'XYZ',
                    term: 'long',
                    proceeds: 20000,
                    costBasis: 15000
                  }
                ]
              }
            ]
          },
          '/deductions': {
            form: {
              stateIncomeTaxes: 30000,
              realEstateTaxes: 8000,
              mortgageInterest: 10000,
              cashContributions: 2000,
              noncashContributionsTotal: 1000
            }
          },
          '/nonresident': {
            visaType: 'H1B',
            countryOfCitizenship: 'GB',
            daysInUS2024: '120',
            daysInUS2023: '60',
            daysInUS2022: '30',
            hasTreaty: false
          },
          '/intl-advanced/schedule-nec': {
            items: [
              {
                id: 'nec-1',
                incomeType: 'US dividends',
                grossAmount: 3200,
                netTax: 960
              }
            ]
          },
          '/intl-advanced/schedule-oi': {
            countryOfResidence: 'GB',
            dateEnteredUS: '2025-01-15'
          }
        }
      })
    })
    expect(response.status).toBe(201)
    const created = await parseJsonResponse<JsonObject>(response)
    const filingSessionId = String((created.filingSession as JsonObject).id)

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/returns/sync`,
      {
        method: 'POST',
        headers: { cookie: sessionCookie }
      }
    )
    expect(response.status).toBe(200)
    const syncResult = await parseJsonResponse<JsonObject>(response)
    const facts = syncResult.facts as JsonObject
    const taxSummary = syncResult.taxSummary as JsonObject
    const form1099Records = facts.form1099Records as JsonObject[]
    const intRecord = form1099Records.find(
      (record) => record.type === '1099-INT'
    ) as JsonObject
    const divRecord = form1099Records.find(
      (record) => record.type === '1099-DIV'
    ) as JsonObject
    const brokerRecord = form1099Records.find(
      (record) => record.type === '1099-B'
    ) as JsonObject
    const incomeSummary = facts.incomeSummary as JsonObject
    const itemized = facts.itemizedDeductions as JsonObject

    expect(intRecord.amount).toBe(1500)
    expect(intRecord.taxExemptInterest).toBe(250)
    expect(intRecord.foreignTaxPaid).toBe(10)
    expect(divRecord.amount).toBe(3200)
    expect(divRecord.qualifiedDividends).toBe(1800)
    expect(divRecord.capitalGainDistributions).toBe(450)
    expect(divRecord.section199ADividends).toBe(300)
    expect(divRecord.exemptInterestDividends).toBe(125)
    expect(divRecord.foreignTaxPaid).toBe(75)
    expect(brokerRecord.shortTermProceeds).toBe(15000)
    expect(brokerRecord.shortTermCostBasis).toBe(10000)
    expect(brokerRecord.longTermProceeds).toBe(20000)
    expect(brokerRecord.longTermCostBasis).toBe(15000)
    expect(brokerRecord.summaryAmount).toBe(0)
    expect(incomeSummary.total1099Amount).toBe(4700)
    expect((incomeSummary.totalsByType as JsonObject)['1099-INT']).toBe(1500)
    expect((incomeSummary.totalsByType as JsonObject)['1099-DIV']).toBe(3200)
    expect((incomeSummary.totalsByType as JsonObject)['1099-B']).toBe(0)
    expect(itemized.stateAndLocalTaxes).toBe(30000)
    expect(itemized.stateAndLocalRealEstateTaxes).toBe(8000)
    expect(itemized.interest8a).toBe(10000)
    expect(itemized.charityCashCheck).toBe(2000)
    expect(itemized.charityOther).toBe(1000)
    expect(
      Array.isArray(facts.nonresidentScheduleNecItems)
        ? facts.nonresidentScheduleNecItems.length
        : 0
    ).toBe(1)
    expect((facts.nonresidentScheduleOi as JsonObject).countryOfResidence).toBe(
      'GB'
    )
    expect((taxSummary.schedules as string[]).includes('f1040sb')).toBe(true)
    expect((taxSummary.schedules as string[]).includes('f1040nr')).toBe(true)
    },
    15_000
  )

  it('derives business, rental, and foreign/nonresident facts from advanced TaxFlow data', async () => {
    let response = await worker.fetch(`${baseUrl}/app/v1/auth/dev-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sub: 'taxflow-user-advanced-facts',
        email: 'advanced-facts@example.com',
        displayName: 'Advanced Facts User'
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
        screenData: {
          '/taxpayer-profile': {
            firstName: 'Riley',
            lastName: 'Example',
            ssn: '400-01-8888',
            filingStatus: 'single',
            address: {
              line1: '12 Harbor St',
              city: 'Portland',
              state: 'OR',
              zip: '97201'
            }
          },
          '/qbi-worksheet': {
            filingStatus: 'single',
            qbiDeductionData: {
              priorYearQualifiedBusinessLossCarryforward: 5000,
              reitDividends: 1500,
              ptpIncome: 2000,
              ptpLossCarryforward: 500,
              dpadReduction: 300
            },
            entities: [
              {
                id: 'qbi-1',
                name: 'Consulting LLC',
                type: 'sole_prop',
                netIncome: 98000,
                w2Wages: 0,
                ubia: 0,
                isSSTB: false,
                qbiAmount: 98000,
                w2Limitation: 0,
                finalDeduction: 18000,
                status: 'complete',
                warnings: []
              },
              {
                id: 'qbi-2',
                name: 'Maple Partners',
                type: 'partnership',
                netIncome: 22000,
                w2Wages: 24000,
                ubia: 90000,
                isSSTB: false,
                qbiAmount: 22000,
                w2Limitation: 12000,
                finalDeduction: 4500,
                status: 'complete',
                warnings: ['Wage/property limitation applied']
              },
              {
                id: 'qbi-3',
                name: 'Law Practice Group',
                type: 'partnership',
                netIncome: 310000,
                w2Wages: 0,
                ubia: 0,
                isSSTB: true,
                qbiAmount: 310000,
                w2Limitation: 0,
                finalDeduction: 0,
                status: 'blocked',
                warnings: ['SSTB phaseout applies']
              },
              {
                id: 'qbi-4',
                name: 'Rental Overflow LLC',
                type: 'llc',
                netIncome: 12000,
                w2Wages: 0,
                ubia: 50000,
                isSSTB: false,
                qbiAmount: 12000,
                w2Limitation: 0,
                finalDeduction: 2500,
                status: 'complete',
                warnings: []
              }
            ]
          },
          '/nonresident': {
            visaType: 'F-1',
            countryOfCitizenship: 'Germany',
            daysInUS2024: '20',
            daysInUS2023: '40',
            daysInUS2022: '30',
            hasTreaty: true,
            treatyCountry: 'Germany',
            treatyArticle: 'Article 15',
            treatyBenefit: 'Employment income treaty benefit',
            hasITIN: true,
            itin: '900123456',
            hasForeignAccounts: true,
            foreignAccountMax: '18000'
          },
          '/intl-advanced/feie': {
            qualMethod: 'physical',
            ppDays: '330',
            foreignEarned: '140000',
            housingCosts: '28000'
          },
          '/intl-advanced/schedule-nec': {
            items: [
              {
                id: 'nec-1',
                incomeType: 'US dividends',
                grossAmount: 4200,
                netTax: 630,
                treatyRate: 15,
                treatyCountry: 'Germany'
              }
            ]
          }
        }
      })
    })
    expect(response.status).toBe(201)
    const created = await parseJsonResponse<JsonObject>(response)
    const filingSessionId = String((created.filingSession as JsonObject).id)

    const entityPayloads = [
      {
        entityType: 'schedule_c',
        entityId: 'biz-1',
        label: 'Consulting LLC',
        data: {
          businessType: 'schedule-c',
          name: 'Consulting LLC',
          ein: '123456789',
          naicsCode: '541611',
          grossIncome: 120000,
          cogs: 15000,
          expenses: {
            insurance: 2000,
            rent: 4000,
            other: 1000
          },
          homeOffice: true,
          homeOfficeSqFt: 200,
          homeSqFt: 1000,
          qbiEligible: true
        }
      },
      {
        entityType: 'k1_entity',
        entityId: 'k1-1',
        label: 'Maple Partners',
        data: {
          businessType: 'k1-partnership',
          name: 'Maple Partners',
          ein: '987654321',
          ordinaryIncome: 18000,
          rentalIncome: 2000,
          guaranteedPayments: 3000,
          priorYearUnallowedLoss: 1400,
          qbiEligible: true,
          qbiWages: 10000,
          qbiProperty: 50000
        }
      },
      {
        entityType: 'rental_property',
        entityId: 'rental-1',
        label: 'Beach rental',
        data: {
          address: '55 Coast Hwy, Newport OR',
          type: 'vacation',
          daysRented: 300,
          daysPersonal: 20,
          grossRents: 24000,
          expenses: {
            mortgage: 6000,
            taxes: 2500,
            repairs: 1000,
            management: 1800,
            utilities: 900,
            advertising: 300
          },
          purchasePrice: 275000,
          purchaseYear: 2020,
          activeParticipation: true,
          passiveLossCarryover: 4200
        }
      },
      {
        entityType: 'passive_activity_loss',
        entityId: 'pal-1',
        label: 'Passive activity loss',
        data: {
          activelyParticipated: true,
          priorYearUnallowedLoss: 4200,
          totalRentalIncome: 24000,
          totalRentalExpenses: 22500,
          otherPassiveIncome: 0,
          otherPassiveLoss: 0
        }
      },
      {
        entityType: 'foreign_income_record',
        entityId: 'foreign-income-1',
        label: 'Germany salary',
        data: {
          foreignCountry: 'Germany',
          foreignEarnedIncome: 140000,
          exclusionMethod: 'physical',
          daysAbroad: 330,
          foreignTaxPaid: 8400,
          foreignTaxCountry: 'Germany'
        }
      },
      {
        entityType: '1099_div',
        entityId: '1099-div-1',
        label: 'US broker dividends',
        data: {
          payerName: 'US Broker',
          amount: 800,
          ordinaryDividends: 800,
          owner: 'taxpayer'
        }
      },
      {
        entityType: '1099_misc',
        entityId: '1099-misc-1',
        label: 'Licensing royalties',
        data: {
          payerName: 'Media Studio',
          amount: 500,
          notes: 'royalties',
          owner: 'taxpayer'
        }
      },
      {
        entityType: 'foreign_account',
        entityId: 'foreign-account-1',
        label: 'Deutsche Bank',
        data: {
          country: 'Germany',
          institution: 'Deutsche Bank',
          accountType: 'bank',
          maxBalanceUSD: 18000,
          currency: 'EUR',
          fbarRequired: true
        }
      },
      {
        entityType: 'treaty_claim',
        entityId: 'treaty-1',
        label: 'Germany treaty',
        data: {
          country: 'Germany',
          articleNumber: 'Article 15',
          incomeType: 'Employment income',
          exemptAmount: 0,
          reducedTreatyRate: 15,
          confirmed: true
        }
      }
    ] as const

    for (const entity of entityPayloads) {
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
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/returns/sync`,
      {
        method: 'POST',
        headers: { cookie: sessionCookie }
      }
    )
    expect(response.status).toBe(200)
    const syncResult = await parseJsonResponse<JsonObject>(response)
    const facts = syncResult.facts as JsonObject
    const taxSummary = syncResult.taxSummary as JsonObject
    expect((facts.businessSummary as JsonObject).recordCount).toBe(2)
    expect((facts.businessSummary as JsonObject).finalQBIDeduction).toBe(25000)
    expect((facts.businessSummary as JsonObject).sstbCount).toBe(1)
    expect((facts.businessSummary as JsonObject).wageLimitedCount).toBe(1)
    expect(((facts.k1Records as JsonObject[]) ?? []).length).toBe(1)
    expect((facts.k1Records as JsonObject[])[0]).toMatchObject({
      partnershipName: 'Maple Partners',
      ordinaryBusinessIncome: 18000,
      netRentalRealEstateIncome: 2000,
      guaranteedPaymentsForServices: 3000,
      priorYearUnallowedLoss: 1400
    })
    expect((facts.rentalProperties as JsonObject[])[0]).toMatchObject({
      activeParticipation: true,
      priorYearPassiveLossCarryover: 4200
    })
    expect(facts.scheduleEPage2).toEqual({
      activeParticipationRentalRealEstate: true
    })
    expect(facts.qbiDeductionData).toEqual({
      priorYearQualifiedBusinessLossCarryforward: 5000,
      reitDividends: 1500,
      ptpIncome: 2000,
      ptpLossCarryforward: 500,
      dpadReduction: 300
    })
    expect((facts.qbiDetail as JsonObject).formPreference).toBe('8995A')
    expect((facts.qbiDetail as JsonObject).needsAdditionalStatement).toBe(true)
    expect(((facts.qbiDetail as JsonObject).overflowEntities as JsonObject[]).length).toBe(1)
    expect(
      ((facts.qbiDetail as JsonObject).overflowTotals as JsonObject)
        .finalDeduction
    ).toBe(2500)
    expect((facts.rentalSummary as JsonObject).propertyCount).toBe(1)
    expect((facts.rentalSummary as JsonObject).grossRentsTotal).toBe(24000)
    expect((facts.rentalSummary as JsonObject).k1Count).toBe(1)
    expect((facts.rentalSummary as JsonObject).k1RentalIncomeTotal).toBe(2000)
    expect((facts.rentalSummary as JsonObject).scheduleEPage2NetIncome).toBe(
      23000
    )
    expect((facts.form1099Records as JsonObject[]).length).toBe(2)
    expect(
      (facts.treatyClaims as JsonObject[]).some(
        (claim) =>
          claim.country === 'Germany' && claim.reducedTreatyRate === 15
      )
    ).toBe(true)
    expect((facts.foreignSummary as JsonObject).totalForeignEarnedIncome).toBe(
      140000
    )
    expect((facts.foreignSummary as JsonObject).feieExclusionEstimate).toBe(
      130000
    )
    expect((facts.foreignSummary as JsonObject).fbarRequired).toBe(true)
    expect((facts.foreignSummary as JsonObject).requires1040NR).toBe(true)
    expect((facts.foreignSummary as JsonObject).scheduleNecTaxTotal).toBe(630)
    expect((taxSummary.schedules as string[]).includes('f1040nr')).toBe(true)

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/checklist`,
      {
        headers: { cookie: sessionCookie }
      }
    )
    expect(response.status).toBe(200)
    const checklist = await parseJsonResponse<JsonObject>(response)
    const checklistItems = (checklist.checklist as JsonObject).items as Record<
      string,
      JsonObject
    >
    expect(checklistItems.business.status).toBe('complete')
    expect(checklistItems.rental.status).toBe('complete')
    expect(checklistItems['foreign-income'].status).toBe('complete')

    response = await worker.fetch(
      `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/review`,
      {
        headers: { cookie: sessionCookie }
      }
    )
    expect(response.status).toBe(200)
    const review = await parseJsonResponse<JsonObject>(response)
    const sections = (review.review as JsonObject).sections as JsonObject[]
    expect(sections.some((section) => section.id === 'business')).toBe(true)
    expect(sections.some((section) => section.id === 'rental')).toBe(true)
    expect(sections.some((section) => section.id === 'international')).toBe(
      true
    )
  })
})
