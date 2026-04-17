---
phase: 14-spoonacular-integration-ai-coordinator
plan: 02
subsystem: api
tags: [deno, supabase, edge-functions, spoonacular, coordinator, allergen-taxonomy]
requires:
  - phase: 13-foundation-database-migrations
    provides: shared ai-client/auth/cors modules for new edge functions
  - phase: 14-spoonacular-integration-ai-coordinator
    provides: household generation_preferences and spoonacular usage/cache compliance migrations from 14-01
provides:
  - shared allergen taxonomy helpers for structured ingredient matching
  - shared spoonacular quota and directive hashing helpers
  - select-meals edge function that returns validated directive JSON only
affects: [phase-14-recipe-search, phase-14-settings-mealplanner, safe-05, search-02]
tech-stack:
  added: []
  patterns: [directive-only-coordinator, sparse-matrix-generation-scope, shared-quota-contracts]
key-files:
  created:
    - supabase/functions/_shared/allergen-taxonomy.ts
    - supabase/functions/_shared/spoonacular.ts
    - supabase/functions/_shared/allergen-taxonomy.test.ts
    - supabase/functions/_shared/spoonacular.test.ts
    - supabase/functions/select-meals/index.ts
    - supabase/functions/select-meals/index.test.ts
  modified: []
key-decisions:
  - "select-meals exports a dependency-injected createHandler to keep the Edge Function testable without network calls"
  - "Coordinator responses are sanitized to directives-only and rejected unless they exactly match the enabled matrix cells"
  - "Spoonacular helper defaults preserve the locked 150-point daily limit contract while still deriving threshold state from configurable inputs"
patterns-established:
  - "Shared taxonomy contract: normalize ingredient names before matching aliases from ALLERGEN_TAXONOMY"
  - "Coordinator contract: load household generation_preferences, resolve sparse matrix scope, and call AI once with role coordinator"
requirements-completed: [SEARCH-02, SAFE-05]
duration: 3 min
completed: 2026-04-17T21:30:28Z
---

# Phase 14 Plan 02: Shared Contracts and Coordinator Summary

**Directive-only coordinator output with shared allergen taxonomy matching and Spoonacular quota helpers for downstream recipe search.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-17T21:27:49Z
- **Completed:** 2026-04-17T21:30:28Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added `_shared/allergen-taxonomy.ts` with the locked SAFE-05 allergen map plus normalization and matching helpers.
- Added `_shared/spoonacular.ts` with the locked 150-point daily limit contract, fallback threshold math, and stable directive hashing.
- Built `select-meals` as a directive-only Edge Function that authenticates, reads `generation_preferences`, resolves sparse matrix scope, calls the shared AI client once, and strips any recipe payload leakage from the response.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared Spoonacular config helpers and allergy taxonomy contracts** - `5106fff` (feat)
2. **Task 2: Build the select-meals Edge Function that returns directives instead of recipes** - `3c1258a` (test), `5315ce2` (feat)

## Files Created/Modified

- `supabase/functions/_shared/allergen-taxonomy.ts` - hardcoded taxonomy map and ingredient matching helpers for SAFE-05.
- `supabase/functions/_shared/spoonacular.ts` - default quota contract, threshold math, and directive hashing utilities for later recipe-search work.
- `supabase/functions/_shared/allergen-taxonomy.test.ts` - Deno contract tests for taxonomy normalization and matching.
- `supabase/functions/_shared/spoonacular.test.ts` - Deno contract tests for quota helper behavior.
- `supabase/functions/select-meals/index.ts` - directive-only coordinator Edge Function with persisted matrix fallback and AI response validation.
- `supabase/functions/select-meals/index.test.ts` - Deno contract tests for matrix fallback, override, sparse scope preservation, and directive-only response shape.

## Decisions Made

- Exported `createHandler` alongside the served handler so coordinator behavior can be tested with injected auth, DB, and AI dependencies.
- Treated the matrix as the only allowed directive target set and reject coordinator payloads that add, omit, or duplicate enabled cells.
- Returned a sanitized response object with `week_start_date`, `matrix`, and `directives` only, even if the AI payload includes recipe-like fields.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `deno` is not installed in this workspace, so the plan’s `deno test ...` verification command could not run locally. The Deno test files were still created and the required grep-based contract checks passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `recipe-search` can now import the shared taxonomy and quota helpers directly.
- Frontend orchestration can call `select-meals` and receive validated search directives tied to household generation scope.
- Remaining risk before live execution is environment-only: Deno CLI must be available in CI or a future local session to run the new Edge Function test files.

## Self-Check: PASSED

- Summary artifact exists on disk.
- Task commits `5106fff`, `3c1258a`, and `5315ce2` are present in git history.
