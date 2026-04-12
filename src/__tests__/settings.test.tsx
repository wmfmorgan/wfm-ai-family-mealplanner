import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Settings from '../pages/Settings/Settings';
import * as logger from '../lib/ai/logger';

// Mock the logger
vi.mock('../lib/ai/logger', () => ({
  getAiLogs: vi.fn(),
}));

describe('Settings Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(logger.getAiLogs).mockReturnValue([]);
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

  it('renders DebugLog with logs', () => {
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
    vi.mocked(logger.getAiLogs).mockReturnValue(mockLogs);

    render(<Settings />);
    
    expect(screen.getByText('gemini')).toBeInTheDocument();
    expect(screen.getByText('120ms')).toBeInTheDocument();
  });
});
