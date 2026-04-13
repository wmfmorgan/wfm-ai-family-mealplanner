# Project: wfm-ai-family-mealplanner

## Context
A web-based family meal planner where a single logged-in user manages a household with multiple nutrition profiles. The AI generates personalized weekly meal plans based on calorie targets, macro splits, allergies, avoidances, skills, and appliances.

## Tech Stack
- **Frontend**: React + Vite (TS)
- **UI**: Google Stitch (Vanilla CSS) — [WFM-AI-MEALPLANNER](https://stitch.google.com/projects/15134141823727190585)
- **Backend/Auth/DB**: Supabase
- **AI Layer**: Supabase Edge Functions (Deno)
- **AI Providers**: Gemini, Grok, Ollama (Direct local call for dev)
- **Deployment**: Netlify (Frontend), Supabase (Backend)

## Core Features
- Supabase Auth (Email/Magic Links)
- Household & Profile Management
- Weekly Meal Planner Calendar
- AI Meal Generation (Per-meal servings/leftovers)
- Recipe Detail View
- Consolidated Shopping List (Basic grouping)
- AI Settings & Debug Page (Last 10 interactions)

## Style & Vibe
- Minimalist, earthy tones
- Simple, visual, and delightful
- Cookbook-like feel

## Configuration
- AI providers/models configurable via env vars
- Row Level Security for data privacy
- Versioned meal plans by week

## Milestones
- **v1.0**: Initial MVP (Foundation, Auth, Household, AI Proxy, Meal Planner Core, Shopping List) — COMPLETED
- **v2.0**: Desktop UI Refactor (Aligning with Stitch Project WFM-AI-MEALPLANNER Desktop designs) — IN PROGRESS
