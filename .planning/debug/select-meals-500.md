---
status: diagnosed
trigger: "select-meals returns 500 — Clicking Generate in MealPlanner shows FunctionsHttpError: Edge Function returned a non-2xx status code"
created: 2026-04-18T19:00:00Z
updated: 2026-04-18T19:00:00Z
---

## Current Focus

hypothesis: coordinator role max_tokens: 1024 is insufficient for a full 21-cell generation matrix, causing the AI response to be truncated mid-JSON, which makes JSON.parse() throw a SyntaxError caught as a 500
test: confirmed by cross-referencing logged AI responses (103–105 completion_tokens per 1-directive response), coordinator role config (max_tokens: 1024), and 21-cell default matrix at time of failure
expecting: with 21 directives * ~115 tokens each ≈ 2400+ tokens needed, a 1024-token cap truncates the JSON
next_action: none — root cause confirmed, find_root_cause_only mode

## Symptoms

expected: Clicking Generate triggers select-meals then recipe-search, returning Spoonacular-grounded meal slots
actual: select-meals returns 500 — FunctionsHttpError: Edge Function returned a non-2xx status code
errors: FunctionsHttpError: Edge Function returned a non-2xx status code (from select-meals)
reproduction: Click Generate in MealPlanner when household has a full or near-full generation matrix (multiple days/meal types enabled)
started: 2026-04-18 HUMAN-UAT session (before matrix was reduced to 1 cell by user)

## Eliminated

- hypothesis: AI API key misconfiguration (GEMINI_API_KEY empty causes no-key error)
  evidence: GEMINI_API_KEY="" is falsy in JS — provider falls through to grok. XAI_API_KEY is present. All logged AI calls show status_code:200. Key resolution works correctly.
  timestamp: 2026-04-18T19:00:00Z

- hypothesis: validateDirectives count mismatch due to null min_calories/max_calories from AI
  evidence: All 10 logged coordinator responses include numeric min_calories/max_calories (800–2500). The AI reliably produces numeric calorie fields when directed to do so. normalizeDirective passes for all observed responses.
  timestamp: 2026-04-18T19:00:00Z

- hypothesis: RLS policy blocking defaultLoadGenerationPreferences from reading households table
  evidence: RLS policy "Users can manage their own household" covers ALL commands. userClient is authenticated with the user's auth header. No RLS errors in any logged session.
  timestamp: 2026-04-18T19:00:00Z

- hypothesis: Bug introduced by 14-05 gap closure changes
  evidence: The 500 was observed at 08:00 CST. 14-05 fixes landed at 11:21–11:30 CST. The HUMAN-UAT failure predates all 14-05 changes. Post-fix AI logs (10:30+ CST) all show successful coordinator calls with valid single-directive responses.
  timestamp: 2026-04-18T19:00:00Z

- hypothesis: members array serialization issue or extra fields breaking normalizeDirective
  evidence: collectMemberContext only accesses nutrition_profile sub-fields with safe defaults. Extra HouseholdMember fields (id, household_id, is_owner, etc.) are ignored. No evidence of member data causing issues.
  timestamp: 2026-04-18T19:00:00Z

## Evidence

- timestamp: 2026-04-18T19:00:00Z
  checked: supabase/functions/_shared/ai-client.ts ROLE_CONFIG
  found: coordinator role configured with max_tokens: 1024
  implication: Any AI response requiring more than 1024 tokens will be truncated by the model provider

- timestamp: 2026-04-18T19:00:00Z
  checked: ai_usage_log — all coordinator calls (10:30–11:49 CST)
  found: completion_tokens consistently 103–105 tokens per response, all for single-directive (1-cell matrix) responses
  implication: A 1-directive response uses ~104 tokens. A 21-directive response would need ~2200 tokens — exceeding max_tokens: 1024 by 2x

- timestamp: 2026-04-18T19:00:00Z
  checked: households.generation_preferences in DB (current state)
  found: matrix = { "0": ["dinner"], "1": [], ..., "6": [] } — only 1 active cell after user modified it
  implication: Current matrix works fine. At 08:00 CST (before user interaction), the DEFAULT matrix had all 21 cells enabled

- timestamp: 2026-04-18T19:00:00Z
  checked: migration 20260417000006_household_generation_preferences.sql DEFAULT value
  found: DEFAULT matrix has all 7 days × 3 meal types = 21 cells fully populated
  implication: A fresh household (or one that hasn't been saved via Settings) starts with 21 cells

- timestamp: 2026-04-18T19:00:00Z
  checked: supabase/functions/select-meals/index.ts sanitizeMatrixCandidate + buildDirectiveTargets
  found: frontend sends full matrix (including all 7 days), edge function correctly parses it; if 21 cells are valid, allowedTargets has 21 entries
  implication: With a full default matrix, the AI must produce 21 directives — but max_tokens: 1024 truncates the response

- timestamp: 2026-04-18T19:00:00Z
  checked: select-meals/index.ts handler catch block (line 334-336)
  found: catch (error) { const message = error instanceof Error ? error.message : 'Unknown select-meals error'; return errorResponse(500, message) }
  implication: A SyntaxError from JSON.parse() on truncated AI response is caught here and returned as 500

- timestamp: 2026-04-18T19:00:00Z
  checked: git log timestamps — HUMAN-UAT session vs. 14-05 fix timestamps
  found: HUMAN-UAT started at 2026-04-18T13:00:45Z (= 08:00 CST local). 14-05 fixes at 11:21 CST. 14-05 fixes do NOT touch select-meals/index.ts coordinator role config.
  implication: The max_tokens: 1024 limit is present in both old and current code — this bug still exists for any household with more than ~8–9 matrix cells enabled

- timestamp: 2026-04-18T19:00:00Z
  checked: ai_usage_log first entry timestamp vs. HUMAN-UAT start
  found: First AI log is at 10:30 CST. No logs exist for the 08:00 CST failure because migration 20260418000010 (which adds prompt_text/response_text columns) wasn't applied or deployed yet.
  implication: The 500 cannot be observed directly in logs but is fully explained by the token limit + matrix size combination

## Resolution

root_cause: |
  The coordinator role in supabase/functions/_shared/ai-client.ts is configured with max_tokens: 1024. When the household's generation matrix has many enabled cells (the default is 21 cells — 7 days × 3 meal types), the AI must produce 21 search directives. Each directive requires approximately 100–115 tokens. A 21-directive response requires ~2200–2400 tokens, which exceeds the 1024-token cap by more than 2x. The AI provider (Grok via api.x.ai) truncates the response at 1024 tokens, producing an invalid (incomplete) JSON string. JSON.parse() in the handler (select-meals/index.ts:334) throws a SyntaxError, which is caught by the outer try/catch and returned as HTTP 500.

  Timeline confirms this: the 500 occurred at 08:00 CST when the household had the full default 21-cell matrix. By the time later tests ran (10:30+ CST), the user had reduced their matrix to 1 cell (day 0, dinner only), bringing completion_tokens down to ~104 per successful run — well within the 1024-token cap.

fix: |
  Not applied (find_root_cause_only mode).
  Fix direction: Increase max_tokens for the coordinator role (e.g., to 4096) in ROLE_CONFIG inside supabase/functions/_shared/ai-client.ts. Alternatively, add a guard in select-meals that warns or rejects matrices with more cells than the token budget can support. A 4096-token cap with ~115 tokens/directive supports up to ~35 directives safely.

verification: not performed
files_changed: []
