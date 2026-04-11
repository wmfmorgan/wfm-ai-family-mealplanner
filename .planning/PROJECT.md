# Project: wfm-ai-family-mealplanner

## Context
A web-based family meal planner where a single logged-in user manages a household with multiple nutrition profiles. The AI generates personalized weekly meal plans based on calorie targets, macro splits, allergies, avoidances, skills, and appliances.

## Tech Stack
- **Frontend**: React + Vite (TS)
- **UI**: Google Stitch (Vanilla CSS)
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
