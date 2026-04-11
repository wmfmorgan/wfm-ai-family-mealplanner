# Context: Phase 2 - Household & Profiles

## Goal
Establish a robust system for managing household members and their individual nutrition profiles, optimized for high-fidelity AI meal generation.

## Finalized Decisions
- **Household Initialization**: **Automatic (Trigger-based)**. A household record and a primary "Me" member are created silently upon first user login via a Supabase trigger.
- **Nutrition Profile**: **Presets + Advanced Overrides**. Use descriptive "Cookbook Presets" (e.g., "Active Adult", "Growing Toddler") to provide baseline calories/macros, with an "Advanced" toggle for manual editing.
- **Allergy & Avoidance Entry**: **Hybrid Model**. Visual toggles for the "Top 9" major allergens (for AI safety) + a "Chef's Notes" text field for culinary preferences (e.g., "no cilantro").
- **Kitchen Appliances**: **Method-Centric**. Track only high-impact appliances that dictate recipe selection (Slow Cooker, Air Fryer, Oven, Stove, Pressure Cooker).

## Core Mandates
- **UI**: Build a high-fidelity interface using Google Stitch.
- **Style**: Minimalist, earthy tones with tactile card-based interactions.
- **Constraints**: No TailwindCSS; all styling must be Vanilla CSS.

## Status
- **Phase 1**: COMPLETED.
- **Current Branch**: `phase-02-household-profiles`.

## Implementation Strategy
1. **02-01-PLAN**: Database & Schema Refinements (Triggers for auto-init & JSONB validation).
2. **02-02-PLAN**: Household Management UI (Stitch components with Presets & Hybrid inputs).
