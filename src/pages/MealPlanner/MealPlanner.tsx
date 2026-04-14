import React, { useState, useEffect } from 'react';
import { format, startOfWeek, addWeeks, subWeeks, addDays } from 'date-fns';
import { householdService, HouseholdMember } from '../../lib/services/household';
import { plannerService } from '../../lib/services/planner';
import { askAI } from '../../lib/ai/client';
import { generateMealPlanPrompt } from '../../lib/ai/prompts';
import PlannerGrid from '../../components/MealPlanner/PlannerGrid';
import GenerationPanel from '../../components/MealPlanner/GenerationPanel';
import RecipeDetail from '../../components/MealPlanner/RecipeDetail';
import { Recipe } from '../../lib/services/planner';
import { supabase } from '../../lib/supabase';
import './MealPlanner.css';

const MealPlanner: React.FC = () => {
  const [weekStartDate, setWeekStartDate] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [planData, setPlanData] = useState<Record<string, any>>({});
  const [selectedMeals, setSelectedMeals] = useState<string[]>(['dinner']);
  const [leftoverStrategy, setLeftoverStrategy] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

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
          const dateStr = format(addDays(weekStartDate, slot.day_of_week), 'yyyy-MM-dd');
          
          if (!gridData[dateStr]) gridData[dateStr] = {};
          gridData[dateStr][slot.meal_type] = {
            id: slot.id,
            recipeName: slot.recipe?.name || '',
            recipe: slot.recipe,
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
    
    // Optimistic update
    setPlanData(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        [mealType]: { ...prev[date]?.[mealType], isLocked }
      }
    }));

    if (!slot?.id) return;

    try {
      await plannerService.updateSlot(slot.id, { is_locked: isLocked });
    } catch (err) {
      console.error('Error toggling lock:', err);
      // Revert on error
      setPlanData(prev => ({
        ...prev,
        [date]: {
          ...prev[date],
          [mealType]: { ...prev[date][mealType], isLocked: !isLocked }
        }
      }));
    }
  };

  const handleEdit = async (date: string, mealType: string, manualEntry: string) => {
    const slot = planData[date]?.[mealType];

    // Optimistic update
    setPlanData(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        [mealType]: { ...prev[date]?.[mealType], manualEntry }
      }
    }));

    if (!slot?.id) return;

    try {
      await plannerService.updateSlot(slot.id, { manual_entry: manualEntry });
    } catch (err) {
      console.error('Error updating manual entry:', err);
    }
  };

  const handleDelete = async (date: string, mealType: string) => {
    const slot = planData[date]?.[mealType];
    if (!slot?.id) return;

    // Optimistic update
    setPlanData(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        [mealType]: { ...prev[date][mealType], recipeName: '', recipe: null, manualEntry: '' }
      }
    }));

    try {
      await plannerService.clearSlot(slot.id);
    } catch (err) {
      console.error('Error clearing slot:', err);
      // Revert or reload
      if (householdId) loadPlan(householdId, format(weekStartDate, 'yyyy-MM-dd'));
    }
  };

  const handleRefresh = async (date: string, mealType: string) => {
    const slot = planData[date]?.[mealType];
    if (!slot?.id || !householdId) return;

    // Set loading state for the slot (visual feedback)
    setPlanData(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        [mealType]: { ...prev[date][mealType], recipeName: 'Refreshing...', recipe: null }
      }
    }));

    try {
      // 1. Collect exclusion list (all other meal names in the current week)
      const exclusionList: string[] = [];
      Object.values(planData).forEach((meals: any) => {
        Object.values(meals).forEach((m: any) => {
          if (m.recipeName && m.recipeName !== 'Refreshing...') {
            exclusionList.push(m.recipeName);
          }
        });
      });

      // 2. Call service
      const activeProvider = localStorage.getItem('active_ai_provider') || 'grok';
      const activeModel = localStorage.getItem('active_ai_model') || (activeProvider === 'grok' ? 'grok-3' : 'gemini-1.5-flash');

      const newRecipe = await plannerService.refreshSlot(
        slot.id,
        householdId,
        mealType,
        members,
        exclusionList,
        { provider: activeProvider, model: activeModel }
      );

      if (newRecipe) {
        setPlanData(prev => ({
          ...prev,
          [date]: {
            ...prev[date],
            [mealType]: { 
              ...prev[date][mealType], 
              recipeName: newRecipe.name, 
              recipe: newRecipe 
            }
          }
        }));
      }
    } catch (err) {
      console.error('Error refreshing slot:', err);
      if (householdId) loadPlan(householdId, format(weekStartDate, 'yyyy-MM-dd'));
    }
  };

  const handleGenerate = async () => {
    if (!householdId || members.length === 0) return;

    setIsGenerating(true);
    setGenerationStep('Designing your week...');

    try {
      // Small delays for editorial feel
      const stepTimer1 = setTimeout(() => setGenerationStep('Drafting recipes...'), 2000);
      const stepTimer2 = setTimeout(() => setGenerationStep('Final polish...'), 5000);

      const activeProvider = localStorage.getItem('active_ai_provider') || 'grok';
      const activeModel = localStorage.getItem('active_ai_model') || (activeProvider === 'grok' ? 'grok-3' : 'gemini-1.5-flash');
      
      let finalPlan;
      if (activeProvider === 'mock') {
        const prompt = generateMealPlanPrompt({
          members,
          weekStartDate: format(weekStartDate, 'yyyy-MM-dd'),
          selectedMeals: selectedMeals as any,
          leftoverStrategy,
          lockedSlots: [],
        });
        const responseData = await askAI({ prompt, provider: 'mock' });
        finalPlan = responseData;
      } else {
        // Call new Multi-Agent Edge Function
        const { data, error } = await supabase.functions.invoke('generate-plan', {
          body: {
            members,
            household_id: householdId,
            provider: activeProvider,
            model: activeModel,
            selected_meals: selectedMeals
          }
        });        if (error) throw error;
        finalPlan = data;
      }

      const weekDateStr = format(weekStartDate, 'yyyy-MM-dd');

      // Map response to save format - EXPLICITLY pick fields to avoid 400 errors with unknown columns
      const recipesToSave = (finalPlan.days || []).flatMap((d: any) => [
        d.breakfast, d.lunch, d.dinner
      ]).filter(Boolean).map((r: any) => ({ 
        household_id: householdId,
        name: r.name,
        ingredients: r.ingredients,
        instructions: r.instructions,
        prep_time_min: r.prep_time_minutes || r.prep_time_min || 0,
        cook_time_min: r.cook_time_min || 0,
        servings: r.servings || 4,
        category: r.category || '',
        description: r.description || '',
        nutrition: r.nutrition || {}
      }));

      const slotsToSave = (finalPlan.days || []).flatMap((d: any) => {
        const dailySlots = [];
        if (selectedMeals.includes('breakfast')) {
          dailySlots.push({ day_of_week: d.day, meal_type: 'breakfast', recipe_name: d.breakfast?.name });
        }
        if (selectedMeals.includes('lunch')) {
          dailySlots.push({ day_of_week: d.day, meal_type: 'lunch', recipe_name: d.lunch?.name });
        }
        if (selectedMeals.includes('dinner')) {
          dailySlots.push({ day_of_week: d.day, meal_type: 'dinner', recipe_name: d.dinner?.name });
        }
        return dailySlots;
      });

      if (activeProvider !== 'mock') {
        await plannerService.saveMealPlan(
          householdId,
          weekDateStr,
          recipesToSave,
          slotsToSave as any,
          { provider: activeProvider, model: activeModel }
        );
      }

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      await loadPlan(householdId, weekDateStr);

    } catch (err) {
      console.error('Error generating meal plan:', err);
      alert('Failed to generate meal plan.');
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
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
              const slot = planData[date]?.[mealType];
              if (slot?.recipe) {
                setSelectedRecipe(slot.recipe);
              }
            }}
            onLockToggle={handleLockToggle}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onRefresh={handleRefresh}
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
        generationStep={generationStep}
      />

      <RecipeDetail 
        recipe={selectedRecipe} 
        onClose={() => setSelectedRecipe(null)} 
      />
    </div>
  );
};

export default MealPlanner;
