-- Widen FK columns referencing users.id from VARCHAR(32) to VARCHAR(36).
-- User.id switched from cuid() (25 chars) to uuid() (36 chars), so UUID
-- user ids no longer fit in the FK columns.

ALTER TABLE "sessions" ALTER COLUMN "user_id" TYPE VARCHAR(36);
ALTER TABLE "assessments" ALTER COLUMN "user_id" TYPE VARCHAR(36);
ALTER TABLE "steps" ALTER COLUMN "user_id" TYPE VARCHAR(36);
ALTER TABLE "expo_push_tokens" ALTER COLUMN "user_id" TYPE VARCHAR(36);
ALTER TABLE "flagged_sessions" ALTER COLUMN "reviewed_by_user_id" TYPE VARCHAR(36);
ALTER TABLE "flagged_sessions" ALTER COLUMN "resolved_by_user_id" TYPE VARCHAR(36);
