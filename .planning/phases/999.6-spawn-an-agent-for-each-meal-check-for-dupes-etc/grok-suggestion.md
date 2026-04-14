### 1. The Coordinator (also called the Planner or Orchestrator)
- This is the **"boss" or "architect"** that runs **first**, and it's a **single, quick AI call**.
- Its only job is to create the **high-level plan** or "blueprint" for the entire week. It does **not** generate the actual detailed meals yet.
- What it outputs (in clean JSON):
  - Overall theme for the week (e.g., "Kid-friendly Mediterranean with lots of veggies")
  - Rules for variety (e.g., "No meal repeats in the week", "Rotate proteins: chicken → fish → beans → beef")
  - List of ingredients to emphasize or avoid
  - A rough sketch or constraints for each day/mealtime
  - Global variety rules so nothing feels repetitive

**Why this step?**  
It gives every other agent a shared "rulebook" to follow. This is the key to preventing the AI from accidentally repeating meals (like suggesting oatmeal for breakfast three times).

This call is fast because the output is small and structured — the model isn't writing full recipes yet.

### 2. The Parallel Agents (Breakfast Agent, Lunch Agent, Dinner Agent, etc.)
- These are the **"specialist workers"** that run **at the same time** (in parallel).
- Each one has a very focused job:
  - **Breakfast Agent**: Only creates breakfasts for the whole week. It gets the coordinator's blueprint + user preferences.
  - **Lunch Agent**: Only creates lunches.
  - **Dinner Agent**: Only creates dinners.
- They all see the same blueprint, so they know the rules and can avoid overlapping with each other.

Because they run **simultaneously** (using `Promise.all` in your Deno edge function), the total waiting time is roughly equal to the slowest one agent — not the sum of all three. That's the big speed win.

Each agent is told explicitly:  
"Follow the coordinator's rules strictly. Do not repeat any meal that appears in the blueprint or in what the other agents are generating."

### How they work together (the full flow)
1. User requests a meal plan → Edge function starts.
2. Coordinator runs first (quick).
3. Once the blueprint is ready, the three specialized agents launch **at the same time**.
4. When all three finish, you combine their outputs into one final plan (optionally with a tiny reviewer step to catch any leftover repeats).

### Why this is better than the old single big AI call
- **Speed**: Instead of one long call that does everything sequentially (breakfast + lunch + dinner = slow), you get parallel execution.
- **Better variety / fewer repeats**: The coordinator sets global rules upfront, and each specialist stays in its lane while knowing the rules. A single big prompt often forgets details halfway through and starts repeating ideas.
- **Easier for the AI**: Smaller, focused prompts make the model follow instructions more reliably.

In code (in your Supabase edge function), it looks roughly like:

```ts
// Step 1: Coordinator
const framework = await callAI(coordinatorPrompt(userInput));

// Step 2: Parallel agents
const [breakfasts, lunches, dinners] = await Promise.all([
  callAI(breakfastAgentPrompt(framework, userInput)),
  callAI(lunchAgentPrompt(framework, userInput)),
  callAI(dinnerAgentPrompt(framework, userInput))
]);

// Then merge and return the plan
```

This pattern stays inside your existing edge function and scales nicely as you add more agents later (snacks, sides, etc.).