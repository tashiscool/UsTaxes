/**
 * Type definitions for the Tax Explainer API.
 */

export interface TaxContext {
  filingStatus?: string
  hasDependents?: boolean
  state?: string
  userValues?: Record<string, unknown>
}

export interface ExplainLineItemRequest {
  formId: string
  lineNumber: string
  taxYear?: number
  context?: TaxContext
  detailLevel?: 'brief' | 'standard' | 'detailed'
}

export interface IRCCitation {
  section: string
  title: string
  subsectionsCited: string[]
  excerpt: string
  sourcePath: string
}

export interface TreasuryRegCitation {
  regulation: string
  title: string
}

export interface IRSPublicationRef {
  number: string
  title: string
}

export interface LegalBasis {
  primaryIrcSection: IRCCitation | null
  relatedSections: IRCCitation[]
  treasuryRegulations: TreasuryRegCitation[]
  irsPublications: IRSPublicationRef[]
}

export interface Explanation {
  summary: string
  plainEnglish: string
  calculationNotes?: string
  detailLevel: string
}

export interface RelatedForm {
  form: string
  relationship: string
}

export interface ExplainLineItemResponse {
  explanation: Explanation
  legalBasis: LegalBasis
  relatedForms: RelatedForm[]
  metadata: Record<string, unknown>
}

export interface SearchIRCRequest {
  query: string
  filters?: Record<string, unknown>
  limit?: number
  includeRegulations?: boolean
}

export interface IRCSearchResult {
  section: string
  title: string
  relevanceScore: number
  snippet: string
  subsections: string[]
  relatedForms: string[]
}

export interface SearchIRCResponse {
  results: IRCSearchResult[]
  totalResults: number
  queryUnderstanding?: Record<string, unknown>
}

export interface FormLineInfo {
  label: string
  ircSections: string[]
  description: string
}

export interface FormCrossRefResponse {
  form: string
  title: string
  lines: Record<string, FormLineInfo>
  schedules: string[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  context?: TaxContext
  sessionId?: string
}

export interface ChatResponse {
  response: ChatMessage
  citations: IRCCitation[]
  followUpSuggestions: string[]
  sessionId: string
}

export interface TaxExplainerConfig {
  baseUrl: string
  apiKey?: string
  taxYear?: number
}
