CREATE TABLE IF NOT EXISTS tax_returns (
  id TEXT PRIMARY KEY,
  tax_year INTEGER NOT NULL,
  filing_status TEXT NOT NULL,
  current_status TEXT NOT NULL,
  facts_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  tax_return_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_key TEXT NOT NULL,
  ack_code TEXT,
  ack_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(tax_return_id) REFERENCES tax_returns(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_submission_idempotency ON submissions(tax_return_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_submissions_return ON submissions(tax_return_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);

CREATE TABLE IF NOT EXISTS submission_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(submission_id) REFERENCES submissions(id)
);

CREATE INDEX IF NOT EXISTS idx_submission_events_submission ON submission_events(submission_id);
