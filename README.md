# Vossos Automotive — Διαχείριση υποθέσεων

Εσωτερική εφαρμογή για διεκπεραιώσεις υποθέσεων οχημάτων: ταξινομήσεις,
μεταβιβάσεις, ΦΙΧ, άδειες οδήγησης και λοιπές εργασίες.

## Stack

- **Next.js 15** (App Router, Server Actions) + TypeScript
- **PostgreSQL** + **Prisma 7** (driver adapter `@prisma/adapter-pg`)
- **Auth.js v5** — ρόλοι `ADMIN` / `EMPLOYEE` / `VIEWER`, 2FA (TOTP)

## Τι καλύπτει

- **Υποθέσεις**: 15 τύποι σε 4 κατηγορίες (Ταξινόμηση / Μεταβίβαση / ΦΙΧ / Λοιπές),
  με πρότυπα σταδίων & δικαιολογητικών ανά τύπο (ρυθμιζόμενα από admin).
- **Καταχώρηση**: κουμπιά κατηγοριών, toggles «ανάριθμη» & «εισαγωγή από εξωτερικό»,
  πινακίδες (ζυγό/μονό/ειδικό), επείγον, αναζήτηση υπάρχοντος πελάτη
  (accent-insensitive μέσω `unaccent` + trigram index).
- **Workflow**: ολοκλήρωση / παράκαμψη / επαναφορά σταδίου, «πλήρης φάκελος»
  με ένα κλικ, αυτόματη ολοκλήρωση υπόθεσης.
- **Οικονομικά**: έξοδα (pass-through), εισπράξεις, αμοιβή, υπόλοιπο· αυτόματος
  υπολογισμός τελών άδειας / μεταβίβασης / κυκλοφορίας (βάσει ρύπων ή κυβικών).
- **Admin**: τύποι υποθέσεων, στάδια, δικαιολογητικά, υπηρεσίες περιφέρειας, χρήστες.

## Στήσιμο

Απαιτείται **Node.js 20+** και **PostgreSQL 14+**.

```bash
npm install
```

Δημιούργησε βάση & χρήστη (μία φορά):

```sql
CREATE ROLE vossos LOGIN CREATEDB PASSWORD '<κωδικός>';
CREATE DATABASE vossos OWNER vossos;
```

Αντίγραψε το `.env.example` σε `.env` και συμπλήρωσε τα δικά σου:

```
DATABASE_URL="postgresql://vossos:<κωδικός>@localhost:5432/vossos?schema=public"
AUTH_SECRET="<openssl rand -base64 32>"
AUTH_URL="http://localhost:3000"
```

Εφάρμοσε migrations & γέμισε τα αρχικά δεδομένα:

```bash
npx prisma migrate deploy
npm run db:seed        # τύποι υποθέσεων + αρχικός admin
npm run dev            # http://localhost:3000
```

Αρχικός λογαριασμός από το seed: `admin@vossos.local` / `admin1234`
(ρυθμίζεται με `ADMIN_EMAIL` / `ADMIN_PASSWORD` — **άλλαξέ τον**).

## Ανάπτυξη με Docker (deploy)

Πλήρης στοίβα (εφαρμογή + PostgreSQL) με **Docker** & **Docker Compose** —
τρέχει σε οποιονδήποτε server, όχι μόνο τοπικά.

```bash
cp .env.example .env          # συμπλήρωσε POSTGRES_PASSWORD & AUTH_SECRET
#   AUTH_SECRET:  openssl rand -base64 32
docker compose up -d --build
```

Στην **πρώτη** εκκίνηση εφαρμόζονται αυτόματα τα migrations (extensions,
`f_unaccent` index, schema) και γίνεται seed (τύποι υποθέσεων + αρχικός
admin). Η εφαρμογή είναι διαθέσιμη στο `http://<server>:${APP_PORT:-3000}`.
**Άλλαξε τον κωδικό του admin** μετά την πρώτη σύνδεση.

- Τα δεδομένα της βάσης παραμένουν στο named volume `db_data` (επιβιώνουν
  restart/rebuild). Το seed **δεν** ξανατρέχει όσο υπάρχουν δεδομένα, οπότε
  δεν χάνονται παραμετροποιήσεις.
- Οι **αιτήσεις PDF** χρησιμοποιούν τη γραμματοσειρά DejaVu Sans (εγκαθίσταται
  στο image) για ελληνικά.
- Πίσω από reverse proxy/domain όρισε `AUTH_URL=https://<domain>` στο `.env`.
- Για **εξωτερική** βάση (managed Postgres): άλλαξε το `DATABASE_URL` στην
  υπηρεσία `app` και αφαίρεσε την υπηρεσία `db`.

| Εντολή | Τι κάνει |
|---|---|
| `docker compose up -d --build` | Build & εκκίνηση στο παρασκήνιο |
| `docker compose logs -f app` | Παρακολούθηση logs εφαρμογής |
| `docker compose down` | Σταμάτημα (κρατά τα δεδομένα) |
| `docker compose down -v` | Σταμάτημα + **διαγραφή** δεδομένων |

## Χρήσιμες εντολές

| Εντολή | Τι κάνει |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run db:migrate` | Νέο migration (development) |
| `npm run db:seed` | Seed τύπων υποθέσεων + admin |
| `npm run db:studio` | Prisma Studio (browser για τη βάση) |

> **Προσοχή:** μην τρέχεις `next build` όσο τρέχει ο dev server — μοιράζονται
> τον φάκελο `.next` και χαλάει.

## Σημειώσεις

- Η **τιμολόγηση** γίνεται σε εξωτερικό πάροχο· εδώ κρατάμε μόνο εσωτερική
  παρακολούθηση χρημάτων (τι χρεώθηκε / εισπράχθηκε).
- Οι πίνακες τελών βρίσκονται στο [`lib/vehicle-tax.ts`](lib/vehicle-tax.ts) —
  ενημέρωσέ τους όταν αλλάζουν οι συντελεστές.
- Το `.env` **δεν** ανεβαίνει στο repository.
