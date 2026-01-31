/**
 * E-File Module
 *
 * Main entry point for the e-file functionality.
 * Exports all types, utilities, and the transmitter service for electronic filing.
 */

// =============================================================================
// Transmitter Service
// =============================================================================

export {
  EFileTransmitter,
  createTransmitter,
  createTestTransmitter
} from './mef/transmitter'

export type {
  TransmitterConfig,
  PreparedReturn,
  IdentityVerification,
  ESignature,
  SignedReturn,
  SubmissionResult,
  AcknowledgmentResult,
  EFileResult,
  EFileStep,
  EFileStatusCallback,
  F1040Data
} from './mef/transmitter'

// =============================================================================
// MeF Types
// =============================================================================

export type {
  // Transmitter Information
  ETIN,
  EFIN,
  SoftwareId,
  MeFCertificate,
  MeFCredentials,
  TransmitterInfo,

  // Return Header
  ReturnTypeCd,
  OriginatorTypeCd,
  OriginatorGrp,
  PractitionerPINGrp,
  SelfSelectPINGrp,
  OnlineFilerGrp,
  FilerGrp,
  ReturnHeader,
  IPAddress,
  PaidPreparerInformationGrp,
  AddressGrp,

  // Submission
  SubmissionId,
  BinaryAttachment,
  ReturnData,
  Submission,
  SubmissionManifest,
  SubmissionManifestItem,

  // Acknowledgment
  AckStatus,
  ErrorCategoryCd,
  AckError,
  RefundInformation,
  StateAcknowledgment,
  Acknowledgment,

  // Request/Response
  MeFRequest,
  MeFResponse,
  LoginRequest,
  LoginResponse,
  SubmitReturnRequest,
  SubmitReturnResponse,
  GetAckRequest,
  GetAckResponse,
  SubmissionStatusCd,
  GetSubmissionStatusRequest,
  SubmissionStatusDetail,
  GetSubmissionStatusResponse,
  GetBulkAckRequest,
  GetBulkAckResponse,

  // Validation
  SchemaValidationError,
  BusinessRuleError,
  MathValidationError,
  ConsistencyError,
  ValidationError,
  ValidationResult,

  // Configuration
  MeFEnvironment,
  MeFEndpoints,
  RetryConfig,
  TlsConfig,
  MeFLoggingConfig,
  MeFConfig,
  ProxyConfig
} from './types/mefTypes'

export {
  ATS_ENDPOINTS,
  PRODUCTION_ENDPOINTS,
  DEFAULT_RETRY_CONFIG,
  createDefaultMeFConfig
} from './types/mefTypes'
