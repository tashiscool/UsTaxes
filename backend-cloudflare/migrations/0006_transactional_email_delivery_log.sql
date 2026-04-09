CREATE TABLE IF NOT EXISTS transactional_email_delivery_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  dedupe_key TEXT,
  user_id TEXT,
  email_normalized TEXT NOT NULL,
  subject TEXT NOT NULL,
  provider TEXT NOT NULL,
  delivery_status TEXT NOT NULL,
  provider_status_code INTEGER,
  provider_response_status TEXT,
  provider_request_id TEXT,
  error_code TEXT,
  error_detail TEXT,
  metadata_json TEXT,
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tx_email_log_dedupe
  ON transactional_email_delivery_log(dedupe_key, created_at_ms);

CREATE INDEX IF NOT EXISTS idx_tx_email_log_email
  ON transactional_email_delivery_log(email_normalized, created_at_ms);

CREATE INDEX IF NOT EXISTS idx_tx_email_log_event
  ON transactional_email_delivery_log(event_type, created_at_ms);
