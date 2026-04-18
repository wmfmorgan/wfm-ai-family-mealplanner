---
status: partial
phase: 14-spoonacular-integration-ai-coordinator
source:
  - 14-VERIFICATION.md
started: 2026-04-18T13:00:45Z
updated: 2026-04-18T13:00:45Z
---

## Current Test

number: 2
name: Live Quota Threshold / Fallback
expected: |
  Settings shows updated quota usage and recipe-search switches affected slots to explicit ai-generated fallback output
awaiting: user response

## Tests

### 1. Live Grounded Generation
expected: Planner receives grounded Spoonacular slots with nutrition, ingredients, aisle metadata, and persisted source fields
result: issue
reported: "Clicking generate returns a 500 from /functions/v1/select-meals and MealPlanner shows FunctionsHttpError: Edge Function returned a non-2xx status code."
severity: major

### 2. Live Quota Threshold / Fallback
expected: Settings shows updated quota usage and recipe-search switches affected slots to explicit ai-generated fallback output
result: pending

## Summary

total: 2
passed: 0
issues: 1
pending: 1
skipped: 0
blocked: 0

## Gaps
- truth: "Planner receives grounded Spoonacular slots with nutrition, ingredients, aisle metadata, and persisted source fields"
  status: failed
  reason: "User reported: Clicking generate returns a 500 from /functions/v1/select-meals and MealPlanner shows FunctionsHttpError: Edge Function returned a non-2xx status code."
  severity: major
  test: 1
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
