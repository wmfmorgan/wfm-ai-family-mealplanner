# Phase 3: AI Layer Enhancements - Research

**Researched:** 2026-04-11
**Domain:** Supabase Edge Functions, AI API Integration, Frontend Observability
**Confidence:** HIGH

## Summary

This phase transforms the existing mock `ai-proxy` into a functional, multi-provider abstraction layer supporting Gemini and Grok. Following strict design constraints, the architecture emphasizes immediate error visibility (fail-fast) and explicitly defers local hosting (Ollama) and permanent log storage. 

A transient debug interface will be added to the Settings page. This frontend utility will leverage `localStorage` to retain the last 10 AI interactions, providing developers with raw payload visibility, latency tracking, and status codes to aid in Phase 4 prompt engineering.

**Primary recommendation:** Use raw `fetch` requests with standard OpenAI-compatible payload structures (which both Grok and Gemini now support) within the Edge Function to minimize dependency bloat and cold-start times.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01: Manual Provider Selection.** The `ai-proxy` will support Gemini and Grok. The active provider is determined by a developer-only setting in the frontend.
- **D-02: Fail Fast Policy.** The Edge Function will not attempt automatic retries or fallbacks. If a provider fails, the raw error is returned to the client for immediate visibility.
- **D-03: Ollama Out of Scope.** Local Ollama integration has been removed from this phase to focus on cloud provider stability.
- **D-04: Local-Only Logging.** AI interaction logs (last 10 requests/responses) are stored in `localStorage`. This avoids database overhead for a temporary dev feature.
- **D-05: Transient Debug UI.** The Debug Page will display raw JSON payloads, status codes, and latency to assist in prompt tuning for Phase 4.
- **D-06: Experimental Toggle.** A "Developer Settings" section will be added to the Settings page (temporary) to switch the active AI provider.

### the agent's Discretion
- The Debug Log should show a "Diff" style view if possible, or at least a very readable JSON viewer for comparing model outputs.
- Implementation details of how the frontend intercepts and saves the `localStorage` logs.

### Deferred Ideas (OUT OF SCOPE)
- **Ollama Integration**: Postponed for local dev evaluation in later phases.
- **Persistent AI Logs**: If we need long-term prompt history, we will implement `ai_logs` in a future Phase.
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fetch` API | Native | External API requests to AI providers | Built into Deno, zero dependencies, fastest cold start. |
| `localStorage` | Native | Storing recent AI requests/responses | Meets D-04 constraint for transient, db-free logging. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | ^0.363.0 | Debug UI Icons | Standardizing the look of the Settings/Debug view. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw `fetch` | Provider SDKs (`npm:openai`, `@google/genai`) | SDKs increase edge function bundle size and cold-start latency for simple prompt-in/text-out operations. |

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   └── ai/
│       ├── logger.ts       # localStorage interaction logic
│       └── client.ts       # Wrapper for calling ai-proxy and logging
├── pages/
│   └── Settings/
│       ├── Settings.tsx    # Main settings view with Dev Toggle
│       └── DebugLog.tsx    # Sub-component rendering the 10 recent logs
supabase/
└── functions/
    └── ai-proxy/
        └── index.ts        # Enhanced proxy logic
```

### Pattern 1: Interceptor Logging (Frontend)
**What:** Wrap the Supabase Edge Function invocation to automatically capture request payloads, measure latency, and log the response to `localStorage` before returning data to the caller.
**When to use:** Ensures all AI calls are logged consistently without polluting individual component logic.

### Pattern 2: OpenAI Compatibility Layer (Backend)
**What:** Grok (`api.x.ai/v1/chat/completions`) uses the OpenAI API specification. Gemini also provides an OpenAI-compatible endpoint (`generativelanguage.googleapis.com/v1beta/openai/chat/completions`). 
**When to use:** Using this format allows the proxy to use a nearly identical `fetch` construction for both providers, simplifying the codebase and payload parsing.

### Anti-Patterns to Avoid
- **Leaking API Keys:** Never send API keys from the frontend. Always store them as Supabase Secrets (`GEMINI_API_KEY`, `XAI_API_KEY`) and read via `Deno.env.get()`.
- **CORS Omission on Errors:** Failing to include `corsHeaders` in `catch` blocks within the Edge Function. This causes opaque network errors in the frontend instead of the "Fail Fast" specific errors required by D-02.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Log Storage | Database tables or Supabase rows | `localStorage` | Explicitly constrained by D-04 to avoid db overhead for temporary dev features. |
| API Retries | Custom backoff loops | Nothing (Pass error to client) | Explicitly constrained by D-02 to "Fail Fast". |
| Complex JSON Viewer | Heavy third-party tree viewer libs | Native `<pre>` tags + basic CSS | Keeps the build lightweight; cookbook aesthetic doesn't need complex hacker tools. |

## Common Pitfalls

### Pitfall 1: Edge Function Timeout
**What goes wrong:** Complex prompts to LLMs can take 15-30+ seconds, potentially hitting standard Edge Function timeout limits.
**Why it happens:** Serverless environments have strict execution caps.
**How to avoid:** For this phase, standard fetch is fine, but we must monitor latency in the new Debug UI. If timeouts occur, future phases will require streaming (`text/event-stream`).

### Pitfall 2: Environment Variable Availability
**What goes wrong:** Edge Function fails locally or in production because keys aren't loaded.
**Why it happens:** Supabase requires explicit loading of `.env.local` during `supabase functions serve` and explicit setting via `supabase secrets set` for production.
**How to avoid:** Ensure the development instructions clearly specify running `npx supabase functions serve --env-file ./supabase/.env.local`.

## Code Examples

### Edge Function Standard `fetch` Request
```typescript
// Source: Standard Deno Fetch Pattern
const response = await fetch('https://api.x.ai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'grok-beta', // or active model
    messages: [{ role: 'user', content: prompt }]
  }),
});

const data = await response.json();
if (!response.ok) {
  // Fail fast handling
  throw new Error(data.error?.message || 'Provider error');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom API schemas per LLM | OpenAI API standard adoption | Mid-2024 | Most providers (including xAI and Gemini) now support the OpenAI REST schema, drastically simplifying multi-model proxy routing. |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node / npm | Frontend build | ✓ | 24.14.0 | — |
| Supabase CLI | Local Edge Functions | ✗ | — | Use `npx supabase` instead of global install |
| Deno | Edge Function Runtime | ✗ | — | Handled internally by `npx supabase functions serve` |
| Gemini API | AI Generation | N/A | — | Requires `GEMINI_API_KEY` in `.env.local` |
| Grok API | AI Generation | N/A | — | Requires `XAI_API_KEY` in `.env.local` |

**Missing dependencies with fallback:**
- Supabase CLI: Not globally installed. Developers must use `npx supabase` for local commands.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + React Testing Library |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| Settings component rendering | unit | `npm run test -- run src/__tests__/settings.test.tsx` | ❌ Wave 0 |
| AI Logger utility logic | unit | `npm run test -- run src/__tests__/ai-logger.test.ts` | ❌ Wave 0 |

### Wave 0 Gaps
- [ ] `src/__tests__/settings.test.tsx` — Need to verify Settings page and Debug UI renders correctly.
- [ ] `src/__tests__/ai-logger.test.ts` — Need to verify localStorage max-10 constraint logic.

## Sources

### Primary (HIGH confidence)
- `supabase/functions/ai-proxy/index.ts` - Checked existing proxy configuration.
- `.planning/phases/03-ai-layer-enhancements/03-CONTEXT.md` - Verified phase boundaries and "Fail Fast" architecture constraints.

### Secondary (MEDIUM confidence)
- Deno documentation on `fetch` and external network requests in Supabase Edge Functions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - `fetch` and `localStorage` are native, simple, and strictly align with the project constraints.
- Architecture: HIGH - Interceptor pattern perfectly satisfies the D-04 constraint.
- Pitfalls: HIGH - Edge function timeouts and CORS mapping are well-documented Supabase gotchas.

**Research date:** 2026-04-11
**Valid until:** 2026-05-11
