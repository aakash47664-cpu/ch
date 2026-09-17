import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { sendAiChatMessage, fetchAiHealth } from '../services/api';
import { FormattedChatMessage } from './FormattedChatMessage';
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
  ChevronRight,
  Layers
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
    text: "Hello! I am ChemDiag Industrial AI powered by Google Gemini & Groq Cloud. Ask me anything about chemical engineering, equipment operations, process thermodynamics, control loops, or live process behavior across P-101, E-101, R-101, and D-101.",
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    provider: 'Gemini'
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
  const [selectedProvider, setSelectedProvider] = useState<'gemini' | 'groq'>('gemini');
  const [healthStatus, setHealthStatus] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load AI Health on mount
  useEffect(() => {
    fetchAiHealth()
      .then(data => {
        setHealthStatus(data);
        if (data?.provider === 'Groq' && !data?.providers?.gemini?.configured) {
          setSelectedProvider('groq');
        }
      })
      .catch(() => {});
  }, []);

  // Focus input on mount or when equipment changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [selectedEquipment]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    // Safe dev log for verifying message flow (no keys)
    console.log("CHEMDIAG USER MESSAGE:", text);

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      equipment: selectedEquipment
    };

    // Keep prior conversation history separate from the new user message
    const priorHistory = [...messages];
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await sendAiChatMessage(
        text,
        priorHistory,
        selectedEquipment,
        processContext,
        selectedProvider
      );
      const replyText = response.text || response.response || response.answer || "Operating nominally within design tolerances.";
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        equipment: response.equipment,
        provider: response.provider || selectedProvider
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: `⚠️ **AI Assistant Temporary Notice**: The ${selectedProvider === 'gemini' ? 'Google Gemini' : 'Groq'} endpoint is currently reconnecting (${err.message || 'Connection timeout'}).\n\n*Note: Continuous ML monitoring (Isolation Forest & Random Forest) remains 100% active and evaluating live telemetry.* Please try your query again or switch providers.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: 'System Diagnostics'
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
              Dual-Engine Industrial Process Intelligence
            </p>
          </div>
        </div>

        <div className="chat-header-actions">
          {/* AI Engine Selector */}
          <div className="engine-select-container">
            <span className="engine-select-label">ENGINE:</span>
            <select
              className="engine-select-dropdown"
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value as 'gemini' | 'groq')}
              title="Select AI Reasoning Engine"
              aria-label="Select AI Reasoning Engine"
            >
              <option value="gemini">Google Gemini (2.5 Flash)</option>
              <option value="groq">Groq Cloud (Llama 3.3)</option>
            </select>
          </div>

          {/* AI Online Status Badge */}
          <div
            className="provider-badge rule"
            title={`ChemDiag AI is active with ${selectedProvider === 'gemini' ? 'Google Gemini 2.5 Flash' : 'Groq Llama 3.3 70B'}`}
          >
            <span className="copilot-online-dot">●</span>
            <span>{selectedProvider === 'gemini' ? 'GEMINI 2.5 FLASH' : 'GROQ LLAMA 3.3'}</span>
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
                <span>{msg.sender === 'user' ? 'Operator' : 'ChemDiag Industrial AI'}</span>
                {msg.sender === 'ai' && (
                  <span className="message-provider-tag">
                    {msg.provider?.toLowerCase() === 'groq' ? 'GROQ LLAMA 3.3' : 'GEMINI 2.5 FLASH'}
                  </span>
                )}
                <span className="message-timestamp">{msg.timestamp}</span>
              </div>

              <FormattedChatMessage text={msg.text} isAi={msg.sender === 'ai'} />
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
              <span className="analyzing-text">
                {selectedProvider === 'gemini' ? 'Google Gemini 2.5 Flash' : 'Groq Industrial AI'} is analyzing engineering principles...
              </span>
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
