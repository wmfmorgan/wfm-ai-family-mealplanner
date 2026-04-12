# Requirements: wfm-ai-family-mealplanner

## User Stories
- **Auth**: As a user, I want to sign in with email or a magic link so I can access my data securely.
- **Household**: As a user, I want to create and manage multiple family members with their specific nutrition profiles.
- **Planning**: As a user, I want to select specific days and meals (B/L/D) to generate for my household.
- **Generation**: As a user, I want the AI to create a meal plan that respects everyone's dietary needs (multi-recipe if needed).
- **Recipes**: As a user, I want to view clear, step-by-step instructions and ingredients for each planned meal.
- **Shopping**: As a user, I want a consolidated shopping list grouped by category for easy grocery runs.
- **Control**: As a user, I want to see which AI model is currently active and debug my AI prompts.

## Technical Requirements
- **Supabase**: PostgreSQL for data, Auth for identity, RLS for security.
- **Edge Functions**: All AI calls must go through Deno edge functions for security.
- **Ollama**: Local development must support direct `localhost:11434` calls for Ollama.
- **Google Stitch**: All UI components should be generated using the [WFM-AI-MEALPLANNER](https://stitch.google.com/projects/15134141823727190585) project for a cohesive, minimalist look.
- **State Management**: Meal plans must be versioned by week.
- **Performance**: Recipes and plans should be cached in Supabase to avoid redundant AI calls.

## Visual Requirements
- Minimalist, earthy tones.
- "Cookbook" aesthetic (clear typography, generous spacing).
- Visual meal cards with at-a-glance nutrition.
