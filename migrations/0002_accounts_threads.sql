-- Visitor accounts (Google sign-in now; password_hash is reserved for a later
-- email + password option) and threaded, per-version comments.

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_sub TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  last_login_at TEXT
);

-- Only a SHA-256 hash of the session cookie is stored.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);

-- status: published (visible), held (flagged; only the author and /manage see
-- it), deleted (by its author) and removed (by the owner). deleted/removed rows
-- keep no text and are shown as a placeholder only while they have replies.
CREATE TABLE comments_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  version TEXT,
  parent_id INTEGER,
  user_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
  author TEXT,
  body TEXT NOT NULL DEFAULT '',
  locale TEXT NOT NULL CHECK (locale IN ('vi', 'en')),
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'held', 'deleted', 'removed')),
  moderation_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  edited_at TEXT
);
INSERT INTO comments_v2 (id, project, author, body, locale, status, created_at)
SELECT id, project, author, body, locale,
  CASE status WHEN 'approved' THEN 'published' ELSE 'held' END,
  created_at
FROM comments;
DROP TABLE comments;
ALTER TABLE comments_v2 RENAME TO comments;
CREATE INDEX comments_threads ON comments (project, parent_id, status, created_at);
CREATE INDEX comments_versions ON comments (project, version, parent_id, created_at);
CREATE INDEX comments_parent ON comments (parent_id);
CREATE INDEX comments_user ON comments (user_id);

ALTER TABLE feedback ADD COLUMN summary TEXT;
ALTER TABLE feedback ADD COLUMN os TEXT;
ALTER TABLE feedback ADD COLUMN user_id INTEGER REFERENCES users (id) ON DELETE SET NULL;
