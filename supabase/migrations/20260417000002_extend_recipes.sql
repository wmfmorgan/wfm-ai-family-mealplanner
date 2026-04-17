-- Phase 13, Plan 02: Extend Recipes Table (INFRA-05)
-- Adds source tracking: source_provider, source_id, is_adapted, adaptations, image_url.
-- source_provider is NOT NULL with CHECK constraint (D-08).
-- Existing rows backfilled to 'ai-generated' before NOT NULL is enforced (D-09, Pitfall 2).

-- Step 1: Add columns nullable (safe for existing rows)
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS source_provider TEXT;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS is_adapted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS adaptations JSONB;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Step 2: Backfill existing rows before enforcing NOT NULL (D-09)
UPDATE public.recipes SET source_provider = 'ai-generated' WHERE source_provider IS NULL;

-- Step 3: Enforce NOT NULL and CHECK constraint (D-08)
ALTER TABLE public.recipes ALTER COLUMN source_provider SET NOT NULL;
ALTER TABLE public.recipes ADD CONSTRAINT recipes_source_provider_check
  CHECK (source_provider IN ('spoonacular', 'ai-generated'));
