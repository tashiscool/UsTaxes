/**
 * E-File Types Module
 *
 * Central export for all MeF (Modernized e-File) types and interfaces.
 */

// =============================================================================
// MeF Types - Core IRS e-file types
// =============================================================================

export {
  // Transmitter Information
  type ETIN,
  type EFIN,
  type SoftwareId,
  type MeFCertificate,
  type MeFCredentials,
  type TransmitterInfo,

  // Return Header
  type ReturnTypeCd,
  type OriginatorTypeCd,
  type OriginatorGrp,
  type PractitionerPINGrp,
  type SelfSelectPINGrp,
  type OnlineFilerGrp,
  type FilerGrp,
  type ReturnHeader,
  type IPAddress,
  type PaidPreparerInformationGrp,
  type AddressGrp,

  // Submission
  type SubmissionId,
  type BinaryAttachment,
  type ReturnData,
  type Submission,
  type SubmissionManifest,
  type SubmissionManifestItem,

  // Acknowledgment
  type AckStatus,
  type ErrorCategoryCd,
  type AckError,
  type RefundInformation,
  type StateAcknowledgment,
  type Acknowledgment,

  // MeF Request/Response Types
  type MeFRequest,
  type MeFResponse,
  type LoginRequest,
  type LoginResponse,
  type SubmitReturnRequest,
  type SubmitReturnResponse,
  type GetAckRequest,
  type GetAckResponse,
  type SubmissionStatusCd,
  type GetSubmissionStatusRequest,
  type SubmissionStatusDetail,
  type GetSubmissionStatusResponse,
  type GetBulkAckRequest,
  type GetBulkAckResponse,

  // Validation Types
  type SchemaValidationError,
  type BusinessRuleError,
  type MathValidationError,
  type ConsistencyError,
  type ValidationError,
  type ValidationResult,

  // Configuration
  type MeFEnvironment,
  type MeFEndpoints,
  type RetryConfig,
  type TlsConfig,
  type MeFLoggingConfig,
  type MeFConfig,
  type ProxyConfig,

  // Constants and Helpers
  ATS_ENDPOINTS,
  PRODUCTION_ENDPOINTS,
  DEFAULT_RETRY_CONFIG,
  createDefaultMeFConfig
} from './mefTypes'
