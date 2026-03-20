#!/usr/bin/env node
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { unstable_dev } from 'wrangler'

const cwd = fileURLToPath(new URL('..', import.meta.url))
const baseUrl = 'http://127.0.0.1'
const internalToken = 'integration-secret-token'

const parseJsonResponse = async (response) => {
  const text = await response.text()
  return text ? JSON.parse(text) : {}
}

const extractCookieHeader = (response) => {
  const setCookie = response.headers.get('set-cookie')
  assert.ok(setCookie, 'expected set-cookie header')
  return String(setCookie).split(';')[0]
}

const createWorkerHarness = async () => {
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
      cwd,
      stdio: 'pipe',
      env: process.env
    }
  )

  const worker = await unstable_dev('src/index.ts', {
    config: 'wrangler.toml',
    local: true,
    persistTo,
    vars: {
      INTERNAL_API_TOKEN: internalToken,
      ...(process.env.USTAXES_FRONTEND_URL
        ? { USTAXES_FRONTEND_URL: process.env.USTAXES_FRONTEND_URL }
        : {})
    },
    experimental: {
      disableExperimentalWarning: true
    }
  })

  return { worker, persistTo }
}

const withWorker = async (fn) => {
  const { worker, persistTo } = await createWorkerHarness()
  try {
    await fn(worker)
  } finally {
    await worker.stop()
    rmSync(persistTo, { recursive: true, force: true })
  }
}

const login = async (worker, payload) => {
  const response = await worker.fetch(`${baseUrl}/app/v1/auth/dev-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  })
  assert.equal(response.status, 201)
  return extractCookieHeader(response)
}

const createFilingSession = async (worker, cookie, payload) => {
  const response = await worker.fetch(`${baseUrl}/app/v1/filing-sessions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie
    },
    body: JSON.stringify(payload)
  })
  assert.equal(response.status, 201)
  const created = await parseJsonResponse(response)
  return String(created.filingSession.id)
}

const upsertEntity = async (worker, cookie, filingSessionId, entityType, entityId, label, data) => {
  const response = await worker.fetch(
    `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/entities/${entityType}/${entityId}`,
    {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        cookie
      },
      body: JSON.stringify({
        status: 'complete',
        label,
        data
      })
    }
  )
  assert.equal(response.status, 200)
}

const syncSession = async (worker, cookie, filingSessionId) => {
  const response = await worker.fetch(
    `${baseUrl}/app/v1/filing-sessions/${filingSessionId}/returns/sync`,
    {
      method: 'POST',
      headers: { cookie }
    }
  )
  assert.equal(response.status, 200)
  return parseJsonResponse(response)
}

const scenarios = {
  async auth() {
    await withWorker(async (worker) => {
      const response = await worker.fetch(
        `${baseUrl}/api/v1/internal/submissions/nonexistent/retry`,
        { method: 'POST' }
      )
      assert.equal(response.status, 401)
    })
  },

  async derivedFacts() {
    await withWorker(async (worker) => {
      const sessionCookie = await login(worker, {
        sub: 'taxflow-user-derived-facts',
        email: 'derived-facts@example.com',
        displayName: 'Derived Facts User'
      })

      const filingSessionId = await createFilingSession(worker, sessionCookie, {
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

      const payloads = [
        [
          'spouse',
          'spouse-primary',
          'Taylor Example',
          {
            filingStatus: 'mfj',
            firstName: 'Taylor',
            lastName: 'Example',
            ssn: '400-01-7777',
            dob: '1987-04-11',
            occupation: 'Teacher',
            nonresident: false,
            spouseDeceased: false
          }
        ],
        [
          'unemployment_record',
          'unemployment-primary',
          'Unemployment compensation',
          {
            amount: 6400,
            federalWithheld: 640,
            repaidAmount: 0
          }
        ],
        [
          'ssa_record',
          'ssa-primary',
          'Social Security benefits',
          {
            grossAmount: 18000,
            federalWithheld: 0,
            otherIncome: 42000,
            filingStatus: 'mfj',
            taxableEstimate: 9000
          }
        ],
        [
          'crypto_account',
          'coinbase',
          'Coinbase',
          {
            name: 'Coinbase',
            status: 'connected',
            txCount: 27,
            source: 'crypto_console'
          }
        ],
        [
          'tax_lot',
          'crypto-1',
          'BTC',
          {
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
        ]
      ]

      for (const [entityType, entityId, label, data] of payloads) {
        await upsertEntity(
          worker,
          sessionCookie,
          filingSessionId,
          entityType,
          entityId,
          label,
          data
        )
      }

      const syncResult = await syncSession(worker, sessionCookie, filingSessionId)
      const facts = syncResult.facts
      assert.equal(facts.spouse.firstName, 'Taylor')
      assert.equal(facts.incomeSummary.totalUnemployment, 6400)
      assert.equal(facts.incomeSummary.totalSocialSecurityGross, 18000)
      assert.equal(facts.investmentSummary.cryptoAccountCount, 1)
      assert.equal(facts.investmentSummary.taxLotCount, 1)
      assert.equal(facts.investmentSummary.netCapitalGain, 3400)

    })
  },

  async workbook() {
    await withWorker(async (worker) => {
      const sessionCookie = await login(worker, {
        sub: 'taxflow-user-workbook-cluster',
        email: 'workbook-cluster@example.com',
        displayName: 'Workbook Cluster User'
      })

      const filingSessionId = await createFilingSession(worker, sessionCookie, {
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

      await upsertEntity(
        worker,
        sessionCookie,
        filingSessionId,
        'w2',
        `w2-primary-${filingSessionId}`,
        'Employer Inc',
        {
          employerName: 'Employer Inc',
          ein: '12-3456789',
          box1Wages: 40000,
          box2FederalWithheld: 4000,
          owner: 'taxpayer'
        }
      )

      const syncResult = await syncSession(worker, sessionCookie, filingSessionId)
      const facts = syncResult.facts
      const incomeSummary = facts.incomeSummary
      const taxSummary = syncResult.taxSummary

      assert.equal(facts.studentLoanRecords[0].interestPaid, 2500)
      assert.equal(facts.unemploymentRecords[0].amount, 5000)
      assert.equal(facts.socialSecurityRecords[0].grossAmount, 12000)
      assert.equal(facts.iraContributions[0].traditionalContributions, 3000)
      assert.equal(facts.iraAccounts[0].grossDistribution, 9000)
      assert.equal(incomeSummary.totalRetirementDistributions, 9000)
      assert.equal(incomeSummary.totalUnemployment, 5000)
      assert.equal(incomeSummary.totalSocialSecurityGross, 12000)
      assert.ok(taxSummary.agi >= 42500)
      assert.ok(taxSummary.totalPayments >= 4500)

    })
  },

  async advanced() {
    await withWorker(async (worker) => {
      const sessionCookie = await login(worker, {
        sub: 'taxflow-user-advanced-facts',
        email: 'advanced-facts@example.com',
        displayName: 'Advanced Facts User'
      })

      const filingSessionId = await createFilingSession(worker, sessionCookie, {
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

      const entityPayloads = [
        [
          'schedule_c',
          'biz-1',
          'Consulting LLC',
          {
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
        ],
        [
          'k1_entity',
          'k1-1',
          'Maple Partners',
          {
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
        ],
        [
          'rental_property',
          'rental-1',
          'Beach rental',
          {
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
        ],
        [
          'passive_activity_loss',
          'pal-1',
          'Passive activity loss',
          {
            activelyParticipated: true,
            priorYearUnallowedLoss: 4200,
            totalRentalIncome: 24000,
            totalRentalExpenses: 22500,
            otherPassiveIncome: 0,
            otherPassiveLoss: 0
          }
        ],
        [
          'foreign_income_record',
          'foreign-income-1',
          'Germany salary',
          {
            foreignCountry: 'Germany',
            foreignEarnedIncome: 140000,
            exclusionMethod: 'physical',
            daysAbroad: 330,
            foreignTaxPaid: 8400,
            foreignTaxCountry: 'Germany'
          }
        ],
        [
          '1099_div',
          '1099-div-1',
          'US broker dividends',
          {
            payerName: 'US Broker',
            amount: 800,
            ordinaryDividends: 800,
            owner: 'taxpayer'
          }
        ],
        [
          '1099_misc',
          '1099-misc-1',
          'Licensing royalties',
          {
            payerName: 'Media Studio',
            amount: 500,
            notes: 'royalties',
            owner: 'taxpayer'
          }
        ],
        [
          'foreign_account',
          'foreign-account-1',
          'Deutsche Bank',
          {
            country: 'Germany',
            institution: 'Deutsche Bank',
            accountType: 'bank',
            maxBalanceUSD: 18000,
            currency: 'EUR',
            fbarRequired: true
          }
        ],
        [
          'treaty_claim',
          'treaty-1',
          'Germany treaty',
          {
            country: 'Germany',
            articleNumber: 'Article 15',
            incomeType: 'Employment income',
            exemptAmount: 0,
            reducedTreatyRate: 15,
            confirmed: true
          }
        ]
      ]

      for (const [entityType, entityId, label, data] of entityPayloads) {
        await upsertEntity(
          worker,
          sessionCookie,
          filingSessionId,
          entityType,
          entityId,
          label,
          data
        )
      }

      const syncResult = await syncSession(worker, sessionCookie, filingSessionId)
      const facts = syncResult.facts
      const taxSummary = syncResult.taxSummary
      assert.equal(facts.businessSummary.recordCount, 2)
      assert.equal(facts.businessSummary.finalQBIDeduction, 25000)
      assert.equal(facts.businessSummary.sstbCount, 1)
      assert.equal(facts.businessSummary.wageLimitedCount, 1)
      assert.equal((facts.k1Records ?? []).length, 1)
      assert.equal(facts.k1Records[0].partnershipName, 'Maple Partners')
      assert.equal(facts.k1Records[0].priorYearUnallowedLoss, 1400)
      assert.equal(facts.qbiDeductionData.priorYearQualifiedBusinessLossCarryforward, 5000)
      assert.equal(facts.qbiDetail.formPreference, '8995A')
      assert.equal(facts.qbiDetail.needsAdditionalStatement, true)
      assert.equal((facts.qbiDetail.overflowEntities ?? []).length, 1)
      assert.equal(facts.qbiDetail.overflowTotals.finalDeduction, 2500)
      assert.equal(facts.rentalSummary.propertyCount, 1)
      assert.equal(facts.rentalSummary.grossRentsTotal, 24000)
      assert.equal(facts.rentalSummary.k1Count, 1)
      assert.equal(facts.rentalSummary.k1RentalIncomeTotal, 2000)
      assert.equal(facts.rentalSummary.scheduleEPage2NetIncome, 23000)
      assert.equal(facts.scheduleEPage2.activeParticipationRentalRealEstate, true)
      assert.equal((facts.form1099Records ?? []).length, 2)
      assert.ok(
        (facts.treatyClaims ?? []).some(
          (claim) =>
            claim.country === 'Germany' && claim.reducedTreatyRate === 15
        )
      )
      assert.equal(facts.foreignSummary.totalForeignEarnedIncome, 140000)
      assert.equal(facts.foreignSummary.feieExclusionEstimate, 130000)
      assert.equal(facts.foreignSummary.fbarRequired, true)
      assert.equal(facts.foreignSummary.requires1040NR, true)
      assert.equal(facts.foreignSummary.scheduleNecTaxTotal, 630)
      // The dedicated worker runtime suite asserts the full taxSummary shape for
      // this advanced path. Keep the smoke check focused on derived facts so the
      // broad gate stays stable.
      if (taxSummary) {
        assert.ok((taxSummary.schedules ?? []).includes('f1040nr'))
      }

    })
  }
}

const filter = process.env.RUNTIME_SMOKE_FILTER
const order = filter
  ? filter.split(',').map((value) => value.trim()).filter(Boolean)
  : ['workbook', 'advanced', 'derivedFacts', 'auth']

for (const name of order) {
  const scenario = scenarios[name]
  assert.ok(scenario, `unknown runtime smoke scenario: ${name}`)
  console.log(`runtime smoke start: ${name}`)
  // eslint-disable-next-line no-await-in-loop
  await scenario()
  console.log(`runtime smoke done: ${name}`)
}

console.log(`runtime smoke checks passed: ${order.join(', ')}`)
