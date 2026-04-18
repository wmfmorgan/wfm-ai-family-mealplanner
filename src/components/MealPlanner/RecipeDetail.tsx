import React from 'react';
import { Recipe } from '../../lib/services/planner';
import './RecipeDetail.css';

interface RecipeDetailProps {
  recipe: Recipe | null;
  onClose: () => void;
}

const RecipeDetail: React.FC<RecipeDetailProps> = ({ recipe, onClose }) => {
  if (!recipe) return null;

  const formatNutritionEntries = (nutrition: Record<string, unknown>) => {
    const formattedEntries: Array<[string, string]> = [];

    for (const [key, value] of Object.entries(nutrition)) {
      if (value == null) {
        continue;
      }

      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        formattedEntries.push([key, String(value)]);
        continue;
      }

      if (Array.isArray(value)) {
        const nutrients = value
          .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
          .map((item) => {
            const title = typeof item.title === 'string'
              ? item.title
              : typeof item.name === 'string'
              ? item.name
              : null;
            const amount = typeof item.amount === 'number' || typeof item.amount === 'string'
              ? String(item.amount)
              : null;
            const unit = typeof item.unit === 'string' ? item.unit : '';

            if (!title || !amount) {
              return null;
            }

            return [title, `${amount}${unit}`] as [string, string];
          })
          .filter((entry): entry is [string, string] => entry !== null);

        if (nutrients.length > 0) {
          formattedEntries.push(...nutrients);
          continue;
        }

        const primitiveValues = value
          .filter((item) =>
            typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')
          .map(String);

        if (primitiveValues.length > 0) {
          formattedEntries.push([key, primitiveValues.join(', ')]);
        }

        continue;
      }

      if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const amount = typeof record.amount === 'number' || typeof record.amount === 'string'
          ? String(record.amount)
          : null;
        const unit = typeof record.unit === 'string' ? record.unit : '';

        if (amount) {
          formattedEntries.push([key, `${amount}${unit}`]);
          continue;
        }

        const nestedValues = Object.entries(record)
          .filter(([, nestedValue]) =>
            typeof nestedValue === 'string' || typeof nestedValue === 'number' || typeof nestedValue === 'boolean')
          .map(([nestedKey, nestedValue]) => `${nestedKey}: ${String(nestedValue)}`);

        if (nestedValues.length > 0) {
          formattedEntries.push([key, nestedValues.join(', ')]);
        }
      }
    }

    return formattedEntries;
  };

  const nutritionEntries = recipe.nutrition ? formatNutritionEntries(recipe.nutrition) : [];

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

        {nutritionEntries.length > 0 && (
          <section className="recipe-section">
            <h3>Nutrition (per serving)</h3>
            <div className="nutrition-grid">
              {nutritionEntries.map(([key, value]) => (
                <div key={key} className="nutrition-item">
                  <span className="nutrition-key">{key}</span>
                  <span className="nutrition-value">{value}</span>
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
