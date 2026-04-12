import React from 'react';
import { addDays } from 'date-fns';
import DayColumn from './DayColumn';
import './PlannerGrid.css';

interface PlannerGridProps {
  weekStartDate: Date;
  planData?: Record<string, any>;
  onSlotClick?: (date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => void;
  onLockToggle?: (date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', isLocked: boolean) => void;
  onEdit?: (date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', manualEntry: string) => void;
}

const PlannerGrid: React.FC<PlannerGridProps> = ({ 
  weekStartDate, 
  planData = {}, 
  onSlotClick,
  onLockToggle,
  onEdit
}) => {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));

  const getMealsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return planData[dateStr] || {};
  };

  return (
    <div className="planner-grid-container">
      <div className="planner-grid">
        {days.map((day) => {
          const dateStr = day.toISOString().split('T')[0];
          return (
            <DayColumn
              key={dateStr}
              date={day}
              meals={getMealsForDate(day)}
              onSlotClick={(mealType) => onSlotClick?.(dateStr, mealType)}
              onLockToggle={(mealType, isLocked) => onLockToggle?.(dateStr, mealType, isLocked)}
              onEdit={(mealType, manualEntry) => onEdit?.(dateStr, mealType, manualEntry)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default PlannerGrid;
