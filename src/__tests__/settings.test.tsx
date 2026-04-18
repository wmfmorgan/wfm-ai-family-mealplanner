import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Settings from '../pages/Settings/Settings';
import * as logger from '../lib/ai/logger';
import { householdService } from '../lib/services/household';
import { getSpoonacularQuotaStatus } from '../lib/services/spoonacular';

// Mock the logger
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

describe('Settings Component', () => {
  beforeEach(() => {
    localStorage.clear();
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
    vi.mocked(getSpoonacularQuotaStatus).mockResolvedValue({
      daily_limit: 150,
      points_used_today: 0,
      points_left_today: 150,
    });
  });

  it('renders provider selection correctly', () => {
    render(<Settings />);
    expect(screen.getByText('Developer Settings')).toBeInTheDocument();
    expect(screen.getByText('Gemini')).toBeInTheDocument();
    expect(screen.getByText('Grok')).toBeInTheDocument();
  });

  it('switches provider and saves to localStorage', () => {
    render(<Settings />);
    const grokBtn = screen.getByText('Grok');
    
    fireEvent.click(grokBtn);
    
    expect(grokBtn).toHaveClass('active');
    expect(localStorage.getItem('active_ai_provider')).toBe('grok');
  });

  it('renders DebugLog with logs', async () => {
    const mockLogs = [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        provider: 'gemini',
        prompt: 'Test prompt',
        response: JSON.stringify({ message: 'Test response' }),
        latency: 120,
        status_code: 200,
      },
    ];
    vi.mocked(logger.getDisplayAiLogs).mockResolvedValue(mockLogs);

    render(<Settings />);
    
    expect(await screen.findByText('gemini')).toBeInTheDocument();
    expect(screen.getByText('120ms')).toBeInTheDocument();
  });
});
