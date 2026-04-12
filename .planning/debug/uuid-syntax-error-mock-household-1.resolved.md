# Debug Session: uuid-syntax-error-mock-household-1

**Status:** Resolved
**Date:** 2026-04-11

## Symptoms
- Console error on `MealPlanner` page load: `invalid input syntax for type uuid: "mock-household-1"`.
- Error code: `22P02`.
- Reproduction: Always on page load and during generation when `VITE_USE_MOCK=true`.

## Root Cause
The `plannerService` was querying Supabase with a mock ID `"mock-household-1"` where a UUID is expected. While `householdService` and `askAI` had mock logic, `plannerService` was missing an `IS_MOCK` check.

## Solution
Updated `src/lib/services/planner.ts` to include `IS_MOCK` checks in all methods (`getMealPlan`, `saveMealPlan`, `getRecipes`, `updateSlot`). Methods now return early with mock-appropriate data (e.g., `null` or `[]`) when mock mode is active, avoiding invalid UUID queries to Supabase.

## Verification
- User confirmed errors are gone and planner loads correctly.
- Generation flow verified by user.

---
*Resolved by Gemini CLI on 2026-04-11.*
