import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './Auth.css';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { signInWithMagicLink } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await signInWithMagicLink(email);

    if (error) {
      setMessage({ type: 'error', text: error.message || 'An error occurred. Please try again.' });
    } else {
      setMessage({ type: 'success', text: 'Check your email for the magic link!' });
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card card">
        <h1 className="auth-title">Cookbook</h1>
        <p className="auth-subtitle">Sign in to your family meal planner</p>
        
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
          
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-4"
          >
            {loading ? 'Sending link...' : 'Send Magic Link'}
          </button>
        </form>

        {message && (
          <div className={`auth-message ${message.type} mt-4`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
