# Stack Research

**Domain:** Grounded recipe architecture additions to existing Supabase/React meal planner
**Researched:** 2026-04-16
**Confidence:** MEDIUM (WebSearch/WebFetch unavailable; based on training data through May 2025 + codebase analysis. Spoonacular API is stable/mature -- low risk of drift. Supabase Edge Function _shared pattern is well-documented and stable.)

## Context: What Already Exists (DO NOT Add)

The existing stack is validated and shipping. This research covers ONLY new additions.

| Existing | Version | Status |
|----------|---------|--------|
| React + Vite (TS) | React 18.2, Vite 5.2 | Shipping |
| Supabase JS | 2.40.0 | Shipping |
| Supabase Edge Functions (Deno) | deno.land/std@0.168.0 | Shipping |
| react-router-dom | 6.22.3 | Shipping |
| date-fns | 4.1.0 | Shipping |
| Google Stitch CSS | Vanilla CSS | Shipping |

## Recommended Stack Additions

### Core Technologies (New)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Spoonacular API | v1 (REST) | Recipe search, nutrition data, ingredient aisle categorization | Industry-standard food API. 150+ endpoints. Returns structured nutrition, ingredient aisle data (eliminates AI categorizer), and recipe details. The `complexSearch` endpoint supports diet/intolerance filtering that maps directly to the app's dietary profiles. |
| Supabase `_shared/` modules (Deno) | N/A (convention) | Shared AI client, CORS helpers, auth validation, Supabase client factory | Supabase's documented pattern for code reuse across Edge Functions. Functions import via relative path `../_shared/module.ts`. No import map needed for this pattern -- it works with bare relative imports in Deno. |
| PostgreSQL JSONB + GIN indexes | Supabase-managed (PG 15+) | Cache Spoonacular recipe responses in `recipe_cache` table | JSONB stores variable-shape recipe data without schema migrations per field. GIN index on JSONB enables fast lookups by `spoonacular_id` or ingredient queries. Already available in Supabase -- no new dependency. |

### Supporting Libraries (New)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| *None -- no new npm packages needed* | -- | -- | The Spoonacular integration lives entirely in Edge Functions (server-side Deno `fetch`). Lazy-save uses React `useState`/`useReducer`. No new client-side libraries required. |

### Development Tools (New or Changed)

| Tool | Purpose | Notes |
|------|---------|-------|
| Supabase CLI (`supabase functions serve`) | Local Edge Function dev with `_shared/` support | Already in use. Verify `_shared/` imports resolve correctly in local dev. The `_shared/` directory is NOT deployed as a function -- Supabase CLI excludes directories starting with `_`. |

## Spoonacular API Details

### Authentication
- API key passed as query parameter: `?apiKey=YOUR_KEY`
- Stored in Supabase Secrets as `SPOONACULAR_API_KEY`, accessed via `Deno.env.get('SPOONACULAR_API_KEY')` in Edge Functions

### Key Endpoints

| Endpoint | Path | Use Case | Notes |
|----------|------|----------|-------|
| Complex Search | `GET /recipes/complexSearch` | Find recipes matching dietary constraints | Params: `query`, `diet`, `intolerances`, `maxCalories`, `number`. Returns recipe IDs + basic info. Use `addRecipeNutrition=true` and `addRecipeInformation=true` to get full data in one call. |
| Recipe Information | `GET /recipes/{id}/information` | Full recipe details for a single recipe | Use `includeNutrition=true`. Returns ingredients with `aisle` field. |
| Recipe Information Bulk | `GET /recipes/informationBulk` | Batch fetch recipe details | Params: `ids` (comma-separated). More efficient than N single calls. |

### Rate Limits & Pricing

| Tier | Requests/Day | Points/Day | Cost |
|------|-------------|------------|------|
| Free | 150 | 150 | $0 |
| Starter | ~5,000 calls | 1,500 pts | ~$30/mo |

**Points system:** Each endpoint costs 1+ points. `complexSearch` with nutrition = ~2 points. This is why caching is critical -- a 7-day plan generation without cache could consume 20-30 points.

### Response Shape (Relevant Fields)

```typescript
// From complexSearch with addRecipeInformation=true
interface SpoonacularRecipe {
  id: number;                    // Spoonacular recipe ID (cache key)
  title: string;
  readyInMinutes: number;
  servings: number;
  sourceUrl: string;
  image: string;
  nutrition: {
    nutrients: Array<{
      name: string;              // "Calories", "Protein", "Fat", "Carbohydrates"
      amount: number;
      unit: string;
    }>;
  };
  extendedIngredients: Array<{
    id: number;
    original: string;            // "2 cups all-purpose flour"
    name: string;                // "all-purpose flour"
    amount: number;
    unit: string;
    aisle: string;               // "Baking" -- THIS replaces AI categorizer
  }>;
  analyzedInstructions: Array<{
    steps: Array<{
      number: number;
      step: string;
    }>;
  }>;
  diets: string[];               // ["gluten free", "dairy free"]
  dishTypes: string[];           // ["breakfast", "main course"]
}
```

## Shared Edge Function Module Architecture (`_shared/`)

### Directory Structure

```
supabase/functions/
  _shared/
    ai-client.ts          # Shared AI client with role-based config
    cors.ts               # CORS headers (DRY from current duplication)
    auth.ts               # JWT validation + Supabase client factory
    spoonacular.ts        # Spoonacular API wrapper with cache-check
    types.ts              # Shared TypeScript interfaces
  select-meals/
    index.ts              # AI Coordinator -- outputs search directives
  recipe-search/
    index.ts              # Spoonacular search + cache read/write
  adapt-recipe/
    index.ts              # AI adapter for substitutions/scaling
  generate-plan/
    index.ts              # (Existing, to be refactored)
  ai-proxy/
    index.ts              # (Existing, to be replaced by shared client)
```

### Import Pattern

```typescript
// In supabase/functions/select-meals/index.ts
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthClient } from "../_shared/auth.ts";
import { callAI } from "../_shared/ai-client.ts";
```

**Key detail:** Supabase Edge Functions use Deno, so imports use `.ts` extensions and relative paths. No import map file is needed for `_shared/` -- relative imports work out of the box. The `_shared/` prefix with underscore tells the Supabase CLI this is NOT a deployable function.

### Shared AI Client Design (`_shared/ai-client.ts`)

```typescript
// Role-based configuration
const ROLE_CONFIG = {
  coordinator: { temperature: 0.7, max_tokens: 1024 },
  adapter:     { temperature: 0.3, max_tokens: 2048 },
  worker:      { temperature: 0.5, max_tokens: 4096 },
} as const;

// Returns OpenAI-compatible response + extracts usage for logging
interface AIResponse {
  content: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  provider: string;
  model: string;
}
```

**Token logging:** The OpenAI-compatible format (used by both Gemini and Grok) already returns `usage` in the response body. The shared client extracts `response.usage.prompt_tokens` and `response.usage.completion_tokens` and logs them to a `token_usage_log` table.

## Recipe Cache Strategy

### Table Design

```sql
CREATE TABLE recipe_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  spoonacular_id INTEGER UNIQUE NOT NULL,
  recipe_data JSONB NOT NULL,         -- Full Spoonacular response
  fetched_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '7 days',
  search_queries TEXT[]               -- Track which queries found this recipe
);

CREATE INDEX idx_recipe_cache_spoonacular_id ON recipe_cache (spoonacular_id);
CREATE INDEX idx_recipe_cache_expires ON recipe_cache (expires_at);
-- GIN index for JSONB queries (e.g., searching cached recipes by diet)
CREATE INDEX idx_recipe_cache_data ON recipe_cache USING GIN (recipe_data jsonb_path_ops);
```

### Cache Flow

1. `recipe-search` Edge Function receives search directives from `select-meals`
2. Check `recipe_cache` by `spoonacular_id` WHERE `expires_at > now()`
3. Cache HIT: return from DB (0 Spoonacular API points)
4. Cache MISS: call Spoonacular, store in `recipe_cache`, return
5. TTL of 7 days balances freshness vs. API quota

### Why 7-Day TTL
- Recipe data from Spoonacular rarely changes (ingredients, nutrition are static)
- Aligns with weekly meal plan cycle
- Conservative enough to catch any recipe corrections
- A background cron (Supabase pg_cron) can purge expired rows: `DELETE FROM recipe_cache WHERE expires_at < now()`

## Lazy-Save Draft State (React-side)

### Approach: `useReducer` with Draft State Object

**No new libraries needed.** The existing React 18 `useReducer` is the right tool for managing a complex draft state (7 days x 3 meal types = 21 slots with recipe data, source flags, modification state).

```typescript
interface DraftMealPlan {
  days: DraftDay[];
  status: 'empty' | 'generating' | 'draft' | 'saving' | 'saved';
  isDirty: boolean;           // Has unsaved changes
  source: 'spoonacular' | 'ai-generated' | 'mixed';
}

type DraftAction =
  | { type: 'SET_GENERATING' }
  | { type: 'LOAD_DRAFT'; payload: DraftMealPlan }
  | { type: 'UPDATE_SLOT'; day: number; mealType: string; recipe: DraftRecipe }
  | { type: 'REMOVE_SLOT'; day: number; mealType: string }
  | { type: 'MARK_SAVED' }
  | { type: 'RESET' };
```

### Why NOT Add a State Management Library

| Considered | Why Not |
|------------|---------|
| Zustand | The draft state is local to the planner page. No global state sharing needed. Adding Zustand for one component tree is unnecessary complexity. |
| Redux/RTK | Massive overkill. The app uses Supabase as its data layer. |
| TanStack Query | The app doesn't have complex server-state caching needs beyond what Supabase client handles. The recipe cache lives in Supabase (server), not in a client-side query cache. |
| Jotai/Recoil | Atomic state is useful when many unrelated components share state. This app has a clear parent-child hierarchy. |

**Bottom line:** `useReducer` handles the draft lifecycle. The "save" action is a single function that bulk-inserts to Supabase. No intermediate library needed.

## Token Usage Logging

### Table Design

```sql
CREATE TABLE token_usage_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  function_name TEXT NOT NULL,        -- 'select-meals', 'adapt-recipe', etc.
  provider TEXT NOT NULL,             -- 'gemini', 'grok'
  model TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  role TEXT,                          -- 'coordinator', 'adapter', 'worker'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_token_usage_user ON token_usage_log (user_id, created_at);
```

### Why This Works
Both Gemini (via OpenAI-compatible endpoint) and Grok return standard `usage` objects in their responses. The shared AI client parses this automatically -- no extra API calls or estimation needed.

## Installation

```bash
# NO new npm packages needed on the frontend.
# The only new "dependency" is a Supabase Secret:
supabase secrets set SPOONACULAR_API_KEY=your_key_here

# For local development:
echo "SPOONACULAR_API_KEY=your_key_here" >> supabase/functions/.env
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Spoonacular API | Edamam API | If you need more granular nutrition analysis (Edamam has a dedicated Nutrition Analysis API). But Spoonacular's all-in-one recipe+nutrition+aisle data is better for this use case. |
| Spoonacular API | TheMealDB | Never for this project. TheMealDB lacks nutrition data, ingredient aisle categorization, and dietary filtering. Free but insufficient. |
| JSONB recipe cache in Supabase | Redis/Upstash cache | If you hit >10K cached recipes and need sub-ms lookups. For a family meal planner with a few hundred cached recipes, PostgreSQL JSONB with GIN is more than sufficient and avoids an extra service. |
| `useReducer` for draft state | Zustand | If draft state eventually needs to be shared across multiple routes (e.g., a multi-step wizard spanning pages). Current design is single-page, so `useReducer` suffices. |
| Relative imports for `_shared/` | Deno import map (`import_map.json`) | If you want shorter import paths like `@shared/ai-client`. But relative imports (`../_shared/ai-client.ts`) are simpler, require no config file, and are the Supabase-documented approach. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any npm Spoonacular SDK | Adds unnecessary abstraction over a simple REST API. Edge Functions use Deno's native `fetch`, and Spoonacular's API is straightforward GET requests with query params. An SDK adds bundle size and version-lock risk for no benefit. | Direct `fetch()` calls in a thin `_shared/spoonacular.ts` wrapper |
| Zustand/Redux/Jotai | Draft state is page-local with a clear reducer pattern. Adding a global state library for one feature introduces coupling and makes the save/discard lifecycle harder to reason about. | React `useReducer` |
| TanStack Query | The app's data layer is Supabase client. Adding a second caching layer client-side for recipe cache that already lives server-side in PostgreSQL creates cache coherence headaches. | Supabase client queries + server-side `recipe_cache` table |
| Import map for Edge Functions | Adds a config file that needs to be kept in sync. The `_shared/` directory with relative imports is zero-config and matches Supabase's documented examples. | Relative imports from `../_shared/` |
| `deno.land/std@0.168.0` for new functions | The existing functions pin to this version. New functions should use the same version for consistency within this milestone. Consider upgrading all functions to a newer std version in a future milestone. | `deno.land/std@0.168.0` (match existing) |

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@supabase/supabase-js@2.40.0` | Supabase Edge Functions | Same version used in both frontend (`package.json`) and Edge Functions (`esm.sh` import). Keep in sync. |
| `deno.land/std@0.168.0` | Supabase Edge Functions runtime | All existing functions use this. New `_shared/` modules and new functions should match. |
| Spoonacular API v1 | Deno `fetch()` | REST API, no SDK needed. Stable -- Spoonacular has maintained v1 backward compatibility for years. |
| PostgreSQL JSONB | Supabase (PG 15+) | GIN indexes and `jsonb_path_ops` are fully supported. `gen_random_uuid()` requires `pgcrypto` or PG 13+ (both available in Supabase). |

## Confidence Notes

| Claim | Confidence | Rationale |
|-------|------------|-----------|
| Spoonacular `complexSearch` returns `aisle` in `extendedIngredients` | MEDIUM | Training data confirms this. Could not verify with live docs (WebFetch denied). Verify with a test API call during implementation. |
| Spoonacular points system (1-2 pts per call) | MEDIUM | Based on training data. Pricing may have changed. Check dashboard after signup. |
| `_shared/` directory excluded from deployment | HIGH | Well-established Supabase convention. Visible in current project structure (functions starting with `_` are not deployed). |
| OpenAI-compatible `usage` returned by Gemini/Grok | HIGH | Verified by examining existing `ai-proxy/index.ts` which already receives and forwards these responses. The `usage` field is part of the OpenAI chat completion spec. |
| `useReducer` sufficient for lazy-save | HIGH | Assessed from existing codebase -- the app has no global state management, uses Supabase as data layer, and the draft lifecycle is contained to one page. |

## Sources

- Codebase analysis: `supabase/functions/ai-proxy/index.ts`, `supabase/functions/generate-plan/index.ts`, `src/lib/ai/client.ts`, `src/lib/services/planner.ts`, `package.json`
- Training data: Spoonacular API documentation (spoonacular.com/food-api/docs) -- MEDIUM confidence
- Training data: Supabase Edge Functions shared modules pattern -- HIGH confidence (well-established pattern)
- Training data: PostgreSQL JSONB + GIN indexing -- HIGH confidence (core PostgreSQL feature)

---
*Stack research for: v4.0 Grounded Recipe Architecture*
*Researched: 2026-04-16*
