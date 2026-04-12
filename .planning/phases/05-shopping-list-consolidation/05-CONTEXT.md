# Phase 5 Context: Shopping List & Consolidation

## Phase Goals
Implement a dedicated shopping list experience that automatically extracts, categorizes, and groups ingredients from the current weekly meal plan.

## Implementation Decisions

### 1. Data Structure & Categorization
- **Strategy:** Post-Process Categorization.
- **Process:** Ingredients remain as simple strings in the `recipes` table (e.g., "1 cup Milk").
- **Categorization Step:** When a meal plan is generated or updated, a secondary Edge Function task will process unique ingredients and assign them to categories (Produce, Dairy, Pantry, etc.).
- **Storage:** A new table `public.shopping_list_items` will store the categorized items for each meal plan to avoid redundant AI calls.

### 2. Consolidation Logic
- **Grouping:** Simple Grouping by Category.
- **Merging:** Items will NOT be merged (e.g., "Dairy: 1 cup Milk, 2 cups Milk" will appear as two distinct lines). This avoids complexity and errors in unit conversion.

### 3. UI & Navigation
- **Location:** A new "Shopping" tab will be added to the `BottomTabBar`.
- **Layout:** A clean, vertical list grouped by category headings.
- **Features:** 
    - **Interactive Checklist:** Items can be tapped/clicked to "check off" (transient state, not persisted to DB).
    - **Print Mode:** CSS print styles to ensure the shopping list prints cleanly on a single page.

### 4. Technical Constraints
- **Backend:** Supabase Edge Functions (Deno) for categorization logic.
- **State Management:** Shopping list is derived from the `active` meal plan for the current household.
- **Visuals:** Follow the established "Cookbook" aesthetic (minimalist earthy tones).

## Schema Changes (Planned)
- `shopping_list_items` table:
    - `id` (UUID)
    - `meal_plan_id` (UUID, FK to `meal_plans`)
    - `original_string` (TEXT)
    - `category` (TEXT)
    - `is_checked` (BOOLEAN, default false - *Optional: User said "Checklist UI" but not "Persist Checks", so we might just use local React state or still use DB for better mobile experience if requested later*)
    - *Wait, user explicitly chose "Checklist UI" but NOT "Persist Checks" in the multi-select. I will use local state for now.*

## Open Questions (Deferred to Implementation)
- What are the "standard" categories we want to use? (Produce, Dairy, Meat, Pantry, Frozen, etc.)
- Should we add a "Manual Add" feature for the shopping list? (Likely Phase 6 or Backlog).
