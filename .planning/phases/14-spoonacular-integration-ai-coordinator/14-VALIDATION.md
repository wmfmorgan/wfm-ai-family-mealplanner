---
phase: 14
slug: spoonacular-integration-ai-coordinator
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-17
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 1.4.0 + Deno test |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- src/__tests__/settings.test.tsx` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task-specific automated command listed in the Per-Task Verification Map
- **After every plan wave:** Run `npm test` plus the Deno commands for the wave's touched backend files
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | SEARCH-03 | schema | `rg -n "generation_preferences" supabase/migrations/20260417000006_household_generation_preferences.sql` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | SEARCH-04 | schema | `rg -n "spoonacular_usage_log|daily_limit" supabase/migrations/20260417000007_spoonacular_usage_log.sql` | ❌ W0 | ⬜ pending |
| 14-01-03 | 01 | 1 | SEARCH-01 | schema | `rg -n "recipe_cache|expires_at|recipe_cache_directive_lookup" supabase/migrations/20260417000008_recipe_cache_compliance.sql supabase/migrations/20260417000009_recipe_cache_directive_lookup.sql` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 2 | SAFE-05 | Deno unit | `deno test supabase/functions/_shared/allergen-taxonomy.test.ts supabase/functions/_shared/spoonacular.test.ts -A` | ✅ planned | ⬜ pending |
| 14-02-02 | 02 | 2 | SEARCH-02 | Deno unit | `deno test supabase/functions/select-meals/index.test.ts -A` | ✅ planned | ⬜ pending |
| 14-03-01 | 03 | 3 | SEARCH-01/SEARCH-04 | Deno unit | `deno test supabase/functions/recipe-search/index.test.ts supabase/functions/recipe-search/quota.test.ts -A` | ✅ planned | ⬜ pending |
| 14-03-02 | 03 | 3 | SEARCH-05 | Deno unit | `deno test supabase/functions/recipe-search/fallback.test.ts -A` | ✅ planned | ⬜ pending |
| 14-04-01 | 04 | 4 | SEARCH-01/SEARCH-03/SEARCH-04 | service | `npm test -- src/__tests__/meal-plan.test.tsx src/__tests__/settings-partial-generation.test.tsx src/__tests__/settings-quota.test.tsx` | ✅ planned | ⬜ pending |
| 14-04-02 | 04 | 4 | SEARCH-03/SEARCH-04 | Vitest | `npm test -- src/__tests__/settings-partial-generation.test.tsx src/__tests__/settings-quota.test.tsx` | ✅ planned | ⬜ pending |
| 14-04-03 | 04 | 4 | SEARCH-01 | Vitest | `npm test -- src/__tests__/meal-plan.test.tsx` | ✅ planned | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/functions/select-meals/index.test.ts` — directive-only coordinator tests for SEARCH-02
- [ ] `supabase/functions/recipe-search/index.test.ts` — grounded search/cache/fallback tests for SEARCH-01 and SEARCH-05
- [ ] `supabase/functions/recipe-search/quota.test.ts` — quota-header accounting tests for SEARCH-04
- [ ] `supabase/functions/recipe-search/fallback.test.ts` — fallback threshold and provider-failure tests for SEARCH-05
- [ ] `supabase/functions/_shared/allergen-taxonomy.test.ts` — structured allergen taxonomy tests for SAFE-05
- [ ] `src/__tests__/settings-partial-generation.test.tsx` — household preference matrix tests for SEARCH-03
- [ ] `src/__tests__/settings-quota.test.tsx` — Settings quota UI tests for SEARCH-04
- [ ] `src/__tests__/meal-plan.test.tsx` — planner orchestration and grounded persistence tests
- [ ] Local `deno` install or equivalent CI path for running Edge Function tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Spoonacular pricing tier and daily quota limit match configured threshold | SEARCH-04/05 | Depends on live provider account and current billing tier | Confirm active Spoonacular plan, then compare the configured daily quota limit and 80% fallback threshold against provider dashboard values |
| Cache TTL and stored payload usage comply with Spoonacular terms | SEARCH-01 | Requires live provider review and legal/compliance judgment | Inspect live `recipe_cache` rows and the effective expiration query path; confirm no user-requested provider payload is reused beyond the approved TTL |
| Grounded recipe generation returns verified nutrition, ingredient, and aisle data from live provider responses | SEARCH-01 | Requires a real `SPOONACULAR_API_KEY` and provider traffic | Run the generation flow against live Spoonacular data and inspect saved recipe records plus shopping-list payloads for `nutrition`, `extendedIngredients`, `aisle`, `amount`, and `unit` fields |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
