/**
 * IRS Schema and Reference Data Module
 *
 * Provides centralized access to IRS form schemas, reference data,
 * and validation utilities.
 */

export {
  schemaRegistry,
  IRSDataType,
  IRS_PATTERNS,
  createForm709Definition,
  FORM_709_RELATIONSHIPS
} from './schemaRegistry'

export type {
  FieldPattern,
  Cardinality,
  CalculationRule,
  ConditionalRule,
  FieldDefinition,
  SectionDefinition,
  ScheduleDefinition,
  FormDefinition
} from './schemaRegistry'

export {
  FORM_1040_ACCEPTANCE_MATRIX,
  FORM_709_ATTACHMENTS,
  PDF_NAMING_CONVENTIONS,
  KNOWN_ISSUES,
  getFormCardinality,
  isFormAccepted,
  getAcceptedForms,
  getFormAttachments,
  getPDFNamingConvention,
  generatePDFFilename,
  getKnownIssues,
  getOpenIssues,
  validateAttachmentCount
} from './referenceDataParser'

export type {
  FormAcceptance,
  AttachmentRule,
  PDFNamingRule,
  KnownIssue
} from './referenceDataParser'
