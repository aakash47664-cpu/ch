import React, { useState } from 'react';
import {
  ProcessUpdatePayload
} from '../../types';
import { AiDiagnosisPanel } from '../AiDiagnosisPanel';
import { MlMonitoringWorkspace } from './MlMonitoringWorkspace';
import { AutomaticProblemAnalysisPanel } from '../AutomaticProblemAnalysisPanel';
import { useAutomaticProblemAnalysis } from '../../hooks/useAutomaticProblemAnalysis';
import { BrainCircuit, Activity, Cpu, Flame, Layers, Sparkles, Wrench } from 'lucide-react';

interface AiWorkspaceProps {
  state: ProcessUpdatePayload;
  selectedEquipment?: string;
  onNavigateTab?: (tab: 'overview' | 'flowsheet' | 'pump' | 'heat_exchanger' | 'reactor' | 'distillation' | 'ai_diagnosis' | 'alerts') => void;
  onAskAiAbout?: (unitId: string, initialPrompt?: string) => void;
}

export const AiWorkspace: React.FC<AiWorkspaceProps> = ({
  state,
  selectedEquipment,
  onNavigateTab,
  onAskAiAbout
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'auto_analysis' | 'ml_monitoring' | 'ai_copilot'>('auto_analysis');
  const [copilotInitialPrompt, setCopilotInitialPrompt] = useState<string | undefined>();
  const [copilotEquipment, setCopilotEquipment] = useState<string | undefined>(selectedEquipment);

  // Automatic AI Problem Analysis hook
  const {
    currentAnalysis,
    activeProblemAnalyses,
    recentAnalyses,
    failureHistory,
    isAnalyzing,
    lastAnalysisTime,
    aiError,
    selectedUnitId,
    setSelectedUnitId,
    triggerManualAnalysis
  } = useAutomaticProblemAnalysis(state);

  const handleAskAiFollowUp = (equipId: string, prompt?: string) => {
    setCopilotEquipment(equipId);
    setCopilotInitialPrompt(prompt);
    setActiveSubTab('ai_copilot');
    if (onAskAiAbout) {
      onAskAiAbout(equipId, prompt);
    }
  };

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
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="workspace-title">CONTINUOUS ML &amp; INDUSTRIAL DECISION ENGINE</h2>
                <span className="status-badge nominal">● ML &amp; AI ENGINE ACTIVE</span>
              </div>
            </div>
          </div>

          {/* Top-Level Mode Selector Tabs */}
          <div className="workspace-mode-toggle">
            <button
              type="button"
              className={`mode-toggle-btn ${activeSubTab === 'auto_analysis' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('auto_analysis')}
            >
              <Wrench size={14} />
              <span>AUTOMATIC AI PROBLEM ANALYSIS</span>
            </button>
            <button
              type="button"
              className={`mode-toggle-btn ${activeSubTab === 'ml_monitoring' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('ml_monitoring')}
            >
              <Activity size={14} />
              <span>CONTINUOUS ML MONITORING</span>
            </button>
            <button
              type="button"
              className={`mode-toggle-btn ${activeSubTab === 'ai_copilot' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('ai_copilot')}
            >
              <Sparkles size={14} />
              <span>INDUSTRIAL AI COPILOT</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-View 1: DEDICATED AUTOMATIC AI PROBLEM ANALYSIS (Core Major Feature) */}
      {activeSubTab === 'auto_analysis' && (
        <div className="tab-content-anim">
          <AutomaticProblemAnalysisPanel
            currentAnalysis={currentAnalysis}
            activeProblemAnalyses={activeProblemAnalyses}
            recentAnalyses={recentAnalyses}
            failureHistory={failureHistory}
            isAnalyzing={isAnalyzing}
            lastAnalysisTime={lastAnalysisTime}
            aiError={aiError}
            selectedUnitId={selectedUnitId}
            onSelectUnit={setSelectedUnitId}
            onManualReanalyze={triggerManualAnalysis}
            onAskAiFollowUp={handleAskAiFollowUp}
          />
        </div>
      )}

      {/* Sub-View 2: CONTINUOUS ML MONITORING DASHBOARD (Section 17 Structure) */}
      {activeSubTab === 'ml_monitoring' && (
        <div className="tab-content-anim">
          <MlMonitoringWorkspace
            state={state}
            initialEquipmentId={selectedEquipment || 'heat_exchanger'}
            onNavigateTab={onNavigateTab}
            onAskAiAbout={(unit) => handleAskAiFollowUp(unit)}
          />
        </div>
      )}

      {/* Sub-View 3: INDUSTRIAL AI COPILOT & DECISION ENGINE */}
      {activeSubTab === 'ai_copilot' && (
        <div className="tab-content-anim">
          <AiDiagnosisPanel
            diagnosis={state.diagnosis}
            equipment={state.equipment}
            initialChatEquipment={copilotEquipment}
          />
        </div>
      )}
    </div>
  );
};

export default AiWorkspace;
