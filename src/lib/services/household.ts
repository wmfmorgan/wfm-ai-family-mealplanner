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
  }
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
