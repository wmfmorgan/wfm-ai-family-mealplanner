# Research: Phase 2 - Household & Profiles

## Nutrition Profile Schema (JSONB)
To support the "multi-recipe hybrid strategy" for the AI, each member's `nutrition_profile` should follow a consistent structure.

### Proposed Structure:
```json
{
  "target_calories": 2000,
  "macro_targets": {
    "protein_pct": 30,
    "carbs_pct": 40,
    "fat_pct": 30
  },
  "allergies": ["peanuts", "dairy"],
  "avoidances": ["cilantro", "mushrooms"],
  "appliances": ["air_fryer", "slow_cooker", "oven", "stove"],
  "cooking_skill": "intermediate",
  "is_child": false
}
```

## Household Onboarding Flow
- **Automatic Creation:** A Supabase trigger should create a entry in `public.households` whenever a new user confirms their email in `auth.users`.
- **First Member:** The owner of the household should be the first member by default (usually "Me" or their name).

## UI Components (Cookbook Aesthetic)
Using Google Stitch, we'll need these specific components:
- **`MemberCard`**: A tactile, card-style element showing the member's name and a summary of their dietary needs (e.g., "Keto", "Nut-Free").
- **`MemberGrid`**: A responsive layout for displaying all household members.
- **`ProfileForm`**: A clean, focused form for editing calories, macros, and preferences. Use earthy tones and clear typography.
- **`TagCloud`**: For selecting allergies and avoidances easily.

## Database Refinements
- **Trigger:** Create a function `handle_new_user()` and a trigger `on_auth_user_created`.
- **Validation:** Add a CHECK constraint or a database function to validate the JSONB structure of `nutrition_profile` to ensure data integrity for the AI prompt builder later.

## Open Questions
- Should we have a predefined list of allergies/avoidances for better data consistency, or allow free-text?
  - *Recommendation*: Use a predefined list in the UI for common ones, but allow custom tags.
- How to handle "Me" vs other household members?
  - *Recommendation*: The first member created for a household can be flagged as `is_owner: true`.
