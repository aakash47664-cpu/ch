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
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'init-1',
    sender: 'ai',
    text: "Hello. I'm monitoring the current ChemDiag process. Ask me about any equipment or abnormal condition.",
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    provider: 'local_rule_engine'
  }
];

const SUGGESTION_CHIPS = [
  'Why is it abnormal?',
  'What is wrong with the pump?',
  'Which variable changed?',
  'Why is the reactor temperature increasing?',
  'What caused the distillation fault?',
  'What should I check?',
  'How serious is it?',
  'Is the process normal?',
  'Give me a process summary.',
  'Why did AI detect this fault?'
];

export const AiChatPanel: React.FC<AiChatPanelProps> = ({
  selectedEquipment,
  onClearSelectedEquipment
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
      const response = await sendAiChatMessage(text, newHistory, selectedEquipment);
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: response.answer,
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
        text: "Sorry, I couldn't process that question. Try asking about the current process, a specific equipment unit, or the active fault.",
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
        : selectedEquipment === 'heat_exchanger' ? 'E-102'
        : selectedEquipment === 'reactor' ? 'R-201'
        : selectedEquipment === 'distillation' ? 'D-101'
        : selectedEquipment;
      return `Ask about ${name} (e.g. "Why is ${name} abnormal?")...`;
    }
    return "Ask about current process, sensor values, faults, or recommendations...";
  };

  return (
    <div className="ai-chat-container" aria-label="Interactive AI Process Copilot">
      {/* 1. CHAT HEADER */}
      <div className="chat-header">
        <div className="chat-header-title-group">
          <div className="chat-brain-icon">
            <Bot size={16} />
          </div>
          <div>
            <div className="chat-title">
              ASK CHEMDIAG AI <span className="copilot-tag">COPILOT</span>
            </div>
            <p className="chat-subtitle">
              Ask questions about the current process, equipment, sensor values, faults and recommendations.
            </p>
          </div>
        </div>

        <div className="chat-header-actions">
          {/* AI Copilot Online Status Badge */}
          <div
            className="provider-badge rule"
            title="ChemDiag Local Process AI Copilot is online and monitoring live telemetry"
          >
            <span className="copilot-online-dot">●</span>
            <span>AI COPILOT ONLINE</span>
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
            ✕ Clear Equipment Filter
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
                {msg.sender === 'user' ? 'Operator' : 'ChemDiag AI Copilot'}
                <span className="message-timestamp">{msg.timestamp}</span>
              </div>

              <div className="message-body-text">
                {msg.text.split('\n').map((line, i) => (
                  <React.Fragment key={i}>
                    {line.startsWith('•') || line.startsWith('-') ? (
                      <div className="message-bullet-line">{line}</div>
                    ) : line.startsWith('CURRENT PROCESS STATUS:') || line.startsWith('RECOMMENDED') || line.startsWith('SEVERITY ASSESSMENT:') || line.startsWith('Evidence:') || line.startsWith('Probable Root Cause:') || line.startsWith('Why AI Diagnosed This:') || line.startsWith('Action:') ? (
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
              <span className="analyzing-text">AI is analyzing current process data...</span>
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
