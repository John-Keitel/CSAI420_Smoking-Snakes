-- CreateEnum
CREATE TYPE "ClinicianAccessStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "clinician_access_requests" (
    "id" TEXT NOT NULL,
    "clinician_id" VARCHAR(32),
    "customer_email" VARCHAR(128) NOT NULL,
    "status" "ClinicianAccessStatus" NOT NULL DEFAULT 'PENDING',
    "access_token" VARCHAR(128),
    "token_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinician_access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_consents" (
    "id" TEXT NOT NULL,
    "customer_email" VARCHAR(128) NOT NULL,
    "agreed_to_terms" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_consents_customer_email_key" ON "customer_consents"("customer_email");
