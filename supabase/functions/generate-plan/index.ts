import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.40.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface HouseholdMember {
  name: string;
  nutrition_profile: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('No authorization header', { status: 401, headers: corsHeaders })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables not set')
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const { members, household_id, provider, model, selected_meals } = await req.json()
    console.log(`[generate-plan] Initializing for household: ${household_id}, members: ${members?.length}`)
    console.log(`[generate-plan] Requested provider: ${provider}, model: ${model}`)
    
    // Default to all meals if not provided
    const mealsToGenerate = Array.isArray(selected_meals) && selected_meals.length > 0
      ? { 
          breakfast: selected_meals.includes('breakfast'), 
          lunch: selected_meals.includes('lunch'), 
          dinner: selected_meals.includes('dinner') 
        }
      : { breakfast: true, lunch: true, dinner: true };
    
    // Determine provider based on request or environment availability
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    const grokKey = Deno.env.get('XAI_API_KEY')

    let finalProvider = provider || (geminiKey ? 'gemini' : 'grok')
    let apiKey = finalProvider === 'gemini' ? geminiKey : grokKey

    // Fallback if requested provider key is missing
    if (!apiKey) {
      finalProvider = geminiKey ? 'gemini' : 'grok'
      apiKey = finalProvider === 'gemini' ? geminiKey : grokKey
    }

    if (!apiKey) {
      throw new Error('No AI API key found in environment (GEMINI_API_KEY or XAI_API_KEY)')
    }

    console.log(`[generate-plan] Final provider: ${finalProvider}`)

    const apiUrl = finalProvider === 'gemini' 
      ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
      : 'https://api.x.ai/v1/chat/completions'
    
    const finalModel = model || (finalProvider === 'gemini' ? 'gemini-1.5-flash' : 'grok-3')

    // Helper for AI calls
    const callAI = async (system: string, userPrompt: string, label: string) => {
      console.log(`[generate-plan] [${label}] Calling ${finalProvider} (${finalModel})...`);
      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: finalModel,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' }
          })
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error(`[generate-plan] [${label}] AI Provider Error (${res.status}):`, errorText);
          throw new Error(`AI Provider ${finalProvider} (${label}) returned error ${res.status}`);
        }

        const json = await res.json();
        if (!json.choices?.[0]?.message?.content) {
          console.error(`[generate-plan] [${label}] Malformed AI response (missing content):`, JSON.stringify(json));
          throw new Error(`AI Provider ${finalProvider} (${label}) returned malformed response`);
        }

        let content = json.choices[0].message.content.trim();
        if (content.startsWith('```')) {
          content = content.replace(/^```[a-z]*\n/i, '').replace(/\n```$/g, '');
        }
        
        try {
          return JSON.parse(content);
        } catch (parseErr) {
          console.error(`[generate-plan] [${label}] JSON Parse Error:`, content);
          throw new Error(`Failed to parse AI response for ${label}`);
        }
      } catch (err) {
        console.error(`[generate-plan] [${label}] Exception:`, err.message);
        throw err;
      }
    }

    // 1. Coordinator: Establish Blueprint
    console.log('[generate-plan] Phase 1: Coordinator')
    const coordinatorSystem = `You are a Head Chef and Meal Planner Coordinator.
Establish a cohesive weekly meal blueprint based on the household profile.
Return JSON: { "theme": string, "protein_rotation": string[], "diversity_rules": string, "breakfast_blueprint": string, "lunch_blueprint": string, "dinner_blueprint": string }`
    
    const coordinatorPrompt = `Household Members: ${JSON.stringify(members)}
Create a theme and blueprints for Breakfast, Lunch, and Dinner that ensure variety and nutritional balance.`

    const blueprint = await callAI(coordinatorSystem, coordinatorPrompt, 'Coordinator');
    console.log('[generate-plan] Blueprint received:', blueprint.theme);

    // Validation for blueprint
    if (!blueprint || typeof blueprint !== 'object') {
      throw new Error('Coordinator failed to return a valid blueprint object');
    }

    console.log('[generate-plan] Phase 2: Parallel Workers');

    // 2. Parallel Workers: Generate Recipes
    const workerSystem = (type: string) => {
      const bprint = blueprint[`${type.toLowerCase()}_blueprint`] || blueprint.theme || `Vibrant ${type} meals`;
      return `You are a ${type} Specialist Chef.
Generate 7 ${type} recipes based on the household profile and the following blueprint.
Blueprint: ${bprint}
Overall Theme: ${blueprint.theme}
Return JSON: { "recipes": Array<{ "name": string, "description": string, "ingredients": Array<{ "item": string, "amount": string, "category": string }>, "instructions": string[], "category": "${type}", "prep_time_minutes": number }> }
CRITICAL: Keep 'description' to 1 short sentence, 'ingredients' to 3-5 core items max, and 'instructions' to 1-2 brief steps. This is strictly required to prevent output timeout.`;
    };

    const workerPrompt = (type: string) => `Household Profile: ${JSON.stringify(members)}
Generate 7 distinct ${type} recipes for the week.`;

    // Execute workers sequentially or with slight delay if parallel fails often locally
    // For now, staying parallel but adding individual error catching if needed
    const tasks = [];
    if (mealsToGenerate.breakfast) {
      tasks.push(callAI(workerSystem('Breakfast'), workerPrompt('Breakfast'), 'Breakfast Worker').then(res => ({ type: 'breakfast', res })));
    }
    if (mealsToGenerate.lunch) {
      tasks.push(callAI(workerSystem('Lunch'), workerPrompt('Lunch'), 'Lunch Worker').then(res => ({ type: 'lunch', res })));
    }
    if (mealsToGenerate.dinner) {
      tasks.push(callAI(workerSystem('Dinner'), workerPrompt('Dinner'), 'Dinner Worker').then(res => ({ type: 'dinner', res })));
    }

    const results = await Promise.all(tasks);

    console.log('[generate-plan] Phase 3: Merging')
    
    let breakfastRes = { recipes: [] };
    let lunchRes = { recipes: [] };
    let dinnerRes = { recipes: [] };

    for (const item of results) {
      if (!item.res?.recipes) {
        console.error(`[generate-plan] Worker missing recipes array for ${item.type}:`, item.res);
        throw new Error(`Worker agent failed to generate recipe array for ${item.type}`);
      }
      if (item.type === 'breakfast') breakfastRes = item.res;
      if (item.type === 'lunch') lunchRes = item.res;
      if (item.type === 'dinner') dinnerRes = item.res;
    }

    // 3. Merging
    const fullPlan = {
      theme: blueprint.theme,
      blueprint: blueprint,
      days: Array.from({ length: 7 }, (_, i) => ({
        day: i,
        breakfast: mealsToGenerate.breakfast ? (breakfastRes.recipes?.[i] || null) : null,
        lunch: mealsToGenerate.lunch ? (lunchRes.recipes?.[i] || null) : null,
        dinner: mealsToGenerate.dinner ? (dinnerRes.recipes?.[i] || null) : null
      }))
    }

    return new Response(JSON.stringify(fullPlan), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
