import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MealPlanner from '../pages/MealPlanner/MealPlanner';
import { plannerService } from '../lib/services/planner';
import { householdService, DEFAULT_NUTRITION_PROFILE } from '../lib/services/household';
import { invokeRecipeSearch, invokeSelectMeals } from '../lib/services/spoonacular';
import { supabase } from '../lib/supabase';

const mockMember = { 
  id: 'm1', 
  name: 'Alice', 
  household_id: 'h123',
  nutrition_profile: DEFAULT_NUTRITION_PROFILE,
  is_owner: true,
  is_active: true,
  created_at: new Date().toISOString()
};

vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock('../lib/services/planner', () => ({
  plannerService: {
    getMealPlan: vi.fn(),
    updateSlot: vi.fn(),
    saveMealPlan: vi.fn(),
    clearSlot: vi.fn(),
  }
}));

vi.mock('../lib/services/household', () => ({
  householdService: {
    getMyHouseholdId: vi.fn(),
    getMembers: vi.fn(),
    getGenerationPreferences: vi.fn(),
  },
  DEFAULT_NUTRITION_PROFILE: {
    target_calories: 2000,
    macro_targets: { protein_pct: 30, carbs_pct: 40, fat_pct: 30 },
    dietary_choice: 'Standard',
    allergies: [],
    avoidances: [],
    appliances: ['oven', 'stove'],
    cooking_skill: 'intermediate',
    is_child: false
  }
}));

vi.mock('../lib/services/spoonacular', () => ({
  invokeSelectMeals: vi.fn(),
  invokeRecipeSearch: vi.fn(),
}));

describe('MealPlanner - Optimistic UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('active_ai_provider', 'grok');
    localStorage.setItem('active_ai_model', 'grok-3');

    vi.mocked(householdService.getMyHouseholdId).mockResolvedValue('h123');
    vi.mocked(householdService.getMembers).mockResolvedValue([mockMember]);
    vi.mocked(householdService.getGenerationPreferences).mockResolvedValue({
      selected_days: [0],
      selected_meals: ['dinner'],
      matrix: {
        0: ['dinner'],
      },
    });
    vi.mocked(plannerService.getMealPlan).mockResolvedValue({ slots: [] });
  });

  it('toggles lock visually even if slot has no ID', async () => {
    render(<MealPlanner />);

    await waitFor(() => {
      expect(screen.queryByText(/Opening your family cookbook/i)).not.toBeInTheDocument();
    });

    const lockButtons = screen.getAllByRole('button', { name: /lock/i });
    
    expect(lockButtons[0].textContent).toBe('🔓');

    fireEvent.click(lockButtons[0]);

    expect(lockButtons[0].textContent).toBe('🔒');
    
    expect(plannerService.updateSlot).not.toHaveBeenCalled();
  });

  it('updates manual entry visually even if slot has no ID', async () => {
    render(<MealPlanner />);

    await waitFor(() => {
      expect(screen.queryByText(/Opening your family cookbook/i)).not.toBeInTheDocument();
    });

    const addMealText = screen.getAllByText(/Add meal.../i)[0];
    fireEvent.click(addMealText);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Pizza' } });
    fireEvent.blur(input);

    expect(screen.getByText('Pizza')).toBeInTheDocument();
    
    expect(plannerService.updateSlot).not.toHaveBeenCalled();
  });

  it('opens recipe detail drawer when a recipe slot is clicked', async () => {
    const mockRecipe = {
      name: 'Signature Soup',
      ingredients: ['Water', 'Veggies'],
      instructions: ['Boil'],
      prep_time_min: 5,
      cook_time_min: 10,
      servings: 2
    };

    vi.mocked(plannerService.getMealPlan).mockResolvedValue({ 
      slots: [{
        id: 's1',
        day_of_week: 0,
        meal_type: 'dinner',
        is_locked: true,
        recipe: mockRecipe
      }]
    });

    render(<MealPlanner />);

    await waitFor(() => {
      expect(screen.queryByText(/Opening your family cookbook/i)).not.toBeInTheDocument();
    });

    const recipeSlot = screen.getByText('Signature Soup');
    fireEvent.click(recipeSlot);

    expect(screen.getByText('Signature Soup', { selector: '.recipe-title' })).toBeInTheDocument();
    expect(screen.getByText('Prep: 5m')).toBeInTheDocument();
    expect(screen.getByText('Veggies')).toBeInTheDocument();
    expect(screen.getByText('Boil')).toBeInTheDocument();

    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText('Signature Soup', { selector: '.recipe-title' })).not.toBeInTheDocument();
    });
  });

  it('uses select-meals then recipe-search and preserves grounded metadata when saving', async () => {
    vi.mocked(invokeSelectMeals).mockResolvedValue({
      week_start_date: '2026-04-19',
      matrix: { 0: ['dinner'] },
      directives: [
        { day: 0, meal_type: 'dinner', query: 'salmon bowl' },
      ],
    });
    vi.mocked(invokeRecipeSearch).mockResolvedValue({
      week_start_date: '2026-04-19',
      quota_status: {
        daily_limit: 150,
        points_used_today: 5,
        points_left_today: 145,
      },
      slots: [
        {
          day: 0,
          meal_type: 'dinner',
          recipe: {
            name: 'Salmon Bowl',
            description: 'Grounded recipe from Spoonacular',
            ingredients: [{ name: 'Salmon' }],
            instructions: ['Cook salmon'],
            nutrition: { calories: 550 },
            prep_time_min: 10,
            cook_time_min: 20,
            servings: 4,
            source_provider: 'spoonacular',
            source_id: 'spoon-123',
            image_url: 'https://example.com/salmon.jpg',
          },
          shopping_items: [
            {
              original_string: '1 salmon fillet',
              category: 'Seafood',
              aisle: 'Seafood',
              amount: 1,
              unit: 'fillet',
            },
          ],
        },
      ],
    });

    render(<MealPlanner />);

    await waitFor(() => {
      expect(screen.queryByText(/Opening your family cookbook/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /generate weekly plan/i }));

    await waitFor(() => {
      expect(invokeSelectMeals).toHaveBeenCalledWith({
        household_id: 'h123',
        members: [mockMember],
        week_start_date: expect.any(String),
        matrix: { 0: ['dinner'] },
      });
    });

    expect(invokeRecipeSearch).toHaveBeenCalledWith({
      household_id: 'h123',
      week_start_date: expect.any(String),
      directives: [{ day: 0, meal_type: 'dinner', query: 'salmon bowl' }],
    });

    expect(plannerService.saveMealPlan).toHaveBeenCalledWith(
      'h123',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Salmon Bowl',
          source_provider: 'spoonacular',
          source_id: 'spoon-123',
          image_url: 'https://example.com/salmon.jpg',
        }),
      ]),
      expect.arrayContaining([
        expect.objectContaining({
          day_of_week: 0,
          meal_type: 'dinner',
          recipe_name: 'Salmon Bowl',
        }),
      ]),
      { provider: 'grok', model: 'grok-3' }
    );

    expect(supabase.functions.invoke).not.toHaveBeenCalledWith('generate-plan', expect.anything());
  });
});
