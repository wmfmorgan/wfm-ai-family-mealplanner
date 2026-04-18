import { supabase } from '../supabase';

export interface AILog {
  id: string;
  timestamp: string;
  provider: string;
  prompt: string;
  response?: string;
  latency: number;
  status_code: number;
  error?: string;
}

const STORAGE_KEY = 'ai_logs';
const MAX_LOGS = 10;

export function getAiLogs(): AILog[] {
  try {
    const rawLogs = localStorage.getItem(STORAGE_KEY);
    if (!rawLogs) return [];
    const logs = JSON.parse(rawLogs);
    if (!Array.isArray(logs)) return [];
    return logs;
  } catch (error) {
    console.error('Failed to parse AI logs from localStorage:', error);
    return [];
  }
}

export function saveAiLog(logData: Omit<AILog, 'id' | 'timestamp'>): void {
  const newLog: AILog = {
    ...logData,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };

  const currentLogs = getAiLogs();
  const updatedLogs = [newLog, ...currentLogs].slice(0, MAX_LOGS);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLogs));
}

type ServerAILogRow = {
  id: string;
  created_at: string;
  provider: string;
  prompt_text: string | null;
  response_text: string | null;
  error_text: string | null;
  latency_ms: number | null;
  status_code: number | null;
  edge_function: string | null;
};

function mapServerLog(row: ServerAILogRow): AILog {
  const providerLabel = row.edge_function
    ? `${row.provider} · ${row.edge_function}`
    : row.provider;

  return {
    id: row.id,
    timestamp: row.created_at,
    provider: providerLabel,
    prompt: row.prompt_text ?? '[Prompt was not logged for this entry]',
    response: row.response_text ?? undefined,
    latency: row.latency_ms ?? 0,
    status_code: row.status_code ?? 200,
    error: row.error_text ?? undefined,
  };
}

export async function getDisplayAiLogs(householdId?: string | null): Promise<AILog[]> {
  const localLogs = getAiLogs();
  if (!householdId) {
    return localLogs;
  }

  try {
    const { data, error } = await supabase
      .from('ai_usage_log')
      .select('id, created_at, provider, prompt_text, response_text, error_text, latency_ms, status_code, edge_function')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(MAX_LOGS);

    if (error) {
      throw error;
    }

    const serverLogs = (data ?? []).map((row) => mapServerLog(row as ServerAILogRow));
    return [...serverLogs, ...localLogs]
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, MAX_LOGS);
  } catch (error) {
    console.error('Failed to load AI logs from Supabase:', error);
    return localLogs;
  }
}
