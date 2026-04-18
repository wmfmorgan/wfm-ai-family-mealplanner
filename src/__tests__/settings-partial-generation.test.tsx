import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Settings from '../pages/Settings/Settings';
import type { GenerationPreferences } from '../lib/services/household';
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

const basePreferences: GenerationPreferences = {
  selected_days: [0, 1],
  selected_meals: ['breakfast', 'dinner'],
  matrix: {
    0: ['breakfast', 'dinner'],
    1: ['dinner'],
  },
};

describe('Settings partial generation preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(logger.getDisplayAiLogs).mockResolvedValue([]);
    vi.mocked(householdService.getMyHouseholdId).mockResolvedValue('household-1');
    vi.mocked(householdService.getGenerationPreferences).mockResolvedValue(basePreferences);
    vi.mocked(householdService.updateGenerationPreferences).mockResolvedValue();
    vi.mocked(getSpoonacularQuotaStatus).mockResolvedValue({
      daily_limit: 50,
      points_used_today: 12,
      points_left_today: 38,
    });
  });

  it('renders the Meal Generation Preferences section with day and meal labels', async () => {
    render(<Settings />);

    expect(await screen.findByRole('heading', { name: 'Meal Generation Preferences' })).toBeInTheDocument();
    for (const day of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      expect(screen.getByText(day)).toBeInTheDocument();
    }
    for (const meal of ['Breakfast', 'Lunch', 'Dinner']) {
      expect(screen.getByText(meal)).toBeInTheDocument();
    }
  });

  it('persists a sparse matrix edit without mutating other selected days and derives summaries from the matrix', async () => {
    render(<Settings />);

    const mondayDinner = await screen.findByLabelText('Dinner Mon');
    const sundayDinner = screen.getByLabelText('Dinner Sun');

    expect(mondayDinner).toBeChecked();
    expect(sundayDinner).toBeChecked();

    fireEvent.click(mondayDinner);

    await waitFor(() => {
      expect(householdService.updateGenerationPreferences).toHaveBeenCalledTimes(1);
    });

    expect(sundayDinner).toBeChecked();
    expect(mondayDinner).not.toBeChecked();

    expect(householdService.updateGenerationPreferences).toHaveBeenCalledWith('household-1', {
      matrix: {
        0: ['breakfast', 'dinner'],
        1: [],
      },
      selected_days: [0],
      selected_meals: ['breakfast', 'dinner'],
    });
  });
});
