import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ProtectedRoute } from '../components/Auth/ProtectedRoute';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithOtp: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

import { supabase } from '../lib/supabase';

const TestComponent = () => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  return <div>{user ? `User: ${user.email}` : 'No User'}</div>;
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_USE_MOCK', 'false');
  });

  it('provides initial session state', async () => {
    const mockSession = { user: { email: 'test@example.com' } };
    (supabase.auth.getSession as any).mockResolvedValue({ data: { session: mockSession } });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByText('Loading...')).toBeDefined();
    await waitFor(() => expect(screen.getByText('User: test@example.com')).toBeDefined());
  });

  it('updates state on auth change', async () => {
    (supabase.auth.getSession as any).mockResolvedValue({ data: { session: null } });
    
    let authChangeCallback: any;
    (supabase.auth.onAuthStateChange as any).mockImplementation((callback: any) => {
      authChangeCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('No User')).toBeDefined());

    // Simulate login
    const mockSession = { user: { email: 'logged-in@example.com' } };
    authChangeCallback('SIGNED_IN', mockSession);

    await waitFor(() => expect(screen.getByText('User: logged-in@example.com')).toBeDefined());
  });
});

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_USE_MOCK', 'false');
  });

  it('redirects to login when not authenticated', async () => {
    (supabase.auth.getSession as any).mockResolvedValue({ data: { session: null } });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route 
              path="/protected" 
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              } 
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Login Page')).toBeDefined());
  });

  it('renders children when authenticated', async () => {
    const mockSession = { user: { email: 'test@example.com' } };
    (supabase.auth.getSession as any).mockResolvedValue({ data: { session: mockSession } });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route 
              path="/protected" 
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              } 
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Protected Content')).toBeDefined());
  });
});
