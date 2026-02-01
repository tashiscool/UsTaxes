/**
 * E-File Components Module
 *
 * Exports all e-file related React components for electronic filing of tax returns.
 */

// Main wizard component
export { EFileWizard, default } from './EFileWizard'

// Identity verification
export {
  IdentityVerification,
  default as IdentityVerificationComponent
} from './IdentityVerification'
export type {
  IdentityVerificationData,
  IdentityVerificationProps
} from './IdentityVerification'

// Electronic signature
export { ESignature } from './ESignature'
export type { ESignatureData, ESignatureProps } from './ESignature'

// Status display
export { EFileStatus } from './EFileStatus'
export type { EFileStatusProps } from './EFileStatus'
