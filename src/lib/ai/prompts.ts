import { HouseholdMember } from '../services/household';
import { Recipe, MealPlanSlot } from '../services/planner';

export interface GenerationRequest {
  members: HouseholdMember[];
  weekStartDate: string;
  selectedMeals: ('breakfast' | 'lunch' | 'dinner' | 'snack')[];
  leftoverStrategy: boolean;
  lockedSlots?: {
    day_of_week: number;
    meal_type: string;
    recipe_name?: string;
    manual_entry?: string;
  }[];
}

export interface GenerationResponse {
  recipes: Omit<Recipe, 'id' | 'household_id'>[];
  plan: Omit<MealPlanSlot, 'id' | 'meal_plan_id'>[];
}

export function generateMealPlanPrompt({
  members,
  weekStartDate,
  selectedMeals,
  leftoverStrategy,
  lockedSlots = [],
}: GenerationRequest): string {
  const householdContext = members.map(m => {
    const p = m.nutrition_profile;
    return `- ${m.name}: ${p.is_child ? 'Child' : 'Adult'}, Diet: ${p.dietary_choice}, ${p.target_calories}kcal, Allergies: [${p.allergies.join(', ')}], Avoidances: [${p.avoidances.join(', ')}], Skill: ${p.cooking_skill}, Appliances: [${p.appliances.join(', ')}]`;
  }).join('\n');

  const constraintsContext = lockedSlots.length > 0 
    ? `\nLOCKED SLOTS (DO NOT CHANGE THESE, BUILD THE PLAN AROUND THEM):\n${lockedSlots.map(s => `- Day ${s.day_of_week}, ${s.meal_type}: ${s.manual_entry || s.recipe_name}`).join('\n')}`
    : '';

  return `
You are an expert personal chef and nutritionist. Generate a weekly meal plan for the following household starting on ${weekStartDate}.

HOUSEHOLD MEMBERS:
${householdContext}

CONSTRAINTS:
- Selected meal types to include: ${selectedMeals.join(', ')}.
- Leftover strategy: ${leftoverStrategy ? 'Use "Cook once, eat twice" - plan large batches of some meals to be eaten as leftovers later in the week.' : 'Focus on variety, no specific leftover planning.'}
- All recipes MUST respect the combined allergies and avoidances of all household members.
- Cooking difficulty should match the lowest common denominator of skill listed.
- Use only the listed appliances for each member (or common kitchen tools).${constraintsContext}

OUTPUT FORMAT:
You MUST respond with a valid JSON object only, following this exact structure:
{
  "recipes": [
    {
      "name": "Recipe Name",
      "ingredients": ["1 cup item", "2tbsp item"],
      "instructions": ["Step 1", "Step 2"],
      "nutrition": { "calories": 500, "protein": 30, "carbs": 50, "fat": 20 },
      "prep_time_min": 15,
      "cook_time_min": 30,
      "servings": 4
    }
  ],
  "plan": [
    {
      "day_of_week": 0,
      "meal_type": "dinner",
      "recipe_name": "Recipe Name",
      "is_locked": false
    }
  ]
}

Note: 
- day_of_week is 0 (Sunday) to 6 (Saturday).
- recipe_name in "plan" must exactly match a name in the "recipes" array, OR one of the LOCKED SLOTS.
- If a slot is locked, you MUST include it in the "plan" array with "is_locked": true and its original "recipe_name".
- Ensure enough recipes are generated to cover the requested meal types for the full 7 days.
- If leftover strategy is on, use the same recipe_name for different days/slots.
`;
}
