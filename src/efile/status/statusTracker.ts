/**
 * MeF Status Tracking Module
 *
 * Tracks e-file submissions through their lifecycle, persists state,
 * and provides polling capabilities for acknowledgment retrieval.
 */

import {
  AcknowledgmentProcessor,
  ProcessedAcknowledgment
} from './acknowledgment'

// ============================================================================
// Types
// ============================================================================

export type SubmissionState =
  | 'Queued' // Ready to submit
  | 'Submitted' // Sent to IRS
  | 'Pending' // Awaiting acknowledgment
  | 'Accepted' // IRS accepted
  | 'Rejected' // IRS rejected
  | 'Error' // System error

export interface StateChange {
  state: SubmissionState
  timestamp: Date
  details?: string
}

export interface Submission {
  submissionId: string
  taxYear: number
  formType: string
  taxpayerName: string
  taxpayerSSNLast4: string
  state: SubmissionState
  stateHistory: StateChange[]
  createdAt: Date
  updatedAt: Date
  acknowledgment?: ProcessedAcknowledgment
  confirmationNumber?: string
  errorMessage?: string
  retryCount: number
  metadata?: Record<string, unknown>
}

export interface SubmissionStatus {
  submission: Submission
  isTerminal: boolean
  canRetry: boolean
  nextAction?: string
}

export interface PollConfig {
  intervalMs: number
  maxAttempts: number
  backoffMultiplier: number
  maxIntervalMs: number
}

export interface PollingState {
  submissionId: string
  intervalId: ReturnType<typeof setInterval> | null
  attempts: number
  currentInterval: number
  config: PollConfig
  onAcknowledgment?: (ack: ProcessedAcknowledgment) => void
  onError?: (error: Error) => void
}

// ============================================================================
// Storage Interface
// ============================================================================

interface StorageAdapter {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
  keys(): Promise<string[]>
}

/**
 * LocalStorage adapter for browser environments
 */
class LocalStorageAdapter implements StorageAdapter {
  private prefix: string

  constructor(prefix = 'ustaxes_efile_') {
    this.prefix = prefix
  }

  async get(key: string): Promise<string | null> {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(this.prefix + key)
  }

  async set(key: string, value: string): Promise<void> {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(this.prefix + key, value)
  }

  async remove(key: string): Promise<void> {
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem(this.prefix + key)
  }

  async keys(): Promise<string[]> {
    if (typeof localStorage === 'undefined') return []
    const result: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(this.prefix)) {
        result.push(key.substring(this.prefix.length))
      }
    }
    return result
  }
}

/**
 * IndexedDB adapter for larger storage needs
 */
class IndexedDBAdapter implements StorageAdapter {
  private dbName: string
  private storeName: string
  private db: IDBDatabase | null = null

  constructor(dbName = 'ustaxes_efile', storeName = 'submissions') {
    this.dbName = dbName
    this.storeName = storeName
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db

    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB not available'))
        return
      }

      const request = indexedDB.open(this.dbName, 1)

      request.onerror = () => reject(request.error)

      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName)
        }
      }
    })
  }

  async get(key: string): Promise<string | null> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.get(key)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || null)
    })
  }

  async set(key: string, value: string): Promise<void> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.put(value, key)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async remove(key: string): Promise<void> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.delete(key)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async keys(): Promise<string[]> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.getAllKeys()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result.map(String))
    })
  }
}

/**
 * In-memory adapter for testing
 */
class MemoryStorageAdapter implements StorageAdapter {
  private storage: Map<string, string> = new Map()

  async get(key: string): Promise<string | null> {
    return this.storage.get(key) || null
  }

  async set(key: string, value: string): Promise<void> {
    this.storage.set(key, value)
  }

  async remove(key: string): Promise<void> {
    this.storage.delete(key)
  }

  async keys(): Promise<string[]> {
    return Array.from(this.storage.keys())
  }
}

// ============================================================================
// StatusTracker Class
// ============================================================================

export class StatusTracker {
  private storage: StorageAdapter
  private pollingStates: Map<string, PollingState> = new Map()
  private acknowledgmentProcessor: AcknowledgmentProcessor
  private fetchAcknowledgment?: (
    submissionId: string
  ) => Promise<string | null>

  constructor(
    options: {
      storageType?: 'localStorage' | 'indexedDB' | 'memory'
      fetchAcknowledgment?: (submissionId: string) => Promise<string | null>
    } = {}
  ) {
    const { storageType = 'localStorage', fetchAcknowledgment } = options

    switch (storageType) {
      case 'indexedDB':
        this.storage = new IndexedDBAdapter()
        break
      case 'memory':
        this.storage = new MemoryStorageAdapter()
        break
      default:
        this.storage = new LocalStorageAdapter()
    }

    this.acknowledgmentProcessor = new AcknowledgmentProcessor()
    this.fetchAcknowledgment = fetchAcknowledgment
  }

  /**
   * Track a new submission
   */
  async track(submissionData: {
    submissionId: string
    taxYear: number
    formType: string
    taxpayerName: string
    taxpayerSSNLast4: string
    metadata?: Record<string, unknown>
  }): Promise<Submission> {
    const now = new Date()
    const submission: Submission = {
      ...submissionData,
      state: 'Queued',
      stateHistory: [
        {
          state: 'Queued',
          timestamp: now,
          details: 'Submission created'
        }
      ],
      createdAt: now,
      updatedAt: now,
      retryCount: 0
    }

    await this.saveSubmission(submission)
    return submission
  }

  /**
   * Get status for a specific submission
   */
  async getStatus(submissionId: string): Promise<SubmissionStatus | null> {
    const submission = await this.getSubmission(submissionId)
    if (!submission) return null

    return {
      submission,
      isTerminal: this.isTerminalState(submission.state),
      canRetry: this.canRetry(submission),
      nextAction: this.getNextAction(submission)
    }
  }

  /**
   * Get all submissions with pending status (not in terminal state)
   */
  async getAllPending(): Promise<Submission[]> {
    const allSubmissions = await this.getAllSubmissions()
    return allSubmissions.filter(
      (sub) => !this.isTerminalState(sub.state)
    )
  }

  /**
   * Get all submissions
   */
  async getAllSubmissions(): Promise<Submission[]> {
    const keys = await this.storage.keys()
    const submissionKeys = keys.filter((k) => k.startsWith('submission_'))
    const submissions: Submission[] = []

    for (const key of submissionKeys) {
      const data = await this.storage.get(key)
      if (data) {
        submissions.push(this.deserializeSubmission(data))
      }
    }

    return submissions.sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    )
  }

  /**
   * Update the status of a submission
   */
  async updateStatus(
    submissionId: string,
    state: SubmissionState,
    details?: string
  ): Promise<Submission | null> {
    const submission = await this.getSubmission(submissionId)
    if (!submission) return null

    const now = new Date()
    submission.state = state
    submission.updatedAt = now
    submission.stateHistory.push({
      state,
      timestamp: now,
      details
    })

    // Stop polling if we've reached a terminal state
    if (this.isTerminalState(state)) {
      this.stopPolling(submissionId)
    }

    await this.saveSubmission(submission)
    return submission
  }

  /**
   * Process an acknowledgment for a submission
   */
  async processAcknowledgment(
    submissionId: string,
    ackXml: string
  ): Promise<Submission | null> {
    const submission = await this.getSubmission(submissionId)
    if (!submission) return null

    const processed = this.acknowledgmentProcessor.process(ackXml)
    submission.acknowledgment = processed

    if (processed.status === 'Accepted') {
      submission.state = 'Accepted'
      submission.confirmationNumber = processed.confirmationNumber
    } else {
      submission.state = 'Rejected'
    }

    const now = new Date()
    submission.updatedAt = now
    submission.stateHistory.push({
      state: submission.state,
      timestamp: now,
      details:
        processed.status === 'Accepted'
          ? `Accepted with confirmation: ${processed.confirmationNumber}`
          : `Rejected with ${processed.errors.length} error(s)`
    })

    this.stopPolling(submissionId)
    await this.saveSubmission(submission)
    return submission
  }

  /**
   * Record a system error for a submission
   */
  async recordError(
    submissionId: string,
    errorMessage: string
  ): Promise<Submission | null> {
    const submission = await this.getSubmission(submissionId)
    if (!submission) return null

    const now = new Date()
    submission.state = 'Error'
    submission.errorMessage = errorMessage
    submission.updatedAt = now
    submission.retryCount++
    submission.stateHistory.push({
      state: 'Error',
      timestamp: now,
      details: errorMessage
    })

    await this.saveSubmission(submission)
    return submission
  }

  /**
   * Start polling for acknowledgment
   */
  startPolling(
    submissionId: string,
    config: Partial<PollConfig> = {},
    callbacks: {
      onAcknowledgment?: (ack: ProcessedAcknowledgment) => void
      onError?: (error: Error) => void
    } = {}
  ): void {
    // Stop any existing polling for this submission
    this.stopPolling(submissionId)

    const defaultConfig: PollConfig = {
      intervalMs: 60000, // 1 minute
      maxAttempts: 60, // 1 hour total
      backoffMultiplier: 1.5,
      maxIntervalMs: 300000 // 5 minutes max
    }

    const finalConfig = { ...defaultConfig, ...config }

    const pollingState: PollingState = {
      submissionId,
      intervalId: null,
      attempts: 0,
      currentInterval: finalConfig.intervalMs,
      config: finalConfig,
      onAcknowledgment: callbacks.onAcknowledgment,
      onError: callbacks.onError
    }

    this.pollingStates.set(submissionId, pollingState)
    this.poll(submissionId)
  }

  /**
   * Stop polling for a submission
   */
  stopPolling(submissionId: string): void {
    const state = this.pollingStates.get(submissionId)
    if (state?.intervalId) {
      clearTimeout(state.intervalId)
    }
    this.pollingStates.delete(submissionId)
  }

  /**
   * Stop all active polling
   */
  stopAllPolling(): void {
    Array.from(this.pollingStates.keys()).forEach((submissionId) => {
      this.stopPolling(submissionId)
    })
  }

  /**
   * Delete a submission from tracking
   */
  async deleteSubmission(submissionId: string): Promise<boolean> {
    this.stopPolling(submissionId)
    await this.storage.remove(`submission_${submissionId}`)
    return true
  }

  /**
   * Get submissions by tax year
   */
  async getByTaxYear(taxYear: number): Promise<Submission[]> {
    const all = await this.getAllSubmissions()
    return all.filter((s) => s.taxYear === taxYear)
  }

  /**
   * Get submissions by state
   */
  async getByState(state: SubmissionState): Promise<Submission[]> {
    const all = await this.getAllSubmissions()
    return all.filter((s) => s.state === state)
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async poll(submissionId: string): Promise<void> {
    const state = this.pollingStates.get(submissionId)
    if (!state) return

    state.attempts++

    try {
      // Check if we have a fetch function configured
      if (!this.fetchAcknowledgment) {
        throw new Error('No acknowledgment fetch function configured')
      }

      const ackXml = await this.fetchAcknowledgment(submissionId)

      if (ackXml) {
        const submission = await this.processAcknowledgment(
          submissionId,
          ackXml
        )
        if (submission?.acknowledgment && state.onAcknowledgment) {
          state.onAcknowledgment(submission.acknowledgment)
        }
        return // Stop polling on success
      }

      // Schedule next poll if not at max attempts
      if (state.attempts < state.config.maxAttempts) {
        this.scheduleNextPoll(submissionId)
      } else {
        // Max attempts reached
        const error = new Error(
          `Max polling attempts (${state.config.maxAttempts}) reached for submission ${submissionId}`
        )
        if (state.onError) {
          state.onError(error)
        }
        this.stopPolling(submissionId)
      }
    } catch (error) {
      if (state.onError) {
        state.onError(error instanceof Error ? error : new Error(String(error)))
      }

      // Continue polling despite errors (unless max attempts reached)
      if (state.attempts < state.config.maxAttempts) {
        this.scheduleNextPoll(submissionId)
      } else {
        this.stopPolling(submissionId)
      }
    }
  }

  private scheduleNextPoll(submissionId: string): void {
    const state = this.pollingStates.get(submissionId)
    if (!state) return

    // Apply exponential backoff
    state.currentInterval = Math.min(
      state.currentInterval * state.config.backoffMultiplier,
      state.config.maxIntervalMs
    )

    state.intervalId = setTimeout(() => {
      this.poll(submissionId)
    }, state.currentInterval)
  }

  private async getSubmission(
    submissionId: string
  ): Promise<Submission | null> {
    const data = await this.storage.get(`submission_${submissionId}`)
    if (!data) return null
    return this.deserializeSubmission(data)
  }

  private async saveSubmission(submission: Submission): Promise<void> {
    const serialized = this.serializeSubmission(submission)
    await this.storage.set(`submission_${submission.submissionId}`, serialized)
  }

  private serializeSubmission(submission: Submission): string {
    return JSON.stringify(submission, (key, value) => {
      if (value instanceof Date) {
        return { __type: 'Date', value: value.toISOString() }
      }
      return value
    })
  }

  private deserializeSubmission(data: string): Submission {
    return JSON.parse(data, (key, value) => {
      if (value && typeof value === 'object' && value.__type === 'Date') {
        return new Date(value.value)
      }
      return value
    })
  }

  private isTerminalState(state: SubmissionState): boolean {
    return state === 'Accepted' || state === 'Rejected'
  }

  private canRetry(submission: Submission): boolean {
    // Can retry if in Error state and under retry limit
    return submission.state === 'Error' && submission.retryCount < 3
  }

  private getNextAction(submission: Submission): string | undefined {
    switch (submission.state) {
      case 'Queued':
        return 'Submit to IRS'
      case 'Submitted':
        return 'Awaiting IRS processing'
      case 'Pending':
        return 'Check for acknowledgment'
      case 'Accepted':
        return 'Return accepted - no action needed'
      case 'Rejected':
        return 'Review errors and correct return'
      case 'Error':
        return submission.retryCount < 3
          ? 'Retry submission'
          : 'Contact support'
      default:
        return undefined
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format a submission state for display
 */
export function formatSubmissionState(state: SubmissionState): string {
  const stateLabels: Record<SubmissionState, string> = {
    Queued: 'Ready to Submit',
    Submitted: 'Sent to IRS',
    Pending: 'Awaiting Response',
    Accepted: 'Accepted by IRS',
    Rejected: 'Rejected by IRS',
    Error: 'Error Occurred'
  }
  return stateLabels[state]
}

/**
 * Get a color/status indicator for a submission state
 */
export function getStateIndicator(
  state: SubmissionState
): 'success' | 'error' | 'warning' | 'info' | 'default' {
  switch (state) {
    case 'Accepted':
      return 'success'
    case 'Rejected':
    case 'Error':
      return 'error'
    case 'Pending':
    case 'Submitted':
      return 'warning'
    case 'Queued':
      return 'info'
    default:
      return 'default'
  }
}

/**
 * Calculate time since last state change
 */
export function timeSinceLastChange(submission: Submission): string {
  const lastChange =
    submission.stateHistory[submission.stateHistory.length - 1]
  const diff = Date.now() - lastChange.timestamp.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  return 'Just now'
}

export default StatusTracker
