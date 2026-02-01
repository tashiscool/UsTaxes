/**
 * React hooks for the Tax Explainer service.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { useState, useCallback, useRef, useEffect } from 'react'
import { TaxExplainerClient } from './client'
import {
  ExplainLineItemResponse,
  SearchIRCResponse,
  FormCrossRefResponse,
  ChatResponse,
  ChatMessage,
  TaxContext,
  TaxExplainerConfig
} from './types'

// Create a singleton client instance
let clientInstance: TaxExplainerClient | null = null

function getClient(config?: Partial<TaxExplainerConfig>): TaxExplainerClient {
  if (!clientInstance || config) {
    clientInstance = new TaxExplainerClient(config)
  }
  return clientInstance
}

/**
 * Configure the Tax Explainer client.
 */
export function configureTaxExplainer(
  config: Partial<TaxExplainerConfig>
): void {
  clientInstance = new TaxExplainerClient(config)
}

interface UseExplanationState {
  explanation: ExplainLineItemResponse | null
  loading: boolean
  error: Error | null
}

/**
 * Hook to fetch explanations for tax form line items.
 */
export function useTaxExplanation(
  formId: string,
  lineNumber: string,
  context?: TaxContext,
  autoFetch = false
) {
  const [state, setState] = useState<UseExplanationState>({
    explanation: null,
    loading: false,
    error: null
  })

  const fetchExplanation = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))

    try {
      const client = getClient()
      const result = await client.explainLineItem(formId, lineNumber, context)
      setState({ explanation: result, loading: false, error: null })
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setState((s) => ({ ...s, loading: false, error }))
      return null
    }
  }, [formId, lineNumber, context])

  useEffect(() => {
    if (autoFetch && formId && lineNumber) {
      void fetchExplanation()
    }
  }, [autoFetch, formId, lineNumber, fetchExplanation])

  return {
    ...state,
    fetchExplanation,
    refetch: fetchExplanation
  }
}

/**
 * Hook to fetch explanations lazily (on demand).
 */
export function useLazyTaxExplanation() {
  const [state, setState] = useState<UseExplanationState>({
    explanation: null,
    loading: false,
    error: null
  })

  const fetchExplanation = useCallback(
    async (
      formId: string,
      lineNumber: string,
      context?: TaxContext,
      detailLevel: 'brief' | 'standard' | 'detailed' = 'standard'
    ) => {
      setState({ explanation: null, loading: true, error: null })

      try {
        const client = getClient()
        const result = await client.explainLineItem(
          formId,
          lineNumber,
          context,
          detailLevel
        )
        setState({ explanation: result, loading: false, error: null })
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setState({ explanation: null, loading: false, error })
        return null
      }
    },
    []
  )

  return {
    ...state,
    fetchExplanation
  }
}

interface UseIRCSearchState {
  results: SearchIRCResponse | null
  loading: boolean
  error: Error | null
}

/**
 * Hook to search IRC sections.
 */
export function useIRCSearch() {
  const [state, setState] = useState<UseIRCSearchState>({
    results: null,
    loading: false,
    error: null
  })

  const search = useCallback(
    async (query: string, limit = 10, includeRegulations = false) => {
      setState({ results: null, loading: true, error: null })

      try {
        const client = getClient()
        const result = await client.searchIRC(
          query,
          Number(limit),
          Boolean(includeRegulations)
        )
        setState({ results: result, loading: false, error: null })
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setState({ results: null, loading: false, error })
        return null
      }
    },
    []
  )

  return {
    ...state,
    search
  }
}

interface UseFormCrossRefState {
  crossRef: FormCrossRefResponse | null
  loading: boolean
  error: Error | null
}

/**
 * Hook to get form cross-reference data.
 */
export function useFormCrossRef(formId: string, autoFetch = true) {
  const [state, setState] = useState<UseFormCrossRefState>({
    crossRef: null,
    loading: false,
    error: null
  })

  const fetchCrossRef = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))

    try {
      const client = getClient()
      const result = await client.getFormCrossRef(formId)
      setState({ crossRef: result, loading: false, error: null })
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setState((s) => ({ ...s, loading: false, error }))
      return null
    }
  }, [formId])

  useEffect(() => {
    if (autoFetch && formId) {
      void fetchCrossRef()
    }
  }, [autoFetch, formId, fetchCrossRef])

  return {
    ...state,
    fetchCrossRef,
    refetch: fetchCrossRef
  }
}

interface UseTaxChatState {
  messages: ChatMessage[]
  loading: boolean
  error: Error | null
  sessionId: string | null
}

/**
 * Hook for conversational tax assistance.
 */
export function useTaxChat(context?: TaxContext) {
  const [state, setState] = useState<UseTaxChatState>({
    messages: [],
    loading: false,
    error: null,
    sessionId: null
  })

  const sessionIdRef = useRef<string | null>(null)

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage: ChatMessage = { role: 'user', content }

      setState((s) => ({
        ...s,
        messages: [...s.messages, userMessage],
        loading: true,
        error: null
      }))

      try {
        const client = getClient()
        const allMessages = [...state.messages, userMessage]
        const result = await client.chat(
          allMessages,
          context,
          sessionIdRef.current || undefined
        )

        sessionIdRef.current = result.sessionId

        setState((s) => ({
          ...s,
          messages: [...s.messages, result.response],
          loading: false,
          sessionId: result.sessionId
        }))

        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setState((s) => ({
          ...s,
          loading: false,
          error
        }))
        return null
      }
    },
    [state.messages, context]
  )

  const clearHistory = useCallback(() => {
    setState({
      messages: [],
      loading: false,
      error: null,
      sessionId: null
    })
    sessionIdRef.current = null
  }, [])

  return {
    ...state,
    sendMessage,
    clearHistory
  }
}

/**
 * Hook to prefetch explanations for multiple line items.
 */
export function usePrefetchExplanations(
  formId: string,
  lineNumbers: string[],
  context?: TaxContext
) {
  const [cache, setCache] = useState<
    Record<string, ExplainLineItemResponse | null>
  >({})
  const [loading, setLoading] = useState(false)

  const prefetch = useCallback(async () => {
    setLoading(true)

    const client = getClient()
    const results: Record<string, ExplainLineItemResponse | null> = {}

    await Promise.all(
      lineNumbers.map(async (lineNumber) => {
        try {
          const result = await client.explainLineItem(
            formId,
            lineNumber,
            context,
            'brief' // Use brief for prefetch
          )
          results[lineNumber] = result
        } catch {
          results[lineNumber] = null
        }
      })
    )

    setCache(results)
    setLoading(false)
  }, [formId, lineNumbers, context])

  const getExplanation = useCallback(
    (lineNumber: string) => cache[lineNumber] || null,
    [cache]
  )

  return {
    cache,
    loading,
    prefetch,
    getExplanation
  }
}
