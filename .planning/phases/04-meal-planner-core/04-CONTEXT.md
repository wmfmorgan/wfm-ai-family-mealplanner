# Phase 4: Meal Planner Core - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the core meal planning functionality, including the calendar-based weekly view (Sunday–Saturday), the selection logic for meals per day, and the integration with the AI Layer (Phase 3) for generating personalized meal plans. This phase also includes persisting these plans and their associated recipes in Supabase.

</domain>

<decisions>
## Implementation Decisions

### Calendar & UI
- **D-01: Sunday-Start Calendar.** Following standard US calendar conventions, the planner will display a 7-day view starting from Sunday.
- **D-02: Paginated Week (Sun–Sat).** Traditional navigation where users scroll week-to-week (Sun-Sat).
- **D-03: Meal Selection.** Users can select which meals (Breakfast, Lunch, Dinner, Snack) they want to generate for each day. Default is Breakfast, Lunch, and Dinner.

### AI & Strategy
- **D-04: Batch Generation (One-Click).** Users can generate the entire week's plan at once, then refine.
- **D-05: Leftover Strategy (User Input).** Before generation, users will indicate if they want the AI to prioritize "Cook once, eat twice" recipes that result in leftovers for subsequent meals.
- **D-06: Lock & Edit Workflow.** Users can "lock" specific meal slots they like and regenerate the rest of the plan. They can also manually edit the text of any slot before saving.
- **D-07: Global Household Complexity Setting.** A single "Complexity" preference (e.g., "Easy & Fast") is set in the household profile and applies to all generations.
- **D-08: Household Context Injection.** AI prompts are enriched with nutrition profiles and constraints for all household members.

### Data & Persistence
- **D-09: Household Private Recipes.** Every recipe generated is saved as a private copy for that household (no global sharing for now).
- **D-10: Weekly Versioning.** Meal plans are keyed by `household_id` and `week_start_date`.
- **D-11: Atomic Save.** Generated plans and their associated recipes are saved in a single transaction.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Roadmap
- `.planning/PROJECT.md` — Vision and tech stack (Supabase, React, Vanilla CSS).
- `.planning/ROADMAP.md` — Phase 4 goals and scope boundary.
- `.planning/REQUIREMENTS.md` — Core functional requirements.

### Database & Backend
- `supabase/migrations/20260411000000_initial_schema.sql` — Base user/household schema.
- `supabase/migrations/20260412000000_household_refinements.sql` — Profile schema.

### AI Infrastructure
- `src/lib/ai/client.ts` — Frontend client for interacting with AI proxy.
- `src/lib/ai/logger.ts` — Observability for AI generation calls.
- `supabase/functions/ai-proxy/index.ts` — Server-side AI logic (Deno).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/Layout/Shell.tsx` — Main application shell and layout.
- `src/lib/ai/client.ts` — Pre-built abstraction for calling the AI proxy.
- `src/lib/ai/logger.ts` — Logging utilities for generation debugging.

### Established Patterns
- **Supabase Edge Functions**: All AI calls must go through the `ai-proxy` function.
- **Vanilla CSS**: No Tailwind allowed; all UI must use vanilla CSS components.

### Integration Points
- **Calendar**: Needs to integrate with `src/components/Layout/Shell.tsx`.
- **Database**: New tables for `meal_plans` and `recipes` (private to household) are required.

</code_context>

<specifics>
## Specific Ideas

- The "Lock & Edit" interaction should be highly tactile, fitting the "cookbook" vibe.
- Leftover prioritization should be a simple toggle/checkbox in the generation UI.

</specifics>

<deferred>
## Deferred Ideas

- **Global Recipe Sharing**: Shared library features are deferred to a future phase.
- **Advanced Shopping List Logic**: Grouping/consolidation logic is deferred to Phase 5.

</deferred>

---

*Phase: 04-meal-planner-core*
*Context gathered: 2026-04-11*
