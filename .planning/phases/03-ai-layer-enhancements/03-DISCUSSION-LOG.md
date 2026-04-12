# Phase 3: AI Layer Enhancements - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 03-ai-layer-enhancements
**Areas discussed:** Provider Selection, Ollama Integration, Storage, Error Handling

---

## Provider Selection Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Manual Select | Full user control; easy to test specific models. | |
| Smart Default | Zero-config; uses Gemini by default. | |
| Hybrid | Default to Gemini with global override. | |
| **Developer Only** | Manual switch in settings for dev, removed in prod. | ✓ |

**User's choice:** Developer-only manual selection in the Settings page. This is temporary and will be removed before production.

---

## Ollama Local Integration

**User's choice:** Explicitly removed from the scope of Phase 3.

---

## AI Settings & Debug Page — Storage

| Option | Description | Selected |
|--------|-------------|----------|
| **LocalStorage** | Instant; private; zero server cost. | ✓ |
| Supabase Table | Persistent; works across devices. | |

**User's choice:** LocalStorage. The feature is temporary and will be removed in production.

---

## Error Handling & Fallbacks

| Option | Description | Selected |
|--------|-------------|----------|
| **Fail Fast** | Return the raw error to the UI. | ✓ |
| Automatic Fallback | Silently retry with the next available provider. | |

**User's choice:** Fail Fast. Seeing the exact failure is more useful for developers.
