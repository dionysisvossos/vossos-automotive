-- Διακριτοί τύποι εξόδων ώστε να ξεχωρίζουν σε αναφορές/εξαγωγές
-- (π.χ. «παράβολο καθαρό» χωρίς την προμήθεια τράπεζας).
ALTER TYPE "ExpenseType" ADD VALUE IF NOT EXISTS 'LICENSE';
ALTER TYPE "ExpenseType" ADD VALUE IF NOT EXISTS 'BANK';
ALTER TYPE "ExpenseType" ADD VALUE IF NOT EXISTS 'CIRCULATION';
ALTER TYPE "ExpenseType" ADD VALUE IF NOT EXISTS 'TRANSFER';
