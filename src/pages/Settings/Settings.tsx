import React, { useState } from 'react';
import DebugLog from './DebugLog';
import './Settings.css';

const PROVIDER_KEY = 'active_ai_provider';

const Settings: React.FC = () => {
  const [activeProvider, setActiveProvider] = useState<string>(
    localStorage.getItem(PROVIDER_KEY) || 'gemini'
  );

  const handleProviderChange = (provider: string) => {
    setActiveProvider(provider);
    localStorage.setItem(PROVIDER_KEY, provider);
  };

  return (
    <div className="settings-page">
      <header className="page-header">
        <h1>Settings</h1>
        <p className="subtitle">Manage your account and developer preferences.</p>
      </header>

      <section className="settings-section">
        <h2>Developer Settings</h2>
        <div className="card developer-card">
          <div className="setting-item">
            <div className="setting-info">
              <label>AI Provider</label>
              <p className="setting-description">
                Switch between different AI models for meal planning.
              </p>
            </div>
            <div className="provider-toggle">
              <button
                className={`toggle-btn ${activeProvider === 'gemini' ? 'active' : ''}`}
                onClick={() => handleProviderChange('gemini')}
              >
                Gemini
              </button>
              <button
                className={`toggle-btn ${activeProvider === 'grok' ? 'active' : ''}`}
                onClick={() => handleProviderChange('grok')}
              >
                Grok
              </button>
            </div>
          </div>

          <div className="debug-container">
            <DebugLog />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Settings;
