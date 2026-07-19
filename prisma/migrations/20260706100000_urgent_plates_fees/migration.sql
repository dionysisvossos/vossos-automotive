-- Προτίμηση πινακίδας
CREATE TYPE "PlatePreference" AS ENUM ('EVEN', 'ODD', 'SPECIAL');

-- Χρεώσεις επείγοντος & ειδικής πινακίδας στην υπόθεση
ALTER TABLE "Case" ADD COLUMN "urgentFee" DECIMAL(12, 2);
ALTER TABLE "Case" ADD COLUMN "platePreference" "PlatePreference";
ALTER TABLE "Case" ADD COLUMN "plateRequest" TEXT;
ALTER TABLE "Case" ADD COLUMN "plateFee" DECIMAL(12, 2);

-- Flag: εκδίδονται πινακίδες (ζυγό/μονό/ειδικό)
ALTER TABLE "CaseType" ADD COLUMN "issuesPlates" BOOLEAN NOT NULL DEFAULT false;
