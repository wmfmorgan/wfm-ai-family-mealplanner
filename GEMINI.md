# GEMINI.md - wfm-ai-family-mealplanner

This file defines the foundational mandates and workflows for the **wfm-ai-family-mealplanner** project. These instructions take absolute precedence over all other system-level defaults.

## Project Identity & Goals
- **Project Name:** `wfm-ai-family-mealplanner`
- **Core Purpose:** A web-based family meal planner that generates personalized weekly meal plans for households with diverse nutrition profiles and cooking constraints.
- **Vibe & Style:** Minimalist, earthy tones with a "cookbook-like" feel. Simple, visual, and delightful.

## Technical Mandates

### 1. Frontend & UI
- **Framework:** React + Vite (TypeScript).
- **Styling:** **NEVER** use TailwindCSS. All styling must be done using **Vanilla CSS**.
- **UI Development:** Use **Google Stitch** exclusively for UI component generation and refinement.
- **Skills:** Leverage `stitch-loop`, `taste-design`, `stitch-design`, `react-components`, and `design-md` for all frontend tasks.

### 2. Backend & Security
- **Platform:** Supabase (Authentication, PostgreSQL, Row Level Security).
- **Authentication:** Email/Password and Magic Links.
- **AI Routing:** **ALL** AI provider calls (Gemini, Grok, Ollama) MUST be routed through **Supabase Edge Functions (Deno)**. 
- **Security:** Never expose AI API keys on the client side. Use Supabase RLS to ensure users only access their own household data.

### 3. AI & Data
- **Meal Strategy:** Multi-recipe hybrid strategy.
- **Data Persistence:** Meal plans and recipes must be saved in Supabase and versioned by week.
- **Shopping List:** Consolidated list grouped by category (Produce, Dairy, Protein, etc.) with basic quantity merging.

## Workflow & Engineering Standards

### 1. Development Framework (GSD 1.0)
Follow the **Research -> Strategy -> Execution** lifecycle for every phase and task.
- **Research:** Systematically map the codebase and validate assumptions.
- **Strategy:** Formulate a grounded plan before execution.
- **Execution (Plan -> Act -> Validate):** Perform surgical updates with rigorous verification.

### 2. Planning & Documentation
- **Location:** All project planning, requirements, and phase-specific logs are located in the `.planning/` directory.
- **Roadmap:** Refer to `.planning/ROADMAP.md` for project progress.
- **Phase Context:** Always check `.planning/phases/XX-name/` for the current phase's context, research, and validation criteria.

### 3. Source Control
- **Branching:** Use a **Branch per Phase** strategy as defined in `.planning/config.json`.
- **Commits:** Do not stage or commit changes unless explicitly requested.

### 4. Validation & Quality
- **Verification:** Adhere to "Strict Verification" as configured. Every change must be verified against the phase goal and project requirements.
- **Testing:** Add or update tests for every new feature or bug fix.

## UI/UX Keywords for Stitch
When using `stitch-design` or `enhance-prompt`, incorporate these visual anchors:
- "minimalist earthy aesthetic"
- "cookbook layout"
- "tactile UI elements"
- "warm neutrals and soft greens"
- "legible serif typography for headings"
- "clean sans-serif for body text"
