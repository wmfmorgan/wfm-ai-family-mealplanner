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
