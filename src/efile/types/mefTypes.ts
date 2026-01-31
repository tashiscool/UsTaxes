/**
 * MeF (Modernized e-File) Types and Interfaces
 *
 * Comprehensive TypeScript types for IRS e-file submission via the MeF system.
 * These types align with IRS Publication 4164 and MeF schema specifications.
 */

// =============================================================================
// 1. Transmitter Information
// =============================================================================

/**
 * Electronic Transmitter Identification Number
 * 5-character alphanumeric identifier assigned by IRS
 */
export type ETIN = string

/**
 * Electronic Filing Identification Number
 * 6-digit number assigned by IRS to authorized e-file providers
 */
export type EFIN = string

/**
 * Software Identification Number
 * 8-character alphanumeric assigned by IRS to approved tax software
 */
export type SoftwareId = string

/**
 * X.509 Certificate for MeF authentication
 */
export interface MeFCertificate {
  /** PEM or DER encoded certificate data */
  certificateData: string
  /** Certificate format */
  format: 'PEM' | 'DER'
  /** Certificate expiration date */
  expirationDate: Date
  /** Certificate serial number */
  serialNumber: string
  /** Subject distinguished name */
  subjectDN: string
  /** Issuer distinguished name */
  issuerDN: string
}

/**
 * Credentials for MeF system authentication
 */
export interface MeFCredentials {
  /** Electronic Transmitter Identification Number */
  etin: ETIN
  /** Application password for MeF access */
  appPassword: string
  /** X.509 certificate for mutual TLS */
  certificate: MeFCertificate
  /** Private key for certificate (encrypted) */
  privateKey: string
  /** Private key passphrase */
  privateKeyPassphrase?: string
}

/**
 * Complete transmitter information
 */
export interface TransmitterInfo {
  /** Electronic Transmitter Identification Number */
  etin: ETIN
  /** Electronic Filing Identification Number */
  efin: EFIN
  /** Software Identification Number */
  softwareId: SoftwareId
  /** Transmitter credentials */
  credentials: MeFCredentials
  /** Transmitter business name */
  transmitterName: string
  /** Transmitter control code */
  transmitterControlCode?: string
}

// =============================================================================
// 2. Return Header
// =============================================================================

/**
 * Return type codes supported by MeF
 */
export type ReturnTypeCd =
  | '1040'
  | '1040A'
  | '1040EZ'
  | '1040NR'
  | '1040SR'
  | '1040SS'
  | '1040PR'
  | '1040X'
  | '1120'
  | '1120S'
  | '1120F'
  | '1065'
  | '990'
  | '990EZ'
  | '990PF'
  | '941'
  | '944'

/**
 * Originator type for e-file submission
 */
export type OriginatorTypeCd =
  | 'OnlineFiler'
  | 'ERO'
  | 'PractitionerPIN'
  | 'ReportingAgent'

/**
 * Originator group information
 */
export interface OriginatorGrp {
  /** Electronic Filing Identification Number of originator */
  efin: EFIN
  /** Type of originator */
  originatorTypeCd: OriginatorTypeCd
}

/**
 * Practitioner PIN information for self-select PIN method
 */
export interface PractitionerPINGrp {
  /** EFIN of the practitioner */
  efin: EFIN
  /** Practitioner PIN */
  pin: string
}

/**
 * Self-select PIN information
 */
export interface SelfSelectPINGrp {
  /** Primary taxpayer PIN */
  primaryPIN: string
  /** Spouse PIN (if applicable) */
  spousePIN?: string
  /** Primary prior year AGI or PIN */
  primaryPriorYearAGI?: number
  primaryPriorYearPIN?: string
  /** Spouse prior year AGI or PIN */
  spousePriorYearAGI?: number
  spousePriorYearPIN?: string
}

/**
 * Online filer information
 */
export interface OnlineFilerGrp {
  /** Primary signature PIN */
  primarySignaturePIN: string
  /** Spouse signature PIN */
  spouseSignaturePIN?: string
  /** Primary signature date */
  primarySignatureDt: string
  /** Spouse signature date */
  spouseSignatureDt?: string
}

/**
 * Filer identification information
 */
export interface FilerGrp {
  /** Primary SSN */
  primarySSN: string
  /** Spouse SSN (if filing jointly) */
  spouseSSN?: string
  /** Primary name */
  primaryNameControlTxt: string
  /** Spouse name control */
  spouseNameControlTxt?: string
}

/**
 * Return header containing metadata about the tax return
 */
export interface ReturnHeader {
  /** Return timestamp in ISO 8601 format */
  returnTs: string
  /** Tax year (4-digit year) */
  taxYr: string
  /** Tax period begin date (YYYY-MM-DD) */
  taxPeriodBeginDt: string
  /** Tax period end date (YYYY-MM-DD) */
  taxPeriodEndDt: string
  /** Return type code */
  returnTypeCd: ReturnTypeCd
  /** Software ID */
  softwareId: SoftwareId
  /** Software version number */
  softwareVersionNum: string
  /** Originator group */
  originatorGrp: OriginatorGrp
  /** Filer information */
  filerGrp: FilerGrp
  /** PIN authentication method (one of these should be present) */
  selfSelectPINGrp?: SelfSelectPINGrp
  practitionerPINGrp?: PractitionerPINGrp
  onlineFilerGrp?: OnlineFilerGrp
  /** IP address of filer (for online filing) */
  ipAddress?: IPAddress
  /** Device ID for fraud prevention */
  deviceId?: string
  /** Preparer information (if applicable) */
  paidPreparerInformationGrp?: PaidPreparerInformationGrp
  /** Total amount of forms in return */
  totalFormsCnt?: number
  /** Whether return is for a deceased taxpayer */
  deceasedPrimaryInd?: boolean
  /** Whether return is for a deceased spouse */
  deceasedSpouseInd?: boolean
}

/**
 * IP Address structure
 */
export interface IPAddress {
  /** IPv4 or IPv6 address */
  ipAddressTxt: string
  /** IP address type */
  ipAddressTypeCd: 'IPv4' | 'IPv6'
  /** Timestamp of IP capture */
  ipTs: string
}

/**
 * Paid preparer information
 */
export interface PaidPreparerInformationGrp {
  /** Preparer PTIN */
  ptin: string
  /** Preparer firm EIN */
  firmEIN?: string
  /** Preparer firm name */
  firmName?: string
  /** Preparer name */
  preparerName: string
  /** Self-employed indicator */
  selfEmployedInd: boolean
  /** Preparer phone number */
  phoneNum?: string
  /** Preparer address */
  address?: AddressGrp
}

/**
 * Address group
 */
export interface AddressGrp {
  /** Address line 1 */
  addressLine1Txt: string
  /** Address line 2 */
  addressLine2Txt?: string
  /** City name */
  cityNm: string
  /** State abbreviation */
  stateAbbreviationCd: string
  /** ZIP code */
  zipCd: string
  /** Country code (for foreign addresses) */
  countryCd?: string
}

// =============================================================================
// 3. Submission
// =============================================================================

/**
 * Unique submission identifier (20 characters)
 * Format: ETIN (5) + unique ID (15)
 */
export type SubmissionId = string

/**
 * Binary attachment for submission
 */
export interface BinaryAttachment {
  /** Attachment ID */
  attachmentId: string
  /** Document sequence number */
  documentSequenceNum: string
  /** Document type */
  documentTypeCd: string
  /** Content type (MIME type) */
  contentType: string
  /** Base64 encoded content */
  content: string
  /** Original filename */
  fileName?: string
  /** File size in bytes */
  fileSize?: number
  /** Description of attachment */
  description?: string
}

/**
 * Return data containing the actual tax return content
 */
export interface ReturnData<T = unknown> {
  /** Content type identifier */
  contentTypeCd: string
  /** Content location reference */
  contentLocationTxt?: string
  /** The actual return data */
  content: T
  /** Document ID */
  documentId?: string
  /** Binary attachments (W-2 images, PDFs, etc.) */
  binaryAttachments?: BinaryAttachment[]
}

/**
 * Complete submission structure
 */
export interface Submission<T = unknown> {
  /** Unique submission identifier */
  submissionId: SubmissionId
  /** Electronic postmark timestamp */
  electronicPostmarkTs: string
  /** Return header information */
  returnHeader: ReturnHeader
  /** Return data */
  returnData: ReturnData<T>
  /** MIME boundary (for multipart submissions) */
  mimeBoundary?: string
  /** Submission manifest */
  manifest?: SubmissionManifest
}

/**
 * Submission manifest
 */
export interface SubmissionManifest {
  /** Count of returns in submission */
  returnCnt: number
  /** Return list */
  returnList: SubmissionManifestItem[]
}

/**
 * Submission manifest item
 */
export interface SubmissionManifestItem {
  /** Submission ID for this return */
  submissionId: SubmissionId
  /** Return type */
  returnTypeCd: ReturnTypeCd
  /** Primary SSN or EIN */
  tin: string
}

// =============================================================================
// 4. Acknowledgment
// =============================================================================

/**
 * Acknowledgment status
 */
export type AckStatus = 'Accepted' | 'Rejected' | 'Pending'

/**
 * Error category codes
 */
export type ErrorCategoryCd =
  | 'IRS-DATABASE-ERROR'
  | 'SCHEMA-ERROR'
  | 'BUSINESS-RULE-ERROR'
  | 'FORM-ERROR'
  | 'XML-ERROR'
  | 'MATH-ERROR'
  | 'DUPLICATE-ERROR'
  | 'SECURITY-ERROR'
  | 'TRANSMISSION-ERROR'

/**
 * Acknowledgment error detail
 */
export interface AckError {
  /** Unique error identifier */
  errorId: string
  /** Error category */
  errorCategoryCd: ErrorCategoryCd
  /** Human-readable error message */
  errorMessageTxt: string
  /** XPath to the element with the error */
  xpath?: string
  /** Field name in error */
  fieldNm?: string
  /** Field value that caused the error */
  fieldValueTxt?: string
  /** Error severity */
  severityCd?: 'Reject' | 'Alert' | 'Warning'
  /** IRS rule reference */
  ruleNum?: string
  /** Data value that triggered the error */
  dataValueTxt?: string
}

/**
 * Refund information (for accepted returns)
 */
export interface RefundInformation {
  /** Refund amount */
  refundAmt?: number
  /** Balance due amount */
  balanceDueAmt?: number
  /** Direct deposit routing transit number */
  routingTransitNum?: string
  /** Bank account number (masked) */
  bankAccountNum?: string
  /** Account type */
  accountTypeCd?: 'Checking' | 'Savings'
  /** Estimated refund date */
  estimatedRefundDt?: string
}

/**
 * State acknowledgment information
 */
export interface StateAcknowledgment {
  /** State abbreviation */
  stateAbbreviationCd: string
  /** State submission ID */
  stateSubmissionId: string
  /** State acknowledgment status */
  status: AckStatus
  /** State-specific errors */
  errors?: AckError[]
  /** State acceptance timestamp */
  acceptanceTs?: string
}

/**
 * Complete acknowledgment structure
 */
export interface Acknowledgment {
  /** Submission ID being acknowledged */
  submissionId: SubmissionId
  /** Acknowledgment status */
  status: AckStatus
  /** Status text */
  acceptanceStatusTxt: string
  /** Acknowledgment timestamp */
  ackTs: string
  /** Error details (if rejected) */
  errors?: AckError[]
  /** Refund information (if accepted) */
  refundInformation?: RefundInformation
  /** State acknowledgments (for federal/state combined filing) */
  stateAcknowledgments?: StateAcknowledgment[]
  /** IRS receipt ID */
  irsReceiptId?: string
  /** Submission category */
  submissionCategoryCd?: string
  /** Tax year */
  taxYr?: string
  /** Return type */
  returnTypeCd?: ReturnTypeCd
  /** Processing timestamp */
  processTs?: string
}

// =============================================================================
// 5. MeF Request/Response Types
// =============================================================================

/**
 * Base request interface
 */
export interface MeFRequest {
  /** Request timestamp */
  requestTs: string
  /** ETIN for authentication */
  etin: ETIN
}

/**
 * Base response interface
 */
export interface MeFResponse {
  /** Response timestamp */
  responseTs: string
  /** Whether the request was successful */
  success: boolean
  /** Error message if not successful */
  errorMessage?: string
  /** Error code if not successful */
  errorCode?: string
}

/**
 * Login request
 */
export interface LoginRequest extends MeFRequest {
  /** Application password */
  appPassword: string
}

/**
 * Login response
 */
export interface LoginResponse extends MeFResponse {
  /** Session token for subsequent requests */
  sessionToken?: string
  /** Token expiration timestamp */
  tokenExpiration?: string
  /** Transmitter information */
  transmitterInfo?: Partial<TransmitterInfo>
}

/**
 * Submit return request
 */
export interface SubmitReturnRequest<T = unknown> extends MeFRequest {
  /** The submission to send */
  submission: Submission<T>
  /** Session token */
  sessionToken: string
  /** Test indicator (for ATS testing) */
  testInd?: boolean
}

/**
 * Submit return response
 */
export interface SubmitReturnResponse extends MeFResponse {
  /** Assigned submission ID */
  submissionId?: SubmissionId
  /** Electronic postmark timestamp */
  electronicPostmarkTs?: string
  /** Initial receipt acknowledgment */
  receiptAck?: string
}

/**
 * Get acknowledgment request
 */
export interface GetAckRequest extends MeFRequest {
  /** Submission ID to get acknowledgment for */
  submissionId: SubmissionId
  /** Session token */
  sessionToken: string
}

/**
 * Get acknowledgment response
 */
export interface GetAckResponse extends MeFResponse {
  /** The acknowledgment */
  acknowledgment?: Acknowledgment
}

/**
 * Submission status detail
 */
export type SubmissionStatusCd =
  | 'Received'
  | 'Processing'
  | 'Accepted'
  | 'Rejected'
  | 'Pending'
  | 'Queued'
  | 'Error'

/**
 * Get submission status request
 */
export interface GetSubmissionStatusRequest extends MeFRequest {
  /** Submission ID to check status for */
  submissionId: SubmissionId
  /** Session token */
  sessionToken: string
}

/**
 * Submission status detail
 */
export interface SubmissionStatusDetail {
  /** Current status */
  statusCd: SubmissionStatusCd
  /** Status message */
  statusTxt: string
  /** Last update timestamp */
  lastUpdateTs: string
  /** Estimated completion time */
  estimatedCompletionTs?: string
}

/**
 * Get submission status response
 */
export interface GetSubmissionStatusResponse extends MeFResponse {
  /** Submission ID */
  submissionId?: SubmissionId
  /** Current status */
  statusDetail?: SubmissionStatusDetail
  /** Whether acknowledgment is ready */
  ackReady?: boolean
}

/**
 * Bulk acknowledgment request
 */
export interface GetBulkAckRequest extends MeFRequest {
  /** Session token */
  sessionToken: string
  /** Maximum number of acknowledgments to retrieve */
  maxRetrieveCnt?: number
  /** Last retrieved timestamp (for pagination) */
  lastRetrievedTs?: string
}

/**
 * Bulk acknowledgment response
 */
export interface GetBulkAckResponse extends MeFResponse {
  /** Array of acknowledgments */
  acknowledgments?: Acknowledgment[]
  /** Whether more acknowledgments are available */
  moreAvailable?: boolean
  /** Last retrieved timestamp (for pagination) */
  lastRetrievedTs?: string
}

// =============================================================================
// 6. Validation Types
// =============================================================================

/**
 * Schema validation error
 */
export interface SchemaValidationError {
  /** Error type identifier */
  type: 'schema'
  /** Line number in XML */
  lineNum?: number
  /** Column number in XML */
  columnNum?: number
  /** Schema element name */
  elementNm: string
  /** Expected value or pattern */
  expectedValue?: string
  /** Actual value found */
  actualValue?: string
  /** Error message */
  message: string
  /** Schema path */
  schemaPath?: string
  /** XPath to element */
  xpath?: string
}

/**
 * Business rule error
 */
export interface BusinessRuleError {
  /** Error type identifier */
  type: 'businessRule'
  /** Rule number (from IRS business rules) */
  ruleNum: string
  /** Rule category */
  categoryCd: string
  /** Rule description */
  description: string
  /** Data element causing the error */
  dataElement?: string
  /** Actual value */
  actualValue?: string
  /** Expected condition */
  expectedCondition?: string
  /** Severity */
  severityCd: 'Reject' | 'Alert' | 'Warning'
  /** XPath to element */
  xpath?: string
  /** Form line number reference */
  formLineRef?: string
}

/**
 * Math error in calculations
 */
export interface MathValidationError {
  /** Error type identifier */
  type: 'math'
  /** Field name with error */
  fieldNm: string
  /** Calculated value */
  calculatedValue: number
  /** Reported value */
  reportedValue: number
  /** Tolerance for difference */
  toleranceAmt: number
  /** Error message */
  message: string
  /** Related fields */
  relatedFields?: string[]
}

/**
 * Data consistency error
 */
export interface ConsistencyError {
  /** Error type identifier */
  type: 'consistency'
  /** Primary field */
  primaryField: string
  /** Related field that is inconsistent */
  relatedField: string
  /** Primary field value */
  primaryValue: string | number
  /** Related field value */
  relatedValue: string | number
  /** Error message */
  message: string
}

/**
 * Union type for all validation errors
 */
export type ValidationError =
  | SchemaValidationError
  | BusinessRuleError
  | MathValidationError
  | ConsistencyError

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean
  /** Array of validation errors */
  errors: ValidationError[]
  /** Array of warnings (non-blocking) */
  warnings: ValidationError[]
  /** Timestamp of validation */
  validationTs: string
  /** Schema version used */
  schemaVersion?: string
  /** Business rules version used */
  businessRulesVersion?: string
}

// =============================================================================
// 7. Configuration
// =============================================================================

/**
 * MeF environment type
 */
export type MeFEnvironment = 'ATS' | 'Production'

/**
 * MeF endpoints configuration
 */
export interface MeFEndpoints {
  /** Login endpoint URL */
  loginUrl: string
  /** Submit return endpoint URL */
  submitUrl: string
  /** Get acknowledgment endpoint URL */
  getAckUrl: string
  /** Get status endpoint URL */
  getStatusUrl: string
  /** Bulk acknowledgment retrieval URL */
  getBulkAckUrl: string
  /** WSDL URL */
  wsdlUrl?: string
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number
  /** Initial delay in milliseconds */
  initialDelayMs: number
  /** Maximum delay in milliseconds */
  maxDelayMs: number
  /** Backoff multiplier */
  backoffMultiplier: number
  /** HTTP status codes that trigger retry */
  retryableStatusCodes: number[]
}

/**
 * TLS/SSL configuration
 */
export interface TlsConfig {
  /** Minimum TLS version */
  minVersion: 'TLSv1.2' | 'TLSv1.3'
  /** Certificate path */
  certPath: string
  /** Private key path */
  keyPath: string
  /** CA bundle path */
  caPath?: string
  /** Whether to verify server certificate */
  rejectUnauthorized: boolean
}

/**
 * Logging configuration for MeF operations
 */
export interface MeFLoggingConfig {
  /** Whether to log requests */
  logRequests: boolean
  /** Whether to log responses */
  logResponses: boolean
  /** Whether to mask sensitive data in logs */
  maskSensitiveData: boolean
  /** Fields to mask */
  sensitiveFields: string[]
}

/**
 * Complete MeF configuration
 */
export interface MeFConfig {
  /** Environment (ATS for testing, Production for live) */
  environment: MeFEnvironment
  /** API endpoints */
  endpoints: MeFEndpoints
  /** Request timeout in milliseconds */
  timeoutMs: number
  /** Connection timeout in milliseconds */
  connectionTimeoutMs: number
  /** TLS configuration */
  tlsConfig: TlsConfig
  /** Retry configuration */
  retryConfig: RetryConfig
  /** Logging configuration */
  loggingConfig?: MeFLoggingConfig
  /** Software ID */
  softwareId: SoftwareId
  /** Software version */
  softwareVersion: string
  /** Transmitter info */
  transmitterInfo: TransmitterInfo
  /** Enable debug mode */
  debug?: boolean
  /** Proxy configuration (if needed) */
  proxy?: ProxyConfig
}

/**
 * Proxy configuration
 */
export interface ProxyConfig {
  /** Proxy host */
  host: string
  /** Proxy port */
  port: number
  /** Proxy username */
  username?: string
  /** Proxy password */
  password?: string
  /** Proxy protocol */
  protocol: 'http' | 'https' | 'socks5'
}

/**
 * Default endpoints for ATS (Assurance Testing System)
 */
export const ATS_ENDPOINTS: MeFEndpoints = {
  loginUrl: 'https://la.www4.irs.gov/a2a/mef/login',
  submitUrl: 'https://la.www4.irs.gov/a2a/mef/submit',
  getAckUrl: 'https://la.www4.irs.gov/a2a/mef/getack',
  getStatusUrl: 'https://la.www4.irs.gov/a2a/mef/getstatus',
  getBulkAckUrl: 'https://la.www4.irs.gov/a2a/mef/getbulkack'
}

/**
 * Default endpoints for Production
 */
export const PRODUCTION_ENDPOINTS: MeFEndpoints = {
  loginUrl: 'https://la.www4.irs.gov/a2a/mef/login',
  submitUrl: 'https://la.www4.irs.gov/a2a/mef/submit',
  getAckUrl: 'https://la.www4.irs.gov/a2a/mef/getack',
  getStatusUrl: 'https://la.www4.irs.gov/a2a/mef/getstatus',
  getBulkAckUrl: 'https://la.www4.irs.gov/a2a/mef/getbulkack'
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504]
}

/**
 * Create default MeF configuration for a given environment
 */
export function createDefaultMeFConfig(
  environment: MeFEnvironment,
  transmitterInfo: TransmitterInfo,
  tlsConfig: TlsConfig
): MeFConfig {
  return {
    environment,
    endpoints:
      environment === 'ATS' ? ATS_ENDPOINTS : PRODUCTION_ENDPOINTS,
    timeoutMs: 120000,
    connectionTimeoutMs: 30000,
    tlsConfig,
    retryConfig: DEFAULT_RETRY_CONFIG,
    softwareId: transmitterInfo.softwareId,
    softwareVersion: '1.0.0',
    transmitterInfo,
    loggingConfig: {
      logRequests: environment === 'ATS',
      logResponses: environment === 'ATS',
      maskSensitiveData: true,
      sensitiveFields: ['ssn', 'ein', 'pin', 'password', 'bankAccountNum']
    }
  }
}
