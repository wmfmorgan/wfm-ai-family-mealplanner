# Phase 4: Meal Planner Core - Research

**Researched:** 2026-04-11
**Domain:** Meal Planning, AI Integration, React Calendar UI
**Confidence:** HIGH

## Summary

This research establishes the technical foundation for the core meal planning experience. We define a multi-table database schema for persistence, a structured AI prompt for the "multi-recipe hybrid" strategy, and a React component architecture for the Sunday-start weekly calendar.

**Primary recommendation:** Use a junction table for meal plan slots to support the "Lock & Edit" feature, and update the existing `ai-proxy` Edge Function to support structured JSON output from Gemini/Grok.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase | ^2.40.0 | Database & Auth | Project standard for persistence and RLS. |
| React | ^18.2.0 | Frontend Framework | Project standard for UI. |
| Deno | 1.40.0 | Edge Functions | Supabase standard for server-side logic. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| `date-fns` | ^3.0.0 | Date Manipulation | For week-start/end calculations and Sun-Sat ranges. |
| Vanilla CSS | — | Styling | Mandatory project constraint (no Tailwind). |

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   └── MealPlanner/
│       ├── PlannerGrid.tsx      # Main 7-day layout
│       ├── DayColumn.tsx        # Vertical container for a day
│       ├── MealSlot.tsx         # Individual slot (Breakfast, etc.)
│       └── GenerationPanel.tsx  # Sidebar controls for AI
└── lib/
    └── services/
        └── planner.ts           # DB logic for saving/loading plans
```

### Pattern 1: Junction-Table Slots
Instead of a big JSONB blob for the entire week, use a separate `meal_plan_slots` table.
**Why:** Enables atomic updates (Lock & Edit), clean RLS, and easy joins for Phase 5's shopping list generation.

### Pattern 2: Multi-Recipe AI Response
AI returns a single JSON object containing a `recipes` list and a `week_plan` referencing those recipes by ID/index.
**Why:** Reduces token usage and simplifies deduplication before saving to the database.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date Parsing | Custom regex/logic | `date-fns` | Handles timezone offsets and leap years correctly. |
| JSON Schema | Custom validation | AI Provider Schema | Use `response_format` or native `response_schema` in Edge Functions. |
| Drag & Drop | Custom events | `dnd-kit` (future) | Revisit in Phase 6; for now, use simple click-to-edit. |

## Runtime State Inventory

> Skip (not a rename/migration phase).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | Local Dev | ✗ | — | Deploy to cloud/hosted project |
| Node.js | Local Dev | ✓ | v24.14.0 | — |
| Gemini API | AI Generation | ✓ | gemini-1.5-flash | — |

**Missing dependencies with no fallback:**
- None. Supabase local not being running doesn't block research or planning for cloud deployment.

## Common Pitfalls

### Pitfall 1: Ghost Leftovers
**What goes wrong:** AI suggests a leftover for a meal that was never cooked as an "anchor".
**Why it happens:** AI lacks strict inventory tracking in its context window.
**How to avoid:** Explicitly require "Anchor Recipes" and "Pivot Meals" in the prompt, and validate the `source_recipe` back-references in the app layer.

### Pitfall 2: Invalid JSON in Edge Functions
**What goes wrong:** `ai-proxy` fails to parse AI output if it includes markdown fences or invalid JSON.
**Why it happens:** LLMs sometimes wrap JSON in ```json blocks even when told not to.
**How to avoid:** Use `response_format: { type: 'json_object' }` and implement a "strip markdown fences" utility in the Edge Function if needed.

## Code Examples

### Database Schema (Migration Preview)
```sql
-- Private Recipes
CREATE TABLE public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id),
  name TEXT NOT NULL,
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  instructions JSONB NOT NULL DEFAULT '[]'::jsonb,
  nutrition JSONB DEFAULT '{}'::jsonb,
  prep_time_min INTEGER,
  cook_time_min INTEGER,
  servings INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Weekly Plans
CREATE TABLE public.meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id),
  week_start_date DATE NOT NULL,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Individual Slots
CREATE TABLE public.meal_plan_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_id UUID REFERENCES public.recipes(id),
  is_locked BOOLEAN DEFAULT false,
  manual_entry TEXT
);
```

### AI JSON Schema (GSD Preferred)
```json
{
  "recipes": [
    {
      "name": "Roasted Chicken",
      "ingredients": [...],
      "is_anchor": true
    }
  ],
  "plan": [
    {
      "day": 1,
      "meals": {
        "dinner": { "recipe_name": "Roasted Chicken" },
        "lunch": { "recipe_name": "Roasted Chicken", "is_leftover": true }
      }
    }
  ]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prompting for text | Structured JSON | 2024 (Gemini 1.5) | Zero-shot parsing with 100% reliability. |
| Global Recipes | Private Household Recipes | Project decision | Ensures strict privacy and RLS compliance. |

## Open Questions

1. **How to handle multi-week navigation?**
   - Recommendation: Use a URL state parameter `?week=YYYY-MM-DD` for easy bookmarking.
2. **Should "Locked" meals be excluded from the prompt entirely?**
   - Recommendation: Include them as "Constraints" in the system prompt so the AI can build the rest of the week around them.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|-------------------|
| PLAN-01 | Create meal plan | Integration | `npm test src/__tests__/meal-plan.test.ts` |
| PLAN-02 | AI Generation with leftovers | Integration | `npm test src/__tests__/ai-logic.test.ts` |
| PLAN-03 | Sunday-start layout | Unit | `npm test src/__tests__/calendar-ui.test.tsx` |

## Sources

### Primary (HIGH confidence)
- `GEMINI.md` - Technical mandates (Vanilla CSS, Supabase Edge Functions).
- `src/lib/ai/client.ts` - Verified existing AI calling pattern.
- Official Gemini/OpenAI Docs - `response_format` support for JSON.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Core tech is stable.
- Architecture: HIGH - Schema follows relational best practices.
- Pitfalls: MEDIUM - AI hallucinations are always a risk, mitigated by structured output.

**Research date:** 2026-04-11
**Valid until:** 2026-05-11
