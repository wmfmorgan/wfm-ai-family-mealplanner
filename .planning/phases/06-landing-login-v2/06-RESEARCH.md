# Phase 6: Landing & Login (Desktop) [v2] - Research

**Researched:** 2026-04-13
**Domain:** Auth UI & Desktop Landing Design
**Confidence:** HIGH

## Summary
Phase 6 involves a visual refactor of the Landing and Login pages to align with the "v2 Desktop" aesthetic defined in Stitch. The goal is to move from the initial mobile-first foundation to a sophisticated desktop-first "cookbook" layout using Serif headings (Newsreader) and Sans-Serif body text (Manrope). The functional Supabase auth flow must remain untouched.

**Primary recommendation:** Use a centered 1024px container for the landing/login card, leveraging the "Canvas Cream" (#FDFCFB) background and "Sage Green" (#4A6741) accents.

## User Constraints (from CONTEXT.md)
### Locked Decisions
- **D-03:** Post-login landing page is the Weekly Planner (/planner).
- **Design System:** Newsreader (Serif) for headings, Manrope (Sans-Serif) for body.
- **Color Palette:** Warm paper background (#fdfcf9), Sage Green accent (#4a6741).
- **Auth:** Magic Link Only (UX simplicity), with Password as a fallback already implemented in v1.

### the agent's Discretion
- Centered layout for desktop (1024px max-width).
- Specific whitespace and padding to achieve "cookbook" feel.

## Standard Stack
### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.103.0 | Auth & Database | Project backend standard |
| react | 18.3.1 | UI Framework | Project frontend standard |
| react-router-dom | 6.30.3 | Routing | Client-side navigation |

## Architecture Patterns
### Recommended Project Structure
- `src/pages/Auth/Login.tsx`: Main entry point for authentication.
- `src/pages/Auth/Auth.css`: Vanilla CSS specific to the auth flow.

### Anti-Patterns to Avoid
- **TailwindCSS:** Strictly forbidden per GEMINI.md.
- **Pure Black (#000000):** Use Ink Black (#1A1C19) instead.
- **Inter Font:** Use Manrope for body text.

## Architecture Patterns
### Pattern 1: Centered Desktop Card
**What:** Constrain the login form to a centered card on desktop with generous whitespace.
**When to use:** All landing/login screens.
**Example:**
```css
.auth-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-canvas-cream);
}
.auth-card {
  max-width: 1024px;
  width: 90%;
  /* Cookbook tactile feel */
}
```

## Don't Hand-Roll
| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Authentication | Custom JWT handling | Supabase Auth | Security, magic link support |
| Icons | Custom SVGs | Lucide React | Consistency and speed |

## Common Pitfalls
### Pitfall 1: Breaking Magic Link Redirect
**What goes wrong:** Changing the redirect URL or losing state during the login flow.
**How to avoid:** Preserve `signInWithMagicLink` options and ensure `window.location.origin` is used for redirects.

## Phase Requirements Map
| ID | Behavior | Research Support |
|----|----------|------------------|
| AUTH-V2-01 | Integrate Desktop v2 Design | Screen ID `c9f136a1fa5e460aa641c79e890535d7` |
| AUTH-V2-02 | Preserved Auth Flow | Current `Login.tsx` logic using `useAuth` |
| AUTH-V2-03 | Centered 1024px Layout | GEMINI.md and Stitch Design System principles |

## Environment Availability
| Dependency | Required By | Available | Version |
|------------|------------|-----------|---------|
| Node.js | Build/Dev | ✓ | 20.x+ |
| Supabase | Auth/DB | ✓ | Cloud |

## Sources
- `.stitch/DESIGN.md`: Design tokens and typography rules.
- `.stitch/STITCH_SCREENS.MD`: Reference screen IDs for v2 designs.
- `src/pages/Auth/Login.tsx`: Current implementation audit.
- `src/styles/theme.css`: Current variable definitions.
