# Phase 08 Context: Surgical Slot Control & Multi-Agent Generation

## 1. Architectural Decisions

### Generation Strategy (Coordinator-Worker Pattern)
- **Stage 1: Coordinator (Sequential)**: A single, fast AI call to establish the "Blueprint" for the week.
    - **Outputs**: Theme, protein rotation, variety rules, and high-level meal sketches (JSON).
- **Stage 2: Specialist Workers (Parallel)**: Independent agents for Breakfast, Lunch, and Dinner.
    - **Input**: User Profile + Coordinator Blueprint.
    - **Execution**: Triggered via `Promise.all` in the Supabase Edge Function (`ai-proxy` or a new dedicated function).
- **Stage 3: Sanitization (Sequential/Optional)**: A final pass to verify against duplicates and allergy violations.
    - **Control**: Toggleable via the Settings menu.
    - **Logic**: Identifies violations and triggers targeted fixes (Flag & Fix).

### User Interface & Experience
- **Progress Tracking**: High-level "Editorial" progress indicators (e.g., "Designing your week", "Drafting recipes", "Final polish").
- **Slot Controls**: Integrated "Delete" (trash) and "Refresh" (rotate) icons on each meal slot.
- **Refresh Logic**: A single-slot refresh will use a targeted prompt that includes the *full context* of the current week's blueprint to ensure the new suggestion fits the theme and avoids existing meals.

## 2. Technical Constraints
- **AI Proxy Updates**: The `ai-proxy` must be updated or supplemented to handle the multi-pass logic to keep keys secure on the backend.
- **State Management**: React state must handle partial updates (single slot) and full-week merges from the multi-agent response.
- **Service Layer**: `plannerService` needs methods for `clearSlot` and `refreshSlot`.

## 3. Discarded Approaches
- **Pure Parallelism**: Discarded to avoid the "Oatmeal three times" problem; the Coordinator is required for coherence.
- **Granular Progress**: Discarded in favor of an editorial, cookbook-like feel.
- **Direct Sanitizer Editing**: Discarded in favor of "Flag & Fix" to maintain the integrity of the worker agents' output.

## 4. Unanswered Questions (For Research/Strategy)
- Should we create a new `generate-plan` edge function instead of overloading `ai-proxy`?
- How to efficiently pass the "Blueprint" to parallel workers to minimize token usage?
- What is the most resilient way to handle a failure in one of the parallel agents (e.g., Dinner fails, but Breakfast/Lunch succeed)?
