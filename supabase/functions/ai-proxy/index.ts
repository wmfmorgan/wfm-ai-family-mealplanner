import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.40.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Check for POST request
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Validate JWT from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Verify JWT with Supabase Auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabase = createClient(supabaseUrl!, supabaseAnonKey!)
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token', details: authError }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Parse payload
    const { provider, prompt, system_prompt, response_format, ping, model } = await req.json()

    // 5. Check for ping mode
    if (ping) {
      return new Response(JSON.stringify({ status: 'ok', message: 'AI Proxy is functional', user_id: user.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 6. AI provider routing
    let apiUrl = ''
    let apiKey = ''
    let defaultModel = ''

    if (provider === 'gemini') {
      apiUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
      apiKey = Deno.env.get('GEMINI_API_KEY') || ''
      defaultModel = 'gemini-1.5-flash'
    } else if (provider === 'grok') {
      apiUrl = 'https://api.x.ai/v1/chat/completions'
      apiKey = Deno.env.get('XAI_API_KEY') || ''
      defaultModel = 'grok-beta'
    } else {
      return new Response(JSON.stringify({ error: `Unsupported provider: ${provider}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: `API key for ${provider} is not configured.` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 7. Call the provider using OpenAI-compatible format
    const messages = []
    if (system_prompt) {
      messages.push({ role: 'system', content: system_prompt })
    }
    messages.push({ role: 'user', content: prompt })

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || defaultModel,
        messages: messages,
        response_format: response_format || undefined,
      }),
    })

    let result = await response.json()

    // 8. Handle JSON mode resiliently (strip markdown fences if present)
    if (response_format?.type === 'json_object' && result.choices?.[0]?.message?.content) {
      let content = result.choices[0].message.content.trim()
      // Remove markdown code blocks if present
      if (content.startsWith('```')) {
        content = content.replace(/^```[a-z]*\n/i, '').replace(/\n```$/g, '')
      }
      result.choices[0].message.content = content
    }

    return new Response(JSON.stringify(result), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
