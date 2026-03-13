ALTER TABLE submissions ADD COLUMN payload_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE submissions ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE submissions ADD COLUMN last_error TEXT;
ALTER TABLE submissions ADD COLUMN processed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_submissions_return_status
  ON submissions(tax_return_id, status);
