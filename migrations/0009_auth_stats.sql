-- Hourly sign-in counters, used to spot attacks on /user/login
-- (worker/security.ts). One row per UTC hour and kind of event: no email,
-- account or IP address. Deleted after 90 days by the daily cleanup.
CREATE TABLE auth_stats (
  hour TEXT NOT NULL,
  kind TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (hour, kind)
);
