---
phase: 14-spoonacular-integration-ai-coordinator
plan: 04
subsystem: ui
tags: [react, supabase, spoonacular, settings, meal-planner]
requires:
  - phase: 14-spoonacular-integration-ai-coordinator
    provides: select-meals and recipe-search edge functions with grounded slot payloads
provides:
  - Settings-managed household generation matrix persisted on households.generation_preferences
  - Frontend service layer for select-meals, recipe-search, and quota reads
  - Immediate meal-plan persistence that keeps grounded recipe metadata and provider shopping fields
affects: [phase-15-draft-workflow, phase-16-ui-updates-ai-safety, settings, meal-planner]
tech-stack:
  added: []
  patterns: [frontend-orchestrated generation pipeline, persisted generation-scope settings, direct shopping-list hydration from provider payloads]
key-files:
  created: [src/lib/services/spoonacular.ts, src/__tests__/settings-partial-generation.test.tsx, src/__tests__/settings-quota.test.tsx]
  modified: [src/lib/services/household.ts, src/lib/services/planner.ts, src/pages/Settings/Settings.tsx, src/pages/Settings/DebugLog.tsx, src/pages/MealPlanner/MealPlanner.tsx, src/components/MealPlanner/GenerationPanel.tsx, src/__tests__/meal-plan.test.tsx]
key-decisions:
  - "MealPlanner reloads persisted household generation preferences at generation time so Settings remains the source of truth for scope."
  - "Immediate persistence now inserts shopping_list_items directly from grounded shopping_items and only falls back to categorize-ingredients when aisle data is missing or the recipe is AI-generated."
patterns-established:
  - "Frontend Spoonacular access lives in src/lib/services/spoonacular.ts instead of page-level Supabase function calls."
  - "Settings matrix edits derive selected_days and selected_meals from matrix state before persistence."
requirements-completed: [SEARCH-01, SEARCH-03, SEARCH-04]
duration: 11min
completed: 2026-04-18
---

# Phase 14 Plan 04: Wire Settings and MealPlanner Summary

**Settings-owned generation scope, Spoonacular quota visibility, and two-step grounded planner saves with preserved recipe metadata**

## Performance

- **Duration:** 11 min
- **Started:** 2026-04-18T12:43:00Z
- **Completed:** 2026-04-18T12:54:27Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Added persisted household generation-preference helpers plus a dedicated frontend Spoonacular service for quota reads and function orchestration.
- Reworked Settings to edit the 3x7 generation matrix, derive summary fields from matrix state, and display Spoonacular quota in the debug surface.
- Replaced `generate-plan` with `select-meals` then `recipe-search`, while preserving `source_provider`, `source_id`, `image_url`, `aisle`, `amount`, and `unit` in the current save path.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add frontend services for household generation preferences and Spoonacular orchestration** - `42f8a0b` (feat)
2. **Task 2: Update Settings to edit the 2D generation matrix and show quota status in the debug surface** - `883cd14` (feat)
3. **Task 3: Replace generate-plan in MealPlanner and preserve grounded metadata in the current save path** - `b7f0a15` (feat)

## Files Created/Modified
- `src/lib/services/household.ts` - Added typed generation preference contracts plus read/write helpers.
- `src/lib/services/spoonacular.ts` - Added frontend quota lookup and two-step Edge Function invocation helpers.
- `src/pages/Settings/Settings.tsx` - Loads household preferences, renders the 3x7 matrix, and passes quota state to the debug UI.
- `src/pages/Settings/DebugLog.tsx` - Renders a compact Spoonacular quota summary above the existing AI interaction log.
- `src/lib/services/planner.ts` - Preserves grounded recipe metadata and hydrates shopping list rows directly from provider shopping items.
- `src/pages/MealPlanner/MealPlanner.tsx` - Orchestrates `select-meals` then `recipe-search` and saves the returned grounded slots.
- `src/components/MealPlanner/GenerationPanel.tsx` - Removes snack generation and treats meal scope as Settings-managed.
- `src/__tests__/settings-partial-generation.test.tsx` - Covers matrix rendering, sparse toggles, and derived summary fields.
- `src/__tests__/settings-quota.test.tsx` - Covers quota rendering and the empty-log default state.
- `src/__tests__/meal-plan.test.tsx` - Covers the two-step generation flow and grounded metadata preservation.

## Decisions Made
- Settings is now the persistent source of truth for planner generation scope; MealPlanner only reads and displays that scope.
- Shopping list rows are written from returned `shopping_items` instead of reconstructing all grounded ingredients through AI categorization.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
Phase 15 can now build draft-state orchestration on top of the grounded slot payload and Settings-owned generation scope.
Phase 16 can use the preserved `source_provider`, `source_id`, `image_url`, and shopping-list aisle metadata for UI treatments without reopening Phase 14 persistence work.

## Self-Check: PASSED
- Verified `.planning/phases/14-spoonacular-integration-ai-coordinator/14-04-SUMMARY.md` exists.
- Verified task commits `42f8a0b`, `883cd14`, and `b7f0a15` exist in git history.
