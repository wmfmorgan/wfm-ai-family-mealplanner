// supabase/functions/_shared/auth.ts
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.40.0"
import { corsHeaders } from './cors.ts'

export { corsHeaders }

export function createUserClient(authHeader: string): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
}

export function createServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(supabaseUrl, serviceRoleKey)
}

export interface AuthResult {
  user: { id: string; email?: string }
  authHeader: string
}

export async function verifyAuth(req: Request): Promise<AuthResult | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'No authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const supabase = createUserClient(authHeader)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({
      error: 'Invalid token',
      details: authError?.message || 'User not found or session invalid',
      code: authError?.status || 401,
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  return { user: { id: user.id, email: user.email }, authHeader }
}
