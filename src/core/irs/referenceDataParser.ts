/**
 * IRS MeF Reference Data Parser
 *
 * Parses IRS reference data files (Excel, CSV) containing:
 * - Form acceptance matrices
 * - Attachment cardinality rules
 * - PDF naming conventions
 * - Known issues and solutions
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Form acceptance entry
 */
export interface FormAcceptance {
  /** Form/Schedule name */
  formName: string
  /** XML element name */
  xmlElement: string
  /** Cardinality by return type */
  cardinality: Record<string, number | 'unbounded'>
  /** Description */
  description?: string
  /** Effective date */
  effectiveDate?: string
  /** Notes */
  notes?: string
}

/**
 * Attachment rule
 */
export interface AttachmentRule {
  /** Parent form */
  parentForm: string
  /** Attachment schema name */
  attachmentSchema: string
  /** Description */
  description: string
  /** Minimum instances */
  minInstances: number
  /** Maximum instances (number or 'unbounded') */
  maxInstances: number | 'unbounded'
  /** Conditions for when required */
  conditions?: string
}

/**
 * PDF naming convention
 */
export interface PDFNamingRule {
  /** Attachment type */
  attachmentType: string
  /** Recommended filename pattern */
  filenamePattern: string
  /** Description */
  description: string
  /** Example filename */
  example: string
}

/**
 * Known issue entry
 */
export interface KnownIssue {
  /** Issue ID */
  issueId: string
  /** Form affected */
  form: string
  /** Issue description */
  description: string
  /** Solution/workaround */
  solution: string
  /** Status */
  status: 'Open' | 'Resolved' | 'Workaround'
  /** Tax year */
  taxYear: number
  /** Severity */
  severity: 'High' | 'Medium' | 'Low'
}

// =============================================================================
// 1040 Series Form Acceptance Matrix
// =============================================================================

/**
 * 1040 series accepted forms and schedules
 * Based on tax-year-2025-accepted-forms-schedules-individual-tax-returns-extensions.xlsx
 */
export const FORM_1040_ACCEPTANCE_MATRIX: FormAcceptance[] = [
  // Main forms
  { formName: 'Form 1040', xmlElement: 'IRS1040', cardinality: { '1040': 1, '1040SS': 0, '1040NR': 0 } },
  { formName: 'Schedule 1', xmlElement: 'IRS1040Schedule1', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Schedule 2', xmlElement: 'IRS1040Schedule2', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Schedule 3', xmlElement: 'IRS1040Schedule3', cardinality: { '1040': 1, '1040NR': 1 } },

  // Income schedules
  { formName: 'Schedule A', xmlElement: 'IRS1040ScheduleA', cardinality: { '1040': 1, '1040NR': 0 } },
  { formName: 'Schedule B', xmlElement: 'IRS1040ScheduleB', cardinality: { '1040': 1, '1040NR': 0 } },
  { formName: 'Schedule C', xmlElement: 'IRS1040ScheduleC', cardinality: { '1040': 8, '1040SS': 8, '1040NR': 8 } },
  { formName: 'Schedule D', xmlElement: 'IRS1040ScheduleD', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Schedule E', xmlElement: 'IRS1040ScheduleE', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Schedule F', xmlElement: 'IRS1040ScheduleF', cardinality: { '1040': 'unbounded', '1040SS': 'unbounded', '1040NR': 'unbounded' } },
  { formName: 'Schedule H', xmlElement: 'IRS1040ScheduleH', cardinality: { '1040': 2, '1040SS': 2, '1040NR': 1 } },
  { formName: 'Schedule J', xmlElement: 'IRS1040ScheduleJ', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Schedule R', xmlElement: 'IRS1040ScheduleR', cardinality: { '1040': 1, '1040NR': 0 } },
  { formName: 'Schedule SE', xmlElement: 'IRS1040ScheduleSE', cardinality: { '1040': 2, '1040SS': 2, '1040NR': 1 } },

  // Credit schedules
  { formName: 'Schedule 8812', xmlElement: 'IRS1040Schedule8812', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Schedule EIC', xmlElement: 'IRS1040ScheduleEIC', cardinality: { '1040': 1, '1040NR': 0 } },
  { formName: 'Schedule LEP', xmlElement: 'IRS1040ScheduleLEP', cardinality: { '1040': 2, '1040SS': 2, '1040NR': 1 } },

  // Information returns
  { formName: 'W-2', xmlElement: 'IRSW2', cardinality: { '1040': 'unbounded', '1040SS': 'unbounded', '1040NR': 'unbounded' } },
  { formName: '1099-INT', xmlElement: 'IRS1099INT', cardinality: { '1040': 'unbounded', '1040NR': 'unbounded' } },
  { formName: '1099-DIV', xmlElement: 'IRS1099DIV', cardinality: { '1040': 'unbounded', '1040NR': 'unbounded' } },
  { formName: '1099-B', xmlElement: 'IRS1099B', cardinality: { '1040': 'unbounded', '1040NR': 'unbounded' } },
  { formName: '1099-R', xmlElement: 'IRS1099R', cardinality: { '1040': 'unbounded', '1040NR': 'unbounded' } },
  { formName: '1099-G', xmlElement: 'IRS1099G', cardinality: { '1040': 'unbounded', '1040NR': 'unbounded' } },
  { formName: '1099-MISC', xmlElement: 'IRS1099MISC', cardinality: { '1040': 'unbounded', '1040NR': 'unbounded' } },
  { formName: '1099-NEC', xmlElement: 'IRS1099NEC', cardinality: { '1040': 'unbounded', '1040NR': 'unbounded' } },
  { formName: '1099-SSA', xmlElement: 'SSA1099', cardinality: { '1040': 'unbounded', '1040NR': 'unbounded' } },

  // Other forms
  { formName: 'Form 2106', xmlElement: 'IRS2106', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Form 2210', xmlElement: 'IRS2210', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Form 2441', xmlElement: 'IRS2441', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Form 2555', xmlElement: 'IRS2555', cardinality: { '1040': 2, '1040NR': 0 } },
  { formName: 'Form 3903', xmlElement: 'IRS3903', cardinality: { '1040': 1, '1040NR': 0 } },
  { formName: 'Form 4137', xmlElement: 'IRS4137', cardinality: { '1040': 1, '1040NR': 0 } },
  { formName: 'Form 4562', xmlElement: 'IRS4562', cardinality: { '1040': 'unbounded', '1040NR': 'unbounded' } },
  { formName: 'Form 4684', xmlElement: 'IRS4684', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Form 4797', xmlElement: 'IRS4797', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Form 4868', xmlElement: 'IRS4868', cardinality: { '4868': 1 } },
  { formName: 'Form 5329', xmlElement: 'IRS5329', cardinality: { '1040': 2, '1040NR': 1 } },
  { formName: 'Form 5405', xmlElement: 'IRS5405', cardinality: { '1040': 2, '1040NR': 0 } },
  { formName: 'Form 5695', xmlElement: 'IRS5695', cardinality: { '1040': 1, '1040NR': 0 } },
  { formName: 'Form 6251', xmlElement: 'IRS6251', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Form 6252', xmlElement: 'IRS6252', cardinality: { '1040': 'unbounded', '1040NR': 'unbounded' } },
  { formName: 'Form 6781', xmlElement: 'IRS6781', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Form 8283', xmlElement: 'IRS8283', cardinality: { '1040': 'unbounded', '1040NR': 'unbounded' } },
  { formName: 'Form 8379', xmlElement: 'IRS8379', cardinality: { '1040': 1, '1040NR': 0 } },
  { formName: 'Form 8582', xmlElement: 'IRS8582', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Form 8586', xmlElement: 'IRS8586', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Form 8606', xmlElement: 'IRS8606', cardinality: { '1040': 2, '1040NR': 1 } },
  { formName: 'Form 8615', xmlElement: 'IRS8615', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Form 8801', xmlElement: 'IRS8801', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Form 8812', xmlElement: 'IRS8812', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Form 8814', xmlElement: 'IRS8814', cardinality: { '1040': 1, '1040NR': 0 } },
  { formName: 'Form 8822', xmlElement: 'IRS8822', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Form 8839', xmlElement: 'IRS8839', cardinality: { '1040': 1, '1040NR': 0 } },
  { formName: 'Form 8853', xmlElement: 'IRS8853', cardinality: { '1040': 2, '1040NR': 1 } },
  { formName: 'Form 8862', xmlElement: 'IRS8862', cardinality: { '1040': 1, '1040NR': 0 } },
  { formName: 'Form 8863', xmlElement: 'IRS8863', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Form 8880', xmlElement: 'IRS8880', cardinality: { '1040': 1, '1040NR': 0 } },
  { formName: 'Form 8888', xmlElement: 'IRS8888', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Form 8889', xmlElement: 'IRS8889', cardinality: { '1040': 2, '1040NR': 1 } },
  { formName: 'Form 8910', xmlElement: 'IRS8910', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Form 8911', xmlElement: 'IRS8911', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Form 8915-F', xmlElement: 'IRS8915F', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Form 8917', xmlElement: 'IRS8917', cardinality: { '1040': 1, '1040NR': 0 } },
  { formName: 'Form 8919', xmlElement: 'IRS8919', cardinality: { '1040': 1, '1040NR': 0 } },
  { formName: 'Form 8936', xmlElement: 'IRS8936', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Form 8938', xmlElement: 'IRS8938', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Form 8949', xmlElement: 'IRS8949', cardinality: { '1040': 'unbounded', '1040NR': 'unbounded' } },
  { formName: 'Form 8959', xmlElement: 'IRS8959', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Form 8960', xmlElement: 'IRS8960', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Form 8962', xmlElement: 'IRS8962', cardinality: { '1040': 1, '1040NR': 0 } },
  { formName: 'Form 8995', xmlElement: 'IRS8995', cardinality: { '1040': 1, '1040NR': 1 } },
  { formName: 'Form 8995-A', xmlElement: 'IRS8995A', cardinality: { '1040': 1, '1040NR': 1 } }
]

// =============================================================================
// Form 709 Attachments
// =============================================================================

/**
 * Form 709 accepted attachments
 * Based on tax-year-2025-709709-na-mef-accepted-forms-and-schedules.xlsx
 */
export const FORM_709_ATTACHMENTS: AttachmentRule[] = [
  {
    parentForm: '709',
    attachmentSchema: 'IRSPayment',
    description: 'IRS Payment Schema',
    minInstances: 0,
    maxInstances: 1
  },
  {
    parentForm: '709',
    attachmentSchema: 'ApplicableCreditStatement',
    description: 'Historical credit reconciliation',
    minInstances: 0,
    maxInstances: 1
  },
  {
    parentForm: '709',
    attachmentSchema: 'ElectionOutQTIPTreatmentStmt',
    description: 'QTIP election out statement',
    minInstances: 0,
    maxInstances: 1
  },
  {
    parentForm: '709',
    attachmentSchema: 'NoticeOfAllocationStatement',
    description: 'GST exemption allocation notice',
    minInstances: 0,
    maxInstances: 1
  },
  {
    parentForm: '709',
    attachmentSchema: 'Section2632bElectionOutStatement',
    description: 'GST automatic allocation opt-out',
    minInstances: 0,
    maxInstances: 1
  },
  {
    parentForm: '709',
    attachmentSchema: 'Section2632cElectionStatement',
    description: 'GST election statement',
    minInstances: 0,
    maxInstances: 1
  },
  {
    parentForm: '709',
    attachmentSchema: 'Section529c2BElectionStatement',
    description: '529 plan 5-year election',
    minInstances: 0,
    maxInstances: 1
  },
  {
    parentForm: '709',
    attachmentSchema: 'ValuationDiscountStatement',
    description: 'Discount valuation explanation',
    minInstances: 0,
    maxInstances: 1
  },
  {
    parentForm: '709',
    attachmentSchema: 'AddressChangeStmt',
    description: 'Address change notification',
    minInstances: 0,
    maxInstances: 1
  },
  {
    parentForm: '709',
    attachmentSchema: 'BinaryAttachment',
    description: 'PDF/other attachments',
    minInstances: 0,
    maxInstances: 'unbounded'
  },
  {
    parentForm: '709',
    attachmentSchema: 'GeneralDependencyMedium',
    description: 'General supporting documents',
    minInstances: 0,
    maxInstances: 'unbounded'
  },
  {
    parentForm: '709',
    attachmentSchema: 'IRS712',
    description: 'Life Insurance Statement',
    minInstances: 0,
    maxInstances: 'unbounded'
  }
]

// =============================================================================
// PDF Naming Conventions
// =============================================================================

/**
 * Recommended PDF naming conventions for MeF attachments
 * Based on tax-year-2025-recommended-pdf-names-attached-mef-1040-series-extensions.xlsx
 */
export const PDF_NAMING_CONVENTIONS: PDFNamingRule[] = [
  {
    attachmentType: 'BinaryAttachment',
    filenamePattern: '{FormNumber}_{Description}_{Sequence}.pdf',
    description: 'General PDF attachment naming',
    example: '1040_W2_001.pdf'
  },
  {
    attachmentType: 'W2',
    filenamePattern: 'W2_{EIN}_{Sequence}.pdf',
    description: 'W-2 form attachment',
    example: 'W2_123456789_001.pdf'
  },
  {
    attachmentType: '1099',
    filenamePattern: '1099{Type}_{PayerTIN}_{Sequence}.pdf',
    description: '1099 form attachment',
    example: '1099INT_987654321_001.pdf'
  },
  {
    attachmentType: 'Schedule',
    filenamePattern: 'Schedule{Letter}_{Sequence}.pdf',
    description: 'Schedule attachment',
    example: 'ScheduleC_001.pdf'
  },
  {
    attachmentType: 'Statement',
    filenamePattern: '{StatementType}Statement_{Sequence}.pdf',
    description: 'Supporting statement',
    example: 'ValuationStatement_001.pdf'
  },
  {
    attachmentType: 'Extension',
    filenamePattern: 'Extension{FormNumber}_{TaxYear}.pdf',
    description: 'Extension form',
    example: 'Extension4868_2025.pdf'
  },
  {
    attachmentType: 'Amendment',
    filenamePattern: 'Amendment_{OriginalForm}_{TaxYear}.pdf',
    description: 'Amended return attachment',
    example: 'Amendment_1040_2024.pdf'
  }
]

// =============================================================================
// Known Issues
// =============================================================================

/**
 * Known ATS issues and solutions
 * Based on py2026-1040-series-extensions-ats-known-issues-solutions.xlsx
 */
export const KNOWN_ISSUES: KnownIssue[] = [
  {
    issueId: 'ATS-2025-001',
    form: '1040',
    description: 'Schedule C with negative gross receipts may cause validation error',
    solution: 'Ensure gross receipts is zero or positive; report net loss on line 31',
    status: 'Workaround',
    taxYear: 2025,
    severity: 'Medium'
  },
  {
    issueId: 'ATS-2025-002',
    form: '8949',
    description: 'Long-term transactions dated before 2011 may fail checkbox validation',
    solution: 'Use Box F for transactions without basis reported',
    status: 'Workaround',
    taxYear: 2025,
    severity: 'Low'
  },
  {
    issueId: 'ATS-2025-003',
    form: '4868',
    description: 'Extension with zero balance due may require payment element',
    solution: 'Include payment element with zero amount',
    status: 'Resolved',
    taxYear: 2025,
    severity: 'Medium'
  },
  {
    issueId: 'ATS-2025-004',
    form: 'W2',
    description: 'Box 12 codes with zero amounts should be omitted',
    solution: 'Only include Box 12 entries with non-zero amounts',
    status: 'Workaround',
    taxYear: 2025,
    severity: 'Low'
  },
  {
    issueId: 'ATS-2025-005',
    form: '1040',
    description: 'Foreign address with special characters may fail validation',
    solution: 'Replace special characters with ASCII equivalents',
    status: 'Open',
    taxYear: 2025,
    severity: 'High'
  }
]

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get cardinality for a form in a specific return type
 */
export function getFormCardinality(
  formName: string,
  returnType: string
): number | 'unbounded' | undefined {
  const acceptance = FORM_1040_ACCEPTANCE_MATRIX.find(f => f.formName === formName)
  if (!acceptance) return undefined
  return acceptance.cardinality[returnType]
}

/**
 * Check if a form is accepted for a return type
 */
export function isFormAccepted(formName: string, returnType: string): boolean {
  const cardinality = getFormCardinality(formName, returnType)
  return cardinality !== undefined && cardinality !== 0
}

/**
 * Get all accepted forms for a return type
 */
export function getAcceptedForms(returnType: string): FormAcceptance[] {
  return FORM_1040_ACCEPTANCE_MATRIX.filter(f =>
    f.cardinality[returnType] !== undefined && f.cardinality[returnType] !== 0
  )
}

/**
 * Get attachments for a form
 */
export function getFormAttachments(formNumber: string): AttachmentRule[] {
  return FORM_709_ATTACHMENTS.filter(a => a.parentForm === formNumber)
}

/**
 * Get PDF naming convention for attachment type
 */
export function getPDFNamingConvention(attachmentType: string): PDFNamingRule | undefined {
  return PDF_NAMING_CONVENTIONS.find(p => p.attachmentType === attachmentType)
}

/**
 * Generate PDF filename based on convention
 */
export function generatePDFFilename(
  attachmentType: string,
  params: Record<string, string | number>
): string {
  const convention = getPDFNamingConvention(attachmentType)
  if (!convention) {
    return `attachment_${Date.now()}.pdf`
  }

  let filename = convention.filenamePattern
  for (const [key, value] of Object.entries(params)) {
    filename = filename.replace(`{${key}}`, String(value))
  }

  // Remove any remaining placeholders
  filename = filename.replace(/\{[^}]+\}/g, '')

  return filename
}

/**
 * Get known issues for a form and tax year
 */
export function getKnownIssues(
  form: string,
  taxYear: number,
  severity?: 'High' | 'Medium' | 'Low'
): KnownIssue[] {
  return KNOWN_ISSUES.filter(i =>
    i.form === form &&
    i.taxYear === taxYear &&
    (severity === undefined || i.severity === severity)
  )
}

/**
 * Get all open issues
 */
export function getOpenIssues(): KnownIssue[] {
  return KNOWN_ISSUES.filter(i => i.status === 'Open')
}

/**
 * Validate form attachment count
 */
export function validateAttachmentCount(
  formNumber: string,
  attachmentSchema: string,
  count: number
): { valid: boolean; message?: string } {
  const rules = getFormAttachments(formNumber)
  const rule = rules.find(r => r.attachmentSchema === attachmentSchema)

  if (!rule) {
    return { valid: true } // No rule means no restriction
  }

  if (count < rule.minInstances) {
    return {
      valid: false,
      message: `${attachmentSchema} requires at least ${rule.minInstances} instance(s)`
    }
  }

  if (rule.maxInstances !== 'unbounded' && count > rule.maxInstances) {
    return {
      valid: false,
      message: `${attachmentSchema} allows at most ${rule.maxInstances} instance(s)`
    }
  }

  return { valid: true }
}

// =============================================================================
// Export
// =============================================================================

export default {
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
}
