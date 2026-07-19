-- Πλήρης φάκελος: όλα τα δικαιολογητικά παρελήφθησαν
ALTER TABLE "Case" ADD COLUMN "documentsComplete" BOOLEAN NOT NULL DEFAULT false;
