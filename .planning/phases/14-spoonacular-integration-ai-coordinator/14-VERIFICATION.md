---
phase: 14-spoonacular-integration-ai-coordinator
verified: 2026-04-18T11:40:00Z
status: gaps_found
score: 5/5 must-haves verified (1 Deno test file broken by API rename)
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed:
    - "getDefaultDailyLimit() now reads env at call time (not module load time)"
    - "Frontend DEFAULT_QUOTA_STATUS corrected to 50 pts (Spoonacular free-tier limit)"
    - "Settings.css now contains .generation-matrix, .matrix-row, .matrix-cell grid rules"
    - "All 5 Vitest suites (13 tests) pass with corrected 50-pt mocks"
  gaps_remaining:
    - "supabase/functions/_shared/spoonacular.test.ts imports DEFAULT_SPOONACULAR_DAILY_LIMIT which was removed — Deno test will fail to compile"
  regressions: []
gaps:
  - truth: "SEARCH-04 Deno test coverage for default daily limit compiles and passes"
    status: failed
    reason: "spoonacular.test.ts line 7 imports DEFAULT_SPOONACULAR_DAILY_LIMIT, which was replaced by getDefaultDailyLimit(). The export no longer exists, so the Deno test file will fail at import resolution before any test runs."
    artifacts:
      - path: "supabase/functions/_shared/spoonacular.test.ts"
        issue: "Line 7 imports removed export DEFAULT_SPOONACULAR_DAILY_LIMIT; line 26 asserts it equals 50. Must be updated to call getDefaultDailyLimit() and assert its return value."
    missing:
      - "Replace DEFAULT_SPOONACULAR_DAILY_LIMIT import with getDefaultDailyLimit in spoonacular.test.ts"
      - "Rewrite Deno.test at lines 25-27 to call getDefaultDailyLimit() and assertEquals its return to 50"
human_verification:
  - test: "Run a real non-mock generation through deployed select-meals -> recipe-search"
    expected: "Planner receives grounded Spoonacular slots with image, recipe name, aisle-level ingredients, and persisted source fields (source_provider: 'spoonacular')"
    why_human: "This workspace cannot execute the Deno Edge Function suite or hit live Spoonacular; verified only through React unit tests and code inspection"
  - test: "Exhaust or simulate near-threshold Spoonacular quota in a live environment"
    expected: "Settings quota text updates from spoonacular_usage_log, and once threshold is reached affected slots switch to explicit ai-generated fallback"
    why_human: "Quota headers and fallback switching are implemented and covered by source/tests but not runnable end-to-end without Deno + provider access"
---

# Phase 14: Spoonacular Integration & AI Coordinator Verification Report

**Phase Goal:** Spoonacular-backed meal generation is wired through the app with persistent household generation preferences, quota-aware grounded recipe search, taxonomy-based allergen filtering, and explicit fallback behavior.
**Verified:** 2026-04-18T11:40:00Z
**Status:** gaps_found
**Re-verification:** Yes — after 14-05 gap closure

## Re-verification Summary

The previous VERIFICATION.md (status: human_needed, 5/5) was written before plan 14-05 executed. Plan 14-05 closed three UAT gaps:

- **Gap A (major):** `DEFAULT_SPOONACULAR_DAILY_LIMIT` was a module-level const evaluated at import time before Supabase edge runtime injects secrets, always resolving to `'50'` (wrong ceiling). Fixed by replacing with `getDefaultDailyLimit()` that reads the env var at call time.
- **Gap B (major):** `DEFAULT_QUOTA_STATUS` in the frontend hardcoded wrong values. The plan frontmatter incorrectly stated the target was 150 — the actual Spoonacular free-tier limit is 50 pts/day. Corrected to 50, and test mocks reconciled.
- **Gap C (minor):** `.generation-matrix`, `.matrix-row`, `.matrix-cell` CSS classes were applied in Settings JSX but undefined in `Settings.css`. Fixed by appending CSS grid rules.

A new gap was discovered during this re-verification: the Deno test file `supabase/functions/_shared/spoonacular.test.ts` was not updated when `DEFAULT_SPOONACULAR_DAILY_LIMIT` was removed and replaced with `getDefaultDailyLimit()`. The file still imports the removed export and will fail to compile under Deno.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | User can trigger meal generation and the frontend uses `select-meals` then `recipe-search` instead of the old direct pipeline | ✓ VERIFIED | `MealPlanner.tsx:243` calls both functions in sequence; `meal-plan.test.tsx` verifies flow and confirms `generate-plan` is not invoked (4 tests pass) |
| 2 | Coordinator output is structured search directives derived from household members plus persisted generation matrix | ✓ VERIFIED | `select-meals/index.ts:289` loads `generation_preferences`; `index.ts:312` calls `callAI({ role: 'coordinator' })`; `index.ts:326` validates returned directives against enabled matrix cells |
| 3 | Household generation scope persists as an editable day x meal matrix and is editable in Settings | ✓ VERIFIED | Migration adds `generation_preferences` JSONB; `household.ts:115` reads/writes it; `Settings.tsx:106` edits and persists; `settings-partial-generation.test.tsx` (2 tests) covers sparse matrix persistence |
| 4 | Quota-aware search is implemented with cache-first lookup, usage logging, Settings quota display, and automatic threshold fallback | ✓ VERIFIED | `_shared/spoonacular.ts:1-3` exports `getDefaultDailyLimit()` reading env at call time (fallback `'50'`); `recipe-search/index.ts:441` calls `getDefaultDailyLimit()` as fallback; `src/lib/services/spoonacular.ts` `DEFAULT_QUOTA_STATUS` uses `daily_limit: 50`; `settings-quota.test.tsx` and `spoonacular-service.test.ts` (8 tests total) all pass |
| 5 | Allergen exclusions use structured taxonomy and fallback output is explicitly labeled as AI-generated | ✓ VERIFIED | `_shared/allergen-taxonomy.ts` defines taxonomy and matcher; `recipe-search/index.ts:261` filters via taxonomy; `recipe-search/index.ts:236` labels fallback slots `ai-generated` |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `supabase/functions/_shared/spoonacular.ts` | `getDefaultDailyLimit()` reads env at call time, fallback `'50'` | ✓ VERIFIED | Line 1-3: function body calls `Deno.env.get('SPOONACULAR_DAILY_LIMIT') ?? '50'`; `getQuotaState` calls it at line 60 |
| `src/lib/services/spoonacular.ts` | `DEFAULT_QUOTA_STATUS` uses correct 50-pt values | ✓ VERIFIED | Line 22-26: `daily_limit: 50`, `points_left_today: 50` |
| `src/pages/Settings/Settings.css` | CSS grid rules for generation matrix | ✓ VERIFIED | Lines 249-298: `.generation-matrix { display: grid; grid-template-columns: 7rem repeat(7, 1fr) }`, `.matrix-row { display: contents }`, `.matrix-cell` with full ruleset |
| `supabase/functions/_shared/spoonacular.test.ts` | Deno tests compile and pass with `getDefaultDailyLimit()` | ✗ BROKEN | Line 7 imports `DEFAULT_SPOONACULAR_DAILY_LIMIT` (export removed); line 26 asserts it equals 50 — Deno will fail at import resolution |
| `supabase/migrations/20260417000006_household_generation_preferences.sql` | Household-level generation preference storage | ✓ VERIFIED | Adds JSONB column and shape check on `public.households` |
| `supabase/migrations/20260417000007_spoonacular_usage_log.sql` | Household-scoped Spoonacular quota log table | ✓ VERIFIED | Table, indexes, RLS, and owner-only SELECT policy exist |
| `supabase/migrations/20260417000008_recipe_cache_compliance.sql` | Explicit 1-hour cache TTL contract | ✓ VERIFIED | Adds `expires_at`, backfill, index, and max-TTL check |
| `supabase/migrations/20260417000009_recipe_cache_directive_lookup.sql` | Stable directive-hash cache lookup layer | ✓ VERIFIED | Separate lookup table maps directive hashes to cached provider recipes |
| `supabase/functions/_shared/allergen-taxonomy.ts` | Structured allergen taxonomy helpers | ✓ VERIFIED | Used by `recipe-search` for taxonomy-filtered candidate selection |
| `supabase/functions/select-meals/index.ts` | Coordinator Edge Function producing directives only | ✓ VERIFIED | Imports shared AI client and validates directive-only JSON output |
| `supabase/functions/recipe-search/index.ts` | Quota-aware grounded search with explicit fallback | ✓ VERIFIED | Imports `getDefaultDailyLimit` (not removed const); calls it at line 306 and line 441 |
| `src/lib/services/household.ts` | Frontend persistence for generation preferences | ✓ VERIFIED | Reads and updates `households.generation_preferences` |
| `src/pages/Settings/Settings.tsx` | UI for matrix preferences and quota display | ✓ VERIFIED | Loads/saves preferences; matrix JSX applies `.generation-matrix`, `.matrix-row`, `.matrix-cell` (CSS now backs them) |
| `src/pages/MealPlanner/MealPlanner.tsx` | Planner wired to new pipeline and grounded metadata persistence | ✓ VERIFIED | Uses `select-meals` then `recipe-search`, persists source fields and shopping metadata |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `recipe-search/index.ts:441` | `_shared/spoonacular.ts` | `getDefaultDailyLimit()` fallback | WIRED | `Number(Deno.env.get('SPOONACULAR_DAILY_LIMIT') ?? getDefaultDailyLimit())` |
| `recipe-search/index.ts:306` | `_shared/spoonacular.ts` | `parseQuotaHeaders` default param | WIRED | `dailyLimit = getDefaultDailyLimit()` as default parameter |
| `src/lib/services/spoonacular.ts` | quota display | `normalizeQuotaStatus` fallback | WIRED | Normalizer uses `DEFAULT_QUOTA_STATUS.daily_limit` (50) as floor |
| `Settings.tsx` | `.generation-matrix` grid | `Settings.css` class definitions | WIRED | CSS lines 249-298 back all three matrix class names applied in JSX |
| `select-meals/index.ts` | `_shared/ai-client.ts` | `callAI({ role: 'coordinator' })` | WIRED | `select-meals/index.ts:312` |
| `MealPlanner.tsx` | Edge Functions | `invokeSelectMeals` then `invokeRecipeSearch` | WIRED | `MealPlanner.tsx:243` |
| `Settings.tsx` | `households.generation_preferences` + quota log | `householdService` + `getSpoonacularQuotaStatus` | WIRED | `Settings.tsx:92` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `Settings.tsx` `quotaStatus` | `quotaStatus` | `getSpoonacularQuotaStatus()` -> `spoonacular_usage_log` row or `DEFAULT_QUOTA_STATUS` (50 pts) | Yes | ✓ FLOWING |
| `Settings.tsx` `generationPreferences` | `generationPreferences` | `householdService.getGenerationPreferences()` -> `households.generation_preferences` | Yes | ✓ FLOWING |
| `MealPlanner.tsx` `finalPlan.slots` | directives then grounded slots | `select-meals` -> `recipe-search` -> planner state | Yes | ✓ FLOWING |
| `recipe-search/index.ts` quota gate | `dailyLimit` / `thresholdPoints` | `getDefaultDailyLimit()` called at line 441 using env var or `'50'` fallback | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Settings matrix persistence and quota rendering | `npx vitest run settings-partial-generation settings-quota settings.test` | 3 files, 9 tests — all pass | ✓ PASS |
| Frontend planner two-step flow | `npx vitest run meal-plan` | 4 tests pass; `generate-plan` not called | ✓ PASS |
| Spoonacular service quota normalization | `npx vitest run spoonacular-service` | 4 tests pass with `daily_limit: 50` | ✓ PASS |
| Deno edge function tests | Deno not installed | `spoonacular.test.ts` imports removed export — would fail to compile | ✗ FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| `SEARCH-03` | 14-01, 14-04, 14-05 | User can configure how many meals to generate | ✓ SATISFIED | Persistent day x meal matrix storage in migration and `household.ts:133`; editable Settings grid in `Settings.tsx:155`; CSS grid now renders correctly |
| `SEARCH-04` | 14-01, 14-03, 14-04, 14-05 | System tracks Spoonacular points consumed per day and displays quota status to user | ✓ SATISFIED | `getDefaultDailyLimit()` reads env at call time; `DEFAULT_QUOTA_STATUS` uses 50 pts; quota display in `DebugLog.tsx:45`; Vitest coverage passes; Deno test for this requirement has broken import (see gaps) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `supabase/functions/_shared/spoonacular.test.ts` | 7, 26 | Imports `DEFAULT_SPOONACULAR_DAILY_LIMIT` which was removed; assert at line 26 references it | 🛑 Blocker | Deno test suite will fail at import resolution — SEARCH-04 Deno coverage is broken until fixed |

### Human Verification Required

### 1. Live Grounded Generation

**Test:** Generate a non-mock week from the planner against deployed Edge Functions with a valid `SPOONACULAR_API_KEY`.
**Expected:** The run returns grounded Spoonacular recipes, each saved with `source_provider: 'spoonacular'`, `source_id`, `image_url`, nutrition data, and aisle-backed shopping items.
**Why human:** Frontend wiring is verified locally. Deno is unavailable in this workspace and live provider requests cannot be made during verification.

### 2. Live Quota Threshold / Fallback

**Test:** Use an environment with a low `SPOONACULAR_DAILY_LIMIT` or nearly exhausted quota, then generate enough slots to cross threshold.
**Expected:** Settings quota text updates from `spoonacular_usage_log`, and once threshold is reached the affected slots switch to explicit `ai-generated` fallback output.
**Why human:** Threshold and fallback logic exist in code and Deno tests, but end-to-end verification requires live quota headers plus runnable Edge Functions.

### Gaps Summary

The three UAT gaps from plan 14-05 are all resolved in the actual code. One new gap was introduced during the gap closure:

`supabase/functions/_shared/spoonacular.test.ts` still imports `DEFAULT_SPOONACULAR_DAILY_LIMIT` (line 7) and asserts it equals 50 (line 26). That export was removed and replaced with `getDefaultDailyLimit()` in `_shared/spoonacular.ts`. The Deno test file was not updated, so it will fail at import resolution before any test runs. The fix is minimal: replace the import with `getDefaultDailyLimit` and rewrite the assertion to `assertEquals(getDefaultDailyLimit(), 50)`.

All Vitest (React) tests pass (13/13). The Deno test gap does not block the runtime behavior of the edge functions themselves — `recipe-search/index.ts` correctly imports and calls `getDefaultDailyLimit()`. It only breaks the Deno test suite for `_shared/spoonacular.ts`.

---

_Verified: 2026-04-18T11:40:00Z_
_Verifier: Claude (gsd-verifier)_
