# Phase 14: Spoonacular Integration & AI Coordinator - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 14-spoonacular-integration-ai-coordinator
**Areas discussed:** Invocation pattern, Quota display, Partial generation, Allergen taxonomy, Search calls, Quota reset

---

## Invocation Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Frontend orchestrates | Frontend calls select-meals → gets directives → calls recipe-search. Simpler functions, easier to debug, fallback logic in React. | ✓ |
| select-meals calls recipe-search | Server-to-server: select-meals invokes recipe-search internally. One frontend call but Deno-to-Deno HTTP adds complexity. | |

**User's choice:** Frontend orchestrates
**Notes:** Matches existing generate-plan pattern.

---

## Quota Display

| Option | Description | Selected |
|--------|-------------|----------|
| Settings / AI debug page only | Quota visible in existing Settings/AI debug area. No planner header changes. | ✓ |
| Planner header always | Small quota indicator in planner header (e.g. '142/150 pts'). Always visible. | |
| Only when near limit | Hidden normally. Banner/warning at ≥80%. | |

**User's choice:** Settings / AI debug page only
**Notes:** Keeps planner UI clean.

---

## Partial Generation

| Option | Description | Selected |
|--------|-------------|----------|
| Settings (persistent) | Saved per household. User sets once, all future runs use it. | ✓ |
| Per-generation dialog | Modal each time generation triggered. | |
| Both | Persistent default + per-run override. | |

**User's choice:** Settings (persistent)
**Notes:** User clarified: selection is 2D — which meal types (B/L/D) × which days of the week. Extends existing `selected_meals` pattern with day dimension.

---

## Allergen Taxonomy

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded TS map in _shared/ | `_shared/allergen-taxonomy.ts`. Git-versioned, zero DB queries. | ✓ |
| JSON file in _shared/ | Same but `.json`. Functionally identical. | |
| DB lookup table | `allergen_taxonomy` table. No deploy to update but adds DB round-trip. | |

**User's choice:** Hardcoded TS map in `_shared/allergen-taxonomy.ts`

---

## Search Calls (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| One call per slot (up to 21) | Frontend loops per directive. | |
| One batched call | Frontend sends all directives in one recipe-search call. Returns full week. | ✓ |

**User's choice:** One batched call
**Notes:** Fewer round-trips, quota counting in one place.

---

## Quota Reset Tracking (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Log table with daily query | DB table logging points + timestamp. Query today's rows for usage. Reuses INFRA-02 pattern. | ✓ |
| localStorage / client-side | No DB writes. Inaccurate across sessions. | |

**User's choice:** Log table with daily query

---

## Claude's Discretion

- Exact Spoonacular API endpoints and query parameter mapping
- Candidate recipe fetch count per directive (e.g., fetch 3, pick best)
- Spoonacular quota log table schema
- Zero-results fallback behavior per slot
- select-meals coordinator system prompt design

## Deferred Ideas

- RecipeDetail UI — Phase 16
- Lazy-save draft — Phase 15
- AI Adapter — Phase 17
- ai-proxy cleanup — Phase 17
