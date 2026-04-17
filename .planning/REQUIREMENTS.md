# Requirements: wfm-ai-family-mealplanner

**Defined:** 2026-04-16
**Core Value:** Replace AI-invented recipes with database-grounded meals, implement lazy-save draft workflow, and consolidate all LLM calls through a shared client with enforced token controls.

## v4.0 Requirements

Requirements for milestone v4.0: Overhaul AI Architecture. Each maps to roadmap phases.

### Foundation & Infrastructure

- [x] **INFRA-01**: All LLM calls route through shared AI client with role-based temperature and max_tokens enforcement
- [x] **INFRA-02**: Shared AI client logs token usage (prompt_tokens, completion_tokens) for every LLM call
- [x] **INFRA-03**: Shared AI client handles provider resolution from environment variables (replaces duplicated logic across Edge Functions)
- [x] **INFRA-04**: Recipe cache table stores Spoonacular results with JSONB data, GIN indexes, extracted columns, and 30-day TTL
- [x] **INFRA-05**: Recipes table supports source tracking (source_id, source_provider, is_adapted, adaptations, image_url)
- [x] **INFRA-06**: Shopping list items table supports provider aisle data (aisle, amount, unit)

### Recipe Search & Grounding

- [x] **SEARCH-01**: User can generate meals using real recipes from Spoonacular via cache-first search
- [x] **SEARCH-02**: AI Coordinator outputs search directives (query, diet, cuisine, allergen exclusions, calorie range) instead of inventing recipes
- [x] **SEARCH-03**: User can configure how many meals to generate (partial generation for testing, not always 21)
- [x] **SEARCH-04**: System tracks Spoonacular points consumed per day and displays quota status to user
- [x] **SEARCH-05**: System automatically falls back to AI generation when Spoonacular quota is near exhaustion (~80%)

### Lazy-Save & Persistence

- [ ] **SAVE-01**: User can review generated meal plan as a draft before committing to database
- [ ] **SAVE-02**: User can delete, refresh, lock, and edit individual slots in draft mode without any database writes
- [ ] **SAVE-03**: User can explicitly save draft to database via "Save This Plan" action (single atomic bulk write)
- [ ] **SAVE-04**: User can discard draft and start over without database side effects
- [ ] **SAVE-05**: Draft persists across page refresh via localStorage backup with 24-hour staleness check
- [ ] **SAVE-06**: User is warned before navigating away with unsaved draft

### AI Adaptation & Safety

- [ ] **SAFE-01**: System programmatically scans assembled recipes for allergen violations against household profiles (not LLM-based)
- [ ] **SAFE-02**: AI Adapter modifies grounded recipes when allergen/avoidance/serving/skill issues detected (substitution, not invention)
- [ ] **SAFE-03**: Fallback AI-generated recipes include temperature, max_tokens, and schema validation controls
- [ ] **SAFE-04**: Fallback AI-generated recipes are labeled in data (`source_provider: 'ai-generated'`) and UI (visible badge on card and detail view)
- [x] **SAFE-05**: Allergy matching uses structured taxonomy (not naive substring matching)

### UI & Display

- [ ] **UI-01**: RecipeDetail works in both draft mode (React state) and persisted mode (DB) with full ingredient/instruction display
- [ ] **UI-02**: Grounded recipes show source attribution ("Recipe from Spoonacular") and verified nutrition badge
- [ ] **UI-03**: Draft mode shows Save/Discard controls and "Draft" indicator
- [ ] **UI-04**: Shopping list uses provider aisle categories instead of LLM categorization

### Cleanup & Deprecation

- [ ] **CLEAN-01**: `ai-proxy` Edge Function deprecated — logic absorbed into shared AI client
- [ ] **CLEAN-02**: `categorize-ingredients` Edge Function removed — replaced by provider aisle data
- [ ] **CLEAN-03**: `generate-plan` and `refresh-slot` Edge Functions replaced by new pipeline

## Future Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Provider Expansion

- **PROV-01**: Edamam recipe provider integration (lacks step-by-step instructions — UI needs branch)
- **PROV-02**: Provider selection in Settings UI

### Advanced Caching

- **CACHE-01**: Coordinator output caching (same household + same week = cached directives)
- **CACHE-02**: Streaming responses for perceived performance
- **CACHE-03**: pg_cron scheduled cache cleanup (requires Supabase Pro)

### Generation Quality

- **QUAL-01**: Week-to-week history context beyond 2 weeks
- **QUAL-02**: User recipe ratings feeding back into Coordinator preferences

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Edamam integration | Spoonacular first; Edamam deferred to future milestone |
| Paid Spoonacular tier | Free tier prototype first; upgrade after validation |
| Real-time streaming of recipe results | Latency likely under 5s with 1 LLM call + API lookups; streaming less critical |
| Recipe image generation | External dependency, not core to grounding architecture |
| Mobile-specific UI | Desktop-first; existing approach |
| User-submitted recipes | Different data flow; future milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 13 | Complete |
| INFRA-02 | Phase 13 | Complete |
| INFRA-03 | Phase 13 | Complete |
| INFRA-04 | Phase 13 | Complete |
| INFRA-05 | Phase 13 | Complete |
| INFRA-06 | Phase 13 | Complete |
| SEARCH-01 | Phase 14 | Complete |
| SEARCH-02 | Phase 14 | Complete |
| SEARCH-03 | Phase 14 | Complete |
| SEARCH-04 | Phase 14 | Complete |
| SEARCH-05 | Phase 14 | Complete |
| SAVE-01 | Phase 15 | Pending |
| SAVE-02 | Phase 15 | Pending |
| SAVE-03 | Phase 15 | Pending |
| SAVE-04 | Phase 15 | Pending |
| SAVE-05 | Phase 15 | Pending |
| SAVE-06 | Phase 15 | Pending |
| SAFE-01 | Phase 16 | Pending |
| SAFE-02 | Phase 17 | Pending |
| SAFE-03 | Phase 16 | Pending |
| SAFE-04 | Phase 16 | Pending |
| SAFE-05 | Phase 14 | Complete |
| UI-01 | Phase 16 | Pending |
| UI-02 | Phase 16 | Pending |
| UI-03 | Phase 16 | Pending |
| UI-04 | Phase 16 | Pending |
| CLEAN-01 | Phase 17 | Pending |
| CLEAN-02 | Phase 17 | Pending |
| CLEAN-03 | Phase 17 | Pending |

**Coverage:**
- v4.0 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0

---
*Requirements defined: 2026-04-16*
*Last updated: 2026-04-16 after roadmap creation*
