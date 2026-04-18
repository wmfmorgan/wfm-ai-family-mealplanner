import React from 'react';
import { format, endOfWeek } from 'date-fns';
import './GenerationPanel.css';

interface GenerationPanelProps {
  weekStartDate: Date;
  selectedMeals: string[];
  leftoverStrategy: boolean;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToggleStrategy: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
  generationStep?: string;
}

const GenerationPanel: React.FC<GenerationPanelProps> = ({
  weekStartDate,
  selectedMeals,
  leftoverStrategy,
  onPrevWeek,
  onNextWeek,
  onToggleStrategy,
  onGenerate,
  isGenerating,
  generationStep,
}) => {
  const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 0 });
  const weekLabel = `${format(weekStartDate, 'MMM d')} - ${format(weekEndDate, 'MMM d')}`;

  const mealTypes = [
    { id: 'breakfast', label: 'Breakfast' },
    { id: 'lunch', label: 'Lunch' },
    { id: 'dinner', label: 'Dinner' },
  ];

  return (
    <aside className="generation-panel">
      <div className="panel-section">
        <h3 className="section-title">Timeline</h3>
        <div className="week-selector">
          <button className="nav-btn" onClick={onPrevWeek} title="Previous Week">←</button>
          <span className="week-label">{weekLabel}</span>
          <button className="nav-btn" onClick={onNextWeek} title="Next Week">→</button>
        </div>
      </div>

      <div className="panel-section">
        <h3 className="section-title">Meal Scope</h3>
        <p className="strategy-desc">
          Generation scope is managed in Settings and shown here for reference.
        </p>
        <div className="meal-type-grid">
          {mealTypes.map((meal) => (
            <div 
              key={meal.id} 
              className={`checkbox-card ${selectedMeals.includes(meal.id) ? 'selected' : ''}`}
              aria-disabled="true"
            >
              <input 
                type="checkbox" 
                checked={selectedMeals.includes(meal.id)} 
                onChange={() => {}}
                disabled
              />
              <span className="checkbox-label">{meal.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <h3 className="section-title">Strategy</h3>
        <div 
          className={`strategy-toggle ${leftoverStrategy ? 'active' : ''}`}
          onClick={onToggleStrategy}
        >
          <div className="strategy-info">
            <span className="strategy-name">Cook once, eat twice</span>
            <span className="strategy-desc">
              Plan recipes with extra servings to be used as leftovers, saving you time.
            </span>
          </div>
        </div>
      </div>

      <button 
        className="generate-btn" 
        onClick={onGenerate}
        disabled={isGenerating || selectedMeals.length === 0}
      >
        {isGenerating ? (
          <div className="generation-progress">
            <div className="loading-spinner" />
            <span className="step-label">{generationStep || 'Drafting...'}</span>
          </div>
        ) : (
          <span>Generate Weekly Plan</span>
        )}
      </button>
    </aside>
  );
};

export default GenerationPanel;
