CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  tin TEXT,
  display_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS filing_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  local_session_id TEXT,
  tax_year INTEGER NOT NULL,
  filing_status TEXT NOT NULL,
  form_type TEXT NOT NULL,
  lifecycle_status TEXT NOT NULL,
  name TEXT NOT NULL,
  current_phase TEXT NOT NULL,
  last_screen TEXT,
  completion_pct REAL NOT NULL DEFAULT 0,
  estimated_refund REAL,
  tax_return_id TEXT,
  latest_submission_id TEXT,
  metadata_key TEXT NOT NULL,
  facts_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(tax_return_id) REFERENCES tax_returns(id),
  FOREIGN KEY(latest_submission_id) REFERENCES submissions(id)
);

CREATE INDEX IF NOT EXISTS idx_filing_sessions_user ON filing_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_filing_sessions_user_tax_year
  ON filing_sessions(user_id, tax_year);
CREATE INDEX IF NOT EXISTS idx_filing_sessions_local_session
  ON filing_sessions(local_session_id);

CREATE TABLE IF NOT EXISTS session_entities (
  id TEXT PRIMARY KEY,
  filing_session_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  status TEXT NOT NULL,
  label TEXT,
  data_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(filing_session_id) REFERENCES filing_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_session_entities_session
  ON session_entities(filing_session_id);
CREATE INDEX IF NOT EXISTS idx_session_entities_type
  ON session_entities(filing_session_id, entity_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_entities_unique
  ON session_entities(filing_session_id, entity_type, entity_key);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  filing_session_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  status TEXT NOT NULL,
  cluster TEXT NOT NULL,
  cluster_confidence REAL NOT NULL DEFAULT 0,
  pages INTEGER NOT NULL DEFAULT 1,
  artifact_key TEXT,
  metadata_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(filing_session_id) REFERENCES filing_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_documents_session ON documents(filing_session_id);
CREATE INDEX IF NOT EXISTS idx_documents_status
  ON documents(filing_session_id, status);

CREATE TABLE IF NOT EXISTS review_findings (
  id TEXT PRIMARY KEY,
  filing_session_id TEXT NOT NULL,
  code TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  fix_path TEXT,
  fix_label TEXT,
  acknowledged INTEGER NOT NULL DEFAULT 0,
  metadata_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(filing_session_id) REFERENCES filing_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_review_findings_session
  ON review_findings(filing_session_id);
CREATE INDEX IF NOT EXISTS idx_review_findings_severity
  ON review_findings(filing_session_id, severity);

CREATE TABLE IF NOT EXISTS state_transfer_authorizations (
  id TEXT PRIMARY KEY,
  filing_session_id TEXT NOT NULL,
  state_code TEXT NOT NULL,
  authorization_code TEXT NOT NULL,
  submission_id TEXT,
  status TEXT NOT NULL,
  metadata_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(filing_session_id) REFERENCES filing_sessions(id),
  FOREIGN KEY(submission_id) REFERENCES submissions(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_state_transfer_auth_code
  ON state_transfer_authorizations(authorization_code);
CREATE INDEX IF NOT EXISTS idx_state_transfer_session
  ON state_transfer_authorizations(filing_session_id);
