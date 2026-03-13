#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const backendRoot = path.resolve(__dirname, '..')
const usTaxesRoot = path.resolve(backendRoot, '..')

const reportPath = path.resolve(
  backendRoot,
  'reports',
  'irs_operational_feeds.json'
)

const sources = {
  knownIssuesPage:
    'https://www.irs.gov/e-file-providers/known-issues-and-solutions',
  mefStatusPage:
    'https://www.irs.gov/e-file-providers/modernized-e-file-mef-status',
  schemaTy2025Page:
    'https://www.irs.gov/e-file-providers/tax-year-2025-modernized-e-file-mef-schemas-and-business-rules-for-individual-tax-returns-and-extensions'
}

const decodeHref = (value) => value.replace(/&amp;/g, '&')

const normalizeUrl = (href) => {
  const decoded = decodeHref(href)
  if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
    return decoded
  }
  if (decoded.startsWith('/')) {
    return `https://www.irs.gov${decoded}`
  }
  return decoded
}

const extractHrefs = (html) =>
  [...html.matchAll(/href="([^"]+)"/g)].map((match) => normalizeUrl(match[1]))

const stripTags = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const fetchHtml = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'ustaxes-backend-cloudflare/irs-feed-sync'
    }
  })

  const html = await response.text()
  return {
    url,
    fetchedAt: new Date().toISOString(),
    status: response.status,
    ok: response.ok,
    html
  }
}

const parseKnownIssues = (html) => {
  const hrefs = extractHrefs(html)
  const workbookLinks = hrefs.filter(
    (href) => /known[-_ ]issues/i.test(href) && /\.(xlsx|xls)$/i.test(href)
  )

  const yearlyFiles = workbookLinks
    .map((url) => {
      const match = url.match(/ty(\d{4})/i)
      return {
        taxYear: match ? Number(match[1]) : null,
        url
      }
    })
    .sort((left, right) => (right.taxYear ?? 0) - (left.taxYear ?? 0))

  return {
    workbookLinkCount: workbookLinks.length,
    workbookLinks,
    yearlyFiles,
    ty2025WorkbookUrl:
      yearlyFiles.find((item) => item.taxYear === 2025)?.url ?? null
  }
}

const parseMefStatus = (html) => {
  const hrefs = extractHrefs(html)
  const text = stripTags(html)

  const productionCallLogs = hrefs.filter((href) =>
    /mef-production-call-log-\d{8}\.pdf$/i.test(href)
  )
  const resiliencyFaqUrl =
    hrefs.find((href) => /mef_resilienc(y|e)_faqs\.pdf$/i.test(href)) ?? null

  return {
    productionCallLogCount: productionCallLogs.length,
    productionCallLogs,
    resiliencyFaqUrl,
    hasResiliencyLanguage: /MeF resiliency/i.test(text),
    hasGetAckUnavailableLanguage:
      /Get Acknowledgments[^.]{0,200}not be available/i.test(text),
    hasSha256RequirementLanguage: /SHA-1/i.test(text) && /SHA-256/i.test(text)
  }
}

const parseSchemaTy2025 = (html) => {
  const hrefs = extractHrefs(html)
  const releaseMemos = hrefs.filter((href) => /release-memo/i.test(href))
  const scenarioPdfs = hrefs.filter((href) =>
    /ats-scenario-\d+.*\.pdf$/i.test(href)
  )

  return {
    releaseMemoCount: releaseMemos.length,
    releaseMemos,
    scenarioPdfCount: scenarioPdfs.length,
    scenarioPdfs
  }
}

const main = async () => {
  const [knownIssuesResponse, mefStatusResponse, schemaResponse] =
    await Promise.all([
      fetchHtml(sources.knownIssuesPage),
      fetchHtml(sources.mefStatusPage),
      fetchHtml(sources.schemaTy2025Page)
    ])

  const knownIssues = parseKnownIssues(knownIssuesResponse.html)
  const mefStatus = parseMefStatus(mefStatusResponse.html)
  const schemaTy2025 = parseSchemaTy2025(schemaResponse.html)

  const report = {
    generated_at: new Date().toISOString(),
    sources: {
      known_issues_page: {
        url: knownIssuesResponse.url,
        status: knownIssuesResponse.status,
        ok: knownIssuesResponse.ok,
        fetched_at: knownIssuesResponse.fetchedAt
      },
      mef_status_page: {
        url: mefStatusResponse.url,
        status: mefStatusResponse.status,
        ok: mefStatusResponse.ok,
        fetched_at: mefStatusResponse.fetchedAt
      },
      schema_ty2025_page: {
        url: schemaResponse.url,
        status: schemaResponse.status,
        ok: schemaResponse.ok,
        fetched_at: schemaResponse.fetchedAt
      }
    },
    known_issues: knownIssues,
    mef_status: mefStatus,
    schema_ty2025: schemaTy2025
  }

  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  console.log(
    `Wrote IRS operational feed snapshot: ${path.relative(
      usTaxesRoot,
      reportPath
    )}`
  )
  console.log(
    `Known-issues workbooks found: ${knownIssues.workbookLinkCount}; production call logs found: ${mefStatus.productionCallLogCount}`
  )
}

await main()
