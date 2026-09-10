import { AlertItem, Diagnosis, FaultMode, ChatMessage, ChatResponse } from '../types';

const API_BASE = '/api';

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
  const res = await fetch(`${API_BASE}/alerts`);
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
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

export async function sendAiChatMessage(
  message: string,
  history: ChatMessage[] = [],
  equipment?: string,
  processContext?: any
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
      processContext
    })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `AI Chat request failed with status ${res.status}`);
  }
  return res.json();
}

export async function updateSimulatorControls(controls: {
  pump_rpm?: number;
  heat_exchanger_efficiency?: number;
  cooling_status?: number;
  reflux_ratio?: number;
  agitator_speed?: number;
}) {
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
