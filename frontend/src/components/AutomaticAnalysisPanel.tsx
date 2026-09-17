import React from 'react';
import { AutomaticProblemAnalysisPanel } from './AutomaticProblemAnalysisPanel';
import { AutomaticAnalysisItem, FailureEventHistoryItem } from '../types';

interface AutomaticAnalysisPanelProps {
  currentAnalysis: AutomaticAnalysisItem | null;
  activeProblemAnalyses?: AutomaticAnalysisItem[];
  recentAnalyses: AutomaticAnalysisItem[];
  failureHistory?: FailureEventHistoryItem[];
  isAnalyzing: boolean;
  lastAnalysisTime: string | null;
  aiError?: string | null;
  selectedUnitId?: string | null;
  onSelectUnit?: (unitId: string) => void;
  onManualReanalyze?: (equipmentId: string) => void;
  onAskAiFollowUp: (equipmentId: string, initialQuestion?: string) => void;
}

export const AutomaticAnalysisPanel: React.FC<AutomaticAnalysisPanelProps> = (props) => {
  return <AutomaticProblemAnalysisPanel {...props} />;
};

export default AutomaticAnalysisPanel;
