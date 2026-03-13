const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:8787'
const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:3000'
const internalToken = process.env.INTERNAL_API_TOKEN || 'integration-secret-token'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function updateCookieJar(existing, response) {
  const header = response.headers.get('set-cookie')
  if (!header) return existing
  return header.split(';')[0]
}

async function requestJson(url, options = {}, cookieJar = '') {
  const headers = {
    'content-type': 'application/json',
    ...(options.headers ?? {})
  }
  if (cookieJar) {
    headers.cookie = cookieJar
  }

  let response
  try {
    response = await fetch(url, {
      ...options,
      headers
    })
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.cause instanceof Error
          ? `${error.message}: ${error.cause.message}`
          : error.message
        : String(error)
    throw new Error(`Request failed for ${url}: ${detail}`)
  }
  const text = await response.text()
  const body = text ? JSON.parse(text) : {}
  return { response, body, cookieJar: updateCookieJar(cookieJar, response) }
}

async function main() {
  const rootResponse = await fetch(`${frontendUrl}/`)
  assert(rootResponse.status === 200, 'TaxFlow frontend did not return 200 at root')

  let cookieJar = ''

  let result = await requestJson(
    `${frontendUrl}/api/app/v1/auth/dev-login`,
    {
      method: 'POST',
      body: JSON.stringify({
        sub: 'local-e2e-user',
        email: 'local-e2e@example.com',
        displayName: 'Local E2E User'
      })
    },
    cookieJar
  )
  assert(result.response.status === 201, 'Dev login failed through TaxFlow proxy')
  cookieJar = result.cookieJar

  result = await requestJson(
    `${frontendUrl}/api/app/v1/filing-sessions`,
    {
      method: 'POST',
      body: JSON.stringify({
        taxYear: 2025,
        filingStatus: 'single',
        formType: '1040',
        currentPhase: 'file',
        screenData: {
          '/taxpayer-profile': {
            firstName: 'Riley',
            lastName: 'Example',
            ssn: '400-01-4444',
            filingStatus: 'single',
            priorYearAgi: 87000,
            address: {
              line1: '12 Harbor St',
              city: 'Portland',
              state: 'OR',
              zip: '97201'
            }
          },
          '/review-confirm': {
            totalRefund: 1200,
            totalTax: 7800,
            totalPayments: 9000
          },
          '/efile-wizard': {
            signatureText: 'Riley Example',
            agreed8879: true
          },
          '/qbi-worksheet': {
            filingStatus: 'single',
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
                netTax: 630
              }
            ]
          }
        }
      })
    },
    cookieJar
  )
  assert(result.response.status === 201, 'Failed to create filing session through TaxFlow proxy')
  const filingSessionId = String(result.body.filingSession.id)

  const acceptedEntities = [
    {
      entityType: 'w2',
      entityId: 'w2-1',
      label: 'Acme Corp',
      data: {
        employerName: 'Acme Corp',
        ein: '123456789',
        box1Wages: 96000,
        box2FederalWithheld: 12000,
        stateWages: 96000,
        stateWithheld: 4200
      }
    },
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
        expenses: { insurance: 2000, rent: 4000, other: 1000 },
        homeOffice: true,
        homeOfficeSqFt: 200,
        homeSqFt: 1000,
        qbiEligible: true
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
        purchaseYear: 2020
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
        confirmed: true
      }
    }
  ]

  for (const entity of acceptedEntities) {
    result = await requestJson(
      `${frontendUrl}/api/app/v1/filing-sessions/${filingSessionId}/entities/${entity.entityType}/${entity.entityId}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          status: 'complete',
          label: entity.label,
          data: entity.data
        })
      },
      cookieJar
    )
    assert(result.response.status === 200, `Failed to persist ${entity.entityType}`)
  }

  result = await requestJson(`${frontendUrl}/api/app/v1/filing-sessions/${filingSessionId}/checklist`, { method: 'GET' }, cookieJar)
  assert(result.response.status === 200, 'Checklist request failed')
  assert(result.body.checklist.items.business.status === 'complete', 'Business checklist did not complete')
  assert(result.body.checklist.items.rental.status === 'complete', 'Rental checklist did not complete')
  assert(result.body.checklist.items['foreign-income'].status === 'complete', 'International checklist did not complete')

  result = await requestJson(`${frontendUrl}/api/app/v1/filing-sessions/${filingSessionId}/review`, { method: 'GET' }, cookieJar)
  assert(result.response.status === 200, 'Review request failed')
  const reviewSections = result.body.review.sections.map((section) => section.id)
  assert(reviewSections.includes('business'), 'Business review section missing')
  assert(reviewSections.includes('rental'), 'Rental review section missing')
  assert(reviewSections.includes('international'), 'International review section missing')

  result = await requestJson(`${frontendUrl}/api/app/v1/filing-sessions/${filingSessionId}/returns/sync`, { method: 'POST', body: JSON.stringify({}) }, cookieJar)
  assert(result.response.status === 200, 'Return sync failed')
  assert(result.body.facts.businessSummary.finalQBIDeduction === 18000, 'QBI deduction summary mismatch')
  assert(result.body.facts.rentalSummary.propertyCount === 1, 'Rental summary missing property')
  assert(result.body.facts.foreignSummary.feieExclusionEstimate === 130000, 'FEIE summary mismatch')

  result = await requestJson(
    `${frontendUrl}/api/app/v1/filing-sessions/${filingSessionId}/sign`,
    {
      method: 'POST',
      body: JSON.stringify({
        intentStatement: 'I agree to sign electronically.',
        signerName: 'Riley Example'
      })
    },
    cookieJar
  )
  assert(result.response.status === 202, 'Sign route failed')

  result = await requestJson(
    `${frontendUrl}/api/app/v1/filing-sessions/${filingSessionId}/submit`,
    {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID()
      })
    },
    cookieJar
  )
  assert(result.response.status === 202, 'Submit route failed')
  const acceptedSubmissionId = String(result.body.submission.id)
  const acceptedTaxReturnId = String(result.body.taxReturnId)

  let internal = await requestJson(`${backendUrl}/api/v1/internal/process/${acceptedSubmissionId}`, {
    method: 'POST',
    headers: { 'x-internal-token': internalToken },
    body: JSON.stringify({ taxReturnId: acceptedTaxReturnId })
  })
  assert(internal.response.status === 200, 'Internal acceptance processing failed')

  result = await requestJson(`${frontendUrl}/api/app/v1/filing-sessions/${filingSessionId}/submission`, { method: 'GET' }, cookieJar)
  assert(result.response.status === 200, 'Submission status request failed')
  assert(result.body.submission.lifecycleStatus === 'accepted', 'Accepted submission did not settle')

  result = await requestJson(`${frontendUrl}/api/app/v1/filing-sessions/${filingSessionId}/state-transfer`, { method: 'GET' }, cookieJar)
  assert(result.response.status === 200, 'State transfer lookup failed')
  result = await requestJson(
    `${frontendUrl}/api/app/v1/filing-sessions/${filingSessionId}/state-transfer/authorize`,
    {
      method: 'POST',
      body: JSON.stringify({ stateCode: 'OR', attested: true })
    },
    cookieJar
  )
  assert(result.response.status === 202, 'State transfer authorize failed')

  result = await requestJson(`${frontendUrl}/api/app/v1/filing-sessions/${filingSessionId}/print-mail`, { method: 'GET' }, cookieJar)
  assert(result.response.status === 200, 'Print-mail lookup failed')
  assert(Array.isArray(result.body.printMail.checklist), 'Print-mail checklist missing')
  result = await requestJson(
    `${frontendUrl}/api/app/v1/filing-sessions/${filingSessionId}/print-mail`,
    {
      method: 'POST',
      body: JSON.stringify({ reason: 'prefer-paper', markMailed: true })
    },
    cookieJar
  )
  assert(result.response.status === 200, 'Print-mail update failed')
  assert(result.body.printMail.packetStatus === 'mailed', 'Print-mail did not mark mailed')

  result = await requestJson(
    `${frontendUrl}/api/app/v1/filing-sessions`,
    {
      method: 'POST',
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
    },
    cookieJar
  )
  assert(result.response.status === 201, 'Failed to create rejection session')
  const rejectedSessionId = String(result.body.filingSession.id)

  result = await requestJson(
    `${frontendUrl}/api/app/v1/filing-sessions/${rejectedSessionId}/submit`,
    {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID()
      })
    },
    cookieJar
  )
  assert(result.response.status === 202, 'Rejected submission create failed')
  const rejectedSubmissionId = String(result.body.submission.id)
  const rejectedTaxReturnId = String(result.body.taxReturnId)

  internal = await requestJson(`${backendUrl}/api/v1/internal/process/${rejectedSubmissionId}`, {
    method: 'POST',
    headers: { 'x-internal-token': internalToken },
    body: JSON.stringify({ taxReturnId: rejectedTaxReturnId })
  })
  assert(internal.response.status === 200, 'Internal rejection processing failed')

  result = await requestJson(`${frontendUrl}/api/app/v1/filing-sessions/${rejectedSessionId}/submission`, { method: 'GET' }, cookieJar)
  assert(result.response.status === 200, 'Rejected submission lookup failed')
  assert(result.body.submission.lifecycleStatus === 'rejected', 'Submission did not reject')
  assert(Array.isArray(result.body.submission.rejectionErrors), 'Rejection metadata missing')

  result = await requestJson(
    `${frontendUrl}/api/app/v1/filing-sessions/${rejectedSessionId}/submission/retry`,
    {
      method: 'POST',
      body: JSON.stringify({})
    },
    cookieJar
  )
  assert(result.response.status === 202, 'Retry route failed')
  assert(result.body.retried === true, 'Retry orchestration did not report success')

  console.log('Local TaxFlow + Cloudflare E2E passed.')
  console.log(JSON.stringify({ frontendUrl, backendUrl, acceptedSessionId: filingSessionId, rejectedSessionId, acceptedSubmissionId, rejectedSubmissionId }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
