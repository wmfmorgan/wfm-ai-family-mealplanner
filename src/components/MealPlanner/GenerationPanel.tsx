import React from 'react';
import { format, endOfWeek } from 'date-fns';
import './GenerationPanel.css';

interface GenerationPanelProps {
  weekStartDate: Date;
  selectedMeals: string[];
  leftoverStrategy: boolean;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToggleMeal: (meal: string) => void;
  onToggleStrategy: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

const GenerationPanel: React.FC<GenerationPanelProps> = ({
  weekStartDate,
  selectedMeals,
  leftoverStrategy,
  onPrevWeek,
  onNextWeek,
  onToggleMeal,
  onToggleStrategy,
  onGenerate,
  isGenerating,
}) => {
  const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 0 });
  const weekLabel = `${format(weekStartDate, 'MMM d')} - ${format(weekEndDate, 'MMM d')}`;

  const mealTypes = [
    { id: 'breakfast', label: 'Breakfast' },
    { id: 'lunch', label: 'Lunch' },
    { id: 'dinner', label: 'Dinner' },
    { id: 'snack', label: 'Snack' },
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
        <h3 className="section-title">Meal Types</h3>
        <div className="meal-type-grid">
          {mealTypes.map((meal) => (
            <div 
              key={meal.id} 
              className={`checkbox-card ${selectedMeals.includes(meal.id) ? 'selected' : ''}`}
              onClick={() => onToggleMeal(meal.id)}
            >
              <input 
                type="checkbox" 
                checked={selectedMeals.includes(meal.id)} 
                onChange={() => {}} // Handled by div click
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
          <>
            <div className="loading-spinner" />
            <span>Drafting...</span>
          </>
        ) : (
          <span>Generate Weekly Plan</span>
        )}
      </button>
    </aside>
  );
};

export default GenerationPanel;
