import { supabase } from '../supabase';
import { format, startOfWeek } from 'date-fns';

export interface Recipe {
  id?: string;
  household_id: string;
  name: string;
  ingredients: any;
  instructions: any;
  nutrition: any;
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
  slots: Omit<MealPlanSlot, 'meal_plan_id'>[]
) {
  if (IS_MOCK) {
    console.log('Mock mode: Meal plan save skipped.');
    return { id: 'mock-plan-id', household_id: householdId, week_start_date: weekStartDate, status: 'draft' };
  }
  
  // 1. Ensure recipes exist and get their IDs
  const savedRecipes = [];
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

  // 3. Clear existing slots and insert new ones
  const { error: deleteError } = await supabase
    .from('meal_plan_slots')
    .delete()
    .eq('meal_plan_id', plan.id);

  if (deleteError) throw deleteError;

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

  return plan;
}

/**
 * Fetches all recipes belonging to a household.
 */
export async function getRecipes(householdId: string) {
  if (IS_MOCK) return []; // No mock recipes stored yet
  
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Service for interacting with the planner API.
 */
export const plannerService = {
  getMealPlan,
  saveMealPlan,
  getRecipes,

  /**
   * Updates a specific meal plan slot (e.g., locking or manual entry).
   */
  updateSlot: async (slotId: string, updates: Partial<MealPlanSlot>) => {
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
};
