-- One-time sign-in codes sent by email. Only a SHA-256 hash of the code is
-- stored; codes expire after 10 minutes and allow 5 attempts.
CREATE TABLE email_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX email_codes_email ON email_codes (email, created_at);
