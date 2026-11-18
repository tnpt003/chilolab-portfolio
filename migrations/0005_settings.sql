-- Site settings edited by the owner at /manage/settings. One row per key;
-- a missing row means the default in worker/settings.ts.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
