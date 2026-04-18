// supabase/functions/_shared/ai-client.ts
import { createServiceClient } from './auth.ts'

// D-01: Role config map — hardcoded, not overridable by callers
const ROLE_CONFIG: Record<string, { temperature: number; max_tokens: number }> = {
  'coordinator':         { temperature: 0.7, max_tokens: 4096 },
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

function truncateLogText(value: string | null | undefined, maxLength = 16000): string | null {
  if (!value) {
    return null
  }

  return value.length > maxLength
    ? `${value.slice(0, maxLength)}\n...[truncated]`
    : value
}

async function logAIUsage(payload: {
  role: AIRole
  provider: string
  model: string
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  edgeFunction?: string
  householdId?: string
  promptText: string
  responseText?: string | null
  errorText?: string | null
  statusCode: number
  latencyMs: number
}) {
  try {
    const serviceClient = createServiceClient()
    const usage = payload.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

    await serviceClient.from('ai_usage_log').insert({
      role: payload.role,
      provider: payload.provider,
      model: payload.model,
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
      edge_function: payload.edgeFunction ?? null,
      household_id: payload.householdId ?? null,
      prompt_text: truncateLogText(payload.promptText),
      response_text: truncateLogText(payload.responseText),
      error_text: truncateLogText(payload.errorText),
      status_code: payload.statusCode,
      latency_ms: payload.latencyMs,
    })
  } catch (logErr) {
    console.error('[ai-client] Token log insert failed (non-fatal):', logErr)
  }
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
  const startedAt = Date.now()
  const promptText = `SYSTEM:\n${systemPrompt}\n\nUSER:\n${userPrompt}`
  let errorLogged = false

  try {
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
      errorLogged = true
      await logAIUsage({
        role,
        provider,
        model,
        edgeFunction,
        householdId,
        promptText,
        errorText: `AI provider error (${provider}): ${errorText}`,
        statusCode: response.status,
        latencyMs: Date.now() - startedAt,
      })
      throw new Error(`AI provider error (${provider}): ${errorText}`)
    }

    const result = await response.json()
    let content: string = result.choices[0].message.content.trim()
    // Strip markdown fences if present (same as ai-proxy logic)
    if (content.startsWith('```')) {
      content = content.replace(/^```[a-z]*\n/i, '').replace(/\n```$/g, '')
    }

    const usage = result.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

    await logAIUsage({
      role,
      provider,
      model,
      usage,
      edgeFunction,
      householdId,
      promptText,
      responseText: content,
      statusCode: response.status,
      latencyMs: Date.now() - startedAt,
    })

    return { content, usage, provider, model }
  } catch (error) {
    if (!errorLogged) {
      await logAIUsage({
        role,
        provider,
        model,
        edgeFunction,
        householdId,
        promptText,
        errorText: error instanceof Error ? error.message : 'Unknown AI client error',
        statusCode: 500,
        latencyMs: Date.now() - startedAt,
      })
    }
    throw error
  }
}

// Test-only export — not used by production callers
export const ROLE_CONFIG_FOR_TEST = ROLE_CONFIG
