Here's the clean **Project Brief** exactly as requested:

---

**Project Brief: Family Multi-Person Meal Planner**

**App Overview**  
A web-based family meal planner where a single logged-in user creates and manages a household with multiple people, each having their own detailed nutrition profile. The AI generates personalized weekly meal plans (breakfast, lunch, dinner) based on each selected person’s daily calorie target, preferred macro split, allergies/intolerances, food avoidances/preferences, favorite foods, cooking skill level, and available kitchen appliances. Users can selectively generate meals for specific days and meal types, set servings/leftovers per individual meal, view detailed recipes, and get a consolidated shopping list. The AI provider and model (Gemini, Grok, or local models via Ollama) are configurable globally.

**Core Objectives**  
- Enable quick, intelligent meal planning for households with varying dietary needs and cooking capabilities.  
- Keep the experience simple, visual, and delightful.  
- Use secure backend AI calls via Supabase Edge Functions.  
- Support rapid “vibe coding” development.

**Key Features**  
- **Authentication**: Supabase Auth using email/password and magic links.  
- **Household Management**: One user owns one household. Users can add, edit, and manage multiple household members with full nutrition profiles (daily calorie target, macro split, allergies/intolerances, food avoidances/preferences, favorite foods, cooking skill level, available kitchen appliances).  
- **Meal Planner Calendar**: Weekly view (Sunday–Saturday) where users select which days and which meals (breakfast/lunch/dinner) to generate.  
- **Meal Generation**: Per-meal servings/leftovers setting. Generate entire plan, regenerate missing meals, or regenerate individual meals.  
- **Recipe Detail**: Clicking a meal card shows ingredients with quantities, step-by-step instructions, prep/cook time, nutrition information, servings count, and any AI notes.  
- **Shopping List**: One consolidated list for the entire meal plan (or selected days), grouped by category (e.g., produce, dairy, protein), with automatically combined quantities and checkboxes to mark items.  
- **AI Integration**: All AI calls routed through Supabase Edge Functions for security. Support for Gemini, Grok, and local models via Ollama. Provider and model are configurable globally. The footer of the app always displays the currently active provider and model.  
- **Debug / Support Page**: Shows the last 10 AI interactions (prompts sent and replies received) from the current session.  
- **AI Settings**: Global configuration managed via environment variables, with the ability to switch between configured providers/models on an admin page (combined with the Debug/Support page).  
- **Data Persistence**: Meal plans are versioned by week. Recipes and meal plans are saved in Supabase so they can be viewed later without re-calling the AI.

**Tech Stack**  
- **Frontend**: React + Vite  
- **UI Generation**: Google Stitch will be used extensively to generate the UI and all UI components during development.  
- **Backend / Auth / Database**: Supabase (Authentication, PostgreSQL, Row Level Security)  
- **AI Layer**: Supabase Edge Functions (Deno) for all AI calls  
- **Deployment**: The frontend will be deployed to Netlify. The backend (database, auth, edge functions) will use Supabase.  

**Navigation**  
- Dashboard  
- Household Profiles  
- Meal Planner Calendar  
- Recipe Detail (accessed from calendar)  
- Shopping List  
- AI Settings (global, admin)  
- Debug / Support  

**Development Approach**  
The app will be built using the Get Shit Done (GSD) 1.0 framework for structured, vibe-based development with AI. Google Stitch will be leveraged to rapidly generate and refine UI layouts and components. Prompts for the AI meal planner will be designed in progressive stages, starting simple and expanding to full multi-person logic.

**Security & Configuration Notes**  
- API keys for AI providers are stored in environment variables.  
- All AI calls are made server-side through Edge Functions (no client-side exposure of keys).  
- Users only see their own household data via Supabase Row Level Security.  
- Meal plans are versioned by the week they cover.

This project brief provides a clear, focused foundation for building the Family Multi-Person Meal Planner app using React/Vite, Supabase, Supabase Edge Functions, and Google Stitch for UI generation, with deployment to Netlify (frontend) and Supabase (backend).

Use stitch MCP and stitch skills (react-components, design-md, stitch-design) to build the app