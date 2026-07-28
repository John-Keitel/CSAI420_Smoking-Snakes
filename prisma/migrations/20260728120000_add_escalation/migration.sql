-- CreateEnum
CREATE TYPE "EscalationResponsePreference" AS ENUM ('call', 'text', 'chat');

-- CreateEnum
CREATE TYPE "EscalationPriority" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "EscalationStatus" AS ENUM ('pending', 'assigned', 'resolved');

-- CreateTable
CREATE TABLE "escalations" (
    "id" TEXT NOT NULL,
    "escalation_id" VARCHAR(64) NOT NULL,
    "user_id" VARCHAR(64),
    "phone_number" VARCHAR(32) NOT NULL,
    "original_question" TEXT NOT NULL,
    "ai_response" TEXT NOT NULL,
    "response_preference" "EscalationResponsePreference" NOT NULL,
    "waiting_for_response" BOOLEAN NOT NULL DEFAULT false,
    "priority" "EscalationPriority" NOT NULL DEFAULT 'medium',
    "category" VARCHAR(32) NOT NULL,
    "status" "EscalationStatus" NOT NULL DEFAULT 'pending',
    "question_timestamp" TIMESTAMP(3),
    "escalation_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escalations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "escalations_escalation_id_key" ON "escalations"("escalation_id");

-- CreateIndex
CREATE INDEX "escalations_status_priority_escalation_timestamp_idx" ON "escalations"("status", "priority", "escalation_timestamp");
