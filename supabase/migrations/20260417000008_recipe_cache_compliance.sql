-- 2026-04-17 research found current Spoonacular caching terms allow max 1 hour.
ALTER TABLE public.recipe_cache ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

UPDATE public.recipe_cache
SET expires_at = created_at + interval '1 hour'
WHERE expires_at IS NULL;

ALTER TABLE public.recipe_cache ALTER COLUMN expires_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS recipe_cache_expires_at_idx ON public.recipe_cache (expires_at);

ALTER TABLE public.recipe_cache
DROP CONSTRAINT IF EXISTS recipe_cache_max_ttl_check;

ALTER TABLE public.recipe_cache
ADD CONSTRAINT recipe_cache_max_ttl_check
CHECK (expires_at <= created_at + interval '1 hour');
