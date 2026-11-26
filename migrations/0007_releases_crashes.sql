-- Data roadmap, phase 2 (docs/DATA-ROADMAP.md).

-- "Email me about new versions", one row per account and project. Only
-- signed-in accounts subscribe, so the address is already verified.
-- unsubscribe_token can only cancel this one row (the link in each email);
-- it signs nobody in, so it is stored as is.
CREATE TABLE subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  project TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('vi', 'en')),
  unsubscribe_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (user_id, project)
);
CREATE INDEX subscriptions_project ON subscriptions (project);

-- A released version the owner chose to announce from /admin/manage/releases.
-- Emails go out in daily batches (Resend free tier: 100 per day), so a
-- notice stays open until every subscriber has had one.
CREATE TABLE release_notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  finished_at TEXT,
  UNIQUE (project, version)
);

-- Who already received a notice; makes sending safe to repeat.
CREATE TABLE notice_deliveries (
  notice_id INTEGER NOT NULL REFERENCES release_notices (id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  sent_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (notice_id, user_id)
);
CREATE INDEX notice_deliveries_sent ON notice_deliveries (sent_at);

-- Crash reports a desktop app sends only after the user agreed. No IP, no
-- account, no Windows user name (stripped from paths before saving).
-- Deleted after 90 days by the daily cleanup (worker/maintenance.ts).
CREATE TABLE crash_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id TEXT NOT NULL UNIQUE,
  project TEXT NOT NULL,
  app_version TEXT NOT NULL,
  os TEXT,
  kind TEXT NOT NULL,
  message TEXT,
  stack TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'done')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX crash_reports_status ON crash_reports (status, created_at);
