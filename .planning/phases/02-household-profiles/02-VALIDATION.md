# Validation: Phase 2 - Household & Profiles

## Goal
Verify the successful implementation of the automated household creation and the "cookbook-style" management UI.

## Database & Schema (02-01)
- [ ] **Trigger Robustness**: Create a user and verify `public.households` and `public.household_members` are created without race conditions.
- [ ] **JSONB Validation**: Insert a member with invalid `nutrition_profile` and ensure the database returns a 400/PGRST error.
- [ ] **RLS Security**: Verify that `auth.uid()` restricted access works for household members across different accounts.

## UI & Management (02-02)
- [ ] **Preset -> Custom Flow**: Select "Active Adult" preset, then toggle to "Advanced" and ensure calories/macros are correctly pre-filled and editable.
- [ ] **Hybrid Allergy Persistence**: Select "Dairy" toggle and add "No cilantro" to Chef's Notes. Verify both are saved to the JSONB field in Supabase.
- [ ] **Appliance Mapping**: Select "Slow Cooker" and "Air Fryer". Verify they are stored in the `appliances` array in the JSONB.
- [ ] **CRUD Operations**: 
  - Add a new family member.
  - Edit their profile.
  - Delete them (verify confirmation dialog).
- [ ] **Visual Audit**: Verify "minimalist, earthy" aesthetic (Vanilla CSS, No Tailwind).
- [ ] **Responsive Test**: Ensure `MemberGrid` and `ProfileForm` are usable on mobile viewports.
