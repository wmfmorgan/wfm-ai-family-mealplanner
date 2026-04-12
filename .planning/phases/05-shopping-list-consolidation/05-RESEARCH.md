# Phase 05: Shopping List & Consolidation - Research

**Researched:** 2026-04-12
**Domain:** Ingredient Parsing, Grocery Categorization, Print Optimization
**Confidence:** HIGH

## Summary

Phase 05 focuses on transforming a weekly meal plan into an actionable shopping list. The core technical challenge is **categorization**—grouping disparate ingredient strings (e.g., "1 cup Milk", "2 Eggs") into standard grocery aisles (Produce, Dairy, etc.) to minimize backtracking in the store. Following the project's minimalist "cookbook" aesthetic, the implementation will favor clarity and reliability over complex mathematical merging.

**Primary recommendation:** Use **Supabase Edge Functions (Deno)** and **AI (Gemini/Grok)** for post-process categorization of ingredient strings. This leverages the AI's deep world knowledge of ingredient types without requiring a brittle hand-rolled database or regex-based parser.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Strategy:** Post-Process Categorization.
- **Process:** Ingredients remain as simple strings in the `recipes` table (e.g., "1 cup Milk").
- **Categorization Step:** When a meal plan is generated or updated, a secondary Edge Function task will process unique ingredients and assign them to categories (Produce, Dairy, Pantry, etc.).
- **Storage:** A new table `public.shopping_list_items` will store the categorized items for each meal plan to avoid redundant AI calls.
- **Grouping:** Simple Grouping by Category.
- **Merging:** Items will NOT be merged (e.g., "Dairy: 1 cup Milk, 2 cups Milk" will appear as two distinct lines). This avoids complexity and errors in unit conversion.
- **Location:** A new "Shopping" tab will be added to the `BottomTabBar`.
- **Layout:** A clean, vertical list grouped by category headings.
- **Features:** 
    - **Interactive Checklist:** Items can be tapped/clicked to "check off" (transient state, not persisted to DB).
    - **Print Mode:** CSS print styles to ensure the shopping list prints cleanly on a single page.
- **Backend:** Supabase Edge Functions (Deno) for categorization logic.
- **State Management:** Shopping list is derived from the `active` meal plan for the current household.
- **Visuals:** Follow the established "Cookbook" aesthetic (minimalist earthy tones).

### the agent's Discretion
- Standard categories to use (Produce, Dairy, Meat, Pantry, Frozen, etc.)
- UI details for the "Cookbook" style list.

### Deferred Ideas (OUT OF SCOPE)
- Manual Add feature for the shopping list (Phase 6 or Backlog).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHOP-01 | Category-based grouping | Standard grocery categories identified; AI prompt strategy defined for categorization. |
| SHOP-02 | Checklist UI | `localStorage` identified as the best "transient" persistence layer for mobile shoppers. |
| SHOP-03 | Print Mode | CSS `@media print` with `column-count` recommended for "Cookbook" aesthetic. |
| SHOP-04 | Persistence | New table `shopping_list_items` schema and Edge Function trigger flow established. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase Functions | v2.x | Deno-based Edge Functions | Secure AI routing and backend processing. |
| AI Proxy | 1.0.0 | Routing to Gemini/Grok | Standard project interface for AI capabilities. |
| Lucide React | 0.363.0 | Iconography (Checkboxes, Print) | Established project standard for UI icons. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| `clsx` | 2.1.0 | Conditional styling | Managing "checked" state styles in the UI. |
| `date-fns` | 4.1.0 | Date formatting | Generating the "Week of..." header for the shopping list. |

**Installation:**
```bash
# No new packages required. Use existing project libraries.
```

## Architecture Patterns

### Recommended Project Structure
```
supabase/
└── functions/
    └── categorize-ingredients/    # The categorization logic
src/
├── components/
│   └── MealPlanner/
│       ├── ShoppingList.tsx       # Main tab view
│       ├── ShoppingCategory.tsx   # Category grouping component
│       └── ShoppingItem.tsx       # Individual checkbox item
└── styles/
    └── print.css                  # Print-specific overrides
```

### Pattern 1: Post-Process AI Categorization
Instead of categorizing ingredients during recipe generation, we wait until the plan is viewed. This allows for batching and deduplication of the prompt.

**Workflow:**
1. Fetch all `meal_plan_slots` for the active `meal_plan_id`.
2. Map to `recipes` and extract all `ingredients[]`.
3. Filter unique strings to reduce AI token usage.
4. Pass unique strings to AI for categorization into a strict schema.
5. Store result in `shopping_list_items`.

### Pattern 2: Print Optimization
Use `column-count` to maximize paper usage while maintaining the minimalist aesthetic.

```css
@media print {
  body { background: white; color: black; }
  .no-print { display: none; }
  .shopping-list {
    column-count: 2;
    column-gap: 2rem;
  }
  .category-group {
    break-inside: avoid-column;
    margin-bottom: 1.5rem;
  }
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ingredient Logic | Custom Regex Parser | AI Proxy (Gemini/Grok) | "1 bunch Cilantro" vs "Cilantro (1 bunch)" is hard for regex, easy for AI. |
| Store Aisles | Manual Mapping DB | Standardized Category List | AI knows that "Cardamom" is a Spice and "Bok Choy" is Produce. |
| Unit Math | Unit Conversion Lib | Multi-line List | Per user decision: "No merging" prevents conversion errors. |

## Common Pitfalls

### Pitfall 1: AI Category Hallucinations
**What goes wrong:** The AI might return "Fresh Veggies" instead of "Produce".
**How to avoid:** Use a system prompt with a strict **enumerated list** of valid categories and request JSON output.

### Pitfall 2: Duplicate "Salt" Rows
**What goes wrong:** If 10 recipes use "Salt", the list shows "Salt" 10 times.
**How to avoid:** While we don't merge *quantities*, we should **deduplicate exact string matches** globally to avoid clutter.

### Pitfall 3: Mobile Layout Shifting
**What goes wrong:** Checking an item re-renders the whole list, causing scroll jump.
**How to avoid:** Use local React state for checkboxes and only sync to `localStorage` on a debounce or `useEffect`.

## Code Examples

### AI Prompt for Categorization
```typescript
const CATEGORIES = [
  "Produce", "Meat & Seafood", "Dairy & Eggs", 
  "Pantry & Grains", "Canned & Jarred", "Bakery", 
  "Frozen Foods", "Condiments & Spices", "Snacks & Sweets", 
  "Beverages", "Deli", "Household"
];

const systemPrompt = `
You are a grocery store organizer. 
Categorize the list of ingredients provided into exactly one of these categories: 
[${CATEGORIES.join(", ")}].
Return valid JSON: { "ingredient_string": "CategoryName" }.
`;
```

### Edge Function Logic (Deno)
```typescript
// supabase/functions/categorize-ingredients/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { meal_plan_id, ingredients } = await req.json();
  
  // 1. Deduplicate strings to save tokens
  const uniqueIngredients = [...new Set(ingredients)];
  
  // 2. Call AI Proxy for categorization
  // ... AI call logic ...

  // 3. Save to shopping_list_items
  // const { data, error } = await supabase.from('shopping_list_items').upsert(...)

  return new Response(JSON.stringify({ success: true }));
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Regex parsers | LLM Categorization | 2024 | Handles natural language ("a pinch", "to taste") perfectly. |
| Global DB of items | Context-aware AI | 2024 | No need to maintain a database of 10,000+ ingredients. |
| Print via Screenshot | Native CSS Print | - | High-legibility, searchable, ink-saving outputs. |

## Open Questions

1. **Checklist Persistence:**
   - What we know: User requested "transient state".
   - What's unclear: Does a "transient" list that resets on page refresh annoy users?
   - Recommendation: Use `localStorage` to persist checks for the duration of a shopping trip without needing DB storage.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | Edge Functions | ✓ | 2.84.2 | — |
| Deno | Edge Functions | ✓ | 1.x (CLI) | — |
| AI Proxy | Categorization | ✓ | — | — |

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
| SHOP-01 | Ingredients grouped by aisle | Unit | `npm test src/__tests__/shopping-logic.test.ts` |
| SHOP-03 | Print styles applied | Visual | Manual check via Print Emulation |

## Sources

### Primary (HIGH confidence)
- `05-CONTEXT.md` - Phase decisions on merging and UI.
- `package.json` - Verified library versions.
- Industry Standards - Standard grocery categories for 2025.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Core libraries are already in use.
- Architecture: HIGH - Matches existing AI Proxy patterns.
- Pitfalls: MEDIUM - Requires careful prompt engineering for AI stability.

**Research date:** 2026-04-12
**Valid until:** 2026-05-12
