---
phase: 13-foundation-database-migrations
plan: 02
subsystem: database
tags: [migrations, schema, recipe-cache, ai-usage-log, spoonacular, shopping-list]
dependency_graph:
  requires: []
  provides: [recipe_cache table, ai_usage_log table, recipes.source_provider column, shopping_list_items aisle/amount/unit columns]
  affects: [Phase 14 Spoonacular search, Phase 14/16 quota UI, Plan 03 bulk-save RPC]
tech_stack:
  added: []
  patterns: [IF NOT EXISTS idempotent migrations, 3-step NOT NULL backfill, GIN index on JSONB, RLS service-role only]
key_files:
  created:
    - supabase/migrations/20260417000001_recipe_cache.sql
    - supabase/migrations/20260417000002_extend_recipes.sql
    - supabase/migrations/20260417000003_extend_shopping_list.sql
    - supabase/migrations/20260417000004_ai_usage_log.sql
  modified: []
decisions:
  - "recipe_cache RLS enabled with no user policy — service-role only until Phase 14/16"
  - "ai_usage_log household_id nullable — not all AI calls have an associated household"
  - "source_provider 3-step sequence: ADD nullable -> UPDATE backfill -> SET NOT NULL + CHECK constraint"
  - "shopping_list amount uses NUMERIC not FLOAT for exact fractional quantity support"
metrics:
  duration: "52 seconds"
  completed: "2026-04-17T19:10:02Z"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
requirements: [INFRA-02, INFRA-04, INFRA-05, INFRA-06]
---

# Phase 13 Plan 02: Database Schema Migrations Summary

**One-liner:** Four SQL migration files extend the schema for Phase 14+ with recipe_cache (GIN-indexed JSONB), source_provider tracking on recipes (3-step NOT NULL backfill + CHECK constraint), aisle/amount/unit on shopping_list_items, and ai_usage_log for token monitoring.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create recipe_cache and ai_usage_log migration files | c57e225 | 20260417000001_recipe_cache.sql, 20260417000004_ai_usage_log.sql |
| 2 | Create extend_recipes and extend_shopping_list migration files | 0a73e51 | 20260417000002_extend_recipes.sql, 20260417000003_extend_shopping_list.sql |

## What Was Built

Four migration files (timestamps 20260417000001–20260417000004) that sort after the existing 20260415000000_shopping_list.sql:

**20260417000001_recipe_cache.sql** — New `public.recipe_cache` table for Spoonacular 30-day cache-first lookup. Columns: id UUID, spoonacular_id INTEGER NOT NULL UNIQUE, title TEXT NOT NULL, ready_in_minutes INTEGER, servings INTEGER, image_url TEXT, raw_data JSONB NOT NULL, created_at TIMESTAMPTZ. GIN index on raw_data for JSONB containment queries. B-tree indexes on spoonacular_id and created_at. RLS enabled, no user policy (service-role only).

**20260417000002_extend_recipes.sql** — Extends `public.recipes` with source tracking via 3-step NOT NULL backfill: (1) ADD COLUMN source_provider TEXT nullable, (2) UPDATE backfill all existing rows to 'ai-generated', (3) ALTER COLUMN SET NOT NULL + ADD CONSTRAINT CHECK (spoonacular | ai-generated). Also adds: source_id TEXT, is_adapted BOOLEAN NOT NULL DEFAULT false, adaptations JSONB, image_url TEXT.

**20260417000003_extend_shopping_list.sql** — Extends `public.shopping_list_items` with three nullable columns: aisle TEXT, amount NUMERIC (exact, not FLOAT), unit TEXT. All nullable to support AI-generated items that have no Spoonacular aisle data.

**20260417000004_ai_usage_log.sql** — New `public.ai_usage_log` table for token monitoring. All 10 columns from D-04: id, role, provider, model, prompt_tokens, completion_tokens, total_tokens, edge_function, household_id (nullable UUID FK to households), created_at. Composite index (household_id, created_at) for quota queries. RLS enabled, service role writes bypass RLS automatically.

## Verification

- All 4 migration files exist and sort correctly after 20260415000000
- 3-step NOT NULL sequence verified via grep (ADD line 7, UPDATE line 14, SET NOT NULL line 17, ADD CONSTRAINT line 18)
- No CREATE POLICY statements in recipe_cache or ai_usage_log (service-role only confirmed)
- npm test: 64 tests passed (19 test files) — no regressions

## Decisions Made

- `recipe_cache` has RLS enabled but no user-facing SELECT policy — access via service role only until Phase 14/16 adds quota UI
- `ai_usage_log.household_id` is nullable because system-level AI calls (not tied to a household) must still be logged
- `shopping_list_items.amount` uses NUMERIC not FLOAT to correctly represent fractional quantities (0.5, 1.25) without floating-point precision loss
- All 4 files use `IF NOT EXISTS` / `IF NOT EXISTS` guards for idempotency (safe to re-run)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — these are pure schema migration files with no application logic. No stubs.

## Self-Check: PASSED

Files exist:
- FOUND: /Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/migrations/20260417000001_recipe_cache.sql
- FOUND: /Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/migrations/20260417000002_extend_recipes.sql
- FOUND: /Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/migrations/20260417000003_extend_shopping_list.sql
- FOUND: /Users/jabroni/Projects/wfm-ai-family-mealplanner/supabase/migrations/20260417000004_ai_usage_log.sql

Commits exist:
- FOUND: c57e225 (Task 1)
- FOUND: 0a73e51 (Task 2)
