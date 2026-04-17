# Phase 14: Spoonacular Integration & AI Coordinator - Research

**Researched:** 2026-04-17
**Domain:** Supabase Edge Functions orchestration, Spoonacular recipe search, quota-aware fallback, Settings-driven partial generation
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Invocation Pattern

- **D-01:** Frontend orchestrates both Edge Functions. Call sequence: `select-meals` → receives directives → sends all directives in one batched call to `recipe-search` → receives full week of recipes. No server-to-server Deno-to-Deno calls.
- **D-02:** `recipe-search` accepts all directives in a single request and returns the full assembled week array. One Supabase Edge Function invocation per generation run (not one per slot).

### Partial Generation (SEARCH-03)

- **D-03:** User configures partial generation in Settings as a persistent household-level preference. Two dimensions: which meal types (breakfast / lunch / dinner) and which days of the week. 2D selection matrix.
- **D-04:** Extends the existing `selected_meals` pattern already present in `generate-plan` payload. Add day selection alongside meal type selection.

### Quota Tracking (SEARCH-04)

- **D-05:** Spoonacular API calls are logged to a DB table (modeled after `ai_usage_log` from INFRA-02). Each row: points consumed + timestamp + household_id. Daily quota status computed by querying today's rows.
- **D-06:** Quota status (current pts / 150 pts today) is displayed in Settings / AI debug page only — not in the planner header. No new planner UI component needed.
- **D-07:** Fallback to AI generation triggers automatically when Spoonacular quota ≥ 80% (SEARCH-05). Fallback recipes labeled `source_provider: 'ai-generated'` in data (UI treatment deferred to Phase 16).

### Allergen Taxonomy (SAFE-05)

- **D-08:** Allergen taxonomy lives in `_shared/allergen-taxonomy.ts` as a hardcoded TypeScript map: `{ 'tree nuts': ['almond', 'cashew', 'walnut', ...], ... }`. Git-versioned. Zero DB queries. Update = deploy. No DB lookup table.

### Claude's Discretion

- Exact Spoonacular API endpoints and query parameter mapping
- How many candidate recipes `recipe-search` fetches per directive before selecting (e.g., fetch 3, pick best match)
- Schema for the Spoonacular quota log table
- Zero-results handling: if Spoonacular returns nothing for a directive, fallback to AI for that slot
- select-meals coordinator system prompt design (role: `coordinator`, max_tokens: 1024 from ROLE_CONFIG)

### Deferred Ideas (OUT OF SCOPE)

- RecipeDetail UI changes for grounded vs AI-generated recipes — Phase 16
- Lazy-save draft workflow — Phase 15
- AI Adapter for allergen substitutions — Phase 17
- `ai-proxy` deprecation / cleanup — Phase 17
- Edamam provider integration — future milestone (PROV-01 in REQUIREMENTS.md)
- Streaming recipe results — future milestone (CACHE-02)

None from discussion — scope stayed within Phase 14 boundary.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEARCH-01 | User can generate meals using real recipes from Spoonacular via cache-first search | Recommends `complexSearch` with enrichment flags, cache-write/read pattern, and quota math |
| SEARCH-02 | AI Coordinator outputs search directives instead of inventing recipes | Recommends `select-meals` JSON schema and frontend orchestration pattern |
| SEARCH-03 | User can configure how many meals to generate | Recommends household-level 2D generation matrix persisted outside planner page |
| SEARCH-04 | System tracks Spoonacular points consumed per day and displays quota status | Recommends quota log table, header-based point capture, Settings-only quota UI |
| SEARCH-05 | System automatically falls back to AI generation when Spoonacular quota is near exhaustion | Recommends preflight quota check at 80%, 402 handling, and per-slot fallback path |
| SAFE-05 | Allergy matching uses structured taxonomy | Recommends hardcoded taxonomy map plus exact ingredient-name normalization against `extendedIngredients` |
</phase_requirements>

## Summary

Phase 14 should be planned as a frontend-orchestrated two-step pipeline: `select-meals` produces narrow search directives, and `recipe-search` resolves those directives into real Spoonacular recipes while handling cache, quota, and fallback. The local codebase already supports most of the shape: shared AI client role config, service-role usage logging pattern, a recipe cache table, frontend Edge Function invocation, and a Settings page where quota/debug UI belongs.

Two external facts materially change the plan as of **April 17, 2026**. First, Spoonacular's current direct pricing page shows the **Free** tier at **50 points/day**, not 150. Second, Spoonacular's current pricing FAQ says cached user-requested data may be kept for **a maximum of 1 hour**, which conflicts with the repo's current Phase 13 recipe cache comment and 30-day TTL assumption. Those are not implementation details; they affect scope, migrations, quota thresholds, and whether the existing cache design is compliant.

**Primary recommendation:** Plan Phase 14 around a single enriched `complexSearch` call per directive, capture real quota headers on every response, make the daily limit configurable instead of hardcoding 150, and reconcile the cache TTL with Spoonacular's current 1-hour caching terms before implementation begins.

## Project Constraints (from CLAUDE.md)

None — no `CLAUDE.md` file exists at the repo root in this workspace.

## Standard Stack

### Core
| Library / API | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase Edge Functions | Deno-based runtime, repo pattern uses `std@0.168.0` | `select-meals` and `recipe-search` execution | Already established in `generate-plan`, `refresh-slot`, and `_shared/*` |
| Spoonacular REST API | Official docs/pricing verified 2026-04-17 | Real recipe search, nutrition, ingredients, aisle data, quota headers | Native provider required by this phase |
| `@supabase/supabase-js` | Repo pinned `2.40.0`; latest npm `2.103.3` published 2026-04-16 | Frontend function invocation and DB reads | Existing frontend dependency; no upgrade needed for this phase |
| Shared AI client | Repo local `_shared/ai-client.ts` | Coordinator call with enforced role config and token logging | Locked project pattern from Phase 13 |

### Supporting
| Library / Tool | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React | Repo pinned `18.2.0` | Planner + Settings state orchestration | Existing UI path for generation and quota display |
| Vitest | Repo pinned `1.4.0`; latest npm `4.1.4` published 2026-04-09 | Frontend tests for Settings and planner orchestration | Use for UI/service behavior only |
| Supabase CLI | `2.84.2` installed locally | Local Supabase workflows | Use for function deployment/emulation where possible |
| Deno CLI | Not installed locally | Deno unit/integration tests for Edge Functions | Required for first-class Edge Function tests; currently missing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Enriched `complexSearch` per directive | `complexSearch` ids + `informationBulk` | More moving parts and likely higher point burn for single-slot resolution unless cache hits are very high |
| Household preference persistence in DB | LocalStorage only | Violates D-03 household-level persistence and makes quota/testing behavior user-device-specific |
| Quota hardcoded to `150` | Configurable daily limit from env/DB + UI label | Required because official pricing on 2026-04-17 shows Free = 50 points/day |

**Installation:**
```bash
# No new npm package is required for the recommended approach.
# This phase uses native fetch plus existing Supabase/React dependencies.
```

**Version verification:** `npm view @supabase/supabase-js version time --json` returned latest `2.103.3` (published 2026-04-16). `npm view vitest version time --json` returned latest `4.1.4` (published 2026-04-09). The repo remains pinned to older versions; this phase should not include a dependency-upgrade detour.

## Architecture Patterns

### Recommended Project Structure
```text
supabase/
├── functions/
│   ├── select-meals/              # AI coordinator, outputs directives only
│   ├── recipe-search/             # Spoonacular search, cache, quota, fallback
│   └── _shared/
│       ├── ai-client.ts           # existing
│       ├── auth.ts                # existing
│       ├── cors.ts                # existing
│       └── allergen-taxonomy.ts   # new hardcoded taxonomy map
├── migrations/
│   ├── *_spoonacular_usage_log.sql
│   └── *_household_generation_preferences.sql
src/
├── lib/services/
│   ├── planner.ts                 # new orchestration helpers
│   └── household.ts               # household preference read/write
└── pages/
    ├── MealPlanner/MealPlanner.tsx
    └── Settings/Settings.tsx
```

### Pattern 1: Frontend-Orchestrated Two-Step Generation
**What:** The client invokes `select-meals`, receives directive JSON, then invokes `recipe-search` once with all directives.  
**When to use:** Every plan generation run in Phase 14.  
**Example:**
```typescript
// Source: project context + existing Supabase function invoke pattern
const directiveRes = await supabase.functions.invoke('select-meals', {
  body: {
    household_id,
    members,
    selected_meals,
    selected_days,
    week_start_date,
  },
})

const recipeRes = await supabase.functions.invoke('recipe-search', {
  body: {
    household_id,
    directives: directiveRes.data.directives,
    quota_limit: quotaLimit,
  },
})
```

### Pattern 2: Single Enriched Search Per Directive
**What:** Use Spoonacular `GET /recipes/complexSearch` with `instructionsRequired=true`, `fillIngredients=true`, `addRecipeInformation=true`, and `addRecipeNutrition=true`, with low `number` (recommend `2`).  
**When to use:** Normal grounded recipe resolution for each directive.  
**Example:**
```typescript
// Source: https://spoonacular.com/food-api/docs
const url = new URL('https://api.spoonacular.com/recipes/complexSearch')
url.searchParams.set('query', directive.query)
url.searchParams.set('type', directive.type)
url.searchParams.set('diet', directive.diet ?? '')
url.searchParams.set('cuisine', directive.cuisine ?? '')
url.searchParams.set('intolerances', directive.intolerances.join(','))
url.searchParams.set('excludeIngredients', directive.excludeIngredients.join(','))
url.searchParams.set('maxCalories', String(directive.maxCalories))
url.searchParams.set('instructionsRequired', 'true')
url.searchParams.set('fillIngredients', 'true')
url.searchParams.set('addRecipeInformation', 'true')
url.searchParams.set('addRecipeNutrition', 'true')
url.searchParams.set('number', '2')

const response = await fetch(url, {
  headers: { 'x-api-key': spoonacularApiKey },
})
```

### Pattern 3: Header-Driven Quota Accounting
**What:** Record `X-API-Quota-Request`, `X-API-Quota-Used`, and `X-API-Quota-Left` from Spoonacular responses instead of relying only on estimated point math.  
**When to use:** Every Spoonacular request, including failures that still return quota headers.  
**Example:**
```typescript
// Source: https://spoonacular.com/food-api/docs
const pointsThisRequest = Number(response.headers.get('X-API-Quota-Request') ?? '0')
const pointsUsedToday = Number(response.headers.get('X-API-Quota-Used') ?? '0')
const pointsLeftToday = Number(response.headers.get('X-API-Quota-Left') ?? '0')
```

### Pattern 4: Best-Effort Cache Within Provider Terms
**What:** Cache only recipe payloads the user requested, keyed by `spoonacular_id`, and treat entries older than 1 hour as expired.  
**When to use:** Before deciding whether a provider fetch is necessary for a candidate already in local cache.  
**Example:**
```sql
-- Source: current project schema + Spoonacular pricing FAQ (max 1 hour cache)
SELECT *
FROM public.recipe_cache
WHERE spoonacular_id = ANY($1)
  AND created_at > now() - interval '1 hour';
```

### Anti-Patterns to Avoid
- **Server-to-server function chaining:** D-01 forbids Deno Edge Function calls to other Edge Functions.
- **Immediate persistence after generation:** `MealPlanner.tsx` currently saves generation output right away; Phase 14 must not expand that into draft-mode UX because Phase 15 owns that workflow.
- **Quota math only:** Official headers are available; using only local estimates makes threshold logic drift.
- **Hardcoded `150` daily limit:** Official pricing changed; this must be configurable.
- **30-day Spoonacular cache reuse:** Current official FAQ allows max 1-hour caching.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recipe search DSL | Custom fuzzy search over cached JSON | Spoonacular `complexSearch` filters | Provider already supports diet, cuisine, intolerances, calorie bounds, and instructions filtering |
| Quota metering | Local heuristic counters only | Spoonacular quota headers + DB log | Headers provide actual request, used, and remaining points |
| Allergen detection | Raw substring scans over full instructions/summary | Structured taxonomy against `extendedIngredients[].name` and related normalized names | SAFE-05 explicitly rejects naive substring matching |
| Multi-step AI provider logic | New provider selection code in each function | Existing `_shared/ai-client.ts` | Keeps role config and token logging consistent |

**Key insight:** The deceptively hard part of this phase is not recipe search itself; it is the combination of provider terms, current quota limits, and project sequencing. Reusing official headers and provider filters is cheaper and safer than inventing local approximations.

## Common Pitfalls

### Pitfall 1: Planning Against Old Spoonacular Pricing
**What goes wrong:** The plan assumes 150 free points/day because that was the earlier project assumption.  
**Why it happens:** The repo state and context mention `150`, but Spoonacular's pricing page on **2026-04-17** shows **50 points/day** on the direct free plan.  
**How to avoid:** Make daily limit configurable and treat `150` as a project assumption that now requires explicit override.  
**Warning signs:** Threshold logic uses `120` points for fallback or UI labels show `150 pts today`.

### Pitfall 2: Shipping a Cache TTL That Violates Current Provider Terms
**What goes wrong:** The implementation uses the existing 30-day TTL language from Phase 13.  
**Why it happens:** The local migration comments predate current research, but Spoonacular's pricing FAQ currently says cached user-requested data may be kept only for **1 hour**.  
**How to avoid:** Add a Wave 0 migration or query-layer change that enforces a 1-hour effective TTL before live traffic uses the cache.  
**Warning signs:** SQL or comments still reference `interval '30 days'`.

### Pitfall 3: Treating `recipe_cache` as a Query Cache
**What goes wrong:** The planner assumes existing cache schema stores directive-to-result mappings.  
**Why it happens:** The table stores recipes by `spoonacular_id`, not search fingerprints.  
**How to avoid:** Plan for cache hits on recipe ids and payload reuse, not full local search replacement.  
**Warning signs:** Tasks promise "no provider call for repeat query" without adding query-cache structure.

### Pitfall 4: Exposing Raw Log Tables Without an Access Strategy
**What goes wrong:** Settings quota UI is planned, but no RLS/RPC/read path exists.  
**Why it happens:** `ai_usage_log` was intentionally service-write only in Phase 13.  
**How to avoid:** Include either a read-safe aggregate path or a household-scoped RLS policy for the new Spoonacular usage log.  
**Warning signs:** Settings page work has no migration/backend task attached.

### Pitfall 5: Using Spoonacular Intolerances as a Full Allergy Solution
**What goes wrong:** The plan assumes provider `intolerances` alone satisfies SAFE-05.  
**Why it happens:** Spoonacular supports only a fixed intolerance list; household allergies and avoidances are broader and more granular.  
**How to avoid:** Use provider intolerances as first-pass narrowing, then run taxonomy-based filtering on returned ingredient names.  
**Warning signs:** No `_shared/allergen-taxonomy.ts` task appears in the plan.

## Code Examples

Verified patterns from official sources:

### Search Recipes With Enrichment
```typescript
// Source: https://spoonacular.com/food-api/docs
const url = new URL('https://api.spoonacular.com/recipes/complexSearch')
url.searchParams.set('query', 'high protein pasta')
url.searchParams.set('diet', 'vegetarian')
url.searchParams.set('maxCalories', '700')
url.searchParams.set('instructionsRequired', 'true')
url.searchParams.set('fillIngredients', 'true')
url.searchParams.set('addRecipeInformation', 'true')
url.searchParams.set('addRecipeNutrition', 'true')
url.searchParams.set('number', '2')
```

### Capture Quota Headers
```typescript
// Source: https://spoonacular.com/food-api/docs
const quota = {
  request: Number(response.headers.get('X-API-Quota-Request') ?? '0'),
  used: Number(response.headers.get('X-API-Quota-Used') ?? '0'),
  left: Number(response.headers.get('X-API-Quota-Left') ?? '0'),
}
```

### Call the Shared Coordinator Role
```typescript
// Source: local project file supabase/functions/_shared/ai-client.ts
const aiResult = await callAI({
  role: 'coordinator',
  systemPrompt,
  userPrompt,
  responseFormat: { type: 'json_object' },
  householdId,
  edgeFunction: 'select-meals',
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AI invents full recipes in `generate-plan` | AI outputs directives, provider returns real recipes | Project v4.0 architecture shift | Better grounding and nutrition fidelity |
| Hardcoded provider selection in each Edge Function | Shared AI client with role config | Phase 13, 2026-04-17 | New coordinator should reuse `_shared/ai-client.ts` |
| Assumed 150 free points/day | Official free tier pricing page shows 50 points/day | Verified 2026-04-17 | Threshold, UX copy, and test expectations must change |
| 30-day recipe cache assumption | Official pricing FAQ allows max 1-hour cache | Verified 2026-04-17 | Existing cache policy likely needs correction before launch |

**Deprecated/outdated:**
- `generate-plan` as the main generation path: replaced by Phase 14 pipeline, though cleanup/removal is Phase 17.
- `refresh-slot` as the only refresh mechanism: replaced later by the new pipeline and draft-slot operations.

## Open Questions

1. **Is the household on Spoonacular Free or a paid plan?**
   - What we know: Official direct pricing on 2026-04-17 shows Free = 50 points/day, Cook = 1,500/day.
   - What's unclear: Project context still assumes 150/day.
   - Recommendation: Plan a configurable quota limit and confirm actual subscribed tier before finalizing threshold math.

2. **Must Phase 14 correct the current 30-day cache TTL, or is the project intentionally accepting a compliance risk?**
   - What we know: Official pricing FAQ currently states user-requested data may be cached for at most 1 hour.
   - What's unclear: Whether the team wants Phase 14 to adjust the existing Phase 13 cache design immediately.
   - Recommendation: Treat this as a Wave 0 blocker unless the user explicitly accepts the risk.

3. **Where should household generation preferences live?**
   - What we know: D-03 requires persistent household-level preferences; the current `households` table has no preference columns.
   - What's unclear: Whether the team prefers a JSONB preferences column on `households` or a dedicated settings table.
   - Recommendation: Use a single JSONB preferences column on `households` unless there is an existing settings-table convention elsewhere.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend tests/tooling | ✓ | `v24.14.0` | — |
| npm | Frontend tests/tooling | ✓ | `11.9.0` | — |
| Supabase CLI | Local Supabase workflows | ✓ | `2.84.2` | — |
| Deno CLI | Edge Function tests | ✗ | — | Limited fallback: deploy/invoke via Supabase tooling, but Deno unit tests remain blocked |
| Spoonacular API key in current shell | Real provider validation | ✗ | — | None for grounded validation; mock/AI fallback is not equivalent |
| `SUPABASE_URL` in current shell | Direct local shell-based function runs | ✗ | — | Supabase project config may still supply hosted envs, but shell-level verification is unavailable |
| `SUPABASE_SERVICE_ROLE_KEY` in current shell | Service-role local scripts | ✗ | — | None in current shell |

**Missing dependencies with no fallback:**
- `SPOONACULAR_API_KEY` for real end-to-end grounded recipe validation
- `deno` for direct local Edge Function test execution

**Missing dependencies with fallback:**
- Shell-level Supabase env vars are unset; some workflows can still proceed through the Supabase CLI/project config, but standalone shell scripts cannot assume them

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `1.4.0` in repo (latest `4.1.4` verified 2026-04-09) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- src/__tests__/settings.test.tsx` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEARCH-01 | `recipe-search` returns real grounded recipes and reuses cache when valid | Deno integration | `deno test supabase/functions/recipe-search/index.test.ts -A` | ❌ Wave 0 |
| SEARCH-02 | `select-meals` emits directive schema only, not recipes | Deno unit | `deno test supabase/functions/select-meals/index.test.ts -A` | ❌ Wave 0 |
| SEARCH-03 | Settings persists day x meal-type matrix and planner sends filtered generation payload | Vitest component/service | `npm test -- src/__tests__/settings-partial-generation.test.tsx` | ❌ Wave 0 |
| SEARCH-04 | Quota headers are logged and Settings displays current usage | Deno + Vitest | `deno test supabase/functions/recipe-search/quota.test.ts -A` and `npm test -- src/__tests__/settings-quota.test.tsx` | ❌ Wave 0 |
| SEARCH-05 | `recipe-search` falls back when quota >= 80% or provider returns 402 | Deno unit | `deno test supabase/functions/recipe-search/fallback.test.ts -A` | ❌ Wave 0 |
| SAFE-05 | Taxonomy-based filtering excludes mapped allergens without naive substring matching | Deno unit | `deno test supabase/functions/_shared/allergen-taxonomy.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** relevant targeted test command for touched file set
- **Per wave merge:** `npm test` plus targeted Deno tests for touched functions
- **Phase gate:** Frontend tests green and Edge Function tests green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `supabase/functions/select-meals/index.test.ts` — covers SEARCH-02
- [ ] `supabase/functions/recipe-search/index.test.ts` — covers SEARCH-01 and SEARCH-05
- [ ] `supabase/functions/recipe-search/quota.test.ts` — covers SEARCH-04
- [ ] `supabase/functions/_shared/allergen-taxonomy.test.ts` — covers SAFE-05
- [ ] `src/__tests__/settings-partial-generation.test.tsx` — covers SEARCH-03
- [ ] `src/__tests__/settings-quota.test.tsx` — covers SEARCH-04 UI
- [ ] Local Deno install for running Edge Function tests

## Sources

### Primary (HIGH confidence)
- Local project files:
  - `.planning/phases/14-spoonacular-integration-ai-coordinator/14-CONTEXT.md`
  - `.planning/REQUIREMENTS.md`
  - `.planning/milestones/v4.0-ROADMAP.md`
  - `supabase/functions/generate-plan/index.ts`
  - `supabase/functions/refresh-slot/index.ts`
  - `supabase/functions/_shared/ai-client.ts`
  - `supabase/migrations/20260417000001_recipe_cache.sql`
  - `supabase/migrations/20260417000004_ai_usage_log.sql`
- Spoonacular official docs: https://spoonacular.com/food-api/docs
  - Verified `complexSearch` parameters, quota math, intolerance list, quota headers, 402 behavior
- Spoonacular official pricing: https://spoonacular.com/food-api/pricing
  - Verified current plan limits and cache policy on 2026-04-17
- npm registry:
  - `npm view @supabase/supabase-js version time --json`
  - `npm view vitest version time --json`

### Secondary (MEDIUM confidence)
- Postman official Spoonacular collection:
  - `Search Recipes` endpoint documentation
  - `Get Recipe Information Bulk` endpoint documentation

### Tertiary (LOW confidence)
- None used for core recommendations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - mostly derived from repo-local code and official Spoonacular docs/pricing
- Architecture: MEDIUM - grounded in local code plus official endpoint behavior, but the quota/cache compliance gap requires a product decision
- Pitfalls: HIGH - the largest pitfalls come from direct contradictions between current repo assumptions and official 2026-04-17 Spoonacular docs/pricing

**Research date:** 2026-04-17
**Valid until:** 2026-04-24
