# Phase 14: Spoonacular Integration & AI Coordinator - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Two new Edge Functions replace the current `generate-plan` flow:
- `select-meals` — AI coordinator that outputs search directives (not recipes)
- `recipe-search` — Spoonacular lookup with cache-first strategy, quota tracking, and fallback

Result: users receive real Spoonacular recipes grounded in verified nutrition/ingredient/aisle data.
This phase does NOT implement the lazy-save draft workflow (Phase 15) or RecipeDetail UI changes (Phase 16).

</domain>

<decisions>
## Implementation Decisions

### Invocation Pattern

- **D-01:** Frontend orchestrates both Edge Functions. Call sequence: `select-meals` → receives directives → sends all directives in one batched call to `recipe-search` → receives full week of recipes. No server-to-server Deno-to-Deno calls.
- **D-02:** `recipe-search` accepts all directives in a single request and returns the full assembled week array. One Supabase Edge Function invocation per generation run (not one per slot).

### Partial Generation (SEARCH-03)

- **D-03:** User configures partial generation in Settings as a persistent household-level preference. Two dimensions: which meal types (breakfast / lunch / dinner) and which days of the week. 2D selection matrix.
- **D-04:** Extends the existing `selected_meals` pattern already present in `generate-plan` payload. Add day selection alongside meal type selection.

### Quota Tracking (SEARCH-04)

- **D-05:** Spoonacular API calls are logged to a DB table (modeled after `ai_usage_log` from INFRA-02). Each row: points consumed + timestamp + household_id. Daily quota status computed by querying today's rows.
- **D-06:** Quota status (current pts / 150 pts today) is displayed in Settings / AI debug page only — not in the planner header. No new planner UI component needed.
- **D-07:** Fallback to AI generation triggers automatically when Spoonacular quota ≥ 80% (SEARCH-05). Fallback recipes labeled `source_provider: 'ai-generated'` in data (UI treatment deferred to Phase 16).

### Allergen Taxonomy (SAFE-05)

- **D-08:** Allergen taxonomy lives in `_shared/allergen-taxonomy.ts` as a hardcoded TypeScript map: `{ 'tree nuts': ['almond', 'cashew', 'walnut', ...], ... }`. Git-versioned. Zero DB queries. Update = deploy. No DB lookup table.

### Claude's Discretion

- Exact Spoonacular API endpoints and query parameter mapping
- How many candidate recipes `recipe-search` fetches per directive before selecting (e.g., fetch 3, pick best match)
- Schema for the Spoonacular quota log table
- Zero-results handling: if Spoonacular returns nothing for a directive, fallback to AI for that slot
- select-meals coordinator system prompt design (role: `coordinator`, max_tokens: 1024 from ROLE_CONFIG)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` — SEARCH-01 through SEARCH-05, SAFE-05 (full scope for this phase)

### Roadmap
- `.planning/milestones/v4.0-ROADMAP.md` §Phase 14 — Success criteria (5 items) that define done

### Foundation (Phase 13 outputs — must be understood before writing Phase 14 code)
- `supabase/functions/_shared/ai-client.ts` — Shared AI client; `select-meals` imports this for coordinator call
- `supabase/functions/_shared/auth.ts` — Auth helper; all new Edge Functions import this
- `supabase/functions/_shared/cors.ts` — CORS helper; all new Edge Functions import this
- `supabase/migrations/20260417000001_recipe_cache.sql` — recipe_cache schema (JSONB + GIN index, 30-day TTL)
- `supabase/migrations/20260417000005_bulk_save_rpc.sql` — save_meal_plan_bulk RPC (consumed in Phase 15)

### Existing Functions Being Replaced
- `supabase/functions/generate-plan/index.ts` — Current generation flow; `selected_meals` pattern to extend for D-03/D-04
- `supabase/functions/ai-proxy/index.ts` — Provider routing being deprecated (Phase 17 cleanup, but understand it now)

### Existing Schema
- `supabase/migrations/20260417000002_extend_recipes.sql` — source_provider, source_id, image_url columns
- `supabase/migrations/20260417000003_extend_shopping_list.sql` — aisle, amount, unit columns
- `supabase/migrations/20260417000004_ai_usage_log.sql` — logging pattern to replicate for quota table

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_shared/ai-client.ts` → `callAI({ role: 'coordinator', ... })` — use for select-meals LLM call
- `_shared/auth.ts`, `_shared/cors.ts` — import verbatim into both new Edge Functions
- `generate-plan/index.ts` `selected_meals` payload field — extend to 2D (meal types × days) for D-03/D-04
- `ai_usage_log` table + insert pattern — replicate for Spoonacular quota log table

### Established Patterns
- All Edge Functions: Deno + `https://deno.land/std@0.168.0/http/server.ts`
- Supabase client created per-request with user's auth header
- Non-fatal try/catch around logging (never block the main call)
- JSON response with explicit CORS headers

### Integration Points
- `select-meals` → imports `_shared/ai-client.ts`, `_shared/auth.ts`, `_shared/cors.ts`
- `recipe-search` → queries `recipe_cache` table; hits Spoonacular API on cache miss; writes quota log
- `_shared/allergen-taxonomy.ts` → imported by `recipe-search` for SAFE-05 exclusion filtering
- Frontend → calls `select-meals` then `recipe-search` in sequence (D-01)
- Phase 15 will consume the recipe array returned by `recipe-search` as the draft state

</code_context>

<specifics>
## Specific Ideas

- Partial generation is a 2D matrix in Settings: rows = meal types (B/L/D), columns = days of week. User toggles cells. Persisted per household.
- Quota tracking reuses the `ai_usage_log` insert pattern exactly — non-fatal try/catch, service client, timestamp-based daily query.
- Fallback label `source_provider: 'ai-generated'` must be set in data at recipe-search time so Phase 16 UI can render it correctly.

</specifics>

<deferred>
## Deferred Ideas

- RecipeDetail UI changes for grounded vs AI-generated recipes — Phase 16
- Lazy-save draft workflow — Phase 15
- AI Adapter for allergen substitutions — Phase 17
- `ai-proxy` deprecation / cleanup — Phase 17
- Edamam provider integration — future milestone (PROV-01 in REQUIREMENTS.md)
- Streaming recipe results — future milestone (CACHE-02)

None from discussion — scope stayed within Phase 14 boundary.

</deferred>

---

*Phase: 14-spoonacular-integration-ai-coordinator*
*Context gathered: 2026-04-17*
