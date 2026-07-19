-- Χωρισμός ονόματος πελάτη σε επώνυμο/όνομα + νέα προαιρετικά πεδία επικοινωνίας.

-- Το παλιό trigram index εξαρτάται από τη στήλη fullName — το ρίχνουμε ρητά.
DROP INDEX IF EXISTS "contact_fullname_unaccent_trgm_idx";

-- Νέες στήλες (lastName αρχικά nullable για το backfill).
ALTER TABLE "Contact" ADD COLUMN "lastName" TEXT;
ALTER TABLE "Contact" ADD COLUMN "firstName" TEXT;
ALTER TABLE "Contact" ADD COLUMN "idNumber" TEXT;

-- Μεταφορά υπαρχόντων ονομάτων στο επώνυμο (καμία απώλεια).
UPDATE "Contact" SET "lastName" = "fullName";

-- Πλέον υποχρεωτικό.
ALTER TABLE "Contact" ALTER COLUMN "lastName" SET NOT NULL;

-- Κατάργηση του παλιού πεδίου (ρίχνει και το btree index του).
ALTER TABLE "Contact" DROP COLUMN "fullName";

-- Btree index στο επώνυμο (αντιστοιχεί στο @@index([lastName])).
CREATE INDEX "Contact_lastName_idx" ON "Contact"("lastName");

-- Νέο trigram index στο accent-folded πλήρες όνομα (επώνυμο + όνομα).
CREATE INDEX "contact_fullname_unaccent_trgm_idx"
  ON "Contact"
  USING gin (
    f_unaccent(trim(coalesce("lastName", '') || ' ' || coalesce("firstName", ''))) gin_trgm_ops
  );
