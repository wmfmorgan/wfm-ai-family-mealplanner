---
status: diagnosed
phase: 14-spoonacular-integration-ai-coordinator
source:
  - 14-VERIFICATION.md
started: 2026-04-18T13:00:45Z
updated: 2026-04-18T13:00:45Z
---

## Current Test

[testing complete]

## Tests

### 1. Live Grounded Generation
expected: Planner receives grounded Spoonacular slots with nutrition, ingredients, aisle metadata, and persisted source fields
result: issue
reported: "Clicking generate returns a 500 from /functions/v1/select-meals and MealPlanner shows FunctionsHttpError: Edge Function returned a non-2xx status code."
severity: major

### 2. Live Quota Threshold / Fallback
expected: Settings shows updated quota usage and recipe-search switches affected slots to explicit ai-generated fallback output
result: pass

## Summary

total: 2
passed: 1
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps
- truth: "Planner receives grounded Spoonacular slots with nutrition, ingredients, aisle metadata, and persisted source fields"
  status: diagnosed
  reason: "User reported: Clicking generate returns a 500 from /functions/v1/select-meals and MealPlanner shows FunctionsHttpError: Edge Function returned a non-2xx status code."
  severity: major
  test: 1
  root_cause: "coordinator role max_tokens is 1024 in ai-client.ts. Full 21-cell matrix (7 days × 3 meal types) needs ~2200-2400 tokens for all directives. AI truncates response, JSON.parse() throws SyntaxError, catch block returns 500."
  artifacts:
    - path: "supabase/functions/_shared/ai-client.ts"
      issue: "ROLE_CONFIG coordinator max_tokens: 1024 too low for multi-cell matrices"
    - path: "supabase/functions/select-meals/index.ts"
      issue: "JSON.parse on line 334 throws on truncated response; catch maps all errors to 500 with no context"
  missing:
    - "Increase coordinator max_tokens to at least 4096 in ROLE_CONFIG"
    - "Add pre-parse guard to detect truncated JSON and return descriptive error"
  debug_session: .planning/debug/select-meals-500.md
