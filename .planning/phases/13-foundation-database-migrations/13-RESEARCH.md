# Phase 13: Foundation & Database Migrations - Research

**Researched:** 2026-04-17
**Domain:** Supabase Edge Functions (Deno shared modules), PostgreSQL schema migrations, PL/pgSQL RPC functions
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Role configs (temperature, max_tokens) use a hardcoded TypeScript role map in `_shared/ai-client.ts`. Roles: `coordinator`, `adapter`, `fallback-generator`. New roles require code change.
- **D-02:** Shared module scope is AI calls + auth verification + CORS headers. Extract all three from existing Edge Functions into `_shared/`.
- **D-03:** Provider support: Gemini + Grok only. Ollama support deferred.
- **D-04:** Token usage logged to a dedicated `ai_usage_log` table. Columns: `id`, `role`, `provider`, `model`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `created_at`, `edge_function`, `household_id`.
- **D-05:** Recipe cache schema: JSONB + extracted columns. `raw_data JSONB`, plus `spoonacular_id`, `title`, `ready_in_minutes`, `servings`, `image_url`. GIN index on `raw_data`, B-tree on extracted columns.
- **D-06:** TTL: `created_at` + app-side 30-day check. No background job. `pg_cron` deferred.
- **D-07:** One migration file per concern: recipe_cache table, recipes ALTER, shopping_list_items ALTER, ai_usage_log table, bulk save RPC function. 5 files.
- **D-08:** `recipes.source_provider` column: `TEXT NOT NULL` with CHECK constraint `source_provider IN ('spoonacular', 'ai-generated')`. Existing rows backfilled to `'ai-generated'` in the migration.
- **D-09:** Existing recipes are throwaway — backfill with `'ai-generated'` or truncate as needed. `source_provider` goes NOT NULL from the start.
- **D-10:** `save_meal_plan_bulk` input: single JSONB payload — `{ week_start_date, slots: [{ day, meal_type, recipe: {...}, shopping_items: [...] }] }`.
- **D-11:** `save_meal_plan_bulk` return: `meal_plan_id` UUID only.
- **D-12:** Conflict handling: error out. Bulk-save only called for new drafts.

### Claude's Discretion

- Specific column names for `shopping_list_items` extensions (`aisle`, `amount`, `unit`) — schema matches INFRA-06 requirements, exact types TBD by planner.
- Error response shape from the shared AI client — follow existing `ai-proxy` error pattern.
- Whether `ai_usage_log` requires RLS or is service-role only.

### Deferred Ideas (OUT OF SCOPE)

- Ollama provider support in shared AI client.
- `pg_cron` scheduled cache cleanup (requires Supabase Pro).
- `ai_usage_log` RLS policy decision — planner's call (kept as discretion above).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | All LLM calls route through shared AI client with role-based temperature and max_tokens enforcement | `_shared/` relative import pattern confirmed; role map TypeScript pattern documented |
| INFRA-02 | Shared AI client logs token usage (prompt_tokens, completion_tokens) for every LLM call | `ai_usage_log` table schema and service-role insert pattern documented |
| INFRA-03 | Shared AI client handles provider resolution from environment variables (replaces duplicated logic across Edge Functions) | `Deno.env.get()` pattern from existing functions; GEMINI_API_KEY / XAI_API_KEY confirmed |
| INFRA-04 | Recipe cache table stores Spoonacular results with JSONB data, GIN indexes, extracted columns, and 30-day TTL | GIN index syntax, partial index patterns, TTL via `created_at` column documented |
| INFRA-05 | Recipes table supports source tracking (source_id, source_provider, is_adapted, adaptations, image_url) | ALTER TABLE ADD COLUMN pattern from existing migration 20260414 confirmed |
| INFRA-06 | Shopping list items table supports provider aisle data (aisle, amount, unit) | ALTER TABLE ADD COLUMN pattern; column types research documented |
</phase_requirements>

---

## Summary

Phase 13 is a pure infrastructure phase: no new UI, no Spoonacular calls, no generation logic. It creates the shared Deno module and five SQL migration files that all downstream phases (14–17) depend on.

The existing codebase makes the extraction straightforward. All four Edge Functions (`ai-proxy`, `generate-plan`, `refresh-slot`, `categorize-ingredients`) share three identical blocks: CORS headers, JWT auth verification against Supabase, and provider resolution (Gemini vs. Grok via `Deno.env.get()`). These blocks move verbatim into `_shared/ai-client.ts`, `_shared/cors.ts`, and `_shared/auth.ts`. Callers shrink to business logic only.

The five migration files extend two existing tables (`recipes`, `shopping_list_items`) and create two new ones (`recipe_cache`, `ai_usage_log`) plus one PL/pgSQL RPC function (`save_meal_plan_bulk`). All existing migrations use `IF NOT EXISTS` guards and explicit RLS policies — this phase follows the same pattern.

The critical implementation detail is the `save_meal_plan_bulk` RPC: it must be `SECURITY DEFINER` with `search_path = ''` and operate as a single transaction. It receives one JSONB blob and returns one UUID. The planner must design the PL/pgSQL to iterate `slots`, insert one `meal_plans` row, N `recipes` rows, N `meal_plan_slots` rows, and M `shopping_list_items` rows atomically.

**Primary recommendation:** Write the five migration files and `_shared/` modules as independent units. The RPC function is the most complex deliverable — prototype it against the local Supabase instance before finalizing the migration file.

---

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| Deno (Edge Function runtime) | Bundled by Supabase | Edge Function execution | No choice — Supabase platform |
| `https://deno.land/std@0.168.0/http/server.ts` | 0.168.0 | HTTP server for Edge Functions | Already in use across all 4 existing functions |
| `https://esm.sh/@supabase/supabase-js@2.40.0` | 2.40.0 | Supabase client in Deno | Already in use across all 4 existing functions |
| PostgreSQL (via Supabase) | Bundled | Relational database | Platform default |
| PL/pgSQL | Bundled with Postgres | Stored procedure language for RPC | Required for transactional bulk insert |

### No New npm Installs Required

This phase is entirely backend infrastructure. No new frontend dependencies. No new npm packages.

**Version verification:** Existing functions use `std@0.168.0` and `supabase-js@2.40.0` — use identical versions in `_shared/` to avoid version mismatch errors.

---

## Architecture Patterns

### Recommended Project Structure After Phase 13

```
supabase/
├── functions/
│   ├── _shared/
│   │   ├── cors.ts           # CORS headers object (extracted from all 4 functions)
│   │   ├── auth.ts           # JWT verification + Supabase client factory
│   │   └── ai-client.ts      # Provider routing, role map, token logging
│   ├── ai-proxy/             # Unchanged (deprecated in Phase 17)
│   ├── generate-plan/        # Unchanged (deprecated in Phase 17)
│   ├── refresh-slot/         # Unchanged (deprecated in Phase 17)
│   └── categorize-ingredients/ # Unchanged (removed in Phase 17)
├── migrations/
│   ├── 20260413000000_meal_planner_core.sql   # Existing
│   ├── 20260414000209_add_recipes_columns.sql # Existing
│   ├── 20260415000000_shopping_list.sql       # Existing
│   ├── YYYYMMDDXXXXXX_recipe_cache.sql        # NEW: recipe_cache table
│   ├── YYYYMMDDXXXXXX_extend_recipes.sql      # NEW: ALTER recipes table
│   ├── YYYYMMDDXXXXXX_extend_shopping_list.sql # NEW: ALTER shopping_list_items
│   ├── YYYYMMDDXXXXXX_ai_usage_log.sql        # NEW: ai_usage_log table
│   └── YYYYMMDDXXXXXX_bulk_save_rpc.sql       # NEW: save_meal_plan_bulk function
```

### Pattern 1: Deno `_shared/` Module Import

Supabase officially supports a `_shared/` folder under `supabase/functions/`. Individual functions import with relative paths.

```typescript
// supabase/functions/select-meals/index.ts (Phase 14 example consumer)
// Source: Supabase official examples (github.com/supabase/supabase/blob/master/examples/edge-functions)
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { callAI } from '../_shared/ai-client.ts'
```

No `import_map.json` or `deno.json` is required at the `_shared/` level. The relative path is sufficient. The `_shared/` prefix (underscore) signals to the Supabase CLI that this directory contains helper modules, not deployable functions.

### Pattern 2: `_shared/cors.ts` — Extracted Verbatim

```typescript
// supabase/functions/_shared/cors.ts
// Source: Extracted from existing ai-proxy/index.ts, generate-plan/index.ts, etc.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

### Pattern 3: `_shared/auth.ts` — Extracted + Typed

```typescript
// supabase/functions/_shared/auth.ts
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.40.0"
import { corsHeaders } from './cors.ts'

export function createUserClient(authHeader: string): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
}

export function createServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(supabaseUrl, serviceRoleKey)
}

export async function verifyAuth(req: Request): Promise<{ user: any; authHeader: string } | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'No authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const supabase = createUserClient(authHeader)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token', details: error?.message }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  return { user, authHeader }
}
```

### Pattern 4: `_shared/ai-client.ts` — Role Map + Token Logging

```typescript
// supabase/functions/_shared/ai-client.ts
// Source: Refactored from ai-proxy/index.ts provider routing logic

import { createServiceClient } from './auth.ts'

// D-01: Hardcoded role config map
const ROLE_CONFIG: Record<string, { temperature: number; max_tokens: number }> = {
  'coordinator':        { temperature: 0.7, max_tokens: 1024 },
  'adapter':           { temperature: 0.3, max_tokens: 2048 },
  'fallback-generator': { temperature: 0.9, max_tokens: 2048 },
}

export type AIRole = keyof typeof ROLE_CONFIG

export interface AICallOptions {
  role: AIRole
  systemPrompt: string
  userPrompt: string
  responseFormat?: { type: 'json_object' }
  householdId?: string
  edgeFunction?: string
}

export interface AICallResult {
  content: string
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  provider: string
  model: string
}

export async function callAI(options: AICallOptions): Promise<AICallResult> {
  const { role, systemPrompt, userPrompt, responseFormat, householdId, edgeFunction } = options
  const roleConfig = ROLE_CONFIG[role]

  // D-03: Gemini + Grok only — provider resolution from env vars (INFRA-03)
  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  const grokKey = Deno.env.get('XAI_API_KEY')
  const provider = geminiKey ? 'gemini' : 'grok'
  const apiKey = provider === 'gemini' ? geminiKey! : grokKey!
  const apiUrl = provider === 'gemini'
    ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
    : 'https://api.x.ai/v1/chat/completions'
  const model = provider === 'gemini' ? 'gemini-1.5-flash' : 'grok-3'

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: roleConfig.temperature,
      max_tokens: roleConfig.max_tokens,
      response_format: responseFormat ?? undefined,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`AI provider error (${provider}): ${errorText}`)
  }

  const result = await response.json()
  let content = result.choices[0].message.content.trim()
  if (content.startsWith('```')) {
    content = content.replace(/^```[a-z]*\n/i, '').replace(/\n```$/g, '')
  }

  const usage = result.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

  // D-04: INFRA-02 — log token usage to ai_usage_log using service client (bypasses RLS)
  const serviceClient = createServiceClient()
  await serviceClient.from('ai_usage_log').insert({
    role,
    provider,
    model,
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens,
    edge_function: edgeFunction ?? null,
    household_id: householdId ?? null,
  })

  return { content, usage, provider, model }
}
```

### Pattern 5: GIN Index on JSONB Column

```sql
-- Source: PostgreSQL docs + Supabase indexing guide
CREATE TABLE IF NOT EXISTS public.recipe_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spoonacular_id  INTEGER NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  ready_in_minutes INTEGER,
  servings        INTEGER,
  image_url       TEXT,
  raw_data        JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- GIN index for arbitrary JSONB queries (e.g., ingredient lookups, diet flags)
CREATE INDEX IF NOT EXISTS recipe_cache_raw_data_gin
  ON public.recipe_cache USING GIN (raw_data);

-- B-tree indexes for equality lookups on extracted columns
CREATE INDEX IF NOT EXISTS recipe_cache_spoonacular_id_idx
  ON public.recipe_cache (spoonacular_id);
CREATE INDEX IF NOT EXISTS recipe_cache_created_at_idx
  ON public.recipe_cache (created_at);
```

### Pattern 6: `save_meal_plan_bulk` RPC — SECURITY DEFINER Bulk Insert

```sql
-- Source: Supabase database functions docs + PostgreSQL PL/pgSQL reference
CREATE OR REPLACE FUNCTION public.save_meal_plan_bulk(payload JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id  UUID;
  v_meal_plan_id  UUID;
  v_recipe_id     UUID;
  slot            JSONB;
BEGIN
  -- Extract household_id from payload
  v_household_id := (payload->>'household_id')::UUID;

  -- D-12: Error out on duplicate week (do not silently overwrite)
  INSERT INTO public.meal_plans (household_id, week_start_date, status)
  VALUES (v_household_id, (payload->>'week_start_date')::DATE, 'active')
  RETURNING id INTO v_meal_plan_id;

  -- Iterate slots
  FOR slot IN SELECT * FROM jsonb_array_elements(payload->'slots')
  LOOP
    -- Upsert recipe
    INSERT INTO public.recipes (
      household_id, name, ingredients, instructions,
      nutrition, prep_time_min, cook_time_min, servings,
      source_provider, source_id, image_url
    )
    VALUES (
      v_household_id,
      slot->'recipe'->>'name',
      COALESCE(slot->'recipe'->'ingredients', '[]'::jsonb),
      COALESCE(slot->'recipe'->'instructions', '[]'::jsonb),
      COALESCE(slot->'recipe'->'nutrition', '{}'::jsonb),
      COALESCE((slot->'recipe'->>'prep_time_min')::INTEGER, 0),
      COALESCE((slot->'recipe'->>'cook_time_min')::INTEGER, 0),
      COALESCE((slot->'recipe'->>'servings')::INTEGER, 1),
      slot->'recipe'->>'source_provider',
      slot->'recipe'->>'source_id',
      slot->'recipe'->>'image_url'
    )
    RETURNING id INTO v_recipe_id;

    -- Insert meal plan slot
    INSERT INTO public.meal_plan_slots (meal_plan_id, day_of_week, meal_type, recipe_id)
    VALUES (
      v_meal_plan_id,
      (slot->>'day')::INTEGER,
      slot->>'meal_type',
      v_recipe_id
    );

    -- Insert shopping items
    INSERT INTO public.shopping_list_items (meal_plan_id, original_string, category, aisle, amount, unit)
    SELECT
      v_meal_plan_id,
      item->>'original_string',
      COALESCE(item->>'category', 'Other'),
      item->>'aisle',
      (item->>'amount')::NUMERIC,
      item->>'unit'
    FROM jsonb_array_elements(COALESCE(slot->'shopping_items', '[]'::jsonb)) AS item
    ON CONFLICT (meal_plan_id, original_string) DO NOTHING;
  END LOOP;

  -- D-11: Return meal_plan_id UUID only
  RETURN v_meal_plan_id;
END;
$$;
```

**Critical note:** Because `SECURITY DEFINER` bypasses RLS, this function must validate that the calling user owns the target household before inserting. Add a guard at the top:

```sql
-- Guard: verify household ownership (add this before the INSERT into meal_plans)
IF NOT EXISTS (
  SELECT 1 FROM public.households
  WHERE id = v_household_id
  AND owner_id = auth.uid()
) THEN
  RAISE EXCEPTION 'Household not found or access denied';
END IF;
```

### Anti-Patterns to Avoid

- **Importing `_shared/` with absolute paths:** Always use `'../_shared/filename.ts'` (relative). Absolute paths fail in Deno's module resolution.
- **Using `SUPABASE_SERVICE_ROLE_KEY` in user-facing clients:** Service role bypasses RLS entirely. Only the `ai_usage_log` insert should use it. All other reads/writes go through the user auth client.
- **Nullable `source_provider` on new rows:** D-08/D-09 are explicit — NOT NULL from day one. The migration must backfill before adding the NOT NULL constraint.
- **Large `max_tokens` on coordinator role:** The coordinator produces structured directives, not essays. Keep `max_tokens` low (e.g., 1024) to control costs and latency. The `fallback-generator` role needs higher limits.
- **Running migrations out of order:** Supabase applies migrations by filename timestamp ascending. The `extend_recipes` migration must run after `meal_planner_core`. Name new files with current timestamps to ensure correct ordering.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSONB deep querying | Custom JSON parser | PostgreSQL GIN index + `@>` operator | Postgres handles containment, path access, indexing natively |
| Atomic multi-table insert | Client-side transaction with multiple round trips | PL/pgSQL function called via RPC | Single network call, single transaction, no partial-write state |
| Provider key resolution | Custom config loader | `Deno.env.get()` already in all existing functions | Already the established pattern; no abstraction needed |
| Auth verification | Custom JWT decode | `supabase.auth.getUser()` | Already battle-tested, handles expiry, refresh, revocation |
| TTL enforcement | pg_cron or triggers | `WHERE created_at > now() - interval '30 days'` in queries | pg_cron requires Supabase Pro (deferred); simple WHERE clause is sufficient per D-06 |

**Key insight:** The `save_meal_plan_bulk` RPC eliminates the biggest risk of a client-side save: partial writes. If the recipe inserts succeed but `meal_plan_slots` fails, a client-side approach leaves orphaned rows. The RPC rolls back everything atomically.

---

## Common Pitfalls

### Pitfall 1: `_shared/` Directory Not Recognized by Supabase CLI

**What goes wrong:** Running `supabase functions serve` or deploying fails because the CLI cannot resolve `'../_shared/cors.ts'`.
**Why it happens:** The underscore convention signals to the Supabase CLI that this is a non-deployable module folder. If the folder is named differently (e.g., `shared/`) the import still resolves in Deno but deployment may package incorrectly.
**How to avoid:** Name the folder exactly `_shared` (underscore prefix). No `deno.json` required in `_shared/` itself.
**Warning signs:** CLI error: `Module not found` or `Cannot resolve specifier` during `supabase functions serve`.

### Pitfall 2: `source_provider` NOT NULL Constraint Fails on Backfill

**What goes wrong:** The ALTER TABLE migration adds `source_provider TEXT NOT NULL` and it immediately fails because existing rows have NULL.
**Why it happens:** PostgreSQL enforces NOT NULL on all existing rows at the time the constraint is added.
**How to avoid:** In the migration: (1) ADD COLUMN as nullable, (2) UPDATE to backfill, (3) ALTER COLUMN to SET NOT NULL. In a single migration file:
```sql
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS source_provider TEXT;
UPDATE public.recipes SET source_provider = 'ai-generated' WHERE source_provider IS NULL;
ALTER TABLE public.recipes ALTER COLUMN source_provider SET NOT NULL;
ALTER TABLE public.recipes ADD CONSTRAINT recipes_source_provider_check
  CHECK (source_provider IN ('spoonacular', 'ai-generated'));
```
**Warning signs:** `ERROR: column "source_provider" of relation "recipes" contains null values` during migration.

### Pitfall 3: `SECURITY DEFINER` Function Without Ownership Check

**What goes wrong:** Any authenticated user can call `save_meal_plan_bulk` with any `household_id` UUID and insert records for households they don't own.
**Why it happens:** `SECURITY DEFINER` runs as the function owner (postgres), bypassing RLS. The function must replicate the authorization check manually.
**How to avoid:** Add `auth.uid()` check at the top of the function body before any DML (see Pattern 6 above).
**Warning signs:** Penetration test: call the RPC with a valid JWT but another user's household_id — it should return an exception, not a success.

### Pitfall 4: `ai_usage_log` Insert Blocking the Main AI Call

**What goes wrong:** The token logging insert fails (network timeout, RLS, service key missing) and throws an exception, causing the entire AI call to fail.
**Why it happens:** The log insert is awaited in the same try/catch scope as the main AI fetch.
**How to avoid:** Wrap the log insert in its own try/catch that logs the error but does not re-throw:
```typescript
try {
  await serviceClient.from('ai_usage_log').insert({ ... })
} catch (logErr) {
  console.error('[ai-client] Token log insert failed (non-fatal):', logErr)
}
```
**Warning signs:** AI calls fail intermittently with Supabase insert errors even though the LLM response succeeded.

### Pitfall 5: Migration Timestamp Collision

**What goes wrong:** Two migration files with the same timestamp prefix result in one overwriting the other or Supabase refusing to apply them.
**Why it happens:** D-07 requires 5 new migration files. If created in rapid succession, automated tooling may assign the same timestamp.
**How to avoid:** Use incrementing timestamps: `YYYYMMDD000001`, `YYYYMMDD000002`, etc. Or use a single-second gap: `YYYYMMDD000000`, `YYYYMMDD000100`.
**Warning signs:** Supabase CLI error: `duplicate migration version`.

---

## Code Examples

### Migration: Extend `recipes` Table (INFRA-05)

```sql
-- supabase/migrations/YYYYMMDDXXXXXX_extend_recipes.sql
-- Source: Existing migration pattern from 20260414000209_add_recipes_columns.sql

-- Step 1: Add nullable columns first
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS source_provider TEXT;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS is_adapted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS adaptations JSONB;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Step 2: Backfill existing rows (D-09: existing recipes treated as ai-generated)
UPDATE public.recipes SET source_provider = 'ai-generated' WHERE source_provider IS NULL;

-- Step 3: Enforce NOT NULL + CHECK constraint (D-08)
ALTER TABLE public.recipes ALTER COLUMN source_provider SET NOT NULL;
ALTER TABLE public.recipes ADD CONSTRAINT recipes_source_provider_check
  CHECK (source_provider IN ('spoonacular', 'ai-generated'));
```

### Migration: Extend `shopping_list_items` (INFRA-06)

```sql
-- supabase/migrations/YYYYMMDDXXXXXX_extend_shopping_list.sql
ALTER TABLE public.shopping_list_items ADD COLUMN IF NOT EXISTS aisle TEXT;
ALTER TABLE public.shopping_list_items ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE public.shopping_list_items ADD COLUMN IF NOT EXISTS unit TEXT;
```

Column type rationale (planner's discretion — recommended):
- `aisle TEXT` — Spoonacular returns aisle as a free-text string (e.g., "Produce", "Baking")
- `amount NUMERIC` — supports fractional quantities (0.5, 1.25); NUMERIC is exact unlike FLOAT
- `unit TEXT` — free-text unit string (e.g., "cup", "oz", "tbsp")

### Migration: `ai_usage_log` Table (INFRA-02)

```sql
-- supabase/migrations/YYYYMMDDXXXXXX_ai_usage_log.sql
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

-- Index for quota queries (Phase 14/16: "how many tokens today?")
CREATE INDEX IF NOT EXISTS ai_usage_log_household_created_idx
  ON public.ai_usage_log (household_id, created_at);

-- RLS: service-role only (no user-facing RLS policy needed for logging)
-- ai_usage_log is written by service role, read by service role for quota display
-- If future phases expose quota to users, add a SELECT policy then
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
```

**Planner discretion:** Whether to add a user-visible SELECT policy now or in Phase 14/16 when quota display is built. Recommended: defer RLS policy to Phase 14 when the query shape is known. For Phase 13, service-role-only is sufficient.

---

## Runtime State Inventory

> This section is OMITTED — this is a greenfield infrastructure phase, not a rename/refactor. No runtime state audit required.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|---------|
| Supabase CLI | Run migrations, serve functions locally | Yes | 2.84.2 | — |
| Node.js | Frontend tooling | Yes | v24.14.0 | — |
| Deno | Edge Function runtime | Bundled by Supabase | Managed | — |
| PostgreSQL | Migration target | Bundled by Supabase | Managed | — |
| GEMINI_API_KEY / XAI_API_KEY | AI calls in `_shared/ai-client.ts` | Not verified in env | — | Phase 13 never calls AI directly — keys needed in Phase 14+ |

**Note on AI keys:** Phase 13 only defines the shared module. No AI calls happen in this phase. Key availability does not block Phase 13 completion. The shared client will need valid keys when first exercised in Phase 14.

**Missing dependencies with no fallback:** None that block Phase 13.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (vitest + @testing-library/react) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` (runs `vitest run`) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

Phase 13 deliverables are server-side only (Deno modules + SQL migrations). The project's Vitest setup runs in jsdom and cannot import Deno modules or execute SQL. Tests for Edge Function logic require either:
1. Deno-native test runner (`deno test`) — not currently configured in this project
2. Integration tests via Supabase local stack — not currently configured
3. Manual smoke testing against local Supabase (`supabase start` + function invocation)

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | Role map returns correct temperature/max_tokens per role | Manual — Deno module not importable in Vitest/jsdom | N/A | ❌ Wave 0 gap |
| INFRA-02 | Token usage row appears in `ai_usage_log` after AI call | Manual smoke test against local Supabase | N/A | ❌ Wave 0 gap |
| INFRA-03 | Provider resolves from env vars in shared client | Manual — same Deno constraint | N/A | ❌ Wave 0 gap |
| INFRA-04 | `recipe_cache` accepts JSONB insert, GIN index queryable | Manual SQL test or Supabase Studio | N/A | ❌ Wave 0 gap |
| INFRA-05 | `recipes` table has `source_provider`, `source_id`, `image_url` columns | Migration smoke test: `supabase db reset` | N/A | ❌ Wave 0 gap |
| INFRA-06 | `shopping_list_items` has `aisle`, `amount`, `unit` columns | Migration smoke test: `supabase db reset` | N/A | ❌ Wave 0 gap |

### Sampling Rate

- **Per task commit:** `npm test` (existing Vitest suite — confirms no regressions in frontend code)
- **Per wave merge:** `supabase db reset` to verify all migrations apply cleanly in order
- **Phase gate:** All 5 migration files apply without error; `save_meal_plan_bulk` RPC callable from local Supabase; `_shared/ai-client.ts` importable in a test function before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] No Deno test runner configured — INFRA-01/02/03 are manual-only in this phase
- [ ] No migration smoke test script — recommend adding `supabase db reset && supabase db status` to the verify step
- [ ] `supabase/functions/_shared/` directory does not exist yet — must be created in Wave 0 of planning

*(Existing Vitest suite covers frontend code only and will not be broken by Phase 13 changes. All existing tests should remain green.)*

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Duplicated CORS + auth + provider logic in every Edge Function | Single `_shared/` module imported by all functions | Eliminates 4 copies of 60+ lines of boilerplate |
| No token usage tracking | `ai_usage_log` table with service-role inserts | Enables quota display (Phase 14/16) and cost auditing |
| Recipes table with no source tracking | `source_provider`, `source_id`, `is_adapted`, `image_url` columns | Required for grounded recipe display (Phase 14+) |
| Shopping items with only `original_string` + `category` | Added `aisle`, `amount`, `unit` columns | Required for Spoonacular aisle grouping (Phase 16) |
| Client-side multi-step save (multiple round trips) | Single `save_meal_plan_bulk` RPC | Atomic write, single network call, no partial state |

---

## Open Questions

1. **`household_id` in `save_meal_plan_bulk` payload — where does it come from?**
   - What we know: The RPC takes a JSONB payload. The frontend holds the current `household_id` in state.
   - What's unclear: Should the RPC derive `household_id` from `auth.uid()` via a DB lookup (safer) or accept it from the payload (simpler, relies on the ownership check guard)?
   - Recommendation: Accept from payload + validate with `auth.uid()` ownership check inside the function. This matches the existing pattern where all RLS policies join through `households.owner_id = auth.uid()`.

2. **`ai_usage_log.household_id` — nullable or required?**
   - What we know: Not all AI calls have an associated household (e.g., system-level calls). The column is `UUID REFERENCES households(id) ON DELETE SET NULL`.
   - What's unclear: Whether any Phase 13 callers will not have a `household_id`.
   - Recommendation: Make nullable. `_shared/ai-client.ts` callers pass it when available; omit when not.

3. **Migration timestamp format for the 5 new files**
   - What we know: Existing migrations use `YYYYMMDD000000` format.
   - Recommendation: Use `20260417000001` through `20260417000005` for the five new Phase 13 migrations, ensuring they sort after all existing files.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase — `supabase/functions/ai-proxy/index.ts`, `generate-plan/index.ts`, `refresh-slot/index.ts`, all 5 existing migrations — read directly
- Supabase official Edge Functions example repository — `_shared/cors.ts` import pattern confirmed at `github.com/supabase/supabase/blob/master/examples/edge-functions/supabase/functions/_shared/cors.ts`
- PostgreSQL docs — `SECURITY DEFINER` function syntax, PL/pgSQL `FOR...IN` loop, `JSONB` operators

### Secondary (MEDIUM confidence)
- Supabase database functions docs (WebFetch) — `SECURITY DEFINER set search_path = ''` pattern
- Supabase indexing guide — GIN index on JSONB columns, `CREATE INDEX USING GIN`
- WebSearch: Supabase service role key + RLS bypass pattern (multiple community sources, consistent with official docs)

### Tertiary (LOW confidence — needs Phase 14 validation)
- Spoonacular `extendedIngredients[].aisle` field presence — confirmed as a known blocker in STATE.md, not yet verified with live API calls. The `shopping_list_items` extension schema is safe to build now; aisle population is Phase 14's concern.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; everything exists in the codebase
- Architecture: HIGH — `_shared/` pattern confirmed from official Supabase examples; RPC pattern from official docs
- Migration patterns: HIGH — existing migrations in the codebase are the authoritative template
- `save_meal_plan_bulk` RPC logic: MEDIUM — the shape is specified (D-10/D-11/D-12) but the exact PL/pgSQL for iterating nested JSONB slots should be tested locally before finalizing

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (stable domain — Supabase/Postgres APIs rarely change)
