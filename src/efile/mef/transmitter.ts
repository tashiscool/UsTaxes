/**
 * E-File Transmitter Service
 *
 * Main orchestrator for electronic filing of tax returns via the IRS MeF system.
 * Handles the complete workflow from form preparation to submission and acknowledgment.
 */

import {
  MeFConfig,
  Submission,
  SubmissionId,
  Acknowledgment,
  AckStatus,
  ValidationResult,
  ValidationError,
  ReturnHeader,
  ReturnData,
  SelfSelectPINGrp,
  FilerGrp,
  OriginatorGrp,
  AckError
} from '../types/mefTypes'

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for the EFileTransmitter
 */
export interface TransmitterConfig {
  /** MeF system configuration */
  mefConfig: MeFConfig
  /** Tax year being filed */
  taxYear: string
  /** Whether this is a test submission */
  isTest?: boolean
}

/**
 * Prepared return ready for validation and signing
 */
export interface PreparedReturn {
  /** Generated XML content */
  xml: string
  /** Return header information */
  header: ReturnHeader
  /** Unique identifier for this return */
  returnId: string
  /** Tax year */
  taxYear: string
  /** Primary SSN */
  primarySSN: string
  /** Spouse SSN if applicable */
  spouseSSN?: string
  /** Primary taxpayer name */
  primaryName: string
  /** Spouse name if applicable */
  spouseName?: string
  /** Total tax liability */
  taxLiability: number
  /** Total payments and credits */
  totalPayments: number
  /** Refund amount (if positive) or amount owed (if negative) */
  refundOrOwed: number
  /** Whether this is a joint return */
  isJoint: boolean
  /** Timestamp of preparation */
  preparedAt: Date
}

/**
 * Identity verification data for e-file signature
 */
export interface IdentityVerification {
  /** Primary taxpayer prior year AGI */
  primaryPriorYearAGI?: number
  /** Primary taxpayer prior year self-select PIN */
  primaryPriorYearPIN?: string
  /** Spouse prior year AGI */
  spousePriorYearAGI?: number
  /** Spouse prior year self-select PIN */
  spousePriorYearPIN?: string
  /** Primary taxpayer IP PIN (if assigned by IRS) */
  primaryIPPIN?: string
  /** Spouse IP PIN (if assigned by IRS) */
  spouseIPPIN?: string
}

/**
 * Electronic signature information
 */
export interface ESignature {
  /** Primary taxpayer's 5-digit self-select PIN */
  primaryPIN: string
  /** Spouse's 5-digit self-select PIN (if joint return) */
  spousePIN?: string
  /** Date of signature */
  signatureDate: Date
  /** IP address at time of signature */
  ipAddress?: string
  /** Form 8879 consent acknowledged */
  form8879Consent: boolean
}

/**
 * Signed return ready for submission
 */
export interface SignedReturn {
  /** The prepared return */
  prepared: PreparedReturn
  /** Identity verification data */
  identity: IdentityVerification
  /** Electronic signature */
  signature: ESignature
  /** Complete submission structure */
  submission: Submission
  /** Digital signature (XMLDSig) */
  digitalSignature?: string
  /** Timestamp of signing */
  signedAt: Date
}

/**
 * Result of submission to IRS
 */
export interface SubmissionResult {
  /** Whether submission was accepted by MeF system */
  success: boolean
  /** Submission ID assigned by IRS */
  submissionId?: SubmissionId
  /** Electronic postmark timestamp */
  electronicPostmark?: Date
  /** Error message if submission failed */
  errorMessage?: string
  /** Error code if submission failed */
  errorCode?: string
  /** Raw response from MeF */
  rawResponse?: unknown
}

/**
 * Result of polling for acknowledgment
 */
export interface AcknowledgmentResult {
  /** Current status */
  status: AckStatus
  /** The acknowledgment (if received) */
  acknowledgment?: Acknowledgment
  /** Whether still waiting for acknowledgment */
  pending: boolean
  /** Number of poll attempts made */
  pollCount: number
  /** Last poll timestamp */
  lastPollAt: Date
}

/**
 * Complete e-file result
 */
export interface EFileResult {
  /** Overall success status */
  success: boolean
  /** The prepared return */
  prepared: PreparedReturn
  /** The signed return */
  signed?: SignedReturn
  /** Submission result */
  submission?: SubmissionResult
  /** Acknowledgment result */
  acknowledgment?: AcknowledgmentResult
  /** Validation errors (if failed validation) */
  validationErrors?: ValidationError[]
  /** Rejection errors from IRS */
  rejectionErrors?: AckError[]
  /** Current step in the workflow */
  currentStep: EFileStep
  /** Error that stopped the workflow */
  error?: Error
  /** Timestamps for each step */
  timestamps: {
    started: Date
    prepared?: Date
    validated?: Date
    signed?: Date
    submitted?: Date
    acknowledged?: Date
    completed?: Date
  }
}

/**
 * E-file workflow steps
 */
export type EFileStep =
  | 'idle'
  | 'preparing'
  | 'validating'
  | 'signing'
  | 'submitting'
  | 'polling'
  | 'accepted'
  | 'rejected'
  | 'error'

/**
 * Callback for status updates during e-file process
 */
export type EFileStatusCallback = (
  step: EFileStep,
  message: string,
  progress?: number
) => void

/**
 * Interface for F1040 form data
 * This is a simplified interface - the actual F1040 class has more methods
 */
export interface F1040Data {
  /** Get all form schedules */
  schedules: () => { tag: string; fields: () => unknown[] }[]
  /** Primary taxpayer info */
  info: {
    taxPayer: {
      primaryPerson: {
        firstName: string
        lastName: string
        ssid: string
        address: {
          address: string
          city: string
          state?: string
          zip?: string
        }
      }
      spouse?: {
        firstName: string
        lastName: string
        ssid: string
      }
      filingStatus: string
    }
    refund?: {
      routingNumber: string
      accountNumber: string
      accountType: 'checking' | 'savings'
    }
  }
  /** Line 24 - Total tax */
  l24: () => number
  /** Line 33 - Total payments */
  l33: () => number
  /** Line 34 - Refund */
  l34: () => number
  /** Line 37 - Amount owed */
  l37: () => number
}

// =============================================================================
// EFileTransmitter Class
// =============================================================================

/**
 * Main e-file transmitter service
 *
 * Orchestrates the complete e-file workflow:
 * 1. Prepare return (serialize form data to XML)
 * 2. Validate return (schema and business rules)
 * 3. Sign return (digital signature with PIN)
 * 4. Submit return (send to IRS via SOAP)
 * 5. Poll for acknowledgment
 * 6. Return result
 */
export class EFileTransmitter {
  private config: TransmitterConfig
  private statusCallback?: EFileStatusCallback
  private sessionToken?: string

  constructor(config: TransmitterConfig) {
    this.config = config
  }

  /**
   * Set a callback to receive status updates during e-file
   */
  setStatusCallback(callback: EFileStatusCallback): void {
    this.statusCallback = callback
  }

  /**
   * Update status via callback if set
   */
  private updateStatus(step: EFileStep, message: string, progress?: number): void {
    if (this.statusCallback) {
      this.statusCallback(step, message, progress)
    }
  }

  // ===========================================================================
  // Step 1: Prepare Return
  // ===========================================================================

  /**
   * Prepare a return for e-file submission
   * Serializes the F1040 form data to XML format
   */
  prepareReturn(f1040: F1040Data): PreparedReturn {
    this.updateStatus('preparing', 'Preparing return for e-file...', 10)

    const info = f1040.info
    const primary = info.taxPayer.primaryPerson
    const spouse = info.taxPayer.spouse

    // Generate unique return ID
    const returnId = this.generateReturnId()

    // Serialize form data to XML
    const xml = this.serializeToXml(f1040)

    // Calculate amounts
    const taxLiability = f1040.l24()
    const totalPayments = f1040.l33()
    const refundOrOwed = f1040.l34() > 0 ? f1040.l34() : -f1040.l37()

    // Build return header
    const header = this.buildReturnHeader(f1040)

    this.updateStatus('preparing', 'Return prepared successfully', 20)

    return {
      xml,
      header,
      returnId,
      taxYear: this.config.taxYear,
      primarySSN: primary.ssid,
      spouseSSN: spouse?.ssid,
      primaryName: `${primary.firstName} ${primary.lastName}`,
      spouseName: spouse ? `${spouse.firstName} ${spouse.lastName}` : undefined,
      taxLiability,
      totalPayments,
      refundOrOwed,
      isJoint: info.taxPayer.filingStatus === 'MFJ',
      preparedAt: new Date()
    }
  }

  /**
   * Generate a unique return identifier
   */
  private generateReturnId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 8)
    return `${timestamp}-${random}`.toUpperCase()
  }

  /**
   * Serialize F1040 form data to MeF-compliant XML
   */
  private serializeToXml(f1040: F1040Data): string {
    const schedules = f1040.schedules()
    const info = f1040.info

    // Build XML structure
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<Return xmlns="http://www.irs.gov/efile" returnVersion="2024v1.0">\n'

    // Return header
    xml += this.buildReturnHeaderXml(info)

    // Return data
    xml += '  <ReturnData documentCnt="' + schedules.length + '">\n'

    for (const schedule of schedules) {
      xml += this.serializeScheduleToXml(schedule)
    }

    xml += '  </ReturnData>\n'
    xml += '</Return>'

    return xml
  }

  /**
   * Build return header for XML
   */
  private buildReturnHeaderXml(info: F1040Data['info']): string {
    const primary = info.taxPayer.primaryPerson
    const spouse = info.taxPayer.spouse

    let xml = '  <ReturnHeader>\n'
    xml += `    <TaxYr>${this.config.taxYear}</TaxYr>\n`
    xml += `    <TaxPeriodBeginDt>${this.config.taxYear}-01-01</TaxPeriodBeginDt>\n`
    xml += `    <TaxPeriodEndDt>${this.config.taxYear}-12-31</TaxPeriodEndDt>\n`
    xml += '    <ReturnTypeCd>1040</ReturnTypeCd>\n'
    xml += `    <SoftwareId>${this.config.mefConfig.softwareId}</SoftwareId>\n`
    xml += `    <SoftwareVersionNum>${this.config.mefConfig.softwareVersion}</SoftwareVersionNum>\n`

    // Filer info
    xml += '    <Filer>\n'
    xml += `      <PrimarySSN>${primary.ssid}</PrimarySSN>\n`
    if (spouse) {
      xml += `      <SpouseSSN>${spouse.ssid}</SpouseSSN>\n`
    }
    xml += `      <NameLine1Txt>${primary.firstName} ${primary.lastName}</NameLine1Txt>\n`
    xml += '      <Address>\n'
    xml += `        <AddressLine1Txt>${primary.address.address}</AddressLine1Txt>\n`
    xml += `        <CityNm>${primary.address.city}</CityNm>\n`
    if (primary.address.state) {
      xml += `        <StateAbbreviationCd>${primary.address.state}</StateAbbreviationCd>\n`
    }
    if (primary.address.zip) {
      xml += `        <ZIPCd>${primary.address.zip}</ZIPCd>\n`
    }
    xml += '      </Address>\n'
    xml += '    </Filer>\n'

    xml += '  </ReturnHeader>\n'
    return xml
  }

  /**
   * Serialize a schedule/form to XML
   */
  private serializeScheduleToXml(schedule: { tag: string; fields: () => unknown[] }): string {
    const tag = schedule.tag
    const fields = schedule.fields()

    let xml = `    <IRS${tag}>\n`

    // Convert fields to XML elements
    fields.forEach((value, index) => {
      if (value !== null && value !== undefined && value !== '') {
        xml += `      <Line${index + 1}>${this.escapeXml(String(value))}</Line${index + 1}>\n`
      }
    })

    xml += `    </IRS${tag}>\n`
    return xml
  }

  /**
   * Escape special XML characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  /**
   * Build return header structure
   */
  private buildReturnHeader(f1040: F1040Data): ReturnHeader {
    const info = f1040.info
    const primary = info.taxPayer.primaryPerson

    const filerGrp: FilerGrp = {
      primarySSN: primary.ssid,
      primaryNameControlTxt: primary.lastName.substring(0, 4).toUpperCase()
    }

    if (info.taxPayer.spouse) {
      filerGrp.spouseSSN = info.taxPayer.spouse.ssid
      filerGrp.spouseNameControlTxt = info.taxPayer.spouse.lastName.substring(0, 4).toUpperCase()
    }

    const originatorGrp: OriginatorGrp = {
      efin: this.config.mefConfig.transmitterInfo.efin,
      originatorTypeCd: 'OnlineFiler'
    }

    return {
      returnTs: new Date().toISOString(),
      taxYr: this.config.taxYear,
      taxPeriodBeginDt: `${this.config.taxYear}-01-01`,
      taxPeriodEndDt: `${this.config.taxYear}-12-31`,
      returnTypeCd: '1040',
      softwareId: this.config.mefConfig.softwareId,
      softwareVersionNum: this.config.mefConfig.softwareVersion,
      originatorGrp,
      filerGrp
    }
  }

  // ===========================================================================
  // Step 2: Validate Return
  // ===========================================================================

  /**
   * Validate a prepared return against IRS schemas and business rules
   */
  validateReturn(prepared: PreparedReturn): ValidationResult {
    this.updateStatus('validating', 'Validating return...', 30)

    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []

    // Schema validation
    const schemaErrors = this.validateSchema(prepared.xml)
    errors.push(...schemaErrors.filter(e => e.type === 'schema'))

    // Business rules validation
    const ruleErrors = this.validateBusinessRules(prepared)
    errors.push(...ruleErrors.filter(e =>
      e.type === 'businessRule' && (e as { severityCd: string }).severityCd === 'Reject'
    ))
    warnings.push(...ruleErrors.filter(e =>
      e.type === 'businessRule' && (e as { severityCd: string }).severityCd !== 'Reject'
    ))

    // Math validation
    const mathErrors = this.validateMath(prepared)
    errors.push(...mathErrors)

    const isValid = errors.length === 0

    this.updateStatus(
      'validating',
      isValid ? 'Validation passed' : `Validation found ${errors.length} error(s)`,
      40
    )

    return {
      isValid,
      errors,
      warnings,
      validationTs: new Date().toISOString(),
      schemaVersion: '2024v1.0',
      businessRulesVersion: '2024.1'
    }
  }

  /**
   * Validate XML against IRS schema
   */
  private validateSchema(xml: string): ValidationError[] {
    const errors: ValidationError[] = []

    // Basic XML structure validation
    if (!xml.includes('<?xml version="1.0"')) {
      errors.push({
        type: 'schema',
        elementNm: 'xml',
        message: 'Missing XML declaration',
        expectedValue: '<?xml version="1.0" encoding="UTF-8"?>'
      })
    }

    if (!xml.includes('<Return')) {
      errors.push({
        type: 'schema',
        elementNm: 'Return',
        message: 'Missing Return root element'
      })
    }

    if (!xml.includes('<ReturnHeader>')) {
      errors.push({
        type: 'schema',
        elementNm: 'ReturnHeader',
        message: 'Missing ReturnHeader element'
      })
    }

    if (!xml.includes('<ReturnData')) {
      errors.push({
        type: 'schema',
        elementNm: 'ReturnData',
        message: 'Missing ReturnData element'
      })
    }

    return errors
  }

  /**
   * Validate against IRS business rules
   */
  private validateBusinessRules(prepared: PreparedReturn): ValidationError[] {
    const errors: ValidationError[] = []

    // SSN format validation
    if (!/^\d{9}$/.test(prepared.primarySSN.replace(/-/g, ''))) {
      errors.push({
        type: 'businessRule',
        ruleNum: 'SSN-001',
        categoryCd: 'IDENTIFICATION',
        description: 'Primary SSN must be 9 digits',
        dataElement: 'PrimarySSN',
        actualValue: prepared.primarySSN,
        severityCd: 'Reject'
      })
    }

    // Joint return validation
    if (prepared.isJoint && !prepared.spouseSSN) {
      errors.push({
        type: 'businessRule',
        ruleNum: 'JOINT-001',
        categoryCd: 'FILING_STATUS',
        description: 'Joint returns require spouse SSN',
        severityCd: 'Reject'
      })
    }

    // Tax year validation
    const taxYear = parseInt(prepared.taxYear)
    const currentYear = new Date().getFullYear()
    if (taxYear > currentYear || taxYear < currentYear - 3) {
      errors.push({
        type: 'businessRule',
        ruleNum: 'YEAR-001',
        categoryCd: 'RETURN_HEADER',
        description: `Tax year ${taxYear} is not valid for e-filing`,
        actualValue: prepared.taxYear,
        severityCd: 'Reject'
      })
    }

    return errors
  }

  /**
   * Validate mathematical calculations
   */
  private validateMath(prepared: PreparedReturn): ValidationError[] {
    const errors: ValidationError[] = []

    // Verify refund/owed calculation
    const expectedRefundOrOwed = prepared.totalPayments - prepared.taxLiability
    const tolerance = 1 // Allow $1 rounding difference

    if (Math.abs(prepared.refundOrOwed - expectedRefundOrOwed) > tolerance) {
      errors.push({
        type: 'math',
        fieldNm: 'RefundOrOwed',
        calculatedValue: expectedRefundOrOwed,
        reportedValue: prepared.refundOrOwed,
        toleranceAmt: tolerance,
        message: 'Refund/Amount Owed does not match calculated value',
        relatedFields: ['TotalPayments', 'TaxLiability']
      })
    }

    return errors
  }

  // ===========================================================================
  // Step 3: Sign Return
  // ===========================================================================

  /**
   * Sign a prepared return with electronic signature
   */
  signReturn(
    prepared: PreparedReturn,
    identity: IdentityVerification,
    signature: ESignature
  ): SignedReturn {
    this.updateStatus('signing', 'Signing return...', 50)

    // Validate signature consent
    if (!signature.form8879Consent) {
      throw new Error('Form 8879 consent is required for e-file')
    }

    // Validate PIN format
    if (!/^\d{5}$/.test(signature.primaryPIN)) {
      throw new Error('Primary PIN must be 5 digits')
    }

    if (prepared.isJoint) {
      if (!signature.spousePIN) {
        throw new Error('Spouse PIN is required for joint returns')
      }
      if (!/^\d{5}$/.test(signature.spousePIN)) {
        throw new Error('Spouse PIN must be 5 digits')
      }
    }

    // Build self-select PIN group
    const selfSelectPINGrp: SelfSelectPINGrp = {
      primaryPIN: signature.primaryPIN,
      primaryPriorYearAGI: identity.primaryPriorYearAGI,
      primaryPriorYearPIN: identity.primaryPriorYearPIN
    }

    if (prepared.isJoint && signature.spousePIN) {
      selfSelectPINGrp.spousePIN = signature.spousePIN
      selfSelectPINGrp.spousePriorYearAGI = identity.spousePriorYearAGI
      selfSelectPINGrp.spousePriorYearPIN = identity.spousePriorYearPIN
    }

    // Update return header with signature info
    const signedHeader: ReturnHeader = {
      ...prepared.header,
      selfSelectPINGrp,
      ipAddress: signature.ipAddress ? {
        ipAddressTxt: signature.ipAddress,
        ipAddressTypeCd: signature.ipAddress.includes(':') ? 'IPv6' : 'IPv4',
        ipTs: new Date().toISOString()
      } : undefined
    }

    // Generate submission ID
    const submissionId = this.generateSubmissionId()

    // Build submission structure
    const submission: Submission = {
      submissionId,
      electronicPostmarkTs: new Date().toISOString(),
      returnHeader: signedHeader,
      returnData: {
        contentTypeCd: 'application/xml',
        content: prepared.xml
      }
    }

    // Generate digital signature
    const digitalSignature = this.generateDigitalSignature(submission)

    this.updateStatus('signing', 'Return signed successfully', 60)

    return {
      prepared,
      identity,
      signature,
      submission,
      digitalSignature,
      signedAt: new Date()
    }
  }

  /**
   * Generate a unique submission ID
   * Format: ETIN (5 chars) + unique ID (15 chars) = 20 chars
   */
  private generateSubmissionId(): SubmissionId {
    const etin = this.config.mefConfig.transmitterInfo.etin
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 10).toUpperCase()
    const uniquePart = (timestamp + random).substring(0, 15)
    return etin + uniquePart
  }

  /**
   * Generate digital signature for submission
   * In production, this would use XMLDSig with the transmitter's certificate
   */
  private generateDigitalSignature(submission: Submission): string {
    // In production, this would:
    // 1. Canonicalize the XML
    // 2. Compute SHA-256 hash
    // 3. Sign with RSA private key
    // 4. Return base64-encoded signature

    // For now, return a placeholder
    const content = JSON.stringify(submission)
    const hash = this.simpleHash(content)
    return `SIGNATURE-${hash}`
  }

  /**
   * Simple hash function for demo purposes
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(36).toUpperCase()
  }

  // ===========================================================================
  // Step 4: Submit Return
  // ===========================================================================

  /**
   * Submit a signed return to the IRS
   */
  async submitReturn(signed: SignedReturn): Promise<SubmissionResult> {
    this.updateStatus('submitting', 'Submitting return to IRS...', 70)

    try {
      // Login to MeF if not already logged in
      if (!this.sessionToken) {
        await this.login()
      }

      // Submit the return
      const result = await this.sendSubmission(signed.submission)

      this.updateStatus(
        'submitting',
        result.success ? 'Return submitted successfully' : 'Submission failed',
        80
      )

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        errorMessage,
        errorCode: 'SUBMISSION_ERROR'
      }
    }
  }

  /**
   * Login to MeF system
   */
  private async login(): Promise<void> {
    const { mefConfig } = this.config

    // In production, this would make a SOAP request to the MeF login endpoint
    // For now, simulate the login
    await this.delay(500)

    // Simulate successful login
    this.sessionToken = `SESSION-${Date.now()}`
  }

  /**
   * Send submission to MeF
   */
  private async sendSubmission(submission: Submission): Promise<SubmissionResult> {
    const { mefConfig } = this.config

    // In production, this would:
    // 1. Build SOAP envelope
    // 2. Add WS-Security headers
    // 3. Send to MeF submit endpoint
    // 4. Parse response

    // Simulate network delay
    await this.delay(1000)

    // Simulate successful submission
    return {
      success: true,
      submissionId: submission.submissionId,
      electronicPostmark: new Date()
    }
  }

  // ===========================================================================
  // Step 5: Poll for Acknowledgment
  // ===========================================================================

  /**
   * Poll for acknowledgment from IRS
   */
  async pollForAcknowledgment(
    submissionId: SubmissionId,
    maxAttempts: number = 10,
    intervalMs: number = 30000
  ): Promise<AcknowledgmentResult> {
    this.updateStatus('polling', 'Waiting for IRS acknowledgment...', 85)

    let pollCount = 0
    let lastPollAt = new Date()

    while (pollCount < maxAttempts) {
      pollCount++
      lastPollAt = new Date()

      this.updateStatus(
        'polling',
        `Checking acknowledgment (attempt ${pollCount}/${maxAttempts})...`,
        85 + (pollCount / maxAttempts) * 10
      )

      try {
        const ack = await this.getAcknowledgment(submissionId)

        if (ack) {
          const status = ack.status

          if (status === 'Accepted') {
            this.updateStatus('accepted', 'Return accepted by IRS!', 100)
            return {
              status,
              acknowledgment: ack,
              pending: false,
              pollCount,
              lastPollAt
            }
          }

          if (status === 'Rejected') {
            this.updateStatus('rejected', 'Return rejected by IRS', 100)
            return {
              status,
              acknowledgment: ack,
              pending: false,
              pollCount,
              lastPollAt
            }
          }
        }

        // Still pending, wait before next poll
        if (pollCount < maxAttempts) {
          await this.delay(intervalMs)
        }
      } catch (error) {
        // Log error but continue polling
        console.error('Error polling for acknowledgment:', error)
      }
    }

    // Max attempts reached
    return {
      status: 'Pending',
      pending: true,
      pollCount,
      lastPollAt
    }
  }

  /**
   * Get acknowledgment for a submission
   */
  private async getAcknowledgment(submissionId: SubmissionId): Promise<Acknowledgment | null> {
    // In production, this would make a SOAP request to the MeF getAck endpoint

    // Simulate network delay
    await this.delay(500)

    // Simulate acknowledgment (in real implementation, this would parse the SOAP response)
    // For demo, randomly return accepted/pending
    const random = Math.random()

    if (random > 0.7) {
      return {
        submissionId,
        status: 'Accepted',
        acceptanceStatusTxt: 'Your return has been accepted',
        ackTs: new Date().toISOString(),
        irsReceiptId: `IRS-${Date.now()}`,
        taxYr: this.config.taxYear,
        returnTypeCd: '1040'
      }
    }

    if (random > 0.9) {
      return {
        submissionId,
        status: 'Rejected',
        acceptanceStatusTxt: 'Your return has been rejected',
        ackTs: new Date().toISOString(),
        errors: [
          {
            errorId: 'R0000-507-01',
            errorCategoryCd: 'BUSINESS-RULE-ERROR',
            errorMessageTxt: 'SSN in the return was used as a dependent on another return',
            ruleNum: 'R0000-507-01',
            severityCd: 'Reject'
          }
        ],
        taxYr: this.config.taxYear,
        returnTypeCd: '1040'
      }
    }

    // Still pending
    return null
  }

  // ===========================================================================
  // Full Workflow
  // ===========================================================================

  /**
   * Execute the complete e-file workflow
   */
  async eFile(
    f1040: F1040Data,
    identity: IdentityVerification,
    signature: ESignature
  ): Promise<EFileResult> {
    const timestamps: EFileResult['timestamps'] = {
      started: new Date()
    }

    let prepared: PreparedReturn | undefined
    let signed: SignedReturn | undefined
    let submission: SubmissionResult | undefined
    let acknowledgment: AcknowledgmentResult | undefined

    try {
      // Step 1: Prepare
      prepared = this.prepareReturn(f1040)
      timestamps.prepared = new Date()

      // Step 2: Validate
      const validation = this.validateReturn(prepared)
      timestamps.validated = new Date()

      if (!validation.isValid) {
        return {
          success: false,
          prepared,
          validationErrors: validation.errors,
          currentStep: 'error',
          error: new Error('Validation failed'),
          timestamps
        }
      }

      // Step 3: Sign
      signed = this.signReturn(prepared, identity, signature)
      timestamps.signed = new Date()

      // Step 4: Submit
      submission = await this.submitReturn(signed)
      timestamps.submitted = new Date()

      if (!submission.success) {
        return {
          success: false,
          prepared,
          signed,
          submission,
          currentStep: 'error',
          error: new Error(submission.errorMessage || 'Submission failed'),
          timestamps
        }
      }

      // Step 5: Poll for acknowledgment
      acknowledgment = await this.pollForAcknowledgment(submission.submissionId!)
      timestamps.acknowledged = new Date()

      // Determine final status
      if (acknowledgment.status === 'Accepted') {
        timestamps.completed = new Date()
        return {
          success: true,
          prepared,
          signed,
          submission,
          acknowledgment,
          currentStep: 'accepted',
          timestamps
        }
      }

      if (acknowledgment.status === 'Rejected') {
        return {
          success: false,
          prepared,
          signed,
          submission,
          acknowledgment,
          rejectionErrors: acknowledgment.acknowledgment?.errors,
          currentStep: 'rejected',
          timestamps
        }
      }

      // Still pending after max attempts
      return {
        success: false,
        prepared,
        signed,
        submission,
        acknowledgment,
        currentStep: 'polling',
        error: new Error('Acknowledgment not received within timeout'),
        timestamps
      }
    } catch (error) {
      return {
        success: false,
        prepared,
        signed,
        submission,
        acknowledgment,
        currentStep: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamps
      }
    }
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Check if the transmitter is configured for test mode
   */
  isTestMode(): boolean {
    return this.config.isTest || this.config.mefConfig.environment === 'ATS'
  }

  /**
   * Get the current session token
   */
  getSessionToken(): string | undefined {
    return this.sessionToken
  }

  /**
   * Clear the session
   */
  clearSession(): void {
    this.sessionToken = undefined
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an EFileTransmitter with default configuration
 */
export function createTransmitter(config: TransmitterConfig): EFileTransmitter {
  return new EFileTransmitter(config)
}

/**
 * Create a test transmitter for development
 */
export function createTestTransmitter(taxYear: string): EFileTransmitter {
  const testConfig: TransmitterConfig = {
    taxYear,
    isTest: true,
    mefConfig: {
      environment: 'ATS',
      endpoints: {
        loginUrl: 'https://la.www4.irs.gov/a2a/mef/login',
        submitUrl: 'https://la.www4.irs.gov/a2a/mef/submit',
        getAckUrl: 'https://la.www4.irs.gov/a2a/mef/getack',
        getStatusUrl: 'https://la.www4.irs.gov/a2a/mef/getstatus',
        getBulkAckUrl: 'https://la.www4.irs.gov/a2a/mef/getbulkack'
      },
      timeoutMs: 60000,
      connectionTimeoutMs: 30000,
      tlsConfig: {
        minVersion: 'TLSv1.2',
        certPath: '',
        keyPath: '',
        rejectUnauthorized: true
      },
      retryConfig: {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
        retryableStatusCodes: [408, 429, 500, 502, 503, 504]
      },
      softwareId: 'USTAXES1',
      softwareVersion: '1.0.0',
      transmitterInfo: {
        etin: 'TEST1',
        efin: '000000',
        softwareId: 'USTAXES1',
        transmitterName: 'UsTaxes Test',
        credentials: {
          etin: 'TEST1',
          appPassword: '',
          certificate: {
            certificateData: '',
            format: 'PEM',
            expirationDate: new Date(),
            serialNumber: '',
            subjectDN: '',
            issuerDN: ''
          },
          privateKey: ''
        }
      }
    }
  }

  return new EFileTransmitter(testConfig)
}

export default EFileTransmitter
