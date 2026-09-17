import React, { useState } from 'react';
import {
  ProcessUpdatePayload
} from '../../types';
import { AiDiagnosisPanel } from '../AiDiagnosisPanel';
import { MlMonitoringWorkspace } from './MlMonitoringWorkspace';
import { BrainCircuit, Activity, Cpu, Flame, Layers, Sparkles } from 'lucide-react';

interface AiWorkspaceProps {
  state: ProcessUpdatePayload;
  selectedEquipment?: string;
  onNavigateTab?: (tab: 'overview' | 'flowsheet' | 'pump' | 'heat_exchanger' | 'reactor' | 'distillation' | 'ai_diagnosis' | 'alerts') => void;
  onAskAiAbout?: (unitId: string) => void;
}

export const AiWorkspace: React.FC<AiWorkspaceProps> = ({
  state,
  selectedEquipment,
  onNavigateTab,
  onAskAiAbout
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'ml_monitoring' | 'ai_copilot'>('ml_monitoring');

  return (
    <div className="ai-workspace">
      {/* Workspace Header with Top-Level Mode Selector */}
      <div className="workspace-header-banner">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="workspace-icon-box bg-blue-50 text-blue-700">
              <BrainCircuit size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="workspace-title">CONTINUOUS ML &amp; INDUSTRIAL DECISION ENGINE</h2>
                <span className="status-badge nominal">ML &amp; AI ENGINE ACTIVE</span>
              </div>
              <p className="workspace-subtitle">
                Dual-Pipeline: Unsupervised Isolation Forest Anomaly Detection + Multi-Class Random Forest Classification &bull; XAI Feature Attribution &bull; Grounded AI Copilot
              </p>
            </div>
          </div>

          {/* Top-Level Mode Selector Tabs */}
          <div className="workspace-mode-toggle">
            <button
              type="button"
              className={`mode-toggle-btn ${activeSubTab === 'ml_monitoring' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('ml_monitoring')}
            >
              <Activity size={15} />
              <span>CONTINUOUS ML MONITORING</span>
            </button>
            <button
              type="button"
              className={`mode-toggle-btn ${activeSubTab === 'ai_copilot' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('ai_copilot')}
            >
              <Sparkles size={15} />
              <span>INDUSTRIAL AI COPILOT &amp; DECISION</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-View 1: ML MONITORING DASHBOARD (Section 17 Structure) */}
      {activeSubTab === 'ml_monitoring' && (
        <div className="tab-content-anim">
          <MlMonitoringWorkspace
            state={state}
            initialEquipmentId={selectedEquipment || 'heat_exchanger'}
            onNavigateTab={onNavigateTab}
            onAskAiAbout={onAskAiAbout}
          />
        </div>
      )}

      {/* Sub-View 2: INDUSTRIAL AI COPILOT & DECISION ENGINE */}
      {activeSubTab === 'ai_copilot' && (
        <div className="tab-content-anim">
          <AiDiagnosisPanel
            diagnosis={state.diagnosis}
            equipment={state.equipment}
            initialChatEquipment={selectedEquipment}
          />
        </div>
      )}
    </div>
  );
};
