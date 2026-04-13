# Phase 7 Context: Your Household (Desktop) [v2]

## Goal
Refactor the Household management view to align with the Milestone v2.0 Desktop UI specifications. This focuses on adopting a new top-level navigation structure (Header/Footer/Navbar) from the Stitch project and refining the Household screen aesthetics without changing component logic or basic structure.

## Implementation Decisions

### 1. Header, Footer, and Navbar (Adopt from Stitch)
- **Source**: Stitch screen ID `f8c7fa3d84eb42ceb093815610869ac0` (WFM-AI-FAMILY-MEALPLANNER).
- **Structure**:
    - **Top Header/Navbar**: Replace the existing `Sidebar` for desktop.
    - **Primary Navigation**: Links for Planner, Household, Recipes, and Settings.
    - **Utility Icons**: Use Material Icons for notifications and user profile (as per Stitch design).
    - **Footer**: Include a standard site footer with logo and legal/contact links.
- **Visuals**: "Warm paper" background, minimalist serif logo, and balanced sans-serif nav links.

### 2. Navigation & Shell
- **Shell Refactor**: Update `Shell.tsx` to conditionally render the new `Header` and `Footer` on desktop while maintaining the existing `BottomTabBar` for mobile (as mobile nav is out of scope).
- **Icons**: Transition from Lucide/Emoji to Material Icons within the new navigation components.
- **Responsiveness**: Ensure the `Header` and `Footer` are optimized for desktop viewports (up to 1200px container width).

### 3. MemberCard & ProfileForm (Stability)
- **Functionality**: Maintain all current behaviors (Add Member, Edit, Delete, Display).
- **Visuals**: Keep the existing HTML/structural layout of `MemberCard` and `ProfileForm`.
- **Updates Allowed**:
    - **Typography**: Update to `Newsreader` (Serif) for headings and `Manrope` (Sans-Serif) for body/forms to match the v2 design system.
    - **Icons**: Update icons to Material Icons if applicable.
    - **Styling**: Minor CSS adjustments to align colors and spacing with the "Verdant Table" palette established in Phase 06.

### 4. Household Page Layout
- **Refined Grid**: Adjust the `MemberGrid` container to a `max-width-planner` (1200px) and optimize spacing for desktop "editorial" feel.

## Success Criteria
- [ ] Desktop navigation (Header/Navbar/Footer) matches the Stitch screen exactly.
- [ ] Household page retains all Phase 2 functionality (multi-member management).
- [ ] MemberCards and ProfileForms use the new Newsreader/Manrope typography.
- [ ] UI remains functional and cohesive on desktop and mobile (no regressions).
