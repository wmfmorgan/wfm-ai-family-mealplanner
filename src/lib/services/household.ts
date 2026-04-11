import { supabase } from '../supabase';

export interface NutritionProfile {
  target_calories: number;
  macro_targets: {
    protein_pct: number;
    carbs_pct: number;
    fat_pct: number;
  };
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

export const householdService = {
  async getMembers(householdId: string): Promise<HouseholdMember[]> {
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
    const { error } = await supabase
      .from('household_members')
      .update(updates)
      .eq('id', memberId);

    if (error) throw error;
  },

  async deleteMember(memberId: string): Promise<void> {
    const { error } = await supabase
      .from('household_members')
      .delete()
      .eq('id', memberId);

    if (error) throw error;
  }
};

export const DEFAULT_NUTRITION_PROFILE: NutritionProfile = {
  target_calories: 2000,
  macro_targets: {
    protein_pct: 30,
    carbs_pct: 40,
    fat_pct: 30
  },
  allergies: [],
  avoidances: [],
  appliances: ['oven', 'stove'],
  cooking_skill: 'intermediate',
  is_child: false
};

export const NUTRITION_PRESETS: Record<string, Partial<NutritionProfile>> = {
  'Active Adult': {
    target_calories: 2500,
    macro_targets: { protein_pct: 25, carbs_pct: 50, fat_pct: 25 },
    is_child: false
  },
  'Growing Toddler': {
    target_calories: 1200,
    macro_targets: { protein_pct: 20, carbs_pct: 45, fat_pct: 35 },
    is_child: true
  },
  'Healthy Aging': {
    target_calories: 1800,
    macro_targets: { protein_pct: 30, carbs_pct: 40, fat_pct: 30 },
    is_child: false
  },
  'Keto Focus': {
    target_calories: 2000,
    macro_targets: { protein_pct: 25, carbs_pct: 5, fat_pct: 70 },
    is_child: false
  }
};
