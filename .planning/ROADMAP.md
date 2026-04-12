# Roadmap: wfm-ai-family-mealplanner

## Phase 1: Foundation & Auth
**Goal:** Establish the technical foundation (Supabase, React, Vite + TS), core authentication (Email/Magic link), functional AI proxy routing, and a responsive "cookbook" shell using Google Stitch.
**Plans:** 3 plans
- [x] 01-01-PLAN.md — Technical Foundation, Schema & AI Proxy
- [x] 01-02-PLAN.md — Design Foundation & Auth Logic
- [x] 01-03-PLAN.md — Shell & Auth Flow

## Phase 2: Household & Profiles
**Goal:** Establish household and profile management with automatic initialization and cookbook-style UI.
**Plans:** 3 plans
- [x] 02-01-PLAN.md — Database & Schema Refinements
- [x] 02-02-PLAN.md — Household Management UI
- [x] 02-03-PLAN.md — Refinement & Fixes (UAT Gaps)

## Phase 3: AI Layer Enhancements
**Goal:** Implement a developer-centric AI abstraction layer in Supabase Edge Functions with multi-provider support (Gemini, Grok) and a transient local observability dashboard.
**Requirements:** [AI-01, AI-02, AI-03]
**Plans:** 3 plans
- [x] 03-01-PLAN.md — AI Logger Utility (TDD)
- [x] 03-02-PLAN.md — Edge Function Routing & AI Client
- [x] 03-03-PLAN.md — Settings & Debug UI

## Phase 4: Meal Planner Core
**Goal:** Implement the core meal planning experience with a weekly calendar, AI-driven generation, and persistence.
**Requirements:** [PLAN-01, GEN-01, REC-01, STATE-01, LOCK-01]
**Plans:** 5 plans
- [x] 04-01-PLAN.md — Database Schema & AI Backend
- [x] 04-02-PLAN.md — Calendar UI & Generation Flow
- [x] 04-03-PLAN.md — Interaction (Lock/Edit) & Polish
- [x] 04-04-PLAN.md — Fix Slot Locking & Date Consistency (Gap Closure)
- [x] 04-05-PLAN.md — Recipe Detail View (Gap Closure)

## Phase 5: Shopping List & Consolidation
**Goal:** Implement the shopping list generation and category-based grouping.
**Requirements:** [SHOP-01, SHOP-02]
- [x] Recipe Detail View (Moved to Phase 4 Gap Closure)
- [ ] Basic Shopping List logic (Grouping by category).
- [ ] Printing/Marking functionality.

## Phase 6: Final Polish & Deploy
- [ ] End-to-end testing of generation logic.
- [ ] Final visual audit (cookbook-vibe check).
- [ ] Deploy to Netlify.

## Backlog

### Phase 999.1: Allow cards to be deleted or individually refreshed (BACKLOG)

**Goal:** Captured for future planning
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.2: add cooking skill level - ingredients need more details (BACKLOG)

**Goal:** Captured for future planning
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.3: generate recipe pictures (BACKLOG)

**Goal:** Captured for future planning
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.4: allow/prevent duplicate meals (BACKLOG)

**Goal:** Captured for future planning
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.5: add print/export option for recipes (BACKLOG)

**Goal:** Captured for future planning
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)
