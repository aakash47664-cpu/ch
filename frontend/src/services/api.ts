import { AlertItem, Diagnosis, FaultMode, ChatMessage, ChatResponse, ManualControlOverrides, IntermittentEvent, IntermittentRecurrenceStats, IntermittentDetectorState } from '../types';

// Centralized API Configuration for ChemDiag Industrial AI
const getApiBaseUrl = (): string => {
  // 1. Explicit VITE_API_URL from environment (e.g., Render URL in production)
  const envApiUrl = import.meta.env.VITE_API_URL;
  if (envApiUrl && typeof envApiUrl === 'string' && envApiUrl.trim()) {
    const cleanUrl = envApiUrl.trim().replace(/\/+$/, '');
    return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
  }
  // 2. In browser dev mode on localhost, target port 8000
  if (typeof window !== 'undefined') {
    if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '8000') {
      return 'http://localhost:8000/api';
    }
  }
  // 3. Fallback to relative /api for production reverse proxy or express static hosting
  return '/api';
};

export const API_BASE = getApiBaseUrl();

export function normalizeAlerts(response: unknown): AlertItem[] {
  if (!response) return [];

  if (Array.isArray(response)) {
    return response.map((item: any, idx: number) => ({
      id: typeof item.id === 'number' ? item.id : (typeof item.db_id === 'number' ? item.db_id : idx + 1),
      timestamp: String(item.timestamp || item.triggered_at || new Date().toISOString()),
      equipment: String(item.equipment || 'All Units'),
      fault: String(item.fault || item.title || 'Process Anomaly'),
      root_cause: String(item.root_cause || item.likely_cause || item.explanation || 'Operating parameter deviation'),
      severity: item.severity || 'WARNING'
    }));
  }

  if (typeof response === 'object' && response !== null) {
    const obj = response as Record<string, unknown>;
    const rawList = Array.isArray(obj.history)
      ? obj.history
      : Array.isArray(obj.alerts)
      ? obj.alerts
      : Array.isArray(obj.active_alerts)
      ? obj.active_alerts
      : Array.isArray(obj.data)
      ? obj.data
      : (obj.data && typeof obj.data === 'object' && Array.isArray((obj.data as any).alerts))
      ? (obj.data as any).alerts
      : (obj.data && typeof obj.data === 'object' && Array.isArray((obj.data as any).history))
      ? (obj.data as any).history
      : [];

    return rawList.map((item: any, idx: number) => ({
      id: typeof item.id === 'number' ? item.id : (typeof item.db_id === 'number' ? item.db_id : idx + 1),
      timestamp: String(item.timestamp || item.triggered_at || new Date().toISOString()),
      equipment: String(item.equipment || 'All Units'),
      fault: String(item.fault || item.title || 'Process Anomaly'),
      root_cause: String(item.root_cause || item.likely_cause || item.explanation || 'Operating parameter deviation'),
      severity: item.severity || 'WARNING'
    }));
  }

  return [];
}

export async function fetchEquipment() {
  const res = await fetch(`${API_BASE}/equipment`);
  if (!res.ok) throw new Error('Failed to fetch equipment overview');
  return res.json();
}

export async function fetchDiagnosis(): Promise<Diagnosis> {
  const res = await fetch(`${API_BASE}/diagnosis`);
  if (!res.ok) throw new Error('Failed to fetch diagnosis');
  return res.json();
}

export async function fetchAlerts(): Promise<AlertItem[]> {
  try {
    const res = await fetch(`${API_BASE}/alerts`);
    if (!res.ok) throw new Error(`Failed to fetch alerts: ${res.status}`);
    const data = await res.json();
    return normalizeAlerts(data);
  } catch (err) {
    console.warn('fetchAlerts error:', err);
    return [];
  }
}

export async function setDemoFault(fault: FaultMode) {
  const res = await fetch(`${API_BASE}/demo/fault`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fault })
  });
  if (!res.ok) throw new Error('Failed to set demo fault');
  return res.json();
}

export async function approveOperatorRecommendation(note: string = '') {
  const res = await fetch(`${API_BASE}/diagnosis/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note })
  });
  if (!res.ok) throw new Error('Failed to approve operator recommendation');
  return res.json();
}

export async function fetchSystemStatus() {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) throw new Error('Failed to fetch system status');
  return res.json();
}

export async function fetchAiHealth() {
  const res = await fetch(`${API_BASE}/ai/health`);
  if (!res.ok) throw new Error('Failed to fetch AI health');
  return res.json();
}

export async function sendAiChatMessage(
  message: string,
  history: ChatMessage[] = [],
  equipment?: string,
  processContext?: any,
  provider: 'gemini' | 'groq' = 'gemini'
): Promise<ChatResponse> {
  const cleanHistory = (history || [])
    .filter(h => h && (h.text || (h as any).content))
    .slice(-8)
    .map(h => {
      const rawText = String(h.text || (h as any).content || '');
      const trimmedText = rawText.length > 800 ? rawText.substring(0, 800) + '...' : rawText;
      return {
        sender: h.sender,
        role: (h.sender === 'user' || (h as any).role === 'user') ? 'user' : 'assistant',
        text: trimmedText,
        content: trimmedText
      };
    });

  const res = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      conversation: cleanHistory,
      history: cleanHistory,
      selectedEquipment: equipment,
      equipment,
      processContext,
      provider
    })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || errData.message || `AI Chat request failed with status ${res.status}`);
  }
  return res.json();
}

export async function updateSimulatorControls(controls: ManualControlOverrides) {
  const res = await fetch(`${API_BASE}/simulator/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(controls)
  });
  if (!res.ok) throw new Error('Failed to update process controls');
  return res.json();
}

export async function resetSimulatorControls() {
  const res = await fetch(`${API_BASE}/simulator/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('Failed to reset process controls');
  return res.json();
}

export async function runWhatIfScenario(
  question: string,
  currentState?: any,
  conversation: any[] = [],
  scenarios?: any[],
  provider: 'gemini' | 'groq' = 'gemini'
) {
  const cleanConversation = (conversation || [])
    .filter(turn => turn && (turn.text || turn.content || turn.message))
    .map(turn => ({
      role: (turn.sender === 'user' || turn.role === 'user') ? 'user' : 'assistant',
      content: String(turn.text || turn.content || turn.message)
    }));

  const res = await fetch(`${API_BASE}/ai/what-if`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      currentState,
      conversation: cleanConversation,
      history: cleanConversation,
      scenarios,
      provider
    })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `What-If Simulation request failed with status ${res.status}`);
  }

  return res.json();
}

// ==========================================
// INTELLIGENT ALERTS APIS
// ==========================================

export async function fetchActiveAlerts() {
  const res = await fetch(`${API_BASE}/alerts/active`);
  if (!res.ok) throw new Error('Failed to fetch active alerts');
  return res.json();
}

export async function fetchAlertHistory(limit: number = 50) {
  const res = await fetch(`${API_BASE}/alerts/history?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch alert history');
  return res.json();
}

export async function acknowledgeAlert(id: string, operator: string = 'Plant Operator') {
  const res = await fetch(`${API_BASE}/alerts/${id}/acknowledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operator })
  });
  if (!res.ok) throw new Error('Failed to acknowledge alert');
  return res.json();
}

export async function clearAlert(id: string, operator: string = 'Plant Operator') {
  const res = await fetch(`${API_BASE}/alerts/${id}/clear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operator })
  });
  if (!res.ok) throw new Error('Failed to clear alert');
  return res.json();
}

export async function acknowledgeAllAlerts(operator: string = 'Plant Operator') {
  const res = await fetch(`${API_BASE}/alerts/acknowledge-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operator })
  });
  if (!res.ok) throw new Error('Failed to acknowledge all alerts');
  return res.json();
}

// Backward compatibility alias for fetchScadaAlarms
export async function fetchScadaAlarms() {
  const res = await fetch(`${API_BASE}/alerts`);
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
}

export async function resetProcessSimulation(operator: string = 'Plant Operator') {
  const res = await fetch(`${API_BASE}/process/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operator })
  });
  if (!res.ok) throw new Error('Failed to reset process simulation');
  return res.json();
}

export async function fetchProcessHistory(limit: number = 60) {
  const res = await fetch(`${API_BASE}/process/history?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch process history');
  return res.json();
}

export async function fetchEventLogs(limit: number = 100, type?: string, severity?: string) {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (type) params.set('type', type);
  if (severity) params.set('severity', severity);
  
  const res = await fetch(`${API_BASE}/events?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch event logs');
  return res.json();
}

export async function fetchAuditTrail(limit: number = 100, equipment?: string) {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (equipment) params.set('equipment', equipment);
  
  const res = await fetch(`${API_BASE}/audit?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch audit trail');
  return res.json();
}

export async function fetchMaintenance(status?: string, equipment?: string) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (equipment) params.set('equipment', equipment);
  
  const res = await fetch(`${API_BASE}/maintenance?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch maintenance tickets');
  return res.json();
}

export async function createMaintenanceTicket(data: {
  equipment: string;
  title: string;
  description?: string;
  priority?: string;
  assigned_to?: string;
  created_by?: string;
}) {
  const res = await fetch(`${API_BASE}/maintenance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create maintenance ticket');
  return res.json();
}

export async function updateMaintenanceStatus(id: number, data: {
  status: string;
  resolved_by?: string;
  resolution_notes?: string;
}) {
  const res = await fetch(`${API_BASE}/maintenance/${id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update maintenance ticket status');
  return res.json();
}

// ==========================================
// ADJUSTABLE CAUSAL PROCESS WORKFLOW APIS
// ==========================================

export async function fetchWorkflow() {
  const res = await fetch(`${API_BASE}/workflow`);
  if (!res.ok) throw new Error('Failed to fetch process workflow');
  return res.json();
}

export async function updateWorkflow(data: {
  nodes?: any;
  connections?: any[];
  sequence?: string[];
  operator?: string;
}) {
  const res = await fetch(`${API_BASE}/workflow/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update process workflow');
  return res.json();
}

export async function resetWorkflow(operator: string = 'Plant Operator') {
  const res = await fetch(`${API_BASE}/workflow/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operator })
  });
  if (!res.ok) throw new Error('Failed to reset process workflow');
  return res.json();
}

export async function resetSimulation() {
  const res = await fetch(`${API_BASE}/simulator/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('Failed to reset simulation');
  return res.json();
}

export async function setSimulatorScenario(fault: string) {
  const res = await fetch(`${API_BASE}/demo/fault`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fault })
  });
  if (!res.ok) throw new Error('Failed to set simulation scenario');
  return res.json();
}

// ==========================================
// INTERMITTENT & TRANSIENT FAULTS API
// ==========================================

export async function fetchIntermittentState(): Promise<IntermittentDetectorState> {
  const res = await fetch(`${API_BASE}/intermittent-faults/state`);
  if (!res.ok) throw new Error('Failed to fetch intermittent fault state');
  return res.json();
}

export async function fetchIntermittentEvents(params: { equipment?: string; pattern?: string; status?: string; limit?: number } = {}): Promise<{ count: number; events: IntermittentEvent[] }> {
  const query = new URLSearchParams();
  if (params.equipment && params.equipment !== 'ALL') query.append('equipment', params.equipment);
  if (params.pattern && params.pattern !== 'ALL') query.append('pattern', params.pattern);
  if (params.status && params.status !== 'ALL') query.append('status', params.status);
  if (params.limit) query.append('limit', String(params.limit));

  const url = `${API_BASE}/intermittent-faults/events${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch intermittent events');
  return res.json();
}

export async function fetchIntermittentEventDetail(eventId: string): Promise<{ event: IntermittentEvent }> {
  const res = await fetch(`${API_BASE}/intermittent-faults/events/${encodeURIComponent(eventId)}`);
  if (!res.ok) throw new Error(`Failed to fetch event detail for ${eventId}`);
  return res.json();
}

export async function fetchIntermittentStats(): Promise<{ stats: IntermittentRecurrenceStats; live: any }> {
  const res = await fetch(`${API_BASE}/intermittent-faults/stats`);
  if (!res.ok) throw new Error('Failed to fetch intermittent fault statistics');
  return res.json();
}

export async function triggerIntermittentTestPulse(equipment: string = 'pump', modeOrDuration: string | number = 'single_spike') {
  const payload = typeof modeOrDuration === 'number'
    ? { equipment, duration: modeOrDuration, mode: 'single_spike' }
    : { equipment, mode: modeOrDuration };
  const res = await fetch(`${API_BASE}/intermittent-faults/trigger-pulse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to trigger intermittent test pulse');
  return res.json();
}

export async function clearIntermittentHistory() {
  const res = await fetch(`${API_BASE}/intermittent-faults/clear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('Failed to clear intermittent history');
  return res.json();
}





