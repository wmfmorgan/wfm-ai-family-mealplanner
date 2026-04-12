import React, { useState, useEffect, useRef } from 'react';
import './MealSlot.css';

interface MealSlotProps {
  id?: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  recipeName?: string;
  isLocked?: boolean;
  onSlotClick?: () => void;
  onLockToggle?: (isLocked: boolean) => void;
  onEdit?: (manualEntry: string) => void;
}

const MealSlot: React.FC<MealSlotProps> = ({ 
  type, 
  recipeName, 
  isLocked = false, 
  onSlotClick, 
  onLockToggle, 
  onEdit 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(recipeName || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(recipeName || '');
  }, [recipeName]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const displayType = type.charAt(0).toUpperCase() + type.slice(1);

  const handleLockClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLockToggle?.(!isLocked);
  };

  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLocked) {
      setIsEditing(true);
    } else {
      onSlotClick?.();
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (inputValue !== recipeName) {
      onEdit?.(inputValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditing(false);
      if (inputValue !== recipeName) {
        onEdit?.(inputValue);
      }
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setInputValue(recipeName || '');
    }
  };

  return (
    <div className={`meal-slot ${isLocked ? 'locked' : ''} ${isEditing ? 'editing' : ''}`} onClick={onSlotClick}>
      <div className="meal-slot-header">
        <span className="meal-type-label">{displayType}</span>
        <button 
          className={`lock-button ${isLocked ? 'is-locked' : ''}`} 
          onClick={handleLockClick}
          title={isLocked ? "Unlock meal" : "Lock meal"}
          aria-label={isLocked ? "Unlock meal" : "Lock meal"}
        >
          {isLocked ? '🔒' : '🔓'}
        </button>
      </div>
      <div className={`meal-content ${!inputValue ? 'empty' : ''}`} onClick={handleContentClick}>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="meal-edit-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          inputValue || <span className="placeholder-text">Add meal...</span>
        )}
      </div>
    </div>
  );
};

export default MealSlot;
