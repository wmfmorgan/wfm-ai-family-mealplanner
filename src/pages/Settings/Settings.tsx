import React, { useEffect, useState } from 'react';
import DebugLog from './DebugLog';
import {
  householdService,
  type GenerationMealType,
  type GenerationPreferences,
} from '../../lib/services/household';
import { getSpoonacularQuotaStatus } from '../../lib/services/spoonacular';
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
    { id: 'grok-4-1-fast-reasoning', name: 'Grok 4.1 Reasoning' },
    { id: 'grok-beta', name: 'Grok Beta' },
    { id: 'grok-3', name: 'Grok 3 (Think)' },
  ],
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MEAL_ROWS: Array<{ key: GenerationMealType; label: string }> = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
];

const buildPreferenceSummaries = (
  matrix: Record<string, GenerationMealType[]>
): Pick<GenerationPreferences, 'selected_days' | 'selected_meals'> => {
  const selected_days = Object.entries(matrix)
    .filter(([, meals]) => meals.length > 0)
    .map(([day]) => Number(day))
    .sort((a, b) => a - b);

  const selected_meals = Array.from(new Set(Object.values(matrix).flat().filter(Boolean))) as GenerationMealType[];

  return {
    selected_days,
    selected_meals,
  };
};

const Settings: React.FC = () => {
  const [activeProvider, setActiveProvider] = useState<string>(
    localStorage.getItem(PROVIDER_KEY) || 'grok'
  );
  const [activeModel, setActiveModel] = useState<string>(
    localStorage.getItem(MODEL_KEY) || (activeProvider === 'grok' ? 'grok-3' : 'gemini-1.5-flash')
  );
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [generationPreferences, setGenerationPreferences] = useState<GenerationPreferences | null>(null);
  const [quotaStatus, setQuotaStatus] = useState<{
    daily_limit: number;
    points_used_today: number;
    points_left_today: number;
  } | null>(null);

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

  useEffect(() => {
    const loadSettings = async () => {
      const nextHouseholdId = await householdService.getMyHouseholdId();
      if (!nextHouseholdId) {
        return;
      }

      setHouseholdId(nextHouseholdId);

      const [prefs, quota] = await Promise.all([
        householdService.getGenerationPreferences(nextHouseholdId),
        getSpoonacularQuotaStatus(nextHouseholdId),
      ]);

      setGenerationPreferences(prefs);
      setQuotaStatus(quota);
    };

    loadSettings().catch((error) => {
      console.error('Error loading settings page data:', error);
    });
  }, []);

  const handleMatrixToggle = async (day: number, meal: GenerationMealType) => {
    if (!householdId || !generationPreferences) {
      return;
    }

    const dayKey = String(day);
    const currentMeals = generationPreferences.matrix[dayKey] ?? [];
    const nextMeals = currentMeals.includes(meal)
      ? currentMeals.filter((entry) => entry !== meal)
      : [...currentMeals, meal];

    const nextMatrix = {
      ...generationPreferences.matrix,
      [dayKey]: nextMeals,
    };
    const nextPrefs: GenerationPreferences = {
      matrix: nextMatrix,
      ...buildPreferenceSummaries(nextMatrix),
    };

    setGenerationPreferences(nextPrefs);

    try {
      await householdService.updateGenerationPreferences(householdId, nextPrefs);
    } catch (error) {
      console.error('Error updating generation preferences:', error);
      setGenerationPreferences(generationPreferences);
    }
  };

  return (
    <div className="settings-page">
      <header className="page-header">
        <h1>Settings</h1>
        <p className="subtitle">Manage your account and developer preferences.</p>
      </header>

      <section className="settings-section">
        <h2>Meal Generation Preferences</h2>
        <div className="card developer-card">
          <div className="setting-item">
            <div className="setting-info">
              <label>Meal Generation Preferences</label>
              <p className="setting-description">
                Control which meals the planner generates for each day of the week.
              </p>
            </div>
          </div>

          <div className="generation-matrix" role="table" aria-label="Meal Generation Preferences">
            <div className="matrix-row" role="row">
              <div className="matrix-cell" />
              {DAY_LABELS.map((day) => (
                <div key={day} className="matrix-cell" role="columnheader">{day}</div>
              ))}
            </div>

            {MEAL_ROWS.map((meal) => (
              <div key={meal.key} className="matrix-row" role="row">
                <div className="matrix-cell" role="rowheader">{meal.label}</div>
                {DAY_LABELS.map((day, index) => {
                  const checked = generationPreferences?.matrix[String(index)]?.includes(meal.key) ?? false;
                  return (
                    <label key={`${meal.key}-${day}`} className="matrix-cell">
                      <input
                        type="checkbox"
                        aria-label={`${meal.label} ${day}`}
                        checked={checked}
                        onChange={() => handleMatrixToggle(index, meal.key)}
                      />
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

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
            <DebugLog householdId={householdId} quotaSummary={quotaStatus} />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Settings;
