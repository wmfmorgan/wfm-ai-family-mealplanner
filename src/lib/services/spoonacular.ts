import type { HouseholdMember } from './household';
import { supabase } from '../supabase';

type GenerationMatrix = Record<string, Array<'breakfast' | 'lunch' | 'dinner'>>;

export type QuotaStatus = {
  daily_limit: number;
  points_used_today: number;
  points_left_today: number;
};

type RecipeSearchResponse = {
  quota_status?: {
    daily_limit?: number;
    points_used_today?: number;
    points_left_today?: number;
    threshold_points?: number;
    threshold_reached?: boolean;
  };
} & Record<string, unknown>;

const DEFAULT_QUOTA_STATUS: QuotaStatus = {
  daily_limit: 50,
  points_used_today: 0,
  points_left_today: 50,
};

const QUOTA_STORAGE_KEY_PREFIX = 'spoonacular_quota_status:';

function getQuotaStorageKey(householdId: string): string {
  return `${QUOTA_STORAGE_KEY_PREFIX}${householdId}`;
}

function normalizeQuotaStatus(input: Partial<QuotaStatus> | null | undefined): QuotaStatus {
  // Always use the frontend-configured daily limit — DB rows may have stale values
  // written by the edge function when SPOONACULAR_DAILY_LIMIT was set differently.
  const dailyLimit = DEFAULT_QUOTA_STATUS.daily_limit;
  const pointsUsedToday = typeof input?.points_used_today === 'number'
    ? input.points_used_today
    : DEFAULT_QUOTA_STATUS.points_used_today;
  const pointsLeftToday = typeof input?.points_left_today === 'number'
    ? Math.min(input.points_left_today, dailyLimit)
    : Math.max(dailyLimit - pointsUsedToday, 0);

  return {
    daily_limit: dailyLimit,
    points_used_today: pointsUsedToday,
    points_left_today: pointsLeftToday,
  };
}

function readStoredQuotaStatus(householdId: string): QuotaStatus | null {
  try {
    const raw = localStorage.getItem(getQuotaStorageKey(householdId));
    if (!raw) {
      return null;
    }

    return normalizeQuotaStatus(JSON.parse(raw) as Partial<QuotaStatus>);
  } catch (error) {
    console.error('Failed to read stored Spoonacular quota status:', error);
    return null;
  }
}

function storeQuotaStatus(householdId: string, quotaStatus: Partial<QuotaStatus> | null | undefined) {
  const normalized = normalizeQuotaStatus(quotaStatus);
  localStorage.setItem(getQuotaStorageKey(householdId), JSON.stringify(normalized));
  return normalized;
}

export async function invokeSelectMeals(payload: {
  household_id: string;
  members: HouseholdMember[];
  week_start_date: string;
  matrix?: GenerationMatrix;
  leftover_strategy?: boolean;
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

  const typedData = data as RecipeSearchResponse;
  if (typedData?.quota_status) {
    storeQuotaStatus(payload.household_id, typedData.quota_status);
  }

  return typedData;
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

  if (error) {
    const fallback = readStoredQuotaStatus(householdId);
    if (fallback) {
      return fallback;
    }
    throw error;
  }

  const latest = data?.[0];
  if (!latest) {
    return readStoredQuotaStatus(householdId) ?? DEFAULT_QUOTA_STATUS;
  }

  return storeQuotaStatus(householdId, latest);
}
