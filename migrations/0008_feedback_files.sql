-- A screenshot attached to feedback (data roadmap, phase 2). The image is
-- stored in the private R2 bucket bound as BACKUPS, under feedback/; D1 keeps
-- only its key, type and size. Deleting the feedback deletes the image.
ALTER TABLE feedback ADD COLUMN file_key TEXT;
ALTER TABLE feedback ADD COLUMN file_type TEXT;
ALTER TABLE feedback ADD COLUMN file_bytes INTEGER;
