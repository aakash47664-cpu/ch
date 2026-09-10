import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { sendAiChatMessage } from '../services/api';
import {
  BrainCircuit,
  Send,
  Sparkles,
  RefreshCw,
  Cpu,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  Bot,
  User,
  ChevronRight
} from 'lucide-react';

interface AiChatPanelProps {
  selectedEquipment?: string;
  onClearSelectedEquipment?: () => void;
  processContext?: any;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'init-1',
    sender: 'ai',
    text: "Hello! I am ChemDiag Industrial AI. Ask me anything about chemical engineering, equipment operations, process thermodynamics, control loops, or live process behavior across P-101, E-101, R-101, and D-101.",
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    provider: 'industrial_ai'
  }
];

const SUGGESTION_CHIPS = [
  'Why is the pump abnormal?',
  'Explain pump cavitation & check P-101',
  'What is compressor surge?',
  'How does distillation column flooding occur?',
  'What is cascade PID control?',
  'Explain reactor thermal runaway kinetics',
  'What is HAZOP methodology?',
  'Why did AI detect this fault?',
  'What will happen next?',
  'Give me a process summary'
];

export const AiChatPanel: React.FC<AiChatPanelProps> = ({
  selectedEquipment,
  onClearSelectedEquipment,
  processContext
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Focus input on mount or when equipment changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [selectedEquipment]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      equipment: selectedEquipment
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await sendAiChatMessage(text, newHistory, selectedEquipment, processContext);
      const replyText = response.response || response.answer || "Operating nominally within design tolerances.";
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        equipment: response.equipment,
        provider: response.provider
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: "Industrial AI is temporarily reconnecting. Please ask your question again, or verify network connectivity.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages(INITIAL_MESSAGES);
    if (onClearSelectedEquipment) onClearSelectedEquipment();
  };

  const getPlaceholderText = () => {
    if (selectedEquipment) {
      const name = selectedEquipment === 'pump' ? 'P-101'
        : selectedEquipment === 'heat_exchanger' ? 'E-101'
        : selectedEquipment === 'reactor' ? 'R-101'
        : selectedEquipment === 'distillation' ? 'D-101'
        : selectedEquipment;
      return `Ask about ${name} or general engineering...`;
    }
    return "Ask anything about industrial processes...";
  };

  return (
    <div className="ai-chat-container" aria-label="ChemDiag Industrial AI Assistant">
      {/* 1. CHAT HEADER */}
      <div className="chat-header">
        <div className="chat-header-title-group">
          <div className="chat-brain-icon">
            <BrainCircuit size={17} />
          </div>
          <div>
            <div className="chat-title">
              CHEMDIAG INDUSTRIAL AI <span className="copilot-tag">UNIVERSAL INTELLIGENCE</span>
            </div>
            <p className="chat-subtitle">
              Intelligent Industrial Process Assistant
            </p>
          </div>
        </div>

        <div className="chat-header-actions">
          {/* AI Online Status Badge */}
          <div
            className="provider-badge rule"
            title="ChemDiag Industrial AI is active and monitoring live process telemetry"
          >
            <span className="copilot-online-dot">●</span>
            <span>INDUSTRIAL AI ONLINE</span>
          </div>

          <button
            className="clear-chat-btn"
            onClick={handleClearChat}
            title="Reset conversation"
          >
            <RefreshCw size={12} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Selected Equipment Context Pill if active */}
      {selectedEquipment && (
        <div className="chat-context-banner">
          <span>Active Context: <strong>{selectedEquipment.toUpperCase()}</strong></span>
          <button className="clear-context-btn" onClick={onClearSelectedEquipment}>
            ✕ Clear Equipment Focus
          </button>
        </div>
      )}

      {/* 2. SUGGESTION CHIPS */}
      <div className="suggestion-chips-bar">
        <span className="chips-label">Suggested:</span>
        <div className="chips-list">
          {SUGGESTION_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              className="suggestion-chip-btn"
              onClick={() => handleSendMessage(chip)}
              disabled={isLoading}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* 3. MESSAGE FEED */}
      <div className="chat-messages-feed">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-message-row ${msg.sender === 'user' ? 'user-row' : 'ai-row'}`}
          >
            <div className="message-avatar">
              {msg.sender === 'user' ? <User size={13} /> : <Bot size={13} />}
            </div>

            <div className="message-bubble">
              <div className="message-sender-name">
                {msg.sender === 'user' ? 'Operator' : 'ChemDiag Industrial AI'}
                <span className="message-timestamp">{msg.timestamp}</span>
              </div>

              <div className="message-body-text">
                {msg.text.split('\n').map((line, i) => (
                  <React.Fragment key={i}>
                    {line.startsWith('•') || line.startsWith('-') ? (
                      <div className="message-bullet-line">{line}</div>
                    ) : line.startsWith('CURRENT PROCESS STATUS:') || line.startsWith('RECOMMENDED') || line.startsWith('SEVERITY ASSESSMENT:') || line.startsWith('Evidence:') || line.startsWith('Probable Root Cause:') || line.startsWith('Why AI Diagnosed This:') || line.startsWith('Action:') || line.startsWith('FAULT PROGRESSION') || line.startsWith('WHY DID AI DETECT THIS?') || line.startsWith('PREVENTIVE RISK SCORE:') || line.startsWith('CHEMDIAG DIGITAL TWIN') || line.startsWith('PUMP CAVITATION') || line.startsWith('DYNAMIC COMPRESSORS') || line.startsWith('PROCESS CONTROL') || line.startsWith('DISTILLATION TRAY') || line.startsWith('CHEMICAL REACTOR') || line.startsWith('HEAT EXCHANGER') || line.startsWith('PROCESS SAFETY') ? (
                      <div className="message-section-heading">{line}</div>
                    ) : (
                      <p style={{ margin: line === '' ? '4px 0' : '2px 0' }}>{line}</p>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* Loading Typing Indicator */}
        {isLoading && (
          <div className="chat-message-row ai-row">
            <div className="message-avatar">
              <Bot size={13} />
            </div>
            <div className="message-bubble loading-bubble">
              <span className="typing-dots"></span>
              <span className="analyzing-text">Industrial AI is analyzing process state and engineering principles...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. CHAT INPUT BAR */}
      <div className="chat-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="chat-input-field"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={getPlaceholderText()}
          disabled={isLoading}
        />
        <button
          className="chat-send-btn"
          onClick={() => handleSendMessage()}
          disabled={!inputValue.trim() || isLoading}
        >
          <span>ASK AI</span>
          <Send size={13} />
        </button>
      </div>
    </div>
  );
};

export default AiChatPanel;
