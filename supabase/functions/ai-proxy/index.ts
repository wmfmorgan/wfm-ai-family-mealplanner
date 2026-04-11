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

    // 3. (Optional but good) Verify JWT with Supabase Auth
    // Since we are in an edge function, we can use the supabase client to verify.
    // However, Supabase's Edge Functions are usually protected by the Gateway if configured.
    // For manual validation:
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
    const { provider, prompt, ping } = await req.json()

    // 5. Check for ping mode
    if (ping) {
      return new Response(JSON.stringify({ status: 'ok', message: 'AI Proxy is functional', user_id: user.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 6. Basic AI provider routing (mock for now, but ready for GEMINI_API_KEY)
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    
    if (provider === 'gemini' && geminiApiKey) {
      // Logic for fetching from Gemini would go here.
      // For now, return a functional mock response indicating connectivity.
      return new Response(JSON.stringify({
        status: 'ok',
        provider: 'gemini',
        received_prompt: prompt,
        message: 'Gemini integration ready (mocked response).'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ 
      status: 'ok', 
      message: 'AI Proxy received your request.',
      received: { provider, prompt }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
