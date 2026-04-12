import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { saveAiLog, getAiLogs, type AILog } from '../lib/ai/logger';

describe('AI Logger Utility', () => {
  const STORAGE_KEY = 'ai_logs';

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should save a log and retrieve it', () => {
    const logData: Omit<AILog, 'id' | 'timestamp'> = {
      provider: 'gemini',
      prompt: 'Hello',
      response: 'Hi there',
      latency: 100,
      status_code: 200,
    };

    saveAiLog(logData);
    const logs = getAiLogs();

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject(logData);
    expect(logs[0].id).toBeDefined();
    expect(logs[0].timestamp).toBeDefined();
  });

  it('should return logs newest first', () => {
    saveAiLog({ provider: 'gemini', prompt: 'First', latency: 100, status_code: 200 });
    // Small delay to ensure different timestamps if needed, 
    // but the implementation should prepend or sort.
    saveAiLog({ provider: 'gemini', prompt: 'Second', latency: 100, status_code: 200 });

    const logs = getAiLogs();
    expect(logs).toHaveLength(2);
    expect(logs[0].prompt).toBe('Second');
    expect(logs[1].prompt).toBe('First');
  });

  it('should only keep the last 10 logs', () => {
    for (let i = 1; i <= 12; i++) {
      saveAiLog({ 
        provider: 'gemini', 
        prompt: `Prompt ${i}`, 
        latency: 100, 
        status_code: 200 
      });
    }

    const logs = getAiLogs();
    expect(logs).toHaveLength(10);
    expect(logs[0].prompt).toBe('Prompt 12');
    expect(logs[9].prompt).toBe('Prompt 3');
  });

  it('should handle empty storage gracefully', () => {
    const logs = getAiLogs();
    expect(logs).toEqual([]);
  });

  it('should handle corrupted JSON in localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid-json');
    const logs = getAiLogs();
    expect(logs).toEqual([]);
  });
});
