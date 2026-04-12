import { supabase } from '../supabase';
import { saveAiLog } from './logger';
import { Recipe } from '../services/planner';

export interface AskAIOptions {
  prompt: string;
  provider: string;
  model?: string;
}

export async function askAI({ prompt, provider, model }: AskAIOptions) {
  const startTime = performance.now();
  let statusCode = 0;
  let errorMessage: string | undefined;

  // For UAT/Demo purposes: Check for mock mode or handle missing API keys
  if (provider === 'mock') {
    const mockData = await handleMockAi(prompt);
    saveAiLog({
      provider: 'mock',
      prompt,
      response: JSON.stringify(mockData),
      latency: Math.round(performance.now() - startTime),
      status_code: 200,
    });
    return mockData;
  }

  try {
    const localFunctionUrl = import.meta.env.VITE_AI_PROXY_URL;
    let data, error;

    if (localFunctionUrl) {
      console.log('Using local AI Proxy at:', localFunctionUrl);
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(localFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ prompt, provider, model }),
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw { status: response.status, message: errData.error || errData.details || 'Local function error' };
      }
      data = await response.json();
    } else {
      console.log(`[askAI] Invoking cloud function: ${provider} (${model})`);
      const result = await supabase.functions.invoke('ai-proxy', {
        body: { 
          prompt, 
          provider, 
          model,
          system_prompt: 'You are an expert chef. You MUST respond with JSON in the requested format.',
          response_format: { type: 'json_object' }
        },
      });
      data = result.data;
      error = result.error;
    }

    const latency = Math.round(performance.now() - startTime);

    if (error) {
      console.dir(error);
      // If the edge function returns a 500 (likely missing API key), fallback to mock for UAT
      if (error.status === 500 && (error.message.includes('API key') || error.message.includes('not configured'))) {
        console.warn('AI API key not configured. Falling back to mock response for UAT.');
        return await handleMockAi(prompt);
      }
      
      const details = (error as any).context?.details || error.message;
      console.error('AI Error Details:', details);
      
      statusCode = error.status || 500;
      errorMessage = details;
      saveAiLog({
        provider,
        prompt,
        latency,
        status_code: statusCode,
        error: errorMessage,
      });
      throw error;
    }

    statusCode = 200;

    saveAiLog({
      provider,
      prompt,
      response: JSON.stringify(data),
      latency,
      status_code: statusCode,
    });

    return data;
  } catch (error: any) {
    const latency = Math.round(performance.now() - startTime);
    if (!errorMessage) {
      errorMessage = error.message || 'Unknown error';
      statusCode = error.status || 500;
      saveAiLog({
        provider,
        prompt,
        latency,
        status_code: statusCode,
        error: errorMessage,
      });
    }
    throw error;
  }
}

/**
 * Generates a mock AI response for UAT when API keys are missing.
 * This is a pure function that does NOT call Supabase.
 */
async function handleMockAi(prompt: string) {
  console.log('Generating mock AI response for prompt:', prompt.substring(0, 100) + '...');
  
  // Simulate latency
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Determine which meals were requested
  const isBreakfast = prompt.toLowerCase().includes('breakfast');
  const isLunch = prompt.toLowerCase().includes('lunch');
  const isDinner = prompt.toLowerCase().includes('dinner');
  const isSnack = prompt.toLowerCase().includes('snack');

  const mealTypes = [];
  if (isBreakfast) mealTypes.push('breakfast');
  if (isLunch) mealTypes.push('lunch');
  if (isDinner) mealTypes.push('dinner');
  if (isSnack) mealTypes.push('snack');

  if (mealTypes.length === 0) mealTypes.push('dinner');

  const mockRecipes = [
    { name: 'Garden Vegetable Frittata', ingredients: ['Eggs', 'Spinach', 'Peppers'], instructions: ['Whisk eggs', 'Sauté veggies', 'Bake'], nutrition: { calories: 350 }, prep_time_min: 10, cook_time_min: 20, servings: 4 },
    { name: 'Quinoa Buddha Bowl', ingredients: ['Quinoa', 'Chickpeas', 'Tahini'], instructions: ['Cook quinoa', 'Assemble bowl', 'Drizzle tahini'], nutrition: { calories: 550 }, prep_time_min: 15, cook_time_min: 15, servings: 2 },
    { name: 'Lemon Herb Salmon', ingredients: ['Salmon', 'Lemon', 'Dill'], instructions: ['Season salmon', 'Grill 10 mins'], nutrition: { calories: 450 }, prep_time_min: 5, cook_time_min: 10, servings: 2 },
    { name: 'Lentil Shepherd\'s Pie', ingredients: ['Lentils', 'Potatoes', 'Carrots'], instructions: ['Cook lentils', 'Mash potatoes', 'Bake'], nutrition: { calories: 600 }, prep_time_min: 20, cook_time_min: 30, servings: 6 },
    { name: 'Berry Smoothie Bowl', ingredients: ['Berries', 'Banana', 'Granola'], instructions: ['Blend fruit', 'Top with granola'], nutrition: { calories: 300 }, prep_time_min: 5, cook_time_min: 0, servings: 1 }
  ];

  const plan = [];
  const recipes: Recipe[] = [];

  // Generate 7 days of meals
  for (let day = 0; day < 7; day++) {
    for (const mealType of mealTypes) {
      const recipeIndex = (day + (mealType === 'lunch' ? 1 : mealType === 'dinner' ? 2 : 0)) % mockRecipes.length;
      const baseRecipe = mockRecipes[recipeIndex];
      
      const recipe = {
        ...baseRecipe,
        id: `mock-recipe-${day}-${mealType}`,
        household_id: 'mock-household-id'
      };

      if (!recipes.find(r => r.name === recipe.name)) {
        recipes.push(recipe);
      }
      
      plan.push({
        day_of_week: day,
        meal_type: mealType,
        recipe_name: recipe.name,
        is_locked: false
      });
    }
  }

  return {
    plan,
    recipes,
    provider: 'mock'
  };
}
