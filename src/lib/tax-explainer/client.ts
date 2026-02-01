/**
 * API client for the Tax Explainer service.
 */

import {
  TaxExplainerConfig,
  ExplainLineItemRequest,
  ExplainLineItemResponse,
  SearchIRCRequest,
  SearchIRCResponse,
  FormCrossRefResponse,
  ChatRequest,
  ChatResponse,
  TaxContext
} from './types'

const DEFAULT_CONFIG: TaxExplainerConfig = {
  baseUrl: 'http://localhost:8000',
  taxYear: 2024
}

/**
 * Client for interacting with the Tax Explainer AI service.
 */
export class TaxExplainerClient {
  private config: TaxExplainerConfig

  constructor(config: Partial<TaxExplainerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    }

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }

    const response = await fetch(url, {
      ...options,
      headers
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error (${response.status}): ${errorText}`)
    }

    return response.json() as Promise<T>
  }

  /**
   * Get an explanation for a tax form line item.
   */
  async explainLineItem(
    formId: string,
    lineNumber: string,
    context?: TaxContext,
    detailLevel: 'brief' | 'standard' | 'detailed' = 'standard'
  ): Promise<ExplainLineItemResponse> {
    const request: ExplainLineItemRequest = {
      formId,
      lineNumber,
      taxYear: this.config.taxYear,
      context,
      detailLevel
    }

    // Convert to snake_case for API
    const apiRequest = {
      form_id: request.formId,
      line_number: request.lineNumber,
      tax_year: request.taxYear,
      context: request.context
        ? {
            filing_status: request.context.filingStatus,
            has_dependents: request.context.hasDependents,
            state: request.context.state,
            user_values: request.context.userValues
          }
        : undefined,
      detail_level: request.detailLevel
    }

    const response = await this.fetch<Record<string, unknown>>(
      '/v1/explain/line-item',
      {
        method: 'POST',
        body: JSON.stringify(apiRequest)
      }
    )

    // Convert from snake_case to camelCase
    return this.convertExplanationResponse(response)
  }

  /**
   * Search IRC sections.
   */
  async searchIRC(
    query: string,
    limit = 10,
    includeRegulations = false
  ): Promise<SearchIRCResponse> {
    const request: SearchIRCRequest = {
      query,
      limit,
      includeRegulations
    }

    const apiRequest = {
      query: request.query,
      limit: request.limit,
      include_regulations: request.includeRegulations
    }

    const response = await this.fetch<Record<string, unknown>>(
      '/v1/search/irc',
      {
        method: 'POST',
        body: JSON.stringify(apiRequest)
      }
    )

    return this.convertSearchResponse(response)
  }

  /**
   * Get cross-reference data for a form.
   */
  async getFormCrossRef(formId: string): Promise<FormCrossRefResponse> {
    const response = await this.fetch<Record<string, unknown>>(
      `/v1/crossref/form/${encodeURIComponent(formId)}`
    )

    return this.convertCrossRefResponse(response)
  }

  /**
   * Send a chat message.
   */
  async chat(
    messages: ChatRequest['messages'],
    context?: TaxContext,
    sessionId?: string
  ): Promise<ChatResponse> {
    const apiRequest = {
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content
      })),
      context: context
        ? {
            filing_status: context.filingStatus,
            has_dependents: context.hasDependents,
            state: context.state,
            user_values: context.userValues
          }
        : undefined,
      session_id: sessionId
    }

    const response = await this.fetch<Record<string, unknown>>('/v1/chat', {
      method: 'POST',
      body: JSON.stringify(apiRequest)
    })

    return this.convertChatResponse(response)
  }

  // Helper methods for converting snake_case to camelCase

  private convertExplanationResponse(
    data: Record<string, unknown>
  ): ExplainLineItemResponse {
    const explanation = data.explanation as Record<string, unknown>
    const legalBasis = data.legal_basis as Record<string, unknown>

    return {
      explanation: {
        summary: explanation.summary as string,
        plainEnglish: explanation.plain_english as string,
        calculationNotes: explanation.calculation_notes as string | undefined,
        detailLevel: explanation.detail_level as string
      },
      legalBasis: {
        primaryIrcSection: legalBasis.primary_irc_section
          ? this.convertIrcCitation(
              legalBasis.primary_irc_section as Record<string, unknown>
            )
          : null,
        relatedSections: (
          (legalBasis.related_sections as Record<string, unknown>[]) || []
        ).map((s) => this.convertIrcCitation(s)),
        treasuryRegulations: (
          (legalBasis.treasury_regulations as Record<string, unknown>[]) || []
        ).map((r) => ({
          regulation: r.regulation as string,
          title: r.title as string
        })),
        irsPublications: (
          (legalBasis.irs_publications as Record<string, unknown>[]) || []
        ).map((p) => ({
          number: p.number as string,
          title: p.title as string
        }))
      },
      relatedForms: (
        (data.related_forms as Record<string, unknown>[]) || []
      ).map((f) => ({
        form: f.form as string,
        relationship: f.relationship as string
      })),
      metadata: (data.metadata as Record<string, unknown>) || {}
    }
  }

  private convertIrcCitation(data: Record<string, unknown>) {
    return {
      section: data.section as string,
      title: data.title as string,
      subsectionsCited: (data.subsections_cited as string[]) || [],
      excerpt: (data.excerpt as string) || '',
      sourcePath: (data.source_path as string) || ''
    }
  }

  private convertSearchResponse(
    data: Record<string, unknown>
  ): SearchIRCResponse {
    return {
      results: ((data.results as Record<string, unknown>[]) || []).map((r) => ({
        section: r.section as string,
        title: r.title as string,
        relevanceScore: r.relevance_score as number,
        snippet: r.snippet as string,
        subsections: (r.subsections as string[]) || [],
        relatedForms: (r.related_forms as string[]) || []
      })),
      totalResults: data.total_results as number,
      queryUnderstanding: data.query_understanding as Record<string, unknown>
    }
  }

  private convertCrossRefResponse(
    data: Record<string, unknown>
  ): FormCrossRefResponse {
    const lines = (data.lines as Record<string, Record<string, unknown>>) || {}
    const convertedLines: Record<
      string,
      { label: string; ircSections: string[]; description: string }
    > = {}

    for (const [key, value] of Object.entries(lines)) {
      convertedLines[key] = {
        label: value.label as string,
        ircSections: (value.irc_sections as string[]) || [],
        description: (value.description as string) || ''
      }
    }

    return {
      form: data.form as string,
      title: data.title as string,
      lines: convertedLines,
      schedules: (data.schedules as string[]) || []
    }
  }

  private convertChatResponse(data: Record<string, unknown>): ChatResponse {
    const response = data.response as Record<string, unknown>
    return {
      response: {
        role: response.role as 'user' | 'assistant',
        content: response.content as string
      },
      citations: ((data.citations as Record<string, unknown>[]) || []).map(
        (c) => this.convertIrcCitation(c)
      ),
      followUpSuggestions: (data.follow_up_suggestions as string[]) || [],
      sessionId: data.session_id as string
    }
  }
}

// Export a default client instance
export const taxExplainerClient = new TaxExplainerClient()
