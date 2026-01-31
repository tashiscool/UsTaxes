/**
 * Tax Explainer SDK for UsTaxes.
 *
 * Provides AI-powered explanations for tax form line items with citations
 * to Internal Revenue Code (IRC) sections and Treasury Regulations.
 *
 * @example
 * ```tsx
 * import { useTaxExplanation, configureTaxExplainer } from '@/lib/tax-explainer'
 *
 * // Configure the client (once at app startup)
 * configureTaxExplainer({
 *   baseUrl: 'http://localhost:8000',
 *   taxYear: 2024
 * })
 *
 * // In a component
 * function LineHelp({ formId, lineNumber }) {
 *   const { explanation, loading, fetchExplanation } = useTaxExplanation(formId, lineNumber)
 *
 *   return (
 *     <button onClick={fetchExplanation}>
 *       {loading ? 'Loading...' : 'Get Help'}
 *     </button>
 *   )
 * }
 * ```
 */

// Types
export type {
  TaxContext,
  ExplainLineItemRequest,
  ExplainLineItemResponse,
  IRCCitation,
  TreasuryRegCitation,
  IRSPublicationRef,
  LegalBasis,
  Explanation,
  RelatedForm,
  SearchIRCRequest,
  SearchIRCResponse,
  IRCSearchResult,
  FormCrossRefResponse,
  FormLineInfo,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  TaxExplainerConfig
} from './types'

// Client
export { TaxExplainerClient, taxExplainerClient } from './client'

// Hooks
export {
  configureTaxExplainer,
  useTaxExplanation,
  useLazyTaxExplanation,
  useIRCSearch,
  useFormCrossRef,
  useTaxChat,
  usePrefetchExplanations
} from './hooks'
