import React from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  MessageSquare,
  GitBranch,
  Wrench,
  ShieldAlert,
  Layers,
  ChevronRight,
  Activity,
  Cpu
} from 'lucide-react';
import { LiveEquipmentAnalysisResult } from '../hooks/useLiveEquipmentAiAnalysis';
import { FormattedChatMessage } from './FormattedChatMessage';

interface LiveEquipmentAiAnalysisCardProps {
  equipmentId: string;
  equipmentTag: string;
  equipmentFullName: string;
  result: LiveEquipmentAnalysisResult | null;
  isAnalyzing: boolean;
  error: string | null;
  onAnalyze: () => void;
  onAskFollowUp: (question: string) => void;
}

export const LiveEquipmentAiAnalysisCard: React.FC<LiveEquipmentAiAnalysisCardProps> = ({
  equipmentId,
  equipmentTag,
  equipmentFullName,
  result,
  isAnalyzing,
  error,
  onAnalyze,
  onAskFollowUp
}) => {
  const followUpSuggestions = [
    'Why do you think this is happening?',
    'What should I check first?',
    'Could this be a sensor problem?',
    'What happens if this condition continues?'
  ];

  // 1. Loading State
  if (isAnalyzing) {
    return (
      <div className="live-ai-card analyzing">
        <div className="live-ai-loading-box">
          <div className="live-ai-spinner-row">
            <span className="live-ai-spinner" />
            <Sparkles size={16} className="live-ai-sparkle-spin text-cyan-400" />
            <span className="live-ai-loading-title">
              ANALYZING REAL-TIME TELEMETRY FOR {equipmentTag}...
            </span>
          </div>
          <p className="live-ai-loading-desc">
            Evaluating live sensor vectors, baseline deviations, and Aspen mass-energy interactions via ChemDiag Industrial AI.
          </p>
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div className="live-ai-card error">
        <div className="live-ai-error-box">
          <div className="flex items-center gap-2 text-rose-500 font-semibold text-sm">
            <AlertTriangle size={16} />
            <span>AI ANALYSIS FAILED</span>
          </div>
          <p className="live-ai-error-msg">{error}</p>
          <button className="live-ai-retry-btn" onClick={onAnalyze}>
            <RotateCcw size={13} />
            <span>Retry Analysis</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. No analysis yet state (Prompt state)
  if (!result) {
    return (
      <div className="live-ai-card idle">
        <div className="live-ai-idle-box">
          <div className="live-ai-idle-left">
            <div className="live-ai-idle-icon">
              <Sparkles size={18} color="var(--primary-blue)" />
            </div>
            <div>
              <h4 className="live-ai-idle-title">LIVE ENGINEERING AI DIAGNOSIS AVAILABLE</h4>
              <p className="live-ai-idle-desc">
                Click <strong>"ANALYZE WITH AI"</strong> to run a live chemical-engineering root cause analysis on {equipmentTag} ({equipmentFullName}) using current live sensor measurements and Aspen flowsheet baselines.
              </p>
            </div>
          </div>
          <button className="live-ai-trigger-btn" onClick={onAnalyze}>
            <Sparkles size={14} />
            <span>ANALYZE {equipmentTag} WITH AI</span>
          </button>
        </div>
      </div>
    );
  }

  // 4. Completed AI Analysis Card
  const { sections, timestamp, healthScore, stage, riskScore, provider, rawText } = result;

  const hasStructuredSections =
    sections.whatIsHappening ||
    sections.keyEvidence.length > 0 ||
    sections.likelyCause ||
    sections.processImpact ||
    sections.whatToVerify.length > 0;

  return (
    <div className="live-ai-card completed">
      {/* Header Bar */}
      <div className="live-ai-header">
        <div className="live-ai-header-left">
          <div className="live-ai-badge-icon">
            <Sparkles size={15} color="#06B6D4" />
          </div>
          <div>
            <div className="live-ai-title-row">
              <h3 className="live-ai-title">CHEMDIAG AI ANALYSIS — {equipmentTag}</h3>
              <span className="live-ai-live-badge">✓ LIVE AI REASONING</span>
            </div>
            <div className="live-ai-meta-row">
              <span className="live-ai-meta-item">Unit: <strong>{equipmentFullName}</strong></span>
              <span className="live-ai-meta-divider">•</span>
              <span className="live-ai-meta-item">Analyzed at: <strong>{timestamp}</strong></span>
              <span className="live-ai-meta-divider">•</span>
              <span className="live-ai-meta-item">Provider: <strong>{provider}</strong></span>
            </div>
          </div>
        </div>

        <div className="live-ai-header-right">
          <div className="live-ai-scores-group">
            <span className="live-ai-score-chip health">
              Health: <strong>{healthScore}%</strong> ({stage})
            </span>
            <span className="live-ai-score-chip risk">
              Risk: <strong>{riskScore}/100</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="live-ai-body">
        {hasStructuredSections ? (
          <div className="live-ai-sections-grid">
            {/* SECTION 1: WHAT IS HAPPENING */}
            {sections.whatIsHappening && (
              <div className="live-ai-section-box">
                <div className="live-ai-sec-title">
                  <Activity size={13} color="var(--primary-blue)" />
                  <span>WHAT IS HAPPENING</span>
                </div>
                <div className="live-ai-sec-text">
                  <FormattedChatMessage text={sections.whatIsHappening} isAi={true} />
                </div>
              </div>
            )}

            {/* SECTION 2: KEY EVIDENCE */}
            {sections.keyEvidence && sections.keyEvidence.length > 0 && (
              <div className="live-ai-section-box">
                <div className="live-ai-sec-title">
                  <CheckCircle2 size={13} color="#16A34A" />
                  <span>KEY EVIDENCE & MEASUREMENTS</span>
                </div>
                <div className="live-ai-evidence-list">
                  {sections.keyEvidence.map((ev, idx) => (
                    <div key={idx} className="live-ai-evidence-item">
                      <span className="live-ai-check-icon">✓</span>
                      <div className="live-ai-evidence-content">
                        <FormattedChatMessage text={ev} isAi={true} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 3: LIKELY CAUSE */}
            {sections.likelyCause && (
              <div className="live-ai-section-box highlight-cause">
                <div className="live-ai-sec-title">
                  <Wrench size={13} color="#EA580C" />
                  <span>LIKELY ROOT CAUSE</span>
                </div>
                <div className="live-ai-sec-text">
                  <FormattedChatMessage text={sections.likelyCause} isAi={true} />
                </div>
              </div>
            )}

            {/* SECTION 4: ALTERNATIVE POSSIBILITIES */}
            {sections.alternativePossibilities && sections.alternativePossibilities.length > 0 && (
              <div className="live-ai-section-box">
                <div className="live-ai-sec-title">
                  <GitBranch size={13} color="#8B5CF6" />
                  <span>ALTERNATIVE POSSIBILITIES & CONSIDERATIONS</span>
                </div>
                <ul className="live-ai-bullet-list">
                  {sections.alternativePossibilities.map((alt, idx) => (
                    <li key={idx} className="live-ai-bullet-item">
                      <FormattedChatMessage text={alt} isAi={true} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* SECTION 5: PROCESS IMPACT */}
            {sections.processImpact && (
              <div className="live-ai-section-box">
                <div className="live-ai-sec-title">
                  <Layers size={13} color="#0284C7" />
                  <span>DOWNSTREAM PROCESS IMPACT</span>
                </div>
                <div className="live-ai-sec-text">
                  <FormattedChatMessage text={sections.processImpact} isAi={true} />
                </div>
              </div>
            )}

            {/* SECTION 6: WHAT TO VERIFY */}
            {sections.whatToVerify && sections.whatToVerify.length > 0 && (
              <div className="live-ai-section-box">
                <div className="live-ai-sec-title">
                  <CheckCircle2 size={13} color="#0D9488" />
                  <span>RECOMMENDED VERIFICATION & FIELD ACTIONS</span>
                </div>
                <div className="live-ai-verify-list">
                  {sections.whatToVerify.map((step, idx) => (
                    <div key={idx} className="live-ai-verify-step">
                      <span className="live-ai-step-num">{idx + 1}</span>
                      <div className="live-ai-step-text">
                        <FormattedChatMessage text={step} isAi={true} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 7: RISK ASSESSMENT */}
            {sections.riskAssessment && (
              <div className="live-ai-section-box highlight-risk">
                <div className="live-ai-sec-title">
                  <ShieldAlert size={13} color="#DC2626" />
                  <span>RISK & SEVERITY ASSESSMENT</span>
                </div>
                <div className="live-ai-sec-text">
                  <FormattedChatMessage text={sections.riskAssessment} isAi={true} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="live-ai-raw-text">
            <FormattedChatMessage text={rawText} isAi={true} />
          </div>
        )}
      </div>

      {/* Footer Actions & Interactive Follow-Up */}
      <div className="live-ai-footer">
        <div className="live-ai-footer-top">
          <div className="live-ai-followup-label">
            <MessageSquare size={13} color="var(--primary-blue)" />
            <span>ASK FOLLOW-UP QUESTIONS:</span>
          </div>

          <div className="live-ai-action-buttons">
            <button
              className="live-ai-reanalyze-btn"
              onClick={onAnalyze}
              title="Re-analyze with the newest live process state"
            >
              <RotateCcw size={12} />
              <span>ANALYZE AGAIN (LIVE)</span>
            </button>
            <button
              className="live-ai-followup-main-btn"
              onClick={() => onAskFollowUp(`Please explain more about the diagnosis for ${equipmentTag}`)}
            >
              <MessageSquare size={12} />
              <span>ASK AI FOLLOW-UP</span>
            </button>
          </div>
        </div>

        {/* Quick Follow-up Chips */}
        <div className="live-ai-chips-row">
          {followUpSuggestions.map((q, idx) => (
            <button
              key={idx}
              className="live-ai-chip-btn"
              onClick={() => onAskFollowUp(q)}
              title={`Ask: "${q}"`}
            >
              <span>{q}</span>
              <ChevronRight size={11} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
