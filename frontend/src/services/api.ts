import { AlertItem, Diagnosis, FaultMode, ChatMessage, ChatResponse, ManualControlOverrides } from '../types';

const API_BASE = '/api';

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
    .map(h => ({
      sender: h.sender,
      role: (h.sender === 'user' || (h as any).role === 'user') ? 'user' : 'assistant',
      text: h.text || (h as any).content,
      content: h.text || (h as any).content
    }));

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
    throw new Error(errData.error || `AI Chat request failed with status ${res.status}`);
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




