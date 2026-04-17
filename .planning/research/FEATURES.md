# Feature Research

**Domain:** Grounded recipe search, lazy-save drafts, and AI adaptation for family meal planner
**Researched:** 2026-04-16
**Confidence:** MEDIUM (Spoonacular API details based on training data -- stable API but verify endpoint params against current docs)

## Feature Landscape

### Table Stakes (Users Expect These)

Features that are non-negotiable for the v4.0 milestone. Missing any of these means the grounded-recipe architecture is incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Recipe search by keyword via Spoonacular `complexSearch` | Core value prop -- real recipes replace AI-invented ones | MEDIUM | New `recipe-search` Edge Function. Maps to `GET /recipes/complexSearch?query=...&addRecipeNutrition=true&number=10`. Returns recipe summaries with IDs. |
| Diet filter on search (vegetarian, vegan, keto, paleo, etc.) | Household profiles already store dietary style; search must honor it | LOW | Spoonacular `diet` param. Map existing `nutrition_profile.dietary_style` values to Spoonacular diet strings. |
| Allergen/intolerance exclusion on search | Household profiles store allergies; ignoring them is dangerous | LOW | Spoonacular `intolerances` param accepts comma-separated list (dairy, egg, gluten, grain, peanut, seafood, sesame, shellfish, soy, sulfite, tree nut, wheat). Map `nutrition_profile.allergies` array. |
| Full recipe detail from Spoonacular (`getRecipeInformation`) | Users need real ingredients, real instructions, real nutrition | MEDIUM | `GET /recipes/{id}/information?includeNutrition=true`. Returns `extendedIngredients` (with `aisle`, `amount`, `unit`), `analyzedInstructions`, `nutrition.nutrients[]`, `readyInMinutes`, `servings`, `sourceUrl`, `creditsText`. |
| Source attribution on recipes | Spoonacular TOS requires crediting source; users need trust signal | LOW | Display `creditsText` and `sourceUrl` from Spoonacular response. Badge: "From [source]" or "Verified Recipe". |
| AI-generated fallback with explicit labeling | When Spoonacular returns no results for niche constraints, system must still produce meals | MEDIUM | Existing `generate-plan` pattern adapted. Add `source_provider` field to recipe schema: `'spoonacular'`, `'ai-generated'`. UI shows distinct badge/warning for AI-generated recipes. |
| Lazy-save draft workflow (generate -> review -> save) | Current system auto-saves on generate (N+1 inserts). Users need to review before committing to DB | HIGH | Largest architectural change. Generation returns data to React state (not DB). New `draftPlan` state in MealPlanner. RecipeDetail must render from both draft (in-memory) and persisted (DB) sources. Save button triggers bulk insert. |
| Bulk DB insert on save | Current N+1 recipe insert loop (line 82-101 in planner.ts) is slow and fragile | MEDIUM | Replace sequential `for` loop with single Supabase RPC or batch insert. Requires new `save_meal_plan` RPC function in Postgres for transactional safety. |
| Shopping list from Spoonacular aisle data | Spoonacular `extendedIngredients[].aisle` provides grocery-store categorization for free -- eliminates the LLM categorization call entirely | MEDIUM | Replace `categorize-ingredients` Edge Function. Map Spoonacular aisles to display categories. Aisle values: "Produce", "Meat", "Baking", "Spices and Seasonings", "Milk, Eggs, Other Dairy", etc. Need a mapping table from Spoonacular aisles to the app's 12 categories. |
| Recipe caching (local DB cache of Spoonacular results) | Spoonacular free tier has 150 requests/day. Caching prevents re-fetching same recipes | MEDIUM | New `recipe_cache` table: `spoonacular_id` (unique), `data` (JSONB), `fetched_at` (timestamp). TTL-based expiry (e.g., 7 days). Check cache before API call. |

### Differentiators (Competitive Advantage)

Features that elevate the product beyond "yet another meal planner with Spoonacular."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI Coordinator outputs search directives (not recipes) | The coordinator LLM becomes a meal-planning strategist: it decides *what to search for* (cuisine themes, protein rotation, variety rules) then Spoonacular provides the actual recipes. Best of both worlds -- AI creativity + grounded data. | HIGH | Rearchitect `generate-plan` Edge Function. Coordinator returns `{ slots: [{ query: "chicken stir fry", diet: "gluten free", cuisine: "asian", maxReadyTime: 30 }] }` instead of full recipes. New `select-meals` function processes directives into Spoonacular searches. |
| AI Adapter for recipe modification | Allergy substitution ("replace peanuts with sunflower seeds"), serving scale with proportional adjustment, skill simplification ("make this beginner-friendly"). Real recipe as base + AI intelligence for customization. | MEDIUM | New `adapt-recipe` Edge Function. Takes Spoonacular recipe + modification request. LLM returns modified recipe with `source_provider: 'ai-adapted'` and reference to original `spoonacular_id`. |
| Programmatic post-assembly allergy/constraint scan | After AI coordinator selects meals and Spoonacular returns recipes, run a deterministic scan across ALL ingredients to catch allergen violations the search filter missed (e.g., hidden dairy in a sauce) | MEDIUM | Pure code -- no LLM needed. Compare all `extendedIngredients[].name` against household allergy list. Flag violations in UI before save. Runs on draft state, so user sees warnings before committing. |
| Cuisine filter on search | Lets coordinator specify cuisines for variety ("Monday: Italian, Tuesday: Thai") | LOW | Spoonacular `cuisine` param. Values: african, american, british, cajun, caribbean, chinese, eastern european, european, french, german, greek, indian, irish, italian, japanese, jewish, korean, latin american, mediterranean, mexican, middle eastern, nordic, southern, spanish, thai, vietnamese. |
| Calorie range filtering | Coordinator can target calorie ranges per meal type (light breakfast, hearty dinner) | LOW | Spoonacular `minCalories`/`maxCalories` params on complexSearch. Map from household `calorie_target` split across meal types. |
| Max ready time filtering | Coordinator can factor in skill level and available time | LOW | Spoonacular `maxReadyTime` param. Useful for weeknight dinners vs weekend meals. |
| Draft-mode recipe detail with edit affordances | RecipeDetail component shows "Draft" badge, allows swap/refresh before save. Different visual treatment from persisted recipes. | LOW | Conditional rendering in existing RecipeDetail. Add `isDraft` prop. Show "Swap" and "Refresh" buttons in draft mode. |
| Hybrid source display | When a plan has mix of Spoonacular and AI-generated recipes, shopping list clearly separates "verified ingredients" from "AI-estimated ingredients" | LOW | UI distinction only. Filter shopping items by `source_provider` of their parent recipe. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time Spoonacular search-as-you-type | "Let users search recipes directly" | Burns API quota fast (150 calls/day free tier). Each keystroke = API call. Also fragments the UX -- the value is AI-curated plans, not manual browsing. | AI coordinator handles search. If user wants to swap a single slot, provide a focused "find alternative" action that does one targeted search. |
| Full offline recipe database | "Cache everything so it works offline" | Spoonacular has 5,000+ recipes. Caching all is impractical and violates TOS. | Cache only recipes the user has actually viewed or saved. TTL-based expiry. |
| User-contributed recipes mixed with Spoonacular | "Let me add my own recipes alongside API ones" | Mixes verified/unverified data. Nutrition becomes unreliable. Shopping list aisle data unavailable for user recipes. | Defer to future milestone. If added, keep `source_provider: 'user'` and show clear distinction. AI adapter can help estimate nutrition for user recipes later. |
| Automatic re-generation on profile change | "When I update allergies, regenerate the whole plan" | Expensive (multiple API calls + LLM calls). May discard meals user already approved. | Show a warning banner: "Profile changed -- some meals may not match new preferences. Review or regenerate." Let user decide. |
| Spoonacular meal plan endpoint | "Use Spoonacular's built-in meal plan generation" | Their `/mealplanner/generate` endpoint is rigid -- limited customization, no household multi-profile support, doesn't integrate with the app's AI coordinator strategy. | Use `complexSearch` with AI-generated directives for full control over meal selection logic. |
| Ingredient quantity aggregation in shopping list | "Combine '2 cups flour' from recipe A and '1 cup flour' from recipe B into '3 cups flour'" | Unit conversion is error-prone (tablespoons vs cups vs grams). Spoonacular provides amounts in mixed units. | Show ingredients grouped by aisle but listed per-recipe. Users mentally combine. Future: use Spoonacular's "compute shopping list" endpoint if quantity aggregation becomes critical. |

## Feature Dependencies

```
[Spoonacular Recipe Search]
    |-- requires --> [recipe_cache table + TTL logic]
    |-- requires --> [Spoonacular API key in env]
    |-- enables --> [Grounded Recipe Detail]
    |                   |-- enables --> [Aisle-based Shopping List]
    |                   |-- enables --> [Source Attribution UI]
    |
    |-- enables --> [AI Coordinator Search Directives]
                        |-- requires --> [Existing coordinator-worker architecture]
                        |-- requires --> [Household profile dietary data]
                        |-- enables --> [Post-Assembly Allergy Scan]
                        |-- enables --> [AI Adapter (modify recipes)]

[Lazy-Save Draft Workflow]
    |-- requires --> [React draft state management]
    |-- requires --> [Bulk DB insert RPC]
    |-- enables --> [Draft-mode RecipeDetail]
    |-- enables --> [Post-Assembly Allergy Scan] (scans draft before save)
    |-- conflicts --> [Current auto-save-on-generate pattern] (must replace it)

[AI-Generated Fallback]
    |-- requires --> [source_provider column on recipes table]
    |-- requires --> [Existing generate-plan Edge Function]
    |-- enables --> [Hybrid source display in UI]

[Aisle-based Shopping List]
    |-- requires --> [Grounded Recipe Detail] (needs extendedIngredients with aisle)
    |-- conflicts --> [categorize-ingredients Edge Function] (replaces it)
```

### Dependency Notes

- **AI Coordinator Search Directives requires Spoonacular Recipe Search:** The coordinator generates search queries; the search function executes them. Must build search first.
- **Lazy-Save conflicts with current auto-save:** The existing `handleGenerate` in MealPlanner.tsx calls `saveMealPlan` immediately after generation (line 284). This must be replaced with draft state population. Breaking change to the generation flow.
- **Post-Assembly Allergy Scan requires both Lazy-Save and Search Directives:** It scans the draft plan (from lazy-save state) using ingredient data (from Spoonacular search results). Both must exist first.
- **Aisle-based Shopping List replaces categorize-ingredients:** The `categorize-ingredients` Edge Function (LLM-based) becomes dead code once Spoonacular aisle data is available. Don't maintain both paths.
- **recipe_cache must exist before any Spoonacular search:** Without caching, the 150 calls/day free tier will be exhausted in a single plan generation (7 days x 3 meals = 21 searches + 21 detail fetches = 42 calls minimum per generation).

## MVP Definition

### Launch With (v4.0 Core)

Minimum viable grounded-recipe architecture. Everything below must ship together.

- [ ] **Spoonacular `complexSearch` integration** -- New `recipe-search` Edge Function with diet, intolerance, cuisine, calorie, and readyTime params
- [ ] **Spoonacular `getRecipeInformation` integration** -- Fetch full recipe detail with nutrition and aisle data
- [ ] **Recipe cache table** -- `recipe_cache` with `spoonacular_id`, `data` JSONB, `fetched_at`, 7-day TTL
- [ ] **`source_provider` column on recipes** -- Discriminator: `'spoonacular'` | `'ai-generated'` | `'ai-adapted'`
- [ ] **AI Coordinator rearchitecture** -- Coordinator outputs search directives instead of full recipes
- [ ] **Lazy-save draft workflow** -- Generation populates React state; explicit "Save Plan" button triggers bulk insert
- [ ] **Bulk save RPC** -- Postgres function for transactional recipe + slot insert (replaces N+1 loop)
- [ ] **Source attribution in RecipeDetail** -- Badge showing "Verified Recipe" vs "AI-Generated"
- [ ] **Aisle-based shopping list** -- Map Spoonacular aisle strings to app categories; eliminate `categorize-ingredients`
- [ ] **AI-generated fallback** -- When Spoonacular returns no results for a slot, fall back to LLM generation with explicit labeling

### Add After Validation (v4.x)

Features to add once grounded architecture is working and stable.

- [ ] **AI Adapter for recipe modification** -- Trigger: users request allergy subs, serving scale, or skill simplification on specific recipes
- [ ] **Programmatic allergy scan** -- Trigger: first user report of an allergen slipping through search filters
- [ ] **Draft-mode visual treatment** -- Trigger: user confusion about what's saved vs unsaved (may ship with core if trivial)
- [ ] **Cuisine diversity enforcement** -- Trigger: coordinator producing monotonous plans

### Future Consideration (v5+)

- [ ] **User-contributed recipes** -- Defer until grounded architecture is proven. Adds complexity to nutrition display and shopping list.
- [ ] **Ingredient quantity aggregation** -- Defer until users report shopping list is too long. Complex unit conversion problem.
- [ ] **Recipe images from Spoonacular** -- Spoonacular provides `image` URLs. Low effort but may conflict with app's editorial aesthetic. Evaluate after v4.0 ships.
- [ ] **Spoonacular "similar recipes" for swap** -- Use `/recipes/{id}/similar` to offer alternatives when user wants to swap a single slot.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Depends On |
|---------|------------|---------------------|----------|------------|
| Spoonacular complexSearch integration | HIGH | MEDIUM | P1 | API key, recipe_cache |
| Recipe cache table + TTL | HIGH | LOW | P1 | DB migration |
| Lazy-save draft workflow | HIGH | HIGH | P1 | React state redesign |
| AI Coordinator -> search directives | HIGH | HIGH | P1 | Spoonacular search |
| source_provider column + migration | HIGH | LOW | P1 | DB migration |
| Bulk save RPC | HIGH | MEDIUM | P1 | DB migration |
| Full recipe detail fetch | HIGH | MEDIUM | P1 | Spoonacular search |
| Source attribution UI | MEDIUM | LOW | P1 | source_provider |
| Aisle-based shopping list | HIGH | MEDIUM | P1 | Full recipe detail |
| AI-generated fallback | MEDIUM | LOW | P1 | Existing generate-plan |
| AI Adapter (modify recipe) | MEDIUM | MEDIUM | P2 | Full recipe detail |
| Post-assembly allergy scan | MEDIUM | MEDIUM | P2 | Lazy-save, full recipe detail |
| Cuisine/calorie/time filters | MEDIUM | LOW | P2 | Spoonacular search |
| Draft-mode RecipeDetail UI | LOW | LOW | P2 | Lazy-save |
| Hybrid source shopping list display | LOW | LOW | P3 | source_provider, aisle list |

**Priority key:**
- P1: Must have for v4.0 launch -- grounded architecture is incomplete without it
- P2: Should have, add in v4.x once core is stable
- P3: Nice to have, future consideration

## Existing Code Impact Analysis

Understanding what changes vs what stays for each feature area.

| Existing Code | Status in v4.0 | Why |
|---------------|-----------------|-----|
| `generate-plan` Edge Function | **REARCHITECT** | Coordinator output changes from recipes to search directives. Workers replaced by Spoonacular search calls. |
| `refresh-slot` Edge Function | **REARCHITECT** | Must use Spoonacular search for single-slot refresh instead of LLM generation. |
| `categorize-ingredients` Edge Function | **DEPRECATE** | Replaced by Spoonacular aisle data. Remove after aisle-based list ships. |
| `ai-proxy` Edge Function | **KEEP** | Still needed for coordinator LLM calls and AI adapter. |
| `planner.ts` service | **REARCHITECT** | `saveMealPlan` becomes bulk-save. New `getDraftPlan` pattern. Remove N+1 recipe insert loop. |
| `RecipeDetail.tsx` | **EXTEND** | Add `isDraft` mode, source attribution, nutrition from Spoonacular format. |
| `ShoppingList.tsx` | **REARCHITECT** | Switch from `shopping_list_items` table (LLM-categorized) to deriving from recipe `extendedIngredients[].aisle`. |
| `MealPlanner.tsx` | **REARCHITECT** | Add draft state, remove auto-save, add "Save Plan" button, add generation progress for multi-step flow. |
| `PlannerGrid.tsx` / `MealSlot.tsx` | **EXTEND** | Show draft vs saved visual state. Source badges on slots. |
| DB `recipes` table | **EXTEND** | Add `source_provider`, `spoonacular_id`, `source_url` columns. |
| DB `shopping_list_items` table | **EVALUATE** | May keep for persisted shopping lists but populate from aisle data instead of LLM. |

## Spoonacular API Key Constraints

**MEDIUM confidence -- based on training data, verify against current pricing page.**

| Tier | Daily Requests | Cost | Notes |
|------|---------------|------|-------|
| Free | 150 points/day | $0 | Each complexSearch = 1 point, each getRecipeInformation = 1 point. ~75 recipe lookups/day. |
| Basic | 1,500 points/day | ~$30/mo | Comfortable for single-household dev + testing. |

**Implication:** A single plan generation (7 days x 3 meals = 21 slots) requires at minimum 21 search calls + 21 detail calls = 42 API points. Free tier supports ~3 full generations per day. Caching is mandatory, not optional.

## Sources

- Spoonacular API documentation (training data, MEDIUM confidence -- stable API, unlikely to have changed core endpoints but verify pricing/limits)
- Existing codebase analysis (HIGH confidence -- direct code inspection)
- Meal planning domain patterns (MEDIUM confidence -- general domain knowledge)

---
*Feature research for: Grounded recipe search, lazy-save drafts, AI adaptation*
*Researched: 2026-04-16*
