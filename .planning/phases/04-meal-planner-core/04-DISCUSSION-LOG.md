# Phase 4: Meal Planner Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 04-meal-planner-core
**Areas discussed:** Calendar & Layout, Meal Generation Strategy, AI Complexity Setting, Recipe Privacy & Data, AI Strategy Balance, Batch Refinement Workflow

---

## Calendar & Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Paginated Week (Sun–Sat) | Sunday to Saturday pagination (Traditional) | ✓ |
| Rolling 7-Day View | Always show next 7 days from today | |
| Static Dashboard (One Week) | One fixed "This Week" view | |

**User's choice:** Paginated Week (Sun–Sat)
**Notes:** Preferred for standard calendar behavior.

---

## Meal Generation Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Batch Generation (One-Click) | One click populates all, then refine slots | ✓ |
| Piecemeal Generation (Slot-by-Slot) | Generate each day/meal slot manually | |
| AI "Refill" Strategy (Hybrid) | AI fills only empty slots you haven't filled manually | |

**User's choice:** Batch Generation (One-Click)
**Notes:** Efficiency prioritized.

---

## AI Complexity Setting

| Option | Description | Selected |
|--------|-------------|----------|
| Global Household Setting | Single setting in household profile (e.g., Easy) | ✓ |
| Per-Generation Toggle | Select complexity per generation request | |
| AI's Discretion (Prompt-based) | No setting, AI decides based on notes/context | |

**User's choice:** Global Household Setting
**Notes:** Simplicity at the household level.

---

## Recipe Privacy & Data

| Option | Description | Selected |
|--------|-------------|----------|
| Household Private (Copy-per-House) | Recipes are 100% private to the household | ✓ |
| Global Shared Library (Shared) | Common recipes shared across all users | |
| Hybrid (Local-First Library) | Search global, save local copies if customized | |

**User's choice:** Household Private (Copy-per-House)
**Notes:** Maximum privacy for household generations.

---

## AI Strategy Balance

| Option | Description | Selected |
|--------|-------------|----------|
| Strict Efficiency (Batching) | Always plan leftovers for next day | |
| Suggested Efficiency (Hybrid) | Prioritize variety, batch where sensible | |
| Manual Mode Toggle (User choice) | User chooses "Mode" before generation | |

**User's choice:** The user will indicate if they want recipes to result in leftovers.
**Notes:** User input before generation starts.

---

## Batch Refinement Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Lock & Regenerate Workflow | Lock favorite slots, regenerate rest | |
| Edit & Save (Text-first) | Manually edit slot text before saving | |
| Both: Lock + Edit Workflow | Both Lock/Regen + manual text editing | ✓ |

**User's choice:** Both: Lock + Edit Workflow
**Notes:** Maximum flexibility for refinement.

---

## Deferred Ideas
- Global Recipe Sharing.
- Advanced Shopping List grouping (Phase 5).
