import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Auth.css';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginMode, setLoginMode] = useState<'magic' | 'password'>('magic');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { signInWithMagicLink, signInWithPassword, session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) {
      navigate('/planner');
    }
  }, [session, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    let result;
    if (loginMode === 'magic') {
      result = await signInWithMagicLink(email);
      if (!result.error) {
        setMessage({ type: 'success', text: 'Check your email for the magic link!' });
      }
    } else {
      result = await signInWithPassword(email, password);
    }

    if (result?.error) {
      setMessage({ type: 'error', text: result.error.message || 'An error occurred. Please try again.' });
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card card">
        <h1 className="auth-title">Cookbook</h1>
        <p className="auth-subtitle">Sign in to your family meal planner</p>
        
        <div className="auth-form-wrapper">
          <div className="auth-mode-toggle">
            <button 
              className={`mode-btn ${loginMode === 'magic' ? 'active' : ''}`}
              onClick={() => setLoginMode('magic')}
            >
              Magic Link
            </button>
            <button 
              className={`mode-btn ${loginMode === 'password' ? 'active' : ''}`}
              onClick={() => setLoginMode('password')}
            >
              Password
            </button>
          </div>

          <form onSubmit={handleLogin} className="auth-form flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="auth-label">Email address</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full"
              />
            </div>

            {loginMode === 'password' && (
              <div className="flex flex-col gap-2">
                <label htmlFor="password" title="Password" className="auth-label">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full"
                />
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-4"
            >
              {loading 
                ? (loginMode === 'magic' ? 'Sending link...' : 'Signing in...') 
                : (loginMode === 'magic' ? 'Send Magic Link' : 'Sign In')
              }
            </button>
          </form>

          {message && (
            <div className={`auth-message ${message.type} mt-4`}>
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
