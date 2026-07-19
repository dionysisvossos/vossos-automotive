-- Trigram support για accent-insensitive ILIKE '%...%' με index
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Immutable wrapper: η δίτιμη μορφή unaccent(regdictionary, text) με ρητό
-- λεξικό είναι ανεξάρτητη του search_path, άρα ασφαλής ως IMMUTABLE (σε
-- αντίθεση με τη μονότιμη unaccent(text)) — προϋπόθεση για functional index.
CREATE OR REPLACE FUNCTION f_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  STRICT
AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$;

-- GIN trigram index πάνω στο accent-folded όνομα
CREATE INDEX IF NOT EXISTS contact_fullname_unaccent_trgm_idx
  ON "Contact"
  USING gin (f_unaccent("fullName") gin_trgm_ops);
