#!/bin/sh
set -e

echo "→ Εφαρμογή migrations (extensions, f_unaccent index, schema)..."
n=0
until node_modules/.bin/prisma migrate deploy; do
  n=$((n + 1))
  if [ "$n" -ge 10 ]; then
    echo "✗ Το migrate deploy απέτυχε μετά από 10 προσπάθειες."
    exit 1
  fi
  echo "  ...η βάση δεν είναι ακόμη έτοιμη, retry $n/10 σε 3s"
  sleep 3
done

# Seed ΜΟΝΟ σε άδεια βάση (SEED_SKIP_IF_EXISTS=1): 1η ανάπτυξη → δημιουργεί
# τύπους/στάδια/δικαιολογητικά + admin. Σε restarts παραλείπεται (προστασία
# των παραμετροποιήσεων του admin).
echo "→ Έλεγχος/αρχικοποίηση δεδομένων (seed αν άδεια βάση)..."
SEED_SKIP_IF_EXISTS=1 node_modules/.bin/tsx prisma/seed.ts || echo "  (seed παραλείφθηκε/απέτυχε — μη κρίσιμο)"

echo "→ Εκκίνηση Next.js στο 0.0.0.0:3000..."
exec node_modules/.bin/next start -H 0.0.0.0 -p 3000
