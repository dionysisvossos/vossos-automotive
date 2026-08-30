# syntax=docker/dockerfile:1

# ── Base ─────────────────────────────────────────────────────
FROM node:22-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ── Dependencies (όλα, για το build) ─────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ── Build ────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholders μόνο για το build (τα πραγματικά έρχονται από το compose στο
# runtime). Αποτρέπουν αποτυχία build αν κάποιο module διαβάσει env.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV AUTH_SECRET="build-time-placeholder"
# Παράγει τον Prisma client (driver adapter) και χτίζει το Next.js.
RUN npx prisma generate && npm run build

# ── Runner ───────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production

# Γραμματοσειρά με ελληνικά για τη δημιουργία PDF αιτήσεων (DejaVu Sans
# εγκαθίσταται στο /usr/share/fonts/truetype/dejavu/ — όπως το περιμένει
# το lib/aitisi.ts). Το tini δίνει σωστό signal handling.
RUN apt-get update \
    && apt-get install -y --no-install-recommends fonts-dejavu-core tini \
    && rm -rf /var/lib/apt/lists/*

# Το app + node_modules (περιλαμβάνει prisma CLI & tsx για migrate/seed).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/templates ./templates
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--", "./docker-entrypoint.sh"]
