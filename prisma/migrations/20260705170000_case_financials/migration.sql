-- Οικονομικά ανά υπόθεση: έξοδα (pass-through) & εισπράξεις.

CREATE TYPE "ExpenseType" AS ENUM ('TAX', 'STAMP', 'KTEO', 'CUSTOMS', 'OTHER');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'OTHER');

-- Τα paid/paidAt αντικαθίστανται από τις γραμμές εισπράξεων.
ALTER TABLE "Case" DROP COLUMN "paid";
ALTER TABLE "Case" DROP COLUMN "paidAt";

CREATE TABLE "CaseExpense" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "type" "ExpenseType" NOT NULL DEFAULT 'OTHER',
  "description" TEXT,
  "amount" DECIMAL(12, 2) NOT NULL,
  "incurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseExpense_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CaseExpense_caseId_idx" ON "CaseExpense"("caseId");
ALTER TABLE "CaseExpense"
  ADD CONSTRAINT "CaseExpense_caseId_fkey" FOREIGN KEY ("caseId")
  REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseExpense"
  ADD CONSTRAINT "CaseExpense_createdById_fkey" FOREIGN KEY ("createdById")
  REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CasePayment" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
  "note" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CasePayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CasePayment_caseId_idx" ON "CasePayment"("caseId");
ALTER TABLE "CasePayment"
  ADD CONSTRAINT "CasePayment_caseId_fkey" FOREIGN KEY ("caseId")
  REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CasePayment"
  ADD CONSTRAINT "CasePayment_createdById_fkey" FOREIGN KEY ("createdById")
  REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
