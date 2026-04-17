---
phase: 14-spoonacular-integration-ai-coordinator
plan: 01
subsystem: database
tags: [migrations, spoonacular, cache, quota, households, supabase]
requires:
  - phase: 13-foundation-database-migrations
    provides: recipe_cache schema, households base table, ai_usage_log migration pattern
provides:
  - household-level generation preference storage on public.households
  - household-scoped Spoonacular quota log table for Settings/debug reads
  - explicit one-hour TTL contract for recipe_cache rows
  - directive-hash lookup table for cache-first repeat searches
affects: [Phase 14 coordinator functions, Phase 14 Settings quota UI, Phase 15 draft generation pipeline]
tech-stack:
  added: []
  patterns: [forward-only compliance migrations, owner-scoped RLS reads, one-hour TTL enforcement]
key-files:
  created:
    - supabase/migrations/20260417000007_spoonacular_usage_log.sql
    - supabase/migrations/20260417000008_recipe_cache_compliance.sql
    - supabase/migrations/20260417000009_recipe_cache_directive_lookup.sql
  modified:
    - supabase/migrations/20260417000006_household_generation_preferences.sql
key-decisions:
  - "Keep household generation preferences on public.households as JSONB rather than adding a new table."
  - "Log Spoonacular daily_limit per request because pricing assumptions changed on 2026-04-17."
  - "Enforce one-hour cache TTL through explicit expires_at columns and CHECK constraints instead of app-only convention."
patterns-established:
  - "Quota logs can be user-readable through owner-scoped SELECT policies while writes remain service-role only."
  - "Repeat-query caching uses a dedicated directive lookup table instead of overloading recipe_cache payloads."
requirements-completed: [SEARCH-01, SEARCH-03, SEARCH-04]
duration: 4min
completed: 2026-04-17
---

# Phase 14 Plan 01: Schema Compliance and Quota Foundations Summary

**Household generation preferences, Spoonacular quota logging, one-hour cache compliance, and directive-hash lookup scaffolding for grounded search**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-17T21:19:20Z
- **Completed:** 2026-04-17T21:23:01Z
- **Tasks:** 4
- **Files modified:** 4

## Accomplishments
- Preserved the locked 2D generation preference contract on `public.households` for selected days, meal types, and matrix storage.
- Added a household-scoped `spoonacular_usage_log` table with owner-safe reads for Settings/debug quota visibility.
- Introduced explicit one-hour TTL enforcement for `recipe_cache` and a dedicated directive lookup table for cache-first repeat searches.

## Task Commits

Each task was committed atomically where changes were required:

1. **Task 1: Add persistent household generation preferences per D-03 and D-04** - `52ef22d` (pre-existing at `HEAD`)
2. **Task 2: Add Spoonacular usage logging and owner-scoped quota reads per D-05** - `d9e96f1` (feat)
3. **Task 3: Make recipe cache compliance explicit instead of carrying forward the 30-day assumption** - `473c09e` (fix)
4. **Task 4: Add a directive-hash lookup layer so cache-first search is structurally correct** - `62f40a8` (feat)

## Files Created/Modified
- `supabase/migrations/20260417000006_household_generation_preferences.sql` - Adds `generation_preferences` JSONB with the locked day x meal matrix contract and shape check.
- `supabase/migrations/20260417000007_spoonacular_usage_log.sql` - Creates per-household Spoonacular quota logs with owner-scoped `SELECT`.
- `supabase/migrations/20260417000008_recipe_cache_compliance.sql` - Adds `expires_at`, backfills one-hour TTLs, and enforces max cache lifetime.
- `supabase/migrations/20260417000009_recipe_cache_directive_lookup.sql` - Creates directive-hash to `spoonacular_id` lookup rows with one-hour TTL enforcement.

## Decisions Made

- Stored generation preferences on `public.households` to match the existing owner-based RLS boundary and avoid a new preferences table.
- Logged `daily_limit` on every Spoonacular request so later code can honor the current limit even if the UI still shows the locked `150 pts today` contract.
- Kept directive hashes out of `recipe_cache.raw_data` and used a dedicated lookup table to separate recipe payload caching from repeat-query reuse.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Task 1's migration file already existed in `HEAD` when execution started, so no new code change or task-specific commit was necessary for that file during this run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 14 can now build coordinator and recipe-search code against stable generation preference, quota logging, and compliant cache contracts.
- Settings/debug quota reads have an RLS-safe table to consume in later plans.

## Known Stubs

None — all plan outputs are concrete SQL migrations with explicit constraints and indexes.

## Self-Check: PASSED

Files exist:
- FOUND: supabase/migrations/20260417000006_household_generation_preferences.sql
- FOUND: supabase/migrations/20260417000007_spoonacular_usage_log.sql
- FOUND: supabase/migrations/20260417000008_recipe_cache_compliance.sql
- FOUND: supabase/migrations/20260417000009_recipe_cache_directive_lookup.sql
- FOUND: .planning/phases/14-spoonacular-integration-ai-coordinator/14-01-SUMMARY.md

Commits exist:
- FOUND: 52ef22d
- FOUND: d9e96f1
- FOUND: 473c09e
- FOUND: 62f40a8
