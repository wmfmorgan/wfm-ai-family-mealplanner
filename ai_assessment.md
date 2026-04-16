# AI Agent Architecture Assessment

**Project:** WFM Family Meal Planner  
**Reviewer:** Senior Architect Review  
**Date:** 2026-04-16  
**Scope:** AI agent usage for meal plan generation, review, and sanitization

---

## Executive Summary

The project implements a **Coordinator-Worker multi-agent pattern** for meal plan generation with a secondary **post-processing agent** for ingredient categorization. The architecture is pragmatic and ships value, but has significant gaps in validation, sanitization, and resilience that will compound as the user base grows.

**Overall Rating: B-** — Solid foundation, meaningful architectural gaps.

---

## 1. Architecture Overview

### Agent Inventory

| Agent | File | Role | Invocation |
|-------|------|------|------------|
| Coordinator | `generate-plan/index.ts:121-131` | Weekly blueprint (theme, protein rotation, diversity rules) | Sequential, Phase 1 |
| Breakfast Worker | `generate-plan/index.ts:157-158` | 7 breakfast recipes | Parallel, Phase 2 |
| Lunch Worker | `generate-plan/index.ts:160-161` | 7 lunch recipes | Parallel, Phase 2 |
| Dinner Worker | `generate-plan/index.ts:163-164` | 7 dinner recipes | Parallel, Phase 2 |
| Refresh Agent | `refresh-slot/index.ts:54-57` | Single slot replacement | On-demand |
| Categorization Agent | `categorize-ingredients/index.ts:97-99` | Ingredient grocery categorization | Non-blocking post-process |
| Generic Proxy Agent | `ai-proxy/index.ts` | Provider-agnostic routing layer | Utility |

### Flow Diagram

```
User → Generate
  ├─ Phase 1: Coordinator → blueprint JSON
  ├─ Phase 2: Promise.all([Breakfast, Lunch, Dinner]) → 7 recipes each
  ├─ Phase 3: Merge into 7-day plan
  ├─ Save: recipes → meal_plan → slots (sequential DB ops)
  └─ Background: categorize-ingredients → shopping_list_items

User → Refresh Slot
  ├─ refresh-slot agent (with exclusion list)
  ├─ Insert recipe → Update slot
  └─ (No re-categorization triggered)
```

---

## 2. What Works Well

### 2.1 Coordinator-Worker Pattern (generate-plan)
The separation of a Coordinator that establishes a cohesive blueprint before Workers execute in parallel is textbook good agent design. It solves the "oatmeal three times" problem elegantly — Workers receive diversity constraints without needing to see each other's output.

### 2.2 Parallel Execution
`Promise.all` for the three Worker agents is correct. Each Worker is independent given the shared blueprint. Cuts latency from ~3x sequential to ~1x (bounded by slowest Worker).

### 2.3 Provider Abstraction
The ai-proxy Edge Function creates a clean OpenAI-compatible abstraction over Gemini and Grok. Adding a new provider means adding one `else if` block. The generate-plan function also has its own direct provider routing, which duplicates this but keeps the critical path free from an extra network hop.

### 2.4 Exclusion-Based Refresh
The refresh-slot agent receives an exclusion list of existing meal names to prevent duplicates. Simple and effective for single-slot swaps.

### 2.5 Non-Blocking Categorization
Ingredient categorization fires asynchronously after plan save (`planner.ts:173`). Keeps the user-facing flow fast. Good trade-off.

---

## 3. Critical Gaps

### 3.1 No Sanitization Agent (HIGH)

**Problem:** There is no agent that reviews the complete assembled meal plan. The Coordinator provides a blueprint, Workers generate independently, and the merge phase (`generate-plan:186-195`) is purely structural — it zips arrays by index. Nobody checks:

- Whether Workers actually followed the Coordinator's blueprint
- Whether allergy/avoidance constraints were respected across all 21 meals
- Whether duplicate meals crept in across Workers (e.g., "Grilled Chicken" appearing as both lunch and dinner)
- Whether nutritional balance targets were met across the full week
- Whether recipes are realistic and instructions are coherent

**Impact:** Users with food allergies could receive unsafe recommendations. This is the single biggest risk in the current architecture.

**Recommendation:** Add a Reviewer Agent as Phase 4 that receives the full assembled plan + household profile and returns:
```json
{
  "allergy_violations": [...],
  "duplicate_meals": [...],
  "blueprint_drift": [...],
  "nutrition_gaps": [...],
  "verdict": "pass" | "fail",
  "suggested_swaps": [...]
}
```
If verdict is "fail", auto-trigger targeted re-generation for flagged slots.

### 3.2 Prompt Injection Surface (HIGH)

**Problem:** Household member data (names, dietary preferences, allergies, avoidances) is interpolated directly into prompts via `JSON.stringify(members)`. A malicious or accidentally adversarial value in any profile field (e.g., an allergy field containing `"ignore all previous instructions..."`) flows unsanitized into the system prompt.

**Files affected:**
- `generate-plan/index.ts:127` — `JSON.stringify(members)`
- `refresh-slot/index.ts:59` — `JSON.stringify(members)`
- `prompts.ts:29-32` — Direct string interpolation of profile fields

**Recommendation:** Sanitize user-provided strings before prompt interpolation. Strip control characters, limit field lengths, and consider using structured tool/function calling where supported instead of freeform prompt injection.

### 3.3 No Schema Validation on AI Output (HIGH)

**Problem:** AI responses are parsed as JSON and trusted immediately. The only validation is "is it valid JSON?" and "does it have a `.recipes` array?" (`generate-plan:176`). No validation that:
- Each recipe has required fields (name, ingredients, instructions)
- Ingredient arrays are the right shape
- Prep times are reasonable numbers (not strings, not negative)
- Recipe count matches expected (7 per Worker)
- Category values match expected enum

**Impact:** Malformed AI output silently propagates to the database and UI. One hallucinated field shape breaks downstream consumers.

**Recommendation:** Add a Zod/JSON Schema validation layer between AI response parsing and consumption. Reject and retry (with backoff) on schema violations. This is cheap defensive code, not speculative architecture.

### 3.4 Two Separate Prompt Systems (MEDIUM)

**Problem:** There are two independent prompt systems that appear to serve the same purpose:

1. **`src/lib/ai/prompts.ts`** — A well-structured `generateMealPlanPrompt()` function that produces a detailed prompt with locked slots, leftover strategy, appliance constraints, and a strict output format spec.

2. **`supabase/functions/generate-plan/index.ts`** — The actual Edge Function that generates plans, which has its own inline prompts (Coordinator + Workers) that are completely different in structure and content.

The `prompts.ts` file appears to be **dead code** — or at least not used by the primary generation pipeline. The Edge Function's prompts are simpler and lack several constraints that `prompts.ts` includes (locked slots, leftover strategy, appliance matching, nutrition output format).

**Impact:** Feature work on prompts may target the wrong file. Constraints defined in `prompts.ts` (locked slots, leftover strategy) are not actually enforced during generation.

**Recommendation:** Consolidate to a single source of truth for prompts. Either move the Edge Function's prompts into a shared module, or delete the unused `prompts.ts` if the Coordinator-Worker approach supersedes it.

### 3.5 No Retry or Circuit Breaker (MEDIUM)

**Problem:** If any Worker fails, `Promise.all` rejects and the entire generation fails. No retry logic, no partial recovery. For a 4-call pipeline (1 Coordinator + 3 Workers), the probability of at least one failure is non-trivial, especially with rate limits or transient errors.

**Recommendation:** Use `Promise.allSettled` with targeted retry for failed Workers. If a Worker fails after N retries, consider returning the plan with that meal type missing and surfacing a partial result to the user rather than a total failure.

### 3.6 Recipe Deduplication Gap (MEDIUM)

**Problem:** Recipes are inserted individually with no deduplication (`planner.ts:83-101`). If a user regenerates the same week, they get duplicate recipe rows. The `refreshSlot` path also inserts without checking if an identical recipe already exists.

**Impact:** Recipe table bloat. Duplicate recipes in search/history features. Shopping list items may reference different recipe IDs for the same dish.

### 3.7 Refresh Slot Doesn't Re-Categorize (LOW)

**Problem:** When a slot is refreshed (`plannerService.refreshSlot`, line 246-300), a new recipe is inserted but ingredient categorization is NOT re-triggered. The shopping list becomes stale — it reflects the original plan's ingredients, not the refreshed ones.

**Recommendation:** After `refreshSlot`, fire the same non-blocking categorization call that `saveMealPlan` does.

---

## 4. Duplication & Code Smell Analysis

### 4.1 Provider Resolution Logic (Duplicated 3x)

The provider/API key resolution block is copy-pasted across three files:
- `generate-plan/index.ts:51-65`
- `refresh-slot/index.ts:30-44`
- `ai-proxy/index.ts:78-91`

Each has slightly different fallback behavior. `generate-plan` and `refresh-slot` bypass `ai-proxy` entirely and call providers directly, making `ai-proxy` partially redundant for the critical path.

**Recommendation:** Either route all calls through `ai-proxy` (accepting the extra hop), or extract a shared `resolveProvider()` utility. Current state risks divergent behavior across endpoints.

### 4.2 JSON Fence Stripping (Duplicated 3x)

The markdown fence stripping regex appears in:
- `generate-plan/index.ts:105-107`
- `refresh-slot/index.ts:89-91`
- `ai-proxy/index.ts:145-148`

**Recommendation:** Centralize into a shared utility. This is a symptom of the broader issue: `generate-plan` and `refresh-slot` don't use `ai-proxy`, so they each reimplement its parsing logic.

---

## 5. Model & Provider Strategy

### Current State
- Two providers: Gemini (Google) and Grok (xAI)
- User-selectable in Settings UI, stored in localStorage
- Models range from flash-tier (gemini-1.5-flash) to reasoning-tier (grok-4-1-fast-reasoning)
- No Anthropic/OpenAI providers

### Observations
- The Coordinator and Workers use the **same model** for all calls. The Coordinator could use a more capable (slower) model since it's sequential and sets the blueprint, while Workers could use a faster model since they execute in parallel.
- No cost tracking or token usage monitoring. With 4 AI calls per generation + 1 categorization, costs can escalate quickly with reasoning-tier models.
- Model selection is entirely user-driven with no guardrails. A user selecting `grok-4-1-fast-reasoning` for all 4 calls may hit rate limits or timeouts.

**Recommendation:** Consider tiered model assignment — capable model for Coordinator, fast model for Workers. Add token usage tracking to the AI logger.

---

## 6. Security Assessment

| Vector | Status | Notes |
|--------|--------|-------|
| API key exposure | OK | Keys in Supabase Secrets, never client-side |
| JWT validation | OK | All Edge Functions validate auth |
| Prompt injection | RISK | User profile data unsanitized in prompts |
| CORS | WEAK | `Access-Control-Allow-Origin: '*'` on all Edge Functions |
| Rate limiting | MISSING | No per-user rate limits on generation |
| Service role key | CAUTION | `categorize-ingredients` uses service role key (`index.ts:72`) — appropriate for DB ops but verify RLS bypass is intentional |

---

## 7. Recommendations Priority Matrix

| # | Item | Effort | Impact | Priority |
|---|------|--------|--------|----------|
| 1 | Add Sanitization/Review Agent | Medium | Critical (safety) | P0 |
| 2 | Add schema validation on AI output | Low | High | P0 |
| 3 | Sanitize user input before prompt injection | Low | High (security) | P0 |
| 4 | Consolidate prompt systems | Low | Medium | P1 |
| 5 | Add retry logic with Promise.allSettled | Low | Medium | P1 |
| 6 | Consolidate provider resolution | Low | Low (code quality) | P1 |
| 7 | Re-trigger categorization on refresh | Low | Low | P2 |
| 8 | Tiered model assignment | Low | Medium (cost) | P2 |
| 9 | Add rate limiting | Medium | Medium (abuse) | P2 |
| 10 | Recipe deduplication | Medium | Low | P2 |

---

## 8. Conclusion

The Coordinator-Worker pattern is well-chosen and the parallel execution strategy is sound. The biggest architectural miss is the **absence of a post-assembly validation/sanitization agent** — meals go from AI generation to user display with no safety check against allergy violations or constraint drift. For a food-related application, this is a liability.

The secondary concern is **code duplication across Edge Functions** (provider resolution, JSON parsing, prompt definitions). This is typical of fast iteration but will increasingly cause bugs as the functions diverge.

Fixing the top 3 items (Review Agent, schema validation, input sanitization) would move this from B- to solid A-territory.
