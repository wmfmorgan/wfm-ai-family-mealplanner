---
phase: 13-foundation-database-migrations
plan: 03
subsystem: database
tags: [postgres, plpgsql, rpc, supabase, migration, security-definer, rls]

# Dependency graph
requires:
  - phase: 13-02
    provides: source_provider/source_id/image_url columns on recipes, aisle/amount/unit columns on shopping_list_items
provides:
  - save_meal_plan_bulk PL/pgSQL RPC function (atomic bulk insert for full week's meal plan)
  - GRANT EXECUTE TO authenticated for Supabase RPC access
affects:
  - phase-15 (Save This Plan button calls save_meal_plan_bulk)
  - phase-14 (recipe-search and select-meals produce payload matching this RPC's input shape)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SECURITY DEFINER + SET search_path = '' for RLS bypass with injection protection
    - auth.uid() ownership guard as first executable statement before all DML
    - FOR ... IN SELECT * FROM jsonb_array_elements(...) LOOP pattern for JSONB slot iteration
    - ON CONFLICT DO NOTHING on shopping_list_items for duplicate ingredient handling across slots
    - INSERT (not upsert) on meal_plans — UNIQUE constraint raises exception for duplicate weeks (D-12)

key-files:
  created:
    - supabase/migrations/20260417000005_bulk_save_rpc.sql
  modified: []

key-decisions:
  - "SECURITY DEFINER + SET search_path = '' required: bypasses RLS for atomic inserts while preventing search_path injection attacks"
  - "auth.uid() ownership guard is the first executable statement — no DML executes if caller doesn't own the household (Pitfall 3)"
  - "INSERT (not upsert) on meal_plans — UNIQUE constraint meal_plans_unique_week naturally enforces D-12 (no silent overwrite)"
  - "ON CONFLICT DO NOTHING on shopping_list_items — same ingredient across multiple slots in a week is idempotent"
  - "GRANT EXECUTE TO authenticated required — without it Supabase client cannot call the RPC"
  - "Returns UUID only (meal_plan_id) per D-11 — frontend already holds full draft data"

patterns-established:
  - "Bulk save RPC pattern: single JSONB payload, single transaction, ownership guard first, loop slots, return ID only"
  - "SECURITY DEFINER + SET search_path = '' as standard for all RPCs that need RLS bypass"

requirements-completed: [INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06]

# Metrics
duration: 1min
completed: 2026-04-17
---

# Phase 13 Plan 03: Bulk Save RPC Summary

**`save_meal_plan_bulk` PL/pgSQL RPC: atomic single-transaction insert of full week's meal plan into meal_plans, recipes, meal_plan_slots, and shopping_list_items with SECURITY DEFINER ownership guard**

## Performance

- **Duration:** 1 min
- **Started:** 2026-04-17T19:13:54Z
- **Completed:** 2026-04-17T19:14:40Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created `save_meal_plan_bulk` PL/pgSQL RPC as migration file `20260417000005_bulk_save_rpc.sql`
- Enforced household ownership via `auth.uid()` check before all DML (Pitfall 3 prevention)
- Atomic loop inserts recipe, meal_plan_slot, and shopping_list_items per slot — rollback on any failure
- UNIQUE constraint on `meal_plans` handles D-12 duplicate-week prevention without explicit RAISE
- `ON CONFLICT DO NOTHING` on shopping_list_items handles cross-slot duplicate ingredients gracefully

## Task Commits

Each task was committed atomically:

1. **Task 1: Create save_meal_plan_bulk RPC migration** - `be14f14` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `supabase/migrations/20260417000005_bulk_save_rpc.sql` - PL/pgSQL RPC function with SECURITY DEFINER, ownership guard, atomic inserts, and GRANT EXECUTE

## Decisions Made
- Followed plan specification exactly — all implementation details were fully specified in PLAN.md
- SECURITY DEFINER + SET search_path = '' required for the function to bypass RLS and insert on behalf of the caller
- INSERT (not upsert) on meal_plans: letting the UNIQUE constraint raise naturally is cleaner than an explicit RAISE (D-12)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The frontend test suite had 1 pre-existing failing test file (`household.test.tsx`) due to missing `VITE_SUPABASE_URL` env var in the test runner config — not related to this plan's changes. All 8 individual tests pass across the 3 other test files.

## User Setup Required

None - no external service configuration required. Migration will be applied by `supabase db reset` or `supabase db push` when deploying.

## Next Phase Readiness

- All 5 Wave 1+2 migration files are complete: 20260417000001 through 20260417000005
- `save_meal_plan_bulk` RPC is ready for Phase 15's "Save This Plan" button
- Phase 14 (recipe search + AI selection pipeline) can proceed — it will produce payloads matching this RPC's D-10 input shape
- Run `supabase db reset` to verify all 5 migrations apply cleanly

---
*Phase: 13-foundation-database-migrations*
*Completed: 2026-04-17*
