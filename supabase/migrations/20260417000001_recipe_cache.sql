-- Phase 13, Plan 02: Recipe Cache Table (INFRA-04)
-- Stores Spoonacular API responses for 30-day cache-first lookup.
-- TTL enforced app-side: WHERE created_at > now() - interval '30 days' (D-06, no pg_cron).

CREATE TABLE IF NOT EXISTS public.recipe_cache (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spoonacular_id   INTEGER NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  ready_in_minutes INTEGER,
  servings         INTEGER,
  image_url        TEXT,
  raw_data         JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- GIN index for JSONB containment queries (e.g., ingredient search, diet flag filtering)
CREATE INDEX IF NOT EXISTS recipe_cache_raw_data_gin
  ON public.recipe_cache USING GIN (raw_data);

-- B-tree indexes for equality lookups on extracted columns
CREATE INDEX IF NOT EXISTS recipe_cache_spoonacular_id_idx
  ON public.recipe_cache (spoonacular_id);
CREATE INDEX IF NOT EXISTS recipe_cache_created_at_idx
  ON public.recipe_cache (created_at);

-- RLS enabled; reads/writes via service role only (no user-facing policy in this phase)
ALTER TABLE public.recipe_cache ENABLE ROW LEVEL SECURITY;
