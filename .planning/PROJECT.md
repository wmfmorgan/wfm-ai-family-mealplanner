# Project: wfm-ai-family-mealplanner

## Context
A web-based family meal planner where a single logged-in user manages a household with multiple nutrition profiles. The AI generates personalized weekly meal plans based on dietary style, calorie targets, macro splits, allergies, avoidances, skills, and appliances.

## Tech Stack
- **Frontend**: React + Vite (TS)
- **UI**: Google Stitch (Vanilla CSS) — [WFM-AI-MEALPLANNER](https://stitch.google.com/projects/15134141823727190585)
- **Backend/Auth/DB**: Supabase
- **AI Layer**: Supabase Edge Functions (Deno)
- **AI Providers**: Gemini, Grok, Ollama (Direct local call for dev)
- **Deployment**: Netlify (Frontend), Supabase (Backend)

## Current Milestone: v4.0 Overhaul AI Architecture

**Goal:** Replace AI-invented recipes with database-grounded meals from Spoonacular, implement lazy-save draft workflow, and consolidate all LLM calls through a shared client with enforced token controls.

**Target features:**
- Shared AI client (`_shared/ai-client.ts`) — role-based temp/max_tokens, token logging, provider resolution
- AI Coordinator outputs search directives (`select-meals` Edge Function)
- Recipe lookup via Spoonacular with local cache (`recipe-search` Edge Function, `recipe_cache` table)
- AI Adapter for allergy substitutions/serving scale (`adapt-recipe` Edge Function)
- Lazy-save: generation → draft in React state → explicit save to DB
- Programmatic post-assembly allergy/constraint scan
- Fallback AI generation flagged in data (`source_provider: 'ai-generated'`) and UI
- RecipeDetail supports draft mode (React state) and persisted mode (DB)
- Shopping list uses Spoonacular aisle data — categorizer eliminated
- Bulk DB inserts on save (replaces N+1 pattern)

## Current State
- **Shipped Version**: v3.0 (Meal Generation Refinement)
- **Phase 13 complete** — Foundation & Database Migrations: `_shared/` AI client modules + 5 DB migrations deployed
- **Latest Features**: 
    - Granular slot control (Delete/Refresh).
    - Multi-agent coordinator-worker architecture for meal generation.
    - Editorial progress indicators.

## Validated Requirements (Phase 13)
- **INFRA-01** — Shared AI client with role-based temperature/max_tokens enforcement *(Validated in Phase 13: Foundation & Database Migrations)*
- **INFRA-02** — Token usage logging to `ai_usage_log` table *(Validated in Phase 13)*
- **INFRA-03** — Provider resolution from env vars in shared client *(Validated in Phase 13)*
- **INFRA-04** — `recipe_cache` table with JSONB, GIN index, 30-day TTL *(Validated in Phase 13)*
- **INFRA-05** — `recipes` table with source tracking columns (source_provider NOT NULL, source_id, image_url) *(Validated in Phase 13)*
- **INFRA-06** — `shopping_list_items` with aisle/amount/unit columns *(Validated in Phase 13)*

## Milestones
- **v1.0**: Initial MVP — COMPLETED
- **v2.0**: Desktop UI Refactor — COMPLETED
- **v3.0**: Meal Generation Refinement — COMPLETED

## Configuration & Style
- **Aesthetic**: Minimalist, earthy tones ("Verdant Table" / "Warm Paper").
- **Typography**: Newsreader (Serif) for headings, Manrope (Sans-Serif) for UI.
- **Security**: Row Level Security (RLS) for data privacy.
- **Configuration**: AI providers/models configurable via environment variables.

<details>
<summary>Archived Project Context (v1.x - v2.x)</summary>

### Features (v2.0)
- Desktop-optimized Shell, Landing, and Household Profiles.
- Verified visual alignment with Stitch editorial aesthetic.
- Enhanced Dietary Selection.

### Features (v1.0)
- Supabase Auth (Email/Magic Links)
- Household & Profile Management
- Weekly Meal Planner Calendar
- AI Meal Generation
- Recipe Detail View
- Consolidated Shopping List (Basic grouping)
- AI Settings & Debug Page
</details>

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-17 after Phase 13 complete*
