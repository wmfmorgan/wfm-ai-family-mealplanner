-- Phase 13, Plan 02: AI Usage Log Table (INFRA-02)
-- Records prompt_tokens, completion_tokens per callAI() invocation.
-- Written by service role (bypasses RLS). No user SELECT policy until Phase 14/16 quota UI.

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role              TEXT NOT NULL,
  provider          TEXT NOT NULL,
  model             TEXT NOT NULL,
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens      INTEGER NOT NULL DEFAULT 0,
  edge_function     TEXT,
  household_id      UUID REFERENCES public.households(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quota queries: tokens used by household today/this week
CREATE INDEX IF NOT EXISTS ai_usage_log_household_created_idx
  ON public.ai_usage_log (household_id, created_at);

-- RLS enabled; service role writes bypass RLS automatically
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
