# Validation: Phase 4 - Meal Planner Core

## Goal
Verify the successful implementation of the core meal planning engine, Sunday-start calendar UI, AI-integrated generation, and the "Lock & Edit" workflow.

## Database & Schema (04-01)
- [x] **Table Integrity**: Confirm `recipes`, `meal_plans`, and `meal_plan_slots` tables exist with correct columns.
- [x] **RLS Security**: Verify that users can only access recipes and plans belonging to their own `household_id`.
- [x] **Constraint Check**: Ensure `week_start_date` is unique per `household_id` to prevent duplicate plans for the same week.
- [x] **Data Consistency**: Confirm `meal_plan_slots` correctly reference `recipes.id`.

## AI Proxy & Integration (04-01, 04-02)
- [x] **JSON Response**: Verify `ai-proxy` returns a parseable JSON object without markdown fences.
- [x] **Prompt Injection**: Verify the system prompt correctly includes household dietary profiles and leftover preferences.
- [x] **Batch Generation**: Confirm a single click generates a full 7-day plan with recipes.

## UI & Navigation (04-02)
- [x] **Calendar Layout**: Verify the planner grid starts on Sunday and ends on Saturday.
- [x] **Week Navigation**: Test "Next Week" and "Previous Week" buttons; ensure dates are calculated correctly using `date-fns`.
- [x] **Meal Selection**: Verify checking/unchecking meal types (B/L/D/S) correctly filters what the AI generates.
- [x] **Visual Audit**: Confirm the "earthy cookbook" aesthetic (Vanilla CSS, earthy tones, serif headings).

## Lock & Edit Workflow (04-03)
- [x] **Slot Locking**: "Lock" a meal slot, refresh the page, and ensure it remains locked.
- [x] **Manual Override**: Edit a meal slot's text manually, save, and verify it persists in the database.
- [x] **Partial Regeneration**:
    1. Lock one slot (e.g., Monday Dinner).
    2. Regenerate the plan.
    3. Verify the locked slot's recipe/text did NOT change, while unlocked slots were updated.
- [x] **Tactile Feedback**: Verify visual cues (e.g., icon change, color shift) when a slot is locked or in edit mode.
