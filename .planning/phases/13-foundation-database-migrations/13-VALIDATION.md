---
phase: 13
slug: foundation-database-migrations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Deno test (built-in) + SQL migration dry-run |
| **Config file** | none — Deno test built-in |
| **Quick run command** | `deno test supabase/functions/_shared/` |
| **Full suite command** | `deno test supabase/functions/` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `deno test supabase/functions/_shared/`
- **After every plan wave:** Run `deno test supabase/functions/`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | INFRA-01/03 | unit | `deno test supabase/functions/_shared/` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | INFRA-02 | unit | `deno test supabase/functions/_shared/` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 1 | INFRA-04 | manual | SQL dry-run via `supabase db diff` | ✅ | ⬜ pending |
| 13-02-02 | 02 | 1 | INFRA-05 | manual | SQL dry-run via `supabase db diff` | ✅ | ⬜ pending |
| 13-02-03 | 02 | 1 | INFRA-06 | manual | SQL dry-run via `supabase db diff` | ✅ | ⬜ pending |
| 13-03-01 | 03 | 2 | INFRA-01/02 | integration | manual RPC test via Supabase Studio | ❌ manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/functions/_shared/ai-client.test.ts` — stubs for INFRA-01, INFRA-02, INFRA-03
- [ ] Deno is available in PATH (no install needed — Supabase CLI bundles it)

*Existing migration infrastructure covers SQL validation. Deno test runner requires stub files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GIN index on `recipe_cache.raw_data` returns results under 50ms | INFRA-04 | Requires live Supabase instance with data | Insert 100 rows, run `EXPLAIN ANALYZE SELECT * FROM recipe_cache WHERE raw_data @> '{"id":1}'` |
| `save_meal_plan_bulk` atomicity on failure mid-transaction | INFRA-05 | Requires live DB + deliberate error injection | Call RPC with invalid recipe slot; verify no rows committed |
| Token usage row visible after AI call | INFRA-02 | Requires live Edge Function invocation | Deploy `_shared/` + invoke from test function; check `ai_usage_log` table |
| `source_provider` NOT NULL backfill on existing rows | INFRA-05 | Migration behavior | Run migration; verify `SELECT COUNT(*) FROM recipes WHERE source_provider IS NULL` = 0 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
