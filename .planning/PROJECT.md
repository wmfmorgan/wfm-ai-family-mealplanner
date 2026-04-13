# Project: wfm-ai-family-mealplanner

## Context
A web-based family meal planner where a single logged-in user manages a household with multiple nutrition profiles. The AI generates personalized weekly meal plans based on dietary style, calorie targets, macro splits, allergies, avoidances, skills, and appliances.

## Tech Stack
- **Frontend**: React + Vite (TS)
- **UI**: Google Stitch (Vanilla CSS) — [WFM-AI-MEALPLANNER](https://stitch.google.com/projects/15134141823727190585)
- **Backend/Auth/DB**: Supabase
- **AI Layer**: Supabase Edge Functions (Deno)
- **AI Providers**: Gemini, Grok, Ollama (Direct local call for dev)
- **Deployment**: Netlify (Frontend), Supabase (Backend)

## Current State
- **Shipped Version**: v2.0 (Desktop UI Refactor)
- **Latest Features**: 
    - Desktop-optimized Shell, Landing, and Household Profiles.
    - Verified visual alignment with Stitch editorial aesthetic.
    - Enhanced Dietary Selection (Vegan, Keto, etc.).

## Milestones
- **v1.0**: Initial MVP (Foundation, Auth, Household, AI Proxy, Meal Planner Core, Shopping List) — COMPLETED
- **v2.0**: Desktop UI Refactor (Landing, Household, Navigation) — COMPLETED
- **v3.0**: Meal Generation Refinement (Surgical Slot Control, AI Quality, Sanitization Pass) — ACTIVE

## Next Milestone Goals (v3.0)
- **Surgical Slot Control**: Delete/Refresh individual meal slots.
- **AI Plan Quality**: Prevent duplicates and increase ingredient fidelity.
- **Sanitization Pass**: Multi-pass AI verification for dietary profile adherence.
- **Generation Feedback**: Visual progress indicators for multi-step AI tasks.

## Configuration & Style
- **Aesthetic**: Minimalist, earthy tones ("Verdant Table" / "Warm Paper").
- **Typography**: Newsreader (Serif) for headings, Manrope (Sans-Serif) for UI.
- **Security**: Row Level Security (RLS) for data privacy.
- **Configuration**: AI providers/models configurable via environment variables.

<details>
<summary>Archived Project Context (v1.x)</summary>

### Core Features (v1.0)
- Supabase Auth (Email/Magic Links)
- Household & Profile Management
- Weekly Meal Planner Calendar
- AI Meal Generation (Per-meal servings/leftovers)
- Recipe Detail View
- Consolidated Shopping List (Basic grouping)
- AI Settings & Debug Page (Last 10 interactions)

### Milestone v2.0 Scope
- [v2.0-REQUIREMENTS.md](milestones/v2.0-REQUIREMENTS.md) — Visual alignment with Stitch Project.
</details>
