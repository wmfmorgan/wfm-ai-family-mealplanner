# Phase 13: Foundation & Database Migrations - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 13-foundation-database-migrations
**Areas discussed:** Shared AI client design, Recipe cache table design, DB migration strategy, Bulk save RPC design

---

## Shared AI client design

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded role map | TypeScript object mapping role names to { temperature, max_tokens, model }. Simple, explicit, auditable. | ✓ |
| DB-driven config | Store role configs in a Supabase table. More flexible but adds DB dependency to every LLM call. | |
| Environment variables | AI_COORDINATOR_TEMP=0.3 etc. Configurable per env but verbose and error-prone. | |

**User's choice:** Hardcoded role map
**Notes:** Simple wins here — 3-4 roles don't justify a DB table.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated ai_usage_log table | New table with structured columns, queryable/dashboardable. | ✓ |
| Append to existing logs | Add token fields to Supabase built-in Edge Function logs. | |
| Console.log only | Log to stdout for now, formalize later. | |

**User's choice:** Dedicated ai_usage_log table
**Notes:** Satisfies INFRA-02 requirement for token usage visible in database.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Gemini + Grok only | Match current ai-proxy. Ollama deferred. | ✓ |
| All three from start | Include Ollama provider resolution now. | |

**User's choice:** Gemini + Grok only

---

| Option | Description | Selected |
|--------|-------------|----------|
| AI calls + auth + CORS | Extract all three into _shared/ — every Edge Function duplicates these. | ✓ |
| AI calls only | Keep auth/CORS in each function. | |

**User's choice:** AI calls + auth + CORS
**Notes:** All 4 existing Edge Functions have identical auth check and CORS headers — extracting all three makes new functions ~10 lines of business logic.

---

## Recipe cache table design

| Option | Description | Selected |
|--------|-------------|----------|
| JSONB + extracted columns | Full response as raw_data JSONB + extracted key fields as columns. GIN + B-tree indexes. | ✓ |
| Pure JSONB | Single JSONB column with GIN index. | |
| Fully normalized | Separate columns for every Spoonacular field. | |

**User's choice:** JSONB + extracted columns
**Notes:** Best of both worlds — raw JSONB for flexibility, extracted columns for fast querying.

---

| Option | Description | Selected |
|--------|-------------|----------|
| created_at + app-side check | Check if row older than 30 days before using. No background job needed. | ✓ |
| expires_at + pg_cron | Explicit expiry with scheduled cleanup. Requires Supabase Pro. | |
| No expiry for now | Cache lives forever during prototype. | |

**User's choice:** created_at + app-side check
**Notes:** pg_cron already deferred in REQUIREMENTS.md (CACHE-03) due to Supabase Pro requirement.

---

## DB migration strategy

| Option | Description | Selected |
|--------|-------------|----------|
| One migration per concern | 5 separate SQL files. Clean git history, independently reviewable. | ✓ |
| Single migration file | One big SQL file. Simpler but impossible to partially rollback. | |
| Two files: tables + functions | Tables in one file, RPC in another. | |

**User's choice:** One migration per concern

---

| Option | Description | Selected |
|--------|-------------|----------|
| TEXT with CHECK constraint | source_provider TEXT CHECK (... IN ('spoonacular', 'ai-generated')). Easy to extend. | ✓ |
| PostgreSQL ENUM | Type-safe but painful to extend. | |
| Plain TEXT, no constraint | Maximum flexibility, no data integrity. | |

**User's choice:** TEXT with CHECK constraint

---

**Backfill question — user clarification:**
User does not need to preserve existing recipes. Existing rows can be backfilled to `'ai-generated'` or truncated. Column goes NOT NULL from the start.

---

## Bulk save RPC design

| Option | Description | Selected |
|--------|-------------|----------|
| Single JSONB payload | One parameter with full week data. One RPC call, one transaction. | ✓ |
| Multiple typed arrays | Separate parameters per entity type. More structured, more complex. | |

**User's choice:** Single JSONB payload

---

| Option | Description | Selected |
|--------|-------------|----------|
| meal_plan_id only | Return just the UUID. Frontend has full data in draft state. | ✓ |
| Full saved plan | Return plan + all IDs. High payload for a save operation. | |
| Nothing (void) | No return. Frontend re-fetches. Adds a round trip. | |

**User's choice:** meal_plan_id only

---

| Option | Description | Selected |
|--------|-------------|----------|
| Error out | Raise exception. Bulk-save only called for new drafts — conflict = bug. | ✓ |
| Upsert / replace | Delete existing plan for week, insert fresh. Masks bugs. | |
| Return existing ID | Silent deduplication. | |

**User's choice:** Error out
**Notes:** Lazy-save design means this RPC should never be called if a plan already exists. Surfacing conflicts as errors enforces that contract.

---

## Claude's Discretion

- Exact column types for `shopping_list_items` aisle/amount/unit
- Error response shape from shared AI client
- Whether `ai_usage_log` requires RLS or service-role only

## Deferred Ideas

- Ollama provider support (trivial to add later, OpenAI-compatible)
- pg_cron cache cleanup (Supabase Pro, already in REQUIREMENTS deferred)
