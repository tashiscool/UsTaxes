ALTER TABLE tax_returns ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'local-user';
ALTER TABLE tax_returns ADD COLUMN owner_tin TEXT;
ALTER TABLE tax_returns ADD COLUMN form_type TEXT;
ALTER TABLE tax_returns ADD COLUMN sign_key TEXT;
ALTER TABLE tax_returns ADD COLUMN signed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_tax_returns_owner ON tax_returns(owner_id);
CREATE INDEX IF NOT EXISTS idx_tax_returns_owner_year ON tax_returns(owner_id, tax_year);
