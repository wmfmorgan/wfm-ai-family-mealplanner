---
phase: 14-spoonacular-integration-ai-coordinator
plan: 05
subsystem: api
tags: [spoonacular, quota, css-grid, edge-functions, deno]

requires:
  - phase: 14-04
    provides: Settings and MealPlanner wired to Spoonacular pipeline

provides:
  - Correct Spoonacular daily quota default (50 pts, matching free-tier limit)
  - Env var read at call time in edge function (not at module import time)
  - Generation matrix CSS grid layout in Settings

affects: [14-04, recipe-search, settings-ui]

tech-stack:
  added: []
  patterns:
    - "Read env vars inside functions (not at module scope) so Supabase edge runtime secret injection is not missed"

key-files:
  created: []
  modified:
    - supabase/functions/_shared/spoonacular.ts
    - src/lib/services/spoonacular.ts
    - src/pages/Settings/Settings.css
    - src/__tests__/settings.test.tsx
    - src/__tests__/settings-quota.test.tsx

key-decisions:
  - "Correct Spoonacular free-tier daily limit is 50 pts, not 150 — plan frontmatter was wrong"
  - "getDefaultDailyLimit() reads env var at call time to avoid module-load-time secret injection race"
  - "CSS display:contents on .matrix-row lets children participate directly in parent grid"

patterns-established:
  - "Deno edge functions: never read env vars at module scope — always inside a function body"

requirements-completed: [SEARCH-03, SEARCH-04]

duration: 25min
completed: 2026-04-18
---

# Phase 14 Plan 05: UAT Gap Closure Summary

**Three UAT gaps closed: env-var timing fix for quota threshold, correct 50-pt daily limit default, and CSS grid for generation matrix.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-04-18
- **Tasks:** 3 (2 auto + 1 human-verify, plus post-verify correction)
- **Files modified:** 5

## Accomplishments

- Fixed `getDefaultDailyLimit()` to read `SPOONACULAR_DAILY_LIMIT` at call time (not module import time), preventing the threshold guard from short-circuiting all directives to AI fallback during live edge function execution
- Corrected `DEFAULT_QUOTA_STATUS` and `getDefaultDailyLimit()` fallback to 50 (the actual Spoonacular free-tier limit) — plan frontmatter incorrectly stated 150
- Added `.generation-matrix`, `.matrix-row`, `.matrix-cell` CSS rules so the 3x7 day/meal toggle grid renders as a proper grid instead of a vertical list

## Task Commits

1. **Task 1: Fix module-level env read in _shared/spoonacular.ts (Gap A)** - `f49cac2` (fix)
2. **Task 2: Fix frontend quota default and Settings CSS grid (Gaps B and C)** - `3a10cf8` (fix)
3. **Post-verify correction: Revert quota default to 50** - `4db18ea` (fix)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan frontmatter stated incorrect daily limit of 150**
- **Found during:** Human verification — user confirmed quota showing 150 is wrong; correct limit is 50
- **Issue:** Plan `must_haves` and `interfaces` section specified `daily_limit: 150` as the correct value, but the actual Spoonacular free-tier limit is 50 pts/day
- **Fix:** Reverted `DEFAULT_QUOTA_STATUS` in `src/lib/services/spoonacular.ts` to `daily_limit: 50, points_left_today: 50`; reverted `getDefaultDailyLimit()` fallback in `supabase/functions/_shared/spoonacular.ts` from `'150'` to `'50'`; updated test mocks and assertions accordingly
- **Files modified:** `src/lib/services/spoonacular.ts`, `supabase/functions/_shared/spoonacular.ts`, `src/__tests__/settings.test.tsx`, `src/__tests__/settings-quota.test.tsx`
- **Commit:** `4db18ea`

## Files Created/Modified

- `supabase/functions/_shared/spoonacular.ts` — `DEFAULT_SPOONACULAR_DAILY_LIMIT` const replaced with `getDefaultDailyLimit()` function; fallback corrected to `'50'`
- `src/lib/services/spoonacular.ts` — `DEFAULT_QUOTA_STATUS` corrected to 50 pts
- `src/pages/Settings/Settings.css` — `.generation-matrix`, `.matrix-row`, `.matrix-cell` CSS grid rules appended
- `src/__tests__/settings.test.tsx` — mock corrected to 50
- `src/__tests__/settings-quota.test.tsx` — mock and assertion corrected to 50

## Known Stubs

None — all quota display values are sourced from live DB data or correct defaults.

## Self-Check: PASSED

- `src/lib/services/spoonacular.ts` exists and contains `daily_limit: 50`
- `supabase/functions/_shared/spoonacular.ts` exports `getDefaultDailyLimit` with fallback `'50'`
- `src/pages/Settings/Settings.css` contains `.generation-matrix`
- All test commits verified in git log
