import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithMagicLink: (email: string) => Promise<{ error: any }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isMock = import.meta.env.VITE_USE_MOCK === 'true';

    // Check for initial session
    const getInitialSession = async () => {
      try {
        if (isMock) {
          const mockUser = { email: 'mock@example.com', id: 'mock-user-123' };
          setSession({ user: mockUser } as any);
          setUser(mockUser as any);
          setLoading(false);
          return;
        }

        // Detect if we are in the middle of an auth redirect (PKCE 'code' or implicit hash)
        const searchParams = new URLSearchParams(window.location.search);
        const hasAuthCode = searchParams.has('code');
        const hasAuthHash = window.location.hash.includes('access_token=') || 
                           window.location.hash.includes('type=recovery') ||
                           window.location.hash.includes('type=signup');
        const isProcessingAuth = hasAuthCode || hasAuthHash;

        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        
        // If we have a session OR if there's no auth to process, we're done loading.
        // If there IS auth to process but no session yet, keep loading: onAuthStateChange will trigger soon.
        if (session || !isProcessingAuth) {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
        setLoading(false);
      }
    };

    getInitialSession();

    if (isMock) return;

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithMagicLink = async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const signInWithPassword = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const value = {
    session,
    user,
    loading,
    signInWithMagicLink,
    signInWithPassword,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
