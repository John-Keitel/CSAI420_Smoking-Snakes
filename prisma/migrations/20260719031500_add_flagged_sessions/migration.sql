-- CreateEnum
CREATE TYPE "ModerationSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'RESOLVED');

-- CreateTable
CREATE TABLE "flagged_sessions" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "customer_email" VARCHAR(128) NOT NULL,
    "severity" "ModerationSeverity" NOT NULL DEFAULT 'HIGH',
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "ai_recommendation" TEXT,
    "human_override" TEXT,
    "reviewer_notes" TEXT,
    "reviewed_by_user_id" VARCHAR(32),
    "resolved_by_user_id" VARCHAR(32),
    "flagged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "alerted_at" TIMESTAMP(3),

    CONSTRAINT "flagged_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "flagged_sessions_session_id_key" ON "flagged_sessions"("session_id");

-- CreateIndex
CREATE INDEX "flagged_sessions_status_severity_flagged_at_idx" ON "flagged_sessions"("status", "severity", "flagged_at");

-- AddForeignKey
ALTER TABLE "flagged_sessions" ADD CONSTRAINT "flagged_sessions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
