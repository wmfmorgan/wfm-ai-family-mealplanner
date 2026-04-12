import React from 'react';
import { format } from 'date-fns';
import MealSlot from './MealSlot';
import './DayColumn.css';

interface DayColumnProps {
  date: Date;
  meals: Record<string, {
    id?: string;
    recipeName?: string;
    isLocked?: boolean;
    manualEntry?: string;
  }>;
  onSlotClick?: (type: 'breakfast' | 'lunch' | 'dinner' | 'snack') => void;
  onLockToggle?: (type: 'breakfast' | 'lunch' | 'dinner' | 'snack', isLocked: boolean) => void;
  onEdit?: (type: 'breakfast' | 'lunch' | 'dinner' | 'snack', manualEntry: string) => void;
}

const DayColumn: React.FC<DayColumnProps> = ({ 
  date, 
  meals, 
  onSlotClick,
  onLockToggle,
  onEdit
}) => {
  const dayName = format(date, 'EEE'); // Sun, Mon, etc.
  const dayNumber = format(date, 'MMM d'); // Apr 14, etc.
  const isToday = format(new Date(), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');

  const renderSlot = (type: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    const meal = meals[type] || {};
    return (
      <MealSlot 
        id={meal.id}
        type={type} 
        recipeName={meal.manualEntry || meal.recipeName}
        isLocked={meal.isLocked}
        onSlotClick={() => onSlotClick?.(type)}
        onLockToggle={(isLocked) => onLockToggle?.(type, isLocked)}
        onEdit={(manualEntry) => onEdit?.(type, manualEntry)}
      />
    );
  };

  return (
    <div className={`day-column ${isToday ? 'today' : ''}`}>
      <div className="day-header">
        <span className="day-name">{dayName}</span>
        <span className="day-number">{dayNumber}</span>
      </div>
      <div className="meal-slots">
        {renderSlot('breakfast')}
        {renderSlot('lunch')}
        {renderSlot('dinner')}
      </div>
    </div>
  );
};

export default DayColumn;
