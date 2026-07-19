-- Κύρια κατηγορία τύπου υπόθεσης (κουμπιά στη φόρμα καταχώρησης)
CREATE TYPE "CaseCategory" AS ENUM ('REGISTRATION', 'TRANSFER', 'TRUCK', 'OTHER');

ALTER TABLE "CaseType"
  ADD COLUMN "category" "CaseCategory" NOT NULL DEFAULT 'OTHER';
