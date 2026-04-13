# Phase 6: Landing & Login (Desktop) [v2]

## Goal
Refactor the initial user onboarding and login flow to match the v2 Desktop design.

## Context
- **Design System:** Newsreader (Serif) for headings, Manrope (Sans-Serif) for body. Warm paper background (#fdfcf9), Sage Green accent (#4a6741).
- **Core Requirement:** Update styling and layout without breaking the existing Supabase auth flow.

## Requirements
- [ ] Integrate `Landing & Login (Desktop) [v2]` design tokens and structure.
- [ ] Update Typography and Layout based on the Newsreader (Serif) and Manrope (Sans-Serif) rules.
- [ ] Verify functionality (Auth flow) is preserved while styling is updated.
- [ ] Ensure layout is centered and uses the 1200px max-width container where appropriate.

## Constraints
- **NO TailwindCSS.** Use Vanilla CSS only.
- **Google Stitch:** Reference Stitch designs for layout and CSS.
- **Supabase Auth:** Preserve existing `AuthContext` and Supabase integration.
