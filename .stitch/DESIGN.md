# Design System: WFM AI Family Meal Planner

## 1. Visual Theme & Atmosphere
A minimalist earthy aesthetic inspired by modern high-end cookbooks. The interface prioritizes high readability, generous whitespace, and a "warm paper" feel. It avoids the clinical coldness of typical SaaS apps in favor of a grounded, kitchen-friendly atmosphere.

- **Density:** Daily App Balanced (5/10)
- **Variance:** Predictable Symmetric (3/10) — organized and reliable like a printed recipe.
- **Motion:** Fluid CSS (4/10) — subtle transitions, no jarring animations.

## 2. Color Palette & Roles
- **Canvas Cream** (#FDFCFB) — Primary background surface, providing a warm, non-glare paper feel.
- **Sage Green** (#4A6741) — Primary accent for branding, primary CTAs, and active states.
- **Ink Black** (#1A1C19) — Primary text and high-contrast elements.
- **Muted Earth** (#747973) — Secondary text, metadata, and placeholder states.
- **Soft Border** (#E1E3DF) — Structural lines, dividers, and input borders.
- **White** (#FFFFFF) — Card and container fills for subtle elevation.

## 3. Typography Rules
- **Display & Headlines:** Newsreader (Serif) — Track-tight, weight-driven hierarchy. Used for a classic editorial cookbook aesthetic.
- **Body:** Manrope (Sans-Serif) — Relaxed leading (1.6), 65ch max-width for optimal recipe reading.
- **Mono:** JetBrains Mono — Reserved for technical metadata or specific measurements if high precision is visually required.

## 4. Component Stylings
- **Buttons:** Flat with 8px (Balanced) corner radius. Sage Green background for primary, Soft Border outline for secondary. Subtle 1px push effect on active.
- **Cards:** 8px corner radius. Very subtle Soft Border (#E1E3DF) instead of heavy shadows. 
- **Inputs:** Clean labels positioned above the input. 8px radius. Focus state uses a 2px Sage Green border.
- **Loaders:** Soft pulse effect on Sage Green elements. No generic circular spinners.

## 5. Layout Principles
- **Centered Content:** All main content is constrained to a 800px max-width container to ensure high readability, especially for long-form meal plans and recipes.
- **Whitespace:** Generous margins and padding to prevent visual clutter in a kitchen environment.
- **Responsive:** Mobile-first single column layout, expanding to centered 800px on desktop.

## 6. Motion & Interaction
- **Transitions:** Standard `ease-in-out` for opacity and transforms.
- **Feedback:** Visual feedback on all touch/click targets via subtle scale or color shifts.

## 7. Anti-Patterns (Banned)
- No emojis.
- No Inter (using Manrope instead).
- No pure black (#000000).
- No neon or outer glow shadows.
- No Tailwind utility classes (Vanilla CSS mandate).
- No 3-column equal card layouts (prefer single or asymmetrical 2-column).
- No AI copywriting clichés ("Elevate", "Seamless", "Unleash").
