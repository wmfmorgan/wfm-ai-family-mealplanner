# Architecture Patterns

**Domain:** AI-powered family meal planner -- integrating Spoonacular API, shared AI client, and lazy-save into existing Supabase Edge Function architecture
**Researched:** 2026-04-16

## Current Architecture (Baseline)

Understanding what exists is critical before designing integration points.

### Existing Edge Functions

| Function | Role | AI Provider Logic | DB Access |
|----------|------|-------------------|-----------|
| `generate-plan` | Coordinator + 3 parallel workers (breakfast/lunch/dinner) | Duplicated: inline provider resolution, inline `callAI` helper | None -- returns JSON to frontend, frontend saves |
| `refresh-slot` | Single-recipe regeneration | Duplicated: identical provider resolution block | None -- returns JSON to frontend, frontend saves |
| `ai-proxy` | Generic AI router (prompt in, completion out) | Centralized provider routing | None |
| `categorize-ingredients` | Shopping list categorization | Delegates to `ai-proxy` via internal fetch | Writes `shopping_list_items` via service role |

### Current Data Flow (Generate)

```
Frontend (MealPlanner.tsx)
  --> supabase.functions.invoke('generate-plan')
  --> Edge Function: coordinator call + 3 parallel worker calls (direct to Gemini/Grok)
  <-- Returns { days: [...], theme, blueprint }
  --> Frontend: plannerService.saveMealPlan()
      --> Insert recipes one-by-one (N+1 pattern)
      --> Upsert meal_plan
      --> Delete + insert meal_plan_slots
      --> Fire-and-forget: categorize-ingredients
```

### Key Problems in Current Architecture

1. **Provider resolution duplicated** in `generate-plan`, `refresh-slot`, and `ai-proxy` (3 places, ~20 identical lines each)
2. **No token controls** -- no `max_tokens` or `temperature` enforcement per role
3. **AI-invented recipes** -- LLM hallucinates recipe names, ingredients, and instructions with no grounding
4. **Immediate save** -- generation triggers DB writes before user reviews the plan
5. **N+1 recipe inserts** -- `saveMealPlan` loops `INSERT` per recipe instead of bulk
6. **`ai-proxy` underused** -- only `categorize-ingredients` calls it; the two main functions bypass it entirely
7. **No `_shared` directory** -- no Deno shared modules exist yet

## Recommended Architecture (v4.0)

### Component Map

```
supabase/functions/
  _shared/
    ai-client.ts          [NEW] Shared AI client -- replaces all duplicated provider logic
    cors.ts               [NEW] Shared CORS headers (DRY)
    supabase-client.ts    [NEW] Shared authenticated Supabase client factory
  select-meals/
    index.ts              [NEW] AI Coordinator -- outputs search directives, not recipes
  recipe-search/
    index.ts              [NEW] Spoonacular lookup + recipe_cache read/write
  adapt-recipe/
    index.ts              [NEW] AI Adapter -- allergy subs, serving scale
  generate-plan/
    index.ts              [MODIFY] Refactor to use _shared/ai-client, keep as legacy fallback
  refresh-slot/
    index.ts              [MODIFY] Refactor to use _shared/ai-client, add Spoonacular path
  ai-proxy/
    index.ts              [DEPRECATE] Replaced by _shared/ai-client; keep temporarily for categorize-ingredients
  categorize-ingredients/
    index.ts              [DEPRECATE] Spoonacular aisle data replaces AI categorization

src/
  lib/services/
    planner.ts            [MODIFY] Add draft workflow, bulk save, new Edge Function calls
  components/MealPlanner/
    RecipeDetail.tsx       [MODIFY] Support draft mode (React state) + persisted mode (DB)
    MealSlot.tsx           [MODIFY] Show source badge (Spoonacular vs AI-generated)
  pages/MealPlanner/
    MealPlanner.tsx        [MODIFY] Draft state management, deferred save
  contexts/
    DraftPlanContext.tsx   [NEW] React context for draft meal plan state
```

### New vs Modified Components (Explicit)

| Component | Status | Depends On |
|-----------|--------|------------|
| `_shared/ai-client.ts` | NEW | Nothing (foundational) |
| `_shared/cors.ts` | NEW | Nothing |
| `_shared/supabase-client.ts` | NEW | Nothing |
| `recipe_cache` table | NEW | Migration only |
| `recipes` table columns | MODIFY | Migration (add `source_id`, `source_provider`, `is_adapted`, `adaptations`) |
| `select-meals` Edge Function | NEW | `_shared/ai-client.ts` |
| `recipe-search` Edge Function | NEW | `recipe_cache` table, Spoonacular API key |
| `adapt-recipe` Edge Function | NEW | `_shared/ai-client.ts` |
| `generate-plan` | MODIFY | `_shared/ai-client.ts` (refactor to import) |
| `refresh-slot` | MODIFY | `_shared/ai-client.ts` (refactor to import) |
| `DraftPlanContext.tsx` | NEW | Nothing (React context) |
| `planner.ts` service | MODIFY | New Edge Functions, `DraftPlanContext` |
| `RecipeDetail.tsx` | MODIFY | Draft context |
| `MealPlanner.tsx` | MODIFY | `DraftPlanContext`, new service methods |
| `categorize-ingredients` | DEPRECATE | Replaced by Spoonacular aisle data |
| `ai-proxy` | DEPRECATE | Replaced by `_shared/ai-client.ts` |

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `_shared/ai-client.ts` | Provider resolution, API key lookup, role-based temperature/max_tokens, token logging, response parsing, markdown fence stripping | Called by `select-meals`, `adapt-recipe`, `generate-plan` (refactored), `refresh-slot` (refactored) |
| `select-meals` | Takes household profiles + constraints, returns structured search directives (cuisine, diet, intolerances, max prep time) per slot -- NOT recipe names | Calls `_shared/ai-client.ts`. Called by frontend orchestrator. |
| `recipe-search` | Receives search directives, checks `recipe_cache`, calls Spoonacular `complexSearch` + `informationBulk` if cache miss, writes cache, returns recipe data | Reads/writes `recipe_cache`. Called by frontend orchestrator after `select-meals`. |
| `adapt-recipe` | Takes a Spoonacular recipe + adaptation instructions (allergy subs, serving scale), returns modified recipe | Calls `_shared/ai-client.ts`. Called by frontend orchestrator when adaptations needed. |
| `DraftPlanContext` | Holds generated meal plan in React state before user commits. Provides `draftPlan`, `updateSlot`, `saveDraft`, `discardDraft`. | Read by `RecipeDetail`, `MealSlot`, `PlannerGrid`. Written by orchestration logic in `MealPlanner.tsx`. |

## Data Flow: New Generate Path

```
1. User clicks "Generate" in MealPlanner.tsx
   |
2. Frontend calls select-meals Edge Function
   |  Input: { members, selected_meals, constraints }
   |  Output: { directives: [{ day, meal_type, search_params: { query, cuisine, diet, intolerances, maxReadyTime } }] }
   |
3. Frontend calls recipe-search Edge Function (can batch multiple directives)
   |  Input: { directives: [...] }
   |  For each directive:
   |    a. Check recipe_cache (keyed on normalized search params hash)
   |    b. Cache HIT  --> return cached Spoonacular data
   |    c. Cache MISS --> call Spoonacular complexSearch + informationBulk
   |                  --> write to recipe_cache (JSONB, 30-day TTL)
   |                  --> return fresh data
   |  Output: { results: [{ day, meal_type, recipe: SpoonacularRecipe }] }
   |
4. Frontend checks constraints (programmatic allergy/constraint scan)
   |  Any violations? --> call adapt-recipe Edge Function
   |  Input: { recipe, adaptations: { substitutions: [...], target_servings: N } }
   |  Output: { adapted_recipe: {..., is_adapted: true, adaptations: [...]} }
   |
5. Frontend stores result in DraftPlanContext (React state)
   |  NO database writes yet
   |  RecipeDetail renders from draft state
   |  User can review, swap slots, refresh individual meals
   |
6. User clicks "Save" explicitly
   |  Frontend calls plannerService.saveDraftPlan()
   |    --> Bulk insert recipes (with source_id, source_provider, is_adapted)
   |    --> Upsert meal_plan
   |    --> Bulk insert meal_plan_slots
   |    --> Shopping list uses Spoonacular aisle data (no AI categorization needed)
```

### Data Flow: Refresh Single Slot (v4.0)

```
1. User clicks refresh on a slot
   |
2. Frontend calls select-meals with single-slot context + exclusion list
   |  Output: single search directive
   |
3. Frontend calls recipe-search with that directive
   |  Output: replacement recipe from Spoonacular
   |
4. Constraint check --> optional adapt-recipe call
   |
5. Update DraftPlanContext (if in draft mode) or direct save (if persisted plan)
```

### Data Flow: Fallback (Spoonacular fails or returns no results)

```
1. recipe-search returns empty or errors
   |
2. Frontend falls back to generate-plan (refactored, uses _shared/ai-client.ts)
   |  AI generates recipe directly (as today)
   |  Recipe marked: source_provider = 'ai-generated'
   |
3. UI shows badge: "AI-generated recipe" (visual distinction)
```

## Database Changes

### New Table: `recipe_cache`

```sql
CREATE TABLE IF NOT EXISTS public.recipe_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,          -- hash of normalized search params
  spoonacular_id INTEGER NOT NULL,
  recipe_data JSONB NOT NULL,              -- full Spoonacular recipe JSON
  aisle_data JSONB DEFAULT '[]'::jsonb,    -- ingredient aisle mappings
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX idx_recipe_cache_key ON public.recipe_cache(cache_key);
CREATE INDEX idx_recipe_cache_spoonacular_id ON public.recipe_cache(spoonacular_id);
CREATE INDEX idx_recipe_cache_data ON public.recipe_cache USING GIN(recipe_data);
CREATE INDEX idx_recipe_cache_expires ON public.recipe_cache(expires_at);
```

**RLS:** This is a shared cache (not per-household). Use service role key in `recipe-search` Edge Function for reads/writes. No user-facing RLS policy needed -- users never query this table directly.

**TTL enforcement:** A Supabase cron job (pg_cron) or the `recipe-search` function itself can prune expired rows: `DELETE FROM recipe_cache WHERE expires_at < now()`.

### Modified Table: `recipes` (add columns)

```sql
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS source_id INTEGER;          -- Spoonacular recipe ID
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS source_provider TEXT DEFAULT 'ai-generated';  -- 'spoonacular' | 'ai-generated'
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS is_adapted BOOLEAN DEFAULT false;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS adaptations JSONB DEFAULT '[]'::jsonb;        -- list of modifications made
```

## Patterns to Follow

### Pattern 1: Shared Deno Module via `_shared/`

**What:** Supabase Edge Functions support importing from `_shared/` using relative paths. All functions in `supabase/functions/` can import from `supabase/functions/_shared/`.

**When:** Any logic used by 2+ Edge Functions.

**Example:**

```typescript
// supabase/functions/_shared/ai-client.ts
export interface AIClientConfig {
  role: 'coordinator' | 'adapter' | 'worker' | 'categorizer';
}

const ROLE_DEFAULTS: Record<string, { temperature: number; max_tokens: number }> = {
  coordinator: { temperature: 0.7, max_tokens: 2000 },
  adapter:     { temperature: 0.3, max_tokens: 1500 },
  worker:      { temperature: 0.8, max_tokens: 3000 },
  categorizer: { temperature: 0.1, max_tokens: 1000 },
};

export async function callAI(
  system: string,
  userPrompt: string,
  config: AIClientConfig
): Promise<any> {
  const provider = resolveProvider();  // single place for provider resolution
  const defaults = ROLE_DEFAULTS[config.role];
  // ... single implementation of fetch, response parsing, fence stripping, logging
}

function resolveProvider(): { apiUrl: string; apiKey: string; model: string } {
  // Single source of truth for provider resolution
  // Replaces the ~20 lines duplicated in generate-plan, refresh-slot, ai-proxy
}
```

```typescript
// supabase/functions/select-meals/index.ts
import { callAI } from "../_shared/ai-client.ts";
```

**Why:** Eliminates the provider resolution duplication that currently exists in 3 functions. When a new provider is added, change one file.

### Pattern 2: Frontend Orchestrator (not Edge Function orchestrator)

**What:** The frontend (React) orchestrates the multi-step flow: `select-meals` -> `recipe-search` -> `adapt-recipe` -> draft state. Each Edge Function is a focused, single-responsibility unit.

**When:** The orchestration involves client-side state transitions (draft management, progress UI) and conditional branching (skip adaptation if no constraints violated).

**Why NOT a server-side orchestrator:** The current `generate-plan` is already called from the frontend which manages progress indicators. Moving orchestration server-side would lose the ability to update progress steps ("Searching recipes...", "Adapting for allergies...") and would make the function too long-running for Edge Function timeouts (default 60s, max 150s on Pro).

**Example flow in MealPlanner.tsx:**

```typescript
const handleGenerate = async () => {
  setGenerationStep('Planning your meals...');
  const directives = await invokeSelectMeals(members, selectedMeals, constraints);

  setGenerationStep('Finding recipes...');
  const recipes = await invokeRecipeSearch(directives);

  setGenerationStep('Checking dietary needs...');
  const adapted = await checkAndAdaptRecipes(recipes, members);

  // Store in draft context -- NO DB write
  draftPlan.setDraft(adapted);
  setGenerationStep('');
};
```

### Pattern 3: Cache-Key Normalization

**What:** The `recipe_cache` uses a deterministic hash of normalized search parameters as the cache key.

**When:** Any Spoonacular search lookup.

**Example:**

```typescript
function buildCacheKey(params: SearchParams): string {
  // Sort keys, lowercase values, remove empty strings
  const normalized = {
    cuisine: (params.cuisine || '').toLowerCase().trim(),
    diet: (params.diet || '').toLowerCase().trim(),
    intolerances: (params.intolerances || []).sort().join(',').toLowerCase(),
    query: (params.query || '').toLowerCase().trim(),
    maxReadyTime: params.maxReadyTime || 0,
    type: (params.type || '').toLowerCase().trim(),
  };
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(normalized)))
    .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
}
```

**Why:** Prevents duplicate Spoonacular API calls for semantically identical queries. Spoonacular has a quota (150 requests/day on free tier, varies by plan).

### Pattern 4: Draft State via React Context

**What:** A `DraftPlanContext` holds the generated plan in memory. Components read from draft state for display. Only an explicit "Save" action persists to the database.

**When:** After generation, before the user commits.

**Example:**

```typescript
interface DraftMealPlan {
  days: DraftDay[];
  theme?: string;
  isDirty: boolean;
}

interface DraftDay {
  day: number;
  breakfast: DraftRecipe | null;
  lunch: DraftRecipe | null;
  dinner: DraftRecipe | null;
}

interface DraftRecipe {
  // Superset of Recipe -- includes source metadata
  name: string;
  spoonacular_id?: number;
  source_provider: 'spoonacular' | 'ai-generated';
  is_adapted: boolean;
  adaptations: string[];
  ingredients: any[];
  instructions: any[];
  aisle_data?: any[];  // from Spoonacular, for shopping list
  // ... other fields
}
```

**Why:** The existing code in `MealPlanner.tsx` immediately calls `saveMealPlan` after generation (line 285). This couples generation to persistence. Lazy-save lets users review, swap, and discard before committing. It also eliminates wasted DB writes for plans the user rejects.

### Pattern 5: Bulk Database Operations

**What:** Replace the N+1 recipe insert loop with a single bulk insert, and use an RPC function for transactional save.

**When:** On explicit "Save" of draft plan.

**Example:**

```sql
-- RPC function for atomic meal plan save
CREATE OR REPLACE FUNCTION save_meal_plan_bulk(
  p_household_id UUID,
  p_week_start_date DATE,
  p_recipes JSONB,
  p_slots JSONB
) RETURNS UUID AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  -- Upsert meal plan
  INSERT INTO meal_plans (household_id, week_start_date, status)
  VALUES (p_household_id, p_week_start_date, 'active')
  ON CONFLICT (household_id, week_start_date)
  DO UPDATE SET status = 'active'
  RETURNING id INTO v_plan_id;

  -- Bulk insert recipes and slots in single statements
  -- (detailed implementation in build phase)

  RETURN v_plan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Why:** The current `saveMealPlan` in `planner.ts` (lines 82-100) loops over recipes with individual `INSERT`/`UPSERT` calls. For a full week (21 meals), that is 21 recipe inserts + 21 slot inserts = 42 sequential DB calls. A bulk RPC reduces this to 1 call.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Server-Side Orchestrator Edge Function

**What:** Creating a single `generate-plan-v2` Edge Function that calls `select-meals`, `recipe-search`, and `adapt-recipe` internally.

**Why bad:** Supabase Edge Functions have a 60-second default timeout (150s max on Pro). A chain of AI call + multiple Spoonacular calls + potential adaptation calls could easily exceed this. Also loses frontend progress indication.

**Instead:** Frontend orchestrates the calls sequentially, updating UI state between each step.

### Anti-Pattern 2: Caching Full Spoonacular Responses Without TTL

**What:** Storing Spoonacular data indefinitely in `recipe_cache`.

**Why bad:** Recipe data can change (Spoonacular updates nutrition info, fixes errors). Also, the cache table grows unbounded.

**Instead:** 30-day TTL with `expires_at` column. Prune via pg_cron or on-read cleanup.

### Anti-Pattern 3: Passing Spoonacular API Key to Frontend

**What:** Calling Spoonacular directly from the React app.

**Why bad:** Exposes API key in browser. Spoonacular keys have daily quotas -- any user could exhaust the quota. No cache layer.

**Instead:** All Spoonacular calls go through the `recipe-search` Edge Function which holds the key as a Supabase secret and enforces caching.

### Anti-Pattern 4: Sharing `ai-proxy` via Internal HTTP Fetch

**What:** The current `categorize-ingredients` pattern of calling `ai-proxy` via `fetch(supabaseUrl + '/functions/v1/ai-proxy')`.

**Why bad:** Each internal fetch is a separate cold-start-eligible invocation with network overhead, CORS handling, and doubled auth validation. It is also fragile (circular dependency risk, auth token forwarding complexity).

**Instead:** Import `_shared/ai-client.ts` directly. No network hop. No cold start. No CORS. This is exactly why the `_shared/` pattern exists.

### Anti-Pattern 5: Storing Draft State in the Database

**What:** Writing `status: 'draft'` meal plans to the database before user confirms.

**Why bad:** Creates orphan records when users discard plans. Complicates queries (must filter `status != 'draft'` everywhere). The current code already writes `status: 'draft'` (line 109 of planner.ts) which is never updated to 'active'.

**Instead:** Draft lives purely in React state (`DraftPlanContext`). Only the explicit "Save" action writes to the database with `status: 'active'`.

## Spoonacular API Integration Details

### Key Endpoints

| Endpoint | Purpose | Quota Cost |
|----------|---------|------------|
| `GET /recipes/complexSearch` | Search recipes by diet, cuisine, intolerances, ready time, etc. | 1 point |
| `GET /recipes/informationBulk` | Get full recipe details for up to 100 IDs in one call | 1 point |
| `GET /recipes/{id}/information` | Single recipe full details (fallback) | 1 point |

### Search Directive to Spoonacular Mapping

```
AI Coordinator Output         -->  Spoonacular complexSearch Params
---------------------------------------------------------------
{ query: "Mediterranean" }    -->  ?query=Mediterranean
{ cuisine: "Italian" }        -->  &cuisine=Italian
{ diet: "vegetarian" }        -->  &diet=vegetarian
{ intolerances: ["gluten"] }  -->  &intolerances=gluten
{ maxReadyTime: 30 }          -->  &maxReadyTime=30
{ type: "main course" }       -->  &type=main+course
```

### Quota Management Strategy

- **Free tier:** 150 points/day. Enough for ~7 generations/day (each generation: 1 complexSearch per meal type x 3 = 3 points, plus 1 informationBulk = 4 points total, cached thereafter).
- **Cache-first:** Always check `recipe_cache` before calling Spoonacular. A second generation with similar parameters costs 0 API points.
- **Batch informationBulk:** After complexSearch returns IDs, fetch details for all IDs in one `informationBulk` call (up to 100 IDs) instead of individual calls.

### Environment Variable

```
SPOONACULAR_API_KEY=your-key-here
```

Added to `supabase/functions/.env` and Supabase Secrets for production.

## Suggested Build Order

The build order is driven by dependency chains: foundational pieces first, then functions that import them, then frontend that calls them.

### Phase 1: Foundation (no dependencies)

| Task | Type | Rationale |
|------|------|-----------|
| `_shared/ai-client.ts` | NEW | Every new Edge Function imports this. Must exist first. |
| `_shared/cors.ts` | NEW | DRY the CORS headers duplicated in every function. |
| `_shared/supabase-client.ts` | NEW | DRY the Supabase client creation duplicated in every function. |
| `recipe_cache` migration | NEW | `recipe-search` needs this table. |
| `recipes` table migration (add columns) | MODIFY | New columns needed before recipes with source data can be saved. |

### Phase 2: Edge Functions (depend on Phase 1)

| Task | Type | Rationale |
|------|------|-----------|
| `recipe-search` Edge Function | NEW | Spoonacular integration + cache. No AI dependency -- can be tested independently with manual search params. |
| `select-meals` Edge Function | NEW | AI Coordinator producing search directives. Depends on `_shared/ai-client.ts`. |
| `adapt-recipe` Edge Function | NEW | AI Adapter. Depends on `_shared/ai-client.ts`. Can be tested independently with a hardcoded recipe + substitution request. |
| Refactor `generate-plan` | MODIFY | Import `_shared/ai-client.ts` to replace inline provider logic. Keep existing behavior as fallback path. |
| Refactor `refresh-slot` | MODIFY | Same refactor -- import shared client. |

**Why `recipe-search` before `select-meals`:** `recipe-search` can be tested with hardcoded search parameters, proving Spoonacular integration and caching work before adding the AI layer. `select-meals` output feeds into `recipe-search`, so having `recipe-search` solid first means you can validate the full chain immediately once `select-meals` is ready.

### Phase 3: Frontend Draft System (depends on Phase 2 partially)

| Task | Type | Rationale |
|------|------|-----------|
| `DraftPlanContext.tsx` | NEW | React context for draft state. Can be built and unit tested without backend. |
| `planner.ts` service updates | MODIFY | New methods: `invokeSelectMeals`, `invokeRecipeSearch`, `invokeAdaptRecipe`, `saveDraftPlan` (bulk). |
| `MealPlanner.tsx` orchestration | MODIFY | Wire up the new flow: select-meals -> recipe-search -> adapt -> draft context. |

### Phase 4: Frontend UI Updates (depends on Phase 3)

| Task | Type | Rationale |
|------|------|-----------|
| `RecipeDetail.tsx` draft mode | MODIFY | Read from draft context when in draft, from DB when persisted. Show source badge. |
| `MealSlot.tsx` source badges | MODIFY | Visual indicator for Spoonacular vs AI-generated. |
| Save/Discard UI controls | NEW | Explicit save button, discard confirmation. |
| Shopping list with Spoonacular aisle data | MODIFY | Use `aisle_data` from Spoonacular instead of AI categorization. |

### Phase 5: Cleanup (depends on Phases 1-4 working)

| Task | Type | Rationale |
|------|------|-----------|
| Deprecate `ai-proxy` | DEPRECATE | All callers now use `_shared/ai-client.ts`. Can remove after verifying nothing calls it. |
| Deprecate `categorize-ingredients` | DEPRECATE | Spoonacular aisle data replaces AI categorization. |
| Bulk save RPC function | NEW | Optional optimization -- replace sequential inserts with single RPC call. |
| pg_cron cache cleanup | NEW | Scheduled job to prune expired `recipe_cache` rows. |

### Dependency Graph

```
Phase 1: _shared/* + migrations
    |
    v
Phase 2: recipe-search  select-meals  adapt-recipe  (parallel-able)
    |          |              |
    v          v              v
Phase 3: Frontend orchestration + DraftPlanContext
    |
    v
Phase 4: UI updates (RecipeDetail, MealSlot, Save/Discard, Shopping)
    |
    v
Phase 5: Cleanup (deprecate ai-proxy, categorize-ingredients)
```

## Scalability Considerations

| Concern | Current (10 users) | At 100 users | At 1000 users |
|---------|-------------------|--------------|---------------|
| Spoonacular quota | Free tier (150/day) sufficient | Paid tier needed (~$30/mo for 1500/day) | Enterprise tier or aggressive caching |
| Recipe cache size | Negligible | ~5K rows, manageable | ~50K rows, GIN index matters, TTL pruning essential |
| AI API costs | Low (few generations/day) | Moderate | Consider caching AI coordinator outputs too |
| Edge Function cold starts | Unnoticeable | Minor (Supabase keeps warm) | Acceptable (Deno boot ~50ms) |
| Draft state memory | Trivial | Trivial (client-side only) | Trivial (client-side only) |

## Sources

- **Codebase analysis:** All 4 existing Edge Functions read and analyzed directly
- **Supabase Edge Functions shared modules:** Based on Supabase documentation for `_shared/` import pattern (MEDIUM confidence -- verified by Supabase's own examples and docs, but web search unavailable to confirm latest changes)
- **Spoonacular API:** Based on training data knowledge of their REST API (MEDIUM confidence -- endpoints and quota structure are stable and well-documented, but specific pricing/limits should be verified against current docs)
- **React Context patterns:** Standard React patterns (HIGH confidence)
- **PostgreSQL bulk operations:** Standard patterns (HIGH confidence)
