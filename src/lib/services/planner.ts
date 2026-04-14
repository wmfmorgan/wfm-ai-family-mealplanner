import { supabase } from '../supabase';

export interface Recipe {
  id?: string;
  household_id: string;
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

export interface MealPlan {
  id?: string;
  household_id: string;
  week_start_date: string;
  status: string;
}

export interface MealPlanSlot {
  id?: string;
  meal_plan_id: string;
  day_of_week: number;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  recipe_id?: string;
  recipe_name?: string; // For name-based mapping during generation
  is_locked: boolean;
  manual_entry?: string;
}

const IS_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

/**
 * Fetches a meal plan and its associated slots for a given household and week.
 */
export async function getMealPlan(householdId: string, weekStartDate: string) {
  if (IS_MOCK) return null; // No mock plans stored yet
  
  const { data: plan, error: planError } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('household_id', householdId)
    .eq('week_start_date', weekStartDate)
    .maybeSingle();

  if (planError) throw planError;
  if (!plan) return null;

  const { data: slots, error: slotsError } = await supabase
    .from('meal_plan_slots')
    .select('*, recipe:recipes(*)')
    .eq('meal_plan_id', plan.id)
    .order('day_of_week', { ascending: true });

  if (slotsError) throw slotsError;

  return { ...plan, slots };
}

/**
 * Saves a complete meal plan including recipes and slots.
 * Note: Uses sequential calls as the standard Supabase client doesn't support 
 * multi-table transactions natively without custom RPC.
 */
export async function saveMealPlan(
  householdId: string,
  weekStartDate: string,
  recipes: Recipe[],
  slots: Omit<MealPlanSlot, 'meal_plan_id'>[],
  options?: { provider?: string; model?: string }
) {
  if (IS_MOCK) {
    console.log('Mock mode: Meal plan save skipped.');
    return { id: 'mock-plan-id', household_id: householdId, week_start_date: weekStartDate, status: 'draft' };
  }
  
  // 1. Ensure recipes exist and get their IDs
  const savedRecipes: Recipe[] = [];
  for (const recipe of recipes) {
    if (recipe.id) {
      const { data, error } = await supabase
        .from('recipes')
        .upsert({ ...recipe, household_id: householdId })
        .select()
        .single();
      if (error) throw error;
      savedRecipes.push(data);
    } else {
      const { data, error } = await supabase
        .from('recipes')
        .insert({ ...recipe, household_id: householdId })
        .select()
        .single();
      if (error) throw error;
      savedRecipes.push(data);
    }
  }

  // 2. Create or update the meal plan
  const { data: plan, error: planError } = await supabase
    .from('meal_plans')
    .upsert({
      household_id: householdId,
      week_start_date: weekStartDate,
      status: 'draft'
    }, { onConflict: 'household_id,week_start_date' })
    .select()
    .single();

  if (planError) throw planError;

  // Find which meal types we are overwriting
  const mealTypesToUpdate = [...new Set(slots.map(s => s.meal_type))];

  // 3. Clear existing slots for the specific meal types and insert new ones
  if (mealTypesToUpdate.length > 0) {
    const { error: deleteError } = await supabase
      .from('meal_plan_slots')
      .delete()
      .eq('meal_plan_id', plan.id)
      .in('meal_type', mealTypesToUpdate);

    if (deleteError) throw deleteError;
  }

  const slotsWithPlanId = slots.map(slot => {
    // Map recipe name back to the saved recipe ID if recipe_id is missing
    let finalRecipeId = slot.recipe_id;
    
    if (!finalRecipeId && (slot as any).recipe_name) {
      const matchedRecipe = savedRecipes.find(r => r.name === (slot as any).recipe_name);
      if (matchedRecipe) {
        finalRecipeId = matchedRecipe.id;
      }
    }

    const { recipe_name, ...slotData } = slot as any;
    return { 
      ...slotData, 
      meal_plan_id: plan.id,
      recipe_id: finalRecipeId,
      is_locked: slot.is_locked || false,
      manual_entry: slot.manual_entry || null
    };
  });

  const { error: slotsError } = await supabase
    .from('meal_plan_slots')
    .insert(slotsWithPlanId);

  if (slotsError) throw slotsError;

  // 4. Trigger AI ingredient categorization (non-blocking)
  const allIngredients = recipes.flatMap(r => {
    if (Array.isArray(r.ingredients)) {
      return r.ingredients.map((i: any) => {
        if (typeof i === 'string') return i;
        if (typeof i === 'object' && i !== null) {
          return `${i.amount || ''} ${i.item || i.name || ''}`.trim();
        }
        return null;
      }).filter(Boolean);
    }
    return [];
  });

  if (allIngredients.length > 0) {
    // Non-blocking call to categorize ingredients
    supabase.functions.invoke('categorize-ingredients', {
      body: { 
        meal_plan_id: plan.id, 
        ingredients: allIngredients,
        provider: options?.provider,
        model: options?.model
      }
    }).catch(err => console.error('Failed to trigger categorization:', err));
  }

  return plan;
}

/**
 * Fetches all categorized shopping list items for a given meal plan.
 */
export async function getShoppingListItems(mealPlanId: string) {
  if (IS_MOCK) return [];

  const { data, error } = await supabase
    .from('shopping_list_items')
    .select('*')
    .eq('meal_plan_id', mealPlanId)
    .order('category', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Updates a specific meal plan slot (e.g., locking or manual entry).
 */
export async function updateSlot(slotId: string, updates: Partial<MealPlanSlot>) {
  if (IS_MOCK) {
    console.log('Mock mode: Slot update skipped.');
    return;
  }
  
  const { error } = await supabase
    .from('meal_plan_slots')
    .update(updates)
    .eq('id', slotId);

  if (error) throw error;
}

/**
 * Service for interacting with the planner API.
 */
export const plannerService = {
  getMealPlan,
  saveMealPlan,
  getShoppingListItems,
  updateSlot,

  /**
   * Clears a specific meal plan slot.
   */
  async clearSlot(slotId: string) {
    if (IS_MOCK) {
      console.log('Mock mode: Slot clear skipped.');
      return;
    }
    const { error } = await supabase
      .from('meal_plan_slots')
      .update({ recipe_id: null, manual_entry: null })
      .eq('id', slotId);
    if (error) throw error;
  },

  /**
   * Refreshes a single slot using the refresh-slot Edge Function.
   */
  async refreshSlot(
    slotId: string, 
    householdId: string,
    category: string, 
    members: any[], 
    exclusionList: string[],
    options?: { provider?: string; model?: string }
  ) {
    if (IS_MOCK) {
      console.log('Mock mode: Slot refresh skipped.');
      return null;
    }

    // 1. Call AI Refresh Function
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
    const newRecipeData = data.recipe;

    // 2. Insert new recipe
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .insert({
        household_id: householdId,
        name: newRecipeData.name,
        ingredients: newRecipeData.ingredients,
        instructions: newRecipeData.instructions,
        nutrition: {}, // Default empty for now
        prep_time_min: newRecipeData.prep_time_minutes || 0,
        cook_time_min: 0, // AI should ideally provide this
        servings: 4 // Default
      })
      .select()
      .single();

    if (recipeError) throw recipeError;

    // 3. Update Slot
    const { error: slotError } = await supabase
      .from('meal_plan_slots')
      .update({ recipe_id: recipe.id, manual_entry: null })
      .eq('id', slotId);

    if (slotError) throw slotError;

    return { ...recipe, id: recipe.id };
  }
};
