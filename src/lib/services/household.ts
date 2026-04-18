import { supabase } from '../supabase';

export interface NutritionProfile {
  target_calories: number;
  macro_targets: {
    protein_pct: number;
    carbs_pct: number;
    fat_pct: number;
  };
  dietary_choice: string;
  allergies: string[];
  avoidances: string[];
  appliances: string[];
  cooking_skill: string;
  is_child: boolean;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  name: string;
  nutrition_profile: NutritionProfile;
  is_owner: boolean;
  is_active: boolean;
  created_at: string;
}

export type GenerationMealType = 'breakfast' | 'lunch' | 'dinner';

export interface GenerationPreferences {
  selected_days: number[];
  selected_meals: GenerationMealType[];
  matrix: Record<string, GenerationMealType[]>;
}

export const DEFAULT_NUTRITION_PROFILE: NutritionProfile = {
  target_calories: 2000,
  macro_targets: {
    protein_pct: 30,
    carbs_pct: 40,
    fat_pct: 30
  },
  dietary_choice: 'Standard',
  allergies: [],
  avoidances: [],
  appliances: ['oven', 'stove'],
  cooking_skill: 'intermediate',
  is_child: false
};

const IS_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const MOCK_STORAGE_KEY = 'wfm_mock_household_members';
const MOCK_GENERATION_PREFERENCES_KEY = 'wfm_mock_generation_preferences';

const DEFAULT_GENERATION_PREFERENCES: GenerationPreferences = {
  selected_days: [0, 1, 2, 3, 4, 5, 6],
  selected_meals: ['breakfast', 'lunch', 'dinner'],
  matrix: {
    0: ['breakfast', 'lunch', 'dinner'],
    1: ['breakfast', 'lunch', 'dinner'],
    2: ['breakfast', 'lunch', 'dinner'],
    3: ['breakfast', 'lunch', 'dinner'],
    4: ['breakfast', 'lunch', 'dinner'],
    5: ['breakfast', 'lunch', 'dinner'],
    6: ['breakfast', 'lunch', 'dinner']
  }
};

const sanitizeGenerationPreferences = (value: Partial<GenerationPreferences> | null | undefined): GenerationPreferences => {
  const matrixEntries = Object.entries(value?.matrix ?? {})
    .filter(([day]) => /^\d+$/.test(day))
    .map(([day, meals]) => {
      const normalizedMeals = Array.isArray(meals)
        ? meals.filter((meal): meal is GenerationMealType =>
          meal === 'breakfast' || meal === 'lunch' || meal === 'dinner')
        : [];

      return [day, Array.from(new Set(normalizedMeals))];
    });

  const matrix = Object.fromEntries(matrixEntries);
  const selectedDays = Array.from(new Set(
    (Array.isArray(value?.selected_days) ? value?.selected_days : Object.keys(matrix).map(Number))
      .filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6)
  )).sort((a, b) => a - b);

  const selectedMealsSource = Array.isArray(value?.selected_meals)
    ? value?.selected_meals
    : Array.from(new Set(Object.values(matrix).flat()));
  const selectedMeals = Array.from(new Set(
    selectedMealsSource.filter((meal): meal is GenerationMealType =>
      meal === 'breakfast' || meal === 'lunch' || meal === 'dinner')
  ));

  if (Object.keys(matrix).length === 0) {
    return DEFAULT_GENERATION_PREFERENCES;
  }

  return {
    selected_days: selectedDays,
    selected_meals: selectedMeals,
    matrix
  };
};

const getMockGenerationPreferences = (): GenerationPreferences => {
  const stored = localStorage.getItem(MOCK_GENERATION_PREFERENCES_KEY);
  if (!stored) {
    return DEFAULT_GENERATION_PREFERENCES;
  }

  return sanitizeGenerationPreferences(JSON.parse(stored) as GenerationPreferences);
};

export async function getGenerationPreferences(householdId: string): Promise<GenerationPreferences> {
  if (IS_MOCK) {
    return getMockGenerationPreferences();
  }

  const { data, error } = await supabase
    .from('households')
    .select('generation_preferences')
    .eq('id', householdId)
    .single();

  if (error) throw error;

  return sanitizeGenerationPreferences(
    (data?.generation_preferences as GenerationPreferences | null | undefined) ?? null
  );
}

export async function updateGenerationPreferences(
  householdId: string,
  prefs: GenerationPreferences
): Promise<void> {
  const nextPrefs = sanitizeGenerationPreferences(prefs);

  if (IS_MOCK) {
    localStorage.setItem(MOCK_GENERATION_PREFERENCES_KEY, JSON.stringify(nextPrefs));
    return;
  }

  const { error } = await supabase
    .from('households')
    .update({ generation_preferences: nextPrefs })
    .eq('id', householdId);

  if (error) throw error;
}

const getMockData = (): HouseholdMember[] => {
  const stored = localStorage.getItem(MOCK_STORAGE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored) as HouseholdMember[];
    // Ensure dietary_choice exists for all members
    return parsed.map(m => ({
      ...m,
      nutrition_profile: {
        ...DEFAULT_NUTRITION_PROFILE,
        ...m.nutrition_profile,
        dietary_choice: m.nutrition_profile.dietary_choice || 'Standard'
      }
    }));
  }
  const initial = [{
    id: 'mock-member-1',
    household_id: 'mock-household-1',
    name: 'Me (Mock)',
    nutrition_profile: DEFAULT_NUTRITION_PROFILE,
    is_owner: true,
    is_active: true,
    created_at: new Date().toISOString()
  }];
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(initial));
  return initial;
};

const saveMockData = (members: HouseholdMember[]) => {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(members));
};

export const householdService = {
  async getMembers(householdId: string): Promise<HouseholdMember[]> {
    if (IS_MOCK) return getMockData();
    const { data, error } = await supabase
      .from('household_members')
      .select('*')
      .eq('household_id', householdId)
      .order('is_owner', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data as HouseholdMember[];
  },

  async getMyHouseholdId(): Promise<string | null> {
    if (IS_MOCK) return 'mock-household-1';
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('households')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching household:', error);
      return null;
    }
    return data.id;
  },

  async addMember(householdId: string, name: string, profile: NutritionProfile): Promise<HouseholdMember> {
    if (IS_MOCK) {
      const members = getMockData();
      const newMember = {
        id: `mock-member-${Date.now()}`,
        household_id: householdId,
        name,
        nutrition_profile: profile,
        is_owner: false,
        is_active: true,
        created_at: new Date().toISOString()
      };
      saveMockData([...members, newMember]);
      return newMember;
    }
    const { data, error } = await supabase
      .from('household_members')
      .insert({
        household_id: householdId,
        name,
        nutrition_profile: profile,
        is_owner: false,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return data as HouseholdMember;
  },

  async updateMember(memberId: string, updates: Partial<HouseholdMember>): Promise<void> {
    if (IS_MOCK) {
      const members = getMockData();
      const updated = members.map(m => m.id === memberId ? { ...m, ...updates } : m);
      saveMockData(updated);
      return;
    }
    const { error } = await supabase
      .from('household_members')
      .update(updates)
      .eq('id', memberId);

    if (error) throw error;
  },

  async deleteMember(memberId: string): Promise<void> {
    if (IS_MOCK) {
      const members = getMockData();
      const member = members.find(m => m.id === memberId);
      if (member?.is_owner) {
        throw new Error('Cannot delete household owner.');
      }
      const filtered = members.filter(m => m.id !== memberId);
      saveMockData(filtered);
      return;
    }

    // Safety check for owner deletion in real Supabase too (though RLS should handle it)
    const { data: member } = await supabase
      .from('household_members')
      .select('is_owner')
      .eq('id', memberId)
      .single();

    if (member?.is_owner) {
      throw new Error('Cannot delete household owner.');
    }

    const { error } = await supabase
      .from('household_members')
      .delete()
      .eq('id', memberId);

    if (error) throw error;
  },

  getGenerationPreferences,
  updateGenerationPreferences
};

export const NUTRITION_PRESETS: Record<string, Partial<NutritionProfile>> = {
  'Active Adult': {
    target_calories: 2500,
    macro_targets: { protein_pct: 25, carbs_pct: 50, fat_pct: 25 },
    dietary_choice: 'Standard',
    is_child: false
  },
  'Growing Toddler': {
    target_calories: 1200,
    macro_targets: { protein_pct: 20, carbs_pct: 45, fat_pct: 35 },
    dietary_choice: 'Standard',
    is_child: true
  },
  'Healthy Aging': {
    target_calories: 1800,
    macro_targets: { protein_pct: 30, carbs_pct: 40, fat_pct: 30 },
    dietary_choice: 'Standard',
    is_child: false
  },
  'Keto Focus': {
    target_calories: 2000,
    macro_targets: { protein_pct: 25, carbs_pct: 5, fat_pct: 70 },
    dietary_choice: 'Keto',
    is_child: false
  }
};
