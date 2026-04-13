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
    <div className="landing-wrapper">
      {/* Top Navigation */}
      <nav className="top-nav">
        <div className="nav-container">
          <div className="nav-logo">WFM AI</div>
          <div className="nav-links">
            <a href="#" className="nav-link">Preserve</a>
            <a href="#" className="nav-link">Sync</a>
            <a href="#" className="nav-link">Pantry</a>
            <a href="#" className="nav-link">About</a>
          </div>
          <button className="nav-login-btn">Login</button>
        </div>
      </nav>

      <main className="landing-main">
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-banner">
            <img 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBiuI95ZQLGMiZA-k_K_tp0oUj_vS3rO2FCwRjkCOb_Jj1T7esqWGyTH85MD8jr6IXjX3dcmiNvPdqYy48SKxVco-mswF-_wSS1O5ks26mn6Yms42tW_3yZu3EqPp3Sl3dtAyIhmBJSZAHTKJRMVQpFtbW8m4Pb_869yL9SnN4sez8snPwwFM8xc4fHICqMmMDKH41Xa70FRlOHtuxsjP3hM32fslGEzKzV_rQUokl78OEFFcnYScECcJSphgPPyf3M4fgrRC0Bnr0z" 
              alt="Atmospheric kitchen" 
            />
            <div className="hero-overlay"></div>
            <h1 className="hero-title">Simplify your family meals</h1>
          </div>
        </section>

        {/* Login Section */}
        <section className="login-section">
          <h2 className="login-title">Welcome Back</h2>
          <p className="login-subtitle">Enter your email to receive a secure login link. No password required.</p>
          
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

          <form onSubmit={handleLogin} className="auth-form">
            <div className="input-group">
              <label htmlFor="email" className="auth-label">Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="auth-input"
              />
            </div>

            {loginMode === 'password' && (
              <div className="input-group">
                <label htmlFor="password" title="Password" className="auth-label">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="auth-input"
                />
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="btn-magic-link"
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

          <p className="policy-text">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </section>

        {/* Features Bento Grid */}
        <section className="features-section">
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <span className="material-symbols-outlined">auto_stories</span>
              </div>
              <h3>Digital Recipe Box</h3>
              <p>Archive your family's favorite traditions and new discoveries in one beautifully organized digital library.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <span className="material-symbols-outlined">calendar_month</span>
              </div>
              <h3>Effortless Planning</h3>
              <p>AI-powered meal suggestions that adapt to your family's dietary preferences and busy schedules.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <span className="material-symbols-outlined">group_work</span>
              </div>
              <h3>Family Sync</h3>
              <p>Keep everyone on the same page with shared grocery lists and synchronized meal calendars.</p>
            </div>
          </div>
        </section>

        {/* Secondary Story Section */}
        <section className="story-section">
          <div className="story-content">
            <h2 className="story-title">Modern solutions for the traditional kitchen.</h2>
            <p className="story-text">
              WFM AI blends the warmth of a classic family cookbook with the intelligence of modern technology. We help you spend less time planning and more time connecting over the table.
            </p>
            <div className="story-features">
              <div className="story-feature">
                <span className="material-symbols-outlined">check_circle</span>
                <span>Smart Pantry</span>
              </div>
              <div className="story-feature">
                <span className="material-symbols-outlined">check_circle</span>
                <span>Waste Reduction</span>
              </div>
            </div>
          </div>
          <div className="story-image-wrapper">
            <img 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBlCUCmNGi4C1gLFIb9NRkWifdJluDGRnkWF9zeM-mMNYnrFPtl4S3hLTbIpko7_Y8lwjGL_hjhUw3Pr6PnIcwwLn4ortxQSKYaoWPu5FLV0CBoXGxaTipzn7vKrPC7V_hMSA4pZCsMShBTNQg6w9Bfi7avDORjLx6dgG8pZprimvMCMJhotKkPbSbeenzgsjIuGY7QWh8o7C-yBHJxzBHZyug_iM2Y9zpYUQyYfkYtO_43BzpsGfQt7P3-kKdgb5avVkfD5d2Oa9Qz" 
              alt="Plated salad" 
            />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="footer-wrap">
        <div className="footer-container">
          <div className="footer-logo">WFM AI</div>
          <div className="footer-links">
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms of Service</a>
            <a href="#" className="footer-link">Help Center</a>
            <a href="#" className="footer-link">Contact Us</a>
          </div>
          <div className="footer-copyright">
            © 2026 WFM AI Family Meal Planner. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Login;
