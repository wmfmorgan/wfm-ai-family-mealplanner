# Pitfalls Research

**Domain:** Adding Spoonacular-grounded recipes, lazy-save draft workflow, and shared AI client to an existing Supabase Edge Function meal planner
**Researched:** 2026-04-16
**Confidence:** MEDIUM (web search unavailable; based on codebase analysis + training data on Spoonacular, Supabase Edge Functions, and Deno)

## Critical Pitfalls

### Pitfall 1: Spoonacular Quota Exhaustion During Development

**What goes wrong:**
The free tier gives 150 "points" per day (not 150 calls -- different endpoints cost different point amounts). `complexSearch` costs 1 point per result, but `getRecipeInformation` costs 1 point per call, and `getRecipeBulkInformation` costs the same. A single meal plan generation touching 21 slots (7 days x 3 meals) with fallback retries can consume 40-80 points in one user action. Two or three test runs during development burns the entire daily quota.

**Why it happens:**
Developers treat the quota as "150 API calls" when it is actually a points-based system. Complex endpoints (nutrition, wine pairing) cost 3-10 points each. Search with `addRecipeInformation=true` costs significantly more than search alone. No circuit breaker means retries multiply the burn rate.

**How to avoid:**
- Cache aggressively in `recipe_cache` table from day one -- never call Spoonacular for a recipe you have seen before.
- Use `complexSearch` without `addRecipeInformation` (1 point), then batch-fetch details only for recipes the user actually keeps after draft review (lazy detail fetching).
- Implement a daily quota counter in the DB (`spoonacular_quota` table with date + points_used). Reject calls at 120 points and force AI-generated fallback for the remaining 30-point buffer.
- During development, seed `recipe_cache` with a fixture dump of 50-100 recipes so most dev flows hit cache.

**Warning signs:**
- 402 Payment Required responses from Spoonacular.
- `recipe-search` Edge Function starts returning fallback AI recipes during afternoon development sessions.
- Developers adding `addRecipeInformation=true` or `addRecipeNutrition=true` to search calls without realizing the point cost.

**Phase to address:**
Phase 1 (Shared AI Client + Recipe Search). The quota counter and cache-first architecture must exist before any Spoonacular calls are made.

---

### Pitfall 2: Fallback AI Path Inherits All Current Problems

**What goes wrong:**
When Spoonacular quota is exhausted or returns no results, the system falls back to AI-generated recipes. But the current `generate-plan` and `refresh-slot` functions have no temperature control, no max_tokens enforcement, no structured output validation, and no allergy checking. The fallback path silently produces the same low-quality, potentially dangerous (allergy-violating) output that the v4.0 overhaul is supposed to fix.

**Why it happens:**
The fallback path is treated as "just use the old code" rather than routing through the new shared AI client. Looking at `generate-plan/index.ts` lines 76-119: the `callAI` helper has no temperature parameter, no max_tokens, and the JSON response is only validated by `JSON.parse` (structural) not by schema (semantic). The allergy data in `members` is passed in the prompt but never programmatically verified against the AI output.

**How to avoid:**
- The shared `_shared/ai-client.ts` must be the ONLY path for LLM calls from the start. Both Spoonacular-backed and AI-fallback flows route through it.
- The AI client enforces role-based configs: `{ role: 'coordinator', temperature: 0.3, max_tokens: 2000 }` vs `{ role: 'recipe-generator', temperature: 0.7, max_tokens: 4000 }`.
- The post-assembly allergy scan runs on ALL recipes regardless of source (Spoonacular or AI-generated).
- AI-generated recipes get `source_provider: 'ai-generated'` and a UI warning badge from the moment they enter the draft.

**Warning signs:**
- Any Edge Function that calls an LLM API directly instead of through `_shared/ai-client.ts`.
- AI-generated fallback recipes missing the `source_provider` flag.
- Allergy scan only running on Spoonacular recipes.

**Phase to address:**
Phase 1 (Shared AI Client). The client must exist and be mandatory before recipe-search or adapt-recipe functions are built.

---

### Pitfall 3: Lazy-Save Draft State Lost on Navigation or Refresh

**What goes wrong:**
The current `MealPlanner.tsx` stores the generated plan in `planData` React state (line 18). After generation, it immediately calls `saveMealPlan` (line 285). The v4.0 design changes this to: generate -> hold in React state as draft -> user explicitly saves. But React state is lost on page refresh, browser back button, accidental navigation, or session timeout. A user who spent 10 minutes reviewing and tweaking a 21-meal draft loses everything.

**Why it happens:**
Developers implement "draft in state" literally -- `useState` only. They plan to "add localStorage later" but the feature ships without it because the happy path works in testing (no one refreshes mid-draft during a demo).

**How to avoid:**
- Implement localStorage backup from the start, not as a follow-up. On every draft mutation, serialize to `localStorage` with key `draft:{householdId}:{weekStartDate}`.
- On MealPlanner mount, check for a stale draft and prompt: "You have an unsaved meal plan from [time]. Restore or discard?"
- Add `beforeunload` event listener when draft is dirty: `window.addEventListener('beforeunload', e => { e.preventDefault(); })`.
- Set a TTL on localStorage drafts (24 hours). Stale drafts older than TTL auto-discard.

**Warning signs:**
- No `useEffect` cleanup or `beforeunload` handler in the MealPlanner component.
- No localStorage read on component mount.
- Draft state only living in a single `useState` call.

**Phase to address:**
Phase 2 or 3 (Lazy-Save workflow). Must be implemented in the same phase as the draft workflow, not deferred.

---

### Pitfall 4: Substring Allergy Matching Causes False Positives and Misses

**What goes wrong:**
The milestone context notes "corn" matches "cornstarch" as a known risk. But the problem is bidirectional: substring matching also MISSES allergies. "tree nut" won't match "almond" or "cashew". "Shellfish" won't match "shrimp". "Dairy" won't match "casein" or "whey". The allergy system looks functional in testing (common cases work) but fails on real dietary restrictions.

**Why it happens:**
Developers implement `ingredient.toLowerCase().includes(allergen.toLowerCase())` because it's simple and works for the demo. Real allergy matching requires an allergen-to-ingredient mapping (e.g., "tree nut" -> ["almond", "walnut", "cashew", "pecan", "pistachio", "macadamia", "brazil nut"]).

**How to avoid:**
- Build an allergen taxonomy: a static map of allergen categories to specific ingredient strings.
- Use Spoonacular's built-in `intolerances` parameter on `complexSearch` as the first line of defense (filter at the API level, not post-hoc).
- The post-assembly programmatic scan should use the taxonomy, not substring matching.
- For AI-generated fallback recipes, include the full allergen taxonomy in the system prompt AND verify programmatically after generation.

**Warning signs:**
- Any `includes()` or `indexOf()` call used for allergy matching.
- Allergy test cases only covering exact-match scenarios ("peanut" in "peanut butter") not category scenarios ("tree nut" should flag "almond flour").
- No use of Spoonacular's `intolerances` or `excludeIngredients` parameters.

**Phase to address:**
Phase 2 (Recipe Search + Adapt). The allergy taxonomy must exist before `adapt-recipe` is built, because adaptation needs to know what to substitute.

---

### Pitfall 5: Provider Resolution Logic Duplicated Across Every Edge Function

**What goes wrong:**
Currently, `generate-plan/index.ts` (lines 51-63), `refresh-slot/index.ts` (lines 30-44), and `ai-proxy/index.ts` (lines 78-91) each independently implement provider resolution (check env vars, fallback logic, API URL construction, model defaults). Adding `select-meals`, `recipe-search`, and `adapt-recipe` functions means 6+ copies of this logic. A provider change (e.g., adding Claude, updating a model name) requires editing every function and hoping none are missed.

**Why it happens:**
Supabase Edge Functions historically had no `_shared` directory support. Developers copy-paste the provider logic because "it's only 15 lines." By the time a shared module is considered, there are already 4+ diverged copies.

**How to avoid:**
- The `_shared/ai-client.ts` is the FIRST thing built. It owns provider resolution, API URL construction, model defaults, temperature, and max_tokens.
- Existing functions (`generate-plan`, `refresh-slot`, `ai-proxy`) are migrated to use `_shared/ai-client.ts` in the same phase -- do not leave old functions with inline provider logic "to migrate later."
- Use Supabase's import map (`supabase/functions/import_map.json`) or relative imports to `../_shared/ai-client.ts`.

**Warning signs:**
- Any new Edge Function that has `Deno.env.get('GEMINI_API_KEY')` or `Deno.env.get('XAI_API_KEY')` directly in its index.ts.
- Provider resolution logic appearing in a PR diff for a non-ai-client file.

**Phase to address:**
Phase 1 (Shared AI Client). The shared module must exist before any new Edge Functions are created.

---

### Pitfall 6: N+1 Recipe Saves Replaced with Bulk Insert That Lacks Atomicity

**What goes wrong:**
The current `saveMealPlan` in `planner.ts` (lines 82-100) saves recipes one-by-one in a for loop (N+1 pattern). The v4.0 plan replaces this with bulk inserts. But Supabase's JS client does not support multi-table transactions. If the bulk recipe insert succeeds but the slot insert fails, you have orphaned recipes. If the meal_plan upsert succeeds but recipes fail, you have an empty plan. The delete-then-insert pattern for slots (lines 118-125) already has a race window where a page refresh shows an empty plan.

**Why it happens:**
Developers assume `await supabase.from('recipes').insert(recipes)` followed by `await supabase.from('meal_plan_slots').insert(slots)` is atomic because they are sequential. It is not -- each is a separate HTTP request. The comment on line 68 even acknowledges this: "Uses sequential calls as the standard Supabase client doesn't support multi-table transactions."

**How to avoid:**
- Wrap the entire save operation in a Postgres function (`rpc('save_meal_plan', { ... })`) that runs in a single transaction. This is the only way to get atomicity with Supabase.
- The RPC function should: (1) upsert meal_plan, (2) bulk insert recipes, (3) delete old slots for affected meal types, (4) insert new slots with recipe IDs -- all in one transaction with a ROLLBACK on any failure.
- Until the RPC is built, at minimum: never delete old slots before confirming new data is ready. Use a "swap" pattern: insert new slots with a temp flag, then delete old ones, then clear the flag.

**Warning signs:**
- Save operation spread across multiple independent Supabase client calls without an RPC wrapper.
- Any delete-then-insert pattern without a transaction boundary.
- Users reporting "my plan disappeared" or seeing partial plans.

**Phase to address:**
Phase 3 (Lazy-Save + Bulk Save). The RPC function should be part of the save implementation, not added retroactively.

---

### Pitfall 7: Spoonacular Data Shape Inconsistency Breaks Frontend

**What goes wrong:**
Spoonacular's recipe objects have inconsistent fields. `extendedIngredients` can be null, empty, or contain items where `amount` is 0 or `unit` is empty string. `analyzedInstructions` can be an empty array even when `instructions` (HTML string) exists. `servings` can be 0. `readyInMinutes` can be null. Nutrition data is only present if you paid extra points to request it. The frontend, expecting the shape it gets from AI-generated recipes, crashes on null access or renders garbage.

**Why it happens:**
Developers build the frontend against a few sample Spoonacular responses that happen to be well-formed. They don't encounter the edge cases until production because the test recipes are popular ones with complete data. Less popular recipes (exactly the kind a "variety" algorithm might select) have worse data quality.

**How to avoid:**
- Define a strict internal `CachedRecipe` type that normalizes Spoonacular data on ingest. The `recipe-search` Edge Function transforms Spoonacular responses into this canonical shape before caching.
- Default every nullable field: `servings: recipe.servings || 4`, `prepTime: recipe.readyInMinutes || 0`, `ingredients: (recipe.extendedIngredients || []).filter(i => i.name)`.
- If `analyzedInstructions` is empty but `instructions` (HTML) exists, parse the HTML into steps. If both are empty, flag the recipe as `incomplete: true` and either skip it or send it through `adapt-recipe` for AI-generated instructions.
- Write a validation function that rejects recipes missing name, or having zero ingredients, before they enter the cache.

**Warning signs:**
- Frontend components accessing nested Spoonacular fields without optional chaining (`recipe.nutrition.nutrients[0].amount` instead of `recipe.nutrition?.nutrients?.[0]?.amount`).
- No transformation layer between Spoonacular API response and `recipe_cache` insert.
- Tests using hand-crafted mock data that is cleaner than real Spoonacular responses.

**Phase to address:**
Phase 2 (Recipe Search). The normalization layer is part of the `recipe-search` Edge Function, built before the frontend consumes cached recipes.

---

### Pitfall 8: Deno Edge Function _shared Module Cold Start Amplification

**What goes wrong:**
Supabase Edge Functions run on Deno Deploy. Each function has independent cold starts. When `select-meals` imports `_shared/ai-client.ts` which imports `_shared/provider-config.ts` which imports `_shared/types.ts`, the cold start has to resolve and compile the entire dependency tree. If `_shared/ai-client.ts` also imports a large library (like a JSON schema validator), every function that imports the shared client pays that cold start cost.

**Why it happens:**
Shared modules seem free -- "it's just an import." But in a serverless Deno environment, imports are not cached across function invocations after idle periods. Each cold start re-fetches remote dependencies (from `esm.sh`, `deno.land`). A shared module that seems lightweight on disk can pull in heavy transitive dependencies.

**How to avoid:**
- Keep `_shared/ai-client.ts` lean. No heavy validation libraries -- use lightweight hand-written type guards.
- Pin all dependency versions in an import map (not inline URL versions) so Deno can cache effectively.
- Avoid deep import chains: `_shared/ai-client.ts` should be self-contained or import from at most one other `_shared` file.
- Use `Deno.env.get` directly rather than importing a config-parsing library.
- Measure cold start times before and after adding shared imports. Target < 500ms cold start.

**Warning signs:**
- Edge Function response times spiking to 2-5 seconds after idle periods.
- Import chains more than 2 levels deep in `_shared/`.
- Remote URL imports (esm.sh, deno.land) inside `_shared/` modules -- these add network latency to cold starts.

**Phase to address:**
Phase 1 (Shared AI Client). Architecture of `_shared/` must account for cold start from the start.

---

### Pitfall 9: Race Condition in Concurrent Tab Edits of Draft Plans

**What goes wrong:**
User opens the meal planner in two tabs (common on desktop -- one for this week, one for next week, or same week in two tabs). Both tabs load the same draft from localStorage. User edits Tab A (swaps a dinner), then edits Tab B (swaps a lunch). Tab B's localStorage write overwrites Tab A's changes because localStorage has no merge strategy -- it's last-write-wins on the entire draft object.

**Why it happens:**
localStorage is synchronous and global to the origin. There is no locking mechanism. Developers test in a single tab and never encounter the conflict.

**How to avoid:**
- Scope localStorage keys to include a tab session ID: `draft:{householdId}:{weekStartDate}:{tabId}`. On save, merge from all tab drafts or warn "this plan was modified in another tab."
- Simpler approach: use a `storage` event listener (`window.addEventListener('storage', ...)`) to detect cross-tab writes and prompt the user to reload.
- Simplest approach: on draft modification, write a version counter alongside the data. On save, check if the version matches what was loaded. If not, show a conflict resolution UI.
- For v4.0 scope, the simplest-approach (version counter) is sufficient. Full multi-tab merge is over-engineering for a family meal planner.

**Warning signs:**
- No `storage` event listener in the MealPlanner component.
- localStorage writes that serialize the entire plan object rather than patching individual slots.
- No version or timestamp in the localStorage draft structure.

**Phase to address:**
Phase 3 (Lazy-Save). Implement the version counter alongside the localStorage backup.

---

### Pitfall 10: JSONB Recipe Cache Queries Degrade Without Proper Indexing

**What goes wrong:**
The `recipe_cache` table stores Spoonacular recipe data as JSONB. Queries like "find cached recipes matching diet=vegetarian AND maxReadyTime<=30 AND excludeIngredients NOT containing peanut" require scanning the JSONB column. Without GIN indexes, these queries do a full table scan. At 1,000+ cached recipes, search latency exceeds the Edge Function timeout (default 10 seconds for Supabase functions).

**Why it happens:**
JSONB in Postgres is flexible and easy to start with. Developers add data, queries work fine at 50 rows, then degrade silently as the cache grows. By the time it is noticed, the cache table has thousands of rows and restructuring requires a migration.

**How to avoid:**
- Extract frequently-queried fields into proper columns on `recipe_cache`: `spoonacular_id INTEGER UNIQUE`, `diet TEXT[]`, `ready_in_minutes INTEGER`, `cuisine TEXT[]`, `is_vegetarian BOOLEAN`, `is_vegan BOOLEAN`, `is_gluten_free BOOLEAN`. Store the full Spoonacular response in a `raw_data JSONB` column for detail views.
- Add a GIN index on any array columns: `CREATE INDEX idx_recipe_cache_diet ON recipe_cache USING GIN (diet)`.
- Add a B-tree index on `spoonacular_id` for deduplication lookups.
- Add `cached_at TIMESTAMPTZ` with an index for cache invalidation queries.

**Warning signs:**
- `recipe_cache` table with only `id` and `data JSONB` columns.
- Search queries using `data->>'vegetarian'` or `data @> '{"vegetarian": true}'` without a GIN index.
- Edge Function timeouts on recipe search after a few weeks of use.

**Phase to address:**
Phase 2 (Recipe Search). The `recipe_cache` table schema must be designed with proper columns and indexes from the migration that creates it.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keeping `ai-proxy` function alongside new shared client | No migration risk to existing Settings/Debug page | Two code paths for LLM calls; provider changes need two updates | Only during the transition phase; must be deprecated within the same milestone |
| Storing full Spoonacular response in JSONB without normalization | Fast to implement cache; no schema design needed | Query performance degrades; frontend must handle inconsistent shapes | Never -- normalization layer is cheap and prevents cascading problems |
| Skipping the save RPC and using sequential client calls | No Postgres function to write/maintain | Partial saves, orphaned recipes, race conditions on delete-then-insert | Only if the app is single-user with no concurrent access (it is, but the delete-insert window is still dangerous) |
| Hard-coding allergen list instead of building taxonomy | Covers the 8 major allergens quickly | Misses regional allergens, compound ingredients, derivative forms | Acceptable for MVP if the hard-coded list is comprehensive (50+ entries, not just 8 category names) |
| Using `localStorage` only (no server-side draft) | No new API endpoints or DB table needed | Draft lost if user switches devices or clears browser data | Acceptable for v4.0 -- server-side drafts are a v5.0 concern for a single-user family app |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Spoonacular `complexSearch` | Using `addRecipeInformation=true` on every search (costs 1 extra point per result) | Search first with minimal fields, then fetch details only for selected recipes |
| Spoonacular `complexSearch` | Assuming `number` parameter returns exactly that many results | Spoonacular may return fewer results than requested if filters are strict; always check `totalResults` and handle < expected |
| Spoonacular `intolerances` param | Passing allergy names that don't match Spoonacular's enum (e.g., "tree nut" vs "tree_nut") | Use exact Spoonacular intolerance strings: `dairy`, `egg`, `gluten`, `grain`, `peanut`, `seafood`, `sesame`, `shellfish`, `soy`, `sulfite`, `tree_nut`, `wheat` |
| Spoonacular recipe IDs | Treating IDs as stable forever | Spoonacular occasionally removes recipes; cache lookup should handle 404 on detail fetch gracefully by evicting the cache entry |
| Supabase Edge Function `_shared/` | Importing with wrong path (`./shared/` or `@shared/` instead of `../_shared/`) | Use relative path `import { x } from '../_shared/ai-client.ts'` -- Supabase deploys each function from its own directory |
| Supabase Edge Function CORS | Each new function re-implements CORS headers | Move CORS to `_shared/cors.ts` and import; one bug fix updates all functions |
| Supabase Edge Function auth | Each function independently validates JWT (currently 10+ lines per function) | Move auth to `_shared/auth.ts` -- returns `{ user, supabase }` or throws 401 |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Calling Spoonacular for every slot refresh | 3-second latency per refresh; quota burns at 7+ points per refresh | Check cache first; only call API if cache miss | Immediately on free tier (150 points/day) |
| Full plan serialization to localStorage on every slot edit | UI jank on low-end devices (50ms+ JSON.stringify for large plans) | Debounce localStorage writes (500ms); only serialize changed slots | At 21+ slots with full recipe detail objects |
| Sequential recipe saves in `saveMealPlan` | 2-3 second save time (21 recipes x 100ms each) | Bulk insert via RPC or `supabase.from('recipes').insert(allRecipes)` (single call) | Immediately noticeable -- current code already has this problem |
| Unindexed `recipe_cache` JSONB queries | Search latency grows linearly with cache size | Proper column extraction + indexes (see Pitfall 10) | At 500+ cached recipes (a few weeks of active use) |
| Loading full recipe objects into planner grid state | Memory bloat; 21 full recipe objects with ingredients/instructions in React state | Grid state holds only `{ id, name, source_provider }` per slot; full recipe loaded on-demand for RecipeDetail | At 100+ total recipes in state (multiple weeks browsed) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing Spoonacular API key to the frontend | Key theft; quota exhaustion by third parties | All Spoonacular calls go through Edge Functions; key is only in Supabase secrets |
| Not validating Spoonacular response before caching | Stored XSS if recipe names/instructions contain HTML and are rendered with `dangerouslySetInnerHTML` | Sanitize all string fields on cache ingest; never render raw HTML from external APIs |
| AI-generated recipes containing allergens for the household | Health risk to users with food allergies | Post-assembly programmatic allergy scan is mandatory, not optional; block save if scan fails |
| Draft plans in localStorage readable by any same-origin script | If a third-party script (analytics, CDN compromise) reads localStorage, it sees dietary/allergy data | Low risk for this app (no PII beyond food preferences), but avoid storing member names or health data in the draft -- store IDs only |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visual distinction between Spoonacular-sourced and AI-generated recipes | User trusts AI-generated recipe nutritional claims equally | Show source badge: "Verified Recipe" (Spoonacular) vs "AI-Generated" with a subtle warning |
| Draft auto-saves silently | User thinks changes are saved to DB; navigates away; returns to find old saved version | Show explicit "Unsaved draft" indicator with a "Save Plan" button; flash/pulse when draft has unsaved changes |
| Spoonacular quota exhausted with no user feedback | All recipes suddenly become AI-generated without explanation | Show a non-blocking banner: "Recipe database quota reached for today. Some recipes are AI-generated." |
| Long save operation (bulk insert) with no progress indicator | User clicks Save, nothing happens for 2-3 seconds, clicks again (double save) | Disable Save button immediately; show saving indicator; debounce/lock the save action |
| Stale draft restoration without context | User opens app, gets prompted to restore a draft from 3 days ago, restores it, overwrites this week's saved plan | Show draft date/time prominently in restore prompt; if draft is for a different week, make it very clear |

## "Looks Done But Isn't" Checklist

- [ ] **Recipe Search:** Often missing cache-miss handling -- verify what happens when Spoonacular returns 0 results (empty array, not an error)
- [ ] **Recipe Search:** Often missing pagination -- verify behavior when `totalResults > number` (need to either increase `number` or make multiple calls)
- [ ] **Allergy Scan:** Often missing derivative ingredients -- verify "dairy" catches "casein", "whey", "lactose", not just "milk" and "cheese"
- [ ] **Allergy Scan:** Often missing compound ingredients -- verify "contains: milk, soy" in an ingredient description is caught
- [ ] **Lazy-Save:** Often missing the "discard draft" action -- verify user can explicitly abandon a draft and revert to the last saved plan
- [ ] **Lazy-Save:** Often missing the "dirty state" tracking -- verify the Save button is disabled when draft matches saved state (no false "unsaved changes" warnings)
- [ ] **Shared AI Client:** Often missing error categorization -- verify the client distinguishes between retryable errors (429, 503) and permanent errors (400, 401) and only retries the former
- [ ] **Adapt-Recipe:** Often missing serving scale validation -- verify that scaling from 4 to 2 servings halves ingredient amounts correctly (not just changing the servings number)
- [ ] **Shopping List:** Often missing deduplication -- verify "2 cups chicken broth" from dinner + "1 cup chicken broth" from lunch = "3 cups chicken broth", not two separate items
- [ ] **Migration:** Often missing the `ai-proxy` deprecation path -- verify no frontend code still calls `ai-proxy` directly after new functions are deployed

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Spoonacular quota exhaustion | LOW | Graceful fallback to AI-generated recipes already planned; just ensure the fallback path works and is flagged in UI |
| Draft state lost on refresh | MEDIUM | If no localStorage backup exists yet: add it. If data is already lost: user regenerates (annoying but not catastrophic for a family app) |
| Partial save (recipes saved, slots failed) | HIGH | Requires DB cleanup: identify orphaned recipes by `created_at` window; retroactively add the save RPC function; run a data repair migration |
| Allergy violation in generated plan | HIGH | Immediate: add post-assembly scan that blocks save. Retroactive: query all saved recipes against allergen taxonomy; flag/remove violating recipes; notify user |
| Provider duplication divergence | MEDIUM | Audit all Edge Functions for inline provider logic; extract to `_shared/`; redeploy all functions. Tedious but not technically hard |
| JSONB query performance degradation | MEDIUM | Add migration to extract columns from JSONB; backfill from existing data; add indexes; update queries. No data loss, but requires downtime-aware migration |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Spoonacular quota exhaustion | Phase 1 (cache + quota counter) | Verify quota counter exists and fallback triggers at threshold |
| Fallback AI path quality | Phase 1 (shared AI client) | Verify no Edge Function calls LLM API directly; all go through `_shared/ai-client.ts` |
| Draft state lost on refresh | Phase 3 (lazy-save) | Verify localStorage read on mount; `beforeunload` handler present; restore prompt works |
| Substring allergy matching | Phase 2 (recipe search + adapt) | Verify allergen taxonomy covers 50+ ingredients; test with "tree nut" -> "almond" case |
| Provider resolution duplication | Phase 1 (shared AI client) | Verify `generate-plan` and `refresh-slot` are migrated; grep for `GEMINI_API_KEY` outside `_shared/` |
| Bulk save atomicity | Phase 3 (lazy-save + save) | Verify save uses RPC function; test by killing network mid-save |
| Spoonacular data inconsistency | Phase 2 (recipe search) | Verify normalization layer exists; test with a recipe that has null `extendedIngredients` |
| _shared module cold start | Phase 1 (shared AI client) | Measure cold start before/after; verify < 500ms; no heavy library imports in `_shared/` |
| Concurrent tab draft conflict | Phase 3 (lazy-save) | Verify `storage` event listener or version counter exists; test with two-tab edit scenario |
| JSONB cache query performance | Phase 2 (recipe search) | Verify `recipe_cache` has extracted columns and GIN/B-tree indexes in migration |

## Sources

- Codebase analysis of `/supabase/functions/ai-proxy/index.ts`, `/supabase/functions/generate-plan/index.ts`, `/supabase/functions/refresh-slot/index.ts`
- Codebase analysis of `/src/lib/services/planner.ts` (save flow, N+1 pattern)
- Codebase analysis of `/src/pages/MealPlanner/MealPlanner.tsx` (state management, save trigger)
- Codebase analysis of `/supabase/migrations/20260413000000_meal_planner_core.sql` (schema structure)
- Spoonacular API documentation (training data -- LOW confidence on exact point costs; verify against current docs)
- Supabase Edge Functions documentation (training data -- MEDIUM confidence on `_shared/` import patterns)
- General Deno Deploy cold start behavior (training data -- MEDIUM confidence)
- localStorage concurrency behavior (HIGH confidence -- well-documented web platform behavior)
- Postgres JSONB indexing patterns (HIGH confidence -- stable, well-documented)

---
*Pitfalls research for: Spoonacular + lazy-save + shared AI client integration into existing Supabase Edge Function meal planner*
*Researched: 2026-04-16*
