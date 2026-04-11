import React, { useState } from 'react';
import { NutritionProfile, NUTRITION_PRESETS } from '../../lib/services/household';
import './ProfileForm.css';

export interface ProfileFormProps {
  initialData: {
    name: string;
    nutrition_profile: NutritionProfile;
  };
  onSave: (name: string, profile: NutritionProfile) => void;
  onCancel: () => void;
}

const TOP_ALLERGIES = ["Peanuts", "Tree Nuts", "Milk", "Egg", "Wheat", "Soy", "Fish", "Shellfish", "Sesame"];
const APPLIANCE_LIST = ["Slow Cooker", "Air Fryer", "Oven", "Stove", "Pressure Cooker"];

const ProfileForm: React.FC<ProfileFormProps> = ({ initialData, onSave, onCancel }) => {
  const [name, setName] = useState(initialData.name);
  const [profile, setProfile] = useState<NutritionProfile>(initialData.nutrition_profile);
  const [avoidancesText, setAvoidancesText] = useState(initialData.nutrition_profile.avoidances.join(', '));
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const handlePresetSelect = (presetName: string) => {
    setActivePreset(presetName);
    const presetValues = NUTRITION_PRESETS[presetName];
    if (presetValues) {
      setProfile(prev => ({
        ...prev,
        ...presetValues,
        macro_targets: {
          ...prev.macro_targets,
          ...presetValues.macro_targets
        }
      }));
    }
  };

  const handleAvoidancesChange = (val: string) => {
    setAvoidancesText(val);
    const list = val.split(',').map(s => s.trim()).filter(s => s !== '');
    setProfile(prev => ({ ...prev, avoidances: list }));
  };

  const toggleAllergy = (allergy: string) => {
    const allergyLower = allergy.toLowerCase();
    setProfile(prev => ({
      ...prev,
      allergies: prev.allergies.includes(allergyLower)
        ? prev.allergies.filter(a => a !== allergyLower)
        : [...prev.allergies, allergyLower]
    }));
  };

  const toggleAppliance = (appliance: string) => {
    const appLower = appliance.toLowerCase();
    setProfile(prev => ({
      ...prev,
      appliances: prev.appliances.includes(appLower)
        ? prev.appliances.filter(a => a !== appLower)
        : [...prev.appliances, appLower]
    }));
  };

  const totalMacros = profile.macro_targets.protein_pct + 
                      profile.macro_targets.carbs_pct + 
                      profile.macro_targets.fat_pct;
  const isMacroValid = !isAdvanced || totalMacros === 100;

  return (
    <div className="profile-form-container">
      <header className="form-header">
        <h1 className="form-title">Edit Nutrition Profile</h1>
        <p className="form-subtitle">Define the culinary requirements for {name}.</p>
      </header>

      <form className="profile-form" onSubmit={(e) => { e.preventDefault(); onSave(name, profile); }}>
        
        <section className="form-section">
          <h2 className="section-heading">Basic Information</h2>
          <div className="input-group">
            <label htmlFor="member-name">Name</label>
            <input 
              id="member-name"
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required
            />
          </div>
        </section>

        {/* Preset Selector */}
        <section className="form-section">
          <h2 className="section-heading">Activity & Life Stage</h2>
          <div className="preset-grid">
            {Object.keys(NUTRITION_PRESETS).map(preset => (
              <button 
                key={preset}
                type="button"
                className={`preset-button ${activePreset === preset ? 'active' : ''}`}
                onClick={() => handlePresetSelect(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
        </section>

        {/* Advanced Toggle & Nutrition */}
        <section className="form-section">
          <div className="section-header-row">
            <h2 className="section-heading">Nutrition Targets</h2>
            <label className="toggle-container">
              <input 
                type="checkbox" 
                checked={isAdvanced} 
                onChange={() => setIsAdvanced(!isAdvanced)} 
              />
              <span className="toggle-label">Manual Mode</span>
            </label>
          </div>

          {isAdvanced ? (
            <div className="advanced-inputs">
              <div className="input-group">
                <label htmlFor="target-calories">Daily Calories</label>
                <input 
                  id="target-calories"
                  type="number" 
                  value={profile.target_calories} 
                  onChange={(e) => setProfile({...profile, target_calories: parseInt(e.target.value) || 0})} 
                />
              </div>
              <div className="macro-grid">
                <div className="input-group">
                  <label htmlFor="protein-pct">Protein (%)</label>
                  <input 
                    id="protein-pct"
                    type="number" 
                    value={profile.macro_targets.protein_pct} 
                    onChange={(e) => setProfile({
                      ...profile, 
                      macro_targets: { ...profile.macro_targets, protein_pct: parseInt(e.target.value) || 0 }
                    })}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="carbs-pct">Carbs (%)</label>
                  <input 
                    id="carbs-pct"
                    type="number" 
                    value={profile.macro_targets.carbs_pct} 
                    onChange={(e) => setProfile({
                      ...profile, 
                      macro_targets: { ...profile.macro_targets, carbs_pct: parseInt(e.target.value) || 0 }
                    })}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="fat-pct">Fat (%)</label>
                  <input 
                    id="fat-pct"
                    type="number" 
                    value={profile.macro_targets.fat_pct} 
                    onChange={(e) => setProfile({
                      ...profile, 
                      macro_targets: { ...profile.macro_targets, fat_pct: parseInt(e.target.value) || 0 }
                    })}
                  />
                </div>
              </div>
              {!isMacroValid && (
                <p className="macro-warning">
                  Total macros must equal 100% (currently {totalMacros}%).
                </p>
              )}
            </div>
          ) : (
            <p className="helper-text">Targets are currently managed by the active preset.</p>
          )}
        </section>

        {/* Allergy System */}
        <section className="form-section">
          <h2 className="section-heading">Dietary Safety</h2>
          <label className="input-label">Known Allergies (Top 9)</label>
          <div className="allergy-toggles">
            {TOP_ALLERGIES.map(allergy => (
              <button
                key={allergy}
                type="button"
                className={`allergy-toggle ${profile.allergies.includes(allergy.toLowerCase()) ? 'active' : ''}`}
                onClick={() => toggleAllergy(allergy)}
              >
                {allergy}
              </button>
            ))}
          </div>
          
          <div className="input-group mt-6">
            <label>Chef's Notes (Additional Avoidances)</label>
            <textarea 
              placeholder="e.g. No mushrooms, hates cilantro..." 
              value={avoidancesText}
              onChange={(e) => handleAvoidancesChange(e.target.value)}
            />
          </div>
        </section>

        {/* Appliances */}
        <section className="form-section">
          <h2 className="section-heading">Kitchen Capabilities</h2>
          <div className="appliance-checklist">
            {APPLIANCE_LIST.map(appliance => (
              <label key={appliance} className="checkbox-item">
                <input 
                  type="checkbox" 
                  checked={profile.appliances.includes(appliance.toLowerCase())} 
                  onChange={() => toggleAppliance(appliance)}
                />
                <span>{appliance}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Action Buttons */}
        <div className="form-actions">
          <button type="button" className="btn-tertiary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={!isMacroValid}>Save Changes</button>
        </div>
      </form>
    </div>
  );
};

export default ProfileForm;
