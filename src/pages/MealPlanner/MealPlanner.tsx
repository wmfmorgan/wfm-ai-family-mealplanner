import React, { useState, useEffect } from 'react';
import { format, startOfWeek, addWeeks, subWeeks, addDays } from 'date-fns';
import {
  householdService,
  type GenerationPreferences,
  HouseholdMember,
} from '../../lib/services/household';
import { plannerService } from '../../lib/services/planner';
import { askAI } from '../../lib/ai/client';
import { generateMealPlanPrompt } from '../../lib/ai/prompts';
import PlannerGrid from '../../components/MealPlanner/PlannerGrid';
import GenerationPanel from '../../components/MealPlanner/GenerationPanel';
import RecipeDetail from '../../components/MealPlanner/RecipeDetail';
import { Recipe } from '../../lib/services/planner';
import { invokeRecipeSearch, invokeSelectMeals } from '../../lib/services/spoonacular';
import './MealPlanner.css';

const MealPlanner: React.FC = () => {
  const [weekStartDate, setWeekStartDate] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [planData, setPlanData] = useState<Record<string, any>>({});
  const [generationPreferences, setGenerationPreferences] = useState<GenerationPreferences | null>(null);
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
          const [membersData, preferences] = await Promise.all([
            householdService.getMembers(hId),
            householdService.getGenerationPreferences(hId),
          ]);
          setMembers(membersData);
          setGenerationPreferences(preferences);
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
      const persistedPreferences = await householdService.getGenerationPreferences(householdId);
      setGenerationPreferences(persistedPreferences);
      
      let finalPlan;
      if (activeProvider === 'mock') {
        const prompt = generateMealPlanPrompt({
          members,
          weekStartDate: format(weekStartDate, 'yyyy-MM-dd'),
          selectedMeals: persistedPreferences.selected_meals as any,
          leftoverStrategy,
          lockedSlots: [],
        });
        const responseData = await askAI({ prompt, provider: 'mock' });
        finalPlan = responseData;
      } else {
        const weekDateStr = format(weekStartDate, 'yyyy-MM-dd');
        const selectMeals = await invokeSelectMeals({
          household_id: householdId,
          members,
          week_start_date: weekDateStr,
          matrix: persistedPreferences.matrix,
        });

        finalPlan = await invokeRecipeSearch({
          household_id: householdId,
          week_start_date: weekDateStr,
          directives: selectMeals.directives,
        });
      }

      const weekDateStr = format(weekStartDate, 'yyyy-MM-dd');

      const recipeSlots = Array.isArray(finalPlan?.slots)
        ? finalPlan.slots
        : (finalPlan.days || []).flatMap((day: any) => ([
          day.breakfast ? { day: day.day, meal_type: 'breakfast', recipe: day.breakfast, shopping_items: [] } : null,
          day.lunch ? { day: day.day, meal_type: 'lunch', recipe: day.lunch, shopping_items: [] } : null,
          day.dinner ? { day: day.day, meal_type: 'dinner', recipe: day.dinner, shopping_items: [] } : null,
        ].filter(Boolean)));

      const recipesToSave = recipeSlots
        .filter((slot: any) => slot?.recipe)
        .map((slot: any) => {
          const recipe = slot.recipe;
          return {
        household_id: householdId,
            name: recipe.name,
            ingredients: recipe.ingredients || [],
            instructions: recipe.instructions || [],
            prep_time_min: recipe.prep_time_minutes || recipe.prep_time_min || 0,
            cook_time_min: recipe.cook_time_min || 0,
            servings: recipe.servings || 4,
            category: recipe.category || slot.meal_type || '',
            description: recipe.description || '',
            nutrition: recipe.nutrition || {},
            source_provider: recipe.source_provider || 'ai-generated',
            source_id: recipe.source_id || null,
            image_url: recipe.image_url || null,
            shopping_items: slot.shopping_items || [],
          };
        });

      const slotsToSave = recipeSlots.map((slot: any) => ({
        day_of_week: slot.day,
        meal_type: slot.meal_type,
        recipe_name: slot.recipe?.name,
      }));

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
        selectedMeals={generationPreferences?.selected_meals ?? []}
        leftoverStrategy={leftoverStrategy}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
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
