import React, { useState } from 'react';
import DebugLog from './DebugLog';
import './Settings.css';

const PROVIDER_KEY = 'active_ai_provider';
const MODEL_KEY = 'active_ai_model';

const MODELS = {
  gemini: [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro' },
  ],
  grok: [
    { id: 'grok-2', name: 'Grok 2' },
    { id: 'grok-beta', name: 'Grok Beta' },
    { id: 'grok-3', name: 'Grok 3 (Think)' },
    { id: 'grok-4.20', name: 'Grok 4.20' },
  ],
};

const Settings: React.FC = () => {
  const [activeProvider, setActiveProvider] = useState<string>(
    localStorage.getItem(PROVIDER_KEY) || 'grok'
  );
  const [activeModel, setActiveModel] = useState<string>(
    localStorage.getItem(MODEL_KEY) || (activeProvider === 'grok' ? 'grok-2' : 'gemini-1.5-flash')
  );

  const handleProviderChange = (provider: string) => {
    setActiveProvider(provider);
    localStorage.setItem(PROVIDER_KEY, provider);
    
    // Set default model for the new provider if it's not mock
    if (provider !== 'mock') {
      const defaultModel = MODELS[provider as keyof typeof MODELS][0].id;
      setActiveModel(defaultModel);
      localStorage.setItem(MODEL_KEY, defaultModel);
    }
  };

  const handleModelChange = (model: string) => {
    setActiveModel(model);
    localStorage.setItem(MODEL_KEY, model);
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
              <button
                className={`toggle-btn ${activeProvider === 'mock' ? 'active' : ''}`}
                onClick={() => handleProviderChange('mock')}
              >
                Mock
              </button>
            </div>
          </div>

          {activeProvider !== 'mock' && (
            <div className="setting-item">
              <div className="setting-info">
                <label>Model Version</label>
                <p className="setting-description">
                  Select the specific version of the {activeProvider === 'gemini' ? 'Gemini' : 'Grok'} model.
                </p>
              </div>
              <select 
                className="model-select"
                value={activeModel}
                onChange={(e) => handleModelChange(e.target.value)}
              >
                {MODELS[activeProvider as keyof typeof MODELS].map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="debug-container">
            <DebugLog />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Settings;
