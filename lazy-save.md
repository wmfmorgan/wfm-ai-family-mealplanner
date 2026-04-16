# Lazy-Save Implementation Plan

**Goal:** Don't persist meal plans to database on generation. Hold in client state as a "draft." User explicitly saves when satisfied. Reduces DB bloat, eliminates wasted categorization calls, and gives users a proper review-before-commit workflow.

---

## Current State vs Target State

```
CURRENT:
Generate → save 21 recipes → create plan → insert slots → categorize (async)
  └─ Every regeneration writes to DB. Abandoned plans pile up.

TARGET:
Generate → hold in React state (DRAFT)
  ├─ Lock/edit/delete/refresh → client state only
  ├─ "Save Plan" button → single atomic DB write
  └─ Categorize → fires only on save
```

---

## State Model

### New: `isDraft` flag

The core concept — `planData` already lives in React state. Add a boolean `isDraft` that tracks whether the current plan has been persisted.

```typescript
// MealPlanner.tsx — new state
const [isDraft, setIsDraft] = useState<boolean>(false);
const [draftPlan, setDraftPlan] = useState<DraftMealPlan | null>(null);
```

### New: `DraftMealPlan` interface

```typescript
// src/lib/services/planner.ts (or new file: src/lib/types/draft.ts)

interface DraftRecipe {
  draft_id: string;          // crypto.randomUUID() — client-generated
  name: string;
  description?: string;
  ingredients: any;
  instructions: any;
  nutrition: any;
  category?: string;
  prep_time_min: number;
  cook_time_min: number;
  servings: number;
}

interface DraftSlot {
  draft_id: string;          // crypto.randomUUID() — client-generated
  day_of_week: number;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  draft_recipe_id: string;   // references DraftRecipe.draft_id
  recipe: DraftRecipe | null;
  is_locked: boolean;
  manual_entry?: string;
}

interface DraftMealPlan {
  household_id: string;
  week_start_date: string;
  recipes: DraftRecipe[];
  slots: DraftSlot[];
  provider: string;
  model: string;
  created_at: string;        // ISO timestamp for staleness checks
}
```

---

## File-by-File Changes

### 1. `src/pages/MealPlanner/MealPlanner.tsx`

This is the biggest change. Currently the "source of truth" flips between DB-loaded data and optimistic UI state. In lazy-save, draft mode is entirely client-side.

#### 1a. New state variables

```typescript
const [isDraft, setIsDraft] = useState<boolean>(false);
const [draftPlan, setDraftPlan] = useState<DraftMealPlan | null>(null);
const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
```

#### 1b. Modify `handleGenerate` — stop persisting

Current (`MealPlanner.tsx:213-305`): Calls `plannerService.saveMealPlan()` after receiving AI response.

Change: Build `DraftMealPlan` in memory. Do NOT call `saveMealPlan`.

```typescript
const handleGenerate = async () => {
  if (!householdId || members.length === 0) return;

  // Guard: warn if overwriting unsaved draft
  if (isDraft && hasUnsavedChanges) {
    if (!window.confirm('You have an unsaved meal plan. Generate a new one?')) return;
  }

  setIsGenerating(true);
  setGenerationStep('Designing your week...');

  try {
    const stepTimer1 = setTimeout(() => setGenerationStep('Drafting recipes...'), 2000);
    const stepTimer2 = setTimeout(() => setGenerationStep('Final polish...'), 5000);

    const activeProvider = localStorage.getItem('active_ai_provider') || 'grok';
    const activeModel = localStorage.getItem('active_ai_model') || '...';

    let finalPlan;
    if (activeProvider === 'mock') {
      // ... existing mock path ...
    } else {
      const { data, error } = await supabase.functions.invoke('generate-plan', {
        body: { members, household_id: householdId, provider: activeProvider, model: activeModel, selected_meals: selectedMeals }
      });
      if (error) throw error;
      finalPlan = data;
    }

    // --- NEW: Build draft instead of saving ---
    const recipes: DraftRecipe[] = (finalPlan.days || []).flatMap((d: any) =>
      [d.breakfast, d.lunch, d.dinner].filter(Boolean)
    ).map((r: any) => ({
      draft_id: crypto.randomUUID(),
      name: r.name,
      description: r.description || '',
      ingredients: r.ingredients,
      instructions: r.instructions,
      nutrition: r.nutrition || {},
      category: r.category || '',
      prep_time_min: r.prep_time_minutes || r.prep_time_min || 0,
      cook_time_min: r.cook_time_min || 0,
      servings: r.servings || 4,
    }));

    // Deduplicate recipes by name (same recipe used on multiple days)
    const uniqueRecipes = recipes.reduce((acc, r) => {
      if (!acc.find(existing => existing.name === r.name)) acc.push(r);
      return acc;
    }, [] as DraftRecipe[]);

    const slots: DraftSlot[] = (finalPlan.days || []).flatMap((d: any) => {
      const daySlots: DraftSlot[] = [];
      for (const mealType of ['breakfast', 'lunch', 'dinner'] as const) {
        if (!selectedMeals.includes(mealType)) continue;
        const recipe = d[mealType];
        const matchedRecipe = recipe ? uniqueRecipes.find(r => r.name === recipe.name) || null : null;
        daySlots.push({
          draft_id: crypto.randomUUID(),
          day_of_week: d.day,
          meal_type: mealType,
          draft_recipe_id: matchedRecipe?.draft_id || '',
          recipe: matchedRecipe,
          is_locked: false,
          manual_entry: undefined,
        });
      }
      return daySlots;
    });

    const draft: DraftMealPlan = {
      household_id: householdId,
      week_start_date: format(weekStartDate, 'yyyy-MM-dd'),
      recipes: uniqueRecipes,
      slots,
      provider: activeProvider,
      model: activeModel,
      created_at: new Date().toISOString(),
    };

    setDraftPlan(draft);
    setIsDraft(true);
    setHasUnsavedChanges(true);

    // Build planData from draft for grid display
    buildPlanDataFromDraft(draft);

    clearTimeout(stepTimer1);
    clearTimeout(stepTimer2);
  } catch (err) {
    console.error('Error generating meal plan:', err);
    alert('Failed to generate meal plan.');
  } finally {
    setIsGenerating(false);
    setGenerationStep('');
  }
};
```

#### 1c. New helper: `buildPlanDataFromDraft`

Converts `DraftMealPlan` into the same `planData` shape the grid already consumes.

```typescript
const buildPlanDataFromDraft = (draft: DraftMealPlan) => {
  const gridData: Record<string, any> = {};
  for (const slot of draft.slots) {
    const dateStr = format(addDays(weekStartDate, slot.day_of_week), 'yyyy-MM-dd');
    if (!gridData[dateStr]) gridData[dateStr] = {};
    gridData[dateStr][slot.meal_type] = {
      id: slot.draft_id,          // use draft_id instead of DB id
      recipeName: slot.recipe?.name || '',
      recipe: slot.recipe,
      isLocked: slot.is_locked,
      manualEntry: slot.manual_entry || '',
    };
  }
  setPlanData(gridData);
};
```

#### 1d. Modify `handleLockToggle` — draft-aware

```typescript
const handleLockToggle = async (date: string, mealType: string, isLocked: boolean) => {
  // Optimistic UI update (unchanged)
  setPlanData(prev => ({
    ...prev,
    [date]: { ...prev[date], [mealType]: { ...prev[date]?.[mealType], isLocked } }
  }));

  if (isDraft) {
    // Update draft state, no DB call
    if (draftPlan) {
      const slot = draftPlan.slots.find(s =>
        format(addDays(weekStartDate, s.day_of_week), 'yyyy-MM-dd') === date && s.meal_type === mealType
      );
      if (slot) slot.is_locked = isLocked;
      setHasUnsavedChanges(true);
    }
    return;
  }

  // Persisted plan — existing DB call
  const slot = planData[date]?.[mealType];
  if (!slot?.id) return;
  try {
    await plannerService.updateSlot(slot.id, { is_locked: isLocked });
  } catch (err) {
    // revert ...
  }
};
```

#### 1e. Modify `handleEdit` — draft-aware

Same pattern: if `isDraft`, update `draftPlan.slots` in memory. No DB call.

```typescript
const handleEdit = async (date: string, mealType: string, manualEntry: string) => {
  setPlanData(prev => ({
    ...prev,
    [date]: { ...prev[date], [mealType]: { ...prev[date]?.[mealType], manualEntry } }
  }));

  if (isDraft) {
    if (draftPlan) {
      const slot = draftPlan.slots.find(s =>
        format(addDays(weekStartDate, s.day_of_week), 'yyyy-MM-dd') === date && s.meal_type === mealType
      );
      if (slot) slot.manual_entry = manualEntry;
      setHasUnsavedChanges(true);
    }
    return;
  }

  const slot = planData[date]?.[mealType];
  if (!slot?.id) return;
  try {
    await plannerService.updateSlot(slot.id, { manual_entry: manualEntry });
  } catch (err) { console.error(err); }
};
```

#### 1f. Modify `handleDelete` — draft-aware

```typescript
const handleDelete = async (date: string, mealType: string) => {
  const slot = planData[date]?.[mealType];

  setPlanData(prev => ({
    ...prev,
    [date]: { ...prev[date], [mealType]: { ...prev[date][mealType], recipeName: '', recipe: null, manualEntry: '' } }
  }));

  if (isDraft) {
    if (draftPlan) {
      const draftSlot = draftPlan.slots.find(s =>
        format(addDays(weekStartDate, s.day_of_week), 'yyyy-MM-dd') === date && s.meal_type === mealType
      );
      if (draftSlot) {
        draftSlot.recipe = null;
        draftSlot.draft_recipe_id = '';
        draftSlot.manual_entry = undefined;
      }
      setHasUnsavedChanges(true);
    }
    return;
  }

  if (!slot?.id) return;
  try {
    await plannerService.clearSlot(slot.id);
  } catch (err) {
    if (householdId) loadPlan(householdId, format(weekStartDate, 'yyyy-MM-dd'));
  }
};
```

#### 1g. Modify `handleRefresh` — draft-aware

This is the most complex change. Currently `refreshSlot` does AI call + DB insert + slot update in one method. For draft mode, we only need the AI call.

```typescript
const handleRefresh = async (date: string, mealType: string) => {
  if (!householdId) return;

  setPlanData(prev => ({
    ...prev,
    [date]: { ...prev[date], [mealType]: { ...prev[date][mealType], recipeName: 'Refreshing...', recipe: null } }
  }));

  try {
    const exclusionList: string[] = [];
    Object.values(planData).forEach((meals: any) => {
      Object.values(meals).forEach((m: any) => {
        if (m.recipeName && m.recipeName !== 'Refreshing...') exclusionList.push(m.recipeName);
      });
    });

    const activeProvider = localStorage.getItem('active_ai_provider') || 'grok';
    const activeModel = localStorage.getItem('active_ai_model') || '...';

    if (isDraft) {
      // AI-only refresh — new service method (see section 2)
      const newRecipeData = await plannerService.generateRefreshRecipe(
        mealType, members, exclusionList, { provider: activeProvider, model: activeModel }
      );

      const newDraftRecipe: DraftRecipe = {
        draft_id: crypto.randomUUID(),
        name: newRecipeData.name,
        description: newRecipeData.description || '',
        ingredients: newRecipeData.ingredients,
        instructions: newRecipeData.instructions,
        nutrition: {},
        category: newRecipeData.category || mealType,
        prep_time_min: newRecipeData.prep_time_minutes || 0,
        cook_time_min: 0,
        servings: 4,
      };

      if (draftPlan) {
        draftPlan.recipes.push(newDraftRecipe);
        const draftSlot = draftPlan.slots.find(s =>
          format(addDays(weekStartDate, s.day_of_week), 'yyyy-MM-dd') === date && s.meal_type === mealType
        );
        if (draftSlot) {
          draftSlot.recipe = newDraftRecipe;
          draftSlot.draft_recipe_id = newDraftRecipe.draft_id;
        }
        setHasUnsavedChanges(true);
      }

      setPlanData(prev => ({
        ...prev,
        [date]: { ...prev[date], [mealType]: { ...prev[date][mealType], recipeName: newDraftRecipe.name, recipe: newDraftRecipe } }
      }));
    } else {
      // Existing persisted-plan refresh path
      const slot = planData[date]?.[mealType];
      if (!slot?.id) return;
      const newRecipe = await plannerService.refreshSlot(slot.id, householdId, mealType, members, exclusionList, { provider: activeProvider, model: activeModel });
      if (newRecipe) {
        setPlanData(prev => ({
          ...prev,
          [date]: { ...prev[date], [mealType]: { ...prev[date][mealType], recipeName: newRecipe.name, recipe: newRecipe } }
        }));
      }
    }
  } catch (err) {
    console.error('Error refreshing slot:', err);
    if (!isDraft && householdId) loadPlan(householdId, format(weekStartDate, 'yyyy-MM-dd'));
  }
};
```

#### 1h. New: `handleSavePlan`

The "commit" action. Persists everything in one go.

```typescript
const handleSavePlan = async () => {
  if (!draftPlan || !householdId) return;

  try {
    setGenerationStep('Saving your plan...');

    // Filter to only recipes that are still referenced by a slot
    const activeRecipeIds = new Set(draftPlan.slots.filter(s => s.draft_recipe_id).map(s => s.draft_recipe_id));
    const recipesToSave = draftPlan.recipes
      .filter(r => activeRecipeIds.has(r.draft_id))
      .map(({ draft_id, ...rest }) => ({ ...rest, household_id: householdId }));

    const slotsToSave = draftPlan.slots.map(s => ({
      day_of_week: s.day_of_week,
      meal_type: s.meal_type,
      recipe_name: s.recipe?.name || undefined,
      is_locked: s.is_locked,
      manual_entry: s.manual_entry || null,
    }));

    await plannerService.saveMealPlan(
      householdId,
      draftPlan.week_start_date,
      recipesToSave as any,
      slotsToSave as any,
      { provider: draftPlan.provider, model: draftPlan.model }
    );

    // Transition from draft to persisted
    setIsDraft(false);
    setDraftPlan(null);
    setHasUnsavedChanges(false);

    // Reload from DB to get real IDs
    await loadPlan(householdId, draftPlan.week_start_date);
  } catch (err) {
    console.error('Error saving plan:', err);
    alert('Failed to save meal plan.');
  } finally {
    setGenerationStep('');
  }
};
```

#### 1i. Week navigation guard

Changing weeks while a draft exists should warn.

```typescript
const handlePrevWeek = () => {
  if (isDraft && hasUnsavedChanges) {
    if (!window.confirm('You have an unsaved meal plan. Discard it?')) return;
    discardDraft();
  }
  setWeekStartDate(prev => subWeeks(prev, 1));
};

const handleNextWeek = () => {
  if (isDraft && hasUnsavedChanges) {
    if (!window.confirm('You have an unsaved meal plan. Discard it?')) return;
    discardDraft();
  }
  setWeekStartDate(prev => addWeeks(prev, 1));
};

const discardDraft = () => {
  setIsDraft(false);
  setDraftPlan(null);
  setHasUnsavedChanges(false);
};
```

#### 1j. Browser close/refresh guard

```typescript
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (isDraft && hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [isDraft, hasUnsavedChanges]);
```

---

### 2. `src/lib/services/planner.ts`

#### 2a. New method: `generateRefreshRecipe` (AI-only, no DB)

Extract the AI call from `refreshSlot` into a standalone method that returns raw recipe data without persisting.

```typescript
/**
 * Calls refresh-slot Edge Function and returns raw recipe data.
 * Does NOT persist to database. Used for draft-mode refreshes.
 */
async generateRefreshRecipe(
  category: string,
  members: any[],
  exclusionList: string[],
  options?: { provider?: string; model?: string }
) {
  const { data, error: invokeError } = await supabase.functions.invoke('refresh-slot', {
    body: {
      members,
      category,
      exclusion_list: exclusionList,
      provider: options?.provider,
      model: options?.model
    }
  });

  if (invokeError) throw invokeError;
  return data.recipe;
},
```

#### 2b. Refactor `refreshSlot` to use `generateRefreshRecipe`

Keeps existing behavior for persisted plans but eliminates code duplication.

```typescript
async refreshSlot(
  slotId: string,
  householdId: string,
  category: string,
  members: any[],
  exclusionList: string[],
  options?: { provider?: string; model?: string }
) {
  if (IS_MOCK) { console.log('Mock mode: Slot refresh skipped.'); return null; }

  // 1. Get recipe from AI
  const newRecipeData = await this.generateRefreshRecipe(category, members, exclusionList, options);

  // 2. Persist recipe
  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .insert({
      household_id: householdId,
      name: newRecipeData.name,
      ingredients: newRecipeData.ingredients,
      instructions: newRecipeData.instructions,
      nutrition: {},
      prep_time_min: newRecipeData.prep_time_minutes || 0,
      cook_time_min: 0,
      servings: 4
    })
    .select()
    .single();

  if (recipeError) throw recipeError;

  // 3. Update slot
  const { error: slotError } = await supabase
    .from('meal_plan_slots')
    .update({ recipe_id: recipe.id, manual_entry: null })
    .eq('id', slotId);

  if (slotError) throw slotError;

  return { ...recipe, id: recipe.id };
}
```

#### 2c. Refactor `saveMealPlan` — bulk insert

Currently inserts recipes one-by-one (`planner.ts:83-101`). Refactor to bulk insert.

```typescript
// BEFORE (N+1):
for (const recipe of recipes) {
  const { data, error } = await supabase.from('recipes').insert({...}).select().single();
  savedRecipes.push(data);
}

// AFTER (bulk):
const recipesWithHousehold = recipes.map(r => ({ ...r, household_id: householdId }));
const { data: savedRecipes, error: recipesError } = await supabase
  .from('recipes')
  .insert(recipesWithHousehold)
  .select();

if (recipesError) throw recipesError;
```

**Caveat:** Bulk insert returns rows in insertion order but without guaranteed ID mapping if any have pre-existing IDs. Since draft recipes never have DB IDs, this is safe for lazy-save. Keep the existing upsert path for the (now rare) case of re-saving a previously persisted plan.

```typescript
// Full refactored logic:
let savedRecipes: Recipe[];

const newRecipes = recipes.filter(r => !r.id);
const existingRecipes = recipes.filter(r => r.id);

// Bulk insert new recipes
if (newRecipes.length > 0) {
  const { data, error } = await supabase
    .from('recipes')
    .insert(newRecipes.map(r => ({ ...r, household_id: householdId })))
    .select();
  if (error) throw error;
  savedRecipes = data || [];
} else {
  savedRecipes = [];
}

// Upsert existing recipes individually (rare path — only for re-saves)
for (const recipe of existingRecipes) {
  const { data, error } = await supabase
    .from('recipes')
    .upsert({ ...recipe, household_id: householdId })
    .select()
    .single();
  if (error) throw error;
  savedRecipes.push(data);
}
```

---

### 3. `src/components/MealPlanner/GenerationPanel.tsx`

Add "Save Plan" and "Discard" buttons. They only appear when `isDraft` is true.

#### 3a. New props

```typescript
interface GenerationPanelProps {
  // ... existing props ...
  isDraft?: boolean;
  hasUnsavedChanges?: boolean;
  onSavePlan?: () => void;
  onDiscardDraft?: () => void;
  isSaving?: boolean;
}
```

#### 3b. New UI section (after the generate button)

```tsx
{isDraft && (
  <div className="draft-actions">
    <div className="draft-banner">
      <span className="draft-indicator">Draft</span>
      <span className="draft-hint">Review your plan, then save or regenerate.</span>
    </div>
    <button
      className="save-plan-btn"
      onClick={onSavePlan}
      disabled={isSaving}
    >
      {isSaving ? 'Saving...' : 'Save This Plan'}
    </button>
    <button
      className="discard-btn"
      onClick={onDiscardDraft}
      disabled={isSaving}
    >
      Discard Draft
    </button>
  </div>
)}
```

#### 3c. Modify generate button label

When a draft exists, relabel "Generate Weekly Plan" to "Regenerate" to signal it replaces the draft.

```tsx
<button className="generate-btn" onClick={onGenerate} disabled={isGenerating || selectedMeals.length === 0}>
  {isGenerating ? (
    <div className="generation-progress">
      <div className="loading-spinner" />
      <span className="step-label">{generationStep || 'Drafting...'}</span>
    </div>
  ) : (
    <span>{isDraft ? 'Regenerate' : 'Generate Weekly Plan'}</span>
  )}
</button>
```

---

### 4. `src/components/MealPlanner/DayColumn.tsx`

No structural changes needed. The `id` field in the meals record already accepts `string | undefined`. Draft mode passes `draft_id` as `id` — DayColumn doesn't care whether it's a DB UUID or client UUID.

---

### 5. `src/components/MealPlanner/MealSlot.tsx`

No changes needed. MealSlot never accesses the DB directly. All actions go through callbacks to MealPlanner.tsx.

---

### 6. `src/pages/MealPlanner/ShoppingList.tsx`

No changes needed. Shopping list reads from `shopping_list_items` table which only gets populated after `saveMealPlan` triggers `categorize-ingredients`. In lazy-save, this happens post-commit — shopping list simply won't show items until the plan is saved. This is correct behavior.

---

### 7. Test Updates

#### 7a. `src/__tests__/meal-plan.test.tsx`

Tests already verify optimistic UI behavior for slots without IDs (lines 44-72, 74-99). These tests are already compatible with lazy-save — they assert that `plannerService.updateSlot` is NOT called when slot has no ID.

**No changes needed for existing tests.**

#### 7b. New tests to add: `src/__tests__/lazy-save.test.tsx`

```typescript
describe('Lazy Save - Draft Mode', () => {
  it('does NOT call saveMealPlan after generation', async () => {
    // Generate a plan
    // Assert plannerService.saveMealPlan was NOT called
    // Assert grid displays recipes
    // Assert isDraft is true
  });

  it('calls saveMealPlan when Save button clicked', async () => {
    // Generate a plan (draft)
    // Click "Save This Plan"
    // Assert plannerService.saveMealPlan called with correct recipes/slots
    // Assert isDraft transitions to false
  });

  it('warns before navigating away with unsaved draft', async () => {
    // Generate a plan (draft)
    // Click prev/next week
    // Assert window.confirm was called
  });

  it('discards draft and clears grid on Discard click', async () => {
    // Generate a plan (draft)
    // Click "Discard Draft"
    // Assert grid is empty
    // Assert isDraft is false
  });

  it('refreshes slot in draft mode without DB call', async () => {
    // Generate a plan (draft)
    // Click refresh on a slot
    // Assert plannerService.generateRefreshRecipe was called
    // Assert plannerService.refreshSlot was NOT called
    // Assert new recipe appears in grid
  });

  it('lock/edit/delete work in draft mode without DB calls', async () => {
    // Generate a plan (draft)
    // Lock a slot → assert updateSlot NOT called
    // Edit a slot → assert updateSlot NOT called
    // Delete a slot → assert clearSlot NOT called
  });
});
```

#### 7c. `src/__tests__/surgical-slot-control.test.tsx`

These tests verify behavior for **persisted** plans (slots have DB IDs). They remain valid — the `isDraft=false` code path is unchanged. **No changes needed.**

---

### 8. Optional: localStorage Draft Backup

Guard against accidental page refresh losing the draft.

```typescript
// Save draft to localStorage on every change
useEffect(() => {
  if (draftPlan && isDraft) {
    localStorage.setItem('draft_meal_plan', JSON.stringify(draftPlan));
  }
}, [draftPlan, isDraft]);

// Restore draft on mount
useEffect(() => {
  const savedDraft = localStorage.getItem('draft_meal_plan');
  if (savedDraft) {
    try {
      const draft: DraftMealPlan = JSON.parse(savedDraft);
      // Check staleness — discard if older than 24 hours
      const age = Date.now() - new Date(draft.created_at).getTime();
      if (age < 24 * 60 * 60 * 1000) {
        setDraftPlan(draft);
        setIsDraft(true);
        setHasUnsavedChanges(true);
        buildPlanDataFromDraft(draft);
      } else {
        localStorage.removeItem('draft_meal_plan');
      }
    } catch { localStorage.removeItem('draft_meal_plan'); }
  }
}, []); // Run once on mount

// Clear on save or discard
const clearDraftBackup = () => localStorage.removeItem('draft_meal_plan');
```

---

## Implementation Order

Execute in this sequence. Each step is independently shippable.

| Step | What | Files | Risk |
|------|------|-------|------|
| **1** | Add `DraftMealPlan` types | `src/lib/types/draft.ts` (new) | None |
| **2** | Add `generateRefreshRecipe` to planner service | `src/lib/services/planner.ts` | None — additive |
| **3** | Refactor `refreshSlot` to use `generateRefreshRecipe` | `src/lib/services/planner.ts` | Low — verify existing refresh tests pass |
| **4** | Refactor `saveMealPlan` to bulk insert | `src/lib/services/planner.ts` | Medium — verify name→ID mapping still works |
| **5** | Add `isDraft` state + modify `handleGenerate` | `src/pages/MealPlanner/MealPlanner.tsx` | Medium — core behavior change |
| **6** | Make `handleLockToggle`, `handleEdit`, `handleDelete` draft-aware | `src/pages/MealPlanner/MealPlanner.tsx` | Low — if/else branching |
| **7** | Make `handleRefresh` draft-aware | `src/pages/MealPlanner/MealPlanner.tsx` | Medium — uses new service method |
| **8** | Add `handleSavePlan` + `discardDraft` | `src/pages/MealPlanner/MealPlanner.tsx` | Low |
| **9** | Add week navigation guards + beforeunload | `src/pages/MealPlanner/MealPlanner.tsx` | Low |
| **10** | Add Save/Discard UI to GenerationPanel | `src/components/MealPlanner/GenerationPanel.tsx` | Low — UI only |
| **11** | Add CSS for draft banner + save/discard buttons | `src/components/MealPlanner/GenerationPanel.css` | None |
| **12** | Add localStorage draft backup (optional) | `src/pages/MealPlanner/MealPlanner.tsx` | Low |
| **13** | Write new tests | `src/__tests__/lazy-save.test.tsx` | None |
| **14** | Verify existing tests still pass | All test files | Validation step |

---

## What This Doesn't Change

- **Edge Functions** (`generate-plan`, `refresh-slot`, `ai-proxy`, `categorize-ingredients`) — untouched. They remain stateless request/response functions.
- **Database schema** — no migrations. Same tables, same RLS.
- **ShoppingList page** — still reads from DB. Works after plan is saved.
- **Persisted plan interactions** — loading a previously-saved plan from DB still works as before. All draft-aware code paths gate on `isDraft`.
- **MealSlot / DayColumn / PlannerGrid components** — no changes. They consume the same `planData` shape.

---

## Edge Cases to Handle

| Scenario | Behavior |
|----------|----------|
| Generate → navigate away → come back | localStorage backup restores draft (step 12), or warn+discard (step 9) |
| Generate → refresh a slot → save | Refreshed recipe included in save. Original recipe removed from `draftPlan.recipes` if orphaned |
| Generate → delete all slots → save | Save with empty slots (or disable Save button when no slots have recipes) |
| Generate → lock slots → regenerate | Warn about overwrite. Locked slot state lost on regenerate (by design — locks are for saving, not for cross-generation persistence) |
| Load persisted plan → edit slot | `isDraft=false`, existing DB path, no behavioral change |
| Generate → save fails | Stay in draft mode. User can retry. Draft not lost |
| Two tabs open | localStorage backup may conflict. Accept last-write-wins — not worth solving for V1 |
