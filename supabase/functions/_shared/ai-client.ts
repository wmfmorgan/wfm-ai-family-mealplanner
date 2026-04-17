// supabase/functions/_shared/ai-client.ts
import { createServiceClient } from './auth.ts'

// D-01: Role config map — hardcoded, not overridable by callers
const ROLE_CONFIG: Record<string, { temperature: number; max_tokens: number }> = {
  'coordinator':         { temperature: 0.7, max_tokens: 1024 },
  'adapter':            { temperature: 0.3, max_tokens: 2048 },
  'fallback-generator': { temperature: 0.9, max_tokens: 2048 },
}

export type AIRole = 'coordinator' | 'adapter' | 'fallback-generator'

export interface AICallOptions {
  role: AIRole
  systemPrompt: string
  userPrompt: string
  responseFormat?: { type: 'json_object' }
  householdId?: string
  edgeFunction?: string
}

export interface AICallResult {
  content: string
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  provider: string
  model: string
}

export async function callAI(options: AICallOptions): Promise<AICallResult> {
  const { role, systemPrompt, userPrompt, responseFormat, householdId, edgeFunction } = options
  const roleConfig = ROLE_CONFIG[role]
  if (!roleConfig) {
    throw new Error(`Unknown AI role: ${role}`)
  }

  // INFRA-03: Provider resolution from env vars (Gemini preferred, Grok fallback)
  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  const grokKey = Deno.env.get('XAI_API_KEY')
  const provider = geminiKey ? 'gemini' : 'grok'
  const apiKey = provider === 'gemini' ? geminiKey! : grokKey!
  if (!apiKey) {
    throw new Error('No AI API key found in environment (GEMINI_API_KEY or XAI_API_KEY)')
  }
  const apiUrl = provider === 'gemini'
    ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
    : 'https://api.x.ai/v1/chat/completions'
  const model = provider === 'gemini' ? 'gemini-1.5-flash' : 'grok-3'

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: roleConfig.temperature,
      max_tokens: roleConfig.max_tokens,
      ...(responseFormat ? { response_format: responseFormat } : {}),
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`AI provider error (${provider}): ${errorText}`)
  }

  const result = await response.json()
  let content: string = result.choices[0].message.content.trim()
  // Strip markdown fences if present (same as ai-proxy logic)
  if (content.startsWith('```')) {
    content = content.replace(/^```[a-z]*\n/i, '').replace(/\n```$/g, '')
  }

  const usage = result.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

  // INFRA-02: Non-fatal token logging via service client (D-04, Pitfall 4)
  try {
    const serviceClient = createServiceClient()
    await serviceClient.from('ai_usage_log').insert({
      role,
      provider,
      model,
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
      edge_function: edgeFunction ?? null,
      household_id: householdId ?? null,
    })
  } catch (logErr) {
    console.error('[ai-client] Token log insert failed (non-fatal):', logErr)
  }

  return { content, usage, provider, model }
}

// Test-only export — not used by production callers
export const ROLE_CONFIG_FOR_TEST = ROLE_CONFIG
