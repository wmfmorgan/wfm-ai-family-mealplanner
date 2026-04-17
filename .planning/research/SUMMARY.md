# Project Research Summary

**Project:** WFM AI Family Meal Planner -- v4.0 Grounded Recipe Architecture
**Domain:** AI-powered family meal planning with external recipe API integration
**Researched:** 2026-04-16
**Confidence:** MEDIUM

## Executive Summary

This milestone transforms the meal planner from generating AI-invented recipes to using real, verified recipes from the Spoonacular API while retaining AI as a strategic meal-planning coordinator. The core architectural shift is: the AI decides *what to search for* (cuisine themes, protein rotation, dietary constraints) and Spoonacular provides *real recipes* with verified nutrition, ingredients, and grocery aisle categorization. This eliminates hallucinated recipes, replaces the LLM-based ingredient categorizer with deterministic aisle data, and introduces a lazy-save draft workflow so users review plans before committing to the database.

The recommended approach builds on the existing Supabase Edge Function and React stack with zero new frontend dependencies. All Spoonacular integration lives in server-side Edge Functions. A new `_shared/` module layer consolidates duplicated AI provider logic (currently copy-pasted across 3 functions) into a single shared client with role-based temperature and token controls. The frontend orchestrates a multi-step flow (AI coordinator -> Spoonacular search -> optional adaptation -> draft state -> explicit save) with progress indicators at each step. Draft state lives in React context with localStorage backup, and a PostgreSQL RPC function provides atomic bulk saves.

The primary risks are: Spoonacular API quota exhaustion (150 points/day free tier, a single plan generation costs 40+ points without caching), draft state loss on page refresh if localStorage backup is skipped, partial database saves without transactional RPC, and allergy-matching failures from naive substring checks. All of these are preventable with the patterns identified in research -- aggressive caching from day one, localStorage backup built alongside draft state (not deferred), a Postgres RPC for atomic saves, and an allergen taxonomy that maps categories to specific ingredients.

## Key Findings

### Recommended Stack

No new frontend npm packages are needed. The entire Spoonacular integration lives in Deno Edge Functions using native `fetch`. The existing React 18 + Vite + Supabase stack remains unchanged on the client side.

**Core additions:**
- **Spoonacular API v1 (REST):** Recipe search, nutrition data, ingredient aisle categorization -- replaces AI-invented recipes and LLM-based ingredient categorizer entirely
- **Supabase `_shared/` modules (Deno):** Shared AI client, CORS helpers, auth validation -- eliminates provider logic duplication across 3+ Edge Functions
- **PostgreSQL JSONB + GIN indexes:** `recipe_cache` table for Spoonacular response caching -- mandatory for quota management (not optional)
- **React `useReducer` / Context:** Draft meal plan state management -- no state library needed for page-local draft lifecycle

### Expected Features

**Must have (table stakes for v4.0):**
- Spoonacular `complexSearch` with diet, intolerance, cuisine, calorie, and time filters
- Full recipe detail fetch with nutrition and aisle data
- Recipe cache with 7-30 day TTL (quota survival depends on this)
- AI Coordinator rearchitected to output search directives, not recipes
- Lazy-save draft workflow (generate -> review -> explicit save)
- Bulk save via PostgreSQL RPC (replaces N+1 insert loop)
- Source attribution in UI ("Verified Recipe" vs "AI-Generated")
- Aisle-based shopping list replacing `categorize-ingredients` Edge Function
- AI-generated fallback with explicit labeling when Spoonacular returns no results

**Should have (differentiators):**
- AI Adapter for recipe modification (allergy subs, serving scale, skill simplification)
- Programmatic post-assembly allergy scan across all ingredients
- Cuisine diversity enforcement by the coordinator
- Draft-mode visual treatment with swap/refresh affordances

**Defer (v5+):**
- User-contributed recipes mixed with Spoonacular
- Ingredient quantity aggregation in shopping lists (unit conversion is error-prone)
- Real-time search-as-you-type (burns quota, fragments the AI-curated UX)

### Architecture Approach

Frontend orchestrates a multi-step Edge Function flow rather than a single server-side orchestrator (avoids Edge Function timeout limits of 60-150s). Each Edge Function is single-responsibility: `select-meals` (AI coordinator), `recipe-search` (Spoonacular + cache), `adapt-recipe` (AI adapter). Draft state lives in React context with localStorage backup. Database writes happen only on explicit user save via a transactional PostgreSQL RPC.

**Major components:**
1. **`_shared/ai-client.ts`** -- Single source of truth for LLM provider resolution, role-based configs, token logging
2. **`select-meals` Edge Function** -- AI coordinator that outputs structured search directives per meal slot
3. **`recipe-search` Edge Function** -- Spoonacular API wrapper with cache-first lookup and response normalization
4. **`adapt-recipe` Edge Function** -- AI adapter for allergy substitutions and serving adjustments
5. **`DraftPlanContext`** -- React context holding generated plan in memory until explicit save
6. **`save_meal_plan_bulk` RPC** -- PostgreSQL function for atomic multi-table save

### Critical Pitfalls

1. **Spoonacular quota exhaustion** -- Cache aggressively from day one; implement a daily quota counter that triggers AI fallback at 80% usage; seed dev environment with cached fixture data; avoid `addRecipeInformation=true` on search calls (fetch details separately only for selected recipes)
2. **Draft state lost on navigation/refresh** -- Implement localStorage backup in the same phase as draft state, not as a follow-up; add `beforeunload` handler; prompt to restore stale drafts on mount
3. **Bulk save without atomicity** -- Use a PostgreSQL RPC function for transactional save; never use sequential independent Supabase client calls for multi-table writes; the existing delete-then-insert pattern already has a race window
4. **Allergy matching via substring** -- Build an allergen taxonomy mapping categories to specific ingredients (e.g., "tree nut" -> almond, walnut, cashew); use Spoonacular's `intolerances` param as first defense; programmatic scan as second defense
5. **Spoonacular data shape inconsistency** -- Normalize all Spoonacular responses on ingest into a canonical `CachedRecipe` type; default nullable fields; reject recipes with zero ingredients before caching

## Implications for Roadmap

Based on research, the build order is driven by strict dependency chains. Five phases emerge naturally.

### Phase 1: Foundation (Shared Modules + Database Migrations)
**Rationale:** Every new Edge Function imports `_shared/ai-client.ts`. The `recipe_cache` table must exist before any Spoonacular call. Database column additions (`source_provider`, `spoonacular_id`) must exist before recipes with source data can be saved. This is the critical path -- nothing else can start without it.
**Delivers:** `_shared/ai-client.ts`, `_shared/cors.ts`, `_shared/supabase-client.ts`, `recipe_cache` table with proper columns and indexes, `recipes` table column additions, `token_usage_log` table, `save_meal_plan_bulk` RPC function
**Addresses:** Provider duplication elimination, cache infrastructure, bulk save atomicity
**Avoids:** Pitfall 5 (provider duplication), Pitfall 8 (cold start amplification -- keep shared modules lean), Pitfall 10 (JSONB without indexes)

### Phase 2: Spoonacular Integration (Recipe Search + AI Coordinator)
**Rationale:** `recipe-search` can be tested independently with hardcoded search params, proving Spoonacular integration and caching before adding the AI layer. `select-meals` output feeds into `recipe-search`, so having search solid first validates the full chain immediately.
**Delivers:** `recipe-search` Edge Function (Spoonacular + cache), `select-meals` Edge Function (AI coordinator -> search directives), allergen taxonomy, Spoonacular response normalization layer
**Addresses:** Core recipe search, diet/intolerance filtering, AI coordinator rearchitecture, aisle data for shopping list
**Avoids:** Pitfall 1 (quota exhaustion -- cache-first), Pitfall 4 (substring allergy matching), Pitfall 7 (data shape inconsistency)

### Phase 3: Lazy-Save Draft Workflow
**Rationale:** Depends on Phase 2 (needs recipe data to populate drafts). The draft workflow is the largest frontend architectural change -- it replaces the current auto-save-on-generate pattern. localStorage backup and version counter must ship with the draft, not after.
**Delivers:** `DraftPlanContext`, `MealPlanner.tsx` orchestration (select-meals -> recipe-search -> draft), localStorage backup with restore prompt, `beforeunload` handler, explicit Save/Discard actions, bulk save via RPC
**Addresses:** Lazy-save, draft review, bulk save, generation progress UI
**Avoids:** Pitfall 3 (draft lost on refresh), Pitfall 6 (non-atomic saves), Pitfall 9 (concurrent tab conflicts)

### Phase 4: Frontend UI Updates + Shopping List
**Rationale:** Depends on Phase 3 (components need to read from draft context). These are primarily rendering changes -- source badges, draft vs persisted visual treatment, aisle-based shopping list.
**Delivers:** Source attribution badges in RecipeDetail and MealSlot, draft-mode visual treatment, aisle-based shopping list (replaces `categorize-ingredients`), AI-generated fallback with explicit labeling, quota exhaustion user feedback
**Addresses:** Source attribution, shopping list overhaul, UX pitfalls (no visual distinction, no save indicator)
**Avoids:** UX pitfalls (silent auto-save confusion, no source distinction)

### Phase 5: AI Adapter + Cleanup
**Rationale:** The adapt-recipe function is a differentiator, not table stakes. Build it after the core grounded architecture is proven. Cleanup (deprecating `ai-proxy` and `categorize-ingredients`) should happen only after all callers are migrated.
**Delivers:** `adapt-recipe` Edge Function, post-assembly allergy scan, deprecation of `ai-proxy` and `categorize-ingredients`, pg_cron cache cleanup job, refactor of `generate-plan` and `refresh-slot` to use `_shared/ai-client.ts`
**Addresses:** Recipe adaptation, allergy safety net, technical debt cleanup
**Avoids:** Pitfall 2 (fallback AI path inheriting old problems -- by this phase, all LLM calls route through shared client)

### Phase Ordering Rationale

- **Dependency-driven:** Shared modules and migrations are foundational; Edge Functions depend on them; frontend depends on Edge Functions; UI depends on frontend state; cleanup depends on everything working.
- **Risk-front-loaded:** The highest-risk items (Spoonacular integration, cache strategy, quota management) are in Phases 1-2. If Spoonacular proves problematic, the fallback path is clear before significant frontend work begins.
- **Testable increments:** Phase 2 can be validated with hardcoded search params before AI coordinator is wired up. Phase 3 can be tested with mock recipe data before Spoonacular is live.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Spoonacular Integration):** Verify current Spoonacular pricing/points system against live docs (training data is MEDIUM confidence). Test actual `complexSearch` response shape with `addRecipeNutrition` and `intolerances` params. Verify `extendedIngredients[].aisle` field presence.
- **Phase 3 (Lazy-Save):** The localStorage backup + version counter + restore UX has nuances worth a focused spike. The `save_meal_plan_bulk` RPC function needs careful schema design for the recipe-to-slot relationship.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Well-documented Supabase `_shared/` pattern, standard PostgreSQL migrations, straightforward Deno module extraction.
- **Phase 4 (UI Updates):** Standard React conditional rendering, CSS badge styling, component prop additions.
- **Phase 5 (Cleanup):** Straightforward deprecation -- remove callers, remove functions, verify with grep.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | No new frontend deps is a strong signal. Spoonacular API is stable/mature but pricing details need live verification. `_shared/` pattern is well-documented by Supabase. |
| Features | MEDIUM | Feature set is well-defined from codebase analysis. Spoonacular endpoint params based on training data -- verify `aisle` field in `extendedIngredients` with a test API call. |
| Architecture | MEDIUM-HIGH | Frontend orchestrator pattern, draft context, bulk RPC are all standard. The multi-step Edge Function flow is well-reasoned but untested at this scale in this codebase. |
| Pitfalls | MEDIUM | Pitfalls are grounded in direct codebase analysis (specific line numbers cited). Spoonacular-specific pitfalls (quota, data shape) based on training data and general API integration experience. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Spoonacular pricing verification:** Training data says 150 points/day free, ~$30/mo for 1,500 points. Verify against current Spoonacular pricing page before committing to the free tier strategy.
- **Spoonacular `aisle` field presence:** The entire shopping list overhaul depends on `extendedIngredients[].aisle` being reliably populated. Verify with 10+ test API calls across different recipe types before building the aisle mapping.
- **Allergen taxonomy completeness:** The research identifies the need but does not provide the full taxonomy. During Phase 2 planning, build a comprehensive map of the 14 major allergen categories to 50+ specific ingredient strings.
- **Edge Function timeout for multi-directive search:** If `recipe-search` receives 21 directives (full week), it may need to batch Spoonacular calls carefully to stay within the 60-second timeout. Consider splitting into multiple invocations (e.g., per day or per meal type).
- **Existing `generate-plan` migration path:** The research recommends keeping `generate-plan` as a fallback but refactoring it. The exact cutover point (when old path is disabled vs new path is primary) needs explicit definition during Phase 2 planning.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all 4 Edge Functions, `planner.ts`, `MealPlanner.tsx`, database migrations
- React Context and `useReducer` patterns -- standard, well-documented
- PostgreSQL JSONB + GIN indexing, RPC functions, `pg_cron` -- stable core features
- Supabase Edge Functions `_shared/` import pattern -- documented by Supabase

### Secondary (MEDIUM confidence)
- Spoonacular API endpoint structure, response shapes, `complexSearch` params -- based on training data; API is stable/mature but verify current docs
- Spoonacular points/pricing system -- may have changed since training data cutoff
- Deno Deploy cold start behavior and `_shared/` module resolution -- based on Supabase documentation and Deno patterns

### Tertiary (LOW confidence)
- Exact Spoonacular point costs per endpoint (1 point for search, variable for enriched queries) -- verify with dashboard after signup
- Spoonacular `intolerances` enum values -- verify exact strings accepted by the API

---
*Research completed: 2026-04-16*
*Ready for roadmap: yes*
