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
      signInWithPassword: vi.fn(),
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

    expect(screen.getByRole('heading', { name: /Cookbook/i })).toBeDefined();
    expect(screen.getByText(/Sign in to your family meal planner/i)).toBeDefined();
    expect(screen.getByPlaceholderText('you@example.com')).toBeDefined();
    expect(screen.getByRole('button', { name: /Send Magic Link/i })).toBeDefined();
  });

  it('switches between magic link and password mode', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </MemoryRouter>
    );

    // Initial state: Magic Link mode
    expect(screen.queryByLabelText(/Password/i)).toBeNull();
    expect(screen.getByRole('button', { name: /Send Magic Link/i })).toBeDefined();

    // Switch to Password mode
    const passwordModeBtn = screen.getByRole('button', { name: /Password/i });
    fireEvent.click(passwordModeBtn);

    expect(screen.getByLabelText(/Password/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeDefined();

    // Switch back to Magic Link mode
    const magicModeBtn = screen.getByRole('button', { name: /Magic Link/i });
    fireEvent.click(magicModeBtn);

    expect(screen.queryByLabelText(/Password/i)).toBeNull();
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

  it('calls signInWithPassword on form submission', async () => {
    (supabase.auth.signInWithPassword as any).mockResolvedValue({ error: null });

    render(
      <MemoryRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </MemoryRouter>
    );

    // Switch to password mode
    fireEvent.click(screen.getByRole('button', { name: /Password/i }));

    const emailInput = screen.getByPlaceholderText('you@example.com');
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitButton = screen.getByRole('button', { name: /Sign In/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
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
