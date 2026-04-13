import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Sparkles, 
  Users, 
  Refrigerator, 
  Utensils, 
  Globe, 
  Share2, 
  Mail,
  Chrome
} from 'lucide-react';
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
    <div className="landing-wrapper">
      {/* Hero Section: 60/40 Split */}
      <section className="hero-section">
        <div className="hero-image-container">
          <div className="hero-image-overlay">
            <blockquote className="hero-quote">
              "The kitchen is the heart of the home, and AI is its modern pulse."
            </blockquote>
          </div>
          <img 
            src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&q=80&w=2000" 
            alt="Modern Kitchen" 
            className="hero-image"
          />
        </div>

        <div className="auth-form-container">
          <div className="auth-card-v2">
            <h1 className="auth-title-v2">Welcome Home</h1>
            <p className="auth-subtitle-v2">Sign in to your family meal planner</p>
            
            <div className="auth-form-wrapper">
              <div className="auth-mode-toggle">
                <button 
                  className={`mode-btn ${loginMode === 'magic' ? 'active' : ''}`}
                  onClick={() => setLoginMode('magic')}
                >
                  MAGIC LINK
                </button>
                <button 
                  className={`mode-btn ${loginMode === 'password' ? 'active' : ''}`}
                  onClick={() => setLoginMode('password')}
                >
                  PASSWORD
                </button>
              </div>

              <form onSubmit={handleLogin} className="auth-form flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label htmlFor="email" className="auth-label-v2">EMAIL ADDRESS</label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="auth-input-v2"
                  />
                </div>

                {loginMode === 'password' && (
                  <div className="flex flex-col gap-1">
                    <label htmlFor="password" title="Password" className="auth-label-v2">PASSWORD</label>
                    <input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="auth-input-v2"
                    />
                  </div>
                )}
                
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary-v2 w-full mt-2"
                >
                  {loading 
                    ? (loginMode === 'magic' ? 'SENDING...' : 'SIGNING IN...') 
                    : (loginMode === 'magic' ? 'SEND MAGIC LINK' : 'SIGN IN')
                  }
                </button>
              </form>

              {message && (
                <div className={`auth-message ${message.type} mt-4`}>
                  {message.text}
                </div>
              )}

              {/* Social Auth UI */}
              <div className="auth-divider">
                <span>OR CONTINUE WITH</span>
              </div>
              
              <div className="social-auth-buttons">
                <button className="social-btn" disabled>
                  <Chrome size={18} />
                  <span>GOOGLE</span>
                </button>
                <button className="social-btn" disabled>
                  <Users size={18} />
                  <span>ICLOUD</span>
                </button>
              </div>

              {/* Policy Links */}
              <div className="auth-policy-links">
                <a href="#">PRIVACY POLICY</a>
                <a href="#">TERMS OF SERVICE</a>
                <a href="#">HELP CENTER</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid Section */}
      <section className="feature-grid-section">
        <h2 className="section-title">Intelligent Meal Architecture</h2>
        <div className="feature-grid">
          <div className="feature-card feature-card-green">
            <Sparkles className="feature-icon" />
            <h3>AI Recipe Preservation</h3>
            <p>Our neural networks refine your family heirlooms for the modern palate.</p>
          </div>
          <div className="feature-card feature-card-forest">
            <Users className="feature-icon" />
            <h3>Household Sync</h3>
            <p>Real-time coordination across every device in your home.</p>
          </div>
          <div className="feature-card">
            <Refrigerator className="feature-icon" />
            <h3>Smart Pantry</h3>
            <p>Automated inventory tracking that breathes with your kitchen.</p>
          </div>
          <div className="feature-card feature-card-image">
            <div className="feature-content">
              <Utensils className="feature-icon" />
              <h3>Joy of Gathering</h3>
              <p>Designed for the moments that matter most.</p>
            </div>
            <img 
              src="https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=800" 
              alt="Dining" 
              className="feature-card-img"
            />
          </div>
        </div>
      </section>

      {/* Branded Footer */}
      <footer className="landing-footer">
        <div className="footer-brand">
          <span className="footer-logo">WFM AI</span>
          <span className="footer-tagline">REFINED PLANNING FOR THE CONSCIOUS KITCHEN</span>
        </div>
        <div className="footer-links">
          <div className="footer-social">
            <Globe size={20} />
            <Share2 size={20} />
            <Mail size={20} />
          </div>
          <p className="footer-copyright">© 2026 WFM AI FAMILY MEALPLANNER. ALL RIGHTS RESERVED.</p>
        </div>
      </footer>
    </div>
  );
};

export default Login;
