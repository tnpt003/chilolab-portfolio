-- Visitor-created data for ChiloLab. No IP addresses or user agents are stored.

CREATE TABLE feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('idea', 'bug', 'other')),
  message TEXT NOT NULL,
  contact TEXT,
  app_version TEXT,
  locale TEXT NOT NULL CHECK (locale IN ('vi', 'en')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'done')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX feedback_status ON feedback (status, created_at);

-- Comments stay pending until approved on /manage.
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('vi', 'en')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX comments_project ON comments (project, status, created_at);

-- One row per file per day; only a counter, nothing about the visitor.
CREATE TABLE downloads (
  project TEXT NOT NULL,
  version TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('setup', 'portable')),
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project, version, kind, day)
);
