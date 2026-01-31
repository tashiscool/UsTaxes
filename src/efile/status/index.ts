/**
 * MeF Status Tracking Module
 *
 * This module provides acknowledgment processing and submission status tracking
 * for IRS Modernized e-File (MeF) submissions.
 *
 * @module efile/status
 */

// Acknowledgment processing
export {
  AcknowledgmentProcessor,
  ERROR_CODES,
  type Acknowledgment,
  type AcknowledgmentError,
  type RefundInfo,
  type ProcessedAcknowledgment,
  type ParsedError,
  type ErrorResolution
} from './acknowledgment'

// Status tracking
export {
  StatusTracker,
  formatSubmissionState,
  getStateIndicator,
  timeSinceLastChange,
  type SubmissionState,
  type StateChange,
  type Submission,
  type SubmissionStatus,
  type PollConfig,
  type PollingState
} from './statusTracker'

// Default exports for convenience
export { AcknowledgmentProcessor as default } from './acknowledgment'
