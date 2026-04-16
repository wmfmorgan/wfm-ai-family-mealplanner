# AI-Revised Recipe Plan: Coordinator + DB-Grounded Architecture

**Goal:** Shift AI from "recipe inventor" to "meal curator + adapter." Recipes come from a tested database (Spoonacular or Edamam). AI selects based on household profile and adapts when constraints require it. Nutrition, temperatures, cook times, and ingredient quantities become grounded in real data.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    USER CLICKS "GENERATE"                     │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│  PHASE 1: AI COORDINATOR (1 LLM call)                        │
│                                                              │
│  Input: household profile, dietary constraints, history,     │
│         available recipe tags from provider                  │
│  Output: 21 recipe search queries with constraints           │
│  Example: { day: 0, meal: "breakfast", query: "frittata",   │
│             diet: "gluten-free", maxReadyTime: 30,           │
│             excludeIngredients: "peanuts,shellfish" }         │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│  PHASE 2: RECIPE LOOKUP (0 LLM calls)                        │
│                                                              │
│  For each of 21 queries:                                     │
│    1. Check local cache (recipe_cache table in Supabase)     │
│    2. If miss → call Recipe API (Spoonacular or Edamam)      │
│    3. Cache result locally                                   │
│  Return: 21 full recipe objects with real nutrition/times     │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│  PHASE 3: AI ADAPTER (0-1 LLM calls, only when needed)      │
│                                                              │
│  Trigger conditions:                                         │
│    - Recipe contains an allergen → substitute ingredient     │
│    - Servings mismatch → scale quantities                    │
│    - Skill too advanced → simplify instructions              │
│    - Appliance missing → swap cooking method                 │
│  If no triggers fire → skip entirely (most common path)      │
│  Rule: modify existing recipe, never invent from scratch     │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│  PHASE 4: ASSEMBLE + RETURN                                  │
│                                                              │
│  21 grounded recipes → client                                │
│  Nutrition: from API (real data)                             │
│  Shopping list: from API ingredient data (no categorizer)    │
└──────────────────────────────────────────────────────────────┘
```

### LLM Call Reduction

| Scenario | Current Calls | New Calls |
|----------|--------------|-----------|
| Standard generation (no adaptations needed) | 5 (coordinator + 3 workers + categorizer) | **1** (coordinator only) |
| Generation with allergy substitutions | 5 | **2** (coordinator + adapter) |
| Single slot refresh | 1 | **0-1** (DB lookup, adapter if needed) |
| Ingredient categorization | 1 | **0** (categories from recipe API) |

---

## New Files

```
src/
  lib/
    recipe-api/
      types.ts              # Provider-agnostic recipe types
      provider.ts           # Provider interface + factory
      spoonacular.ts        # Spoonacular implementation
      edamam.ts             # Edamam implementation
      cache.ts              # Supabase recipe cache layer
      index.ts              # Public API: searchRecipes(), getRecipeById()
supabase/
  functions/
    recipe-search/index.ts  # Edge Function: search + cache recipes
    select-meals/index.ts   # Edge Function: AI coordinator (replaces generate-plan)
    adapt-recipe/index.ts   # Edge Function: AI adapter for substitutions
  migrations/
    YYYYMMDD_recipe_cache.sql  # recipe_cache table
```

---

## Step-by-Step Implementation

### Step 1: Provider-Agnostic Recipe Types

**File:** `src/lib/recipe-api/types.ts`

Define a unified recipe shape that both Spoonacular and Edamam map into. This is the contract the rest of the app consumes.

```typescript
/**
 * Normalized recipe from any provider. All fields are grounded
 * in real data — no AI fabrication.
 */
export interface GroundedRecipe {
  source_id: string;            // Provider's recipe ID (e.g., spoonacular:716429)
  source_provider: 'spoonacular' | 'edamam';
  name: string;
  summary?: string;             // Short description
  image_url?: string;

  // Grounded fields — these come from tested recipes
  ingredients: GroundedIngredient[];
  instructions: GroundedInstruction[];
  nutrition: GroundedNutrition;
  prep_time_min: number;
  cook_time_min: number;
  total_time_min: number;
  servings: number;

  // Metadata for filtering
  diets: string[];              // ["gluten-free", "vegetarian", ...]
  dish_types: string[];         // ["breakfast", "main course", "salad", ...]
  cuisines: string[];           // ["mediterranean", "asian", ...]

  // Shopping list integration
  aisle_categories: string[];   // Grouped by grocery aisle from provider
}

export interface GroundedIngredient {
  name: string;                 // "all-purpose flour"
  amount: number;               // 2.5
  unit: string;                 // "cups"
  original_string: string;      // "2 1/2 cups all-purpose flour"
  aisle: string;                // "Baking" — from provider, not AI
}

export interface GroundedInstruction {
  step_number: number;
  text: string;
  temperature_f?: number;       // Grounded: 375, not hallucinated
  duration_minutes?: number;    // Grounded: 25, not hallucinated
}

export interface GroundedNutrition {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
  source: 'spoonacular' | 'edamam' | 'usda';  // Provenance tracking
}

/**
 * What the AI Coordinator outputs: a search directive, not a recipe.
 */
export interface MealSearchDirective {
  day_of_week: number;          // 0-6
  meal_type: 'breakfast' | 'lunch' | 'dinner';
  query: string;                // "mediterranean chickpea bowl"
  cuisine?: string;             // "italian"
  diet?: string;                // "vegetarian"
  max_ready_time?: number;      // minutes
  exclude_ingredients: string[];// from household allergies
  min_calories?: number;
  max_calories?: number;
}

/**
 * Adaptation request for the AI Adapter.
 */
export interface AdaptationRequest {
  recipe: GroundedRecipe;
  reason: 'allergy_substitution' | 'serving_scale' | 'skill_simplify' | 'appliance_swap';
  details: string;              // "substitute peanuts, household member allergic"
  target_servings?: number;
  available_appliances?: string[];
  cooking_skill?: string;
}

export interface AdaptedRecipe extends GroundedRecipe {
  is_adapted: true;
  original_source_id: string;
  adaptations: {
    reason: string;
    changes: string[];          // ["Replaced peanuts with sunflower seeds", "Adjusted quantity from 1/4 cup to 1/4 cup"]
  }[];
}
```

---

### Step 2: Provider Interface + Factory

**File:** `src/lib/recipe-api/provider.ts`

```typescript
import { GroundedRecipe, MealSearchDirective } from './types';

/**
 * Provider-agnostic interface. Spoonacular and Edamam both implement this.
 * Called from the recipe-search Edge Function, never from client directly.
 */
export interface RecipeProvider {
  readonly name: 'spoonacular' | 'edamam';

  /**
   * Search for recipes matching a directive.
   * Returns up to `limit` results, best match first.
   */
  search(directive: MealSearchDirective, limit?: number): Promise<GroundedRecipe[]>;

  /**
   * Fetch a single recipe by provider-specific ID.
   * Used for cache misses on refresh.
   */
  getById(sourceId: string): Promise<GroundedRecipe | null>;
}

/**
 * Factory — instantiated in Edge Functions using env vars.
 * Never instantiated on client (API keys stay server-side).
 */
export function createProvider(
  providerName: string,
  apiKey: string
): RecipeProvider {
  switch (providerName) {
    case 'spoonacular':
      // dynamic import to avoid bundling both
      const { SpoonacularProvider } = require('./spoonacular');
      return new SpoonacularProvider(apiKey);
    case 'edamam':
      const { EdamamProvider } = require('./edamam');
      return new EdamamProvider(apiKey);
    default:
      throw new Error(`Unknown recipe provider: ${providerName}`);
  }
}
```

---

### Step 3: Spoonacular Implementation

**File:** `src/lib/recipe-api/spoonacular.ts`

Maps Spoonacular's API response into `GroundedRecipe`.

```typescript
import { RecipeProvider, GroundedRecipe, GroundedIngredient,
         GroundedInstruction, GroundedNutrition, MealSearchDirective } from './types';

const BASE_URL = 'https://api.spoonacular.com';

export class SpoonacularProvider implements RecipeProvider {
  readonly name = 'spoonacular' as const;
  constructor(private apiKey: string) {}

  async search(directive: MealSearchDirective, limit = 3): Promise<GroundedRecipe[]> {
    const params = new URLSearchParams({
      apiKey: this.apiKey,
      query: directive.query,
      number: String(limit),
      addRecipeInformation: 'true',
      addRecipeNutrition: 'true',
      fillIngredients: 'true',
      instructionsRequired: 'true',
    });

    if (directive.diet) params.set('diet', directive.diet);
    if (directive.cuisine) params.set('cuisine', directive.cuisine);
    if (directive.max_ready_time) params.set('maxReadyTime', String(directive.max_ready_time));
    if (directive.exclude_ingredients.length > 0) {
      params.set('excludeIngredients', directive.exclude_ingredients.join(','));
    }
    if (directive.meal_type) params.set('type', this.mapMealType(directive.meal_type));
    if (directive.min_calories) params.set('minCalories', String(directive.min_calories));
    if (directive.max_calories) params.set('maxCalories', String(directive.max_calories));

    const res = await fetch(`${BASE_URL}/recipes/complexSearch?${params}`);
    if (!res.ok) throw new Error(`Spoonacular search failed: ${res.status}`);
    const data = await res.json();

    return (data.results || []).map((r: any) => this.normalize(r));
  }

  async getById(sourceId: string): Promise<GroundedRecipe | null> {
    const params = new URLSearchParams({
      apiKey: this.apiKey,
      includeNutrition: 'true',
    });
    const res = await fetch(`${BASE_URL}/recipes/${sourceId}/information?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    return this.normalize(data);
  }

  private normalize(raw: any): GroundedRecipe {
    return {
      source_id: `spoonacular:${raw.id}`,
      source_provider: 'spoonacular',
      name: raw.title,
      summary: raw.summary?.replace(/<[^>]+>/g, '').slice(0, 200),
      image_url: raw.image,
      ingredients: this.normalizeIngredients(raw.extendedIngredients || []),
      instructions: this.normalizeInstructions(raw.analyzedInstructions || []),
      nutrition: this.normalizeNutrition(raw.nutrition),
      prep_time_min: raw.preparationMinutes || 0,
      cook_time_min: raw.cookingMinutes || 0,
      total_time_min: raw.readyInMinutes || 0,
      servings: raw.servings || 4,
      diets: raw.diets || [],
      dish_types: raw.dishTypes || [],
      cuisines: raw.cuisines || [],
      aisle_categories: [...new Set((raw.extendedIngredients || []).map((i: any) => i.aisle).filter(Boolean))],
    };
  }

  private normalizeIngredients(raw: any[]): GroundedIngredient[] {
    return raw.map(i => ({
      name: i.nameClean || i.name,
      amount: i.measures?.us?.amount || i.amount || 0,
      unit: i.measures?.us?.unitShort || i.unit || '',
      original_string: i.original || `${i.amount} ${i.unit} ${i.name}`,
      aisle: i.aisle || 'Other',
    }));
  }

  private normalizeInstructions(raw: any[]): GroundedInstruction[] {
    if (!raw.length || !raw[0].steps) return [];
    return raw[0].steps.map((s: any) => ({
      step_number: s.number,
      text: s.step,
      temperature_f: s.equipment?.find((e: any) => e.temperature)?.temperature?.number,
      duration_minutes: s.length?.number,
    }));
  }

  private normalizeNutrition(raw: any): GroundedNutrition {
    if (!raw?.nutrients) return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, source: 'spoonacular' };
    const find = (name: string) => raw.nutrients.find((n: any) => n.name === name)?.amount || 0;
    return {
      calories: find('Calories'),
      protein_g: find('Protein'),
      carbs_g: find('Carbohydrates'),
      fat_g: find('Fat'),
      fiber_g: find('Fiber'),
      sugar_g: find('Sugar'),
      sodium_mg: find('Sodium'),
      source: 'spoonacular',
    };
  }

  private mapMealType(type: string): string {
    const map: Record<string, string> = {
      breakfast: 'breakfast',
      lunch: 'main course',
      dinner: 'main course',
    };
    return map[type] || type;
  }
}
```

---

### Step 4: Edamam Implementation

**File:** `src/lib/recipe-api/edamam.ts`

Same interface, different API mapping. Edamam uses `app_id` + `app_key` instead of a single API key.

```typescript
import { RecipeProvider, GroundedRecipe, GroundedIngredient,
         GroundedInstruction, GroundedNutrition, MealSearchDirective } from './types';

const BASE_URL = 'https://api.edamam.com/api/recipes/v2';

export class EdamamProvider implements RecipeProvider {
  readonly name = 'edamam' as const;
  constructor(private apiKey: string) {
    // apiKey format: "app_id:app_key" — split on use
  }

  private get credentials() {
    const [app_id, app_key] = this.apiKey.split(':');
    return { app_id, app_key };
  }

  async search(directive: MealSearchDirective, limit = 3): Promise<GroundedRecipe[]> {
    const { app_id, app_key } = this.credentials;
    const params = new URLSearchParams({
      type: 'public',
      q: directive.query,
      app_id,
      app_key,
    });

    if (directive.diet) params.append('health', this.mapDiet(directive.diet));
    if (directive.cuisine) params.append('cuisineType', directive.cuisine);
    if (directive.max_ready_time) params.append('time', `0-${directive.max_ready_time}`);
    if (directive.meal_type) params.append('mealType', this.mapMealType(directive.meal_type));

    // Edamam uses 'excluded' for allergen filtering
    for (const ingredient of directive.exclude_ingredients) {
      params.append('excluded', ingredient);
    }

    if (directive.min_calories || directive.max_calories) {
      const min = directive.min_calories || 0;
      const max = directive.max_calories || 9999;
      params.append('calories', `${min}-${max}`);
    }

    const res = await fetch(`${BASE_URL}?${params}`);
    if (!res.ok) throw new Error(`Edamam search failed: ${res.status}`);
    const data = await res.json();

    return (data.hits || []).slice(0, limit).map((hit: any) => this.normalize(hit.recipe));
  }

  async getById(sourceId: string): Promise<GroundedRecipe | null> {
    const { app_id, app_key } = this.credentials;
    // Edamam source_id format: "edamam:recipe_<hash>"
    const edamamId = sourceId.replace('edamam:', '');
    const res = await fetch(`${BASE_URL}/${edamamId}?type=public&app_id=${app_id}&app_key=${app_key}`);
    if (!res.ok) return null;
    const data = await res.json();
    return this.normalize(data.recipe);
  }

  private normalize(raw: any): GroundedRecipe {
    const uri = raw.uri || '';
    const id = uri.split('#recipe_')[1] || uri;

    return {
      source_id: `edamam:${id}`,
      source_provider: 'edamam',
      name: raw.label,
      summary: raw.source ? `From ${raw.source}` : undefined,
      image_url: raw.image,
      ingredients: this.normalizeIngredients(raw.ingredients || []),
      instructions: this.normalizeInstructions(raw),
      nutrition: this.normalizeNutrition(raw.totalNutrients, raw.yield),
      prep_time_min: raw.totalTime ? Math.round(raw.totalTime * 0.3) : 0,
      cook_time_min: raw.totalTime ? Math.round(raw.totalTime * 0.7) : 0,
      total_time_min: raw.totalTime || 0,
      servings: raw.yield || 4,
      diets: [...(raw.dietLabels || []), ...(raw.healthLabels || [])].map(l => l.toLowerCase()),
      dish_types: (raw.dishType || []).map((d: string) => d.toLowerCase()),
      cuisines: (raw.cuisineType || []).map((c: string) => c.toLowerCase()),
      aisle_categories: [...new Set((raw.ingredients || []).map((i: any) => i.foodCategory).filter(Boolean))],
    };
  }

  private normalizeIngredients(raw: any[]): GroundedIngredient[] {
    return raw.map(i => ({
      name: i.food,
      amount: i.quantity || 0,
      unit: i.measure || '',
      original_string: i.text || `${i.quantity} ${i.measure} ${i.food}`,
      aisle: i.foodCategory || 'Other',
    }));
  }

  private normalizeInstructions(raw: any): GroundedInstruction[] {
    // Edamam doesn't return step-by-step instructions.
    // Return a link to the source recipe instead.
    if (raw.url) {
      return [{ step_number: 1, text: `Full instructions at: ${raw.url}` }];
    }
    return [];
  }

  private normalizeNutrition(nutrients: any, servings: number): GroundedNutrition {
    if (!nutrients) return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, source: 'edamam' };
    const perServing = (n: any) => n?.quantity ? Math.round(n.quantity / (servings || 1)) : 0;
    return {
      calories: perServing(nutrients.ENERC_KCAL),
      protein_g: perServing(nutrients.PROCNT),
      carbs_g: perServing(nutrients.CHOCDF),
      fat_g: perServing(nutrients.FAT),
      fiber_g: perServing(nutrients.FIBTG),
      sugar_g: perServing(nutrients.SUGAR),
      sodium_mg: perServing(nutrients.NA),
      source: 'edamam',
    };
  }

  private mapDiet(diet: string): string {
    const map: Record<string, string> = {
      vegetarian: 'vegetarian',
      vegan: 'vegan',
      'gluten-free': 'gluten-free',
      'dairy-free': 'dairy-free',
      keto: 'keto-friendly',
    };
    return map[diet.toLowerCase()] || diet;
  }

  private mapMealType(type: string): string {
    const map: Record<string, string> = {
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      dinner: 'Dinner',
    };
    return map[type] || type;
  }
}
```

### Edamam Limitation: No Step-by-Step Instructions

Edamam returns ingredient lists and nutrition but **does not return cooking instructions**. It provides a `url` to the original recipe source instead. This is a meaningful difference:

| Feature | Spoonacular | Edamam |
|---------|-------------|--------|
| Ingredients | Full with amounts + aisle | Full with amounts + category |
| Nutrition | Per-nutrient breakdown | Per-nutrient breakdown |
| Step-by-step instructions | Yes (analyzed steps) | **No** — link to source only |
| Temperatures in steps | Yes (parsed from instructions) | No |
| Prep/cook time split | Yes | Total time only (estimated split) |
| Images | Yes | Yes |
| Price per serving | Yes | No |

**Impact on architecture:** If Edamam is chosen, `RecipeDetail.tsx` needs to render a "View full instructions" link instead of inline steps. The `GroundedInstruction` type already accommodates this (step text can be a URL), but the UI needs a branch.

---

### Step 5: Recipe Cache Table (Supabase Migration)

**File:** `supabase/migrations/YYYYMMDD_recipe_cache.sql`

Cache API results locally. Reduces API calls over time. Not per-household — recipes are shared across all users.

```sql
-- Recipe Cache: stores normalized recipes from external providers.
-- Shared across households. No RLS — read by Edge Functions using service role.

CREATE TABLE IF NOT EXISTS public.recipe_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL UNIQUE,          -- "spoonacular:716429" or "edamam:abc123"
  source_provider TEXT NOT NULL,           -- "spoonacular" or "edamam"
  name TEXT NOT NULL,
  data JSONB NOT NULL,                     -- Full GroundedRecipe JSON
  search_tags TEXT[] NOT NULL DEFAULT '{}', -- Searchable tags: diets, cuisines, dish_types
  calories_per_serving INTEGER,            -- Denormalized for fast filtering
  total_time_min INTEGER,                  -- Denormalized for fast filtering
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days')
);

-- Indexes for common lookups
CREATE INDEX idx_recipe_cache_source ON public.recipe_cache(source_id);
CREATE INDEX idx_recipe_cache_provider ON public.recipe_cache(source_provider);
CREATE INDEX idx_recipe_cache_tags ON public.recipe_cache USING gin(search_tags);
CREATE INDEX idx_recipe_cache_calories ON public.recipe_cache(calories_per_serving);
CREATE INDEX idx_recipe_cache_time ON public.recipe_cache(total_time_min);

-- No RLS — accessed via service role from Edge Functions only.
-- Do NOT expose this table through the client's anon key.
```

---

### Step 6: Cache Layer

**File:** `src/lib/recipe-api/cache.ts`

Sits between the Edge Function and the provider. Check cache first, fall through to API, write back to cache.

```typescript
import { SupabaseClient } from '@supabase/supabase-js';
import { GroundedRecipe, MealSearchDirective } from './types';
import { RecipeProvider } from './provider';

export class RecipeCache {
  constructor(
    private supabase: SupabaseClient,   // service role client
    private provider: RecipeProvider
  ) {}

  /**
   * Search with cache-through. Checks local cache first,
   * falls back to API, caches API results.
   */
  async search(directive: MealSearchDirective, limit = 3): Promise<GroundedRecipe[]> {
    // 1. Try local cache
    const cached = await this.searchCache(directive, limit);
    if (cached.length >= limit) return cached;

    // 2. Fall through to API
    const apiResults = await this.provider.search(directive, limit);

    // 3. Cache results (non-blocking)
    this.cacheRecipes(apiResults).catch(err =>
      console.error('[recipe-cache] Failed to cache:', err)
    );

    return apiResults;
  }

  async getById(sourceId: string): Promise<GroundedRecipe | null> {
    // 1. Try cache
    const { data } = await this.supabase
      .from('recipe_cache')
      .select('data')
      .eq('source_id', sourceId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (data) return data.data as GroundedRecipe;

    // 2. Fall through to API
    const recipe = await this.provider.getById(sourceId);
    if (recipe) {
      this.cacheRecipes([recipe]).catch(console.error);
    }
    return recipe;
  }

  private async searchCache(
    directive: MealSearchDirective,
    limit: number
  ): Promise<GroundedRecipe[]> {
    let query = this.supabase
      .from('recipe_cache')
      .select('data')
      .gt('expires_at', new Date().toISOString())
      .limit(limit);

    // Filter by diet if specified
    if (directive.diet) {
      query = query.contains('search_tags', [directive.diet]);
    }

    // Filter by meal type
    if (directive.meal_type) {
      query = query.contains('search_tags', [directive.meal_type]);
    }

    // Filter by calorie range
    if (directive.max_calories) {
      query = query.lte('calories_per_serving', directive.max_calories);
    }
    if (directive.min_calories) {
      query = query.gte('calories_per_serving', directive.min_calories);
    }

    // Filter by time
    if (directive.max_ready_time) {
      query = query.lte('total_time_min', directive.max_ready_time);
    }

    // Text search on name (basic ILIKE)
    if (directive.query) {
      query = query.ilike('name', `%${directive.query}%`);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(row => row.data as GroundedRecipe);
  }

  private async cacheRecipes(recipes: GroundedRecipe[]): Promise<void> {
    const rows = recipes.map(r => ({
      source_id: r.source_id,
      source_provider: r.source_provider,
      name: r.name,
      data: r,
      search_tags: [...r.diets, ...r.dish_types, ...r.cuisines],
      calories_per_serving: r.nutrition.calories,
      total_time_min: r.total_time_min,
    }));

    await this.supabase
      .from('recipe_cache')
      .upsert(rows, { onConflict: 'source_id' });
  }
}
```

---

### Step 7: Recipe Search Edge Function

**File:** `supabase/functions/recipe-search/index.ts`

Replaces the recipe-generation role of `generate-plan`. Called after the AI Coordinator produces directives.

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.40.0"
// Note: In Deno Edge Functions, import the provider files directly.
// The implementations would be vendored or inlined.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Auth
    const authHeader = req.headers.get('Authorization')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    // 2. Parse request
    const { directives } = await req.json()
    // directives: MealSearchDirective[]

    // 3. Determine recipe provider
    const recipeProvider = Deno.env.get('RECIPE_PROVIDER') || 'spoonacular'
    const recipeApiKey = recipeProvider === 'spoonacular'
      ? Deno.env.get('SPOONACULAR_API_KEY')
      : Deno.env.get('EDAMAM_API_KEY')  // format: "app_id:app_key"

    if (!recipeApiKey) {
      throw new Error(`Recipe API key not configured for provider: ${recipeProvider}`)
    }

    // 4. Create cache-backed provider
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)
    // (In production, import the actual provider + cache classes)

    // 5. Search for each directive (parallel, batched)
    const results = await Promise.all(
      directives.map(async (directive: any) => {
        // Search with limit=3, take best match
        const recipes = await searchWithCache(serviceClient, recipeProvider, recipeApiKey, directive)
        return {
          day_of_week: directive.day_of_week,
          meal_type: directive.meal_type,
          recipe: recipes[0] || null,
          alternatives: recipes.slice(1),  // For "refresh slot" later
        }
      })
    )

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

**Key design choice:** Each directive returns the top match plus 2 alternatives. Alternatives are stored client-side so "refresh slot" can swap to an alternative without an API call.

---

### Step 8: AI Coordinator Edge Function (Replaces generate-plan)

**File:** `supabase/functions/select-meals/index.ts`

Single LLM call. Outputs search directives, not recipes.

```typescript
serve(async (req) => {
  // ... auth same as current generate-plan ...

  const { members, household_id, provider, model, selected_meals, recent_meals } = await req.json()

  // Distill household constraints for the prompt
  const constraints = distillConstraints(members)

  const systemPrompt = `You are a Meal Planning Coordinator.
Your job: select meals for a 7-day plan. You do NOT create recipes — you choose what to search for in a recipe database.

For each meal slot, output a search directive with:
- query: a specific dish name to search for (e.g., "shakshuka", "chicken tikka masala", not vague like "healthy dinner")
- cuisine: optional cuisine filter
- diet: dietary restriction filter if needed (from: ${constraints.diets.join(', ')})
- max_ready_time: in minutes, based on household cooking skill
- exclude_ingredients: allergens and avoidances to exclude
- min/max_calories: optional calorie bounds based on household targets

Rules:
- Ensure protein variety across the week (don't repeat chicken 5 times)
- Match cooking complexity to skill level: ${constraints.skill}
- Respect ALL allergens: ${constraints.allergens.join(', ') || 'none'}
- Respect ALL avoidances: ${constraints.avoidances.join(', ') || 'none'}
- Avoid these recently served meals: ${(recent_meals || []).join(', ') || 'none'}
- Each query should be specific enough to find a real recipe (dish name, not category)

Return JSON: { "directives": MealSearchDirective[] }
Each directive: { "day_of_week": 0-6, "meal_type": "breakfast"|"lunch"|"dinner", "query": string, "cuisine"?: string, "diet"?: string, "max_ready_time"?: number, "exclude_ingredients": string[], "min_calories"?: number, "max_calories"?: number }`

  const userPrompt = `Plan meals for this household:
${JSON.stringify(constraints)}
Selected meal types: ${selected_meals.join(', ')}
Generate one directive per meal slot (${selected_meals.length} × 7 days = ${selected_meals.length * 7} directives).`

  const result = await callAI(systemPrompt, userPrompt, provider, model)

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})

/**
 * Distill raw household member array into concise constraints.
 * Reduces prompt token count by ~70% vs raw JSON.stringify(members).
 */
function distillConstraints(members: any[]) {
  const allAllergies = [...new Set(members.flatMap(m => m.nutrition_profile?.allergies || []))];
  const allAvoidances = [...new Set(members.flatMap(m => m.nutrition_profile?.avoidances || []))];
  const allDiets = [...new Set(members.map(m => m.nutrition_profile?.dietary_choice).filter(Boolean))];
  const allAppliances = [...new Set(members.flatMap(m => m.nutrition_profile?.appliances || []))];
  const skills = members.map(m => m.nutrition_profile?.cooking_skill || 'intermediate');
  const lowestSkill = skills.includes('beginner') ? 'beginner' : skills.includes('intermediate') ? 'intermediate' : 'advanced';
  const hasChildren = members.some(m => m.nutrition_profile?.is_child);

  const avgCalories = Math.round(
    members.reduce((sum, m) => sum + (m.nutrition_profile?.target_calories || 2000), 0) / members.length
  );

  // Per-meal calorie targets (rough split)
  const mealCalories = {
    breakfast: Math.round(avgCalories * 0.25),
    lunch: Math.round(avgCalories * 0.35),
    dinner: Math.round(avgCalories * 0.40),
  };

  return {
    member_count: members.length,
    has_children: hasChildren,
    allergens: allAllergies,
    avoidances: allAvoidances,
    diets: allDiets,
    appliances: allAppliances,
    skill: lowestSkill,
    avg_calories: avgCalories,
    meal_calories: mealCalories,
    max_ready_time: lowestSkill === 'beginner' ? 30 : lowestSkill === 'intermediate' ? 45 : 90,
  };
}
```

---

### Step 9: AI Adapter Edge Function

**File:** `supabase/functions/adapt-recipe/index.ts`

Called only when a grounded recipe needs modification. Most plans skip this entirely.

```typescript
serve(async (req) => {
  // ... auth ...

  const { recipe, adaptations, household_constraints } = await req.json()
  // recipe: GroundedRecipe
  // adaptations: [{ reason, details }]
  // household_constraints: distilled constraints object

  const systemPrompt = `You are a Recipe Adapter. You receive a tested, grounded recipe and a list of required adaptations. Your job is to modify ONLY what is necessary.

Rules:
- PRESERVE all original quantities, temperatures, and cook times unless the adaptation specifically requires changing them
- When substituting an ingredient, keep the same quantity and adjust only if the substitute has very different properties
- When scaling servings, multiply all ingredient quantities proportionally — do not change anything else
- When simplifying for skill level, consolidate steps but do NOT change temperatures or times
- Return the COMPLETE modified recipe, not just the changes
- In the "adaptations" field, list exactly what you changed and why

Return JSON: { "recipe": <full GroundedRecipe with modifications>, "adaptations": [{ "reason": string, "changes": ["description of change"] }] }`

  const userPrompt = `
Base recipe: ${JSON.stringify(recipe)}

Required adaptations:
${adaptations.map((a: any) => `- ${a.reason}: ${a.details}`).join('\n')}

Household constraints: ${JSON.stringify(household_constraints)}

Modify the recipe. Change ONLY what the adaptations require.`

  const result = await callAI(systemPrompt, userPrompt, provider, model)

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
```

---

### Step 10: Database Schema Changes

#### 10a. Modify `recipes` table — add source tracking

**File:** `supabase/migrations/YYYYMMDD_recipe_source_tracking.sql`

```sql
-- Add source tracking to recipes table.
-- Recipes now come from external providers, not AI generation.
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS source_provider TEXT;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS is_adapted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS adaptations JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Index for deduplication: don't save the same source recipe twice per household
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_source_household
  ON public.recipes(household_id, source_id)
  WHERE source_id IS NOT NULL;
```

#### 10b. Modify `shopping_list_items` table — add aisle from provider

```sql
-- Aisle data now comes from recipe provider, not AI categorization.
ALTER TABLE public.shopping_list_items ADD COLUMN IF NOT EXISTS aisle TEXT;
ALTER TABLE public.shopping_list_items ADD COLUMN IF NOT EXISTS amount TEXT;
ALTER TABLE public.shopping_list_items ADD COLUMN IF NOT EXISTS unit TEXT;
```

---

### Step 11: Modify Frontend Orchestration

**File:** `src/pages/MealPlanner/MealPlanner.tsx`

Replace the current `handleGenerate` with the new 3-phase pipeline.

```typescript
const handleGenerate = async () => {
  if (!householdId || members.length === 0) return;

  setIsGenerating(true);

  try {
    // ── Phase 1: AI Coordinator ──
    setGenerationStep('Planning your week...');

    const activeProvider = localStorage.getItem('active_ai_provider') || 'grok';
    const activeModel = localStorage.getItem('active_ai_model') || '...';

    // Get recent meal names to avoid repetition
    const recentMeals = await getRecentMealNames(householdId, 2); // last 2 weeks

    const { data: coordinatorResult, error: coordError } = await supabase.functions.invoke('select-meals', {
      body: {
        members,
        household_id: householdId,
        provider: activeProvider,
        model: activeModel,
        selected_meals: selectedMeals,
        recent_meals: recentMeals,
      }
    });
    if (coordError) throw coordError;

    const directives = coordinatorResult.directives;

    // ── Phase 2: Recipe Lookup ──
    setGenerationStep('Finding tested recipes...');

    const { data: searchResult, error: searchError } = await supabase.functions.invoke('recipe-search', {
      body: { directives }
    });
    if (searchError) throw searchError;

    // ── Phase 3: Adaptation Check ──
    const needsAdaptation = searchResult.results.filter((r: any) =>
      r.recipe && checkNeedsAdaptation(r.recipe, members)
    );

    let adaptedRecipes: Record<string, any> = {};
    if (needsAdaptation.length > 0) {
      setGenerationStep('Personalizing recipes...');
      // Batch all adaptations in one call
      const { data: adaptResult } = await supabase.functions.invoke('adapt-recipe', {
        body: {
          recipes: needsAdaptation.map((r: any) => ({
            recipe: r.recipe,
            adaptations: getRequiredAdaptations(r.recipe, members),
          })),
          household_constraints: distillConstraints(members),
          provider: activeProvider,
          model: activeModel,
        }
      });
      if (adaptResult?.adapted) {
        for (const adapted of adaptResult.adapted) {
          adaptedRecipes[adapted.recipe.source_id] = adapted;
        }
      }
    }

    // ── Assemble Plan ──
    // ... build draft from searchResult.results + adaptedRecipes ...
    // ... same lazy-save pattern as lazy-save.md ...

  } catch (err) {
    console.error('Generation failed:', err);
    alert('Failed to generate meal plan.');
  } finally {
    setIsGenerating(false);
    setGenerationStep('');
  }
};
```

#### Helper: Check if recipe needs adaptation

```typescript
function checkNeedsAdaptation(recipe: GroundedRecipe, members: HouseholdMember[]): boolean {
  const allAllergens = members.flatMap(m => m.nutrition_profile.allergies);
  const allAvoidances = members.flatMap(m => m.nutrition_profile.avoidances);
  const targetServings = members.length;

  // Check if any ingredient matches an allergen/avoidance
  const recipeIngredientNames = recipe.ingredients.map(i => i.name.toLowerCase());
  const hasAllergen = allAllergens.some(a =>
    recipeIngredientNames.some(name => name.includes(a.toLowerCase()))
  );
  const hasAvoidance = allAvoidances.some(a =>
    recipeIngredientNames.some(name => name.includes(a.toLowerCase()))
  );

  // Check serving mismatch (only if significantly different)
  const servingMismatch = Math.abs(recipe.servings - targetServings) > 2;

  return hasAllergen || hasAvoidance || servingMismatch;
}
```

---

### Step 12: Modify Refresh Slot

Currently calls AI to invent a new recipe. New behavior: pick an alternative from the cached search results, or re-search.

```typescript
const handleRefresh = async (date: string, mealType: string) => {
  // 1. Check if alternatives exist from the original search
  const slot = planData[date]?.[mealType];
  if (slot?.alternatives?.length > 0) {
    // Swap to next alternative — no API call needed
    const nextAlt = slot.alternatives.shift();
    updateSlotWithRecipe(date, mealType, nextAlt);
    return;
  }

  // 2. No alternatives left — re-search with exclusion
  const exclusionList = getAllCurrentRecipeNames();
  const { data } = await supabase.functions.invoke('recipe-search', {
    body: {
      directives: [{
        day_of_week: getDayOfWeek(date),
        meal_type: mealType,
        query: mealType,  // broad search
        exclude_ingredients: getAllAllergens(members),
        // Could also use the original directive's cuisine/diet
      }]
    }
  });

  if (data?.results?.[0]?.recipe) {
    updateSlotWithRecipe(date, mealType, data.results[0].recipe);
  }
};
```

---

### Step 13: Modify Shopping List

Shopping list no longer needs `categorize-ingredients` Edge Function. Ingredients come pre-categorized from the recipe provider.

**File:** `src/lib/services/planner.ts` — modify `saveMealPlan`

```typescript
// BEFORE: Call categorize-ingredients Edge Function (1 LLM call)
// AFTER: Extract categories directly from GroundedRecipe.ingredients

if (allIngredients.length > 0) {
  const itemsToUpsert = allIngredients.map(ingredient => ({
    meal_plan_id: plan.id,
    original_string: ingredient.original_string,
    category: ingredient.aisle || 'Other',  // From recipe API, not AI
    amount: ingredient.amount ? `${ingredient.amount}` : null,
    unit: ingredient.unit || null,
  }));

  await supabase
    .from('shopping_list_items')
    .upsert(itemsToUpsert, { onConflict: 'meal_plan_id, original_string' });
}

// DELETE: the fire-and-forget supabase.functions.invoke('categorize-ingredients', ...)
```

**File:** `supabase/functions/categorize-ingredients/index.ts` — **deprecate and remove** once migration is complete. No longer needed.

---

### Step 14: Modify RecipeDetail Component

**File:** `src/components/MealPlanner/RecipeDetail.tsx`

Add source attribution, verified nutrition badge, adaptation annotations, and handle Edamam's instruction-link pattern.

```typescript
// New fields to display:
// - recipe.source_provider → "Recipe from Spoonacular" attribution
// - recipe.nutrition.source → "Verified nutrition" badge
// - recipe.is_adapted → show adaptation annotations
// - recipe.image_url → recipe photo

// Handle Edamam's link-based instructions:
{Array.isArray(recipe.instructions) && recipe.instructions.length === 1
  && recipe.instructions[0].text.startsWith('Full instructions at:') ? (
  <a href={recipe.instructions[0].text.replace('Full instructions at: ', '')}
     target="_blank" rel="noopener noreferrer">
    View full instructions
  </a>
) : (
  <ol className="instructions-list">
    {recipe.instructions.map((step, i) => (
      <li key={i}>
        {step.text}
        {step.temperature_f && <span className="temp-badge">{step.temperature_f}°F</span>}
        {step.duration_minutes && <span className="time-badge">{step.duration_minutes} min</span>}
      </li>
    ))}
  </ol>
)}
```

---

### Step 15: Environment Variables

**File:** `.env.example` — add recipe API keys

```
# Existing
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key

# New: Recipe API (choose one)
# RECIPE_PROVIDER=spoonacular
# SPOONACULAR_API_KEY=your-key
# RECIPE_PROVIDER=edamam
# EDAMAM_API_KEY=app_id:app_key
```

**Supabase Secrets** (Edge Functions):
```
RECIPE_PROVIDER=spoonacular   # or "edamam"
SPOONACULAR_API_KEY=xxx        # if using spoonacular
EDAMAM_API_KEY=app_id:app_key  # if using edamam
```

---

### Step 16: Modify Settings UI

**File:** `src/pages/Settings/Settings.tsx`

No recipe API config on the client side (keys stay server-side). But add a display of which recipe provider is active — fetch via a ping to `recipe-search`.

---

### Step 17: Update Tests

| Test File | Changes |
|-----------|---------|
| `meal-plan.test.tsx` | Mock `select-meals` + `recipe-search` instead of `generate-plan` |
| `surgical-slot-control.test.tsx` | `refreshSlot` now uses alternatives or re-search, not AI generation |
| `shopping-list.test.tsx` | Items now have `aisle` field from provider instead of AI `category` |
| New: `recipe-api.test.ts` | Unit tests for Spoonacular/Edamam normalization |
| New: `recipe-cache.test.ts` | Cache hit/miss/expiry behavior |
| New: `coordinator.test.ts` | Verify directives have valid structure |
| New: `adapter.test.ts` | Verify adaptation preserves unmodified fields |

---

## Implementation Order

| Step | What | Depends On | Effort | Risk |
|------|------|-----------|--------|------|
| **1** | `types.ts` — shared type definitions | — | 1h | None |
| **2** | `provider.ts` — interface + factory | 1 | 1h | None |
| **3** | `spoonacular.ts` — implementation | 1, 2 | 3h | Medium — API mapping |
| **4** | `edamam.ts` — implementation | 1, 2 | 3h | Medium — API mapping |
| **5** | `recipe_cache` migration | — | 30m | None |
| **6** | `cache.ts` — cache layer | 1, 5 | 2h | Low |
| **7** | `recipe-search` Edge Function | 3 or 4, 6 | 3h | Medium |
| **8** | `select-meals` Edge Function (AI Coordinator) | 1 | 4h | Medium — prompt engineering |
| **9** | `adapt-recipe` Edge Function | 1 | 3h | Medium — prompt engineering |
| **10** | DB migration — source tracking on `recipes` | — | 30m | Low |
| **11** | DB migration — aisle on `shopping_list_items` | — | 30m | Low |
| **12** | `MealPlanner.tsx` — new generation pipeline | 7, 8, 9 | 5h | High — core flow change |
| **13** | Refresh slot — use alternatives | 7 | 2h | Medium |
| **14** | Shopping list — use provider aisles | 11 | 2h | Low |
| **15** | `RecipeDetail.tsx` — source attribution + adaptations | 1 | 2h | Low |
| **16** | `.env.example` + Supabase secrets | — | 30m | None |
| **17** | Settings display | — | 1h | None |
| **18** | Tests | All above | 4h | None |
| **Total** | | | **~37h** | |

### Suggested Phases

**Phase A (foundation, no behavior change):** Steps 1-6, 10-11, 16. Build the recipe API layer and cache. Ship behind a feature flag. ~11h.

**Phase B (new pipeline, behind flag):** Steps 7-9, 12. New Edge Functions + rewired MealPlanner. Toggle with `VITE_USE_GROUNDED_RECIPES=true`. ~15h.

**Phase C (polish + cleanup):** Steps 13-15, 17-18. Refresh slot, shopping list, UI, tests. Remove `generate-plan` and `categorize-ingredients` Edge Functions. ~11h.

---

## What Gets Removed

| Component | Status |
|-----------|--------|
| `supabase/functions/generate-plan/index.ts` | **Replaced** by `select-meals` + `recipe-search` |
| `supabase/functions/categorize-ingredients/index.ts` | **Eliminated** — categories come from recipe provider |
| `src/lib/ai/prompts.ts` | **Eliminated** — was already dead code for generation |
| Worker agent concept (3 parallel LLM calls) | **Eliminated** — recipe details come from DB, not AI |
| `askAI()` for generation | **Reduced** — only used by coordinator + adapter |
| `src/lib/ai/client.ts` mock recipes | **Replaced** — mock mode returns canned `GroundedRecipe` objects |

---

## Fallback: AI Generation as Last Resort

If the recipe API returns zero results for a directive (very unusual dietary combination), fall back to the current AI generation approach for that specific slot. Mark the recipe as `source_provider: 'ai-generated'` and show a badge in the UI: "AI-created recipe — nutrition estimated."

```typescript
// In recipe-search Edge Function:
if (recipes.length === 0) {
  // No DB/API match — fall back to AI generation for this slot only
  const aiRecipe = await generateRecipeWithAI(directive, provider, model);
  return {
    ...slot,
    recipe: { ...aiRecipe, source_provider: 'ai-generated' },
    alternatives: [],
    is_fallback: true,
  };
}
```

This keeps the current `generate-plan` logic available as a fallback rather than deleting it outright. Move it into a utility function called by `recipe-search` when needed.
