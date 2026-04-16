# AI Efficiency Assessment

**Project:** WFM Family Meal Planner  
**Reviewer:** Senior AI Agent Orchestration Architect  
**Date:** 2026-04-16  
**Focus:** Speed, consistency, hallucination control, duplication prevention, token economics

---

## Executive Summary

The project makes **4 sequential-then-parallel LLM calls** to generate a weekly meal plan, plus 1 async post-process call. The architecture prioritizes coherence (Coordinator blueprint) over raw speed. However, it leaves critical efficiency levers untouched: no temperature control, no max_tokens limits, no token tracking, no output schema enforcement, and no deduplication guard beyond a name-based exclusion list on single-slot refreshes.

**Efficiency Rating: C+** — Good parallel strategy, poor control surface. You're paying for tokens you don't need and trusting models you shouldn't.

---

## 1. Call Graph & Latency Analysis

### Current Pipeline: 4 LLM Calls (Sequential + Parallel)

```
                    ┌─────────────────┐
                    │   Coordinator   │  ~2-4s (depends on model)
                    │   1 LLM call    │
                    └────────┬────────┘
                             │ blueprint JSON
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Breakfast │  │  Lunch   │  │  Dinner  │  ~3-8s (parallel)
        │  Worker   │  │  Worker  │  │  Worker  │
        └──────────┘  └──────────┘  └──────────┘
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                    ┌─────────────────┐
                    │   Merge (code)  │  ~0ms
                    └────────┬────────┘
                             │
                    ┌─────────────────┐
                    │  Save to DB     │  ~200-500ms (sequential upserts)
                    └────────┬────────┘
                             │
                    ┌─────────────────┐
                    │  Categorize     │  ~2-4s (non-blocking, async)
                    │  1 LLM call     │
                    └─────────────────┘

Total user-facing latency: ~5-12s (Coordinator + slowest Worker + DB save)
Total LLM calls: 4 blocking + 1 async = 5 per generation
```

### Latency Bottlenecks

| Stage | Latency | Bottleneck |
|-------|---------|------------|
| Coordinator | 2-4s | Sequential, blocks everything. No max_tokens → model can ramble |
| Workers (parallel) | 3-8s | Bounded by slowest Worker. No max_tokens → variable response sizes |
| DB save | 200-500ms | N+1 recipe inserts (sequential loop, `planner.ts:83-101`) |
| Categorization | 2-4s | Non-blocking, invisible to user |

### Observation: The Coordinator Is the Critical Path

Coordinator output is ~100 tokens of useful JSON. But with no `max_tokens` limit, the model may produce 500+ tokens of preamble, explanations, or over-engineered blueprints. Every extra second on the Coordinator delays the entire pipeline.

---

## 2. Token Economics (Unmanaged)

### Current State: Zero Controls

| Parameter | Value Set | Optimal |
|-----------|-----------|---------|
| `temperature` | **not set** (provider default, typically 1.0) | 0.3-0.7 for structured output |
| `top_p` | **not set** | 0.9 for recipe diversity within bounds |
| `max_tokens` | **not set** | Coordinator: 300, Workers: 2000, Categorizer: 500 |
| `frequency_penalty` | **not set** | 0.3 to reduce repetitive ingredient patterns |
| `presence_penalty` | **not set** | 0.2 to encourage novel recipes |
| Token usage tracking | **none** | Log `usage.prompt_tokens` + `usage.completion_tokens` per call |

### Estimated Token Spend Per Generation (uncontrolled)

| Call | Input Tokens (est.) | Output Tokens (est.) | Notes |
|------|---------------------|----------------------|-------|
| Coordinator | ~300 | 200-800 | Highly variable without max_tokens |
| Breakfast Worker | ~500 | 800-3000 | 7 recipes, unconstrained |
| Lunch Worker | ~500 | 800-3000 | Same |
| Dinner Worker | ~500 | 800-3000 | Same |
| Categorizer | ~400 | 200-600 | Depends on unique ingredient count |
| **Total** | **~2,200** | **~2,800-10,400** | |

Without `max_tokens`, output variance is **3.7x** between best and worst case. You're paying for the worst case and the user is waiting for it.

### Recommendation: Set Explicit Limits

```typescript
// Coordinator — needs to be fast and concise
{ max_tokens: 300, temperature: 0.4 }

// Workers — need variety but structured output
{ max_tokens: 2500, temperature: 0.7 }

// Categorizer — deterministic mapping
{ max_tokens: 500, temperature: 0.1 }

// Refresh slot — single recipe
{ max_tokens: 500, temperature: 0.8 }
```

---

## 3. Hallucination Risk Analysis

### 3.1 No Grounding Source

**Problem:** Workers generate recipes from pure parametric knowledge. No retrieval, no recipe database lookup, no grounding. The model invents recipes, nutrition facts, prep times, and ingredient quantities from training data.

**Impact by field:**

| Field | Hallucination Risk | Consequence |
|-------|-------------------|-------------|
| `name` | Low | Model can name recipes freely |
| `description` | Low | Creative text, hallucination is fine |
| `ingredients` | **Medium** | May invent non-existent products or unusual combos |
| `instructions` | **Medium** | May produce unsafe cooking instructions (wrong temps, times) |
| `nutrition` | **High** | Calorie/macro numbers are pure fabrication — models cannot compute nutrition |
| `prep_time_minutes` | **Medium** | Often wildly inaccurate |
| `servings` | Low | Usually reasonable |

**Critical finding:** `nutrition` data from `prompts.ts:59` requests `{ calories, protein, carbs, fat }` but the generate-plan Edge Function workers **don't request nutrition at all** — they request `prep_time_minutes` only. So nutrition data is either missing or comes from a dead code path. Either way, any nutrition numbers shown to users are ungrounded.

### 3.2 Allergy Hallucination

**Problem:** Allergies and avoidances are listed in the prompt but there's no enforcement layer. The model is **asked** to respect them — it's not **prevented** from violating them.

Example prompt flow:
```
Household Members: [{"nutrition_profile":{"allergies":["peanuts","shellfish"]...}}]
→ Worker receives this via JSON.stringify
→ Model generates recipes
→ No check that recipes exclude peanuts/shellfish
→ Recipes saved directly to DB
```

**This is the highest-consequence hallucination in the system.** A model that "forgets" a peanut allergy halfway through 7 recipes produces dangerous output.

### 3.3 Constraint Drift Between Coordinator and Workers

The Coordinator produces a blueprint with `diversity_rules` and `protein_rotation`. Workers receive this as context. But nothing verifies Workers followed it. The blueprint is **advisory, not binding**.

Measured risk: Workers using fast models (gemini-1.5-flash) are more likely to ignore blueprint constraints than Workers using capable models (grok-3). Since all calls use the same model, you can't optimize for this.

---

## 4. Duplication Analysis

### 4.1 Within a Single Generation

**Intra-Worker duplication:** Each Worker generates 7 recipes independently. No mechanism prevents a Worker from producing "Grilled Chicken Salad" on Day 2 and Day 5.

**Inter-Worker duplication:** Workers run in parallel with no shared state. Breakfast Worker might produce "Chicken & Waffles" while Dinner Worker produces "Grilled Chicken" — not identical but repetitive protein-wise. The Coordinator's `protein_rotation` is supposed to prevent this, but it's unverified.

**Current mitigation:** The Coordinator blueprint includes `diversity_rules` — purely prompt-based. No programmatic enforcement.

### 4.2 Across Generations

**Week-to-week duplication:** No history of previous weeks is passed to the generation pipeline. Generating plans for consecutive weeks will likely produce overlapping recipes, especially with deterministic models (low temperature) or limited dietary profiles.

**Current mitigation:** None.

### 4.3 Refresh Slot (Partial Fix)

`refresh-slot` receives an exclusion list of current week's meal names (`MealPlanner.tsx:172-179`). This is the **only** programmatic deduplication in the system. It only works for single-slot refreshes, not full generation.

### 4.4 Duplication Prevention Strategy (Missing)

What would work:

```
APPROACH A: Post-hoc deduplication (cheap, add now)
- After merge, scan recipe names for similarity (Levenshtein or embedding distance)
- Flag duplicates, re-prompt specific Workers for replacement recipes
- Cost: ~1 extra LLM call per flagged duplicate

APPROACH B: Shared context (more effective, more complex)  
- Run Workers sequentially, each receiving previous Workers' output
- Kills parallelism. Latency goes from max(Workers) to sum(Workers)
- Not recommended for this architecture

APPROACH C: Coordinator-enforced menu (best balance)
- Coordinator outputs specific recipe NAMES for each day/meal
- Workers receive their assigned names and generate details only
- Deduplication happens at Coordinator level (1 call, easier to control)
- Workers become "recipe detailers" not "recipe generators"
- Preserves parallelism, eliminates inter-worker duplication
```

**Recommendation:** Approach C. Shifts naming authority to the Coordinator. Workers generate recipe details for pre-assigned names. Eliminates both intra-worker and inter-worker duplication at the source.

---

## 5. Consistency Analysis

### 5.1 Output Schema Variance

Workers are told to return:
```json
{ "recipes": [{ "name", "description", "ingredients", "instructions", "category", "prep_time_minutes" }] }
```

But `MealPlanner.tsx:262` also maps `prep_time_min` as a fallback:
```typescript
prep_time_min: r.prep_time_minutes || r.prep_time_min || 0
```

This suggests the AI sometimes returns `prep_time_min` vs `prep_time_minutes`. No schema validation catches this — the frontend just patches around it.

### 5.2 Ingredient Shape Variance

Worker system prompt requests:
```json
"ingredients": Array<{ "item": string, "amount": string, "category": string }>
```

But `prompts.ts` (the unused prompt file) requests:
```json
"ingredients": ["1 cup item", "2tbsp item"]
```

And `planner.ts:160-166` handles **both formats**:
```typescript
if (typeof i === 'string') return i;
if (typeof i === 'object' && i !== null) {
  return `${i.amount || ''} ${i.item || i.name || ''}`.trim();
}
```

The model decides which format to return on any given call. This is a consistency failure — downstream consumers (shopping list, categorizer) get unpredictable input shapes.

### 5.3 Temperature = Undefined = Inconsistent

Without explicit temperature:
- **Gemini default:** 1.0 (creative, high variance)
- **Grok default:** varies by model

Same prompt → different outputs each time → different recipe counts, field names, detail levels. For structured data generation, this is too much entropy.

---

## 6. Model Selection Efficiency

### Current: One Model for All Calls

User picks one model in Settings. That model handles Coordinator (needs reasoning) and Workers (need creativity + structure) and Categorizer (needs determinism).

### Optimal: Tiered Model Assignment

| Agent | Need | Optimal Model Class | Why |
|-------|------|--------------------|----|
| Coordinator | Reasoning, planning | Capable (grok-3, gemini-1.5-pro) | Blueprint quality drives everything downstream |
| Workers | Structured creativity | Fast (gemini-1.5-flash, gemini-2.5-flash) | 3x parallel, speed matters, constrained output |
| Categorizer | Deterministic mapping | Cheapest available (gemini-1.5-flash) | Lookup task, not creative |
| Refresh | Single recipe creativity | Mid-tier | Single call, quality visible to user |

**Savings estimate:** Using flash-tier for Workers instead of pro-tier cuts Worker token costs by ~60-80% and latency by ~40%.

---

## 7. Specific Inefficiencies

### 7.1 Coordinator Output Is Underutilized

Coordinator returns `protein_rotation`, `diversity_rules`, `breakfast_blueprint`, `lunch_blueprint`, `dinner_blueprint`. Workers receive the relevant blueprint string. But:

- `protein_rotation` array is **never passed to Workers** — only the blueprint text
- `diversity_rules` string is **never passed to Workers**
- Workers only get `blueprint[type_blueprint]` and `blueprint.theme`

Half the Coordinator's output is wasted tokens.

### 7.2 Full Member JSON in Every Worker Call

Each Worker receives `JSON.stringify(members)` — the entire household profile. For a 4-member household with detailed nutrition profiles, this is ~400-600 tokens repeated 3x (once per Worker).

**Optimization:** The Coordinator already digests member profiles into constraints. Workers should receive the Coordinator's distilled constraints, not raw member data. Saves ~800-1200 input tokens per generation.

### 7.3 N+1 Recipe Insert Pattern

`planner.ts:83-101` inserts recipes one at a time in a loop:
```typescript
for (const recipe of recipes) {
  const { data, error } = await supabase.from('recipes').insert({...}).select().single();
}
```

For 21 recipes (7 days × 3 meals), that's 21 sequential DB round trips. Should be a single bulk insert with `.insert(recipes).select()`.

### 7.4 Categorizer Re-flattens Structured Ingredients

Workers return structured ingredients `{ item, amount, category }`. The categorizer receives flattened strings and re-categorizes with an LLM call.

Workers already assign `category` to each ingredient. If that field were validated and used, the entire categorization LLM call could be eliminated for most ingredients — only uncategorized/ambiguous items need the AI call.

**Potential saving:** Eliminate 1 LLM call per generation entirely.

### 7.5 No Response Caching

Same household, same members, regenerating for the same week = full pipeline re-execution. No semantic caching, no blueprint reuse.

For the Coordinator specifically: same household profile should produce a similar blueprint. Cache Coordinator output for ~1 hour (same household + same week) and skip straight to Workers.

---

## 8. Recommended Architecture Changes

### 8.1 Immediate Wins (Low Effort, High Impact)

```
┌─────────────────────────────────────────────────────────┐
│ 1. Add temperature + max_tokens to every LLM call       │
│    - Coordinator: temp=0.4, max_tokens=300              │
│    - Workers: temp=0.7, max_tokens=2500                 │
│    - Categorizer: temp=0.1, max_tokens=500              │
│    Impact: 40-60% reduction in output variance          │
│    Effort: 30 minutes                                   │
├─────────────────────────────────────────────────────────┤
│ 2. Log token usage from API responses                   │
│    - Every OpenAI-compatible response includes           │
│      usage.prompt_tokens + usage.completion_tokens       │
│    - Log to DB or structured logging                    │
│    Impact: Visibility into cost per generation          │
│    Effort: 1 hour                                       │
├─────────────────────────────────────────────────────────┤
│ 3. Bulk insert recipes instead of N+1 loop              │
│    Impact: 21 DB calls → 1 DB call                      │
│    Effort: 30 minutes                                   │
├─────────────────────────────────────────────────────────┤
│ 4. Pass distilled constraints to Workers, not raw JSON  │
│    Impact: ~1000 fewer input tokens per generation      │
│    Effort: 1 hour                                       │
└─────────────────────────────────────────────────────────┘
```

### 8.2 Medium-Term Improvements

```
┌─────────────────────────────────────────────────────────┐
│ 5. Coordinator assigns recipe NAMES, Workers detail     │
│    - Eliminates duplication at source                   │
│    - Coordinator: "Day 1 Breakfast: Spinach Frittata"   │
│    - Worker: receives name → generates recipe body      │
│    Impact: Zero inter-worker duplication                │
│    Effort: 4-6 hours (prompt rewrite + output mapping)  │
├─────────────────────────────────────────────────────────┤
│ 6. Post-assembly validation pass                        │
│    - Scan assembled plan for: allergy violations,       │
│      duplicate names, missing fields, nutrition gaps    │
│    - Can be programmatic (no LLM needed for most)       │
│    Impact: Catches hallucinated allergy violations      │
│    Effort: 4-6 hours                                    │
├─────────────────────────────────────────────────────────┤
│ 7. Tiered model selection                               │
│    - Coordinator: capable model                         │
│    - Workers: fast model                                │
│    - Categorizer: cheapest model                        │
│    Impact: 40-60% cost reduction, 30% latency reduction │
│    Effort: 2-3 hours                                    │
├─────────────────────────────────────────────────────────┤
│ 8. Skip categorization LLM call — use Worker output     │
│    - Workers already return ingredient categories       │
│    - Validate against VALID_CATEGORIES list              │
│    - Only call LLM for unrecognized categories          │
│    Impact: Eliminate 1 LLM call per generation          │
│    Effort: 2-3 hours                                    │
└─────────────────────────────────────────────────────────┘
```

### 8.3 Future Architecture (If Scaling)

```
┌─────────────────────────────────────────────────────────┐
│ 9. Streaming responses for perceived performance        │
│    - Stream Coordinator output → show blueprint to user │
│    - Stream Worker outputs → populate grid progressively│
│    Impact: Perceived latency drops from 8s to <2s       │
│    Effort: 1-2 days                                     │
├─────────────────────────────────────────────────────────┤
│ 10. Week-to-week history context                        │
│    - Pass last 2 weeks' recipe names to Coordinator     │
│    - "Avoid these recent meals: [...]"                  │
│    Impact: Cross-week variety                           │
│    Effort: 2-3 hours                                    │
├─────────────────────────────────────────────────────────┤
│ 11. Blueprint caching                                   │
│    - Same household + same week = cached Coordinator    │
│    - Only re-run Workers on regenerate                  │
│    Impact: Cuts 1 LLM call on regeneration              │
│    Effort: 2 hours                                      │
└─────────────────────────────────────────────────────────┘
```

---

## 9. Efficiency Scorecard

| Dimension | Score | Key Issue |
|-----------|-------|-----------|
| **Latency** | B | Parallel workers good, but no max_tokens = variable wait times |
| **Token Economy** | D | No limits, no tracking, full member JSON repeated 3x, wasted Coordinator fields |
| **Hallucination Control** | D | No temperature control, no output validation, nutrition numbers fabricated |
| **Duplication Prevention** | D | Only on single-slot refresh. Zero for full generation |
| **Consistency** | C | Schema variance between calls, ingredient shape unpredictable |
| **Model Selection** | C- | Same model for all roles, user-selected with no guardrails |
| **Observability** | D | localStorage-only logging (10 entries), no token usage, no cost tracking |
| **Caching** | F | None. Every generation is a full cold pipeline |

**Composite: C+**

---

## 10. Priority Execution Order

If I had to fix this in order of impact-per-hour:

| Order | Fix | Hours | Impact |
|-------|-----|-------|--------|
| 1 | Add `temperature` + `max_tokens` to all calls | 0.5 | Consistency + speed + cost |
| 2 | Log `usage` tokens from API responses | 1 | Visibility (enables all other optimizations) |
| 3 | Bulk recipe insert | 0.5 | DB latency |
| 4 | Coordinator assigns names, Workers detail | 5 | Duplication elimination |
| 5 | Post-assembly allergy/constraint scan | 5 | Safety |
| 6 | Pass distilled constraints to Workers | 1 | Token savings |
| 7 | Tiered model selection | 3 | Cost + latency |
| 8 | Skip categorization call using Worker categories | 3 | Eliminate 1 LLM call |
| 9 | Week-to-week history context | 3 | Cross-week variety |
| 10 | Streaming responses | 8-12 | Perceived performance |

Items 1-3 are afternoon work. Items 4-5 are the architectural pivots that move the rating from C+ to B+.
