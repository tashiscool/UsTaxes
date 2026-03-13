import type { SubmissionQueueMessage } from './types'

export interface Env {
  USTAXES_DB: D1Database
  ARTIFACTS_BUCKET: R2Bucket
  SUBMISSION_QUEUE: Queue<SubmissionQueueMessage>
  SUBMISSION_ORCHESTRATOR: DurableObjectNamespace
  INTERNAL_API_TOKEN?: string
  APP_AUTH_SECRET?: string
  APP_DEV_ALLOW_LOCAL_LOGIN?: string
  TAXFLOW_STATE_PROFILE_BASE_URL?: string
}
