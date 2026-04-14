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
- **Shipped Version**: v3.0 (Meal Generation Refinement)
- **Latest Features**: 
    - Granular slot control (Delete/Refresh).
    - Multi-agent coordinator-worker architecture for meal generation.
    - Editorial progress indicators.

## Milestones
- **v1.0**: Initial MVP — COMPLETED
- **v2.0**: Desktop UI Refactor — COMPLETED
- **v3.0**: Meal Generation Refinement — COMPLETED

## Configuration & Style
- **Aesthetic**: Minimalist, earthy tones ("Verdant Table" / "Warm Paper").
- **Typography**: Newsreader (Serif) for headings, Manrope (Sans-Serif) for UI.
- **Security**: Row Level Security (RLS) for data privacy.
- **Configuration**: AI providers/models configurable via environment variables.

<details>
<summary>Archived Project Context (v1.x - v2.x)</summary>

### Features (v2.0)
- Desktop-optimized Shell, Landing, and Household Profiles.
- Verified visual alignment with Stitch editorial aesthetic.
- Enhanced Dietary Selection.

### Features (v1.0)
- Supabase Auth (Email/Magic Links)
- Household & Profile Management
- Weekly Meal Planner Calendar
- AI Meal Generation
- Recipe Detail View
- Consolidated Shopping List (Basic grouping)
- AI Settings & Debug Page
</details>
