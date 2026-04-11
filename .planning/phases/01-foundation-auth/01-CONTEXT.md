# Phase 1: Foundation & Auth - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Initialize the technical foundation (Supabase, React, Vite + TS) and the core user authentication flow (Email/Magic link), plus the global shell layout using Google Stitch with a "cookbook" earthy aesthetic.

</domain>

<decisions>
## Implementation Decisions

### Auth Experience
- **D-01:** Use Magic Link Only for authentication (no traditional passwords).
- **D-02:** Default session duration is 7 days (Long).
- **D-03:** Post-login landing page is the Weekly Planner.

### Stitch Design System
- **D-04:** Primary headline font is **Newsreader (Serif)** for a classic cookbook aesthetic.
- **D-05:** Core earthy color is **Sage Green (#4A6741)**.
- **D-06:** Corner roundness is **Round 8 (Balanced)** for a soft, friendly feel.

### Supabase Schema Strategy
- **D-07:** Relationship: **One User -> One Household (Direct mapping)**.
- **D-08:** Store household members (profiles) in a dedicated **Household Members Table**.

### Shell Responsiveness
- **D-09:** Layout: **Sidebar (Desktop) + Bottom Tab Bar (Mobile)**.
- **D-10:** Content width: **Narrow (800px) centered** for high readability.

### Claude's Discretion
- Specific body typography sizing (Body font should be clean and readable).
- Supabase Edge Functions folder structure.
- Initial project-level React components (App, Layout, Providers).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/PROJECT.md` — Project context and tech stack.
- `.planning/REQUIREMENTS.md` — Core user stories and technical requirements.
- `.planning/ROADMAP.md` — Phase breakdown and goals.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None (Phase 1).

### Established Patterns
- None (Phase 1).

### Integration Points
- This phase establishes all primary integration points (Auth, Layout, DB).

</code_context>

<specifics>
## Specific Ideas

- The "cookbook" vibe should emphasize generous whitespace and clear serif typography for recipes/plans.

</specifics>

<deferred>
## Deferred Ideas

- Social logins (Auth) — May be added in Phase 6.
- Dark mode toggle — Light mode is primary for "cookbook" aesthetic.

</deferred>

---

*Phase: 01-foundation-auth*
*Context gathered: 2026-04-11*
