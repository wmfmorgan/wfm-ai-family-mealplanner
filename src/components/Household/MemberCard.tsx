import React from 'react';
import './MemberCard.css';

export interface MemberCardProps {
  name: string;
  dietaryNeeds: string[];
  calorieTarget: number;
  macros: {
    protein: string;
    carbs: string;
    fat: string;
  };
  onEdit: () => void;
}

/**
 * MemberCard Component
 * A tactile, card-style UI element for a family meal planner.
 * Aesthetic: Minimalist, earthy tones (warm neutrals, soft greens), cookbook-like feel.
 */
const MemberCard: React.FC<MemberCardProps> = ({ 
  name, 
  dietaryNeeds, 
  calorieTarget, 
  macros,
  onEdit 
}) => {
  return (
    <div className="member-card">
      <div className="member-card-header">
        <h2 className="member-name">{name}</h2>
        <button className="edit-button" onClick={onEdit}>Edit</button>
      </div>
      
      <div className="dietary-tags">
        {dietaryNeeds.map((need, index) => (
          <span key={index} className="diet-tag">{need}</span>
        ))}
      </div>

      <div className="nutrition-summary">
        <div className="calorie-display">
          <span className="label">Target</span>
          <span className="value">{calorieTarget} kcal</span>
        </div>
        <div className="macro-split">
          <div className="macro-item">
            <span className="label">P</span>
            <span className="value">{macros.protein}</span>
          </div>
          <div className="macro-item">
            <span className="label">C</span>
            <span className="value">{macros.carbs}</span>
          </div>
          <div className="macro-item">
            <span className="label">F</span>
            <span className="value">{macros.fat}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberCard;
