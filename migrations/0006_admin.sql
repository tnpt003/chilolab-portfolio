-- Admin panel overhaul (/manage).

-- Blocked accounts: sign-in is refused and their sessions are deleted.
-- Their comments and feedback stay; unblocking restores access.
ALTER TABLE users ADD COLUMN blocked_at TEXT;

-- Feedback gains an "in progress" state and a private owner note.
-- SQLite cannot change a CHECK constraint, so the table is rebuilt.
CREATE TABLE feedback_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('idea', 'bug', 'other')),
  message TEXT NOT NULL,
  contact TEXT,
  app_version TEXT,
  locale TEXT NOT NULL CHECK (locale IN ('vi', 'en')),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'progress', 'done')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  summary TEXT,
  os TEXT,
  user_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
  note TEXT
);
INSERT INTO feedback_v2 (id, project, kind, message, contact, app_version, locale,
  status, created_at, summary, os, user_id)
SELECT id, project, kind, message, contact, app_version, locale,
  status, created_at, summary, os, user_id
FROM feedback;
DROP TABLE feedback;
ALTER TABLE feedback_v2 RENAME TO feedback;
CREATE INDEX feedback_status ON feedback (status, created_at);
CREATE INDEX feedback_user ON feedback (user_id);

-- What the owner did in /manage, and when. No IP addresses or user agents.
-- Rows older than a year are deleted as new ones are written.
CREATE TABLE admin_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT
);
CREATE INDEX admin_log_at ON admin_log (at);
