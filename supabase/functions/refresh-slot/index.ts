import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.40.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const { members, category, exclusion_list, provider, model } = await req.json()
    console.log(`[refresh-slot] Refreshing ${category} slot. Exclusion list: ${exclusion_list?.length} items.`)
    console.log(`[refresh-slot] Requested provider: ${provider}, model: ${model}`)

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

    console.log(`[refresh-slot] Final provider: ${finalProvider}`)

    const apiUrl = finalProvider === 'gemini' 
      ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
      : 'https://api.x.ai/v1/chat/completions'
    
    const finalModel = model || (finalProvider === 'gemini' ? 'gemini-1.5-flash' : 'grok-3')

    const systemPrompt = `You are a professional chef.
Generate a single ${category} recipe that fits the household profile and avoids any recipes in the exclusion list.
Exclusion List (Already generated meals): ${exclusion_list.join(', ')}
Return JSON: { "recipe": { "name": string, "description": string, "ingredients": Array<{ "item": string, "amount": string, "category": string }>, "instructions": string[], "category": "${category}", "prep_time_minutes": number } }`

    const userPrompt = `Household Profile: ${JSON.stringify(members)}
Generate a high-quality ${category} recipe.`

    console.log(`[refresh-slot] Calling ${finalProvider} (${finalModel})...`)
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: finalModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' }
      })
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error(`[refresh-slot] AI Provider Error:`, errorText)
      throw new Error(`AI Provider returned error ${res.status}: ${errorText}`)
    }

    const json = await res.json()
    if (!json.choices?.[0]?.message?.content) {
      console.error(`[refresh-slot] Malformed AI response:`, JSON.stringify(json))
      throw new Error('Malformed AI response: missing content')
    }

    let content = json.choices[0].message.content.trim()
    if (content.startsWith('```')) {
      content = content.replace(/^```[a-z]*\n/i, '').replace(/\n```$/g, '')
    }
    const result = JSON.parse(content)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
