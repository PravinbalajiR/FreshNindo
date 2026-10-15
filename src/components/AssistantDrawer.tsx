// FreshRoute — Operational Decision Assistant (Qwen / OpenRouter)
// Conversational decision support grounded in deterministic plan verification.

import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../store/AppContext';

const STARTER_PROMPTS = [
  'Which batches are most time-sensitive right now?',
  'Why was this destination selected for tomatoes?',
  'Explain the difference between baseline and proposed plans.',
  'What changed in the active disruption scenario?',
];

export const AssistantDrawer: React.FC = () => {
  const { state, toggleAssistant, askAssistantPrompt } = useApp();
  const [inputVal, setInputVal] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isAssistantOpen, isAskingAssistant, assistantMessages } = state;

  useEffect(() => {
    if (isAssistantOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [assistantMessages, isAssistantOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isAskingAssistant) return;
    const msg = inputVal.trim();
    setInputVal('');
    askAssistantPrompt(msg);
  };

  const handleStarterClick = (prompt: string) => {
    if (isAskingAssistant) return;
    askAssistantPrompt(prompt);
  };

  if (!isAssistantOpen) {
    return (
      <button
        onClick={() => toggleAssistant(true)}
        className="btn btn-primary"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          borderRadius: 999,
          padding: '12px 20px',
          boxShadow: '0 8px 24px rgba(0, 102, 204, 0.45)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13.5,
          fontWeight: 700,
        }}
        aria-label="Open Decision Assistant"
      >
        <span>💬</span>
        <span>Decision Assistant</span>
        <span
          style={{
            fontSize: 10,
            background: 'rgba(255,255,255,0.2)',
            padding: '2px 6px',
            borderRadius: 6,
          }}
        >
          Qwen
        </span>
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 420,
        maxWidth: 'calc(100vw - 48px)',
        height: 600,
        maxHeight: 'calc(100vh - 48px)',
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        overflow: 'hidden',
        animation: 'fadeInUp 200ms cubic-bezier(0.25,1,0.5,1) both',
      }}
      role="dialog"
      aria-label="FreshRoute Decision Assistant"
    >
      {/* Drawer Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-4) var(--space-5)',
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🧠</span>
            <span>Decision Assistant</span>
            <span
              style={{
                fontSize: 10,
                color: 'var(--accent-light)',
                background: 'rgba(0,102,204,0.15)',
                padding: '2px 6px',
                borderRadius: 4,
                fontWeight: 700,
              }}
            >
              Qwen 2.5 72B
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Grounded operational explanations & baseline proof
          </div>
        </div>

        <button
          className="btn btn-ghost btn-sm"
          style={{ padding: '4px 8px', fontSize: 13 }}
          onClick={() => toggleAssistant(false)}
          title="Close assistant"
        >
          ✕
        </button>
      </div>

      {/* Starters Section */}
      <div
        style={{
          padding: 'var(--space-3) var(--space-4)',
          background: 'rgba(255,255,255,0.02)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          whiteSpace: 'nowrap',
        }}
      >
        {STARTER_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => handleStarterClick(prompt)}
            disabled={isAskingAssistant}
            style={{
              fontSize: 11.5,
              padding: '4px 10px',
              borderRadius: 99,
              background: 'var(--surface-3)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              cursor: isAskingAssistant ? 'not-allowed' : 'pointer',
              flexShrink: 0,
            }}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        {assistantMessages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              style={{
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: isUser ? 'var(--accent)' : 'var(--surface-2)',
                border: isUser ? 'none' : '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '10px 14px',
                color: isUser ? '#fff' : 'var(--text-primary)',
                fontSize: 13,
                lineHeight: 1.5,
                wordBreak: 'break-word',
              }}
            >
              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
              <div
                style={{
                  fontSize: 10,
                  color: isUser ? 'rgba(255,255,255,0.7)' : 'var(--text-subtle)',
                  marginTop: 6,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{msg.timestamp}</span>
                {!isUser && msg.model && (
                  <span style={{ fontStyle: 'italic' }}>
                    {msg.model.includes('qwen') ? 'Qwen 2.5 72B' : msg.model}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {isAskingAssistant && (
          <div
            style={{
              alignSelf: 'flex-start',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '10px 14px',
              fontSize: 12.5,
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
            <span>Consulting Qwen with verified operational data…</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        style={{
          padding: 'var(--space-3) var(--space-4)',
          background: 'var(--surface-2)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 'var(--space-2)',
        }}
      >
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Ask about allocations, shelf-life, or scenarios…"
          disabled={isAskingAssistant}
          style={{
            flex: 1,
            background: 'var(--surface-3)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '8px 12px',
            color: 'var(--text-primary)',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={!inputVal.trim() || isAskingAssistant}
        >
          Send
        </button>
      </form>
    </div>
  );
};
