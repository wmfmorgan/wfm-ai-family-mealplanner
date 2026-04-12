# Phase 3: AI Layer Enhancements - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement a developer-centric AI abstraction layer in Supabase Edge Functions with multi-provider support (Gemini, Grok) and a transient local observability dashboard for debugging AI interactions. This phase is explicitly for development/experimentation and will be pruned before production.

</domain>

<decisions>
## Implementation Decisions

### AI Routing (Edge Functions)
- **D-01: Manual Provider Selection.** The `ai-proxy` will support Gemini and Grok. The active provider is determined by a developer-only setting in the frontend.
- **D-02: Fail Fast Policy.** The Edge Function will not attempt automatic retries or fallbacks. If a provider fails, the raw error is returned to the client for immediate visibility.
- **D-03: Ollama Out of Scope.** Local Ollama integration has been removed from this phase to focus on cloud provider stability.

### Observability & Debugging
- **D-04: Local-Only Logging.** AI interaction logs (last 10 requests/responses) are stored in `localStorage`. This avoids database overhead for a temporary dev feature.
- **D-05: Transient Debug UI.** The Debug Page will display raw JSON payloads, status codes, and latency to assist in prompt tuning for Phase 4.

### Developer Experience (Settings)
- **D-06: Experimental Toggle.** A "Developer Settings" section will be added to the Settings page (temporary) to switch the active AI provider.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/PROJECT.md` — Project context and tech stack.
- `supabase/functions/ai-proxy/index.ts` — Existing proxy implementation to be enhanced.
- `.planning/ROADMAP.md` — Phase 3 goals and boundaries.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/pages/Household/Household.tsx` — Patterns for card-based data display that could be reused for the Debug Log.

### Established Patterns
- **Edge Function Auth**: `ai-proxy` already implements JWT validation via Supabase client.
- **Settings Placeholder**: `src/App.tsx` contains a simple `Settings` component placeholder.

### Integration Points
- **Supabase Edge Functions**: Enhance the existing `ai-proxy` function.
- **Settings Page**: Replace the placeholder with a functional Dev Settings/Debug view.

</code_context>

<specifics>
## Specific Ideas

- The Debug Log should show a "Diff" style view if possible, or at least a very readable JSON viewer for comparing model outputs.

</specifics>

<deferred>
## Deferred Ideas

- **Ollama Integration**: Postponed for local dev evaluation in later phases.
- **Persistent AI Logs**: If we need long-term prompt history, we will implement `ai_logs` in a future Phase.

</deferred>

---

*Phase: 03-ai-layer-enhancements*
*Context gathered: 2026-04-11*
