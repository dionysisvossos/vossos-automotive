-- Ταξινομήσεις εισαγωγής: toggle + επιπλέον δικαιολογητικά
ALTER TABLE "Case" ADD COLUMN "isImport" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DocRequirement" ADD COLUMN "importOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CaseType" ADD COLUMN "supportsImport" BOOLEAN NOT NULL DEFAULT false;
