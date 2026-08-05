-- CreateTable
CREATE TABLE "chat_registration_sessions" (
    "id" UUID NOT NULL,
    "chat_session_id" VARCHAR(128) NOT NULL,
    "conversation_context" JSONB NOT NULL,
    "current_step" VARCHAR(64) NOT NULL,
    "last_activity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_registration_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_registration_sessions_chat_session_id_key" ON "chat_registration_sessions"("chat_session_id");
