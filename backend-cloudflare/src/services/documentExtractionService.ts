/**
 * Document Extraction Service
 *
 * Uses Cloudflare Workers AI (LLaVA vision model) to extract structured tax
 * data from common tax documents stored in R2.
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

export interface Extracted1099B extends Extracted1099Base {
  shortTermProceeds?: number
  shortTermCostBasis?: number
  longTermProceeds?: number
  longTermCostBasis?: number
}

export interface Extracted1098E {
  lenderName?: string
  studentLoanInterest?: number
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

export interface ExtractedDocument {
  documentType:
    | 'w2'
    | '1099-nec'
    | '1099-int'
    | '1099-div'
    | '1099-r'
    | '1099-g'
    | '1099-ssa'
    | '1099-b'
    | '1098-e'
    | '1095-a'
    | '1098-mortgage'
    | 'childcare'
    | 'charity-receipt'
    | '1098-c'
    | 'unknown'
  w2?: ExtractedW2
  form1099Int?: Extracted1099Int
  form1099Div?: Extracted1099Div
  form1099Nec?: Extracted1099Nec
  form1099R?: Extracted1099R
  form1099G?: Extracted1099G
  form1099Ssa?: Extracted1099SSA
  form1099B?: Extracted1099B
  form1098E?: Extracted1098E
  form1095A?: Extracted1095A
  mortgage1098?: ExtractedMortgage1098
  childcareStatement?: ExtractedChildcareStatement
  charityReceipt?: ExtractedCharityReceipt
  raw?: Record<string, unknown>
  confidence: number
  processingTimeMs: number
}

const EXTRACTION_PROMPT =
  'You are a tax document parser. Extract all tax fields from this document image as JSON. ' +
  'Identify the document type (w2, 1099-nec, 1099-int, 1099-div, 1099-r, 1099-g, 1099-ssa, 1099-b, 1098-e, 1095-a, 1098-mortgage, childcare, charity-receipt, 1098-c). ' +
  'For W-2: extract employerName, ein, box1Wages, box2FedWithholding, box12Codes (array of {code, amount}), ' +
  'box16StateWages, box17StateWithholding. ' +
  'For 1099-INT: extract payerName, interestIncome, earlyWithdrawalPenalty, federalTaxWithheld, taxExemptInterest, foreignTaxPaid. ' +
  'For 1099-DIV: extract payerName, ordinaryDividends, qualifiedDividends, capitalGainDistributions, section199ADividends, federalTaxWithheld, exemptInterestDividends, foreignTaxPaid. ' +
  'For 1099-NEC: extract payerName, nonemployeeCompensation, federalTaxWithheld. ' +
  'For 1099-R: extract payerName, grossDistribution, taxableAmount, federalTaxWithheld, distributionCode, iraSepSimple. ' +
  'For 1099-G: extract payerName, unemploymentCompensation, stateRefund, federalTaxWithheld, stateTaxWithheld. ' +
  'For SSA-1099 / 1099-SSA: extract payerName, benefitsPaid, federalTaxWithheld, medicarePartBPremiums. ' +
  'For 1099-B: extract payerName, shortTermProceeds, shortTermCostBasis, longTermProceeds, longTermCostBasis, federalTaxWithheld. ' +
  'For 1098-E: extract lenderName, studentLoanInterest. ' +
  'For 1095-A: extract policyNumber, coveredPersons, annualEnrollmentPremium, annualSlcsp, annualAdvancePayment, coverageStart, coverageEnd. ' +
  'For Form 1098 mortgage statements: extract lenderName, mortgageInterest, propertyTaxes, points, mortgageInsurancePremiums. ' +
  'For childcare receipts or provider statements: extract providerName, providerTin, amountPaid, address. ' +
  'For charitable receipts or Form 1098-C: extract doneeName, cashContribution, noncashContribution, propertyDescription, deductionClaimed, grossProceeds, form1098CAttached. ' +
  'Respond ONLY with valid JSON matching: ' +
  '{"documentType":"w2","employerName":"...","ein":"...","box1Wages":0,"box2FedWithholding":0,' +
  '"box12Codes":[{"code":"D","amount":0}],"box16StateWages":0,"box17StateWithholding":0}'

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,]/g, '')
    const n = parseFloat(cleaned)
    return isNaN(n) ? undefined : n
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
    '1099-r',
    '1099-g',
    '1099-ssa',
    '1099-b',
    '1098-e',
    '1095-a',
    '1098-mortgage',
    'childcare',
    'charity-receipt',
    '1098-c'
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
          )
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
            parsed.mortgageInterest ??
              parsed.homeMortgageInterest ??
              parsed.box1
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

  return {
    documentType: docType,
    w2,
    form1099Int,
    form1099Div,
    form1099Nec,
    form1099R,
    form1099G,
    form1099Ssa,
    form1099B,
    form1098E,
    form1095A,
    mortgage1098,
    childcareStatement,
    charityReceipt,
    raw: parsed,
    confidence: docType !== 'unknown' ? 0.85 : 0.3,
    processingTimeMs
  }
}

export async function extractDocumentFromR2(
  bucket: R2Bucket,
  ai: Ai,
  r2Key: string
): Promise<ExtractedDocument> {
  const startMs = Date.now()

  const object = await bucket.get(r2Key)
  if (!object) {
    throw new Error(`Document not found in R2: ${r2Key}`)
  }

  const bytes = new Uint8Array(await object.arrayBuffer())
  // Workers AI vision models accept image as a number array
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

  // Extract JSON from the response — the model may wrap it in prose
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
