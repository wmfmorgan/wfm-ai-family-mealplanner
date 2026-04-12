import { supabase } from '../supabase';
import { saveAiLog } from './logger';

export interface AskAIOptions {
  prompt: string;
  provider: string;
  model?: string;
}

export async function askAI({ prompt, provider, model }: AskAIOptions) {
  const startTime = performance.now();
  let statusCode = 0;
  let errorMessage: string | undefined;

  try {
    const { data, error } = await supabase.functions.invoke('ai-proxy', {
      body: { prompt, provider, model },
    });

    const latency = Math.round(performance.now() - startTime);

    if (error) {
      statusCode = error.status || 500;
      errorMessage = error.message;
      saveAiLog({
        provider,
        prompt,
        latency,
        status_code: statusCode,
        error: errorMessage,
      });
      throw error;
    }

    // Supabase functions.invoke returns the response body in `data`
    // but the actual status code isn't directly in the standard return for successful calls 
    // without more complex handling, but we can assume 200 if no error from invoke.
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
