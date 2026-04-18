import React, { useEffect, useState } from 'react';
import { getDisplayAiLogs, type AILog } from '../../lib/ai/logger';
import { RefreshCcw, ChevronDown, ChevronUp, AlertCircle, Clock } from 'lucide-react';

interface DebugLogProps {
  householdId?: string | null;
  quotaSummary?: {
    daily_limit: number;
    points_used_today: number;
    points_left_today: number;
  } | null;
}

function formatResponse(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

const DebugLog: React.FC<DebugLogProps> = ({ householdId, quotaSummary }) => {
  const [logs, setLogs] = useState<AILog[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refreshLogs = async () => {
    setLogs(await getDisplayAiLogs(householdId));
  };

  useEffect(() => {
    void refreshLogs();
  }, [householdId]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="debug-log">
      {quotaSummary && (
        <div className="debug-log-quota" data-testid="quota-summary">
          <div className="debug-log-header">
            <h3>Spoonacular quota</h3>
          </div>
          <p>{quotaSummary.points_used_today} / {quotaSummary.daily_limit}</p>
          <p>{quotaSummary.points_left_today} points left today</p>
        </div>
      )}

      <div className="debug-log-header">
        <h3>AI Interaction Log (Last 10)</h3>
        <button onClick={refreshLogs} className="icon-button" title="Refresh logs">
          <RefreshCcw size={16} />
        </button>
      </div>

      {logs.length === 0 ? (
        <p className="no-logs">No AI interactions logged yet.</p>
      ) : (
        <div className="log-list">
          {logs.map((log) => (
            <div key={log.id} className={`log-item ${log.status_code >= 400 ? 'error' : ''}`}>
              <div className="log-summary" onClick={() => toggleExpand(log.id)}>
                <div className="log-meta">
                  <span className="log-provider">{log.provider}</span>
                  <span className="log-status">
                    {log.status_code >= 400 && <AlertCircle size={12} />}
                    {log.status_code}
                  </span>
                  <span className="log-latency">
                    <Clock size={12} />
                    {log.latency}ms
                  </span>
                </div>
                <div className="log-timestamp">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
                {expandedId === log.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>

              {expandedId === log.id && (
                <div className="log-details">
                  <div className="log-section">
                    <label>Prompt:</label>
                    <pre>{log.prompt}</pre>
                  </div>
                  {log.response && (
                    <div className="log-section">
                      <label>Response:</label>
                      <pre>{formatResponse(log.response)}</pre>
                    </div>
                  )}
                  {log.error && (
                    <div className="log-section error-text">
                      <label>Error:</label>
                      <pre>{log.error}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DebugLog;
