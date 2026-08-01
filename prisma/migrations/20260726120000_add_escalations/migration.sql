-- CreateEnum
CREATE TYPE "EscalationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "EscalationCategory" AS ENUM ('GENERAL', 'MEDICAL', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "EscalationStatus" AS ENUM ('PENDING', 'ASSIGNED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "EscalationResponsePreference" AS ENUM ('CALL', 'TEXT', 'CHAT');

-- CreateTable
CREATE TABLE "escalations" (
    "id" UUID NOT NULL,
    "escalation_id" VARCHAR(64) NOT NULL,
    "user_id" VARCHAR(128),
    "session_id" VARCHAR(128),
    "phone_number" VARCHAR(20) NOT NULL,
    "original_question" TEXT NOT NULL,
    "ai_response" TEXT NOT NULL,
    "response_preference" "EscalationResponsePreference" NOT NULL,
    "waiting_for_response" BOOLEAN NOT NULL DEFAULT true,
    "priority" "EscalationPriority" NOT NULL DEFAULT 'MEDIUM',
    "category" "EscalationCategory" NOT NULL DEFAULT 'GENERAL',
    "status" "EscalationStatus" NOT NULL DEFAULT 'PENDING',
    "coach_id" VARCHAR(128),
    "question_timestamp" TIMESTAMP(3) NOT NULL,
    "escalation_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolution_timestamp" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escalations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "escalations_escalation_id_key" ON "escalations"("escalation_id");

-- CreateIndex
CREATE INDEX "escalations_status_priority_escalation_timestamp_idx" ON "escalations"("status", "priority", "escalation_timestamp");
