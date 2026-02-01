/**
 * MeF (Modernized e-File) Module
 *
 * This module provides functionality for electronically filing tax returns
 * with the IRS via the MeF SOAP web services.
 */

// SOAP Client
export {
  MeFClient,
  MeFError,
  createATSClient,
  createProductionClient,
  ENDPOINTS
} from './client'

export type {
  MeFConfig,
  MeFCredentials,
  LoginResponse,
  ReturnSubmission,
  StateSubmissionData,
  SubmitResponse,
  SubmissionError,
  Acknowledgment,
  AcknowledgmentStatus,
  AcknowledgmentError,
  StateAcknowledgment,
  SubmissionStatus,
  StateSubmission,
  MeFErrorCategory
} from './client'

// XML Digital Signature
export {
  // Main class
  XmlSigner,
  // Factory functions
  createSigner,
  signXml,
  verifyXml,
  // Helper functions
  base64Encode,
  base64Decode,
  computeDigest,
  createSignature,
  verifySignature,
  canonicalize,
  extractCertificateData
} from './signer'

export type { SignerConfig, SignOptions, VerificationResult } from './signer'

// XML Serialization
export {
  Form1040Serializer,
  createSerializer,
  // Utility functions
  formatAmount,
  formatAmountWithCents,
  formatSSN,
  formatEIN,
  formatDate,
  formatTimestamp,
  escapeXml
} from './serializer'

export type { SerializerConfig } from './serializer'
