import React from 'react';
import './MemberCard.css';

export interface MemberCardProps {
  name: string;
  dietaryNeeds: string[];
  avoidances?: string[];
  calorieTarget: number;
  macros: {
    protein: string;
    carbs: string;
    fat: string;
  };
  onEdit: () => void;
  onDelete?: () => void;
  isOwner?: boolean;
}

/**
 * MemberCard Component
 * A tactile, card-style UI element for a family meal planner.
 * Aesthetic: Minimalist, earthy tones (warm neutrals, soft greens), cookbook-like feel.
 */
const MemberCard: React.FC<MemberCardProps> = ({ 
  name, 
  dietaryNeeds, 
  avoidances = [],
  calorieTarget, 
  macros,
  onEdit,
  onDelete,
  isOwner = false
}) => {
  return (
    <div className="member-card">
      <div className="member-card-header">
        <h2 className="member-name">{name}</h2>
        <div className="action-buttons">
          <button className="icon-button edit-button" onClick={onEdit} title="Edit Profile">
            <span className="material-symbols-outlined">edit</span>
          </button>
          {!isOwner && onDelete && (
            <button className="icon-button delete-button" onClick={onDelete} title="Remove Member">
              <span className="material-symbols-outlined">delete</span>
            </button>
          )}
        </div>
      </div>
      
      <div className="dietary-tags">
        {dietaryNeeds.map((need, index) => (
          <span key={index} className="diet-tag">{need}</span>
        ))}
        {avoidances.map((avoid, index) => (
          <span key={`avoid-${index}`} className="diet-tag avoid-tag">{avoid}</span>
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
