# Roadmap: wfm-ai-family-mealplanner

## Phase 1: Foundation & Auth
**Goal:** Establish the technical foundation (Supabase, React, Vite + TS), core authentication (Email/Magic link), functional AI proxy routing, and a responsive "cookbook" shell using Google Stitch.
**Plans:** 3 plans
- [x] 01-01-PLAN.md — Technical Foundation, Schema & AI Proxy
- [x] 01-02-PLAN.md — Design Foundation & Auth Logic
- [x] 01-03-PLAN.md — Shell & Auth Flow

## Phase 2: Household & Profiles
- [ ] Define Nutrition Profile schema in Supabase.
- [ ] Implement Household Management UI.
- [ ] CRUD for household members (Calories, Macros, Allergies, Appliances).

## Phase 3: AI Layer Enhancements
- [ ] Implement advanced provider switching (Gemini, Grok) in Edge Functions.
- [ ] Configure direct Ollama integration for local dev.
- [ ] Create AI Settings & Debug Page.

## Phase 4: Meal Planner Core
- [ ] Implement Calendar UI (Sunday–Saturday).
- [ ] Logic for selecting days/meals.
- [ ] Prompt Engineering for Multi-Recipe hybrid strategy.
- [ ] Persist generated meal plans by week.

## Phase 5: Recipes & Shopping List
- [ ] Recipe Detail View component.
- [ ] Basic Shopping List logic (Grouping by category).
- [ ] Printing/Marking functionality.

## Phase 6: Final Polish & Deploy
- [ ] End-to-end testing of generation logic.
- [ ] Final visual audit (cookbook-vibe check).
- [ ] Deploy to Netlify.
