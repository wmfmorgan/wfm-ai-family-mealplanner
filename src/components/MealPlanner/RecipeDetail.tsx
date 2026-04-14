import React from 'react';
import { Recipe } from '../../lib/services/planner';
import './RecipeDetail.css';

interface RecipeDetailProps {
  recipe: Recipe | null;
  onClose: () => void;
}

const RecipeDetail: React.FC<RecipeDetailProps> = ({ recipe, onClose }) => {
  if (!recipe) return null;

  const renderIngredient = (item: any) => {
    if (typeof item === 'string') return item;
    if (typeof item === 'object' && item !== null) {
      return `${item.amount || ''} ${item.item || item.name || ''} ${item.category ? `(${item.category})` : ''}`.trim();
    }
    return String(item);
  };

  return (
    <div className="recipe-detail-overlay" onClick={onClose}>
      <div className="recipe-detail-drawer" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose} aria-label="Close">
          &times;
        </button>
        
        <header className="recipe-header">
          <h2 className="recipe-title">{recipe.name}</h2>
          <div className="recipe-meta">
            {recipe.prep_time_min > 0 && <span>Prep: {recipe.prep_time_min}m</span>}
            {recipe.cook_time_min > 0 && <span>Cook: {recipe.cook_time_min}m</span>}
            {recipe.servings > 0 && <span>Servings: {recipe.servings}</span>}
          </div>
        </header>

        <section className="recipe-section">
          <h3>Ingredients</h3>
          <ul className="ingredients-list">
            {Array.isArray(recipe.ingredients) ? (
              recipe.ingredients.map((item, index) => (
                <li key={index}>{renderIngredient(item)}</li>
              ))
            ) : (
              <li>No ingredients listed</li>
            )}
          </ul>
        </section>

        <section className="recipe-section">
          <h3>Instructions</h3>
          <ol className="instructions-list">
            {Array.isArray(recipe.instructions) ? (
              recipe.instructions.map((step, index) => (
                <li key={index}>{typeof step === 'object' ? step.step || step.instruction || JSON.stringify(step) : step}</li>
              ))
            ) : (
              <li>No instructions listed</li>
            )}
          </ol>
        </section>

        {recipe.nutrition && Object.keys(recipe.nutrition).length > 0 && (
          <section className="recipe-section">
            <h3>Nutrition (per serving)</h3>
            <div className="nutrition-grid">
              {Object.entries(recipe.nutrition).map(([key, value]) => (
                <div key={key} className="nutrition-item">
                  <span className="nutrition-key">{key}</span>
                  <span className="nutrition-value">{String(value)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default RecipeDetail;
