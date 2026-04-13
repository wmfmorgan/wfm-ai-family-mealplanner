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

  it('renders landing and login form', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Welcome Back/i })).toBeDefined();
    expect(screen.getByText(/Enter your email to receive a secure login link/i)).toBeDefined();
    expect(screen.getByPlaceholderText('name@example.com')).toBeDefined();
    expect(screen.getByRole('button', { name: /SEND MAGIC LINK/i })).toBeDefined();
    
    // Check for feature section
    expect(screen.getByText(/Digital Recipe Box/i)).toBeDefined();
    expect(screen.getByText(/Effortless Planning/i)).toBeDefined();
    
    // Check for footer
    expect(screen.getByText('WFM AI', { selector: '.footer-logo' })).toBeDefined();
    expect(screen.getByText(/© 2026 WFM AI Family Meal Planner. All rights reserved./i)).toBeDefined();
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
    expect(screen.queryByLabelText(/PASSWORD/i)).toBeNull();
    expect(screen.getByRole('button', { name: /SEND MAGIC LINK/i })).toBeDefined();

    // Switch to Password mode
    const passwordModeBtn = screen.getByRole('button', { name: /^PASSWORD$/i });
    fireEvent.click(passwordModeBtn);

    expect(screen.getByLabelText(/PASSWORD/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /SIGN IN/i })).toBeDefined();

    // Switch back to Magic Link mode
    const magicModeBtn = screen.getByRole('button', { name: /MAGIC LINK/i });
    fireEvent.click(magicModeBtn);

    expect(screen.queryByLabelText(/PASSWORD/i)).toBeNull();
    expect(screen.getByRole('button', { name: /SEND MAGIC LINK/i })).toBeDefined();
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

    const emailInput = screen.getByPlaceholderText('name@example.com');
    const submitButton = screen.getByRole('button', { name: /SEND MAGIC LINK/i });

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
    fireEvent.click(screen.getByRole('button', { name: /^PASSWORD$/i }));

    const emailInput = screen.getByPlaceholderText('name@example.com');
    const passwordInput = screen.getByLabelText(/PASSWORD/i);
    const submitButton = screen.getByRole('button', { name: /SIGN IN/i });

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

    const emailInput = screen.getByPlaceholderText('name@example.com');
    const submitButton = screen.getByRole('button', { name: /SEND MAGIC LINK/i });

    fireEvent.change(emailInput, { target: { value: 'invalid@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Invalid email/i)).toBeDefined();
    });
  });
});
