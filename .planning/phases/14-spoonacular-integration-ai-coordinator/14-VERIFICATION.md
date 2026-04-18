---
phase: 14-spoonacular-integration-ai-coordinator
verified: 2026-04-18T12:59:06Z
status: human_needed
score: 5/5 must-haves verified
human_verification:
  - test: "Run a real non-mock generation through deployed select-meals -> recipe-search"
    expected: "Planner receives grounded Spoonacular slots with nutrition, ingredients, aisle metadata, and persisted source fields"
    why_human: "This workspace cannot execute the Deno Edge Function test suite or hit live Spoonacular from verification"
  - test: "Exhaust or simulate near-threshold Spoonacular quota in a live environment"
    expected: "Settings shows updated quota usage and recipe-search switches affected slots to explicit ai-generated fallback output"
    why_human: "Quota headers and fallback switching are implemented and covered by source/tests, but not runnable end-to-end here without Deno + provider access"
---

# Phase 14: Spoonacular Integration & AI Coordinator Verification Report

**Phase Goal:** Spoonacular-backed meal generation is wired through the app with persistent household generation preferences, quota-aware grounded recipe search, taxonomy-based allergen filtering, and explicit fallback behavior.
**Verified:** 2026-04-18T12:59:06Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | User can trigger meal generation and the frontend now uses `select-meals` then `recipe-search` instead of the old direct pipeline | ✓ VERIFIED | [src/pages/MealPlanner/MealPlanner.tsx](/Users/jabroni/Projects/wfm-ai-family-mealplanner/src/pages/MealPlanner/MealPlanner.tsx:243) calls both functions in sequence; [src/__tests__/meal-plan.test.tsx](/Users/jabroni/Projects/wfm-ai-family-mealplanner/src/__tests__/meal-plan.test.tsx:157) verifies that flow and confirms `generate-plan` is not invoked |
| 2 | Coordinator output is structured search directives derived from household members plus persisted generation matrix | ✓ VERIFIED | [supabase/functions/select-meals/index.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/select-meals/index.ts:289) loads `generation_preferences`, [supabase/functions/select-meals/index.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/select-meals/index.ts:312) calls `callAI` with `role: 'coordinator'`, and [supabase/functions/select-meals/index.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/select-meals/index.ts:326) validates the returned directives against enabled matrix cells |
| 3 | Household generation scope persists as a household-level 2D day x meal matrix and is editable in Settings | ✓ VERIFIED | [supabase/migrations/20260417000006_household_generation_preferences.sql](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/migrations/20260417000006_household_generation_preferences.sql:1) adds `generation_preferences`; [src/lib/services/household.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/src/lib/services/household.ts:115) reads and writes it; [src/pages/Settings/Settings.tsx](/Users/jabroni/Projects/wfm-ai-family-mealplanner/src/pages/Settings/Settings.tsx:106) edits the matrix and persists updates; [src/__tests__/settings-partial-generation.test.tsx](/Users/jabroni/Projects/wfm-ai-family-mealplanner/src/__tests__/settings-partial-generation.test.tsx:56) covers sparse matrix persistence |
| 4 | Quota-aware search is implemented with cache-first lookup, usage logging, Settings quota display, and automatic threshold fallback | ✓ VERIFIED | [supabase/functions/_shared/spoonacular.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/_shared/spoonacular.ts:116) loads directive-hash cache hits before provider fetch; [supabase/functions/recipe-search/index.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/recipe-search/index.ts:440) computes quota state, [supabase/functions/recipe-search/index.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/recipe-search/index.ts:492) writes usage logs, and [src/pages/Settings/DebugLog.tsx](/Users/jabroni/Projects/wfm-ai-family-mealplanner/src/pages/Settings/DebugLog.tsx:31) renders quota summary |
| 5 | Allergen exclusions use structured taxonomy and fallback output is explicitly labeled as AI-generated | ✓ VERIFIED | [supabase/functions/_shared/allergen-taxonomy.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/_shared/allergen-taxonomy.ts:1) defines the taxonomy and matcher; [supabase/functions/recipe-search/index.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/recipe-search/index.ts:261) filters candidates via taxonomy; [supabase/functions/recipe-search/index.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/recipe-search/index.ts:236) labels fallback recipes `ai-generated`; [supabase/functions/recipe-search/fallback.test.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/recipe-search/fallback.test.ts:191) covers taxonomy-triggered fallback |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `supabase/migrations/20260417000006_household_generation_preferences.sql` | Household-level generation preference storage | ✓ VERIFIED | Adds JSONB column and shape check on `public.households` |
| `supabase/migrations/20260417000007_spoonacular_usage_log.sql` | Household-scoped Spoonacular quota log table | ✓ VERIFIED | Table, indexes, RLS, and owner-only SELECT policy exist |
| `supabase/migrations/20260417000008_recipe_cache_compliance.sql` | Explicit 1-hour cache TTL contract | ✓ VERIFIED | Adds `expires_at`, backfill, index, and max-TTL check |
| `supabase/migrations/20260417000009_recipe_cache_directive_lookup.sql` | Stable directive-hash cache lookup layer | ✓ VERIFIED | Separate lookup table maps directive hashes to cached provider recipes |
| `supabase/functions/_shared/allergen-taxonomy.ts` | Structured allergen taxonomy helpers | ✓ VERIFIED | Exported taxonomy, normalization, and match helper are used by `recipe-search` |
| `supabase/functions/_shared/spoonacular.ts` | Shared quota, cache, fetch, and logging helpers | ✓ VERIFIED | Used by `recipe-search` for cache-first, quota, and usage-log paths |
| `supabase/functions/select-meals/index.ts` | Coordinator Edge Function producing directives only | ✓ VERIFIED | Imports shared AI client and validates directive-only JSON output |
| `supabase/functions/recipe-search/index.ts` | Quota-aware grounded search with explicit fallback | ✓ VERIFIED | Cache-first search, provider fetch, taxonomy filtering, usage logging, and fallback flow all present |
| `src/lib/services/household.ts` | Frontend persistence for generation preferences | ✓ VERIFIED | Reads and updates `households.generation_preferences` |
| `src/lib/services/spoonacular.ts` | Frontend invocations and quota read path | ✓ VERIFIED | Invokes both Edge Functions and reads latest quota row |
| `src/pages/Settings/Settings.tsx` | UI for matrix preferences and quota display | ✓ VERIFIED | Loads/saves preferences and passes quota data to debug surface |
| `src/pages/MealPlanner/MealPlanner.tsx` | Planner wired to the new pipeline and grounded metadata persistence | ✓ VERIFIED | Uses `select-meals` and `recipe-search`, then persists source fields and shopping metadata |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `select-meals/index.ts` | `_shared/ai-client.ts` | `callAI({ role: 'coordinator' ... })` | WIRED | [select-meals/index.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/select-meals/index.ts:312) |
| `select-meals/index.ts` | `public.households` | load `generation_preferences` | WIRED | [select-meals/index.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/select-meals/index.ts:257) |
| `recipe-search/index.ts` | `_shared/spoonacular.ts` | cache/quota helpers | WIRED | Imports and uses `buildDirectiveHash`, `getQuotaState`, `loadCachedRecipe`, `writeUsageLog`, `upsertRecipeCache` |
| `recipe-search/index.ts` | `public.recipe_cache_directive_lookup` + `public.recipe_cache` | directive-hash cache reuse | WIRED | [spoonacular.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/_shared/spoonacular.ts:121) and [recipe-search/index.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/recipe-search/index.ts:455) |
| `recipe-search/index.ts` | `public.spoonacular_usage_log` | daily quota tracking | WIRED | [recipe-search/index.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/recipe-search/index.ts:492) and [spoonacular.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/_shared/spoonacular.ts:197) |
| `recipe-search/index.ts` | `_shared/allergen-taxonomy.ts` | taxonomy filtering before slot selection | WIRED | [recipe-search/index.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/recipe-search/index.ts:257) |
| `MealPlanner.tsx` | Edge Functions | `invokeSelectMeals` then `invokeRecipeSearch` | WIRED | [MealPlanner.tsx](/Users/jabroni/Projects/wfm-ai-family-mealplanner/src/pages/MealPlanner/MealPlanner.tsx:243) |
| `Settings.tsx` | `households.generation_preferences` + quota log | `householdService` + `getSpoonacularQuotaStatus` | WIRED | [Settings.tsx](/Users/jabroni/Projects/wfm-ai-family-mealplanner/src/pages/Settings/Settings.tsx:92) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `Settings.tsx` | `generationPreferences` | `householdService.getGenerationPreferences()` -> `households.generation_preferences` | Yes | ✓ FLOWING |
| `Settings.tsx` | `quotaStatus` | `getSpoonacularQuotaStatus()` -> latest `spoonacular_usage_log` row | Yes | ✓ FLOWING |
| `MealPlanner.tsx` | `selectMeals.directives` / `finalPlan.slots` | `select-meals` response -> `recipe-search` response | Yes | ✓ FLOWING |
| `recipe-search/index.ts` | `cached.recipe` / provider `results` / fallback slot | `recipe_cache_directive_lookup` + Spoonacular API + fallback AI | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Settings matrix persistence UI and quota rendering | `npm test -- settings-partial-generation settings-quota meal-plan` | 3 files passed, 8 tests passed | ✓ PASS |
| Frontend planner uses `select-meals` then `recipe-search` and saves grounded metadata | `npm test -- settings-partial-generation settings-quota meal-plan` | `meal-plan.test.tsx` passed | ✓ PASS |
| Deno Edge Function behavior | Deno tests under `supabase/functions/select-meals` and `recipe-search` | Deno not installed in this workspace | ? SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| `SEARCH-01` | `14-01`, `14-03`, `14-04` | User can generate meals using real recipes from Spoonacular via cache-first search | ✓ SATISFIED | Cache-first load in [_shared/spoonacular.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/_shared/spoonacular.ts:116); grounded slot assembly in [recipe-search/index.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/recipe-search/index.ts:141); planner wiring in [MealPlanner.tsx](/Users/jabroni/Projects/wfm-ai-family-mealplanner/src/pages/MealPlanner/MealPlanner.tsx:243) |
| `SEARCH-02` | `14-02` | AI Coordinator outputs search directives instead of inventing recipes | ✓ SATISFIED | Directive-only prompt and validation in [select-meals/index.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/select-meals/index.ts:230) and [select-meals/index.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/select-meals/index.ts:194) |
| `SEARCH-03` | `14-01`, `14-04` | User can configure how many meals to generate | ✓ SATISFIED | Persistent day x meal matrix storage in migration and [household.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/src/lib/services/household.ts:133); editable Settings grid in [Settings.tsx](/Users/jabroni/Projects/wfm-ai-family-mealplanner/src/pages/Settings/Settings.tsx:155) |
| `SEARCH-04` | `14-01`, `14-03`, `14-04` | System tracks Spoonacular points consumed per day and displays quota status to user | ✓ SATISFIED | Usage-log schema in migration, quota header parsing and writes in [recipe-search/index.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/recipe-search/index.ts:303), quota query in [src/lib/services/spoonacular.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/src/lib/services/spoonacular.ts:39), display in [DebugLog.tsx](/Users/jabroni/Projects/wfm-ai-family-mealplanner/src/pages/Settings/DebugLog.tsx:31) |
| `SEARCH-05` | `14-03` | System automatically falls back to AI generation when Spoonacular quota is near exhaustion (~80%) | ✓ SATISFIED | Threshold preflight and 402 fallback in [recipe-search/index.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/recipe-search/index.ts:462) and [recipe-search/index.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/recipe-search/index.ts:509); Deno tests exist in [recipe-search/index.test.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/recipe-search/index.test.ts:167) |
| `SAFE-05` | `14-02`, `14-03` | Allergy matching uses structured taxonomy | ✓ SATISFIED | Taxonomy map and matcher in [allergen-taxonomy.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/_shared/allergen-taxonomy.ts:1); candidate filtering in [recipe-search/index.ts](/Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/functions/recipe-search/index.ts:261) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `src/pages/Settings/DebugLog.tsx` | 36 | Locked `points_used_today / 150` display instead of rendering `daily_limit` | ℹ️ Info | Matches the phase’s explicitly locked UI contract from plan/context; not a blocker for phase 14 |
| `src/lib/services/household.ts` | 95 | Empty-matrix input resets to default full-week matrix | ℹ️ Info | Defensive normalization, not a stub; worth remembering if future UX wants “generate nothing” to be representable |

### Human Verification Required

### 1. Live Grounded Generation

**Test:** Generate a non-mock week from the planner against deployed Edge Functions with a valid `SPOONACULAR_API_KEY`.
**Expected:** The run returns grounded Spoonacular recipes, each saved with `source_provider: 'spoonacular'`, `source_id`, `image_url`, nutrition data, and aisle-backed shopping items.
**Why human:** The frontend wiring is verified locally, but this workspace could not execute the Deno Edge Function suite or perform live provider requests.

### 2. Live Quota Threshold / Fallback

**Test:** Use an environment with a low `SPOONACULAR_DAILY_LIMIT` or nearly exhausted quota, then generate enough slots to cross threshold.
**Expected:** Settings quota text updates from `spoonacular_usage_log`, and once threshold is reached the affected slots switch to explicit `ai-generated` fallback output.
**Why human:** Threshold and fallback logic exist in code and Deno tests, but end-to-end verification requires live quota headers plus runnable Edge Functions.

### Gaps Summary

No code-level gaps were found against the phase goal or declared Phase 14 requirements. The remaining work is live verification of external-provider behavior because Deno is unavailable in this workspace and Spoonacular-backed execution was not runnable here.

---

_Verified: 2026-04-18T12:59:06Z_
_Verifier: Claude (gsd-verifier)_
