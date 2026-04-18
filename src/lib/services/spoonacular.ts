import type { HouseholdMember } from './household';
import { supabase } from '../supabase';

type GenerationMatrix = Record<string, Array<'breakfast' | 'lunch' | 'dinner'>>;

type QuotaStatus = {
  daily_limit: number;
  points_used_today: number;
  points_left_today: number;
};

const DEFAULT_QUOTA_STATUS: QuotaStatus = {
  daily_limit: 150,
  points_used_today: 0,
  points_left_today: 150
};

export async function invokeSelectMeals(payload: {
  household_id: string;
  members: HouseholdMember[];
  week_start_date: string;
  matrix?: GenerationMatrix;
}) {
  const { data, error } = await supabase.functions.invoke('select-meals', { body: payload });
  if (error) throw error;
  return data;
}

export async function invokeRecipeSearch(payload: {
  household_id: string;
  week_start_date: string;
  directives: unknown[];
}) {
  const { data, error } = await supabase.functions.invoke('recipe-search', { body: payload });
  if (error) throw error;
  return data;
}

export async function getSpoonacularQuotaStatus(householdId: string): Promise<QuotaStatus> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('spoonacular_usage_log')
    .select('daily_limit, points_used_today, points_left_today')
    .eq('household_id', householdId)
    .gte('created_at', startOfToday.toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;

  const latest = data?.[0];
  if (!latest) {
    return DEFAULT_QUOTA_STATUS;
  }

  return {
    daily_limit: latest.daily_limit ?? DEFAULT_QUOTA_STATUS.daily_limit,
    points_used_today: latest.points_used_today ?? DEFAULT_QUOTA_STATUS.points_used_today,
    points_left_today: latest.points_left_today ?? DEFAULT_QUOTA_STATUS.points_left_today
  };
}
