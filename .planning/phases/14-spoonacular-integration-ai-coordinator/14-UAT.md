---
status: complete
phase: 14-spoonacular-integration-ai-coordinator
source:
  - 14-01-SUMMARY.md
  - 14-02-SUMMARY.md
  - 14-03-SUMMARY.md
  - 14-04-SUMMARY.md
started: 2026-04-18T00:00:00Z
updated: 2026-04-18T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Settings Generation Matrix
expected: Open Settings. A 3x7 grid of toggles (days × meal types) is visible. Toggling a cell on/off and saving persists the change — reloading Settings shows the same state. The matrix reflects which days and meal types will be included in generation.
result: issue
reported: "i see the settings and can toggle them, but they are not in a grid"
severity: minor

### 2. Settings Quota Display
expected: In Settings debug section, a compact Spoonacular quota summary is visible above the AI interaction log. It shows current points used / daily limit (e.g., "0 / 150 pts"). If no calls have been made it shows an empty/zero state — it does not error.
result: issue
reported: "i see that but the max is 50 points per day, not 150"
severity: major

### 3. Two-Step Generation Flow
expected: Click Generate in MealPlanner. Network requests show two sequential edge function calls: first to select-meals (returns directives), then to recipe-search (returns grounded slots). The old generate-plan endpoint is NOT called.
result: pass

### 4. Grounded Recipe Slots
expected: After generating, meal slots in the planner show recipe metadata — at minimum an image and recipe name sourced from Spoonacular. Clicking into a slot shows ingredient details with aisle information where available. The slot has source fields (source_provider = "spoonacular", source_id present).
result: issue
reported: "when i generate a meal plan, i get a fallback recipe (i dont see any console errors), i do not see a picture, and i see fallback ingredients. fail"
severity: major

### 5. Settings-Scoped Generation
expected: In Settings, disable one or more days or meal types in the matrix and save. Return to MealPlanner and Generate. Only the enabled days/meal types receive new slots — the disabled ones are left empty or unchanged.
result: pass

### 6. AI Fallback Labeling
expected: When Spoonacular quota is exhausted (or simulated near threshold), slots that cannot be grounded are labeled as "AI-generated" in the UI. These fallback slots do NOT show aisle/shopping metadata from a provider — shopping list items for these slots lack aisle data.
result: pass

## Summary

total: 6
passed: 3
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Settings quota display shows correct daily limit of 150 pts"
  status: failed
  reason: "User reported: i see that but the max is 50 points per day, not 150"
  severity: major
  test: 2
  artifacts: []
  missing: []

- truth: "Generated meal slots show Spoonacular-grounded recipes with image, recipe name, and aisle-level ingredient data"
  status: failed
  reason: "User reported: when i generate a meal plan, i get a fallback recipe (i dont see any console errors), i do not see a picture, and i see fallback ingredients. fail"
  severity: major
  test: 4
  artifacts: []
  missing: []

- truth: "Settings shows a 3x7 grid of toggles (days × meal types)"
  status: failed
  reason: "User reported: i see the settings and can toggle them, but they are not in a grid"
  severity: minor
  test: 1
  artifacts: []
  missing: []
