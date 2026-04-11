# Phase 1: Foundation & Auth - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 1-Foundation & Auth
**Areas discussed:** Auth Experience, Stitch Design System, Supabase Schema Strategy, Shell Responsiveness

---

## Auth Experience

| Option | Description | Selected |
|--------|-------------|----------|
| Magic Link Only | Simpler UX, no passwords to store. Standard Supabase flow. | ✓ |
| Magic Link + Password | Allow traditional password entry as an alternative. | |

**User's choice:** Magic Link Only
**Notes:** Preferred for simplicity and better security.

---

## Session Duration

| Option | Description | Selected |
|--------|-------------|----------|
| Short (1 hour) | Standard 1 hour (auto-renews in browser). | |
| Long (7 days) | Longer session, keep users logged in across visits. | ✓ |

**User's choice:** Long (7 days)

---

## First Run Landing Page

| Option | Description | Selected |
|--------|-------------|----------|
| Weekly Planner | Go straight to the weekly planner (Core feature). | ✓ |
| Profile Setup | Go to Household/Profile setup (Helpful for first run). | |

**User's choice:** Weekly Planner

---

## Headline Font

| Option | Description | Selected |
|--------|-------------|----------|
| Newsreader (Serif) | Classic, elegant, and very "cookbook". | ✓ |
| Inter (Sans-serif) | More modern, readable at small sizes. | |
| Mixed (Serif/Sans) | A mix — Newsreader for titles, Inter for body. | |

**User's choice:** Newsreader (Serif)

---

## Color Palette

| Option | Description | Selected |
|--------|-------------|----------|
| Sage Green (Earthy) | Muted, natural green (#4A6741). | ✓ |
| Terracotta (Clay) | Warm, textured brown (#8B5A2B). | |
| Sand & Stone (Neutral)| Clean, neutral cream and beige. | |

**User's choice:** Sage Green (Earthy)

---

## UI Roundness

| Option | Description | Selected |
|--------|-------------|----------|
| Round 4 (Square-ish) | Subtle, clean. | |
| Round 8 (Balanced) | Softer, friendly. | ✓ |
| Round 12 (Soft) | Very pill-like, modern. | |

**User's choice:** Round 8 (Balanced)

---

## Household Relationship

| Option | Description | Selected |
|--------|-------------|----------|
| One User -> One Household (Direct) | Map user ID directly to a household record. | ✓ |
| One User -> Many Households (Flexible) | Allow a user to join multiple households. | |

**User's choice:** One User -> One Household (Direct)
**Notes:** Aligned with initial project requirements.

---

## Household Members Table

| Option | Description | Selected |
|--------|-------------|----------|
| Household Members Table | Each member gets their own row, separate from user metadata. | ✓ |
| Combined Profile Table | One table for all profile-related data. | |

**User's choice:** Household Members Table

---

## Shell Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar + Bottom Tabs (Adaptive) | Desktop sidebar, Mobile bottom tab bar. | ✓ |
| Top Nav Only (Global) | Always use a top navigation bar. | |

**User's choice:** Sidebar + Bottom Tabs (Adaptive)

---

## Max Content Width

| Option | Description | Selected |
|--------|-------------|----------|
| Narrow (Centered) | 800px (like a recipe card). | ✓ |
| Wide (Responsive) | 1200px (like a magazine). | |

**User's choice:** Narrow (Centered)
**Notes:** Better for high readability and "cookbook" feel.

---

## Claude's Discretion

- Selection of secondary colors (Neutrals, Greys)
- Specific React folder structure
- Supabase project configuration details

## Deferred Ideas

- Social logins
- Multi-household sharing
