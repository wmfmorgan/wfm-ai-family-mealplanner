# Phase 13: Foundation & Database Migrations - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

All infrastructure for new Edge Functions and recipe data to flow through the system:
shared AI client module, token usage logging, DB schema extensions, recipe cache table,
and bulk save RPC. This phase does not call Spoonacular or implement any generation
logic — it lays the foundation that Phase 14+ will build on.

</domain>

<decisions>
## Implementation Decisions

### Shared AI Client (`_shared/ai-client.ts`)

- **D-01:** Role configs (temperature, max_tokens) use a **hardcoded TypeScript role map** in `_shared/ai-client.ts`. Roles: `coordinator`, `adapter`, `fallback-generator`. Simple, explicit, auditable. New roles require code change.
- **D-02:** Shared module scope is **AI calls + auth verification + CORS headers**. All three are duplicated across existing Edge Functions — extract all into `_shared/` so new functions contain only business logic.
- **D-03:** Provider support: **Gemini + Grok only**. Matches current `ai-proxy`. Ollama support deferred (uses OpenAI-compatible format, trivial to add later).

### Token Logging

- **D-04:** Token usage logged to a **dedicated `ai_usage_log` table** in the database. Columns: `id`, `role`, `provider`, `model`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `created_at`, `edge_function`, `household_id`. Satisfies INFRA-02 — queryable from the database.

### Recipe Cache Table

- **D-05:** Schema: **JSONB + extracted columns**. Store full Spoonacular response as `raw_data JSONB`, plus extracted top-level columns: `spoonacular_id`, `title`, `ready_in_minutes`, `servings`, `image_url`. GIN index on `raw_data`, B-tree indexes on extracted columns.
- **D-06:** TTL: **`created_at` + app-side 30-day check**. No background job. Stale rows cleaned lazily. `pg_cron` deferred (Supabase Pro required — already in REQUIREMENTS deferred list).

### Database Migrations

- **D-07:** **One migration file per concern**: recipe_cache table, recipes ALTER, shopping_list_items ALTER, ai_usage_log table, bulk save RPC function. 5 files. Clean git history, independently reviewable.
- **D-08:** `recipes.source_provider` column: **`TEXT NOT NULL` with CHECK constraint** `source_provider IN ('spoonacular', 'ai-generated')`. Easy to extend. Existing rows backfilled to `'ai-generated'` in the migration.
- **D-09:** Existing recipes are **throwaway** — user does not need to preserve them. Backfill with `'ai-generated'` or truncate as needed. `source_provider` goes NOT NULL from the start, no nullable handling downstream.

### `save_meal_plan_bulk` RPC

- **D-10:** Input: **single JSONB payload** — `{ week_start_date, slots: [{ day, meal_type, recipe: {...}, shopping_items: [...] }] }`. One RPC call, one transaction.
- **D-11:** Return: **`meal_plan_id` UUID only**. Frontend already has full data in draft state.
- **D-12:** Conflict handling (week already has a plan): **error out**. Bulk-save is only called for new drafts. If a plan already exists for the week, surface it as a bug — do not silently overwrite or deduplicate.

### Claude's Discretion

- Specific column names for shopping_list_items extensions (`aisle`, `amount`, `unit`) — schema matches INFRA-06 requirements, exact types TBD by planner.
- Error response shape from the shared AI client — follow existing `ai-proxy` error pattern.
- Whether `ai_usage_log` requires RLS or is service-role only.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` — INFRA-01 through INFRA-06, which are the full scope for this phase

### Roadmap
- `.planning/milestones/v4.0-ROADMAP.md` §Phase 13 — Success criteria (5 items) that define done

### Existing Code to Understand Before Writing
- `supabase/functions/ai-proxy/index.ts` — Current provider routing logic being replaced/abstracted
- `supabase/functions/generate-plan/index.ts` — Current auth/CORS pattern being extracted to _shared/
- `supabase/migrations/20260413000000_meal_planner_core.sql` — Existing `recipes` and `meal_plans` schema being extended
- `supabase/migrations/20260415000000_shopping_list.sql` — Existing `shopping_list_items` schema being extended

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supabase/functions/ai-proxy/index.ts` — Provider routing logic (Gemini/Grok), JSON mode handling, error shaping. This becomes the starting point for `_shared/ai-client.ts`.
- Auth + CORS boilerplate in every Edge Function — extract verbatim into `_shared/` helpers.

### Established Patterns
- All Edge Functions use Deno + `https://deno.land/std@0.168.0/http/server.ts`
- Supabase client created per-request with user's auth header
- OpenAI-compatible API format for both Gemini and Grok
- Migrations use `IF NOT EXISTS` / `IF NOT EXISTS` guards, explicit RLS enable + policies

### Integration Points
- `_shared/ai-client.ts` → imported by `select-meals` (Phase 14), `recipe-search` (Phase 14), `adapt-recipe` (Phase 17)
- `recipe_cache` table → queried by `recipe-search` Edge Function (Phase 14)
- `save_meal_plan_bulk` RPC → called by React frontend on "Save This Plan" (Phase 15)
- `ai_usage_log` table → read by quota display UI (Phase 14/16)

</code_context>

<specifics>
## Specific Ideas

- Existing recipes from the ai-proxy era are throwaway — no need to preserve or migrate them carefully.
- `source_provider` must be NOT NULL from the start to avoid nullable handling in downstream phases.

</specifics>

<deferred>
## Deferred Ideas

- Ollama provider support in shared AI client — uses OpenAI-compatible format, trivial to add later
- `pg_cron` scheduled cache cleanup — requires Supabase Pro (already in REQUIREMENTS.md deferred list as CACHE-03)
- `ai_usage_log` RLS policy decision — planner's call

None from discussion — scope stayed within Phase 13 boundary.

</deferred>

---

*Phase: 13-foundation-database-migrations*
*Context gathered: 2026-04-17*
