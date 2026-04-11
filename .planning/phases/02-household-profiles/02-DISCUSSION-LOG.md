# Discussion Log: Phase 2 - Household & Profiles

## 2026-04-11: Phase 2 Kickoff & Research

### Research Findings
- **Database**: `households` and `household_members` tables are already in place in `20260411000000_initial_schema.sql`.
- **Auth**: Magic link auth is functional, but household auto-initialization is missing.
- **UI**: Placeholder routes exist for `/household` but need implementation.

### Key Assumptions (via gsd-assumptions-analyzer)
1. **Household Lifecycle**: We assume a new user should automatically have a `household` record created. This is best handled via a Supabase database trigger to ensure consistency.
2. **Nutrition Profile**: The `nutrition_profile` JSONB will be a flat object containing calories, macros, allergies, avoidances, skills, and appliances.
3. **Primary Member**: The household owner should be the first member, likely created during onboarding.

### Architectural Mapping (via gsd-codebase-mapper)
- **Implementation Areas**:
  - `supabase/migrations/`: New migration for triggers.
  - `src/pages/Household/`: New page for management.
  - `src/components/Household/`: New Stitch-generated components (`MemberCard`, `MemberGrid`, `ProfileForm`).
  - `src/lib/supabase.ts`: New functions for household CRUD.

### Decisions Made
- [x] Use a Database Trigger for household creation on `auth.users` insert.
- [x] Use Google Stitch for all new UI components.
- [x] Adhere to the "minimalist earthy cookbook" aesthetic.
