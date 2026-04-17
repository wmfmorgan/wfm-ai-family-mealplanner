CREATE TABLE IF NOT EXISTS public.recipe_cache_directive_lookup (
  directive_hash TEXT PRIMARY KEY,
  spoonacular_id INTEGER NOT NULL REFERENCES public.recipe_cache(spoonacular_id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recipe_cache_directive_lookup_expires_at_idx
  ON public.recipe_cache_directive_lookup (expires_at);

CREATE INDEX IF NOT EXISTS recipe_cache_directive_lookup_spoonacular_id_idx
  ON public.recipe_cache_directive_lookup (spoonacular_id);

ALTER TABLE public.recipe_cache_directive_lookup ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.recipe_cache_directive_lookup
DROP CONSTRAINT IF EXISTS recipe_cache_directive_lookup_max_ttl_check;

ALTER TABLE public.recipe_cache_directive_lookup
ADD CONSTRAINT recipe_cache_directive_lookup_max_ttl_check
CHECK (expires_at <= created_at + interval '1 hour');
