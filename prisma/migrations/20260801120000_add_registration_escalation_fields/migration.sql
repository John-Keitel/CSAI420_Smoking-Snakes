-- CreateEnum
CREATE TYPE "EscalationIssueType" AS ENUM ('confusion_about_process', 'technical_difficulties', 'account_creation_failed', 'validation_errors');

-- AlterEnum
ALTER TYPE "EscalationResponsePreference" ADD VALUE 'email';

-- AlterTable
ALTER TABLE "escalations" ADD COLUMN     "conversation_context" JSONB,
ADD COLUMN     "issue_type" "EscalationIssueType",
ADD COLUMN     "registration_data" JSONB,
ALTER COLUMN "original_question" DROP NOT NULL;
