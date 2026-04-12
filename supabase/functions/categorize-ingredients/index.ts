import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.40.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VALID_CATEGORIES = [
  'Produce', 
  'Meat & Seafood', 
  'Dairy & Eggs', 
  'Pantry & Grains', 
  'Canned & Jarred', 
  'Bakery', 
  'Frozen Foods', 
  'Condiments & Spices', 
  'Snacks & Sweets', 
  'Beverages', 
  'Deli', 
  'Household'
]

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Validate request
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { meal_plan_id, ingredients } = await req.json()

    if (!meal_plan_id || !ingredients || !Array.isArray(ingredients)) {
      return new Response(JSON.stringify({ error: 'Missing meal_plan_id or ingredients array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Prepare environment and Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment variables not set')
    }

    // Use service role for database operations, but original user token for AI proxy
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 3. Deduplicate ingredients to save tokens
    const uniqueIngredients = Array.from(new Set(ingredients.map(i => i.trim()))).filter(Boolean)

    if (uniqueIngredients.length === 0) {
      return new Response(JSON.stringify({ message: 'No ingredients to categorize', count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Call ai-proxy for categorization
    const systemPrompt = `You are a professional grocery shopper. Categorize each ingredient into exactly one of these categories: ${VALID_CATEGORIES.join(', ')}.
Return a JSON object where the key is the EXACT ingredient string provided and the value is the category name. 
Do not group or modify the ingredient strings. If an ingredient is ambiguous, use your best judgment.`

    const aiProxyResponse = await fetch(`${supabaseUrl}/functions/v1/ai-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        provider: 'gemini',
        prompt: JSON.stringify(uniqueIngredients),
        system_prompt: systemPrompt,
        response_format: { type: 'json_object' }
      }),
    })

    if (!aiProxyResponse.ok) {
      const errorText = await aiProxyResponse.text()
      console.error('AI Proxy Error:', errorText)
      throw new Error(`AI Proxy failed with status ${aiProxyResponse.status}`)
    }

    const aiResult = await aiProxyResponse.json()
    const content = aiResult.choices?.[0]?.message?.content
    
    if (!content) {
      throw new Error('No content returned from AI Proxy')
    }

    const categorization = JSON.parse(content)

    // 5. Prepare data for upsert
    const itemsToUpsert = Object.entries(categorization).map(([ingredient, category]) => ({
      meal_plan_id,
      original_string: ingredient,
      category: VALID_CATEGORIES.includes(category as string) ? category : 'Pantry & Grains'
    }))

    if (itemsToUpsert.length === 0) {
      return new Response(JSON.stringify({ message: 'No valid categorizations produced', count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 6. Upsert into database
    const { error: upsertError } = await supabase
      .from('shopping_list_items')
      .upsert(itemsToUpsert, { onConflict: 'meal_plan_id, original_string' })

    if (upsertError) {
      console.error('Upsert Error:', upsertError)
      throw upsertError
    }

    return new Response(JSON.stringify({ success: true, count: itemsToUpsert.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Categorize-Ingredients Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
