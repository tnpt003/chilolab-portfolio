-- Site owner flag. Set only from the database, never through the API:
--   UPDATE users SET role = 'owner' WHERE email = '<owner email>';
-- Owners get an "Author" badge, skip AI moderation, and can approve or remove
-- any comment directly in the comment list.
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'
  CHECK (role IN ('member', 'owner'));
