-- Add prompt/response metadata so Edge Function AI interactions can surface in Settings.
ALTER TABLE public.ai_usage_log
ADD COLUMN IF NOT EXISTS prompt_text TEXT,
ADD COLUMN IF NOT EXISTS response_text TEXT,
ADD COLUMN IF NOT EXISTS error_text TEXT,
ADD COLUMN IF NOT EXISTS status_code INTEGER,
ADD COLUMN IF NOT EXISTS latency_ms INTEGER;

DROP POLICY IF EXISTS "Users can read ai usage logs for their own household" ON public.ai_usage_log;

CREATE POLICY "Users can read ai usage logs for their own household"
ON public.ai_usage_log
FOR SELECT
USING (
  household_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.households
    WHERE households.id = ai_usage_log.household_id
      AND households.owner_id = auth.uid()
  )
);
