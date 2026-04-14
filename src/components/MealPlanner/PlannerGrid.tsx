import React from 'react';
import { addDays, format } from 'date-fns';
import DayColumn from './DayColumn';
import './PlannerGrid.css';

interface PlannerGridProps {
  weekStartDate: Date;
  planData?: Record<string, any>;
  onSlotClick?: (date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => void;
  onLockToggle?: (date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', isLocked: boolean) => void;
  onEdit?: (date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', manualEntry: string) => void;
  onDelete?: (date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => void;
  onRefresh?: (date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => void;
}

const PlannerGrid: React.FC<PlannerGridProps> = ({ 
  weekStartDate, 
  planData = {}, 
  onSlotClick,
  onLockToggle,
  onEdit,
  onDelete,
  onRefresh
}) => {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));

  const getMealsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return planData[dateStr] || {};
  };

  return (
    <div className="planner-grid-container">
      <div className="planner-grid">
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          return (
            <DayColumn
              key={dateStr}
              date={day}
              meals={getMealsForDate(day)}
              onSlotClick={(mealType) => onSlotClick?.(dateStr, mealType)}
              onLockToggle={(mealType, isLocked) => onLockToggle?.(dateStr, mealType, isLocked)}
              onEdit={(mealType, manualEntry) => onEdit?.(dateStr, mealType, manualEntry)}
              onDelete={(mealType) => onDelete?.(dateStr, mealType)}
              onRefresh={(mealType) => onRefresh?.(dateStr, mealType)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default PlannerGrid;
