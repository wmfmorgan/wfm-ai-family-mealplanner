---
phase: 14-spoonacular-integration-ai-coordinator
plan: "06"
subsystem: infra
tags: [deno, edge-functions, ai-client, select-meals, spoonacular, tdd]

# Dependency graph
requires:
  - phase: 14-spoonacular-integration-ai-coordinator
    provides: coordinator AI client with ROLE_CONFIG and select-meals handler with createHandler DI API
provides:
  - coordinator max_tokens raised from 1024 to 4096 in ROLE_CONFIG
  - pre-parse guard in select-meals returning coordinator_response_truncated on invalid JSON
  - 8 passing unit tests in ai-client.test.ts
  - 6 passing unit tests in select-meals/index.test.ts
affects: [select-meals, ai-client, meal-generation, spoonacular-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD: RED (failing test commit) -> GREEN (implementation commit) per task"
    - "Diagnostic pre-parse guard: wrap JSON.parse in try/catch, return specific error code before outer catch can intercept"
    - "ROLE_CONFIG_FOR_TEST: test-only re-export for config inspection without mocking internals"

key-files:
  created: []
  modified:
    - supabase/functions/_shared/ai-client.ts
    - supabase/functions/_shared/ai-client.test.ts
    - supabase/functions/select-meals/index.ts
    - supabase/functions/select-meals/index.test.ts

key-decisions:
  - "Raised coordinator max_tokens from 1024 to 4096 — a 21-cell matrix generates ~2200-2400 tokens; 1024 caused systematic truncation"
  - "Pre-parse guard returns errorResponse directly (not re-throws) so outer catch cannot intercept coordinator_response_truncated"
  - "Updated the old INFRA-01 test that asserted max_tokens: 1024 to reflect the new value — one source of truth"

patterns-established:
  - "Diagnostic error codes: return specific string codes (not generic messages) from JSON parse failures so clients can distinguish truncation from logic errors"

requirements-completed: [INFRA-03]

# Metrics
duration: 15min
completed: 2026-04-18
---

# Phase 14 Plan 06: Select-meals 500 Fix — Token Budget and Truncation Guard Summary

**coordinator max_tokens raised 1024 -> 4096 and pre-parse guard added to surface coordinator_response_truncated instead of generic 500 crashes**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-18T18:34:55Z
- **Completed:** 2026-04-18T18:50:00Z
- **Tasks:** 2 (each TDD: RED commit + GREEN commit)
- **Files modified:** 4

## Accomplishments
- Fixed the root cause of select-meals HTTP 500: coordinator was allocated 1024 max_tokens while a 7-day x 3-meal-type directive set requires ~2200–2400 tokens
- Added a diagnostic pre-parse guard that returns `{ error: "coordinator_response_truncated" }` instead of leaking SyntaxError messages or crashing generically
- Existing 3 SEARCH-02 tests continue passing; added 3 new INFRA-03 tests to each test file (8 total in ai-client, 6 total in select-meals)

## Task Commits

Each task was committed atomically with TDD RED then GREEN:

1. **Task 1 RED: coordinator max_tokens tests** - `bf42db7` (test)
2. **Task 1 GREEN: raise max_tokens to 4096** - `225e247` (feat)
3. **Task 2 RED: coordinator_response_truncated guard tests** - `7b3a2ea` (test)
4. **Task 2 GREEN: pre-parse guard implementation** - `110e228` (feat)

## Files Created/Modified
- `supabase/functions/_shared/ai-client.ts` - coordinator max_tokens changed from 1024 to 4096
- `supabase/functions/_shared/ai-client.test.ts` - added 3 INFRA-03 assertions; updated INFRA-01 test to reflect 4096
- `supabase/functions/select-meals/index.ts` - bare JSON.parse replaced with guarded try/catch returning coordinator_response_truncated
- `supabase/functions/select-meals/index.test.ts` - added 3 INFRA-03 behavior tests for guard

## Decisions Made
- Updated the old INFRA-01 test that asserted `max_tokens: 1024` to assert `4096` — avoids two conflicting tests pointing at the same config value
- Pre-parse guard uses `return errorResponse(...)` (not `throw`) so the outer try/catch in the handler body does not intercept it and replace it with a generic message

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The `deno test` command required `--allow-net` for `select-meals/index.test.ts` because the module-level `serve(handler)` call in index.ts starts listening on port 8000 when imported. This is a pre-existing condition (the SEARCH-02 tests had the same requirement). The plan's verify command used `--allow-env` only; the correct command includes both `--allow-env --allow-net`.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- select-meals can now handle full 21-cell matrices without hitting token truncation
- The diagnostic error code `coordinator_response_truncated` is in place for future observability improvements
- The UAT gap "Planner receives grounded Spoonacular slots" is unblocked — the 500 was caused solely by token truncation

---
*Phase: 14-spoonacular-integration-ai-coordinator*
*Completed: 2026-04-18*
