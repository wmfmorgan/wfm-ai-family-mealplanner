import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(),
  },
}));

import { supabase } from '../lib/supabase';
import { getSpoonacularQuotaStatus, invokeRecipeSearch } from '../lib/services/spoonacular';

describe('spoonacular service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('stores latest quota status from recipe-search responses', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        week_start_date: '2026-04-19',
        quota_status: {
          daily_limit: 50,
          points_used_today: 12,
          threshold_points: 40,
          threshold_reached: false,
        },
        slots: [],
      },
      error: null,
    } as never);

    await invokeRecipeSearch({
      household_id: 'household-1',
      week_start_date: '2026-04-19',
      directives: [],
    });

    expect(localStorage.getItem('spoonacular_quota_status:household-1')).toBe(
      JSON.stringify({
        daily_limit: 50,
        points_used_today: 12,
        points_left_today: 38,
      }),
    );
  });

  it('falls back to stored quota status when no DB row exists yet', async () => {
    localStorage.setItem('spoonacular_quota_status:household-1', JSON.stringify({
      daily_limit: 50,
      points_used_today: 12,
      points_left_today: 38,
    }));

    const limitMock = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const orderMock = vi.fn(() => ({ limit: limitMock }));
    const gteMock = vi.fn(() => ({ order: orderMock }));
    const eqMock = vi.fn(() => ({ gte: gteMock }));
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({ eq: eqMock })),
    } as never);

    await expect(getSpoonacularQuotaStatus('household-1')).resolves.toEqual({
      daily_limit: 50,
      points_used_today: 12,
      points_left_today: 38,
    });
  });
});
