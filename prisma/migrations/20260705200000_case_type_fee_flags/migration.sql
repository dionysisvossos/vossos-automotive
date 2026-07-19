-- Flags: ποια πάγια τέλη προτείνονται ανά τύπο υπόθεσης.
ALTER TABLE "CaseType" ADD COLUMN "hasLicenseFee" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CaseType" ADD COLUMN "hasCirculationTax" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CaseType" ADD COLUMN "hasTransferFee" BOOLEAN NOT NULL DEFAULT false;
