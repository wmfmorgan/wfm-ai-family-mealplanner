---
phase: 13-foundation-database-migrations
plan: 01
subsystem: edge-functions-shared
tags: [deno, supabase, edge-functions, ai-client, auth, cors, token-logging]
dependency_graph:
  requires: []
  provides: [_shared/cors.ts, _shared/auth.ts, _shared/ai-client.ts, _shared/ai-client.test.ts]
  affects: [phase-14-select-meals, phase-14-recipe-search, phase-17-adapt-recipe]
tech_stack:
  added: []
  patterns: [role-based-ai-config, service-client-token-logging, deno-esm-imports]
key_files:
  created:
    - supabase/functions/_shared/cors.ts
    - supabase/functions/_shared/auth.ts
    - supabase/functions/_shared/ai-client.ts
    - supabase/functions/_shared/ai-client.test.ts
  modified:
    - vitest.config.ts
decisions:
  - "ROLE_CONFIG is hardcoded in ai-client.ts — callers cannot override temperature or max_tokens"
  - "Provider priority: Gemini first (GEMINI_API_KEY), Grok fallback (XAI_API_KEY)"
  - "ai_usage_log insert is non-fatal — wrapped in try/catch, logs to console.error on failure"
  - "ROLE_CONFIG_FOR_TEST export added to ai-client.ts to enable pure unit tests without network calls"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-17T19:11:03Z"
  tasks_completed: 3
  files_created: 4
  files_modified: 1
---

# Phase 13 Plan 01: Shared Edge Function Modules Summary

**One-liner:** Role-enforced Deno shared modules for CORS headers, JWT auth verification, and AI provider routing with non-fatal token usage logging.

## What Was Built

Three shared Deno modules that all Phase 14+ Edge Functions will import, eliminating the CORS/auth/provider boilerplate currently duplicated across all four existing functions.

### Files Created

**`supabase/functions/_shared/cors.ts`**
Exports `corsHeaders` verbatim from ai-proxy/index.ts. Single source of truth for CORS headers across all Edge Functions.

**`supabase/functions/_shared/auth.ts`**
Exports: `corsHeaders` (re-export), `createUserClient()`, `createServiceClient()`, `AuthResult` interface, and `verifyAuth()`. Extracts JWT verification pattern from ai-proxy and generate-plan into a typed, reusable helper.

**`supabase/functions/_shared/ai-client.ts`**
Exports: `AIRole`, `AICallOptions`, `AICallResult` types, `callAI()` function, `ROLE_CONFIG_FOR_TEST`.
- Hardcoded ROLE_CONFIG enforces temperature/max_tokens per role — callers cannot override
- Provider auto-resolution from env vars (Gemini preferred, Grok fallback)
- Non-fatal ai_usage_log insert via service client
- Markdown fence stripping on response content

**`supabase/functions/_shared/ai-client.test.ts`**
5 Deno.test() calls covering all 3 role configs (coordinator, adapter, fallback-generator). Tests validate INFRA-01 values and INFRA-03 type coverage using ROLE_CONFIG_FOR_TEST — no real network calls.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | b0f9d98 | feat(13-01): create _shared/cors.ts and _shared/auth.ts |
| 2 | 84627ba | feat(13-01): create _shared/ai-client.ts with role-based AI calls |
| 3 | d79f358 | feat(13-01): create _shared/ai-client.test.ts with Deno unit tests |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Exclude supabase/** from Vitest runner**
- **Found during:** Task 3 verification (npm test)
- **Issue:** Vitest picked up `supabase/functions/_shared/ai-client.test.ts` and tried to run it as a Node.js module. Deno test files use `https://` ESM imports which Node's ESM loader rejects with `ERR_UNSUPPORTED_ESM_URL_SCHEME`.
- **Fix:** Added `exclude: ['**/node_modules/**', '**/dist/**', 'supabase/**']` to `vitest.config.ts` test config.
- **Files modified:** `vitest.config.ts`
- **Commit:** d79f358

## Known Stubs

None. All four files are complete and functional. The `ai-client.ts` module is production-ready; callers in Phase 14 will import `callAI` directly.

## Notes

- Deno is not available in PATH on this machine (Supabase CLI does not bundle a standalone `deno` binary). The test file is the deliverable per plan spec — tests will run in CI or when Deno is installed.
- No existing Edge Function files were modified. All four existing functions (ai-proxy, generate-plan, categorize-ingredients, refresh-slot) continue using their inline CORS/auth blocks until Phase 17 cleanup.
- All 64 frontend Vitest tests pass after the vitest.config.ts fix.

## Self-Check: PASSED

All created files verified present. All 3 task commits verified in git log.
