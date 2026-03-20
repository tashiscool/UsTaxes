/**
 * Document Extraction Service
 *
 * Uses Cloudflare Workers AI (LLaVA vision model) for images and lightweight
 * heuristic parsing for text-based PDFs / CSVs to extract structured tax data.
 */

export interface ExtractedW2 {
  employerName?: string
  ein?: string
  box1Wages?: number
  box2FedWithholding?: number
  box12Codes?: Array<{ code: string; amount: number }>
  box16StateWages?: number
  box17StateWithholding?: number
  confidence: number
}

export interface Extracted1099Base {
  payerName?: string
  federalTaxWithheld?: number
  stateTaxWithheld?: number
  owner?: 'taxpayer' | 'spouse'
  confidence: number
}

export interface Extracted1099Int extends Extracted1099Base {
  interestIncome?: number
  earlyWithdrawalPenalty?: number
  taxExemptInterest?: number
  foreignTaxPaid?: number
}

export interface Extracted1099Div extends Extracted1099Base {
  ordinaryDividends?: number
  qualifiedDividends?: number
  capitalGainDistributions?: number
  section199ADividends?: number
  exemptInterestDividends?: number
  foreignTaxPaid?: number
}

export interface Extracted1099Nec extends Extracted1099Base {
  nonemployeeCompensation?: number
}

export interface Extracted1099Misc extends Extracted1099Base {
  rents?: number
  royalties?: number
  otherIncome?: number
  section409ADeferrals?: number
  nonqualifiedDeferredComp?: number
}

export interface Extracted1099R extends Extracted1099Base {
  grossDistribution?: number
  taxableAmount?: number
  distributionCode?: string
  iraSepSimple?: boolean
}

export interface Extracted1099G extends Extracted1099Base {
  unemploymentCompensation?: number
  stateRefund?: number
}

export interface Extracted1099SSA extends Extracted1099Base {
  benefitsPaid?: number
  medicarePartBPremiums?: number
}

export interface Extracted1099BTransaction {
  description?: string
  term?: 'short' | 'long' | 'unknown'
  proceeds?: number
  costBasis?: number
}

export interface Extracted1099B extends Extracted1099Base {
  shortTermProceeds?: number
  shortTermCostBasis?: number
  longTermProceeds?: number
  longTermCostBasis?: number
  transactions?: Extracted1099BTransaction[]
}

export interface Extracted1098E {
  lenderName?: string
  studentLoanInterest?: number
  confidence: number
}

export interface Extracted1098T {
  institutionName?: string
  studentName?: string
  qualifiedTuitionExpenses?: number
  scholarshipsOrGrants?: number
  adjustmentsFromPriorYear?: number
  confidence: number
}

export interface Extracted1095A {
  policyNumber?: string
  coveredPersons?: number
  annualEnrollmentPremium?: number
  annualSlcsp?: number
  annualAdvancePayment?: number
  coverageStart?: string
  coverageEnd?: string
  confidence: number
}

export interface ExtractedMortgage1098 {
  lenderName?: string
  mortgageInterest?: number
  propertyTaxes?: number
  points?: number
  mortgageInsurancePremiums?: number
  confidence: number
}

export interface ExtractedChildcareStatement {
  providerName?: string
  providerTin?: string
  amountPaid?: number
  address?: string
  confidence: number
}

export interface ExtractedCharityReceipt {
  doneeName?: string
  cashContribution?: number
  noncashContribution?: number
  propertyDescription?: string
  deductionClaimed?: number
  grossProceeds?: number
  form1098CAttached?: boolean
  confidence: number
}

export interface ExtractedK1 {
  issuerName?: string
  issuerEin?: string
  businessType?: 'partnership' | 's_corp' | 'trust'
  ordinaryBusinessIncome?: number
  rentalRealEstateIncome?: number
  otherRentalIncome?: number
  royalties?: number
  interestIncome?: number
  guaranteedPayments?: number
  section199AQBI?: number
  section199AW2Wages?: number
  section199AUbia?: number
  confidence: number
}

export interface ExtractedDocument {
  documentType:
    | 'w2'
    | '1099-nec'
    | '1099-int'
    | '1099-div'
    | '1099-misc'
    | '1099-r'
    | '1099-g'
    | '1099-ssa'
    | '1099-b'
    | '1098-e'
    | '1098-t'
    | '1095-a'
    | '1098-mortgage'
    | 'childcare'
    | 'charity-receipt'
    | '1098-c'
    | 'k-1'
    | 'unknown'
  w2?: ExtractedW2
  form1099Int?: Extracted1099Int
  form1099Div?: Extracted1099Div
  form1099Nec?: Extracted1099Nec
  form1099Misc?: Extracted1099Misc
  form1099R?: Extracted1099R
  form1099G?: Extracted1099G
  form1099Ssa?: Extracted1099SSA
  form1099B?: Extracted1099B
  form1098E?: Extracted1098E
  form1098T?: Extracted1098T
  form1095A?: Extracted1095A
  mortgage1098?: ExtractedMortgage1098
  childcareStatement?: ExtractedChildcareStatement
  charityReceipt?: ExtractedCharityReceipt
  scheduleK1?: ExtractedK1
  raw?: Record<string, unknown>
  confidence: number
  processingTimeMs: number
}

const EXTRACTION_PROMPT =
  'You are a tax document parser. Extract all tax fields from this document image as JSON. ' +
  'Identify the document type (w2, 1099-nec, 1099-int, 1099-div, 1099-misc, 1099-r, 1099-g, 1099-ssa, 1099-b, 1098-e, 1098-t, 1095-a, 1098-mortgage, childcare, charity-receipt, 1098-c, k-1). ' +
  'For W-2: extract employerName, ein, box1Wages, box2FedWithholding, box12Codes (array of {code, amount}), box16StateWages, box17StateWithholding. ' +
  'For 1099-INT: extract payerName, interestIncome, earlyWithdrawalPenalty, federalTaxWithheld, taxExemptInterest, foreignTaxPaid. ' +
  'For 1099-DIV: extract payerName, ordinaryDividends, qualifiedDividends, capitalGainDistributions, section199ADividends, federalTaxWithheld, exemptInterestDividends, foreignTaxPaid. ' +
  'For 1099-MISC: extract payerName, rents, royalties, otherIncome, federalTaxWithheld, section409ADeferrals, nonqualifiedDeferredComp. ' +
  'For 1099-NEC: extract payerName, nonemployeeCompensation, federalTaxWithheld. ' +
  'For 1099-R: extract payerName, grossDistribution, taxableAmount, federalTaxWithheld, distributionCode, iraSepSimple. ' +
  'For 1099-G: extract payerName, unemploymentCompensation, stateRefund, federalTaxWithheld, stateTaxWithheld. ' +
  'For SSA-1099 / 1099-SSA: extract payerName, benefitsPaid, federalTaxWithheld, medicarePartBPremiums. ' +
  'For 1099-B: extract payerName, shortTermProceeds, shortTermCostBasis, longTermProceeds, longTermCostBasis, federalTaxWithheld, transactions. ' +
  'For 1098-E: extract lenderName, studentLoanInterest. ' +
  'For 1098-T: extract institutionName, studentName, qualifiedTuitionExpenses, scholarshipsOrGrants, adjustmentsFromPriorYear. ' +
  'For 1095-A: extract policyNumber, coveredPersons, annualEnrollmentPremium, annualSlcsp, annualAdvancePayment, coverageStart, coverageEnd. ' +
  'For Form 1098 mortgage statements: extract lenderName, mortgageInterest, propertyTaxes, points, mortgageInsurancePremiums. ' +
  'For childcare receipts or provider statements: extract providerName, providerTin, amountPaid, address. ' +
  'For charitable receipts or Form 1098-C: extract doneeName, cashContribution, noncashContribution, propertyDescription, deductionClaimed, grossProceeds, form1098CAttached. ' +
  'For Schedule K-1: extract issuerName, issuerEin, businessType, ordinaryBusinessIncome, rentalRealEstateIncome, otherRentalIncome, royalties, interestIncome, guaranteedPayments, section199AQBI, section199AW2Wages, section199AUbia. ' +
  'Respond ONLY with valid JSON.'

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '')
    const n = parseFloat(cleaned)
    return Number.isNaN(n) ? undefined : n
  }
  return undefined
}

function parseBox12Codes(
  value: unknown
): Array<{ code: string; amount: number }> | undefined {
  if (!Array.isArray(value)) return undefined
  const result: Array<{ code: string; amount: number }> = []
  for (const entry of value) {
    if (
      entry &&
      typeof entry === 'object' &&
      'code' in entry &&
      'amount' in entry
    ) {
      const amount = parseNumber((entry as Record<string, unknown>).amount)
      if (
        typeof (entry as Record<string, unknown>).code === 'string' &&
        amount !== undefined
      ) {
        result.push({
          code: (entry as Record<string, unknown>).code as string,
          amount
        })
      }
    }
  }
  return result.length > 0 ? result : undefined
}

function parseInteger(value: unknown): number | undefined {
  const parsed = parseNumber(value)
  return parsed == null ? undefined : Math.round(parsed)
}

const sanitizeText = (value: string): string =>
  value
    .replace(/\u0000/g, ' ')
    .replace(/[\r\t]+/g, ' ')
    .replace(/[^\x20-\x7E\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const sanitizeLine = (value: string): string =>
  value
    .replace(/\u0000/g, ' ')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()

const fileLabelFallback = (name: string): string =>
  name
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const firstTextMatch = (
  text: string,
  patterns: RegExp[],
  fallback?: string
): string | undefined => {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      return sanitizeText(match[1])
    }
  }
  return fallback && fallback.length > 0 ? fallback : undefined
}

const firstNumberMatch = (text: string, patterns: RegExp[]): number | undefined => {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    const parsed = parseNumber(match?.[1])
    if (parsed !== undefined) {
      return parsed
    }
  }
  return undefined
}

const detectDocumentTypeFromText = (
  text: string,
  documentName: string
): ExtractedDocument['documentType'] => {
  const search = `${text} ${documentName}`.toLowerCase()

  if (/1098\s*-?\s*t|tuition statement/.test(search)) return '1098-t'
  if (/schedule\s*k\s*-?\s*1|\bk-1\b/.test(search)) return 'k-1'
  if (/1099\s*-?\s*misc|miscellaneous income/.test(search)) return '1099-misc'
  if (/1099\s*-?\s*b|proceeds from broker|broker and barter/.test(search))
    return '1099-b'
  if (/1098\s*-?\s*e|student loan interest/.test(search)) return '1098-e'
  if (/1095\s*-?\s*a|health insurance marketplace/.test(search))
    return '1095-a'
  if (
    /child\s*care|childcare|daycare|dependent care|care provider|provider statement/.test(
      search
    )
  ) {
    return 'childcare'
  }
  if (/mortgage interest statement|form 1098/.test(search))
    return '1098-mortgage'
  if (/1099\s*-?\s*g|unemployment compensation/.test(search))
    return '1099-g'
  if (/ssa\s*-?\s*1099|social security benefit statement/.test(search))
    return '1099-ssa'
  if (/1099\s*-?\s*int|interest income/.test(search)) return '1099-int'
  if (/1099\s*-?\s*div|dividends and distributions/.test(search))
    return '1099-div'
  if (/1099\s*-?\s*nec|nonemployee compensation/.test(search))
    return '1099-nec'
  if (/1099\s*-?\s*r|distributions from pensions/.test(search))
    return '1099-r'
  if (/1098\s*-?\s*c|contributions of motor vehicles/.test(search))
    return '1098-c'
  if (
    /charity|charitable|donation receipt|contribution receipt|goodwill|salvation army/.test(
      search
    )
  ) {
    return 'charity-receipt'
  }
  return 'unknown'
}

const heuristicBrokerTransactions = (
  payerName: string,
  shortTermProceeds: number,
  shortTermCostBasis: number,
  longTermProceeds: number,
  longTermCostBasis: number
): Extracted1099BTransaction[] => {
  const transactions: Extracted1099BTransaction[] = []
  if (shortTermProceeds > 0 || shortTermCostBasis > 0) {
    transactions.push({
      description: `${payerName || 'Brokerage'} short-term summary`,
      term: 'short',
      proceeds: shortTermProceeds,
      costBasis: shortTermCostBasis
    })
  }
  if (longTermProceeds > 0 || longTermCostBasis > 0) {
    transactions.push({
      description: `${payerName || 'Brokerage'} long-term summary`,
      term: 'long',
      proceeds: longTermProceeds,
      costBasis: longTermCostBasis
    })
  }
  return transactions
}

const extractBrokerTransactionsFromText = (
  text: string,
  payerName: string
): Extracted1099BTransaction[] => {
  const lines = text
    .split(/\n+/)
    .map(sanitizeLine)
    .filter((line) => line.length > 0)

  const seen = new Set<string>()
  const transactions: Extracted1099BTransaction[] = []
  const moneyPattern = /-?\$?\d[\d,]*(?:\.\d{2})?/g

  for (const line of lines) {
    const amounts = [...line.matchAll(moneyPattern)]
      .map((match) => parseNumber(match[0]))
      .filter((value): value is number => value !== undefined)

    if (amounts.length < 2) continue
    if (
      /form 1099-b|proceeds from broker|broker and barter|covered short-term|covered long-term|basis reported to irs|page \d+/i.test(
        line
      )
    ) {
      continue
    }

    const description = line
      .replace(moneyPattern, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (description.length < 3) continue

    const term: 'short' | 'long' | 'unknown' = /short|st\b/i.test(line)
      ? 'short'
      : /long|lt\b/i.test(line)
      ? 'long'
      : 'unknown'

    const proceeds = amounts[0]
    const costBasis = amounts[1]
    if (proceeds <= 0 && costBasis <= 0) continue

    const key = `${description}|${term}|${proceeds}|${costBasis}`
    if (seen.has(key)) continue
    seen.add(key)

    transactions.push({
      description,
      term,
      proceeds,
      costBasis
    })

    if (transactions.length >= 25) break
  }

  return transactions.length > 0
    ? transactions
    : heuristicBrokerTransactions(payerName, 0, 0, 0, 0)
}

const parseTextDocumentToRecord = (
  text: string,
  documentName: string
): Record<string, unknown> => {
  const fallbackName = fileLabelFallback(documentName)
  const documentType = detectDocumentTypeFromText(text, fallbackName)
  const commonEin = firstTextMatch(text, [/\b(\d{2}-\d{7})\b/], undefined)

  switch (documentType) {
    case '1098-t':
      return {
        documentType,
        institutionName: firstTextMatch(text, [
          /(?:filer'?s name|institution(?: name)?|school name)\s*[:\-]?\s*([A-Za-z0-9&.,' -]{4,})/i
        ], fallbackName),
        studentName: firstTextMatch(text, [
          /(?:student'?s name|recipient'?s name)\s*[:\-]?\s*([A-Za-z0-9&.,' -]{4,})/i
        ]),
        qualifiedTuitionExpenses: firstNumberMatch(text, [
          /(?:payments received for qualified tuition and related expenses|qualified tuition(?: and related expenses)?|box\s*1)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i
        ]),
        scholarshipsOrGrants: firstNumberMatch(text, [
          /(?:scholarships or grants|box\s*5)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i
        ]),
        adjustmentsFromPriorYear: firstNumberMatch(text, [
          /(?:adjustments made for a prior year|box\s*4)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i
        ])
      }
    case '1099-misc':
      return {
        documentType,
        payerName: firstTextMatch(text, [
          /(?:payer'?s name|payer name)\s*[:\-]?\s*([A-Za-z0-9&.,' -]{4,})/i
        ], fallbackName),
        rents: firstNumberMatch(text, [/(?:rents|box\s*1)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i]),
        royalties: firstNumberMatch(text, [/(?:royalties|box\s*2)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i]),
        otherIncome: firstNumberMatch(text, [/(?:other income|box\s*3)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i]),
        federalTaxWithheld: firstNumberMatch(text, [/(?:federal income tax withheld|box\s*4)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i]),
        section409ADeferrals: firstNumberMatch(text, [/(?:section 409a deferrals|box\s*12)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i]),
        nonqualifiedDeferredComp: firstNumberMatch(text, [/(?:nonqualified deferred compensation|box\s*15)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i])
      }
    case 'k-1':
      return {
        documentType,
        issuerName: firstTextMatch(text, [
          /(?:partnership'?s name|s corporation'?s name|estate or trust name|name of partnership|name of corporation|name of estate or trust)\s*[:\-]?\s*([A-Za-z0-9&.,' -]{4,})/i
        ], fallbackName),
        issuerEin: commonEin,
        businessType: /1120\s*-?s/i.test(text)
          ? 's_corp'
          : /1041/i.test(text)
          ? 'trust'
          : 'partnership',
        ordinaryBusinessIncome: firstNumberMatch(text, [
          /(?:ordinary business income|ordinary income|box\s*1)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i
        ]),
        rentalRealEstateIncome: firstNumberMatch(text, [
          /(?:net rental real estate income|box\s*2)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i
        ]),
        otherRentalIncome: firstNumberMatch(text, [
          /(?:other net rental income|box\s*3)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i
        ]),
        interestIncome: firstNumberMatch(text, [
          /(?:interest income|box\s*5)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i
        ]),
        royalties: firstNumberMatch(text, [
          /(?:royalties|box\s*7)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i
        ]),
        guaranteedPayments: firstNumberMatch(text, [
          /(?:guaranteed payments|box\s*4)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i
        ]),
        section199AQBI: firstNumberMatch(text, [
          /(?:qualified business income|qbi|section 199a.*?income)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i
        ]),
        section199AW2Wages: firstNumberMatch(text, [
          /(?:w-2 wages|section 199a.*?w-2 wages)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i
        ]),
        section199AUbia: firstNumberMatch(text, [
          /(?:ubia|qualified property)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i
        ])
      }
    case '1099-b': {
      const payerName = firstTextMatch(text, [
        /(?:payer'?s name|broker(?: or barter exchange)? name|broker)\s*[:\-]?\s*([A-Za-z0-9&.,' -]{4,})/i
      ], fallbackName)
      const shortTermProceeds = firstNumberMatch(text, [
        /(?:short-?term[^.]{0,80}?proceeds|covered short-?term[^.]{0,80}?proceeds)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i,
        /(?:short-?term sales proceeds)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i
      ]) ?? 0
      const shortTermCostBasis = firstNumberMatch(text, [
        /(?:short-?term[^.]{0,80}?(?:cost basis|basis)|covered short-?term[^.]{0,80}?(?:cost basis|basis))\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i
      ]) ?? 0
      const longTermProceeds = firstNumberMatch(text, [
        /(?:long-?term[^.]{0,80}?proceeds|covered long-?term[^.]{0,80}?proceeds)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i,
        /(?:long-?term sales proceeds)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i
      ]) ?? 0
      const longTermCostBasis = firstNumberMatch(text, [
        /(?:long-?term[^.]{0,80}?(?:cost basis|basis)|covered long-?term[^.]{0,80}?(?:cost basis|basis))\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i
      ]) ?? 0
      const transactions = extractBrokerTransactionsFromText(
        text,
        payerName ?? fallbackName
      )
      return {
        documentType,
        payerName,
        shortTermProceeds,
        shortTermCostBasis,
        longTermProceeds,
        longTermCostBasis,
        federalTaxWithheld: firstNumberMatch(text, [
          /(?:federal income tax withheld|backup withholding)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i
        ]),
        transactions:
          transactions.length > 0
            ? transactions
            : heuristicBrokerTransactions(
                payerName ?? fallbackName,
                shortTermProceeds,
                shortTermCostBasis,
                longTermProceeds,
                longTermCostBasis
              )
      }
    }
    case '1098-e':
      return {
        documentType,
        lenderName: firstTextMatch(text, [
          /(?:lender|recipient\/lender)\s*[:\-]?\s*([A-Za-z0-9&.,' -]{4,})/i
        ], fallbackName),
        studentLoanInterest: firstNumberMatch(text, [
          /(?:student loan interest received by lender|student loan interest|box\s*1)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i
        ])
      }
    case '1095-a':
      return {
        documentType,
        policyNumber: firstTextMatch(text, [/(?:policy number)\s*[:\-]?\s*([A-Za-z0-9-]{3,})/i]),
        coveredPersons: parseInteger(
          firstNumberMatch(text, [/(?:covered individuals|covered persons)\D{0,15}([\d]+)/i])
        ),
        annualEnrollmentPremium: firstNumberMatch(text, [
          /(?:annual enrollment premiums|enrollment premiums)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i
        ]),
        annualSlcsp: firstNumberMatch(text, [
          /(?:annual slcsp|second lowest cost silver plan|slcsp)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i
        ]),
        annualAdvancePayment: firstNumberMatch(text, [
          /(?:advance payment of premium tax credit|annual aptc|advance payments)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i
        ])
      }
    case '1098-mortgage':
      return {
        documentType,
        lenderName: firstTextMatch(text, [
          /(?:recipient\/lender|lender)\s*[:\-]?\s*([A-Za-z0-9&.,' -]{4,})/i
        ], fallbackName),
        mortgageInterest: firstNumberMatch(text, [
          /(?:mortgage interest received from payer\/borrower|mortgage interest|box\s*1)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i
        ]),
        mortgageInsurancePremiums: firstNumberMatch(text, [
          /(?:mortgage insurance premiums|box\s*5)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i
        ]),
        points: firstNumberMatch(text, [/(?:points paid on purchase of principal residence|points|box\s*6)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i]),
        propertyTaxes: firstNumberMatch(text, [/(?:property taxes|box\s*10)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i])
      }
    case 'childcare':
      return {
        documentType,
        providerName: firstTextMatch(text, [
          /(?:provider(?:'s)? name)\s*[:\-]?\s*([A-Za-z0-9&.,' -]{4,})/i
        ], fallbackName),
        providerTin: firstTextMatch(text, [
          /(?:provider tin|provider tax id|provider tax identification number|tin|ein|ssn)\s*[:\-]?\s*([0-9-]{9,11})/i
        ]),
        amountPaid: firstNumberMatch(text, [
          /(?:amount paid|total paid|payments)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i
        ]),
        address: firstTextMatch(text, [
          /(?:address)\s*[:\-]?\s*([A-Za-z0-9#.,' -]{6,})/i
        ])
      }
    case '1099-g':
      return {
        documentType,
        payerName: fallbackName,
        unemploymentCompensation: firstNumberMatch(text, [/(?:unemployment compensation|box\s*1)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i]),
        federalTaxWithheld: firstNumberMatch(text, [/(?:federal income tax withheld|box\s*4)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i])
      }
    case '1099-ssa':
      return {
        documentType,
        payerName: 'Social Security Administration',
        benefitsPaid: firstNumberMatch(text, [/(?:benefits paid|net benefits for 2025|box\s*5)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i]),
        federalTaxWithheld: firstNumberMatch(text, [/(?:federal income tax withheld|box\s*6)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i]),
        medicarePartBPremiums: firstNumberMatch(text, [/(?:medicare part b premiums|part b)\D{0,25}([-$]?[\d,]+(?:\.\d{2})?)/i])
      }
    default:
      return { documentType: 'unknown' }
  }
}

function buildExtractedDocument(
  parsed: Record<string, unknown>,
  processingTimeMs: number
): ExtractedDocument {
  const rawType =
    (parsed.documentType as string | undefined)?.toLowerCase() ?? 'unknown'
  const docType = [
    'w2',
    '1099-nec',
    '1099-int',
    '1099-div',
    '1099-misc',
    '1099-r',
    '1099-g',
    '1099-ssa',
    '1099-b',
    '1098-e',
    '1098-t',
    '1095-a',
    '1098-mortgage',
    'childcare',
    'charity-receipt',
    '1098-c',
    'k-1'
  ].includes(rawType)
    ? (rawType as ExtractedDocument['documentType'])
    : 'unknown'

  const w2: ExtractedW2 | undefined =
    docType === 'w2'
      ? {
          employerName:
            typeof parsed.employerName === 'string'
              ? parsed.employerName
              : undefined,
          ein: typeof parsed.ein === 'string' ? parsed.ein : undefined,
          box1Wages: parseNumber(parsed.box1Wages),
          box2FedWithholding: parseNumber(parsed.box2FedWithholding),
          box12Codes: parseBox12Codes(parsed.box12Codes),
          box16StateWages: parseNumber(parsed.box16StateWages),
          box17StateWithholding: parseNumber(parsed.box17StateWithholding),
          confidence: docType === 'w2' ? 0.85 : 0.5
        }
      : undefined

  const shared1099 = {
    payerName:
      typeof parsed.payerName === 'string' ? parsed.payerName : undefined,
    federalTaxWithheld: parseNumber(
      parsed.federalTaxWithheld ?? parsed.box4FedWithholding
    ),
    stateTaxWithheld: parseNumber(
      parsed.stateTaxWithheld ?? parsed.box15StateWithholding
    ),
    owner:
      parsed.owner === 'spouse' || parsed.owner === 'taxpayer'
        ? (parsed.owner as 'taxpayer' | 'spouse')
        : undefined,
    confidence: docType !== 'unknown' ? 0.82 : 0.5
  }

  const form1099Int: Extracted1099Int | undefined =
    docType === '1099-int'
      ? {
          ...shared1099,
          interestIncome: parseNumber(parsed.interestIncome ?? parsed.box1),
          earlyWithdrawalPenalty: parseNumber(
            parsed.earlyWithdrawalPenalty ?? parsed.box2
          ),
          taxExemptInterest: parseNumber(
            parsed.taxExemptInterest ?? parsed.box8
          ),
          foreignTaxPaid: parseNumber(parsed.foreignTaxPaid ?? parsed.box6)
        }
      : undefined

  const form1099Div: Extracted1099Div | undefined =
    docType === '1099-div'
      ? {
          ...shared1099,
          ordinaryDividends: parseNumber(
            parsed.ordinaryDividends ?? parsed.box1a
          ),
          qualifiedDividends: parseNumber(
            parsed.qualifiedDividends ?? parsed.box1b
          ),
          capitalGainDistributions: parseNumber(
            parsed.capitalGainDistributions ?? parsed.box2a
          ),
          section199ADividends: parseNumber(
            parsed.section199ADividends ?? parsed.box5
          ),
          exemptInterestDividends: parseNumber(
            parsed.exemptInterestDividends ?? parsed.box12
          ),
          foreignTaxPaid: parseNumber(parsed.foreignTaxPaid ?? parsed.box7)
        }
      : undefined

  const form1099Nec: Extracted1099Nec | undefined =
    docType === '1099-nec'
      ? {
          ...shared1099,
          nonemployeeCompensation: parseNumber(
            parsed.nonemployeeCompensation ?? parsed.box1
          )
        }
      : undefined

  const form1099Misc: Extracted1099Misc | undefined =
    docType === '1099-misc'
      ? {
          ...shared1099,
          rents: parseNumber(parsed.rents ?? parsed.box1),
          royalties: parseNumber(parsed.royalties ?? parsed.box2),
          otherIncome: parseNumber(parsed.otherIncome ?? parsed.box3),
          section409ADeferrals: parseNumber(
            parsed.section409ADeferrals ?? parsed.box12
          ),
          nonqualifiedDeferredComp: parseNumber(
            parsed.nonqualifiedDeferredComp ?? parsed.box15
          )
        }
      : undefined

  const form1099R: Extracted1099R | undefined =
    docType === '1099-r'
      ? {
          ...shared1099,
          grossDistribution: parseNumber(
            parsed.grossDistribution ?? parsed.box1
          ),
          taxableAmount: parseNumber(parsed.taxableAmount ?? parsed.box2a),
          distributionCode:
            typeof parsed.distributionCode === 'string'
              ? parsed.distributionCode
              : undefined,
          iraSepSimple:
            typeof parsed.iraSepSimple === 'boolean'
              ? parsed.iraSepSimple
              : undefined
        }
      : undefined

  const form1099G: Extracted1099G | undefined =
    docType === '1099-g'
      ? {
          ...shared1099,
          unemploymentCompensation: parseNumber(
            parsed.unemploymentCompensation ?? parsed.box1
          ),
          stateRefund: parseNumber(parsed.stateRefund ?? parsed.box2)
        }
      : undefined

  const form1099Ssa: Extracted1099SSA | undefined =
    docType === '1099-ssa'
      ? {
          ...shared1099,
          benefitsPaid: parseNumber(
            parsed.benefitsPaid ?? parsed.netBenefits ?? parsed.box5
          ),
          medicarePartBPremiums: parseNumber(
            parsed.medicarePartBPremiums ?? parsed.box3
          )
        }
      : undefined

  const form1099B: Extracted1099B | undefined =
    docType === '1099-b'
      ? {
          ...shared1099,
          shortTermProceeds: parseNumber(
            parsed.shortTermProceeds ?? parsed.shortTermSalesProceeds
          ),
          shortTermCostBasis: parseNumber(
            parsed.shortTermCostBasis ?? parsed.shortTermBasis
          ),
          longTermProceeds: parseNumber(
            parsed.longTermProceeds ?? parsed.longTermSalesProceeds
          ),
          longTermCostBasis: parseNumber(
            parsed.longTermCostBasis ?? parsed.longTermBasis
          ),
          transactions: Array.isArray(parsed.transactions)
            ? parsed.transactions
                .map((item) => {
                  const raw = item as Record<string, unknown>
                  return {
                    description:
                      typeof raw.description === 'string'
                        ? raw.description
                        : undefined,
                    term:
                      raw.term === 'short' ||
                      raw.term === 'long' ||
                      raw.term === 'unknown'
                        ? (raw.term as 'short' | 'long' | 'unknown')
                        : undefined,
                    proceeds: parseNumber(raw.proceeds),
                    costBasis: parseNumber(raw.costBasis ?? raw.basis)
                  }
                })
                .filter(
                  (item) =>
                    item.proceeds != null ||
                    item.costBasis != null ||
                    Boolean(item.description)
                )
            : undefined
        }
      : undefined

  const form1098E: Extracted1098E | undefined =
    docType === '1098-e'
      ? {
          lenderName:
            typeof parsed.lenderName === 'string'
              ? parsed.lenderName
              : typeof parsed.payerName === 'string'
              ? parsed.payerName
              : undefined,
          studentLoanInterest: parseNumber(
            parsed.studentLoanInterest ?? parsed.interestPaid ?? parsed.box1
          ),
          confidence: 0.82
        }
      : undefined

  const form1098T: Extracted1098T | undefined =
    docType === '1098-t'
      ? {
          institutionName:
            typeof parsed.institutionName === 'string'
              ? parsed.institutionName
              : undefined,
          studentName:
            typeof parsed.studentName === 'string'
              ? parsed.studentName
              : undefined,
          qualifiedTuitionExpenses: parseNumber(
            parsed.qualifiedTuitionExpenses ?? parsed.box1
          ),
          scholarshipsOrGrants: parseNumber(
            parsed.scholarshipsOrGrants ?? parsed.box5
          ),
          adjustmentsFromPriorYear: parseNumber(
            parsed.adjustmentsFromPriorYear ?? parsed.box4
          ),
          confidence: 0.82
        }
      : undefined

  const form1095A: Extracted1095A | undefined =
    docType === '1095-a'
      ? {
          policyNumber:
            typeof parsed.policyNumber === 'string'
              ? parsed.policyNumber
              : undefined,
          coveredPersons: parseInteger(
            parsed.coveredPersons ?? parsed.coverageFamily
          ),
          annualEnrollmentPremium: parseNumber(
            parsed.annualEnrollmentPremium ??
              parsed.enrollmentPremiums ??
              parsed.annualPremium
          ),
          annualSlcsp: parseNumber(
            parsed.annualSlcsp ?? parsed.slcsp ?? parsed.secondLowestCostPlan
          ),
          annualAdvancePayment: parseNumber(
            parsed.annualAdvancePayment ??
              parsed.advancePayments ??
              parsed.annualAPTC
          ),
          coverageStart:
            typeof parsed.coverageStart === 'string'
              ? parsed.coverageStart
              : typeof parsed.coverageStartDate === 'string'
              ? parsed.coverageStartDate
              : undefined,
          coverageEnd:
            typeof parsed.coverageEnd === 'string'
              ? parsed.coverageEnd
              : typeof parsed.coverageEndDate === 'string'
              ? parsed.coverageEndDate
              : undefined,
          confidence: 0.82
        }
      : undefined

  const mortgage1098: ExtractedMortgage1098 | undefined =
    docType === '1098-mortgage'
      ? {
          lenderName:
            typeof parsed.lenderName === 'string'
              ? parsed.lenderName
              : typeof parsed.payerName === 'string'
              ? parsed.payerName
              : undefined,
          mortgageInterest: parseNumber(
            parsed.mortgageInterest ?? parsed.homeMortgageInterest ?? parsed.box1
          ),
          propertyTaxes: parseNumber(parsed.propertyTaxes ?? parsed.box10),
          points: parseNumber(parsed.points ?? parsed.box6),
          mortgageInsurancePremiums: parseNumber(
            parsed.mortgageInsurancePremiums ?? parsed.box5
          ),
          confidence: 0.82
        }
      : undefined

  const childcareStatement: ExtractedChildcareStatement | undefined =
    docType === 'childcare'
      ? {
          providerName:
            typeof parsed.providerName === 'string'
              ? parsed.providerName
              : undefined,
          providerTin:
            typeof parsed.providerTin === 'string'
              ? parsed.providerTin
              : typeof parsed.tin === 'string'
              ? parsed.tin
              : undefined,
          amountPaid: parseNumber(parsed.amountPaid ?? parsed.totalPaid),
          address:
            typeof parsed.address === 'string' ? parsed.address : undefined,
          confidence: 0.78
        }
      : undefined

  const charityReceipt: ExtractedCharityReceipt | undefined =
    docType === 'charity-receipt' || docType === '1098-c'
      ? {
          doneeName:
            typeof parsed.doneeName === 'string'
              ? parsed.doneeName
              : typeof parsed.charityName === 'string'
              ? parsed.charityName
              : undefined,
          cashContribution: parseNumber(
            parsed.cashContribution ?? parsed.cashDonation ?? parsed.amount
          ),
          noncashContribution: parseNumber(
            parsed.noncashContribution ??
              parsed.donationAmount ??
              parsed.fairMarketValue
          ),
          propertyDescription:
            typeof parsed.propertyDescription === 'string'
              ? parsed.propertyDescription
              : typeof parsed.description === 'string'
              ? parsed.description
              : undefined,
          deductionClaimed: parseNumber(
            parsed.deductionClaimed ?? parsed.claimedValue
          ),
          grossProceeds: parseNumber(parsed.grossProceeds),
          form1098CAttached:
            typeof parsed.form1098CAttached === 'boolean'
              ? parsed.form1098CAttached
              : docType === '1098-c',
          confidence: 0.78
        }
      : undefined

  const scheduleK1: ExtractedK1 | undefined =
    docType === 'k-1'
      ? {
          issuerName:
            typeof parsed.issuerName === 'string'
              ? parsed.issuerName
              : undefined,
          issuerEin:
            typeof parsed.issuerEin === 'string' ? parsed.issuerEin : undefined,
          businessType:
            parsed.businessType === 'partnership' ||
            parsed.businessType === 's_corp' ||
            parsed.businessType === 'trust'
              ? (parsed.businessType as 'partnership' | 's_corp' | 'trust')
              : undefined,
          ordinaryBusinessIncome: parseNumber(
            parsed.ordinaryBusinessIncome ?? parsed.box1
          ),
          rentalRealEstateIncome: parseNumber(
            parsed.rentalRealEstateIncome ?? parsed.box2
          ),
          otherRentalIncome: parseNumber(parsed.otherRentalIncome ?? parsed.box3),
          royalties: parseNumber(parsed.royalties ?? parsed.box7),
          interestIncome: parseNumber(parsed.interestIncome ?? parsed.box5),
          guaranteedPayments: parseNumber(
            parsed.guaranteedPayments ?? parsed.box4
          ),
          section199AQBI: parseNumber(parsed.section199AQBI),
          section199AW2Wages: parseNumber(parsed.section199AW2Wages),
          section199AUbia: parseNumber(parsed.section199AUbia),
          confidence: 0.8
        }
      : undefined

  return {
    documentType: docType,
    w2,
    form1099Int,
    form1099Div,
    form1099Nec,
    form1099Misc,
    form1099R,
    form1099G,
    form1099Ssa,
    form1099B,
    form1098E,
    form1098T,
    form1095A,
    mortgage1098,
    childcareStatement,
    charityReceipt,
    scheduleK1,
    raw: parsed,
    confidence: docType !== 'unknown' ? 0.85 : 0.3,
    processingTimeMs
  }
}

const extractStructuredText = (bytes: Uint8Array): string => {
  const latin = new TextDecoder('latin1').decode(bytes)
  return latin
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/[^\x20-\x7E\n]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const extractHeuristicDocument = (
  bytes: Uint8Array,
  mimeType: string,
  documentName: string,
  processingTimeMs: number
): ExtractedDocument | null => {
  if (
    !mimeType.includes('pdf') &&
    !mimeType.includes('csv') &&
    !mimeType.startsWith('text/')
  ) {
    return null
  }

  const text = extractStructuredText(bytes)
  if (!text) {
    return null
  }

  const parsed = parseTextDocumentToRecord(text, documentName)
  const extracted = buildExtractedDocument(parsed, processingTimeMs)
  if (extracted.documentType === 'unknown') {
    return {
      ...extracted,
      raw: {
        textSample: text.slice(0, 4000)
      }
    }
  }

  return {
    ...extracted,
    raw: {
      ...(extracted.raw ?? {}),
      textSample: text.slice(0, 4000)
    }
  }
}

const maybeEditedText = (
  fieldEdits: Record<string, unknown>,
  label: string,
  current: string | undefined
): string | undefined => {
  const next = fieldEdits[label]
  if (typeof next === 'string') {
    const trimmed = next.trim()
    return trimmed.length > 0 ? trimmed : current
  }
  return current
}

const maybeEditedNumber = (
  fieldEdits: Record<string, unknown>,
  label: string,
  current: number | undefined
): number | undefined => {
  if (!(label in fieldEdits)) return current
  const parsed = parseNumber(fieldEdits[label])
  return parsed ?? current
}

export function applyFieldEditsToExtractedDocument(
  extracted: ExtractedDocument,
  fieldEdits: Record<string, unknown>
): ExtractedDocument {
  switch (extracted.documentType) {
    case 'w2':
      return {
        ...extracted,
        w2: {
          ...extracted.w2,
          employerName: maybeEditedText(fieldEdits, 'Employer name', extracted.w2?.employerName),
          ein: maybeEditedText(fieldEdits, 'Employer EIN', extracted.w2?.ein),
          box1Wages: maybeEditedNumber(fieldEdits, 'Wages (Box 1)', extracted.w2?.box1Wages),
          box2FedWithholding: maybeEditedNumber(fieldEdits, 'Federal withholding (Box 2)', extracted.w2?.box2FedWithholding),
          box16StateWages: maybeEditedNumber(fieldEdits, 'State wages (Box 16)', extracted.w2?.box16StateWages),
          box17StateWithholding: maybeEditedNumber(fieldEdits, 'State withholding (Box 17)', extracted.w2?.box17StateWithholding),
          confidence: extracted.w2?.confidence ?? extracted.confidence
        }
      }
    case '1099-int':
      return {
        ...extracted,
        form1099Int: {
          ...extracted.form1099Int,
          payerName: maybeEditedText(fieldEdits, 'Payer name', extracted.form1099Int?.payerName),
          interestIncome: maybeEditedNumber(fieldEdits, 'Interest income (Box 1)', extracted.form1099Int?.interestIncome),
          federalTaxWithheld: maybeEditedNumber(fieldEdits, 'Federal tax withheld (Box 4)', extracted.form1099Int?.federalTaxWithheld),
          taxExemptInterest: maybeEditedNumber(fieldEdits, 'Tax-exempt interest (Box 8)', extracted.form1099Int?.taxExemptInterest),
          confidence: extracted.form1099Int?.confidence ?? extracted.confidence
        }
      }
    case '1099-div':
      return {
        ...extracted,
        form1099Div: {
          ...extracted.form1099Div,
          payerName: maybeEditedText(fieldEdits, 'Payer name', extracted.form1099Div?.payerName),
          ordinaryDividends: maybeEditedNumber(fieldEdits, 'Ordinary dividends (Box 1a)', extracted.form1099Div?.ordinaryDividends),
          qualifiedDividends: maybeEditedNumber(fieldEdits, 'Qualified dividends (Box 1b)', extracted.form1099Div?.qualifiedDividends),
          capitalGainDistributions: maybeEditedNumber(fieldEdits, 'Capital gain distributions (Box 2a)', extracted.form1099Div?.capitalGainDistributions),
          federalTaxWithheld: maybeEditedNumber(fieldEdits, 'Federal tax withheld (Box 4)', extracted.form1099Div?.federalTaxWithheld),
          confidence: extracted.form1099Div?.confidence ?? extracted.confidence
        }
      }
    case '1099-misc':
      return {
        ...extracted,
        form1099Misc: {
          ...extracted.form1099Misc,
          payerName: maybeEditedText(fieldEdits, 'Payer name', extracted.form1099Misc?.payerName),
          rents: maybeEditedNumber(fieldEdits, 'Rents (Box 1)', extracted.form1099Misc?.rents),
          royalties: maybeEditedNumber(fieldEdits, 'Royalties (Box 2)', extracted.form1099Misc?.royalties),
          otherIncome: maybeEditedNumber(fieldEdits, 'Other income (Box 3)', extracted.form1099Misc?.otherIncome),
          federalTaxWithheld: maybeEditedNumber(fieldEdits, 'Federal tax withheld (Box 4)', extracted.form1099Misc?.federalTaxWithheld),
          section409ADeferrals: maybeEditedNumber(fieldEdits, 'Section 409A deferrals (Box 12)', extracted.form1099Misc?.section409ADeferrals),
          nonqualifiedDeferredComp: maybeEditedNumber(fieldEdits, 'Nonqualified deferred comp (Box 15)', extracted.form1099Misc?.nonqualifiedDeferredComp),
          confidence: extracted.form1099Misc?.confidence ?? extracted.confidence
        }
      }
    case '1099-nec':
      return {
        ...extracted,
        form1099Nec: {
          ...extracted.form1099Nec,
          payerName: maybeEditedText(fieldEdits, 'Payer name', extracted.form1099Nec?.payerName),
          nonemployeeCompensation: maybeEditedNumber(fieldEdits, 'Nonemployee compensation (Box 1)', extracted.form1099Nec?.nonemployeeCompensation),
          federalTaxWithheld: maybeEditedNumber(fieldEdits, 'Federal tax withheld (Box 4)', extracted.form1099Nec?.federalTaxWithheld),
          confidence: extracted.form1099Nec?.confidence ?? extracted.confidence
        }
      }
    case '1099-r':
      return {
        ...extracted,
        form1099R: {
          ...extracted.form1099R,
          payerName: maybeEditedText(fieldEdits, 'Payer name', extracted.form1099R?.payerName),
          grossDistribution: maybeEditedNumber(fieldEdits, 'Gross distribution (Box 1)', extracted.form1099R?.grossDistribution),
          taxableAmount: maybeEditedNumber(fieldEdits, 'Taxable amount (Box 2a)', extracted.form1099R?.taxableAmount),
          federalTaxWithheld: maybeEditedNumber(fieldEdits, 'Federal tax withheld (Box 4)', extracted.form1099R?.federalTaxWithheld),
          distributionCode: maybeEditedText(fieldEdits, 'Distribution code', extracted.form1099R?.distributionCode),
          confidence: extracted.form1099R?.confidence ?? extracted.confidence
        }
      }
    case '1099-g':
      return {
        ...extracted,
        form1099G: {
          ...extracted.form1099G,
          payerName: maybeEditedText(fieldEdits, 'Payer name', extracted.form1099G?.payerName),
          unemploymentCompensation: maybeEditedNumber(fieldEdits, 'Unemployment compensation (Box 1)', extracted.form1099G?.unemploymentCompensation),
          stateRefund: maybeEditedNumber(fieldEdits, 'State refund (Box 2)', extracted.form1099G?.stateRefund),
          federalTaxWithheld: maybeEditedNumber(fieldEdits, 'Federal tax withheld (Box 4)', extracted.form1099G?.federalTaxWithheld),
          confidence: extracted.form1099G?.confidence ?? extracted.confidence
        }
      }
    case '1099-ssa':
      return {
        ...extracted,
        form1099Ssa: {
          ...extracted.form1099Ssa,
          payerName: maybeEditedText(fieldEdits, 'Payer name', extracted.form1099Ssa?.payerName),
          benefitsPaid: maybeEditedNumber(fieldEdits, 'Benefits paid (Box 5)', extracted.form1099Ssa?.benefitsPaid),
          federalTaxWithheld: maybeEditedNumber(fieldEdits, 'Federal tax withheld (Box 6)', extracted.form1099Ssa?.federalTaxWithheld),
          medicarePartBPremiums: maybeEditedNumber(fieldEdits, 'Medicare Part B premiums', extracted.form1099Ssa?.medicarePartBPremiums),
          confidence: extracted.form1099Ssa?.confidence ?? extracted.confidence
        }
      }
    case '1099-b':
      return {
        ...extracted,
        form1099B: {
          ...extracted.form1099B,
          payerName: maybeEditedText(fieldEdits, 'Broker / payer', extracted.form1099B?.payerName),
          shortTermProceeds: maybeEditedNumber(fieldEdits, 'Short-term proceeds', extracted.form1099B?.shortTermProceeds),
          shortTermCostBasis: maybeEditedNumber(fieldEdits, 'Short-term cost basis', extracted.form1099B?.shortTermCostBasis),
          longTermProceeds: maybeEditedNumber(fieldEdits, 'Long-term proceeds', extracted.form1099B?.longTermProceeds),
          longTermCostBasis: maybeEditedNumber(fieldEdits, 'Long-term cost basis', extracted.form1099B?.longTermCostBasis),
          confidence: extracted.form1099B?.confidence ?? extracted.confidence
        }
      }
    case '1098-e':
      return {
        ...extracted,
        form1098E: {
          ...extracted.form1098E,
          lenderName: maybeEditedText(fieldEdits, 'Lender', extracted.form1098E?.lenderName),
          studentLoanInterest: maybeEditedNumber(fieldEdits, 'Student loan interest', extracted.form1098E?.studentLoanInterest),
          confidence: extracted.form1098E?.confidence ?? extracted.confidence
        }
      }
    case '1098-t':
      return {
        ...extracted,
        form1098T: {
          ...extracted.form1098T,
          institutionName: maybeEditedText(fieldEdits, 'Institution', extracted.form1098T?.institutionName),
          studentName: maybeEditedText(fieldEdits, 'Student name', extracted.form1098T?.studentName),
          qualifiedTuitionExpenses: maybeEditedNumber(fieldEdits, 'Qualified tuition (Box 1)', extracted.form1098T?.qualifiedTuitionExpenses),
          scholarshipsOrGrants: maybeEditedNumber(fieldEdits, 'Scholarships and grants (Box 5)', extracted.form1098T?.scholarshipsOrGrants),
          adjustmentsFromPriorYear: maybeEditedNumber(fieldEdits, 'Prior-year adjustment (Box 4)', extracted.form1098T?.adjustmentsFromPriorYear),
          confidence: extracted.form1098T?.confidence ?? extracted.confidence
        }
      }
    case '1095-a':
      return {
        ...extracted,
        form1095A: {
          ...extracted.form1095A,
          policyNumber: maybeEditedText(fieldEdits, 'Policy number', extracted.form1095A?.policyNumber),
          coveredPersons: maybeEditedNumber(fieldEdits, 'People covered', extracted.form1095A?.coveredPersons),
          annualEnrollmentPremium: maybeEditedNumber(fieldEdits, 'Enrollment premiums', extracted.form1095A?.annualEnrollmentPremium),
          annualSlcsp: maybeEditedNumber(fieldEdits, 'SLCSP', extracted.form1095A?.annualSlcsp),
          annualAdvancePayment: maybeEditedNumber(fieldEdits, 'Advance premium tax credit', extracted.form1095A?.annualAdvancePayment),
          confidence: extracted.form1095A?.confidence ?? extracted.confidence
        }
      }
    case '1098-mortgage':
      return {
        ...extracted,
        mortgage1098: {
          ...extracted.mortgage1098,
          lenderName: maybeEditedText(fieldEdits, 'Lender', extracted.mortgage1098?.lenderName),
          mortgageInterest: maybeEditedNumber(fieldEdits, 'Mortgage interest', extracted.mortgage1098?.mortgageInterest),
          propertyTaxes: maybeEditedNumber(fieldEdits, 'Property taxes', extracted.mortgage1098?.propertyTaxes),
          points: maybeEditedNumber(fieldEdits, 'Points', extracted.mortgage1098?.points),
          mortgageInsurancePremiums: maybeEditedNumber(fieldEdits, 'Mortgage insurance premiums', extracted.mortgage1098?.mortgageInsurancePremiums),
          confidence: extracted.mortgage1098?.confidence ?? extracted.confidence
        }
      }
    case 'childcare':
      return {
        ...extracted,
        childcareStatement: {
          ...extracted.childcareStatement,
          providerName: maybeEditedText(fieldEdits, 'Care provider', extracted.childcareStatement?.providerName),
          providerTin: maybeEditedText(fieldEdits, 'Provider TIN', extracted.childcareStatement?.providerTin),
          amountPaid: maybeEditedNumber(fieldEdits, 'Amount paid', extracted.childcareStatement?.amountPaid),
          address: maybeEditedText(fieldEdits, 'Address', extracted.childcareStatement?.address),
          confidence: extracted.childcareStatement?.confidence ?? extracted.confidence
        }
      }
    case 'charity-receipt':
    case '1098-c':
      return {
        ...extracted,
        charityReceipt: {
          ...extracted.charityReceipt,
          doneeName: maybeEditedText(fieldEdits, 'Donee', extracted.charityReceipt?.doneeName),
          cashContribution: maybeEditedNumber(fieldEdits, 'Cash contribution', extracted.charityReceipt?.cashContribution),
          noncashContribution: maybeEditedNumber(fieldEdits, 'Noncash contribution', extracted.charityReceipt?.noncashContribution),
          deductionClaimed: maybeEditedNumber(fieldEdits, 'Deduction claimed', extracted.charityReceipt?.deductionClaimed),
          grossProceeds: maybeEditedNumber(fieldEdits, 'Gross proceeds', extracted.charityReceipt?.grossProceeds),
          propertyDescription: maybeEditedText(fieldEdits, 'Property description', extracted.charityReceipt?.propertyDescription),
          confidence: extracted.charityReceipt?.confidence ?? extracted.confidence
        }
      }
    case 'k-1':
      return {
        ...extracted,
        scheduleK1: {
          ...extracted.scheduleK1,
          issuerName: maybeEditedText(fieldEdits, 'Entity name', extracted.scheduleK1?.issuerName),
          issuerEin: maybeEditedText(fieldEdits, 'Entity EIN', extracted.scheduleK1?.issuerEin),
          ordinaryBusinessIncome: maybeEditedNumber(fieldEdits, 'Ordinary business income (Box 1)', extracted.scheduleK1?.ordinaryBusinessIncome),
          rentalRealEstateIncome: maybeEditedNumber(fieldEdits, 'Rental real estate income (Box 2)', extracted.scheduleK1?.rentalRealEstateIncome),
          otherRentalIncome: maybeEditedNumber(fieldEdits, 'Other rental income (Box 3)', extracted.scheduleK1?.otherRentalIncome),
          royalties: maybeEditedNumber(fieldEdits, 'Royalties (Box 7)', extracted.scheduleK1?.royalties),
          interestIncome: maybeEditedNumber(fieldEdits, 'Interest income (Box 5)', extracted.scheduleK1?.interestIncome),
          guaranteedPayments: maybeEditedNumber(fieldEdits, 'Guaranteed payments (Box 4)', extracted.scheduleK1?.guaranteedPayments),
          section199AQBI: maybeEditedNumber(fieldEdits, 'Section 199A QBI', extracted.scheduleK1?.section199AQBI),
          section199AW2Wages: maybeEditedNumber(fieldEdits, 'Section 199A W-2 wages', extracted.scheduleK1?.section199AW2Wages),
          section199AUbia: maybeEditedNumber(fieldEdits, 'Section 199A UBIA', extracted.scheduleK1?.section199AUbia),
          confidence: extracted.scheduleK1?.confidence ?? extracted.confidence
        }
      }
    default:
      return extracted
  }
}

export async function extractDocumentFromBytes(
  bytes: Uint8Array,
  mimeType: string,
  documentName: string,
  ai?: Ai
): Promise<ExtractedDocument> {
  const startMs = Date.now()

  if (mimeType.startsWith('image/') && ai) {
    const imageArray = Array.from(bytes)
    const aiResponse = await (
      ai as unknown as {
        run(
          model: string,
          input: { image: number[]; prompt: string }
        ): Promise<{ response?: string }>
      }
    ).run('@cf/llava-1.5-7b-hf', {
      image: imageArray,
      prompt: EXTRACTION_PROMPT
    })

    const processingTimeMs = Date.now() - startMs
    const rawText = aiResponse?.response ?? ''
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return {
        documentType: 'unknown',
        raw: { rawText },
        confidence: 0,
        processingTimeMs
      }
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
      return buildExtractedDocument(parsed, processingTimeMs)
    } catch {
      return {
        documentType: 'unknown',
        raw: { rawText },
        confidence: 0,
        processingTimeMs
      }
    }
  }

  const heuristic = extractHeuristicDocument(
    bytes,
    mimeType,
    documentName,
    Date.now() - startMs
  )
  if (heuristic) {
    return heuristic
  }

  return {
    documentType: 'unknown',
    raw: {
      mimeType,
      documentName
    },
    confidence: 0,
    processingTimeMs: Date.now() - startMs
  }
}

export async function extractDocumentFromR2(
  bucket: R2Bucket,
  ai: Ai,
  r2Key: string
): Promise<ExtractedDocument> {
  const object = await bucket.get(r2Key)
  if (!object) {
    throw new Error(`Document not found in R2: ${r2Key}`)
  }

  const bytes = new Uint8Array(await object.arrayBuffer())
  const mimeType = object.httpMetadata?.contentType ?? 'application/octet-stream'
  return extractDocumentFromBytes(bytes, mimeType, r2Key, ai)
}
