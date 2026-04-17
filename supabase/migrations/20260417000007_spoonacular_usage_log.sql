-- Logged per request because 2026-04-17 research found the free-tier daily limit
-- may be 50 points rather than the earlier 150-point assumption.
CREATE TABLE IF NOT EXISTS public.spoonacular_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  directive_hash TEXT,
  points_requested INTEGER NOT NULL DEFAULT 0,
  points_used_today INTEGER NOT NULL DEFAULT 0,
  points_left_today INTEGER NOT NULL DEFAULT 0,
  daily_limit INTEGER NOT NULL,
  status_code INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS spoonacular_usage_log_household_created_idx
  ON public.spoonacular_usage_log (household_id, created_at DESC);

CREATE INDEX IF NOT EXISTS spoonacular_usage_log_created_idx
  ON public.spoonacular_usage_log (created_at DESC);

ALTER TABLE public.spoonacular_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own spoonacular usage logs"
ON public.spoonacular_usage_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.households
    WHERE households.id = spoonacular_usage_log.household_id
      AND households.owner_id = auth.uid()
  )
);
