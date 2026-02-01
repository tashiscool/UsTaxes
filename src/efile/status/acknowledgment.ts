/**
 * MeF Acknowledgment Processing Module
 *
 * Handles parsing and processing of IRS MeF acknowledgment responses,
 * including error code mapping and resolution guidance.
 */

/* eslint-disable @typescript-eslint/no-unnecessary-condition */

// ============================================================================
// Types
// ============================================================================

export interface Acknowledgment {
  submissionId: string
  status: 'Accepted' | 'Rejected'
  timestamp: string
  errors?: AcknowledgmentError[]
  confirmationNumber?: string
  refundInfo?: RefundInfo
}

export interface AcknowledgmentError {
  errorCode: string
  errorCategory: 'Reject' | 'Alert'
  errorMessage: string
  xpath?: string
  fieldValue?: string
  ruleNumber?: string
}

export interface RefundInfo {
  refundAmount?: number
  directDeposit?: boolean
  routingNumber?: string
  accountNumberLast4?: string
  expectedDate?: string
}

export interface ProcessedAcknowledgment {
  submissionId: string
  status: 'Accepted' | 'Rejected'
  timestamp: Date
  confirmationNumber?: string
  refundInfo?: RefundInfo
  errors: ParsedError[]
  rawXml: string
}

export interface ParsedError {
  errorCode: string
  errorCategory: 'Reject' | 'Alert'
  irsMessage: string
  userFriendlyMessage: string
  resolution: string
  fieldPath?: string
  fieldValue?: string
  severity: 'Critical' | 'Warning' | 'Info'
  formReference?: string
}

export interface ErrorResolution {
  message: string
  resolution: string
  severity: 'Critical' | 'Warning' | 'Info'
  formReference?: string
  helpUrl?: string
}

// ============================================================================
// IRS Error Code Mapping
// ============================================================================

/**
 * Comprehensive mapping of IRS error codes to user-friendly explanations
 * and resolution steps. Based on IRS MeF Business Rules.
 */
export const ERROR_CODES: Record<string, ErrorResolution> = {
  // Individual Return - SSN/Identity Errors (IND-001 to IND-050)
  'IND-031': {
    message: 'SSN has already been used on another return',
    resolution:
      'Verify SSN is correct. If identity theft is suspected, file Form 14039 (Identity Theft Affidavit) and consider filing a paper return.',
    severity: 'Critical',
    formReference: 'Form 14039',
    helpUrl: 'https://www.irs.gov/identity-theft-fraud-scams'
  },
  'IND-032': {
    message: "Primary taxpayer's SSN and name do not match IRS records",
    resolution:
      'Verify SSN and name match exactly as shown on Social Security card. If recently changed, contact SSA to update records before filing.',
    severity: 'Critical',
    helpUrl: 'https://www.ssa.gov/myaccount/'
  },
  'IND-033': {
    message: "Spouse's SSN and name do not match IRS records",
    resolution:
      "Verify spouse's SSN and name match exactly as shown on Social Security card. If name recently changed due to marriage, update with SSA first.",
    severity: 'Critical'
  },
  'IND-034': {
    message: "Dependent's SSN has already been claimed on another return",
    resolution:
      'Only one return can claim a dependent. If you believe this is an error or identity theft, file Form 14039.',
    severity: 'Critical',
    formReference: 'Form 14039'
  },
  'IND-035': {
    message: "Dependent's SSN and name do not match IRS records",
    resolution:
      "Verify dependent's SSN and name match their Social Security card exactly. Check for typos in both fields.",
    severity: 'Critical'
  },
  'IND-036': {
    message: 'SSN is not valid for employment',
    resolution:
      'This SSN may be an ITIN or restricted SSN. Verify the correct number was entered. ITINs cannot be used for EITC.',
    severity: 'Critical'
  },
  'IND-037': {
    message: 'ITIN has expired',
    resolution:
      'Renew your ITIN by filing Form W-7 before submitting your tax return. ITINs must be renewed every 5 years.',
    severity: 'Critical',
    formReference: 'Form W-7'
  },
  'IND-038': {
    message: 'Taxpayer date of birth does not match IRS records',
    resolution:
      'Verify date of birth matches Social Security records. If incorrect at SSA, file Form SS-5 to correct it.',
    severity: 'Warning',
    formReference: 'Form SS-5'
  },
  'IND-039': {
    message: 'Primary taxpayer is deceased according to IRS records',
    resolution:
      'If taxpayer is alive, contact IRS to correct records. If filing for deceased, ensure proper executor documentation.',
    severity: 'Critical'
  },
  'IND-040': {
    message: 'Spouse is deceased according to IRS records',
    resolution:
      'If spouse is alive, contact IRS to correct records. If filing for deceased spouse, use qualifying widow(er) status if applicable.',
    severity: 'Critical'
  },

  // Prior Year AGI/PIN Errors (IND-180 to IND-199)
  'IND-181': {
    message:
      'AGI or Self-Select PIN from prior year does not match IRS records',
    resolution:
      "Use correct prior year AGI from last year's return (Form 1040, line 11). If you didn't file last year, enter 0. First-time filers should enter 0.",
    severity: 'Critical',
    formReference: 'Form 1040 Line 11'
  },
  'IND-182': {
    message: 'Prior year PIN does not match IRS records',
    resolution:
      'Use the 5-digit PIN you created when filing last year. If forgotten, use prior year AGI instead.',
    severity: 'Critical'
  },
  'IND-183': {
    message: 'Electronic Filing PIN from IRS does not match',
    resolution:
      'The IRS-issued e-file PIN is incorrect. Request a new one at IRS.gov or use prior year AGI instead.',
    severity: 'Critical',
    helpUrl: 'https://www.irs.gov/individuals/electronic-filing-pin-request'
  },
  'IND-184': {
    message: 'Identity Protection PIN (IP PIN) is missing or incorrect',
    resolution:
      'Enter the 6-digit IP PIN from IRS Letter CP01A. If lost, request a new one at IRS.gov/getanippin.',
    severity: 'Critical',
    helpUrl:
      'https://www.irs.gov/identity-theft-fraud-scams/get-an-identity-protection-pin'
  },
  'IND-185': {
    message: 'Spouse IP PIN is missing or incorrect',
    resolution:
      "Enter spouse's 6-digit IP PIN. Each person who has been issued an IP PIN must use their own current year PIN.",
    severity: 'Critical'
  },
  'IND-186': {
    message: 'Dependent IP PIN is missing or incorrect',
    resolution:
      'If a dependent has an IP PIN, it must be included on the return. Check IRS letters for the PIN.',
    severity: 'Critical'
  },

  // Filing Status Errors (IND-050 to IND-099)
  'IND-051': {
    message: 'Filing status does not match prior year filing status',
    resolution:
      'Verify filing status is correct. If status changed (marriage, divorce, death of spouse), ensure all related information is updated.',
    severity: 'Warning'
  },
  'IND-052': {
    message: 'Married Filing Separately requires spouse information',
    resolution:
      "When filing Married Filing Separately, you must provide spouse's name and SSN.",
    severity: 'Critical'
  },
  'IND-053': {
    message: 'Head of Household requires qualifying person',
    resolution:
      'To file as Head of Household, you must have a qualifying dependent and pay more than half the cost of keeping up a home.',
    severity: 'Critical'
  },
  'IND-054': {
    message: 'Qualifying Widow(er) status not available',
    resolution:
      'Qualifying Widow(er) status is only available for 2 years after the year of spouse death and requires a dependent child.',
    severity: 'Critical'
  },

  // Income and Deduction Errors (IND-100 to IND-179)
  'IND-101': {
    message: 'W-2 employer EIN not found in IRS records',
    resolution:
      'Verify the Employer Identification Number (EIN) from your W-2 box b is entered correctly. Contact employer if W-2 appears incorrect.',
    severity: 'Warning'
  },
  'IND-102': {
    message: 'W-2 wages do not match IRS records',
    resolution:
      'Verify W-2 information is entered exactly as shown. If W-2 is incorrect, request a corrected W-2 (W-2c) from employer.',
    severity: 'Warning',
    formReference: 'Form W-2c'
  },
  'IND-103': {
    message: '1099 income does not match IRS records',
    resolution:
      'Verify 1099 amounts are entered correctly. If 1099 is incorrect, request a corrected form from the payer.',
    severity: 'Warning'
  },
  'IND-104': {
    message: 'Total income calculation error',
    resolution:
      'Review all income entries. The sum of income items does not calculate correctly to total income.',
    severity: 'Critical'
  },
  'IND-105': {
    message: 'Standard deduction amount is incorrect',
    resolution:
      'Standard deduction must match IRS tables for your filing status and age. Check if additional amounts for age 65+ or blind apply.',
    severity: 'Warning'
  },
  'IND-106': {
    message: 'Itemized deductions exceed allowable limits',
    resolution:
      'Review itemized deductions. Some deductions have limits (e.g., SALT capped at $10,000, mortgage interest limitations).',
    severity: 'Warning'
  },
  'IND-107': {
    message: 'State and local tax deduction exceeds $10,000 limit',
    resolution:
      'SALT deduction is capped at $10,000 ($5,000 if Married Filing Separately). Reduce to the applicable limit.',
    severity: 'Warning'
  },
  'IND-108': {
    message: 'Charitable contribution exceeds AGI limitation',
    resolution:
      'Cash contributions are generally limited to 60% of AGI. Review and carry forward excess contributions.',
    severity: 'Warning'
  },
  'IND-109': {
    message: 'Medical expense deduction calculation error',
    resolution:
      'Medical expenses are only deductible to the extent they exceed 7.5% of AGI. Verify calculation.',
    severity: 'Warning'
  },
  'IND-110': {
    message: 'Mortgage interest deduction requires Form 1098',
    resolution:
      'Mortgage interest over $600 requires Form 1098 information from the lender.',
    severity: 'Warning',
    formReference: 'Form 1098'
  },

  // Credit Errors (IND-200 to IND-299)
  'IND-201': {
    message: 'Child Tax Credit child does not qualify',
    resolution:
      'Child must be under 17, your dependent, and meet relationship, residency, and support tests. Verify eligibility.',
    severity: 'Critical'
  },
  'IND-202': {
    message: 'EITC income exceeds limit',
    resolution:
      'Earned Income Tax Credit has income limits that vary by filing status and number of children. Review eligibility.',
    severity: 'Critical'
  },
  'IND-203': {
    message: 'EITC qualifying child does not meet requirements',
    resolution:
      'EITC qualifying child must meet age, relationship, residency, and joint return tests. Verify all requirements.',
    severity: 'Critical'
  },
  'IND-204': {
    message: 'Education credit student not eligible',
    resolution:
      'Student must be enrolled at least half-time in a degree program. American Opportunity Credit is limited to 4 years.',
    severity: 'Critical'
  },
  'IND-205': {
    message: 'American Opportunity Credit already claimed for 4 years',
    resolution:
      'AOTC can only be claimed for 4 tax years per student. Consider Lifetime Learning Credit instead.',
    severity: 'Critical'
  },
  'IND-206': {
    message: 'Child and Dependent Care Credit expenses exceed limit',
    resolution:
      'Expenses are limited to $3,000 for one qualifying person or $6,000 for two or more.',
    severity: 'Warning'
  },
  'IND-207': {
    message: 'Retirement Savings Contribution Credit income exceeds limit',
    resolution:
      "Saver's Credit has strict income limits. Verify AGI qualifies for the credit.",
    severity: 'Warning'
  },
  'IND-208': {
    message: 'Premium Tax Credit Form 8962 missing',
    resolution:
      'If you received advance premium tax credit (Form 1095-A), you must file Form 8962 to reconcile.',
    severity: 'Critical',
    formReference: 'Form 8962'
  },
  'IND-209': {
    message: 'Premium Tax Credit SLCSP incorrect',
    resolution:
      'Second Lowest Cost Silver Plan (SLCSP) amount must match Form 1095-A or be obtained from Healthcare.gov.',
    severity: 'Warning'
  },
  'IND-210': {
    message: 'Foreign Tax Credit exceeds limitation',
    resolution:
      'Foreign tax credit is limited to US tax on foreign income. Excess can be carried back/forward.',
    severity: 'Warning',
    formReference: 'Form 1116'
  },

  // Estimated Tax and Withholding Errors (IND-300 to IND-349)
  'IND-301': {
    message: 'Estimated tax payments do not match IRS records',
    resolution:
      'Verify estimated tax payment amounts and dates from your records. IRS may not have processed recent payments.',
    severity: 'Warning'
  },
  'IND-302': {
    message: 'Prior year overpayment applied does not match',
    resolution:
      "The amount applied from last year differs from IRS records. Check last year's return or IRS account.",
    severity: 'Warning'
  },
  'IND-303': {
    message: 'Federal withholding does not match W-2/1099',
    resolution:
      'Total federal withholding must equal the sum of withholding from all W-2s and 1099s.',
    severity: 'Warning'
  },

  // Refund and Payment Errors (IND-350 to IND-399)
  'IND-351': {
    message: 'Direct deposit routing number invalid',
    resolution:
      'Verify the 9-digit routing number from the bottom of your check. First two digits must be 01-12 or 21-32.',
    severity: 'Critical'
  },
  'IND-352': {
    message: 'Direct deposit account number invalid',
    resolution:
      'Verify account number. Do not include spaces or hyphens. Account type must match (checking/savings).',
    severity: 'Critical'
  },
  'IND-353': {
    message: 'Refund cannot be direct deposited to this account type',
    resolution:
      'Some accounts (e.g., certain prepaid cards) cannot receive IRS direct deposits. Use a different account.',
    severity: 'Warning'
  },
  'IND-354': {
    message: 'Split refund bank information incomplete',
    resolution:
      'When splitting refund to multiple accounts, all account information must be complete on Form 8888.',
    severity: 'Critical',
    formReference: 'Form 8888'
  },
  'IND-355': {
    message: 'Refund amount calculation error',
    resolution:
      'Review all entries. Tax, credits, payments, and refund amounts must calculate correctly.',
    severity: 'Critical'
  },

  // Schedule C - Business Errors (IND-400 to IND-449)
  'IND-401': {
    message: 'Schedule C business code invalid',
    resolution:
      'Enter a valid 6-digit NAICS business activity code. Find codes at census.gov/naics.',
    severity: 'Warning'
  },
  'IND-402': {
    message: 'Schedule C gross receipts inconsistent with 1099-NEC/K',
    resolution:
      'Gross receipts should generally include all 1099-NEC and 1099-K amounts received.',
    severity: 'Warning'
  },
  'IND-403': {
    message: 'Schedule C vehicle expenses require Form 4562',
    resolution: 'If claiming vehicle depreciation, Form 4562 must be attached.',
    severity: 'Warning',
    formReference: 'Form 4562'
  },
  'IND-404': {
    message: 'Home office deduction calculation error',
    resolution:
      'Home office deduction requires Form 8829 with accurate business use percentage.',
    severity: 'Warning',
    formReference: 'Form 8829'
  },
  'IND-405': {
    message: 'Self-employment tax calculation error',
    resolution:
      'SE tax equals 15.3% of 92.35% of net self-employment earnings (up to Social Security wage base).',
    severity: 'Warning'
  },

  // Schedule E - Rental Errors (IND-450 to IND-499)
  'IND-451': {
    message: 'Rental property address incomplete',
    resolution:
      'Each rental property requires complete address including city, state, and ZIP.',
    severity: 'Warning'
  },
  'IND-452': {
    message: 'Rental days calculation error',
    resolution:
      'Total of personal use days and fair rental days cannot exceed 365 (or 366 in leap year).',
    severity: 'Warning'
  },
  'IND-453': {
    message: 'Passive activity loss limitation applies',
    resolution:
      'Rental losses may be limited. Active participation allows up to $25,000 loss (phased out at higher incomes).',
    severity: 'Info'
  },

  // Schedule D - Capital Gains Errors (IND-500 to IND-549)
  'IND-501': {
    message: 'Cost basis missing for stock sale',
    resolution:
      'Each stock sale requires cost basis. Check brokerage statements or use average cost for mutual funds.',
    severity: 'Warning'
  },
  'IND-502': {
    message: 'Wash sale adjustment incorrect',
    resolution:
      'Wash sale losses must be added back and basis adjusted if substantially identical securities bought within 30 days.',
    severity: 'Warning'
  },
  'IND-503': {
    message: 'Form 8949 required for detailed transactions',
    resolution:
      'Individual stock transactions must be reported on Form 8949 before summarizing on Schedule D.',
    severity: 'Warning',
    formReference: 'Form 8949'
  },

  // Form Attachment Errors (F- prefix)
  'F1040-001': {
    message: 'Required schedule is missing',
    resolution:
      'Based on your entries, one or more required schedules must be attached to Form 1040.',
    severity: 'Critical'
  },
  'F1040-002': {
    message: 'Form 1040 signature date missing',
    resolution:
      'Electronic signature requires a date. The date must be on or before the submission date.',
    severity: 'Critical'
  },
  'F1040-003': {
    message: 'Third party designee information incomplete',
    resolution:
      'If authorizing third party to discuss return, provide complete name, phone, and PIN.',
    severity: 'Warning'
  },

  // W-2 Specific Errors (W2- prefix)
  'W2-001': {
    message: 'W-2 Box 1 and Box 16 inconsistency',
    resolution:
      'State wages (Box 16) typically should not exceed federal wages (Box 1). Verify W-2 is correct.',
    severity: 'Warning'
  },
  'W2-002': {
    message: 'W-2 withholding exceeds wages',
    resolution:
      'Federal withholding (Box 2) cannot exceed federal wages (Box 1). Check for data entry errors.',
    severity: 'Critical'
  },
  'W2-003': {
    message: 'W-2 retirement plan indicator inconsistent',
    resolution:
      'Box 13 retirement plan checkbox affects IRA deduction eligibility. Verify with employer.',
    severity: 'Warning'
  },

  // Validation Errors (R- prefix)
  'R0000-001': {
    message: 'XML schema validation error',
    resolution:
      'The return file has a technical formatting error. This is typically a software issue.',
    severity: 'Critical'
  },
  'R0000-002': {
    message: 'Return already accepted for this SSN and tax year',
    resolution:
      'A return has already been accepted for this taxpayer and year. File an amended return (Form 1040-X) if corrections needed.',
    severity: 'Critical',
    formReference: 'Form 1040-X'
  },
  'R0000-003': {
    message: 'Submission ID duplicate',
    resolution:
      'This exact submission was already sent. Check status of original submission before resubmitting.',
    severity: 'Critical'
  },
  'R0000-004': {
    message: 'Tax year not valid for electronic filing',
    resolution:
      'Electronic filing may not be available for this tax year. File a paper return instead.',
    severity: 'Critical'
  },
  'R0000-005': {
    message: 'Filing deadline has passed',
    resolution:
      'The regular filing deadline has passed. File as soon as possible to minimize penalties and interest.',
    severity: 'Warning'
  },

  // State Return Errors (ST- prefix)
  'ST-001': {
    message: 'State return cannot be filed without federal return',
    resolution:
      'The federal return must be accepted before the state return can be processed.',
    severity: 'Critical'
  },
  'ST-002': {
    message: 'State AGI does not match federal AGI',
    resolution:
      'State returns typically start with federal AGI. Verify state modifications are correct.',
    severity: 'Warning'
  }
}

// ============================================================================
// AcknowledgmentProcessor Class
// ============================================================================

export class AcknowledgmentProcessor {
  /**
   * Process raw acknowledgment XML into a structured format
   */
  process(ackXml: string): ProcessedAcknowledgment {
    const ack = this.parseXml(ackXml)
    const errors = this.parseErrors(ack)

    return {
      submissionId: ack.submissionId,
      status: ack.status,
      timestamp: new Date(ack.timestamp),
      confirmationNumber: ack.confirmationNumber,
      refundInfo: ack.refundInfo,
      errors,
      rawXml: ackXml
    }
  }

  /**
   * Parse XML string into Acknowledgment object
   */
  private parseXml(xml: string): Acknowledgment {
    // Parse the XML using DOMParser (browser) or basic regex extraction
    if (typeof DOMParser !== 'undefined') {
      return this.parseWithDOMParser(xml)
    }
    return this.parseWithRegex(xml)
  }

  /**
   * Parse XML using DOMParser (browser environment)
   */
  private parseWithDOMParser(xml: string): Acknowledgment {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'text/xml')

    const getElementText = (tagName: string): string | undefined => {
      const element = doc.getElementsByTagName(tagName)[0]
      return element.textContent || undefined
    }

    const status =
      getElementText('AcceptanceStatusTxt') === 'Accepted'
        ? 'Accepted'
        : 'Rejected'

    const errors: AcknowledgmentError[] = []
    const errorElements = doc.getElementsByTagName('Error')

    for (let i = 0; i < errorElements.length; i++) {
      const errorEl = errorElements[i]
      const getErrorText = (tag: string): string | undefined => {
        const el = errorEl.getElementsByTagName(tag)[0]
        return el.textContent || undefined
      }

      errors.push({
        errorCode: getErrorText('ErrorCodeTxt') || 'UNKNOWN',
        errorCategory:
          (getErrorText('ErrorCategoryTxt') as 'Reject' | 'Alert') || 'Reject',
        errorMessage: getErrorText('ErrorMessageTxt') || '',
        xpath: getErrorText('XPath'),
        fieldValue: getErrorText('FieldValueTxt'),
        ruleNumber: getErrorText('RuleNum')
      })
    }

    const refundInfo: RefundInfo | undefined = getElementText('RefundAmt')
      ? {
          refundAmount: parseFloat(getElementText('RefundAmt') || '0'),
          directDeposit: getElementText('RefundDirectDepositInd') === 'true',
          routingNumber: getElementText('RoutingTransitNum'),
          accountNumberLast4: getElementText('BankAccountNumLast4'),
          expectedDate: getElementText('ExpectedRefundDt')
        }
      : undefined

    return {
      submissionId: getElementText('SubmissionId') || '',
      status,
      timestamp: getElementText('AckTimestamp') || new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined,
      confirmationNumber: getElementText('ConfirmationNumber'),
      refundInfo
    }
  }

  /**
   * Parse XML using regex (fallback for non-browser environments)
   */
  private parseWithRegex(xml: string): Acknowledgment {
    const extractTag = (tag: string): string | undefined => {
      const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'))
      return match?.[1]
    }

    const status =
      extractTag('AcceptanceStatusTxt') === 'Accepted' ? 'Accepted' : 'Rejected'

    const errors: AcknowledgmentError[] = []
    const errorRegex = /<Error>([\s\S]*?)<\/Error>/gi
    let errorMatch

    while ((errorMatch = errorRegex.exec(xml)) !== null) {
      const errorXml = errorMatch[1]
      const extractFromError = (tag: string): string | undefined => {
        const match = errorXml.match(
          new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i')
        )
        return match?.[1]
      }

      errors.push({
        errorCode: extractFromError('ErrorCodeTxt') || 'UNKNOWN',
        errorCategory:
          (extractFromError('ErrorCategoryTxt') as 'Reject' | 'Alert') ||
          'Reject',
        errorMessage: extractFromError('ErrorMessageTxt') || '',
        xpath: extractFromError('XPath'),
        fieldValue: extractFromError('FieldValueTxt'),
        ruleNumber: extractFromError('RuleNum')
      })
    }

    const refundAmt = extractTag('RefundAmt')
    const refundInfo: RefundInfo | undefined = refundAmt
      ? {
          refundAmount: parseFloat(refundAmt),
          directDeposit: extractTag('RefundDirectDepositInd') === 'true',
          routingNumber: extractTag('RoutingTransitNum'),
          accountNumberLast4: extractTag('BankAccountNumLast4'),
          expectedDate: extractTag('ExpectedRefundDt')
        }
      : undefined

    return {
      submissionId: extractTag('SubmissionId') || '',
      status,
      timestamp: extractTag('AckTimestamp') || new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined,
      confirmationNumber: extractTag('ConfirmationNumber'),
      refundInfo
    }
  }

  /**
   * Parse errors from acknowledgment and enrich with user-friendly information
   */
  parseErrors(ack: Acknowledgment): ParsedError[] {
    if (!ack.errors) return []

    return ack.errors.map((error) => {
      const resolution = this.getErrorResolution(error.errorCode)

      return {
        errorCode: error.errorCode,
        errorCategory: error.errorCategory,
        irsMessage: error.errorMessage,
        userFriendlyMessage: resolution.message,
        resolution: resolution.resolution,
        fieldPath: error.xpath,
        fieldValue: error.fieldValue,
        severity: resolution.severity,
        formReference: resolution.formReference
      }
    })
  }

  /**
   * Get error resolution information for a given error code
   */
  getErrorResolution(errorCode: string): ErrorResolution {
    const knownError = ERROR_CODES[errorCode]

    if (knownError) {
      return knownError
    }

    // Try to find a related error by prefix
    const prefix = errorCode.replace(/-?\d+$/, '')
    const relatedCode = Object.keys(ERROR_CODES).find((code) =>
      code.startsWith(prefix)
    )

    if (relatedCode) {
      return {
        ...ERROR_CODES[relatedCode],
        message: `Error ${errorCode}: Related to ${ERROR_CODES[relatedCode].message}`,
        resolution: `This error is similar to ${relatedCode}. ${ERROR_CODES[relatedCode].resolution}`
      }
    }

    // Return generic error for unknown codes
    return {
      message: `IRS Error Code ${errorCode}`,
      resolution:
        'Please review the error details provided by the IRS. If the issue persists, consult IRS Publication 1345 or contact IRS e-file support.',
      severity: 'Warning'
    }
  }

  /**
   * Extract acceptance details for successfully accepted returns
   */
  extractAcceptanceInfo(ack: ProcessedAcknowledgment): {
    confirmationNumber: string | undefined
    acceptedDate: Date
    refundInfo: RefundInfo | undefined
  } {
    return {
      confirmationNumber: ack.confirmationNumber,
      acceptedDate: ack.timestamp,
      refundInfo: ack.refundInfo
    }
  }

  /**
   * Generate a user-friendly summary of the acknowledgment
   */
  generateSummary(ack: ProcessedAcknowledgment): string {
    const lines: string[] = []

    lines.push(`Submission ID: ${ack.submissionId}`)
    lines.push(`Status: ${ack.status}`)
    lines.push(`Timestamp: ${ack.timestamp.toLocaleString()}`)

    if (ack.status === 'Accepted') {
      if (ack.confirmationNumber) {
        lines.push(`Confirmation Number: ${ack.confirmationNumber}`)
      }
      if (ack.refundInfo?.refundAmount) {
        lines.push(`Refund Amount: $${ack.refundInfo.refundAmount.toFixed(2)}`)
        if (ack.refundInfo.directDeposit) {
          lines.push('Refund Method: Direct Deposit')
          if (ack.refundInfo.expectedDate) {
            lines.push(`Expected Date: ${ack.refundInfo.expectedDate}`)
          }
        }
      }
    } else if (ack.errors.length > 0) {
      lines.push('')
      lines.push(`Errors (${ack.errors.length}):`)
      ack.errors.forEach((error, index) => {
        lines.push(
          `  ${index + 1}. [${error.errorCode}] ${error.userFriendlyMessage}`
        )
        lines.push(`     Resolution: ${error.resolution}`)
      })
    }

    return lines.join('\n')
  }
}

export default AcknowledgmentProcessor
