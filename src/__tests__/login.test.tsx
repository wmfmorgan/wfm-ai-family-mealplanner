import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Login from '../pages/Auth/Login';
import { AuthProvider } from '../contexts/AuthContext';
import { MemoryRouter } from 'react-router-dom';

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithOtp: vi.fn(),
    },
  },
}));

import { supabase } from '../lib/supabase';

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Cookbook')).toBeDefined();
    expect(screen.getByPlaceholderText('you@example.com')).toBeDefined();
    expect(screen.getByRole('button', { name: /Send Magic Link/i })).toBeDefined();
  });

  it('calls signInWithMagicLink on form submission', async () => {
    (supabase.auth.signInWithOtp as any).mockResolvedValue({ error: null });

    render(
      <MemoryRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText('you@example.com');
    const submitButton = screen.getByRole('button', { name: /Send Magic Link/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        options: {
          emailRedirectTo: expect.any(String),
        },
      });
    });

    expect(screen.getByText(/Check your email for the magic link!/i)).toBeDefined();
  });

  it('shows error message on failure', async () => {
    (supabase.auth.signInWithOtp as any).mockResolvedValue({ 
      error: { message: 'Invalid email' } 
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText('you@example.com');
    const submitButton = screen.getByRole('button', { name: /Send Magic Link/i });

    fireEvent.change(emailInput, { target: { value: 'invalid@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Invalid email/i)).toBeDefined();
    });
  });
});
