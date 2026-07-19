-- Αφαίρεση πλεονάζοντος πεδίου μοντέλου
ALTER TABLE "Vehicle" DROP COLUMN "model";

-- Παρακράτηση κυριότητας στο όχημα
ALTER TABLE "Vehicle" ADD COLUMN "hasOwnershipRetention" BOOLEAN NOT NULL DEFAULT false;

-- Επείγον / αυθημερόν στην υπόθεση
ALTER TABLE "Case" ADD COLUMN "urgent" BOOLEAN NOT NULL DEFAULT false;
