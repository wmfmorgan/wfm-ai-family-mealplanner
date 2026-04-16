# Cross-Document Analysis: ai-revise-recipeplan.md vs ai_efficiency.md

**Date:** 2026-04-16  
**Purpose:** Identify contradictions, collisions, and required updates between the two AI architecture documents before implementation begins.

---

## Contradictions

### 1. Tiered Model Selection — Now Mostly Irrelevant

**efficiency.md §6, priority item #7:**
> Coordinator: capable model. Workers: fast model. Categorizer: cheapest model.
> Savings: 40-60% cost reduction, 30% latency reduction. Effort: 2-3 hours.

**revise-recipeplan.md:** Eliminates Workers (replaced by recipe API lookup) and Categorizer (replaced by provider aisle data). Only Coordinator and Adapter remain as LLM calls. Adapter fires rarely.

**Verdict:** Recommendation is dead as written. 4-tier model strategy reduces to 2 roles, one of which is uncommon. The 2-3 hour effort estimate and savings projection no longer apply. Could still assign capable model to Coordinator and fast model to Adapter, but the ROI collapses.

---

### 2. "Approach C" Evolved Beyond Efficiency Doc Description

**efficiency.md §4.4 Approach C:**
> Coordinator outputs specific recipe NAMES for each day/meal. Workers receive their assigned names and generate details only. Workers become "recipe detailers" not "recipe generators." Preserves parallelism.

**revise-recipeplan.md:** Workers don't exist. Coordinator outputs search directives (not recipe names). Recipe API provides details. No parallelism needed — DB/API lookup replaces LLM generation entirely.

**Verdict:** Natural evolution, not hard conflict. But efficiency doc's framing implies Workers still exist and run in parallel. Someone reading both docs sequentially would expect 3 Worker calls scoped to "detailing" — not zero Worker calls. Misleading if not reconciled.

---

### 3. Categorizer Optimization vs Categorizer Elimination

**efficiency.md §8.2 item #8:**
> Skip categorization LLM call — use Worker output. Workers already return ingredient categories. Validate against VALID_CATEGORIES list. Effort: 2-3 hours.

**revise-recipeplan.md Step 13:** Categorizer eliminated entirely. Aisle/category data comes from recipe provider's structured ingredient data. `categorize-ingredients` Edge Function removed.

**Verdict:** Same destination (no categorizer LLM call), different path. Efficiency doc assumes fix within current architecture. Revise doc replaces architecture. Efficiency recommendation becomes moot — no Workers to extract categories from.

---

## Collisions

### 1. `ai-proxy` Edge Function — Routing Not Specified

**efficiency.md** identifies provider resolution logic duplicated across 3 Edge Functions (`generate-plan`, `refresh-slot`, `ai-proxy`). Recommends consolidation.

**revise-recipeplan.md** introduces 2 new Edge Functions that make LLM calls (`select-meals`, `adapt-recipe`) but never specifies whether they:
- Route through `ai-proxy` (extra network hop, but centralized)
- Call providers directly (like `generate-plan` does today)
- Use a shared utility

**Collision:** If new Edge Functions bypass `ai-proxy` and inline their own provider resolution (copying the pattern from `generate-plan`), the duplication problem gets **worse** — 4 files with copy-pasted provider logic instead of 3.

**Resolution needed:** Revise doc should specify one of:
- Route `select-meals` and `adapt-recipe` through `ai-proxy`
- Extract shared `resolveProvider()` + `callAI()` into a Deno module imported by all Edge Functions
- Accept duplication with a note explaining why (e.g., Edge Function cold start isolation)

---

### 2. `temperature` / `max_tokens` Not Carried Forward

**efficiency.md §2, priority item #1 (highest priority, 30 min fix):**
> Add temperature + max_tokens to every LLM call.
> - Coordinator: temp=0.4, max_tokens=300
> - Workers: temp=0.7, max_tokens=2500
> - Categorizer: temp=0.1, max_tokens=500

**revise-recipeplan.md:** Neither `select-meals` nor `adapt-recipe` Edge Functions specify temperature or max_tokens in their `callAI` invocations.

**Collision:** The #1 efficiency fix (cheapest, highest ROI) is absent from the replacement architecture. New Coordinator outputs 21 directives — more structured JSON than old Coordinator's blueprint. Without max_tokens, output can bloat. Without temperature control, directive quality varies between calls.

**Recommended values for new architecture:**

| Agent | temperature | max_tokens | Rationale |
|-------|-------------|------------|-----------|
| select-meals (Coordinator) | 0.4 | 800 | 21 directives ≈ 600-700 tokens. Needs some creativity for variety, but structured output |
| adapt-recipe (Adapter) | 0.2 | 3000 | Modifying full recipe JSON. Must be deterministic — low temp prevents invention |
| Fallback AI generation | 0.5 | 2000 | Only fires on edge cases. Moderate creativity, bounded output |

---

## Updates Needed

### 1. Efficiency Doc Priority Table Is Stale

If revise plan is adopted, 5 of 10 priority items change status:

| # | Item | Original Status | Post-Revise Status |
|---|------|----------------|-------------------|
| 1 | Add temperature + max_tokens | **Still valid** | Apply to `select-meals` + `adapt-recipe` with updated values |
| 2 | Log token usage | **Still valid** | Apply to remaining LLM calls |
| 3 | Bulk recipe insert | **Still valid** | Applies to saving grounded recipes |
| 4 | Coordinator assigns names, Workers detail | **Superseded** | Coordinator outputs search directives. No Workers |
| 5 | Post-assembly allergy/constraint scan | **Still valid, mechanism changes** | Programmatic scan of `GroundedRecipe.ingredients` against allergen list. No LLM needed |
| 6 | Pass distilled constraints to Workers | **Incorporated** | `distillConstraints()` function already in revise doc's `select-meals` |
| 7 | Tiered model selection | **Mostly dead** | Only 2 LLM roles remain, one fires rarely |
| 8 | Skip categorization using Worker output | **Dead** | No Workers, no categorizer. Provider aisles replace both |
| 9 | Week-to-week history context | **Already incorporated** | Revise doc passes `recent_meals` to Coordinator |
| 10 | Streaming responses | **Deprioritized** | Pipeline is now 1 LLM call + API lookups. Total latency likely under 5s. Streaming less critical |

---

### 2. Efficiency Scorecard Would Shift

| Dimension | Current Score | Post-Revise Score | Why |
|-----------|-------------|-------------------|-----|
| **Latency** | B | **A-** | 1 LLM call + parallel API lookups vs 4 LLM calls |
| **Token Economy** | D | **A** | 1 call with distilled input. ~300 input + ~700 output tokens total |
| **Hallucination Control** | D | **A-** | Grounded recipes, real nutrition. Only risk is Adapter modifying quantities |
| **Duplication Prevention** | D | **B+** | Coordinator controls menu. Risk: API search could return same recipe for similar queries |
| **Consistency** | C | **A** | Fixed `GroundedRecipe` schema from API. No AI shape variance |
| **Model Selection** | C- | **B** | Fewer calls to optimize, but still single-model for remaining calls |
| **Observability** | D | **D** | Revise doc doesn't add logging. Still localStorage-only |
| **Caching** | F | **B** | `recipe_cache` table. But no Coordinator output caching |

**Composite would move from C+ to B+/A-** if efficiency doc's items #1-2 (temp/max_tokens + token logging) are carried into revise architecture.

---

### 3. Token Logging Missing from Revise Doc

**efficiency.md item #2:** Log `usage.prompt_tokens` + `usage.completion_tokens` from every API response. 1 hour effort. Enables all future cost optimization.

**revise-recipeplan.md:** Never mentions token logging for `select-meals` or `adapt-recipe`. The current `logger.ts` only logs client-side calls via `askAI()`. Edge Function LLM calls have no usage tracking.

**Impact:** Without this, you can't measure whether the architecture change actually reduced token spend. You'd be guessing.

**Action:** Add to revise doc Phase B: log `usage` object from `select-meals` and `adapt-recipe` responses to a `token_usage` table or structured Edge Function logs.

---

### 4. Fallback AI Path Inherits All Current Problems

**revise-recipeplan.md "Fallback" section:**
> If recipe API returns zero results, fall back to current AI generation. Mark as `source_provider: 'ai-generated'`.

**efficiency.md** documents these problems with current AI generation:
- No temperature or max_tokens
- No schema validation on output
- No allergy enforcement (prompt-only, no programmatic check)
- Nutrition numbers fabricated
- Ingredient shapes unpredictable

**The fallback path would inherit every one of these problems.** A user with an unusual dietary combination (the exact user most likely to hit the fallback) gets the worst-quality output.

**Action:** Revise doc's fallback must include:
1. `temperature: 0.5, max_tokens: 2000` on the generation call
2. Zod/schema validation on the AI response before returning
3. Post-generation programmatic allergy scan (check ingredient names against household allergens)
4. Nutrition marked as `source: 'ai-estimated'` in both data and UI
5. `GroundedRecipe` shape normalization (map AI's variable output into fixed schema)

This is the **highest severity** update needed. The fallback is the path where safety matters most (unusual diets = more likely to have severe allergies) and where current controls are weakest.

---

## Reconciliation Summary

| Issue | Severity | Action |
|-------|----------|--------|
| Tiered model selection dead | Low | Remove from efficiency priority list |
| "Approach C" description misleading | Medium | Update efficiency doc to reflect directive-based approach |
| Categorizer optimization moot | Low | Remove from efficiency priority list |
| `ai-proxy` routing unspecified | Medium | Revise doc must specify routing strategy for new Edge Functions |
| `temperature`/`max_tokens` missing | Medium | Add to `select-meals` and `adapt-recipe` in revise doc |
| Efficiency priority table stale (5/10 items) | Medium | Update or add "post-revise" column |
| Efficiency scorecard would shift | Low | Informational — update after implementation |
| Token logging missing | Medium | Add to revise doc Phase B |
| Fallback AI path unsafe | **High** | Add controls, validation, and allergy scan to fallback path |

---

## Recommended Reading Order for Implementer

1. **ai_efficiency.md** — understand current problems and why changes are needed
2. **This document** — understand which efficiency recommendations survive vs die
3. **ai-revise-recipeplan.md** — the implementation plan, with caveats from this document applied
4. **lazy-save.md** — the persistence model that sits beneath the generation pipeline
