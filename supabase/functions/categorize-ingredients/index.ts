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

  console.log('--- Categorize Ingredients Start ---')

  try {
    // 1. Validate request
    if (req.method !== 'POST') {
      console.error('Method not allowed:', req.method)
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('Missing Authorization header')
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    console.log('Request body:', JSON.stringify(body))

    const { meal_plan_id, ingredients, provider, model } = body
    console.log(`Extracted from body - provider: ${provider}, model: ${model}`)
    
    const finalProvider = provider || 'gemini'
    const finalModel = model || (finalProvider === 'grok' ? 'grok-3' : 'gemini-1.5-flash')
    
    console.log(`Final routing - provider: ${finalProvider}, model: ${finalModel}`)

    if (!meal_plan_id || !ingredients || !Array.isArray(ingredients)) {
      console.error('Validation failed: Missing meal_plan_id or ingredients array')
      return new Response(JSON.stringify({ error: 'Missing meal_plan_id or ingredients array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Prepare environment and Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Environment variables missing: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
      throw new Error('Supabase environment variables not set')
    }

    console.log('Supabase environment ready. URL:', supabaseUrl)

    // Use service role for database operations, but original user token for AI proxy
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 3. Deduplicate ingredients to save tokens
    const uniqueIngredients = Array.from(new Set(ingredients.map(i => i.trim()))).filter(Boolean)
    console.log(`Processing ${uniqueIngredients.length} unique ingredients out of ${ingredients.length}`)

    if (uniqueIngredients.length === 0) {
      console.log('No unique ingredients found.')
      return new Response(JSON.stringify({ message: 'No ingredients to categorize', count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Call ai-proxy for categorization
    console.log(`Calling AI Proxy with provider: ${finalProvider}, model: ${finalModel}`)
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
        provider: finalProvider,
        model: finalModel,
        prompt: JSON.stringify(uniqueIngredients),
        system_prompt: systemPrompt,
        response_format: { type: 'json_object' }
      }),
    })

    if (!aiProxyResponse.ok) {
      const errorData = await aiProxyResponse.json().catch(() => ({ error: 'Unknown AI Proxy error' }))
      console.error('AI Proxy Error:', JSON.stringify(errorData))
      throw new Error(`AI Proxy failed (${provider}): ${errorData.error || errorData.details || 'Internal Error'}`)
    }

    const aiResult = await aiProxyResponse.json()
    console.log('AI Proxy Result received successfully')
    const content = aiResult.choices?.[0]?.message?.content
    
    if (!content) {
      console.error('AI Proxy returned no content in message')
      throw new Error('No content returned from AI Proxy')
    }

    let categorization
    try {
      categorization = JSON.parse(content)
      console.log('Categorization parsed successfully')
    } catch (parseError) {
      console.error('Failed to parse AI content as JSON:', content)
      throw new Error('AI returned invalid JSON format')
    }

    // 5. Prepare data for upsert
    const itemsToUpsert = Object.entries(categorization).map(([ingredient, category]) => ({
      meal_plan_id,
      original_string: ingredient,
      category: VALID_CATEGORIES.includes(category as string) ? category : 'Pantry & Grains'
    }))

    console.log(`Preparing to upsert ${itemsToUpsert.length} items into database`)

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
      console.error('Database Upsert Error:', JSON.stringify(upsertError))
      throw upsertError
    }

    console.log('Database upsert successful')
    console.log('--- Categorize Ingredients End ---')

    return new Response(JSON.stringify({ success: true, count: itemsToUpsert.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Categorize-Ingredients Error:', error)
    
    // Handle Supabase/PostgreSQL errors specifically if possible
    const errorMessage = error.message || 'Unknown server error'
    const errorDetails = error.details || error.hint || undefined

    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: errorDetails
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
