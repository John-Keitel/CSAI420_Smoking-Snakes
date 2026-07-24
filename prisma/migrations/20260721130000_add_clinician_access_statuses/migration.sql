-- AlterEnum
ALTER TYPE "ClinicianAccessStatus" ADD VALUE IF NOT EXISTS 'DENIED';
ALTER TYPE "ClinicianAccessStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
