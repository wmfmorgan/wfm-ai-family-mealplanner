import React, { useState, useEffect } from 'react';
import { format, startOfWeek, addWeeks, subWeeks } from 'date-fns';
import { householdService, HouseholdMember } from '../../lib/services/household';
import { plannerService } from '../../lib/services/planner';
import { askAI } from '../../lib/ai/client';
import { generateMealPlanPrompt, GenerationResponse } from '../../lib/ai/prompts';
import PlannerGrid from '../../components/MealPlanner/PlannerGrid';
import GenerationPanel from '../../components/MealPlanner/GenerationPanel';
import './MealPlanner.css';

const MealPlanner: React.FC = () => {
  const [weekStartDate, setWeekStartDate] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [planData, setPlanData] = useState<Record<string, any>>({});
  const [selectedMeals, setSelectedMeals] = useState<string[]>(['dinner']);
  const [leftoverStrategy, setLeftoverStrategy] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [householdId, setHouseholdId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const hId = await householdService.getMyHouseholdId();
        if (hId) {
          setHouseholdId(hId);
          const membersData = await householdService.getMembers(hId);
          setMembers(membersData);
        }
      } catch (err) {
        console.error('Error initializing planner:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (householdId) {
      loadPlan(householdId, format(weekStartDate, 'yyyy-MM-dd'));
    }
  }, [householdId, weekStartDate]);

  const loadPlan = async (hId: string, weekDate: string) => {
    try {
      const plan = await plannerService.getMealPlan(hId, weekDate);
      if (plan && plan.slots) {
        const gridData: Record<string, any> = {};
        plan.slots.forEach((slot: any) => {
          const dateStr = format(new Date(weekStartDate.getTime() + slot.day_of_week * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
          
          if (!gridData[dateStr]) gridData[dateStr] = {};
          gridData[dateStr][slot.meal_type] = {
            id: slot.id,
            recipeName: slot.recipe?.name || '',
            isLocked: slot.is_locked,
            manualEntry: slot.manual_entry || ''
          };
        });
        setPlanData(gridData);
      } else {
        setPlanData({});
      }
    } catch (err) {
      console.error('Error loading meal plan:', err);
    }
  };

  const handlePrevWeek = () => setWeekStartDate(prev => subWeeks(prev, 1));
  const handleNextWeek = () => setWeekStartDate(prev => addWeeks(prev, 1));

  const handleToggleMeal = (meal: string) => {
    setSelectedMeals(prev => 
      prev.includes(meal) ? prev.filter(m => m !== meal) : [...prev, meal]
    );
  };

  const handleLockToggle = async (date: string, mealType: string, isLocked: boolean) => {
    const slot = planData[date]?.[mealType];
    if (!slot?.id) return;

    try {
      await plannerService.updateSlot(slot.id, { is_locked: isLocked });
      // Optimistic update
      setPlanData(prev => ({
        ...prev,
        [date]: {
          ...prev[date],
          [mealType]: { ...prev[date][mealType], isLocked }
        }
      }));
    } catch (err) {
      console.error('Error toggling lock:', err);
    }
  };

  const handleEdit = async (date: string, mealType: string, manualEntry: string) => {
    const slot = planData[date]?.[mealType];
    if (!slot?.id) return;

    try {
      await plannerService.updateSlot(slot.id, { manual_entry: manualEntry });
      // Optimistic update
      setPlanData(prev => ({
        ...prev,
        [date]: {
          ...prev[date],
          [mealType]: { ...prev[date][mealType], manualEntry }
        }
      }));
    } catch (err) {
      console.error('Error updating manual entry:', err);
    }
  };

  const handleGenerate = async () => {
    if (!householdId || members.length === 0) return;

    setIsGenerating(true);
    try {
      // 1. Identify locked slots
      const lockedSlots: any[] = [];
      Object.entries(planData).forEach(([dateStr, meals]: [string, any]) => {
        const dayOfWeek = new Date(dateStr).getDay();
        Object.entries(meals).forEach(([mealType, data]: [string, any]) => {
          if (data.isLocked) {
            lockedSlots.push({
              day_of_week: dayOfWeek,
              meal_type: mealType,
              recipe_name: data.recipeName,
              manual_entry: data.manualEntry,
              id: data.id // Keep the ID for preservation
            });
          }
        });
      });

      const prompt = generateMealPlanPrompt({
        members,
        weekStartDate: format(weekStartDate, 'yyyy-MM-dd'),
        selectedMeals: selectedMeals as any,
        leftoverStrategy,
        lockedSlots,
      });

      const responseData = await askAI({
        prompt,
        provider: 'mock',
        model: 'gemini-1.5-flash',
      });

      // Handle both raw JSON return (mock) and OpenAI-style (real/edge)
      let response: GenerationResponse;
      if (responseData.plan && responseData.recipes) {
        response = responseData;
      } else if (responseData.choices?.[0]?.message?.content) {
        try {
          response = JSON.parse(responseData.choices[0].message.content);
        } catch (e) {
          console.error('Failed to parse AI response JSON:', e);
          throw new Error('AI returned invalid JSON format.');
        }
      } else {
        console.error('Unexpected AI response structure:', responseData);
        throw new Error('AI generation failed to return a valid plan.');
      }

      const weekDateStr = format(weekStartDate, 'yyyy-MM-dd');
      
      // Merge AI response with locked slots
      // If AI respected the prompt, locked slots are already in response.plan
      // But we should double check and ensure manual_entry is preserved
      const finalSlots = response.plan.map(p => {
        const locked = lockedSlots.find(l => l.day_of_week === p.day_of_week && l.meal_type === p.meal_type);
        if (locked) {
          return {
            ...p,
            is_locked: true,
            manual_entry: locked.manual_entry,
            // If it's a manual entry without a recipe, AI might have put a dummy name
            recipe_name: locked.manual_entry ? undefined : (p.recipe_name || locked.recipe_name)
          };
        }
        return p;
      });

      // Skip database save in mock mode to avoid UUID validation errors with mock IDs
      if (responseData.provider !== 'mock') {
        await plannerService.saveMealPlan(
          householdId,
          weekDateStr,
          response.recipes.map(r => ({ ...r, household_id: householdId })),
          finalSlots as any
        );
      } else {
        console.log('Mock mode: Skipping DB save. Updating UI only.');
      }

      // Update local state directly for mock mode or reload for real mode
      if (responseData.provider === 'mock') {
        const gridData: Record<string, any> = {};
        finalSlots.forEach((slot: any) => {
          const dateStr = format(new Date(weekStartDate.getTime() + slot.day_of_week * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
          if (!gridData[dateStr]) gridData[dateStr] = {};
          gridData[dateStr][slot.meal_type] = {
            recipeName: slot.recipe_name,
            isLocked: slot.is_locked,
            manualEntry: slot.manual_entry || ''
          };
        });
        setPlanData(gridData);
      } else {
        await loadPlan(householdId, weekDateStr);
      }
    } catch (err) {
      console.error('Error generating meal plan:', err);
      alert('Failed to generate meal plan. Check logs for details.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="planner-loading">
        <div className="loading-dots">
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
        </div>
        <p>Opening your family cookbook...</p>
      </div>
    );
  }

  return (
    <div className="meal-planner-page">
      <main className="planner-content">
        <header className="planner-header">
          <h1 className="planner-title">Meal Planner</h1>
          <p className="planner-subtitle">Draft your weekly culinary journey.</p>
        </header>
        
        <div className="planner-view">
          <PlannerGrid 
            weekStartDate={weekStartDate} 
            planData={planData}
            onSlotClick={(date, mealType) => {
              console.log('Clicked slot:', date, mealType);
              // Future: Open recipe selector
            }}
            onLockToggle={handleLockToggle}
            onEdit={handleEdit}
          />
        </div>
      </main>

      <GenerationPanel 
        weekStartDate={weekStartDate}
        selectedMeals={selectedMeals}
        leftoverStrategy={leftoverStrategy}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onToggleMeal={handleToggleMeal}
        onToggleStrategy={() => setLeftoverStrategy(!leftoverStrategy)}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
      />
    </div>
  );
};

export default MealPlanner;
