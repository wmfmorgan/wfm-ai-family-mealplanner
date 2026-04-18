import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Settings from '../pages/Settings/Settings';
import * as logger from '../lib/ai/logger';
import { householdService } from '../lib/services/household';
import { getSpoonacularQuotaStatus } from '../lib/services/spoonacular';

vi.mock('../lib/ai/logger', () => ({
  getDisplayAiLogs: vi.fn(),
}));

vi.mock('../lib/services/household', () => ({
  householdService: {
    getMyHouseholdId: vi.fn(),
    getGenerationPreferences: vi.fn(),
    updateGenerationPreferences: vi.fn(),
  },
}));

vi.mock('../lib/services/spoonacular', () => ({
  getSpoonacularQuotaStatus: vi.fn(),
}));

describe('Settings Spoonacular quota surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(logger.getDisplayAiLogs).mockResolvedValue([]);
    vi.mocked(householdService.getMyHouseholdId).mockResolvedValue('household-1');
    vi.mocked(householdService.getGenerationPreferences).mockResolvedValue({
      selected_days: [0, 1, 2, 3, 4, 5, 6],
      selected_meals: ['breakfast', 'lunch', 'dinner'],
      matrix: {
        0: ['breakfast', 'lunch', 'dinner'],
        1: ['breakfast', 'lunch', 'dinner'],
        2: ['breakfast', 'lunch', 'dinner'],
        3: ['breakfast', 'lunch', 'dinner'],
        4: ['breakfast', 'lunch', 'dinner'],
        5: ['breakfast', 'lunch', 'dinner'],
        6: ['breakfast', 'lunch', 'dinner'],
      },
    });
  });

  it('renders Spoonacular quota usage text', async () => {
    vi.mocked(getSpoonacularQuotaStatus).mockResolvedValue({
      daily_limit: 50,
      points_used_today: 44,
      points_left_today: 6,
    });

    render(<Settings />);

    expect(await screen.findByText('Spoonacular quota')).toBeInTheDocument();
    expect(screen.getByText('44 / 50')).toBeInTheDocument();
  });

  it('renders the empty-log default quota state', async () => {
    vi.mocked(getSpoonacularQuotaStatus).mockResolvedValue({
      daily_limit: 50,
      points_used_today: 0,
      points_left_today: 50,
    });

    render(<Settings />);

    expect(await screen.findByText('Spoonacular quota')).toBeInTheDocument();
    expect(screen.getByText('0 / 50')).toBeInTheDocument();
  });
});
